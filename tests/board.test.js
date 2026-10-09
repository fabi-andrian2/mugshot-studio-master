import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BOARD,
  DEFAULT_BACKGROUND_COLOR,
  BACKGROUND_PRESETS,
  isValidColor,
  setBackgroundColor,
  setBackgroundImage,
  toggleGrid,
  getCoverRect,
} from '../src/domain/board.js';
import { DEFAULT_ANNOTATIONS, getAnnotationItems } from '../src/domain/annotations.js';
import { getSubjectGeometry } from '../src/domain/geometry.js';

const FLOOR_Y = 1000;

const make = (id, overrides = {}) => ({
  id,
  url: `blob:${id}`,
  fileName: `${id}.png`,
  name: id,
  x: 500,
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

const IMAGE = { url: 'blob:bg', width: 1600, height: 900, fileName: 'fond.png' };

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('valeurs par défaut : fond gris clair, aucune image, grille visible', () => {
  assert.equal(DEFAULT_BOARD.background.color, DEFAULT_BACKGROUND_COLOR);
  assert.equal(DEFAULT_BOARD.background.color, '#f2f2f4');
  assert.equal(DEFAULT_BOARD.background.image, null);
  assert.equal(DEFAULT_BOARD.showGrid, true);
});

test('presets : couleurs valides et fond par défaut inclus', () => {
  assert.ok(BACKGROUND_PRESETS.every((preset) => isValidColor(preset.value)));
  assert.ok(BACKGROUND_PRESETS.some((preset) => preset.value === DEFAULT_BACKGROUND_COLOR));
});

test('couleur : validation du format hexadécimal', () => {
  assert.equal(isValidColor('#a1B2c3'), true);
  assert.equal(isValidColor('#fff'), false);
  assert.equal(isValidColor('red'), false);
  assert.equal(isValidColor(undefined), false);
});

test('fond uni : change la couleur, retire l\'image, sans muter l\'état précédent', () => {
  const withImage = setBackgroundImage(DEFAULT_BOARD, IMAGE);
  const next = setBackgroundColor(withImage, '#DBE7F0');
  assert.equal(next.background.color, '#dbe7f0');
  assert.equal(next.background.image, null);
  assert.equal(next.showGrid, true);
  assert.equal(withImage.background.image, IMAGE);
  assert.equal(DEFAULT_BOARD.background.color, '#f2f2f4');
});

test('fond uni : une couleur invalide ne change rien', () => {
  assert.equal(setBackgroundColor(DEFAULT_BOARD, 'nope'), DEFAULT_BOARD);
});

test('fond image : définir, retirer en gardant la couleur, rejeter les dimensions invalides', () => {
  const coloured = setBackgroundColor(DEFAULT_BOARD, '#ffffff');
  const withImage = setBackgroundImage(coloured, IMAGE);
  assert.equal(withImage.background.image, IMAGE);
  assert.equal(withImage.background.color, '#ffffff');

  const removed = setBackgroundImage(withImage, null);
  assert.equal(removed.background.image, null);
  assert.equal(removed.background.color, '#ffffff');

  assert.equal(setBackgroundImage(DEFAULT_BOARD, { url: 'x', width: 0, height: 10 }), DEFAULT_BOARD);
  assert.equal(setBackgroundImage(DEFAULT_BOARD, undefined), DEFAULT_BOARD);
});

test('grille : bascule sans muter', () => {
  const hidden = toggleGrid(DEFAULT_BOARD);
  assert.equal(hidden.showGrid, false);
  assert.equal(DEFAULT_BOARD.showGrid, true);
  assert.equal(toggleGrid(hidden).showGrid, true);
});

test('cadrage cover : image plus large, plus haute, même ratio, dimensions invalides', () => {
  assert.deepEqual(getCoverRect(2000, 1000, 1000, 1000), { left: -500, top: 0, width: 2000, height: 1000 });
  assert.deepEqual(getCoverRect(1000, 2000, 1000, 1000), { left: 0, top: -500, width: 1000, height: 2000 });
  assert.deepEqual(getCoverRect(500, 500, 1000, 1000), { left: 0, top: 0, width: 1000, height: 1000 });
  assert.deepEqual(getCoverRect(0, 0, 1000, 800), { left: 0, top: 0, width: 1000, height: 800 });
});

test('cadrage cover : conserve le ratio, couvre la planche, reste centré', () => {
  const canvasW = 2400;
  const canvasH = 1600;
  const rect = getCoverRect(IMAGE.width, IMAGE.height, canvasW, canvasH);
  close(rect.width / rect.height, IMAGE.width / IMAGE.height);
  assert.ok(rect.left <= 0.001);
  assert.ok(rect.top <= 0.001);
  assert.ok(rect.left + rect.width >= canvasW - 0.001);
  assert.ok(rect.top + rect.height >= canvasH - 0.001);
  close(rect.left + rect.width / 2, canvasW / 2);
  close(rect.top + rect.height / 2, canvasH / 2);
});

test('le fond et la grille n\'influencent pas la géométrie des sujets', () => {
  const subject = make('a');
  const snapshot = JSON.parse(JSON.stringify(subject));
  const before = getSubjectGeometry(subject, FLOOR_Y);

  let board = setBackgroundImage(DEFAULT_BOARD, IMAGE);
  board = setBackgroundColor(board, '#ffffff');
  board = toggleGrid(board);

  assert.deepEqual(subject, snapshot);
  assert.deepEqual(getSubjectGeometry(subject, FLOOR_Y), before);
  assert.equal(board.showGrid, false);
});

test('annotations : désactivées par défaut, aucune annotation produite', () => {
  assert.equal(DEFAULT_ANNOTATIONS.enabled, false);
  const items = getAnnotationItems({
    subjects: [make('a')],
    selectedId: 'a',
    annotations: DEFAULT_ANNOTATIONS,
    floorY: FLOOR_Y,
    unit: 'cm',
  });
  assert.equal(items.length, 0);
});

test('annotations : suivent l\'unité sélectionnée', () => {
  const args = {
    subjects: [make('a')],
    selectedId: 'a',
    annotations: { enabled: true, scope: 'selected' },
    floorY: FLOOR_Y,
  };
  const [inCm] = getAnnotationItems({ ...args, unit: 'cm' });
  const [inFeet] = getAnnotationItems({ ...args, unit: 'ft' });
  assert.notEqual(inCm.text, inFeet.text);
  assert.ok(inCm.text.startsWith('A'));
  assert.ok(inFeet.text.startsWith('A'));
});