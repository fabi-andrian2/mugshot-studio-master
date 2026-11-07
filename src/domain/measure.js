import { CM_TO_PX } from './constants.js';
import { formatHeight } from './measurement.js';
import { CANVAS_FONT_FAMILY } from './typography.js';
import {
  getMeasureKind,
  getMeasureNodes,
  getMeasurePath,
  getMeasureTicks,
  getLabelAnchor,
  formatMeasureLength,
  isMeasureGeometryValid,
  translateMeasure,
  getTickSettings,
  MAX_MEASURE_NODES,
} from './measurePath.js';

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
  tickHalfLength: 5,
  tickLineWidth: 1.5,
  tickFontSize: 11,
  tickLabelOffset: 9,
  handleRadius: 5,
  handleHitRadius: 11,
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

// Ajoute une mesure déjà construite (segment, polyligne ou courbe).
export const addMeasureItem = (measure, item) => {
  const nextId = measure.items.reduce((max, it) => Math.max(max, it.id), 0) + 1;
  return { ...measure, items: [...measure.items, { ...item, id: nextId }] };
};

export const createSegmentItem = (start, end, ticks) => ({
  start,
  end,
  ...(ticks && ticks.enabled ? { ticks: { enabled: true, step: ticks.step ?? null } } : null),
});

export const createPathItem = (kind, nodes, ticks) => {
  const clean = nodes.slice(0, MAX_MEASURE_NODES).map((n) => ({ x: n.x, y: n.y }));
  const base = kind === 'bezier' ? { kind, nodes: clean } : { kind: 'polyline', points: clean };
  return ticks && ticks.enabled ? { ...base, ticks: { enabled: true, step: ticks.step ?? null } } : base;
};

export const replaceMeasureItem = (measure, id, item) => {
  if (!measure.items.some((it) => it.id === id)) return measure;
  return { ...measure, items: measure.items.map((it) => (it.id === id ? { ...item, id } : it)) };
};

export const setMeasureTicks = (measure, ids, ticks) => {
  const targets = new Set(ids);
  let changed = false;
  const items = measure.items.map((item) => {
    if (!targets.has(item.id)) return item;
    const current = getTickSettings(item);
    const next = { enabled: ticks.enabled === true, step: ticks.step ?? null };
    if (current.enabled === next.enabled && current.step === next.step) return item;
    changed = true;
    return { ...item, ticks: next };
  });
  return changed ? { ...measure, items } : measure;
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
    kind: getMeasureKind(item),
    label: formatMeasureLength(item, unit),
    item,
  }));

export const shiftMeasures = (measure, dy) => {
  if (!Number.isFinite(dy) || dy === 0 || measure.items.length === 0) return measure;
  return {
    ...measure,
    items: measure.items.map((item) => translateMeasure(item, 0, dy)),
  };
};

export const getMeasureExportItems = (measure, unit) =>
  getMeasureEntries(measure, unit)
    .filter((entry) => isMeasureGeometryValid(entry.item))
    .map((entry) => {
      const nodes = getMeasureNodes(entry.item);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const label = getLabelAnchor(entry.item, MEASURE_STYLE.labelOffset);
      const { ticks, stepPx } = getMeasureTicks(entry.item, unit);
      return {
        id: entry.id,
        kind: entry.kind,
        x1: first.x,
        y1: first.y,
        x2: last.x,
        y2: last.y,
        labelX: label.x,
        labelY: label.y,
        text: entry.label,
        path: getMeasurePath(entry.item).points.map(({ x, y }) => ({ x, y })),
        anchors: nodes.map(({ x, y }) => ({ x, y })),
        ticks,
        tickStepPx: stepPx,
      };
    });
