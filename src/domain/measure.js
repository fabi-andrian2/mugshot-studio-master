import { CM_TO_PX } from './constants.js';
import { formatHeight } from './measurement.js';
import { CANVAS_FONT_FAMILY } from './typography.js';

export const MIN_MEASURE_SCREEN_PX = 6;

export const MEASURE_STYLE = {
  color: '#f59e0b',
  outlineColor: '#0d0d0d',
  fontFamily: CANVAS_FONT_FAMILY,
  lineWidth: 2,
  endpointRadius: 4,
  fontSize: 13,
  haloWidth: 4,
  labelOffset: 10,
  selectionColor: '#34d399',
  selectionHaloWidth: 8,
  selectionRingRadius: 8,
  hitWidth: 14,
};

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

export const removeMeasures = (measure, ids) => {
  const toRemove = new Set(ids);
  if (toRemove.size === 0 || !measure.items.some((item) => toRemove.has(item.id))) return measure;
  return { ...measure, items: measure.items.filter((item) => !toRemove.has(item.id)) };
};

export const getMeasureEntries = (measure, unit) =>
  measure.items.map((item) => ({
    ...item,
    label: formatDistance(item.start, item.end, unit),
  }));

export const shiftMeasures = (measure, dy) => {
  if (!Number.isFinite(dy) || dy === 0 || measure.items.length === 0) return measure;
  return {
    ...measure,
    items: measure.items.map((item) => ({
      ...item,
      start: { x: item.start.x, y: item.start.y + dy },
      end: { x: item.end.x, y: item.end.y + dy },
    })),
  };
};

const isFinitePoint = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y);

export const getMeasureExportItems = (measure, unit) =>
  getMeasureEntries(measure, unit)
    .filter((entry) => isFinitePoint(entry.start) && isFinitePoint(entry.end))
    .map((entry) => ({
      id: entry.id,
      x1: entry.start.x,
      y1: entry.start.y,
      x2: entry.end.x,
      y2: entry.end.y,
      labelX: (entry.start.x + entry.end.x) / 2,
      labelY: (entry.start.y + entry.end.y) / 2 - MEASURE_STYLE.labelOffset,
      text: entry.label,
    }));