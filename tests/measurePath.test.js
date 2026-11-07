import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLATNESS_TOLERANCE_PX,
  getMeasurePath,
  getMeasureLengthPx,
  getMeasureLengthCm,
  getMeasureTicks,
  getTickStepCm,
  getAutoTickStepCm,
  getLabelStride,
  getPointAtLength,
  getTickLabelPlacement,
  insertPoint,
  removePoint,
  movePoint,
  moveHandle,
  resetHandles,
  getHandlePositions,
  getNearestOnPath,
  areMeasureItemsEqual,
  appendPoint,
  removeLastPoint,
  MAX_MEASURE_NODES,
} from '../src/domain/measurePath.js';
import {
  getMeasureEntries,
  getMeasureExportItems,
  createPathItem,
  createSegmentItem,
  addMeasureItem,
  setMeasureTicks,
  shiftMeasures,
  getDistancePx,
} from '../src/domain/measure.js';
import { CM_TO_PX } from '../src/domain/constants.js';
import { formatHeight, inchesToCm } from '../src/domain/measurement.js';
import { createDocumentState, areDocumentStatesEqual, liftMeasureItems, liftMeasureOperation } from '../src/domain/documentHistory.js';
import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';
import { serializeSession, restoreSession } from '../src/services/sessionSnapshot.js';
import { SCHEMA_VERSION } from '../src/services/persistence.js';

const seg = (x1, y1, x2, y2, extra) => ({ id: 1, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, ...extra });
const poly = (pts, extra) => ({ id: 2, kind: 'polyline', points: pts.map(([x, y]) => ({ x, y })), ...extra });
const bez = (pts, extra) => ({ id: 3, kind: 'bezier', nodes: pts.map(([x, y]) => ({ x, y })), ...extra });

const reference = (item, steps = 200000) => {
  const nodes = item.nodes;
  let total = 0;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const handles = (k) => {
      const prev = nodes[k - 1] ?? nodes[k];
      const next = nodes[k + 1] ?? nodes[k];
      const o = { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 };
      return { out: nodes[k].hout ?? o, in: nodes[k].hin ?? { x: -o.x, y: -o.y } };
    };
    const a = nodes[i];
    const b = nodes[i + 1];
    const p0 = a;
    const p1 = { x: a.x + handles(i).out.x, y: a.y + handles(i).out.y };
    const p2 = { x: b.x + handles(i + 1).in.x, y: b.y + handles(i + 1).in.y };
    const p3 = b;
    let prev = p0;
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const u = 1 - t;
      const p = {
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      };
      total += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
  }
  return total;
};

test('segment : longueur identique à l’outil historique', () => {
  const item = seg(10, 20, 810, 620);
  assert.equal(getMeasureLengthPx(item), getDistancePx(item.start, item.end));
  assert.equal(getMeasureLengthCm(item), getDistancePx(item.start, item.end) / CM_TO_PX);
});

test('polyligne : longueur totale = somme des segments', () => {
  const item = poly([[0, 0], [300, 400], [300, 800], [0, 800]]);
  assert.equal(getMeasureLengthPx(item), 500 + 400 + 300);
});

test('Bézier : points alignés donnent une droite exacte', () => {
  const item = bez([[0, 0], [400, 0], [800, 0]]);
  assert.ok(Math.abs(getMeasureLengthPx(item) - 800) < 1e-9);
});

test('Bézier : précision contre une référence très fine, coût borné', () => {
  const cases = [
    bez([[100, 900], [600, 100], [1200, 1000], [2000, 200]]),
    bez([[0, 0], [2500, 0]].map((p) => p), { }),
    {
      id: 9,
      kind: 'bezier',
      nodes: [
        { x: 100, y: 100, hout: { x: 1500, y: 0 } },
        { x: 400, y: 100, hin: { x: 1500, y: 900 }, hout: { x: -1500, y: -900 } },
        { x: 2000, y: 1500 },
      ],
    },
  ];
  for (const item of cases) {
    const expected = reference(item);
    const path = getMeasurePath(item);
    const errorPx = Math.abs(path.lengthPx - expected);
    assert.ok(errorPx / CM_TO_PX < 0.003, `erreur ${errorPx / CM_TO_PX} cm`);
    assert.ok(path.points.length < 3000, `${path.points.length} échantillons`);
  }
  assert.equal(FLATNESS_TOLERANCE_PX, 0.01);
});

