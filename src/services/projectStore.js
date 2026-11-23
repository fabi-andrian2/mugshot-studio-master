import {
  STORE_SESSION,
  STORE_PROJECTS,
  STORE_PROJECT_DATA,
  STORE_META,
  PersistenceError,
  runTransaction,
  wrapRequest,
} from './idb.js';
import { SCHEMA_VERSION, SESSION_KEY } from './persistence.js';
import { checkSnapshotData } from './sessionSnapshot.js';
import {
  LEGACY_PROJECT_NAME,
  getCopyName,
  getProjectStats,
  isPristineSnapshotData,
  normalizeProjectName,
} from '../domain/projects.js';

export const LIBRARY_KEY = 'library';
export const PROJECT_FORMAT_VERSION = 1;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const EMPTY_LIBRARY = { lastProjectId: null, legacyMigration: null };

const defaultCreateId = () => globalThis.crypto.randomUUID();

const notFound = () => new PersistenceError('not-found', "Ce projet n'existe plus dans la bibliothèque.");

export const createProjectStore = ({
  idb,
  now = Date.now,
  createId = defaultCreateId,
} = {}) => {
  const run = (stores, mode, code, work) => runTransaction(idb, stores, mode, code, work);
  const read = (store, key) => wrapRequest(store.get(key));
  const write = (store, value, key) => wrapRequest(store.put(value, key));
  const readLibrary = async (store) => ({ ...EMPTY_LIBRARY, ...((await read(store, LIBRARY_KEY)) ?? {}) });

  const buildMeta = ({ id, name, data, origin, createdAt, lastOpenedAt, thumbnail = null }) => ({
    id,
    name,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: lastOpenedAt ?? createdAt,
    revision: 1,
    formatVersion: PROJECT_FORMAT_VERSION,
    origin,
    stats: getProjectStats(data),
    thumbnail,
  });

  const buildEnvelope = ({ id, data, savedAt, schemaVersion = SCHEMA_VERSION }) => ({
    id,
    schemaVersion,
    revision: 1,
    savedAt,
    data,
  });

  return {
    listProjects: () =>
      run([STORE_PROJECTS], 'readonly', 'read', (s) => wrapRequest(s[STORE_PROJECTS].getAll())),

    getLibrary: () =>
      run([STORE_META], 'readonly', 'read', (s) => readLibrary(s[STORE_META])),

    readProject: (id) =>
      run([STORE_PROJECTS, STORE_PROJECT_DATA], 'readonly', 'read', async (s) => {
        const meta = await read(s[STORE_PROJECTS], id);
        const envelope = await read(s[STORE_PROJECT_DATA], id);
        if (!meta || !envelope) throw notFound();
        return { meta, envelope };
      }),

    createProject: ({ name, data, origin = 'new' }) => {
      const clean = normalizeProjectName(name);
      if (!clean) {
        return Promise.reject(new PersistenceError('invalid', 'Le nom du projet est vide.'));
      }
      if (!isObject(data)) {
        return Promise.reject(new PersistenceError('invalid', 'Contenu de projet invalide.'));
      }
      const id = createId();
      const t = now();
      const meta = buildMeta({ id, name: clean, data, origin, createdAt: t });
      return run([STORE_PROJECTS, STORE_PROJECT_DATA], 'readwrite', 'write', async (s) => {
        await write(s[STORE_PROJECTS], meta, id);
        await write(s[STORE_PROJECT_DATA], buildEnvelope({ id, data, savedAt: t }), id);
        return meta;
      });
    },

    saveProject: (id, { data, expectedRevision }) => {
      if (!isObject(data)) {
        return Promise.reject(new PersistenceError('write', "L'instantané doit être un objet."));
      }
      return run([STORE_PROJECTS, STORE_PROJECT_DATA], 'readwrite', 'write', async (s) => {
        const meta = await read(s[STORE_PROJECTS], id);
        if (!meta) throw notFound();
        if (meta.revision !== expectedRevision) {
          throw new PersistenceError(
            'conflict',
            'Ce projet a été modifié ailleurs (autre fenêtre) depuis son ouverture.',
          );
        }
        const revision = meta.revision + 1;
        const savedAt = now();
        await write(
          s[STORE_PROJECT_DATA],
          { id, schemaVersion: SCHEMA_VERSION, revision, savedAt, data },
          id,
        );
        await write(
          s[STORE_PROJECTS],
          { ...meta, revision, updatedAt: savedAt, stats: getProjectStats(data) },
          id,
        );
        return { revision, savedAt };
      });
    },

    saveThumbnail: (id, thumbnail) =>
      run([STORE_PROJECTS], 'readwrite', 'write', async (s) => {
        const meta = await read(s[STORE_PROJECTS], id);
        if (!meta) return false;
        await write(s[STORE_PROJECTS], { ...meta, thumbnail }, id);
        return true;
      }),

    markOpened: (id) =>
      run([STORE_PROJECTS, STORE_META], 'readwrite', 'write', async (s) => {
        const meta = await read(s[STORE_PROJECTS], id);
        if (!meta) throw notFound();
        const next = { ...meta, lastOpenedAt: now() };
        await write(s[STORE_PROJECTS], next, id);
        const library = await readLibrary(s[STORE_META]);
        await write(s[STORE_META], { ...library, lastProjectId: id }, LIBRARY_KEY);
        return next;
      }),

    renameProject: (id, name) => {
      const clean = normalizeProjectName(name);
      if (!clean) {
        return Promise.reject(new PersistenceError('invalid', 'Le nom du projet est vide.'));
      }
      return run([STORE_PROJECTS], 'readwrite', 'write', async (s) => {
        const meta = await read(s[STORE_PROJECTS], id);
        if (!meta) throw notFound();
        const next = { ...meta, name: clean };
        await write(s[STORE_PROJECTS], next, id);
        return next;
      });
    },

    duplicateProject: (id, { name } = {}) =>
      run([STORE_PROJECTS, STORE_PROJECT_DATA], 'readwrite', 'write', async (s) => {
        const meta = await read(s[STORE_PROJECTS], id);
        const envelope = await read(s[STORE_PROJECT_DATA], id);
        if (!meta || !envelope) throw notFound();
        const all = await wrapRequest(s[STORE_PROJECTS].getAll());
        const copyName =
          normalizeProjectName(name) || getCopyName(meta.name, all.map((project) => project.name));
        const copyId = createId();
        const t = now();
        const copyMeta = buildMeta({
          id: copyId,
          name: copyName,
          data: envelope.data,
          origin: 'duplicate',
          createdAt: t,
          thumbnail: meta.thumbnail ?? null,
        });
        await write(s[STORE_PROJECTS], copyMeta, copyId);
        await write(
          s[STORE_PROJECT_DATA],
          buildEnvelope({
            id: copyId,
            data: envelope.data,
            savedAt: t,
            schemaVersion: envelope.schemaVersion,
          }),
          copyId,
        );
        return copyMeta;
      }),

    deleteProject: (id) =>
      run([STORE_PROJECTS, STORE_PROJECT_DATA, STORE_META], 'readwrite', 'write', async (s) => {
        const existed = Boolean(await read(s[STORE_PROJECTS], id));
        await wrapRequest(s[STORE_PROJECTS].delete(id));
        await wrapRequest(s[STORE_PROJECT_DATA].delete(id));
        const library = await readLibrary(s[STORE_META]);
        if (library.lastProjectId === id) {
          await write(s[STORE_META], { ...library, lastProjectId: null }, LIBRARY_KEY);
        }
        return existed;
      }),

    migrateLegacySession: () =>
      run(
        [STORE_SESSION, STORE_PROJECTS, STORE_PROJECT_DATA, STORE_META],
        'readwrite',
        'write',
        async (s) => {
          const library = await readLibrary(s[STORE_META]);
          if (library.legacyMigration?.done) {
            return { status: 'already', projectId: library.legacyMigration.projectId ?? null };
          }
          const markDone = (extra) =>
            write(
              s[STORE_META],
              { ...library, legacyMigration: { done: true, at: now(), projectId: null, ...extra } },
              LIBRARY_KEY,
            );

          const envelope = await read(s[STORE_SESSION], SESSION_KEY);
          if (envelope === undefined) {
            await markDone({ reason: 'none' });
            return { status: 'none' };
          }

          const structural =
            isObject(envelope) &&
            envelope.schemaVersion === SCHEMA_VERSION &&
            typeof envelope.savedAt === 'number' &&
            isObject(envelope.data);
          if (!structural) {
            return { status: 'unreadable', reason: 'Ancienne session illisible ou d\'une autre version.' };
          }
          const problem = checkSnapshotData(envelope.data);
          if (problem) return { status: 'unreadable', reason: problem.message };

          if (isPristineSnapshotData(envelope.data)) {
            await markDone({ reason: 'blank' });
            return { status: 'skipped-blank' };
          }

          const id = createId();
          const meta = buildMeta({
            id,
            name: LEGACY_PROJECT_NAME,
            data: envelope.data,
            origin: 'legacy',
            createdAt: envelope.savedAt,
          });
          await write(s[STORE_PROJECTS], { ...meta, updatedAt: envelope.savedAt }, id);
          await write(
            s[STORE_PROJECT_DATA],
            buildEnvelope({ id, data: envelope.data, savedAt: envelope.savedAt }),
            id,
          );
          await write(
            s[STORE_META],
            {
              ...library,
              lastProjectId: id,
              legacyMigration: {
                done: true,
                at: now(),
                projectId: id,
                reason: 'migrated',
                sourceSavedAt: envelope.savedAt,
              },
            },
            LIBRARY_KEY,
          );
          return { status: 'migrated', projectId: id };
        },
      ),
  };
};
