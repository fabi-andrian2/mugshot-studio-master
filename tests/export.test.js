import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_EXPORT_SIDE,
  MAX_EXPORT_AREA,
  EXPORT_LAYER_KINDS,
  getExportSize,
  getExportLayers,
} from '../src/domain/exportPlan.js';
import { DEFAULT_BACKGROUND } from '../src/domain/board.js';
import { DEFAULT_W, DEFAULT_H } from '../src/domain/constants.js';

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

const kinds = (layers) => layers.map((layer) => layer.kind);

test('export : la taille de sortie est exactement celle de la planche', () => {
  [[DEFAULT_W, DEFAULT_H], [1920, 1080], [3000, 2000], [800, 600], [2400, 3600]].forEach(([w, h]) => {
    assert.deepEqual(getExportSize(w, h), { width: w, height: h });
  });
  assert.deepEqual(getExportSize(2400.4, 1600.2), { width: 2400, height: 1600 });
});

test('export : dimensions invalides refusées avec une erreur explicite', () => {
  [[0, 100], [100, 0], [-5, 100], [Number.NaN, 100], [100, Infinity], [undefined, 100]].forEach(([w, h]) => {
    assert.throws(() => getExportSize(w, h), /invalides/);
  });
});

test('export : limites du navigateur, côté et surface', () => {
  assert.deepEqual(getExportSize(MAX_EXPORT_SIDE, MAX_EXPORT_AREA / MAX_EXPORT_SIDE), {
    width: MAX_EXPORT_SIDE,
    height: MAX_EXPORT_AREA / MAX_EXPORT_SIDE,
  });
  assert.throws(() => getExportSize(MAX_EXPORT_SIDE + 1, 100), /taille maximale/);
  assert.throws(() => getExportSize(100, MAX_EXPORT_SIDE + 1), /taille maximale/);
  assert.throws(() => getExportSize(16000, 16800), /taille maximale/);
});

test('export : ordre des couches fond, grille, mannequin, sujets par zIndex, annotations', () => {
  const layers = getExportLayers({
    subjects: [make('a', { zIndex: 3 }), make('b', { zIndex: 1 }), make('c', { zIndex: 2 })],
    mannequin: { left: 10, top: 20 },
    annotations: [{ text: '175 cm' }],
    background: DEFAULT_BACKGROUND,
  });

  assert.deepEqual(kinds(layers), [
    'background', 'grid', 'mannequin', 'subject', 'subject', 'subject', 'annotations',
  ]);
  assert.deepEqual(
    layers.filter((layer) => layer.kind === 'subject').map((layer) => layer.subject.id),
    ['b', 'c', 'a'],
  );
  assert.equal(layers[0].background, DEFAULT_BACKGROUND);
});

test('export : les sujets masqués sont exclus et les données source ne sont pas modifiées', () => {
  const subjects = deepFreeze([
    make('a', { zIndex: 2 }),
    make('b', { zIndex: 1, visible: false }),
    make('c', { zIndex: 3, silhouette: true }),
  ]);
  const snapshot = JSON.parse(JSON.stringify(subjects));

  const layers = getExportLayers({ subjects, annotations: [], background: DEFAULT_BACKGROUND });

  assert.deepEqual(
    layers.filter((layer) => layer.kind === 'subject').map((layer) => layer.subject.id),
    ['a', 'c'],
  );
  assert.deepEqual(subjects, snapshot);
});

test('export : mannequin et annotations présents seulement s\'ils sont fournis', () => {
  const base = { subjects: [make('a')], background: DEFAULT_BACKGROUND };

  assert.deepEqual(kinds(getExportLayers({ ...base, mannequin: null, annotations: [] })), [
    'background', 'grid', 'subject',
  ]);

  const items = [{ text: 'A · 175 cm' }];
  const layers = getExportLayers({ ...base, mannequin: { left: 1 }, annotations: items });
  assert.equal(layers.find((layer) => layer.kind === 'annotations').items, items);
  assert.equal(layers.find((layer) => layer.kind === 'mannequin').geometry.left, 1);
});

test('export : une composition vide produit seulement le fond et la grille', () => {
  assert.deepEqual(
    kinds(getExportLayers({ subjects: [], background: DEFAULT_BACKGROUND })),
    ['background', 'grid'],
  );
});

test('export : les mesures sont placées après les sujets et avant les annotations', () => {
  const measures = [
    {
      id: 1,
      x1: 100,
      y1: 200,
      x2: 900,
      y2: 200,
      labelX: 500,
      labelY: 190,
      text: '100 cm',
    },
  ];

  const layers = getExportLayers({
    subjects: [make('a')],
    measures,
    annotations: [{ text: '175 cm' }],
    background: DEFAULT_BACKGROUND,
  });

  assert.deepEqual(kinds(layers), [
    'background',
    'grid',
    'subject',
    'measures',
    'annotations',
  ]);

  assert.strictEqual(
    layers.find((layer) => layer.kind === 'measures').items,
    measures,
  );
});

test('export : aucune couche de mesures sans mesure, aucune mutation des sources', () => {
  const subjects = deepFreeze([make('a')]);
  const measures = deepFreeze([]);
  const annotations = deepFreeze([{ text: '175 cm' }]);

  const layers = getExportLayers({
    subjects,
    measures,
    annotations,
    background: DEFAULT_BACKGROUND,
  });

  assert.ok(!kinds(layers).includes('measures'));
  assert.ok(kinds(layers).every((kind) => EXPORT_LAYER_KINDS.includes(kind)));
  assert.deepEqual(subjects, [make('a')]);
  assert.deepEqual(measures, []);
  assert.deepEqual(annotations, [{ text: '175 cm' }]);
});

test('export : seules les couches du document sont exportées, jamais les états temporaires de l’interface', () => {
  const measures = [
    {
      id: 1,
      x1: 0,
      y1: 0,
      x2: 800,
      y2: 0,
      labelX: 400,
      labelY: -10,
      text: '100 cm',
    },
  ];

  const layers = getExportLayers({
    subjects: [make('a')],
    measures,
    annotations: [],
    background: DEFAULT_BACKGROUND,

    // Ces paramètres d'interface ne doivent pas créer de couches exportées.
    measureDraft: { start: { x: 0, y: 0 }, end: { x: 50, y: 50 } },
    measureActive: true,
    selectedId: 'a',
    zoom: 0.38,
  });

  assert.ok(layers.every((layer) => EXPORT_LAYER_KINDS.includes(layer.kind)));
  assert.ok(!kinds(layers).includes('measureDraft'));
  assert.ok(!layers.some((layer) => 'selected' in layer));

  assert.deepEqual(
    layers.find((layer) => layer.kind === 'measures').items,
    measures,
  );
});