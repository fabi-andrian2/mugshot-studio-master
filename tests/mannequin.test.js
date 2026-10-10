import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MANNEQUIN,
  DEFAULT_MANNEQUIN_HEIGHT_CM,
  MANNEQUIN_VIEWBOX,
  toggleMannequin,
  setMannequinHeight,
  setMannequinX,
  resolveMannequinX,
  getMannequinGeometry,
} from '../src/domain/mannequin.js';
import { CM_TO_PX, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from '../src/domain/constants.js';
import { getSubjectGeometry, getScaleForHeightCm } from '../src/domain/geometry.js';
import { getLayerEntries } from '../src/domain/subjects.js';
import { getCompositionRect } from '../src/domain/views.js';

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

const shown = (overrides = {}) => ({ ...DEFAULT_MANNEQUIN, visible: true, ...overrides });

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('mannequin : masqué par défaut, hauteur de référence 175 cm, position automatique', () => {
  assert.equal(DEFAULT_MANNEQUIN.visible, false);
  assert.equal(DEFAULT_MANNEQUIN.heightCm, DEFAULT_MANNEQUIN_HEIGHT_CM);
  assert.equal(DEFAULT_MANNEQUIN.heightCm, 175);
  assert.equal(DEFAULT_MANNEQUIN.x, null);
  assert.equal(getMannequinGeometry(DEFAULT_MANNEQUIN, { floorY: FLOOR_Y, unit: 'cm' }), null);
  assert.equal(toggleMannequin(DEFAULT_MANNEQUIN).visible, true);
});

test('mannequin : hauteur bornée, valeur invalide ignorée', () => {
  assert.equal(setMannequinHeight(DEFAULT_MANNEQUIN, 1).heightCm, MIN_HEIGHT_CM);
  assert.equal(setMannequinHeight(DEFAULT_MANNEQUIN, 99999).heightCm, MAX_HEIGHT_CM);
  assert.equal(setMannequinHeight(DEFAULT_MANNEQUIN, 182).heightCm, 182);
  assert.equal(setMannequinHeight(DEFAULT_MANNEQUIN, Number.NaN), DEFAULT_MANNEQUIN);
});

test('mannequin : les pieds reposent sur le sol et la hauteur suit CM_TO_PX', () => {
  const geometry = getMannequinGeometry(shown({ heightCm: 180 }), { floorY: FLOOR_Y, unit: 'cm' });
  close(geometry.bottom, FLOOR_Y);
  close(geometry.top + geometry.height, FLOOR_Y);
  close(geometry.height, 180 * CM_TO_PX);
  close(geometry.top, FLOOR_Y - 180 * CM_TO_PX);
  close(geometry.scale * MANNEQUIN_VIEWBOX.height, geometry.height);
});

test('mannequin : cohérent avec la mesure d\'un sujet de même hauteur', () => {
  const base = make('a');
  const subject = { ...base, scale: getScaleForHeightCm(base, 175) };
  const reference = getSubjectGeometry(subject, FLOOR_Y);
  const geometry = getMannequinGeometry(shown({ heightCm: 175 }), { floorY: FLOOR_Y, unit: 'cm' });
  close(reference.head.y, geometry.top);
  close(reference.anchor.y, geometry.bottom);
});

test('mannequin : conserve ses proportions quelle que soit la hauteur', () => {
  const ratio = MANNEQUIN_VIEWBOX.width / MANNEQUIN_VIEWBOX.height;
  [150, 175, 210].forEach((heightCm) => {
    const geometry = getMannequinGeometry(shown({ heightCm }), { floorY: FLOOR_Y, unit: 'cm' });
    close(geometry.width / geometry.height, ratio);
  });
});

test('mannequin : position automatique à gauche, position manuelle respectée, retour auto', () => {
  const auto = getMannequinGeometry(shown(), { floorY: FLOOR_Y, unit: 'cm' });
  assert.equal(auto.x, resolveMannequinX(shown()));
  assert.ok(auto.left > 0);

  const manual = setMannequinX(shown(), 900);
  assert.equal(getMannequinGeometry(manual, { floorY: FLOOR_Y, unit: 'cm' }).x, 900);
  assert.equal(setMannequinX(manual, null).x, null);
  assert.equal(setMannequinX(manual, Number.NaN), manual);
});

test('mannequin : l\'étiquette suit l\'unité sélectionnée', () => {
  const inCm = getMannequinGeometry(shown(), { floorY: FLOOR_Y, unit: 'cm' });
  const inFeet = getMannequinGeometry(shown(), { floorY: FLOOR_Y, unit: 'ft' });
  assert.ok(inCm.label.startsWith('ÉTALON'));
  assert.ok(inFeet.label.startsWith('ÉTALON'));
  assert.notEqual(inCm.label, inFeet.label);
});

test('mannequin : indépendant des sujets, calques et vues', () => {
  const list = [make('a'), make('b', { x: 1100, zIndex: 2 })];
  const snapshot = JSON.parse(JSON.stringify(list));
  const layersBefore = getLayerEntries(list);
  const compositionBefore = getCompositionRect(list, FLOOR_Y);

  let mannequin = toggleMannequin(DEFAULT_MANNEQUIN);
  mannequin = setMannequinHeight(mannequin, 190);
  mannequin = setMannequinX(mannequin, 300);
  getMannequinGeometry(mannequin, { floorY: FLOOR_Y, unit: 'cm' });

  assert.deepEqual(list, snapshot);
  assert.deepEqual(getLayerEntries(list), layersBefore);
  assert.deepEqual(getCompositionRect(list, FLOOR_Y), compositionBefore);
});