import { CM_TO_PX } from './constants.js';
import { formatHeight, inchesToCm } from './measurement.js';

// Géométrie des mesures de la planche (segment, polyligne, courbe de Bézier).
// Tout est exprimé en coordonnées document (px) : rien ici ne dépend du zoom.

export const MEASURE_KINDS = ['segment', 'polyline', 'bezier'];
export const MAX_MEASURE_NODES = 500;
export const MAX_TICKS = 500;

// Écart maximal toléré (px document) entre la courbe et sa version aplatie.
// Valeur choisie après mesure (voir tests/measurePath.test.js) : l'erreur de
// longueur reste inférieure à 0,02 mm pour des courbes de plusieurs mètres (coût mesuré : ~0,1 ms par courbe).
export const FLATNESS_TOLERANCE_PX = 0.01;
const MAX_FLATTEN_DEPTH = 14;
const MIN_FLATTEN_DEPTH = 2;

const isPoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const pt = (x, y) => ({ x, y });
const add = (a, b) => pt(a.x + b.x, a.y + b.y);
const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
const mid = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// ---------------------------------------------------------------- accessors

export const getMeasureKind = (item) =>
  item?.kind === 'polyline' || item?.kind === 'bezier' ? item.kind : 'segment';

export const getMeasureNodes = (item) => {
  const kind = getMeasureKind(item);
  if (kind === 'polyline') return item.points;
  if (kind === 'bezier') return item.nodes;
  return [item.start, item.end];
};

export const withMeasureNodes = (item, nodes) => {
  const kind = getMeasureKind(item);
  if (kind === 'polyline') return { ...item, points: nodes };
  if (kind === 'bezier') return { ...item, nodes };
  return { ...item, start: nodes[0], end: nodes[1] };
};

export const isMeasureEditableCount = (item) => getMeasureKind(item) !== 'segment';

// ------------------------------------------------------------------ bezier

// Poignées d'un nœud (offsets absolus déjà résolus).
const autoOut = (nodes, i) => {
  const prev = nodes[i - 1] ?? nodes[i];
  const next = nodes[i + 1] ?? nodes[i];
  return pt((next.x - prev.x) / 6, (next.y - prev.y) / 6);
};

export const getHandleOffsets = (nodes, i) => {
  const node = nodes[i];
  const auto = autoOut(nodes, i);
  return {
    out: node.hout ?? auto,
    in: node.hin ?? pt(-auto.x, -auto.y),
  };
};

export const hasManualHandles = (node) => Boolean(node?.hin || node?.hout);

const segmentControls = (nodes, i) => {
  const a = nodes[i];
  const b = nodes[i + 1];
  const ha = getHandleOffsets(nodes, i);
  const hb = getHandleOffsets(nodes, i + 1);
  return [pt(a.x, a.y), add(a, ha.out), add(b, hb.in), pt(b.x, b.y)];
};

const pointToChordDistance = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return dist(p, a);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
};

const flattenCubic = (c, tol, seg, t0, t1, depth, out) => {
  const [p0, p1, p2, p3] = c;
  const flat =
    depth >= MIN_FLATTEN_DEPTH &&
    Math.max(pointToChordDistance(p1, p0, p3), pointToChordDistance(p2, p0, p3)) * 0.75 <= tol;
  if (flat || depth >= MAX_FLATTEN_DEPTH) {
    out.push({ x: p3.x, y: p3.y, seg, t: t1 });
    return;
  }
  const p01 = mid(p0, p1);
  const p12 = mid(p1, p2);
  const p23 = mid(p2, p3);
  const p012 = mid(p01, p12);
  const p123 = mid(p12, p23);
  const m = mid(p012, p123);
  const tm = (t0 + t1) / 2;
  flattenCubic([p0, p01, p012, m], tol, seg, t0, tm, depth + 1, out);
  flattenCubic([m, p123, p23, p3], tol, seg, tm, t1, depth + 1, out);
};

export const splitCubic = (c, t) => {
  const [p0, p1, p2, p3] = c;
  const lerp = (a, b) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const p01 = lerp(p0, p1);
  const p12 = lerp(p1, p2);
  const p23 = lerp(p2, p3);
  const p012 = lerp(p01, p12);
  const p123 = lerp(p12, p23);
  const m = lerp(p012, p123);
  return [
    [p0, p01, p012, m],
    [m, p123, p23, p3],
  ];
};

