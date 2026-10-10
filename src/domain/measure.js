import { CM_TO_PX } from './constants.js';
import { formatHeight } from './measurement.js';

export const MIN_MEASURE_SCREEN_PX = 6;

export const DEFAULT_MEASURE = { active: false, items: [] };

export const toggleMeasureMode = (measure) => ({ ...measure, active: !measure.active });

export const exitMeasureMode = (measure) => (measure.active ? { ...measure, active: false } : measure);

export const getDistancePx = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export const getDistanceCm = (a, b) => getDistancePx(a, b) / CM_TO_PX;

export const formatDistance = (a, b, unit) => formatHeight(getDistanceCm(a, b), unit);

export const screenPointToCanvas = (client, rect, zoom) => ({
  x: (client.x - rect.left) / zoom,
  y: (client.y - rect.top) / zoom,
});

export const clampPointToCanvas = (point, canvasW, canvasH) => ({
  x: Math.max(0, Math.min(canvasW, point.x)),
  y: Math.max(0, Math.min(canvasH, point.y)),
});

export const isMeasurable = (a, b, zoom) => getDistancePx(a, b) * zoom >= MIN_MEASURE_SCREEN_PX;

export const addMeasure = (measure, start, end) => {
  const nextId = measure.items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  return { ...measure, items: [...measure.items, { id: nextId, start, end }] };
};

export const clearMeasures = (measure) =>
  (measure.items.length ? { ...measure, items: [] } : measure);

export const getMeasureEntries = (measure, unit) =>
  measure.items.map((item) => ({
    ...item,
    label: formatDistance(item.start, item.end, unit),
  }));