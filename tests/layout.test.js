import test from 'node:test';
import assert from 'node:assert/strict';

import { getSubjectGeometry, getSubjectHeightCm } from '../src/domain/geometry.js';
import {
  sortSubjects,
  layoutRow,
  arrangeSubjects,
  layoutOnImport,
  LAYOUT_SIDE_MARGIN,
} from '../src/domain/layout.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} différent de ${expected}`);

const FLOOR_Y = 2000;
const CANVAS_W = 1400;
const context = { canvasW: CANVAS_W, floorY: FLOOR_Y };

const makeSubject = (id, x, scale, extra = {}) => ({
  id,
  name: id,
  x,
  y: 0,
  scale,
  zIndex: 1,
  flipX: false,
  placement: 'auto',
  naturalW: 1000,
  naturalH: 2000,
  visibleBounds: { left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 },
  ...extra,
});

const widthOf = (subject) => getSubjectGeometry(subject, FLOOR_Y).visible.width;
const rectOf = (subject) => getSubjectGeometry(subject, FLOOR_Y).visible;

test('tri : par hauteur croissante et décroissante, sans modifier les hauteurs', () => {
  const tall = makeSubject('tall', 900, 1.0);
  const small = makeSubject('small', 100, 0.6);
  const medium = makeSubject('medium', 500, 0.8);
  const list = [tall, small, medium];
  assert.deepEqual(sortSubjects(list, 'height-asc').map((s) => s.id), ['small', 'medium', 'tall']);
  assert.deepEqual(sortSubjects(list, 'height-desc').map((s) => s.id), ['tall', 'medium', 'small']);
  assert.deepEqual(sortSubjects(list, 'current').map((s) => s.id), ['small', 'medium', 'tall']);
});

test('disposition : deux sujets, écart maximal, composition centrée', () => {
  const subjects = [makeSubject('a', 0, 0.6), makeSubject('b', 0, 0.6)];
  const { positions, gap, fits } = layoutRow(subjects, context);
  assert.equal(gap, 120);
  assert.equal(fits, true);
  const left = positions[0].x - widthOf(subjects[0]) / 2;
  const right = positions[1].x + widthOf(subjects[1]) / 2;
  close((left + right) / 2, CANVAS_W / 2);
  close(positions[1].x - positions[0].x - widthOf(subjects[0]), 120);
});

test('disposition : pas de chevauchement quand l\'espace suffit', () => {
  const subjects = [makeSubject('a', 0, 0.5), makeSubject('b', 0, 0.5), makeSubject('c', 0, 0.5)];
  const { positions, gap } = layoutRow(subjects, context);
  assert.ok(gap > 0);
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i].x - positions[i - 1].x >= widthOf(subjects[i]));
  }
});

test('disposition : trois sujets larges se chevauchent un peu mais tiennent', () => {
  const subjects = [makeSubject('a', 0, 0.8), makeSubject('b', 0, 0.8), makeSubject('c', 0, 0.8)];
  const { gap, fits, positions } = layoutRow(subjects, context);
  close(gap, -80);
  assert.equal(fits, true);
  const left = positions[0].x - widthOf(subjects[0]) / 2;
  const right = positions[2].x + widthOf(subjects[2]) / 2;
  assert.ok(left >= LAYOUT_SIDE_MARGIN - 1e-6 && right <= CANVAS_W - LAYOUT_SIDE_MARGIN + 1e-6);
});

test('disposition : six sujets ne tiennent pas, le chevauchement est plafonné', () => {
  const subjects = Array.from({ length: 6 }, (_, i) => makeSubject(`s${i}`, 0, 0.8));
  const { gap, fits } = layoutRow(subjects, context);
  assert.equal(fits, false);
  close(gap, -400 * 0.3);
});

test('disposition : un seul sujet est centré', () => {
  const [position] = layoutRow([makeSubject('a', 10, 0.8)], context).positions;
  close(position.x, CANVAS_W / 2);
});

