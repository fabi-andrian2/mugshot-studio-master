import { readSession, writeSession } from './persistence.js';
import { serializeSession, restoreSession } from './sessionSnapshot.js';

export const AUTOSAVE_DELAY_MS = 800;

const describeProblem = (error) => {
  switch (error?.code) {
    case 'unsupported-version':
      return "La sauvegarde a été créée par une version incompatible de l'application.";
    case 'invalid':
    case 'invalid-snapshot':
      return 'La sauvegarde est illisible ou incomplète.';
    case 'unavailable':
      return 'Le stockage du navigateur est indisponible.';
    default:
      return 'La sauvegarde n\'a pas pu être lue.';
  }
};

export const loadInitialSession = async ({
  read = readSession,
  restore = restoreSession,
} = {}) => {
  let result;
  try {
    result = await read();
  } catch (error) {
    return { status: 'blocked', message: describeProblem(error), error };
  }
  if (result.status === 'empty') return { status: 'empty' };
  if (result.status !== 'ok') {
    return { status: 'blocked', message: describeProblem(result.error), error: result.error };
  }
  let restored;
  try {
    restored = await restore(result.snapshot);
  } catch (error) {
    return { status: 'blocked', message: describeProblem(error), error };
  }
  if (!restored.ok) {
    return { status: 'blocked', message: describeProblem(restored.error), error: restored.error };
  }
  return { status: 'restored', state: restored.state };
};

export const releaseRestoredUrls = (state, revokeUrl = (url) => URL.revokeObjectURL(url)) => {
  const urls = state.subjects.map((subject) => subject.url);
  if (state.board.background.image) urls.push(state.board.background.image.url);
  urls.forEach((url) => revokeUrl(url));
};

export const createAutosaver = ({
  serialize = serializeSession,
  write = writeSession,
  delayMs = AUTOSAVE_DELAY_MS,
  onStatus = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) => {
  let started = false;
  let disposed = false;
  let pending = false;
  let latest = null;
  let revision = 0;
  let timer = null;
  let running = null;

  const report = (status) => {
    if (!disposed) onStatus(status);
  };

  const saveOnce = async (state, rev) => {
    report({ status: 'saving' });
    try {
      const serialized = await serialize(state);
      if (rev !== revision) return;
      if (!serialized.ok) {
        report({ status: 'error', error: serialized.error });
        return;
      }
      const written = await write(serialized.data);
      if (!written.ok) {
        report({ status: 'error', error: written.error });
        return;
      }
      report({ status: 'saved', savedAt: written.savedAt });
    } catch (error) {
      if (rev === revision) report({ status: 'error', error });
    }
  };

  const loop = async () => {
    while (pending && !disposed) {
      pending = false;
      await saveOnce(latest, revision);
    }
  };

  const drain = () => {
    if (running) return running;
    const job = loop().finally(() => {
      if (running === job) running = null;
      if (pending && !disposed) drain();
    });
    running = job;
    return job;
  };

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  return {
    start() {
      started = true;
    },
    notify(state) {
      if (!started || disposed) return false;
      latest = state;
      revision += 1;
      pending = true;
      cancelTimer();
      timer = setTimer(() => {
        timer = null;
        drain();
      }, delayMs);
      return true;
    },
    flush() {
      if (!started || disposed) return Promise.resolve();
      cancelTimer();
      return pending || running ? drain() : Promise.resolve();
    },
    dispose() {
      disposed = true;
      pending = false;
      cancelTimer();
    },
  };
};