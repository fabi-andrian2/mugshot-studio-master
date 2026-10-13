export const EMPTY_MEASURE_SELECTION = [];

export const selectMeasure = (selection, id, additive = false) => {
  if (additive) {
    return selection.includes(id) ? selection.filter((current) => current !== id) : [...selection, id];
  }
  return selection.length === 1 && selection[0] === id ? selection : [id];
};

export const clearMeasureSelection = (selection) =>
  (selection.length === 0 ? selection : EMPTY_MEASURE_SELECTION);

export const pruneMeasureSelection = (selection, items) => {
  if (selection.length === 0) return selection;
  const existing = new Set(items.map((item) => item.id));
  const kept = selection.filter((id) => existing.has(id));
  if (kept.length === selection.length) return selection;
  return kept.length === 0 ? EMPTY_MEASURE_SELECTION : kept;
};

export const isMeasureSelected = (selection, id) => selection.includes(id);