test('commande trier par hauteur croissante : nouvelles positions, hauteurs inchangées', () => {
  const list = [makeSubject('tall', 300, 1.0), makeSubject('small', 900, 0.6), makeSubject('medium', 600, 0.8)];
  const result = arrangeSubjects(list, 'sort-asc', context);
  const byX = [...result.subjects].sort((a, b) => a.x - b.x).map((s) => s.id);
  assert.deepEqual(byX, ['small', 'medium', 'tall']);
  list.forEach((original) => {
    const after = result.subjects.find((s) => s.id === original.id);
    close(getSubjectHeightCm(after), getSubjectHeightCm(original));
    assert.equal(after.y, original.y);
    assert.equal(after.scale, original.scale);
  });
});

test('commande centrer : la composition est centrée, les écarts sont conservés', () => {
  const list = [makeSubject('a', 200, 0.6), makeSubject('b', 500, 0.6)];
  const { subjects } = arrangeSubjects(list, 'center', context);
  const left = Math.min(...subjects.map((s) => rectOf(s).left));
  const right = Math.max(...subjects.map((s) => rectOf(s).left + rectOf(s).width));
  close((left + right) / 2, CANVAS_W / 2);
  close(subjects[1].x - subjects[0].x, 300);
});

test('commande aligner au sol : y = 0 pour tous', () => {
  const list = [makeSubject('a', 200, 0.6, { y: 120 }), makeSubject('b', 500, 0.6, { y: -30 })];
  const { subjects } = arrangeSubjects(list, 'floor', context);
  assert.deepEqual(subjects.map((s) => s.y), [0, 0]);
});

test('commande inconnue ou liste vide : rien ne change', () => {
  const list = [makeSubject('a', 200, 0.6)];
  assert.equal(arrangeSubjects(list, 'inconnue', context).subjects, list);
  assert.deepEqual(arrangeSubjects([], 'space', context), { subjects: [], fits: true });
});

test('import : tous les sujets sont placés automatiquement, les nouveaux à droite', () => {
  const existing = [makeSubject('a', 300, 0.6), makeSubject('b', 650, 0.6)];
  const created = [makeSubject('c', 700, 0.6), makeSubject('d', 750, 0.6)];
  const result = layoutOnImport(existing, created, context);
  assert.deepEqual([...result].sort((p, q) => p.x - q.x).map((s) => s.id), ['a', 'b', 'c', 'd']);
  assert.ok(result.every((s) => s.placement === 'auto'));
  const left = Math.min(...result.map((s) => rectOf(s).left));
  const right = Math.max(...result.map((s) => rectOf(s).left + rectOf(s).width));
  close((left + right) / 2, CANVAS_W / 2);
});

test('import : un sujet déplacé à la main n\'est jamais déplacé automatiquement', () => {
  const existing = [makeSubject('a', 300, 0.5), makeSubject('b', 420, 0.5, { placement: 'manual' })];
  const created = [makeSubject('c', 0, 0.5)];
  const result = layoutOnImport(existing, created, context);
  assert.equal(result.find((s) => s.id === 'a').x, 300);
  assert.equal(result.find((s) => s.id === 'b').x, 420);
  const rightEdge = Math.max(...existing.map((s) => rectOf(s).left + rectOf(s).width));
  assert.ok(rectOf(result.find((s) => s.id === 'c')).left >= rightEdge);
});

test('import : plus de place à droite, les nouveaux sont centrés sans toucher aux anciens', () => {
  const existing = [makeSubject('a', 1100, 0.8, { placement: 'manual' })];
  const created = [makeSubject('c', 0, 0.8)];
  const result = layoutOnImport(existing, created, context);
  assert.equal(result.find((s) => s.id === 'a').x, 1100);
  close(result.find((s) => s.id === 'c').x, CANVAS_W / 2);
});