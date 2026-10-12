import { createBlankState } from '../domain/blankSession.js';
import { writeSession } from './persistence.js';
import { serializeSession } from './sessionSnapshot.js';
import { createAutosaver, loadInitialSession, releaseRestoredUrls } from './autosave.js';

const READ_FAILURE = "La sauvegarde n'a pas pu être lue.";
const APPLY_FAILURE = "La session sauvegardée n'a pas pu être appliquée.";
const RELOAD_ADVICE =
  "La nouvelle session a été enregistrée mais n'a pas pu être appliquée : recharge la page.";

const replaceSession = async (state) => {
  const serialized = await serializeSession(state);
  if (!serialized.ok) return serialized;
  return writeSession(serialized.data);
};

export const createSessionManager = ({
  load = loadInitialSession,
  replace = replaceSession,
  createBlank = createBlankState,
  createSaver = createAutosaver,
  release = releaseRestoredUrls,
  logError = console.error,
  onRestore = () => {},
  onPhase = () => {},
  onProblem = () => {},
  onSaveStatus = () => {},
} = {}) => {
  const saver = createSaver({ onStatus: onSaveStatus });
  let phase = 'loading';
  let disposed = false;
  let skipNext = false;
  let discarding = false;

  const enter = (next) => {
    phase = next;
    onPhase(next);
  };

  const block = (message) => {
    onProblem(message);
    enter('blocked');
  };

  return {
    async init() {
      let outcome;
      try {
        outcome = await load();
      } catch (error) {
        outcome = { status: 'blocked', message: READ_FAILURE, error };
      }
      if (disposed) {
        if (outcome.status === 'restored') release(outcome.state);
        return;
      }
      if (outcome.status === 'blocked') {
        block(outcome.message);
        return;
      }
      if (outcome.status === 'restored') {
        try {
          onRestore(outcome.state);
        } catch (error) {
          logError(error);
          release(outcome.state);
          block(APPLY_FAILURE);
          return;
        }
        skipNext = true;
      }
      enter('ready');
      saver.start();
    },
    notify(state) {
      if (disposed || phase !== 'ready') return false;
      if (skipNext) {
        skipNext = false;
        return false;
      }
      return saver.notify(state);
    },
    async discard() {
      if (disposed || phase !== 'blocked' || discarding) return false;
      discarding = true;
      try {
        const blank = createBlank();
        let result;
        try {
          result = await replace(blank);
        } catch (error) {
          result = { ok: false, error };
        }
        if (disposed) return false;
        if (!result?.ok) {
          onProblem(
            `Remplacement impossible : ${result?.error?.message ?? 'erreur inconnue'}. La sauvegarde précédente est conservée.`,
          );
          return false;
        }
        try {
          onRestore(blank);
        } catch (error) {
          logError(error);
          onProblem(RELOAD_ADVICE);
          return false;
        }
        skipNext = true;
        enter('ready');
        saver.start();
        onSaveStatus({ status: 'saved', savedAt: result.savedAt });
        return true;
      } finally {
        discarding = false;
      }
    },
    flush() {
      return phase === 'ready' && !disposed ? saver.flush() : Promise.resolve();
    },
    dispose() {
      disposed = true;
      saver.dispose();
    },
    getPhase() {
      return phase;
    },
  };
};