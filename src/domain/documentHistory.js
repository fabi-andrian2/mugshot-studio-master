import { areSubjectListsEqual } from './subjects.js';

export const createDocumentState = (subjects = [], measureItems = []) => ({ subjects, measureItems });

export const areDocumentStatesEqual = (a, b) =>
  a === b || (areSubjectListsEqual(a.subjects, b.subjects) && a.measureItems === b.measureItems);

export const liftSubjects = (updater) => (state) => {
  const next = updater(state.subjects);
  return next === state.subjects ? state : { ...state, subjects: next };
};

export const liftMeasureItems = (updater) => (state) => {
  const next = updater(state.measureItems);
  return next === state.measureItems ? state : { ...state, measureItems: next };
};

export const liftMeasureOperation = (operation) => (items) =>
  operation({ active: false, items }).items;