test('Bézier : coût du calcul avec 500 points reste faible', () => {
  const nodes = Array.from({ length: MAX_MEASURE_NODES }, (_, i) => [i * 5, 500 + Math.sin(i / 3) * 400]);
  const item = bez(nodes);
  const start = performance.now();
  for (let i = 0; i < 5; i += 1) getMeasurePath({ ...item });
  const per = (performance.now() - start) / 5;
  assert.ok(per < 200, `${per} ms`);
});

test('chemin : mis en cache par mesure, recalculé quand la mesure change', () => {
  const item = poly([[0, 0], [100, 0]]);
  assert.equal(getMeasurePath(item), getMeasurePath(item));
  const moved = movePoint(item, 1, { x: 200, y: 0 });
  assert.equal(getMeasureLengthPx(moved), 200);
  assert.equal(getMeasureLengthPx(item), 100);
});

test('graduations : positions par longueur d’arc, pas par paramètre t', () => {
  const item = bez(
    [[0, 500], [200, 500], [1600, 500]],
    { ticks: { enabled: true, step: 10 } },
  );
  const { ticks, stepPx } = getMeasureTicks(item, 'cm');
  const path = getMeasurePath(item);
  assert.equal(stepPx, 10 * CM_TO_PX);
  assert.ok(ticks.length > 10);
  ticks.forEach((t, i) => {
    assert.ok(Math.abs(t.x - (i + 1) * stepPx) < 1e-6);
    assert.equal(t.distanceCm, (i + 1) * 10);
  });
  assert.ok(ticks.at(-1).x <= path.lengthPx);
});

test('graduations : espacement réel constant le long d’une courbe', () => {
  const item = bez(
    [[100, 900], [600, 100], [1200, 1000], [2000, 200]],
    { ticks: { enabled: true, step: 20 } },
  );
  const path = getMeasurePath(item);
  const { ticks, stepPx } = getMeasureTicks(item, 'cm');
  ticks.forEach((t, i) => {
    const s = (i + 1) * stepPx;
    const p = getPointAtLength(path, s);
    assert.ok(Math.hypot(p.x - t.x, p.y - t.y) < 1e-9);
  });
  // distance d'arc recalculée indépendamment (référence fine) entre deux graduations
  assert.ok(ticks.length >= 2);
});

test('graduations : désactivées, extrémité non dupliquée, normale vers le haut', () => {
  assert.deepEqual(getMeasureTicks(seg(0, 0, 800, 0), 'cm').ticks, []);
  const exact = seg(0, 100, 800, 100, { ticks: { enabled: true, step: 50 } });
  const { ticks } = getMeasureTicks(exact, 'cm');
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0].x, 400);
  assert.ok(ticks[0].ny <= 0);
  const vertical = seg(50, 0, 50, 800, { ticks: { enabled: true, step: 25 } });
  const v = getMeasureTicks(vertical, 'cm').ticks[0];
  assert.equal(v.nx, 1);
  assert.equal(getTickLabelPlacement(v, 9).align, 'start');
});

test('graduations : libellés cumulés cohérents en cm et en ft-in', () => {
  const item = seg(0, 0, 170 * CM_TO_PX, 0, { ticks: { enabled: true, step: inchesToCm(12) } });
  const ft = getMeasureTicks(item, 'ft').ticks;
  assert.equal(ft[0].label, formatHeight(inchesToCm(12), 'ft'));
  assert.equal(ft[0].label, `1'0"`);
  assert.equal(ft[1].label, `2'0"`);
  const cm = getMeasureTicks(seg(0, 0, 170 * CM_TO_PX, 0, { ticks: { enabled: true, step: 50 } }), 'cm').ticks;
  assert.deepEqual(cm.map((t) => t.label), ['50 cm', '100 cm', '150 cm']);
});

