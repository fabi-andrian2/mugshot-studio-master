export const EMPTY_SUBJECT_SELECTION = [];

export const selectSubject = (selection, id, additive = false) => {
  if (additive) {
    return selection.includes(id) ? selection.filter((current) => current !== id) : [...selection, id];
  }
  return selection.length === 1 && selection[0] === id ? selection : [id];
};

export const deselectSubject = (selection, id) => {
  if (!selection.includes(id)) return selection;
  const remaining = selection.filter((current) => current !== id);
  return remaining.length === 0 ? EMPTY_SUBJECT_SELECTION : remaining;
};

export const removeSubjectsById = (subjects, ids) => {
  if (ids.length === 0) return subjects;
  const removed = new Set(ids);
  const kept = subjects.filter((subject) => !removed.has(subject.id));
  return kept.length === subjects.length ? subjects : kept;
};

export const pruneSubjectSelection = (selection, subjects) => {
  if (selection.length === 0) return selection;
  const existing = new Set(subjects.map((subject) => subject.id));
  const kept = selection.filter((id) => existing.has(id));
  if (kept.length === selection.length) return selection;
  return kept.length === 0 ? EMPTY_SUBJECT_SELECTION : kept;
};

export const getSingleSelectedId = (selection) => (selection.length === 1 ? selection[0] : null);

export const getDragIds = (selection, id) =>
  selection.length > 1 && selection.includes(id) ? selection : [id];

export const getSelectionCountLabel = (count) => (count > 1 ? `${count} sujets` : '');
