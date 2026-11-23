import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createProjectStore } from '../services/projectStore.js';
import { createProjectSaver, describeSaveError } from '../services/projectSaver.js';
import { acquireProjectLock } from '../services/projectLock.js';
import { revokeAllTrackedUrls } from '../services/objectUrls.js';
import { restoreSession, serializeSession } from '../services/sessionSnapshot.js';
import { createBlankState } from '../domain/blankSession.js';
import {
  installBeforeUnloadGuard,
  installTauriCloseGuard,
} from '../services/closeGuard.js';

const messageOf = (error, fallback) => {
  if (error?.code === 'quota' || error?.code === 'blocked') return describeSaveError(error);
  return error?.message || fallback;
};

const MIGRATION_NOTICE = {
  unreadable:
    "L'ancienne session n'a pas pu être lue. Elle reste intacte dans le stockage local et ne sera pas modifiée.",
};

/**
 * Orchestre la bibliothèque : migration, liste, ouverture/fermeture de projet,
 * sauvegarde du projet ouvert et protection à la fermeture.
 */
const useProjectLibrary = () => {
  const store = useMemo(() => {
    try {
      return createProjectStore({ idb: globalThis.indexedDB });
    } catch {
      return null;
    }
  }, []);
  const storageAvailable = Boolean(store && globalThis.indexedDB);
  const [phase, setPhase] = useState(storageAvailable ? 'loading' : 'fatal');
  const [projects, setProjects] = useState([]);
  const [lastProjectId, setLastProjectId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [fatal, setFatal] = useState(
    storageAvailable
      ? ''
      : 'Le stockage local du navigateur est indisponible : les projets ne peuvent pas être enregistrés.',
  );
  const [session, setSession] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ status: 'idle' });
  const [busy, setBusy] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(null);
  const sessionRef = useRef(null);
  const lockRef = useRef(null);
  const controlsRef = useRef(null);
  const quitResolverRef = useRef(null);
  const initRef = useRef(false);

  const refresh = useCallback(async () => {
    const [list, library] = await Promise.all([store.listProjects(), store.getLibrary()]);
    setProjects(list);
    setLastProjectId(library.lastProjectId);
  }, [store]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (!storageAvailable) return;
    (async () => {
      try {
        const migration = await store.migrateLegacySession();
        if (migration.status === 'unreadable') {
          setNotice({ kind: 'warning', message: MIGRATION_NOTICE.unreadable });
        } else if (migration.status === 'migrated') {
          setNotice({
            kind: 'info',
            message: 'Votre ancienne session a été conservée comme projet « Ancienne session ».',
          });
        }
        await refresh();
        setPhase('home');
      } catch (error) {
        setFatal(messageOf(error, 'Le stockage local est inaccessible.'));
        setPhase('fatal');
      }
    })();
  }, [store, refresh, storageAvailable]);

  const releaseSession = useCallback(() => {
    const current = sessionRef.current;
    if (current) current.saver.dispose();
    lockRef.current?.release();
    lockRef.current = null;
    sessionRef.current = null;
    controlsRef.current = null;
    revokeAllTrackedUrls();
    setSession(null);
    setSaveStatus({ status: 'idle' });
  }, []);

  const openProject = useCallback(
    async (id) => {
      if (!store || sessionRef.current) return false;
      setBusy(true);
      let lock = null;
      try {
        lock = await acquireProjectLock(id);
        if (!lock.ok) {
          setNotice({
            kind: 'warning',
            message: 'Ce projet est déjà ouvert dans une autre fenêtre. Fermez-le là-bas avant de l’ouvrir ici.',
          });
          return false;
        }
        const { meta, envelope } = await store.readProject(id);
        const restored = await restoreSession(envelope);
        if (!restored.ok) {
          lock.release();
          setNotice({
            kind: 'error',
            message: `Le projet « ${meta.name} » est illisible ou créé par une version incompatible. Il n'a pas été modifié.`,
          });
          return false;
        }
        const opened = await store.markOpened(id);
        const saver = createProjectSaver({
          projectId: id,
          initialRevision: envelope.revision,
          store,
          onStatus: setSaveStatus,
        });
        saver.start();
        lockRef.current = lock;
        const next = { id, meta: opened, initialState: restored.state, saver };
        sessionRef.current = next;
        setSaveStatus({ status: 'idle' });
        setNotice(null);
        setSession(next);
        setPhase('editor');
        return true;
      } catch (error) {
        lock?.release();
        setNotice({
          kind: 'error',
          message: messageOf(error, "Le projet n'a pas pu être ouvert."),
        });
        await refresh().catch(() => {});
        return false;
      } finally {
        setBusy(false);
      }
    },
    [store, refresh],
  );

  const createProject = useCallback(
    async (name) => {
      if (!store) return false;
      setBusy(true);
      try {
        const serialized = await serializeSession(createBlankState());
        if (!serialized.ok) throw serialized.error;
        const meta = await store.createProject({ name, data: serialized.data, origin: 'new' });
        setBusy(false);
        return openProject(meta.id);
      } catch (error) {
        setNotice({
          kind: 'error',
          message: messageOf(error, "Le projet n'a pas pu être créé."),
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [store, openProject],
  );

  const captureThumbnail = useCallback(async () => {
    const current = sessionRef.current;
    const controls = controlsRef.current;
    if (!current || !controls) return;
    try {
      const blob = await controls.captureThumbnail();
      if (blob) await store.saveThumbnail(current.id, blob);
    } catch (error) {
      console.error('Miniature non enregistrée', error);
    }
  }, [store]);

  const saveThumbnail = useCallback(
    async (blob) => {
      const current = sessionRef.current;
      if (!current || !blob) return;
      try {
        await store.saveThumbnail(current.id, blob);
      } catch (error) {
        console.error('Miniature non enregistrée', error);
      }
    },
    [store],
  );

  const finishLeave = useCallback(async () => {
    await captureThumbnail();
    releaseSession();
    try {
      await refresh();
    } catch (error) {
      setNotice({ kind: 'error', message: messageOf(error, 'Bibliothèque illisible.') });
    }
    setPhase('home');
  }, [captureThumbnail, releaseSession, refresh]);

  const goHome = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    setBusy(true);
    try {
      const outcome = await current.saver.flush();
      if (!outcome.ok) {
        setLeavePrompt({ error: outcome.error });
        return;
      }
      await finishLeave();
    } finally {
      setBusy(false);
    }
  }, [finishLeave]);

  const resolveLeave = useCallback(
    async (choice) => {
      setLeavePrompt(null);
      if (choice === 'discard') await finishLeave();
      else if (choice === 'retry') await goHome();
    },
    [finishLeave, goHome],
  );

  const saveNow = useCallback(() => sessionRef.current?.saver.flush(), []);

  const renameProject = useCallback(
    async (id, name) => {
      try {
        const meta = await store.renameProject(id, name);
        setProjects((list) => list.map((p) => (p.id === id ? meta : p)));
        if (sessionRef.current?.id === id) {
          sessionRef.current = { ...sessionRef.current, meta };
          setSession(sessionRef.current);
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, message: messageOf(error, 'Renommage impossible.') };
      }
    },
    [store],
  );

  const duplicateProject = useCallback(
    async (id) => {
      setBusy(true);
      try {
        await store.duplicateProject(id);
        await refresh();
      } catch (error) {
        setNotice({ kind: 'error', message: messageOf(error, 'Duplication impossible.') });
      } finally {
        setBusy(false);
      }
    },
    [store, refresh],
  );

  const deleteProject = useCallback(
    async (id) => {
      setBusy(true);
      try {
        await store.deleteProject(id);
        await refresh();
      } catch (error) {
        setNotice({ kind: 'error', message: messageOf(error, 'Suppression impossible.') });
      } finally {
        setBusy(false);
      }
    },
    [store, refresh],
  );

  const askQuitWithoutSaving = useCallback(
    (error) =>
      new Promise((resolve) => {
        quitResolverRef.current = resolve;
        setLeavePrompt({ error, closing: true });
      }),
    [],
  );

  const resolveClosePrompt = useCallback((quit) => {
    setLeavePrompt(null);
    quitResolverRef.current?.(quit);
    quitResolverRef.current = null;
  }, []);

  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (!sessionId) return undefined;
    const flush = () => sessionRef.current?.saver.flush() ?? Promise.resolve({ ok: true });
    const removeBefore = installBeforeUnloadGuard({
      hasUnsaved: () => Boolean(sessionRef.current?.saver.isDirty()),
      flush,
    });
    let disposed = false;
    let removeTauri = () => {};
    installTauriCloseGuard({ flush, confirmQuitWithoutSaving: askQuitWithoutSaving })
      .then((unlisten) => {
        if (disposed) unlisten();
        else removeTauri = unlisten;
      })
      .catch((error) => console.error('Garde de fermeture indisponible', error));
    return () => {
      disposed = true;
      removeBefore();
      removeTauri();
    };
  }, [sessionId, askQuitWithoutSaving]);

  return {
    phase,
    fatal,
    projects,
    lastProjectId,
    notice,
    dismissNotice: () => setNotice(null),
    session,
    saveStatus,
    busy,
    controlsRef,
    leavePrompt,
    resolveLeave,
    resolveClosePrompt,
    openProject,
    createProject,
    goHome,
    saveNow,
    saveThumbnail,
    renameProject,
    duplicateProject,
    deleteProject,
  };
};

export default useProjectLibrary;