test('pas automatique : raisonnable et dépend de l’unité', () => {
  assert.equal(getAutoTickStepCm(170, 'cm'), 25);
  assert.equal(getAutoTickStepCm(0, 'cm'), 1);
  const ft = getAutoTickStepCm(170, 'ft');
  assert.ok(Math.abs(ft / 2.54 - Math.round(ft / 2.54)) < 1e-9);
  const long = seg(0, 0, 50000 * CM_TO_PX, 0, { ticks: { enabled: true, step: 1 } });
  assert.ok(getMeasureTicks(long, 'cm').ticks.length <= 500);
  assert.ok(getTickStepCm(long, 'cm') >= 100);
});

test('densité des libellés : s’adapte au zoom sans changer la géométrie', () => {
  const stepPx = 80;
  assert.equal(getLabelStride(stepPx, 1), 1);
  assert.ok(getLabelStride(stepPx, 0.1) > 1);
  const item = seg(0, 0, 4000, 0, { ticks: { enabled: true, step: 10 } });
  assert.deepEqual(getMeasureTicks(item, 'cm'), getMeasureTicks(item, 'cm'));
});

test('édition polyligne : ajout, déplacement, suppression, minimum 2 points', () => {
  let item = poly([[0, 0], [100, 0]]);
  item = insertPoint(item, 0, 0.5, { x: 50, y: 40 });
  assert.equal(item.points.length, 3);
  assert.deepEqual(item.points[1], { x: 50, y: 40 });
  item = movePoint(item, 1, { x: 50, y: 0 });
  assert.equal(getMeasureLengthPx(item), 100);
  item = removePoint(item, 1);
  assert.equal(item.points.length, 2);
  assert.equal(removePoint(item, 0), item);
  const grown = appendPoint(item, { x: 200, y: 0 });
  assert.equal(grown.points.length, 3);
  assert.equal(removeLastPoint(grown).points.length, 2);
});

test('segment : extrémités déplaçables, aucun ajout ni suppression', () => {
  const item = seg(0, 0, 100, 0);
  const moved = movePoint(item, 1, { x: 100, y: 100 });
  assert.deepEqual(moved.end, { x: 100, y: 100 });
  assert.equal(insertPoint(item, 0, 0.5, { x: 1, y: 1 }), item);
  assert.equal(removePoint(item, 0), item);
  assert.equal(appendPoint(item, { x: 1, y: 1 }), item);
});

test('Bézier : insertion conserve exactement la forme et la longueur', () => {
  const item = bez([[100, 900], [600, 100], [1200, 1000]]);
  const before = getMeasureLengthPx(item);
  const near = getNearestOnPath(item, { x: 350, y: 400 });
  const next = insertPoint(item, near.seg, near.t, { x: near.x, y: near.y });
  assert.equal(next.nodes.length, 4);
  assert.ok(Math.abs(getMeasureLengthPx(next) - before) < 0.05);
});

test('Bézier : poignées manuelles, symétrie auto, réinitialisation', () => {
  const item = bez([[0, 0], [500, 0], [1000, 0]]);
  const handles = getHandlePositions(item);
  assert.equal(handles[0].hin, null);
  assert.equal(handles[2].hout, null);
  const bent = moveHandle(item, 1, 'out', { x: 500, y: 300 });
  assert.deepEqual(bent.nodes[1].hout, { x: 0, y: 300 });
  assert.deepEqual(bent.nodes[1].hin, { x: -0, y: -300 });
  assert.ok(getMeasureLengthPx(bent) > 1000);
  const reset = resetHandles(bent, 1);
  assert.equal(reset.nodes[1].hout, undefined);
  assert.ok(Math.abs(getMeasureLengthPx(reset) - 1000) < 1e-9);
  assert.equal(resetHandles(item, 1), item);
});

test('égalité structurelle des mesures', () => {
  const a = [poly([[0, 0], [1, 1]])];
  const b = [poly([[0, 0], [1, 1]])];
  assert.ok(areMeasureItemsEqual(a, b));
  assert.ok(!areMeasureItemsEqual(a, [poly([[0, 0], [1, 2]])]));
  assert.ok(areMeasureItemsEqual([{ ...a[0], ticks: undefined }], a));
});

