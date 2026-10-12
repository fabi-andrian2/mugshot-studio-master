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
  getMeasureExportItems,
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

test('export des mesures : horizontale, coordonnées et libellé centrés', () => {
  const measure = {
    active: true,
    items: [{ id: 1, start: { x: 10, y: 20 }, end: { x: 810, y: 20 } }],
  };

  const [item] = getMeasureExportItems(measure, 'cm');

  assert.deepEqual(item, {
    id: 1,
    x1: 10,
    y1: 20,
    x2: 810,
    y2: 20,
    labelX: 410,
    labelY: 10,
    text: formatHeight(100, 'cm'),
  });
});

test('export des mesures : verticale', () => {
  const measure = {
    active: false,
    items: [{ id: 2, start: { x: 5, y: 10 }, end: { x: 5, y: 330 } }],
  };

  const [item] = getMeasureExportItems(measure, 'cm');

  assert.equal(item.x1, 5);
  assert.equal(item.y1, 10);
  assert.equal(item.x2, 5);
  assert.equal(item.y2, 330);
  assert.equal(item.labelX, 5);
  assert.equal(item.labelY, (10 + 330) / 2 - 10);
  assert.equal(item.text, formatHeight(40, 'cm'));
});

test('export des mesures : diagonale conserve la distance réelle du document', () => {
  const measure = {
    active: false,
    items: [{ id: 3, start: { x: 0, y: 0 }, end: { x: 300, y: 400 } }],
  };

  const [item] = getMeasureExportItems(measure, 'cm');

  assert.equal(getDistanceCm(
    { x: item.x1, y: item.y1 },
    { x: item.x2, y: item.y2 },
  ), 62.5);

  assert.equal(item.labelX, 150);
  assert.equal(item.labelY, 190);
  assert.equal(item.text, formatHeight(62.5, 'cm'));
});

test('export des mesures : l’unité change le libellé, pas les coordonnées', () => {
  const measure = {
    active: true,
    items: [{ id: 4, start: { x: 10, y: 50 }, end: { x: 1410, y: 50 } }],
  };

  const [cm] = getMeasureExportItems(measure, 'cm');
  const [ft] = getMeasureExportItems(measure, 'ft');

  assert.notEqual(cm.text, ft.text);
  assert.equal(cm.text, formatHeight(175, 'cm'));
  assert.equal(ft.text, formatHeight(175, 'ft'));

  for (const key of ['id', 'x1', 'y1', 'x2', 'y2', 'labelX', 'labelY']) {
    assert.equal(cm[key], ft[key]);
  }
});

test('export des mesures : plusieurs mesures conservent leurs identifiants et leur ordre', () => {
  const measure = {
    active: false,
    items: [
      { id: 8, start: { x: 0, y: 0 }, end: { x: 800, y: 0 } },
      { id: 3, start: { x: 10, y: 20 }, end: { x: 10, y: 340 } },
    ],
  };

  const items = getMeasureExportItems(measure, 'cm');

  assert.deepEqual(items.map((item) => item.id), [8, 3]);
  assert.equal(items.length, 2);
});

test('export des mesures : liste vide et points non finis sont ignorés', () => {
  assert.deepEqual(getMeasureExportItems({ active: false, items: [] }, 'cm'), []);

  const measure = {
    active: false,
    items: [
      { id: 1, start: { x: 0, y: 0 }, end: { x: 800, y: 0 } },
      { id: 2, start: { x: Number.NaN, y: 10 }, end: { x: 20, y: 10 } },
    ],
  };

  const items = getMeasureExportItems(measure, 'cm');

  assert.equal(items.length, 1);
  assert.equal(items[0].id, 1);
});

test('export des mesures : la source n’est pas modifiée', () => {
  const measure = deepFreeze({
    active: false,
    items: [
      { id: 1, start: { x: 20, y: 30 }, end: { x: 820, y: 30 } },
    ],
  });

  const snapshot = JSON.parse(JSON.stringify(measure));
  const items = getMeasureExportItems(measure, 'cm');

  assert.deepEqual(measure, snapshot);
  assert.notStrictEqual(items, measure.items);
  assert.equal(items[0].x1, 20);

  items[0].x1 = 999;
  assert.equal(measure.items[0].start.x, 20);
});