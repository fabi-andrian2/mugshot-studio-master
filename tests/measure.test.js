import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MEASURE,
  MIN_MEASURE_SCREEN_PX,
  toggleMeasureMode,
  exitMeasureMode,
  getDistancePx,
  getDistanceCm,
  formatDistance,
  screenPointToCanvas,
  clampPointToCanvas,
  isMeasurable,
  addMeasure,
  clearMeasures,
  getMeasureEntries,
} from '../src/domain/measure.js';
import { CM_TO_PX } from '../src/domain/constants.js';
import { formatHeight } from '../src/domain/measurement.js';
import { getLayerEntries } from '../src/domain/subjects.js';
import { getSubjectGeometry, getSubjectHeightCm } from '../src/domain/geometry.js';

const FLOOR_Y = 1800;

const make = (id, overrides = {}) => ({
  id,
  url: `blob:${id}`,
  fileName: `${id}.png`,
  name: id,
  x: 700,
  y: 0,
  scale: 1.8,
  flipX: false,
  zIndex: 1,
  placement: 'auto',
  visible: true,
  silhouette: false,
  naturalW: 500,
  naturalH: 1000,
  visibleBounds: { left: 0.1, top: 0.05, right: 0.9, bottom: 0.95 },
  groundAnchor: { x: 0.5, y: 0.9 },
  headAnchor: { x: 0.5, y: 0.1 },
  ...overrides,
});

const deepFreeze = (value) => {
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') deepFreeze(child);
  });
  return Object.freeze(value);
};

const close = (a, b, eps = 0.001) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('mesure : distance horizontale convertie en cm via CM_TO_PX', () => {
  const a = { x: 100, y: 300 };
  const b = { x: 100 + 10 * CM_TO_PX * 10, y: 300 };
  close(getDistancePx(a, b), 800);
  close(getDistanceCm(a, b), 100);
  assert.equal(getDistancePx(b, a), getDistancePx(a, b));
});

test('mesure : distance verticale', () => {
  const a = { x: 50, y: 100 };
  const b = { x: 50, y: 420 };
  close(getDistancePx(a, b), 320);
  close(getDistanceCm(a, b), 40);
});

test('mesure : diagonale 3-4-5', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 300, y: 400 };
  close(getDistancePx(a, b), 500);
  close(getDistanceCm(a, b), 62.5);
});

test('mesure : la distance ne dépend ni du zoom ni du panoramique', () => {
  const p1 = { x: 100, y: 50 };
  const p2 = { x: 400, y: 450 };
  const expected = getDistancePx(p1, p2);

  [0.1, 0.38, 1, 1.5].forEach((zoom, i) => {
    const rect = { left: 37 * (i + 1), top: -120 * (i + 1) };
    const toClient = (p) => ({ x: rect.left + p.x * zoom, y: rect.top + p.y * zoom });
    const a = screenPointToCanvas(toClient(p1), rect, zoom);
    const b = screenPointToCanvas(toClient(p2), rect, zoom);
    close(a.x, p1.x);
    close(a.y, p1.y);
    close(getDistancePx(a, b), expected);
  });
});

test('mesure : étiquette CM / FT-IN cohérente et recalculée au changement d\'unité', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 1400, y: 0 };
  assert.equal(formatDistance(a, b, 'cm'), formatHeight(175, 'cm'));
  assert.equal(formatDistance(a, b, 'ft'), formatHeight(175, 'ft'));
  assert.notEqual(formatDistance(a, b, 'cm'), formatDistance(a, b, 'ft'));

  const measure = addMeasure(DEFAULT_MEASURE, a, b);
  const inCm = getMeasureEntries(measure, 'cm');
  const inFeet = getMeasureEntries(measure, 'ft');
  assert.equal(inCm[0].id, inFeet[0].id);
  assert.equal(inCm[0].label, formatHeight(175, 'cm'));
  assert.equal(inFeet[0].label, formatHeight(175, 'ft'));
});

test('mesure : ajout de plusieurs mesures puis effacement, mode conservé', () => {
  let measure = toggleMeasureMode(DEFAULT_MEASURE);
  measure = addMeasure(measure, { x: 0, y: 0 }, { x: 80, y: 0 });
  measure = addMeasure(measure, { x: 0, y: 10 }, { x: 0, y: 90 });
  assert.deepEqual(measure.items.map((item) => item.id), [1, 2]);
  assert.equal(measure.active, true);

  const cleared = clearMeasures(measure);
  assert.deepEqual(cleared.items, []);
  assert.equal(cleared.active, true);
  assert.equal(clearMeasures(cleared), cleared);

  const next = addMeasure(cleared, { x: 5, y: 5 }, { x: 85, y: 5 });
  assert.equal(next.items.length, 1);
  assert.equal(measure.items.length, 2);
});

test('mesure : quitter le mode (Échap) conserve les mesures', () => {
  let measure = toggleMeasureMode(DEFAULT_MEASURE);
  measure = addMeasure(measure, { x: 0, y: 0 }, { x: 160, y: 0 });
  const exited = exitMeasureMode(measure);
  assert.equal(exited.active, false);
  assert.equal(exited.items.length, 1);
  assert.equal(exitMeasureMode(exited), exited);
  assert.equal(toggleMeasureMode(exited).active, true);
});

test('mesure : les points sont bornés à la planche', () => {
  assert.deepEqual(clampPointToCanvas({ x: -50, y: 9999 }, 1000, 500), { x: 0, y: 500 });
  assert.deepEqual(clampPointToCanvas({ x: 400, y: 200 }, 1000, 500), { x: 400, y: 200 });
});

test('mesure : un simple clic ou un micro-glissé n\'ajoute pas de mesure, à tout zoom', () => {
  const a = { x: 100, y: 100 };
  [0.1, 0.38, 1, 1.5].forEach((zoom) => {
    assert.equal(isMeasurable(a, a, zoom), false);
    assert.equal(isMeasurable(a, { x: 100 + 2 / zoom, y: 100 }, zoom), false);
    assert.equal(isMeasurable(a, { x: 100 + (MIN_MEASURE_SCREEN_PX + 1) / zoom, y: 100 }, zoom), true);
  });
});

test('mesure : aucune mesure ne touche aux sujets', () => {
  const list = deepFreeze([make('a'), make('b', { x: 1100, zIndex: 2 })]);
  const snapshot = JSON.parse(JSON.stringify(list));
  const layersBefore = getLayerEntries(list);
  const heightBefore = list.map(getSubjectHeightCm);
  const geometryBefore = list.map((s) => getSubjectGeometry(s, FLOOR_Y));

  let measure = toggleMeasureMode(DEFAULT_MEASURE);
  measure = addMeasure(measure, { x: 100, y: 100 }, { x: 900, y: 700 });
  getMeasureEntries(measure, 'ft');
  measure = clearMeasures(exitMeasureMode(measure));

  assert.deepEqual(list, snapshot);
  assert.deepEqual(getLayerEntries(list), layersBefore);
  assert.deepEqual(list.map(getSubjectHeightCm), heightBefore);
  assert.deepEqual(list.map((s) => getSubjectGeometry(s, FLOOR_Y)), geometryBefore);
  assert.deepEqual(Object.keys(measure).sort(), ['active', 'items']);
});