// ------------------------------------------------------------------- paths

const pathCache = new WeakMap();

const buildPath = (item, tol) => {
  const kind = getMeasureKind(item);
  const nodes = getMeasureNodes(item);
  const points = [{ x: nodes[0].x, y: nodes[0].y, seg: 0, t: 0 }];
  if (kind === 'bezier') {
    for (let i = 0; i < nodes.length - 1; i += 1) {
      flattenCubic(segmentControls(nodes, i), tol, i, 0, 1, 0, points);
    }
  } else {
    for (let i = 1; i < nodes.length; i += 1) {
      points.push({ x: nodes[i].x, y: nodes[i].y, seg: i - 1, t: 1 });
    }
  }
  const cum = new Array(points.length);
  cum[0] = 0;
  for (let i = 1; i < points.length; i += 1) cum[i] = cum[i - 1] + dist(points[i - 1], points[i]);
  return { points, cum, lengthPx: cum[cum.length - 1] };
};

export const isMeasureGeometryValid = (item) => {
  if (!item || typeof item !== 'object') return false;
  const nodes = getMeasureKind(item) === 'segment'
    ? [item.start, item.end]
    : getMeasureNodes(item);
  if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > MAX_MEASURE_NODES) return false;
  return nodes.every((n) => isPoint(n) &&
    (n.hin === undefined || isPoint(n.hin)) && (n.hout === undefined || isPoint(n.hout)));
};

export const getMeasurePath = (item, tol = FLATNESS_TOLERANCE_PX) => {
  if (tol !== FLATNESS_TOLERANCE_PX) return buildPath(item, tol);
  let path = pathCache.get(item);
  if (!path) {
    path = buildPath(item, tol);
    pathCache.set(item, path);
  }
  return path;
};

export const getMeasureLengthPx = (item) => getMeasurePath(item).lengthPx;
export const getMeasureLengthCm = (item) => getMeasureLengthPx(item) / CM_TO_PX;
export const formatMeasureLength = (item, unit) => formatHeight(getMeasureLengthCm(item), unit);

// Point à la distance d'arc `s` (px) + tangente unitaire.
export const getPointAtLength = (path, s) => {
  const { points, cum, lengthPx } = path;
  const target = Math.max(0, Math.min(lengthPx, s));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= target) lo = m;
    else hi = m;
  }
  const a = points[lo];
  const b = points[hi];
  const span = cum[hi] - cum[lo];
  const f = span > 0 ? (target - cum[lo]) / span : 0;
  let tx = b.x - a.x;
  let ty = b.y - a.y;
  const len = Math.hypot(tx, ty);
  if (len > 0) {
    tx /= len;
    ty /= len;
  } else {
    tx = 1;
    ty = 0;
  }
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tx, ty };
};

// Position du libellé de longueur : milieu exact d'un segment à 2 points,
// sinon point au milieu de la longueur d'arc.
export const getLabelAnchor = (item, labelOffset) => {
  const nodes = getMeasureNodes(item);
  if (getMeasureKind(item) === 'segment' || (nodes.length === 2 && getMeasureKind(item) === 'polyline')) {
    return pt((nodes[0].x + nodes[1].x) / 2, (nodes[0].y + nodes[1].y) / 2 - labelOffset);
  }
  const path = getMeasurePath(item);
  const m = getPointAtLength(path, path.lengthPx / 2);
  return pt(m.x, m.y - labelOffset);
};

// ------------------------------------------------------------------- ticks

const NICE_CM = (() => {
  const out = [];
  for (let k = 0; k <= 5; k += 1) {
    const f = 10 ** k;
    out.push(f, 2 * f, 5 * f);
    if (k >= 1) out.push(2.5 * f);
  }
  return out.sort((a, b) => a - b);
})();

const NICE_INCHES = [1, 2, 3, 6, 12, 24, 36, 60, 120, 240, 600, 1200, 2400];

export const TICK_TARGET_COUNT = 8;
export const MIN_LABEL_GAP_PX = 52;

export const DEFAULT_TICKS = { enabled: false, step: null };