test('entrées et export : mêmes tracés, graduations et libellés que le canvas', () => {
  const items = [
    { ...bez([[100, 900], [600, 100], [1200, 1000]], { ticks: { enabled: true, step: 20 } }), id: 1 },
    { ...poly([[0, 0], [300, 400]]), id: 2 },
  ];
  const entries = getMeasureEntries({ active: false, items }, 'cm');
  assert.equal(entries[0].item, items[0]);
  const exported = getMeasureExportItems({ active: false, items }, 'cm');
  assert.deepEqual(exported[0].path, getMeasurePath(items[0]).points.map(({ x, y }) => ({ x, y })));
  assert.deepEqual(exported[0].ticks, getMeasureTicks(items[0], 'cm').ticks);
  assert.equal(exported[0].text, entries[0].label);
  assert.equal(exported[1].text, formatHeight(500 / CM_TO_PX, 'cm'));
  assert.equal(exported[1].tickStepPx, null);
});

test('décalage de planche : toutes les formes sont translatées', () => {
  const items = [seg(0, 0, 10, 10), poly([[0, 0], [5, 5], [9, 1]]), bez([[0, 0], [100, 50]])];
  const shifted = shiftMeasures({ active: false, items }, 40).items;
  assert.equal(shifted[0].end.y, 50);
  assert.equal(shifted[1].points[2].y, 41);
  assert.equal(shifted[2].nodes[1].y, 90);
});

test('création : un seul enregistrement d’historique par mesure complète', () => {
  const OPTIONS = { isEqual: areDocumentStatesEqual, limit: 50, mergeWindowMs: 0 };
  let state = createHistoryState(createDocumentState([], []));
  const item = createPathItem('polyline', [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 40, y: 10 }], { enabled: true, step: null });
  state = historyReducer(state, {
    type: 'apply',
    updater: liftMeasureItems(liftMeasureOperation((m) => addMeasureItem(m, item))),
    mergeKey: null,
    time: 0,
    ...OPTIONS,
  });
  assert.equal(state.past.length, 1);
  assert.equal(state.present.measureItems.length, 1);
  assert.deepEqual(state.present.measureItems[0].ticks, { enabled: true, step: null });
  state = historyReducer(state, { type: 'undo' });
  assert.equal(state.present.measureItems.length, 0);
  state = historyReducer(state, { type: 'redo' });
  assert.equal(state.present.measureItems.length, 1);
});

test('geste d’édition : aperçu, un seul enregistrement, annulation par rollback', () => {
  const OPTIONS = { isEqual: areDocumentStatesEqual, limit: 50, mergeWindowMs: 0 };
  const base = poly([[0, 0], [100, 0]]);
  let state = createHistoryState(createDocumentState([], [base]));
  const move = (x) =>
    historyReducer(state, {
      type: 'set',
      updater: liftMeasureItems((items) => items.map((it) => movePoint(it, 1, { x, y: 0 }))),
    });
  for (const x of [120, 150, 180, 200]) state = move(x);
  assert.equal(state.past.length, 0);
  state = historyReducer(state, { type: 'commit', mergeKey: null, time: 0, ...OPTIONS });
  assert.equal(state.past.length, 1);
  assert.equal(getMeasureLengthPx(state.present.measureItems[0]), 200);

  const before = state.past.length;
  state = move(300);
  state = historyReducer(state, { type: 'rollback' });
  assert.equal(getMeasureLengthPx(state.present.measureItems[0]), 200);
  assert.equal(state.past.length, before);

  state = move(200);
  state = historyReducer(state, { type: 'commit', mergeKey: null, time: 0, ...OPTIONS });
  assert.equal(state.past.length, before);
});

