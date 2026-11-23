import { serializeSession } from './sessionSnapshot.js';

export const AUTOSAVE_DELAY_MS = 800;
export const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000];
const FATAL_CODES = new Set(['conflict', 'not-found', 'invalid', 'invalid-state']);

export const isFatalSaveError = (error) => FATAL_CODES.has(error?.code);

export const describeSaveError = (error) => {
  switch (error?.code) {
    case 'conflict':
      return 'Ce projet a été modifié dans une autre fenêtre. Rouvrez-le depuis l’accueil pour éviter d’écraser ce travail.';
    case 'not-found':
      return 'Ce projet n’existe plus dans la bibliothèque.';
    case 'quota':
      return 'Espace de stockage insuffisant : libérez de la place ou supprimez un projet.';
    case 'blocked':
      return 'Le stockage est bloqué par une autre fenêtre de l’application.';
    case 'unavailable':
      return 'Le stockage local est indisponible.';
    default:
      return 'La sauvegarde a échoué.';
  }
};

/**
 * Sauvegarde d'UN projet : debounce, une seule écriture à la fois, contrôle de révision,
 * nouvelles tentatives automatiques. `flush()` renvoie toujours { ok, error }.
 * Statuts : idle → pending → saving → saved | error.
 */
export const createProjectSaver = ({
  projectId,
  initialRevision,
  store,
  serialize = serializeSession,
  delayMs = AUTOSAVE_DELAY_MS,
  retryDelays = RETRY_DELAYS_MS,
  onStatus = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) => {
  let expectedRevision = initialRevision;
  let started = false;
  let disposed = false;
  let blocked = false;
  let latest = null;
  let version = 0;
  let savedVersion = 0;
  let failures = 0;
  let timer = null;
  let running = null;
  let status = { status: 'idle' };

  const report = (next) => {
    status = next;
    if (!disposed) onStatus(next);
  };

  const isDirty = () => savedVersion !== version;

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const attempt = async () => {
    const v = version;
    const state = latest;
    report({ status: 'saving' });
    try {
      const serialized = await serialize(state);
      if (!serialized.ok) return { ok: false, error: serialized.error };
      if (v !== version) return { ok: true };
      const result = await store.saveProject(projectId, {
        data: serialized.data,
        expectedRevision,
      });
      expectedRevision = result.revision;
      savedVersion = v;
      return { ok: true, savedAt: result.savedAt };
    } catch (error) {
      return { ok: false, error };
    }
  };

  const scheduleRetry = () => {
    cancelTimer();
    const wait = retryDelays[Math.min(failures - 1, retryDelays.length - 1)];
    timer = setTimer(() => {
      timer = null;
      run();
    }, wait);
  };

  const drain = async () => {
    let outcome = { ok: true };
    while (!disposed && !blocked && isDirty()) {
      outcome = await attempt();
      if (!outcome.ok) break;
    }
    if (disposed) return outcome;
    if (!outcome.ok) {
      failures += 1;
      if (isFatalSaveError(outcome.error)) {
        blocked = true;
        report({ status: 'error', error: outcome.error, fatal: true, retrying: false });
      } else {
        report({ status: 'error', error: outcome.error, fatal: false, retrying: true });
        scheduleRetry();
      }
      return outcome;
    }
    failures = 0;
    if (started && !isDirty()) report({ status: 'saved', savedAt: outcome.savedAt ?? status.savedAt });
    return outcome;
  };

  const run = () => {
    if (running) return running;
    const job = drain().finally(() => {
      if (running === job) running = null;
    });
    running = job;
    return job;
  };

  return {
    start() {
      started = true;
    },
    notify(state) {
      if (!started || disposed || blocked) return false;
      latest = state;
      version += 1;
      if (status.status !== 'error' && status.status !== 'pending') report({ status: 'pending' });
      cancelTimer();
      timer = setTimer(() => {
        timer = null;
        run();
      }, failures > 0 ? retryDelays[Math.min(failures - 1, retryDelays.length - 1)] : delayMs);
      return true;
    },
    async flush() {
      if (!started || disposed) return { ok: true };
      cancelTimer();
      if (blocked) {
        return isDirty() ? { ok: false, error: status.error } : { ok: true };
      }
      let outcome = { ok: true };
      while (!disposed && !blocked && (isDirty() || running)) {
        outcome = await run();
        if (!outcome.ok) return outcome;
      }
      if (blocked && isDirty()) return { ok: false, error: status.error };
      return outcome.ok ? { ok: true } : outcome;
    },
    isDirty: () => started && isDirty(),
    getStatus: () => status,
    getRevision: () => expectedRevision,
    dispose() {
      disposed = true;
      cancelTimer();
    },
  };
};
