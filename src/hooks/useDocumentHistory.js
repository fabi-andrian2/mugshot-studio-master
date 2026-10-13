import { useCallback } from 'react';
import useHistory from './useHistory.js';
import {
  createDocumentState,
  liftSubjects,
  liftMeasureItems,
} from '../domain/documentHistory.js';

const INITIAL_STATE = createDocumentState();

const useDocumentHistory = (options) => {
  const history = useHistory(INITIAL_STATE, options);
  const { state, set, apply, patchAll, reset } = history;

  const setSubjects = useCallback((updater) => set(liftSubjects(updater)), [set]);
  const applySubjects = useCallback(
    (updater, mergeKey) => apply(liftSubjects(updater), mergeKey),
    [apply],
  );
  const applyMeasures = useCallback(
    (updater, mergeKey) => apply(liftMeasureItems(updater), mergeKey),
    [apply],
  );
  const patchMeasures = useCallback(
    (updater) => patchAll(liftMeasureItems(updater)),
    [patchAll],
  );
  const resetDocument = useCallback(
    (subjects, measureItems) => reset(createDocumentState(subjects, measureItems)),
    [reset],
  );

  return {
    subjects: state.subjects,
    measureItems: state.measureItems,
    set: setSubjects,
    apply: applySubjects,
    applyMeasures,
    patchMeasures,
    reset: resetDocument,
    commit: history.commit,
    rollback: history.rollback,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
};

export default useDocumentHistory;