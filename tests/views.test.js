import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_ZOOM,
  MAX_ZOOM,
  BUST_HEIGHT_RATIO,
  getViewForRect,
  getSubjectRect,
  getCompositionRect,
  getBustRect,
} from '../src/domain/views.js';
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

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('vue : un rectangle centré sur la planche donne un pan nul', () => {
  const view = getViewForRect({
    rect: { left: 0, top: 0, width: 2000, height: 1000 },
    container: { width: 1000, height: 500 },
    canvas: { width: 2000, height: 1000 },
  });
  close(view.zoom, 0.5);
  close(view.panX, 0);
  close(view.panY, 0);
});

test('vue : un rectangle décalé est ramené au centre de la zone', () => {
  const view = getViewForRect({
    rect: { left: 100, top: 100, width: 400, height: 200 },
    container: { width: 400, height: 200 },
    canvas: { width: 1000, height: 800 },
  });
  close(view.zoom, 1);
  close(view.panX, 200);
  close(view.panY, 200);
});

test('vue : un zoom imposé est respecté et le rectangle reste centré', () => {
  const view = getViewForRect({
    rect: { left: 100, top: 100, width: 400, height: 200 },
    container: { width: 50, height: 50 },
    canvas: { width: 1000, height: 800 },
    zoom: 1,
  });
  close(view.zoom, 1);
  close(view.panX, 200);
  close(view.panY, 200);
});

test('vue : le zoom reste dans les bornes', () => {
  const canvas = { width: 1000, height: 800 };
  const container = { width: 1000, height: 800 };
  const small = getViewForRect({ rect: { left: 0, top: 0, width: 10, height: 10 }, container, canvas });
  const huge = getViewForRect({ rect: { left: 0, top: 0, width: 100000, height: 100000 }, container, canvas });
  assert.equal(small.zoom, MAX_ZOOM);
  assert.equal(huge.zoom, MIN_ZOOM);
});

test('vue : la marge réduit le zoom', () => {
  const args = {
    rect: { left: 0, top: 0, width: 1000, height: 500 },
    container: { width: 1000, height: 500 },
    canvas: { width: 1000, height: 500 },
  };
  close(getViewForRect(args).zoom, 1);
  close(getViewForRect({ ...args, padding: 50 }).zoom, 0.8);
});

test('composition : union des rectangles visibles', () => {
  const list = [make('a', { x: 500 }), make('b', { x: 1100 })];
  const rects = list.map((subject) => getSubjectGeometry(subject, FLOOR_Y).visible);
  const composition = getCompositionRect(list, FLOOR_Y);
  close(composition.left, Math.min(...rects.map((r) => r.left)));
  close(composition.top, Math.min(...rects.map((r) => r.top)));
  close(composition.left + composition.width, Math.max(...rects.map((r) => r.left + r.width)));
  close(composition.top + composition.height, Math.max(...rects.map((r) => r.top + r.height)));
});

test('composition : ignore les sujets masqués, nulle si aucun visible', () => {
  const visible = make('a', { x: 500 });
  const hidden = make('b', { x: 1500, visible: false });
  assert.deepEqual(getCompositionRect([visible, hidden], FLOOR_Y), getCompositionRect([visible], FLOOR_Y));
  assert.equal(getCompositionRect([hidden], FLOOR_Y), null);
  assert.equal(getCompositionRect([], FLOOR_Y), null);
});

test('buste : partie haute du sujet, centrée sur lui', () => {
  const subject = make('a');
  const rect = getSubjectRect(subject, FLOOR_Y);
  const bust = getBustRect(subject, FLOOR_Y);
  close(bust.top, rect.top);
  close(bust.height, rect.height * BUST_HEIGHT_RATIO);
  assert.ok(bust.width <= rect.width);
  close(bust.left + bust.width / 2, rect.left + rect.width / 2);
});

test('buste et rectangle : indisponibles pour un sujet masqué', () => {
  const hidden = make('a', { visible: false });
  assert.equal(getSubjectRect(hidden, FLOOR_Y), null);
  assert.equal(getBustRect(hidden, FLOOR_Y), null);
});

test('les vues ne modifient pas les sujets', () => {
  const list = [make('a'), make('b', { x: 1100 })];
  const snapshot = JSON.parse(JSON.stringify(list));
  getCompositionRect(list, FLOOR_Y);
  getBustRect(list[0], FLOOR_Y);
  getSubjectRect(list[1], FLOOR_Y);
  assert.deepEqual(list, snapshot);
});