import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

import { createProjectStore } from '../src/services/projectStore.js';
import { openDatabase, STORE_SESSION } from '../src/services/idb.js';
import { SCHEMA_VERSION, SESSION_KEY } from '../src/services/persistence.js';
import { serializeSession } from '../src/services/sessionSnapshot.js';
import { createBlankState } from '../src/domain/blankSession.js';
import { LEGACY_PROJECT_NAME } from '../src/domain/projects.js';

const snapshot = async (state) => {
  const result = await serializeSession(state);
  assert.equal(result.ok, true);
  return result.data;
};
const BLANK = await snapshot(createBlankState());
const blankData = () => structuredClone(BLANK);

const makeStore = () => {
  const idb = new IDBFactory();
  let t = 1000;
  let n = 0;
  const store = createProjectStore({ idb, now: () => (t += 10), createId: () => `id-${++n}` });
  return { idb, store };
};

const seedLegacy = async (idb, envelope) => {
  const db = await openDatabase(idb);
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SESSION], 'readwrite');
    tx.objectStore(STORE_SESSION).put(envelope, SESSION_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

test('create / read / list', async () => {
  const { store } = makeStore();
  const meta = await store.createProject({ name: '  Mon   projet ', data: blankData() });
  assert.equal(meta.name, 'Mon projet');
  assert.equal(meta.revision, 1);
  const { envelope } = await store.readProject(meta.id);
  assert.equal(envelope.revision, 1);
  assert.equal((await store.listProjects()).length, 1);
});

test('nom vide refusé', async () => {
  const { store } = makeStore();
  await assert.rejects(store.createProject({ name: '  ', data: blankData() }), { code: 'invalid' });
});

test('save : CAS incrémente la révision, conflit détecté', async () => {
  const { store } = makeStore();
  const { id } = await store.createProject({ name: 'A', data: blankData() });
  const r = await store.saveProject(id, { data: { ...blankData(), canvasW: 5 }, expectedRevision: 1 });
  assert.equal(r.revision, 2);
  await assert.rejects(
    store.saveProject(id, { data: blankData(), expectedRevision: 1 }),
    { code: 'conflict' },
  );
  const { meta, envelope } = await store.readProject(id);
  assert.equal(meta.revision, 2);
  assert.equal(envelope.data.canvasW, 5);
});

test('save sur projet supprimé : not-found', async () => {
  const { store } = makeStore();
  await assert.rejects(store.saveProject('nope', { data: blankData(), expectedRevision: 1 }), {
    code: 'not-found',
  });
});

test('rename ne touche ni les données ni la révision', async () => {
  const { store } = makeStore();
  const { id } = await store.createProject({ name: 'A', data: blankData() });
  await store.renameProject(id, 'B');
  const { meta, envelope } = await store.readProject(id);
  assert.equal(meta.name, 'B');
  assert.equal(meta.revision, 1);
  assert.equal(envelope.revision, 1);
  await assert.rejects(store.renameProject(id, ''), { code: 'invalid' });
});

test('duplicate : copie indépendante avec Blob dupliqué', async () => {
  const { store } = makeStore();
  const data = { ...blankData(), subjects: [{ id: 1, blob: new Blob(['abc']) }] };
  const a = await store.createProject({ name: 'A', data });
  const b = await store.duplicateProject(a.id);
  assert.notEqual(a.id, b.id);
  assert.equal(b.name, 'A (copie)');
  assert.equal(b.origin, 'duplicate');
  await store.saveProject(a.id, { data: blankData(), expectedRevision: 1 });
  const copy = await store.readProject(b.id);
  assert.equal(copy.envelope.data.subjects.length, 1);
  assert.equal(await copy.envelope.data.subjects[0].blob.text(), 'abc');
  await store.deleteProject(a.id);
  assert.equal((await store.readProject(b.id)).envelope.data.subjects.length, 1);
});

test('delete : supprime uniquement ce projet et réinitialise lastProjectId', async () => {
  const { store } = makeStore();
  const a = await store.createProject({ name: 'A', data: blankData() });
  const b = await store.createProject({ name: 'B', data: blankData() });
  await store.markOpened(a.id);
  assert.equal((await store.getLibrary()).lastProjectId, a.id);
  assert.equal(await store.deleteProject(a.id), true);
  assert.equal((await store.getLibrary()).lastProjectId, null);
  assert.deepEqual((await store.listProjects()).map((p) => p.id), [b.id]);
  await assert.rejects(store.readProject(a.id), { code: 'not-found' });
  assert.equal(await store.deleteProject(a.id), false);
});

test('thumbnail : enregistrée sans toucher à la révision', async () => {
  const { store } = makeStore();
  const { id } = await store.createProject({ name: 'A', data: blankData() });
  assert.equal(await store.saveThumbnail(id, new Blob(['t'])), true);
  assert.equal(await store.saveThumbnail('nope', null), false);
  const { meta } = await store.readProject(id);
  assert.equal(meta.revision, 1);
  assert.ok(meta.thumbnail);
});

test('migration : session héritée → un projet, source intacte, idempotent', async () => {
  const { idb, store } = makeStore();
  const custom = createBlankState();
  custom.canvasW = 1234;
  const data = await snapshot(custom);
  const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: 42, data };
  await seedLegacy(idb, envelope);
  const first = await store.migrateLegacySession();
  assert.equal(first.status, 'migrated');
  const second = await store.migrateLegacySession();
  assert.equal(second.status, 'already');
  const list = await store.listProjects();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, LEGACY_PROJECT_NAME);
  assert.equal(list[0].origin, 'legacy');
  assert.equal((await store.getLibrary()).lastProjectId, list[0].id);
  const db = await openDatabase(idb);
  const src = await new Promise((res) => {
    const r = db.transaction([STORE_SESSION]).objectStore(STORE_SESSION).get(SESSION_KEY);
    r.onsuccess = () => res(r.result);
  });
  db.close();
  assert.deepEqual(src, envelope);
});

test('migration : aucune session → marquée faite, aucun projet', async () => {
  const { store } = makeStore();
  assert.equal((await store.migrateLegacySession()).status, 'none');
  assert.equal((await store.migrateLegacySession()).status, 'already');
  assert.equal((await store.listProjects()).length, 0);
});

test('migration : session illisible → rien créé, source conservée, retentable', async () => {
  const { idb, store } = makeStore();
  await seedLegacy(idb, { schemaVersion: 99, savedAt: 1, data: {} });
  assert.equal((await store.migrateLegacySession()).status, 'unreadable');
  assert.equal((await store.migrateLegacySession()).status, 'unreadable');
  assert.equal((await store.listProjects()).length, 0);
  assert.equal((await store.getLibrary()).legacyMigration, null);
});
