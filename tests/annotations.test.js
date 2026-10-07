import test from 'node:test';
import assert from 'node:assert/strict';

import { getAnnotationItems } from '../src/domain/annotations.js';
import { getSubjectGeometry } from '../src/domain/geometry.js';
import { splitFeetInches } from '../src/domain/measurement.js';

const FLOOR_Y = 2000;

const makeSubject = (id, name, x, scale) => ({
  id,
  name,
  x,
  y: 0,
  scale,
  zIndex: 1,
  flipX: false,
  naturalW: 1000,
  naturalH: 2000,
  visibleBounds: { left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 },
});

const kira = makeSubject('a', 'Kira', 500, 0.875);
const noa = makeSubject('b', 'Noa', 900, 0.8);
const subjects = [kira, noa];

const itemsFor = (annotations, selectedId, unit = 'cm') =>
  getAnnotationItems({ subjects, selectedId, annotations, floorY: FLOOR_Y, unit });

test('annotations masquées : aucun élément, même avec une sélection', () => {
  assert.deepEqual(itemsFor({ enabled: false, scope: 'selected' }, 'a'), []);
  assert.deepEqual(itemsFor({ enabled: false, scope: 'all' }, 'a'), []);
});

test('annotations activées, sélection : seul le sujet sélectionné est annoté', () => {
  const items = itemsFor({ enabled: true, scope: 'selected' }, 'a');
  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'KIRA · 175 cm');
  assert.equal(items[0].emphasized, true);
});

test('annotations activées, sélection, rien de sélectionné : aucun élément', () => {
  assert.deepEqual(itemsFor({ enabled: true, scope: 'selected' }, null), []);
});

test('annotations activées, tous : un élément par sujet, seul le sélectionné est accentué', () => {
  const items = itemsFor({ enabled: true, scope: 'all' }, 'b');
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.emphasized), [false, true]);
});

test('la ligne de sommet suit le sommet visible, pas le haut du fichier', () => {
  const [item] = itemsFor({ enabled: true, scope: 'selected' }, 'a');
  const { visible } = getSubjectGeometry(kira, FLOOR_Y);
  assert.equal(item.lineY, visible.top);
  assert.ok(item.lineX1 < visible.left && item.lineX2 > visible.left + visible.width);
  assert.equal(item.labelX, 500);
});

test('unité pieds et pouces dans le libellé', () => {
  const [item] = itemsFor({ enabled: true, scope: 'selected' }, 'a', 'ft');
  assert.equal(item.text, 'KIRA · 5\'9"');
});

test('découpage pieds et pouces avec une décimale', () => {
  assert.deepEqual(splitFeetInches(175), { feet: 5, inches: 8.9 });
  assert.deepEqual(splitFeetInches(182.88), { feet: 6, inches: 0 });
});