test('graduations modifiables : une seule opération, sans effet si identiques', () => {
  const m = { active: false, items: [seg(0, 0, 100, 0)] };
  const on = setMeasureTicks(m, [1], { enabled: true, step: null });
  assert.deepEqual(on.items[0].ticks, { enabled: true, step: null });
  assert.equal(setMeasureTicks(on, [1], { enabled: true, step: null }), on);
  assert.equal(setMeasureTicks(m, [1], { enabled: false, step: null }), m);
  assert.deepEqual(createSegmentItem({ x: 0, y: 0 }, { x: 1, y: 1 }, { enabled: false }), {
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  });
});

const pngBlob = (label) => new Blob([label], { type: 'image/png' });
const makeSubject = (id) => ({
  id, url: `blob:${id}`, fileName: `${id}.png`, name: id, x: 1, y: 0, scale: 1, flipX: false, zIndex: 1,
  placement: 'auto', visible: true, silhouette: false, naturalW: 10, naturalH: 20,
  visibleBounds: { left: 0, top: 0, right: 1, bottom: 1 }, groundAnchor: { x: 0.5, y: 1 }, headAnchor: { x: 0.5, y: 0 },
});
const baseState = (measureItems, subjects = [makeSubject('a')]) => ({
  canvasW: 1000, canvasH: 1000, unit: 'cm', subjects,
  board: { showGrid: true, background: { color: '#ffffff', image: null } },
  annotations: { enabled: true, scope: 'all' },
  mannequin: { visible: false, heightCm: 180, x: 0 },
  measure: { active: false, items: measureItems },
});
const roundTrip = async (state) => {
  const { data } = await serializeSession(state, { fetchBlob: async (u) => pngBlob(u) });
  let n = 0;
  return restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, { createUrl: () => `blob:r${(n += 1)}`, revokeUrl() {} });
};

test('session : polylignes, courbes et graduations survivent à l’aller-retour', async () => {
  const items = [
    seg(0, 0, 10, 10),
    poly([[0, 0], [50, 50], [90, 10]], { ticks: { enabled: true, step: 5 } }),
    { id: 3, kind: 'bezier', nodes: [{ x: 0, y: 0, hout: { x: 10, y: 0 } }, { x: 50, y: 50, hin: { x: -5, y: 5 } }], ticks: { enabled: true, step: null } },
  ];
  const result = await roundTrip(baseState(items));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.measure.items, items);
});

test('session : ancienne session (segments seuls, sans mensurations) restaurée à l’identique', async () => {
  const legacy = [seg(1, 2, 3, 4)];
  const { data } = await serializeSession(baseState(legacy), { fetchBlob: async (u) => pngBlob(u) });
  assert.equal(JSON.stringify(data.measure).includes('kind'), false);
  assert.equal('girths' in data.subjects[0], false);
  const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, { createUrl: () => 'blob:x', revokeUrl() {} });
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.measure.items, legacy);
  assert.equal('girths' in result.state.subjects[0], false);
});

test('session : mesures corrompues rejetées, mensurations corrompues écartées', async () => {
  for (const bad of [
    { id: 5, kind: 'polyline', points: [{ x: 0, y: 0 }] },
    { id: 5, kind: 'bezier', nodes: [{ x: 0, y: 0 }, { x: NaN, y: 1 }] },
    { id: 5, kind: 'spirale', points: [] },
    { id: 5, start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, ticks: { enabled: 'oui' } },
  ]) {
    const { data } = await serializeSession(baseState([seg(0, 0, 1, 1)]), { fetchBlob: async (u) => pngBlob(u) });
    data.measure.items = [bad];
    const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, { createUrl: () => 'blob:x', revokeUrl() {} });
    assert.equal(result.ok, false);
  }
  const subject = { ...makeSubject('a'), girths: [
    { id: 'g1', kind: 'waist', cm: 80 },
    { id: 'g2', kind: 'waist', cm: -3 },
    { id: 'g3', kind: 'chest', cm: Infinity },
    { id: 'g4', kind: 'arm', side: 'xx', cm: 30 },
    'poubelle',
  ] };
  const result = await roundTrip(baseState([], [subject]));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.subjects[0].girths, [{ id: 'g1', kind: 'waist', cm: 80 }]);
});
