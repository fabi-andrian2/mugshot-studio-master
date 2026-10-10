import { useCallback, useReducer } from 'react';

const DEFAULT_OPTIONS = { isEqual: Object.is, limit: 50, mergeWindowMs: 0 };

const createState = (initialState) => ({
  past: [],
  present: initialState,
  committed: initialState,
  future: [],
  lastMerge: null,
});

const settle = (state) =>
  state.present === state.committed ? state : { ...state, present: state.committed };

const mapStable = (list, fn) => {
  let changed = false;
  const mapped = list.map((item) => {
    const next = fn(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? mapped : list;
};

const commitState = (state, { isEqual, limit, mergeKey, time, mergeWindowMs }) => {
  if (isEqual(state.present, state.committed)) {
    return state.committed === state.present ? state : { ...state, committed: state.present };
  }
  const last = state.lastMerge;
  const canMerge =
    mergeKey != null &&
    last !== null &&
    last.key === mergeKey &&
    time - last.time <= mergeWindowMs &&
    state.past.length > 0;
  return {
    past: canMerge ? state.past : [...state.past, state.committed].slice(-limit),
    present: state.present,
    committed: state.present,
    future: [],
    lastMerge: mergeKey != null ? { key: mergeKey, time } : null,
  };
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'set': {
      const next = action.updater(state.present);
      return next === state.present ? state : { ...state, present: next };
    }
    case 'apply': {
      const next = action.updater(state.present);
      return commitState({ ...state, present: next }, action);
    }
    case 'commit':
      return commitState(state, action);
    case 'rollback':
      return settle(state);
    case 'undo': {
      const base = settle(state);
      if (base.past.length === 0) return base;
      const previous = base.past[base.past.length - 1];
      return {
        past: base.past.slice(0, -1),
        present: previous,
        committed: previous,
        future: [base.present, ...base.future],
        lastMerge: null,
      };
    }
    case 'redo': {
      const base = settle(state);
      if (base.future.length === 0) return base;
      const [next, ...rest] = base.future;
      return {
        past: [...base.past, base.present],
        present: next,
        committed: next,
        future: rest,
        lastMerge: null,
      };
    }
    case 'patchAll': {
      const present = action.fn(state.present);
      const committed = state.committed === state.present ? present : action.fn(state.committed);
      const past = mapStable(state.past, action.fn);
      const future = mapStable(state.future, action.fn);
      if (
        present === state.present &&
        committed === state.committed &&
        past === state.past &&
        future === state.future
      ) {
        return state;
      }
      return { ...state, present, committed, past, future };
    }
    default:
      return state;
  }
};

const useHistory = (initialState, options = DEFAULT_OPTIONS) => {
  const { isEqual, limit, mergeWindowMs } = { ...DEFAULT_OPTIONS, ...options };
  const [state, dispatch] = useReducer(reducer, initialState, createState);

  const set = useCallback((updater) => dispatch({ type: 'set', updater }), []);

  const apply = useCallback(
    (updater, mergeKey = null) =>
      dispatch({ type: 'apply', updater, mergeKey, time: Date.now(), isEqual, limit, mergeWindowMs }),
    [isEqual, limit, mergeWindowMs],
  );

  const commit = useCallback(
    () => dispatch({ type: 'commit', mergeKey: null, time: Date.now(), isEqual, limit, mergeWindowMs }),
    [isEqual, limit, mergeWindowMs],
  );

  const rollback = useCallback(() => dispatch({ type: 'rollback' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const patchAll = useCallback((fn) => dispatch({ type: 'patchAll', fn }), []);

  return {
    state: state.present,
    set,
    apply,
    commit,
    rollback,
    undo,
    redo,
    patchAll,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
};

export default useHistory;
export { createState as createHistoryState, reducer as historyReducer };