export const getTickSettings = (item) => {
  const t = item?.ticks;
  if (!t || typeof t !== 'object') return DEFAULT_TICKS;
  return {
    enabled: t.enabled === true,
    step: Number.isFinite(t.step) && t.step > 0 ? t.step : null,
  };
};

export const getAutoTickStepCm = (lengthCm, unit) => {
  if (!(lengthCm > 0)) return NICE_CM[0];
  const raw = lengthCm / TICK_TARGET_COUNT;
  if (unit === 'ft') {
    const steps = NICE_INCHES.map(inchesToCm);
    return steps.find((s) => s >= raw * 0.99) ?? steps[steps.length - 1];
  }
  return NICE_CM.find((s) => s >= raw) ?? NICE_CM[NICE_CM.length - 1];
};

export const getTickStepCm = (item, unit) => {
  const { step } = getTickSettings(item);
  const lengthCm = getMeasureLengthCm(item);
  let value = step ?? getAutoTickStepCm(lengthCm, unit);
  while (lengthCm / value > MAX_TICKS) value *= 2;
  return value;
};

// Graduations : positions par longueur d'arc cumulée (jamais par paramètre t).
// `nx, ny` = normale unitaire orientée vers le haut de la planche.
export const getMeasureTicks = (item, unit) => {
  const { enabled } = getTickSettings(item);
  if (!enabled || !isMeasureGeometryValid(item)) return { stepCm: null, stepPx: null, ticks: [] };
  const path = getMeasurePath(item);
  const stepCm = getTickStepCm(item, unit);
  const stepPx = stepCm * CM_TO_PX;
  const count = Math.floor(path.lengthPx / stepPx + 1e-9);
  const ticks = [];
  for (let k = 1; k <= count; k += 1) {
    const s = k * stepPx;
    if (path.lengthPx - s < 1e-6) break; // l'extrémité porte déjà sa marque
    const p = getPointAtLength(path, s);
    let nx = -p.ty;
    let ny = p.tx;
    if (ny > 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    ticks.push({
      index: k,
      x: p.x,
      y: p.y,
      nx,
      ny,
      distanceCm: k * stepCm,
      label: formatHeight(k * stepCm, unit),
    });
  }
  return { stepCm, stepPx, ticks };
};

// Placement du libellé d'une graduation (partagé par l'écran et l'export).
export const getTickLabelPlacement = (tick, offset) => {
  const x = tick.x + tick.nx * offset;
  const y = tick.y + tick.ny * offset;
  const align = tick.nx > 0.5 ? 'start' : tick.nx < -0.5 ? 'end' : 'middle';
  const baseline = tick.ny < -0.5 ? 'alphabetic' : 'middle';
  return { x, y, align, baseline };
};

// Densité des libellés : seule la densité s'adapte au zoom, jamais la géométrie.
export const getLabelStride = (stepPx, zoom, minGap = MIN_LABEL_GAP_PX) => {
  if (!(stepPx > 0) || !(zoom > 0)) return 1;
  return Math.max(1, Math.ceil(minGap / (stepPx * zoom)));
};

// ---------------------------------------------------------------- editing

const clampCount = (nodes) => nodes.length <= MAX_MEASURE_NODES;

export const movePoint = (item, index, point) => {
  const nodes = getMeasureNodes(item);
  if (!nodes[index]) return item;
  return withMeasureNodes(item, nodes.map((n, i) => (i === index ? { ...n, x: point.x, y: point.y } : n)));
};

export const translateMeasure = (item, dx, dy) => {
  if (!dx && !dy) return item;
  return withMeasureNodes(
    item,
    getMeasureNodes(item).map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
  );
};

export const appendPoint = (item, point) => {
  const nodes = getMeasureNodes(item);
  if (getMeasureKind(item) === 'segment' || !clampCount([...nodes, point])) return item;
  return withMeasureNodes(item, [...nodes, { x: point.x, y: point.y }]);
};

export const removePoint = (item, index) => {
  const nodes = getMeasureNodes(item);
  if (getMeasureKind(item) === 'segment' || nodes.length <= 2 || !nodes[index]) return item;
  return withMeasureNodes(item, nodes.filter((_, i) => i !== index));
};

export const removeLastPoint = (item) => removePoint(item, getMeasureNodes(item).length - 1);

// Insère un point sur la courbe/polyligne, en conservant exactement la forme.
export const insertPoint = (item, seg, t, point) => {
  const kind = getMeasureKind(item);
  const nodes = getMeasureNodes(item);
  if (kind === 'segment' || seg < 0 || seg >= nodes.length - 1 || nodes.length >= MAX_MEASURE_NODES) return item;
  if (kind === 'polyline') {
    const next = [...nodes];
    next.splice(seg + 1, 0, { x: point.x, y: point.y });
    return withMeasureNodes(item, next);
  }
  const [left, right] = splitCubic(segmentControls(nodes, seg), t);
  const s = left[3];
  const next = [...nodes];
  // Les poignées automatiques dépendent des voisins : on fige celles des deux
  // nœuds adjacents pour que le reste de la courbe ne bouge pas.
  const a = getHandleOffsets(nodes, seg);
  const b = getHandleOffsets(nodes, seg + 1);
  next[seg] = {
    ...nodes[seg],
    ...(seg > 0 && { hin: nodes[seg].hin ?? a.in }),
    hout: sub(left[1], left[0]),
  };
  next[seg + 1] = {
    ...nodes[seg + 1],
    hin: sub(right[2], right[3]),
    ...(seg + 1 < nodes.length - 1 && { hout: nodes[seg + 1].hout ?? b.out }),
  };
  next.splice(seg + 1, 0, {
    x: s.x,
    y: s.y,
    hin: sub(left[2], s),
    hout: sub(right[1], s),
  });
  return withMeasureNodes(item, next);
};

// Déplace une poignée (point absolu). Si le côté opposé est automatique, il
// reste lisse (symétrique) ; sinon il est conservé tel quel.
export const moveHandle = (item, index, which, point) => {
  if (getMeasureKind(item) !== 'bezier') return item;
  const nodes = item.nodes;
  const node = nodes[index];
  if (!node) return item;
  const offset = pt(point.x - node.x, point.y - node.y);
  const mirrored = pt(-offset.x, -offset.y);
  const next = { ...node };
  if (which === 'in') {
    next.hin = offset;
    if (!node.hout) next.hout = mirrored;
  } else {
    next.hout = offset;
    if (!node.hin) next.hin = mirrored;
  }
  return withMeasureNodes(item, nodes.map((n, i) => (i === index ? next : n)));
};

export const resetHandles = (item, index) => {
  if (getMeasureKind(item) !== 'bezier' || !hasManualHandles(item.nodes[index])) return item;
  return withMeasureNodes(
    item,
    item.nodes.map((n, i) => {
      if (i !== index) return n;
      const rest = { ...n };
      delete rest.hin;
      delete rest.hout;
      return rest;
    }),
  );
};

// Nœud + poignées en coordonnées absolues pour l'affichage/édition.
export const getHandlePositions = (item) => {
  if (getMeasureKind(item) !== 'bezier') return [];
  const nodes = item.nodes;
  return nodes.map((n, i) => {
    const h = getHandleOffsets(nodes, i);
    return {
      index: i,
      anchor: pt(n.x, n.y),
      hin: i > 0 ? add(n, h.in) : null,
      hout: i < nodes.length - 1 ? add(n, h.out) : null,
      manual: hasManualHandles(n),
    };
  });
};

// Point le plus proche de la trace (pour insérer un point) ; distance en px document.
export const getNearestOnPath = (item, point) => {
  const { points } = getMeasurePath(item);
  let best = null;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const f = len2 > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2)) : 0;
    const x = a.x + dx * f;
    const y = a.y + dy * f;
    const d = Math.hypot(point.x - x, point.y - y);
    if (!best || d < best.distance) {
      const segIndex = b.seg;
      const startT = a.seg === b.seg ? a.t : 0;
      best = { distance: d, x, y, seg: segIndex, t: startT + (b.t - startT) * f };
    }
  }
  return best;
};

// ---------------------------------------------------------------- equality

const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
};

export const areMeasureItemsEqual = (a, b) =>
  a === b || (a.length === b.length && a.every((item, i) => deepEqual(item, b[i])));
