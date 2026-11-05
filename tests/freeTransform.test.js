import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSubjectGeometry,
  getSubjectHeightCm,
  getScaleForGroundToTopPx,
  getAnchorUpdateForCanvasPoint,
  getHeadUpdateForCanvasPoint,
  keepPivotOnScaleChange,
  getSubjectFootprint,
} from '../src/domain/geometry.js';
import { applyStepsToPoint, normalizeAngle, rotatePoint } from '../src/domain/rotation.js';
import {
  startRotationGesture,
  getRotationForPointer,
  getRotationHandle,
  getResizeDistancePx,
  getResizeCursor,
} from '../src/domain/transformGesture.js';
import { arrangeSubjects, layoutRow, layoutOnImport } from '../src/domain/layout.js';
import { getSubjectRect, getCompositionRect, getBustRect } from '../src/domain/views.js';
import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';
import { areSubjectListsEqual } from '../src/domain/subjects.js';

const close = (actual, expected, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} différent de ${expected}`);

const FLOOR_Y = 2000;
const CANVAS_W = 2800;
const context = { canvasW: CANVAS_W, floorY: FLOOR_Y };

const make = (id, overrides = {}) => ({
  id,
  name: id,
  x: 1000,
  y: 0,
  scale: 1,
  zIndex: 1,
  flipX: false,
  rotation: 0,
  placement: 'auto',
  visible: true,
  naturalW: 400,
  naturalH: 1000,
  visibleBounds: { left: 0.1, top: 0.05, right: 0.9, bottom: 0.98 },
  groundAnchor: { x: 0.4, y: 0.95 },
  headAnchor: { x: 0.55, y: 0.07 },
  ...overrides,
});

const spriteCorners = (subject) => {
  const { box, transformSteps } = getSubjectGeometry(subject, FLOOR_Y);
  return [
    { x: box.left, y: box.top },
    { x: box.left + box.width, y: box.top },
    { x: box.left + box.width, y: box.top + box.height },
    { x: box.left, y: box.top + box.height },
  ].map((corner) => applyStepsToPoint(transformSteps, corner));
};

const assertSameSprite = (a, b, epsilon = 1e-6) => {
  const ca = spriteCorners(a);
  const cb = spriteCorners(b);
  ca.forEach((corner, i) => {
    close(corner.x, cb[i].x, epsilon);
    close(corner.y, cb[i].y, epsilon);
  });
};

const apply = (subject, update) => ({ ...subject, ...update });

test('rotation par poignée : aucun saut au premier mouvement', () => {
  const pivot = { x: 500, y: 1000 };
  const gesture = startRotationGesture({ pivot, point: { x: 560, y: 800 }, rotation: 33.27 });
  close(getRotationForPointer(gesture, { x: 560, y: 800 }), 33.27);
});

test('rotation par poignée : sens horaire positif et antihoraire négatif', () => {
  const pivot = { x: 500, y: 1000 };
  const gesture = startRotationGesture({ pivot, point: { x: 500, y: 800 }, rotation: 0 });
  close(getRotationForPointer(gesture, { x: 700, y: 1000 }), 90);
  close(getRotationForPointer(gesture, { x: 300, y: 1000 }), -90);
  close(getRotationForPointer(gesture, { x: 500, y: 1200 }), 180);
});

test('rotation par poignée : passage continu de la frontière ±180°', () => {
  const pivot = { x: 0, y: 0 };
  const gesture = startRotationGesture({ pivot, point: { x: 100, y: 0 }, rotation: 90 });
  let previous = getRotationForPointer(gesture, { x: 100, y: 0 });
  let maxStep = 0;
  for (let deg = 0; deg <= 90; deg += 1) {
    const radians = (deg * Math.PI) / 180;
    const point = { x: 100 * Math.cos(radians), y: 100 * Math.sin(radians) };
    const next = getRotationForPointer(gesture, point);
    const step = Math.abs(((next - previous + 540) % 360) - 180);
    maxStep = Math.max(maxStep, step);
    previous = next;
  }
  assert.ok(maxStep <= 1.0001, `saut de ${maxStep}°`);
  close(previous, 180);
});

test('rotation par poignée : démarrage depuis un angle existant et retour', () => {
  const pivot = { x: 0, y: 0 };
  const gesture = startRotationGesture({ pivot, point: { x: 0, y: -100 }, rotation: -170 });
  close(getRotationForPointer(gesture, { x: -100, y: 0 }), 100);
  close(getRotationForPointer(gesture, { x: 100, y: 0 }), -80);
});

test('rotation par poignée : pas de 15° avec Maj, et point trop proche du pivot ignoré', () => {
  const pivot = { x: 0, y: 0 };
  const gesture = startRotationGesture({ pivot, point: { x: 0, y: -100 }, rotation: 0 });
  const radians = (37 * Math.PI) / 180;
  const point = { x: 100 * Math.sin(radians), y: -100 * Math.cos(radians) };
  close(getRotationForPointer(gesture, point, { snap: true }), 30);
  assert.equal(getRotationForPointer(gesture, { x: 0.5, y: 0.5 }), null);
  assert.equal(startRotationGesture({ pivot, point: { x: 1, y: 0 }, rotation: 0 }), null);
});

test('rotation par poignée : le résultat est identique quel que soit le zoom', () => {
  const gesture = startRotationGesture({ pivot: { x: 500, y: 1000 }, point: { x: 500, y: 800 }, rotation: 10 });
  const screenFor = (zoom) => ({ x: (500 + 120) * zoom, y: (1000 - 80) * zoom });
  const values = [0.2, 1, 1.5].map((zoom) => {
    const screen = screenFor(zoom);
    return getRotationForPointer(gesture, { x: screen.x / zoom, y: screen.y / zoom });
  });
  close(values[0], values[1]);
  close(values[1], values[2]);
});

test('la poignée suit le cadre, avec ou sans miroir', () => {
  [false, true].forEach((flipX) => {
    const subject = make('a', { rotation: 90, flipX });
    const geometry = getSubjectGeometry(subject, FLOOR_Y);
    const { base, tip } = getRotationHandle(
      { subjectX: subject.x, visible: geometry.visible, anchor: geometry.anchor, rotation: geometry.rotation },
      50,
    );
    const top = applyStepsToPoint(geometry.transformSteps, { x: subject.x, y: geometry.visible.top });
    close(base.x, top.x);
    close(base.y, top.y);
    close(Math.hypot(tip.x - base.x, tip.y - base.y), 50);
  });
  const upright = make('b');
  const g = getSubjectGeometry(upright, FLOOR_Y);
  const handle = getRotationHandle({ subjectX: upright.x, visible: g.visible, anchor: g.anchor, rotation: 0 }, 50);
  close(handle.tip.x, upright.x);
  close(handle.tip.y, g.visible.top - 50);
});

const HISTORY = { isEqual: areSubjectListsEqual, limit: 50, mergeWindowMs: 500 };
const preview = (state, rotation) =>
  historyReducer(state, { type: 'set', updater: (list) => list.map((s) => ({ ...s, rotation })) });

test('geste de rotation : une seule entrée Undo/Redo, rollback propre, geste vide ignoré', () => {
  let state = createHistoryState([make('a')]);
  [10, 25, 40].forEach((angle) => {
    state = preview(state, angle);
  });
  state = historyReducer(state, { type: 'commit', mergeKey: null, time: 0, ...HISTORY });
  assert.equal(state.past.length, 1);
  state = historyReducer(state, { type: 'undo' });
  assert.equal(state.present[0].rotation, 0);
  state = historyReducer(state, { type: 'redo' });
  assert.equal(state.present[0].rotation, 40);

  let cancelled = createHistoryState([make('a')]);
  cancelled = preview(cancelled, 80);
  cancelled = historyReducer(cancelled, { type: 'rollback' });
  assert.equal(cancelled.present[0].rotation, 0);
  assert.equal(cancelled.past.length, 0);

  let untouched = createHistoryState([make('a')]);
  untouched = historyReducer(untouched, { type: 'commit', mergeKey: null, time: 0, ...HISTORY });
  assert.equal(untouched.past.length, 0);
});

[0, 30, 45, 90, -135].forEach((rotation) => {
  [false, true].forEach((flipX) => {
    test(`redimensionnement à ${rotation}° (miroir ${flipX}) : pivot fixe, proportions et hauteur cohérentes`, () => {
      const subject = make('a', { rotation, flipX });
      const before = getSubjectGeometry(subject, FLOOR_Y);
      const initH = before.anchor.y - before.visible.top;
      const delta = rotatePoint({ x: 0, y: -120 }, { x: 0, y: 0 }, rotation);
      const distance = getResizeDistancePx(initH, delta, rotation);
      close(distance, initH + 120);

      const scale = getScaleForGroundToTopPx(subject, distance);
      const update = keepPivotOnScaleChange(subject, { scale });
      const next = apply(subject, update);
      const after = getSubjectGeometry(next, FLOOR_Y);

      if (rotation !== 0) {
        close(after.anchor.x, before.anchor.x);
        close(after.anchor.y, before.anchor.y);
      } else {
        assert.equal(update.x, undefined);
      }
      close(after.box.width / after.box.height, before.box.width / before.box.height);
      close(after.anchor.y - after.visible.top, distance);
      close(getSubjectHeightCm(next), getSubjectHeightCm({ ...subject, scale }));
    });
  });
});

test('redimensionnement : la souris suit l\'axe local, pas l\'axe écran', () => {
  const horizontalOnScreen = { x: 80, y: 0 };
  close(getResizeDistancePx(500, horizontalOnScreen, 0), 500);
  close(getResizeDistancePx(500, { x: 80, y: 0 }, 90), 580);
  close(getResizeDistancePx(500, { x: 0, y: -80 }, 90), 500);
  close(getResizeDistancePx(500, { x: 0, y: -80 }, 0), 580);
});

test('redimensionnement à 0° : comportement historique inchangé', () => {
  const subject = make('a', { flipX: true });
  assert.deepEqual(keepPivotOnScaleChange(subject, { scale: 1.4 }), { scale: 1.4 });
  const delta = { x: 12, y: -33 };
  assert.equal(getResizeDistancePx(300, delta, 0), 300 - delta.y);
});

test('changement d\'échelle d\'un sujet pivoté : le pivot ne glisse pas (inspecteur et clavier compris)', () => {
  const subject = make('a', { rotation: 60, flipX: true });
  const before = getSubjectGeometry(subject, FLOOR_Y);
  const next = apply(subject, keepPivotOnScaleChange(subject, { scale: 1.7 }));
  const after = getSubjectGeometry(next, FLOOR_Y);
  close(after.anchor.x, before.anchor.x);
  close(after.anchor.y, before.anchor.y);
  const explicit = keepPivotOnScaleChange(subject, { scale: 1.7, x: 5 });
  assert.equal(explicit.x, 5);
});

test('curseurs de redimensionnement orientés selon le cadre', () => {
  assert.equal(getResizeCursor('top-center', 0, false), 'ns-resize');
  assert.equal(getResizeCursor('top-left', 0, false), 'nwse-resize');
  assert.equal(getResizeCursor('top-right', 0, false), 'nesw-resize');
  assert.equal(getResizeCursor('top-center', 90, false), 'ew-resize');
  assert.equal(getResizeCursor('top-center', 45, false), 'nesw-resize');
  assert.equal(getResizeCursor('top-left', 45, true), 'ew-resize');
});

const pointOnScreen = (subject, imagePoint) => {
  const { box, transformSteps } = getSubjectGeometry(subject, FLOOR_Y);
  return applyStepsToPoint(transformSteps, {
    x: box.left + imagePoint.x * box.width,
    y: box.top + imagePoint.y * box.height,
  });
};

[0, 30, 90, -120].forEach((rotation) => {
  [false, true].forEach((flipX) => {
    test(`ancre de tête à ${rotation}° (miroir ${flipX}) : aller-retour image ↔ écran`, () => {
      const subject = make('a', { rotation, flipX });
      const target = { x: 0.62, y: 0.1 };
      const update = getHeadUpdateForCanvasPoint(subject, FLOOR_Y, pointOnScreen(subject, target));
      close(update.headAnchor.x, target.x);
      close(update.headAnchor.y, target.y);
      const next = apply(subject, update);
      assertSameSprite(subject, next);
      close(getSubjectGeometry(next, FLOOR_Y).anchor.x, getSubjectGeometry(subject, FLOOR_Y).anchor.x);
      const head = getSubjectGeometry(next, FLOOR_Y).head;
      const expected = pointOnScreen(next, target);
      close(head.x, expected.x);
      close(head.y, expected.y);
    });

    test(`ancre d'appui à ${rotation}° (miroir ${flipX}) : l'image ne bouge pas, le repère suit le pointeur`, () => {
      const subject = make('a', { rotation, flipX });
      const target = { x: 0.5, y: 0.9 };
      const pointer = pointOnScreen(subject, target);
      const update = getAnchorUpdateForCanvasPoint(subject, FLOOR_Y, pointer);
      close(update.groundAnchor.x, target.x);
      close(update.groundAnchor.y, target.y);
      const next = apply(subject, update);
      assertSameSprite(subject, next);
      const anchor = getSubjectGeometry(next, FLOOR_Y).anchor;
      close(anchor.x, pointer.x);
      close(anchor.y, pointer.y);
      close(getSubjectHeightCm(next), getSubjectHeightCm({ ...subject, groundAnchor: update.groundAnchor }));
    });
  });
});

test('ancre d\'appui à 0° : mise à jour historique sans compensation', () => {
  const subject = make('a');
  const update = getAnchorUpdateForCanvasPoint(subject, FLOOR_Y, { x: 900, y: 1900 });
  assert.deepEqual(Object.keys(update).sort(), ['groundAnchor', 'y']);
});

test('ancres : contraintes anatomiques conservées sur un sujet pivoté', () => {
  const subject = make('a', { rotation: 45 });
  const tooHigh = getAnchorUpdateForCanvasPoint(subject, FLOOR_Y, pointOnScreen(subject, { x: 0.4, y: 0.01 }));
  assert.ok(tooHigh.groundAnchor.y >= subject.headAnchor.y + 0.02 - 1e-9);
  const headLow = getHeadUpdateForCanvasPoint(subject, FLOOR_Y, pointOnScreen(subject, { x: 0.5, y: 0.99 }));
  assert.ok(headLow.headAnchor.y <= subject.groundAnchor.y - 0.02 + 1e-9);
  const outside = getHeadUpdateForCanvasPoint(subject, FLOOR_Y, pointOnScreen(subject, { x: 3, y: 0.3 }));
  assert.equal(outside.headAnchor.x, 1);
});

test('sélection : le rectangle pivoté contient son centre et exclut les coins vides de la boîte englobante', () => {
  const subject = make('a', { rotation: 45 });
  const { projectedBounds, anchor, visible } = getSubjectGeometry(subject, FLOOR_Y);
  const inside = (point) => {
    const local = rotatePoint(point, anchor, -45);
    return (
      local.x >= visible.left && local.x <= visible.left + visible.width &&
      local.y >= visible.top && local.y <= visible.top + visible.height
    );
  };
  const center = rotatePoint({ x: subject.x, y: visible.top + visible.height / 2 }, anchor, 45);
  assert.equal(inside(center), true);
  assert.equal(inside({ x: projectedBounds.left + 1, y: projectedBounds.top + 1 }), false);
  assert.equal(inside({ x: projectedBounds.left + projectedBounds.width - 1, y: projectedBounds.top + 1 }), false);
});

test('ordre des calques : la priorité reste portée par le zIndex des sujets', () => {
  const low = make('low', { zIndex: 1, rotation: 20 });
  const high = make('high', { zIndex: 2, rotation: -20 });
  const stack = [low, high].sort((a, b) => b.zIndex - a.zIndex);
  assert.equal(stack[0].id, 'high');
});

test('empreinte : identique à la zone visible à 0°, englobante pivotée sinon', () => {
  const flat = make('a');
  assert.deepEqual(getSubjectFootprint(flat, FLOOR_Y), getSubjectGeometry(flat, FLOOR_Y).visible);
  const turned = make('a', { rotation: 90 });
  const geometry = getSubjectGeometry(turned, FLOOR_Y);
  close(getSubjectFootprint(turned, FLOOR_Y).width, geometry.visible.height);
  close(getSubjectFootprint(turned, FLOOR_Y).height, geometry.visible.width);
});

const overlap = (a, b) => {
  const ra = getSubjectFootprint(a, FLOOR_Y);
  const rb = getSubjectFootprint(b, FLOOR_Y);
  return Math.min(ra.left + ra.width, rb.left + rb.width) - Math.max(ra.left, rb.left);
};

test('auto-organisation : sujets pivotés placés selon leur largeur réelle, sans chevauchement', () => {
  const subjects = [
    make('a', { x: 300, rotation: 90 }),
    make('b', { x: 700, rotation: 45 }),
    make('c', { x: 1100, rotation: -30, flipX: true }),
    make('d', { x: 1500 }),
  ];
  const { subjects: arranged } = arrangeSubjects(subjects, 'space', { canvasW: 6000, floorY: FLOOR_Y });
  const sorted = [...arranged].sort(
    (a, b) => getSubjectFootprint(a, FLOOR_Y).left - getSubjectFootprint(b, FLOOR_Y).left,
  );
  for (let i = 0; i < sorted.length - 1; i += 1) {
    assert.ok(overlap(sorted[i], sorted[i + 1]) <= 1e-6, `${sorted[i].id}/${sorted[i + 1].id}`);
  }
  arranged.forEach((subject) => assert.equal(subject.placement, 'auto'));
});

test('auto-organisation : tri par hauteur indépendant de la rotation', () => {
  const subjects = [make('a', { scale: 1, rotation: 90 }), make('b', { scale: 2, rotation: 0 })];
  const { subjects: arranged } = arrangeSubjects(subjects, 'sort-asc', context);
  const first = [...arranged].sort((a, b) => a.x - b.x)[0];
  assert.equal(first.id, 'a');
});

test('centrage : le groupe pivoté est centré sur son empreinte projetée', () => {
  const subjects = [make('a', { x: 300, rotation: 90 }), make('b', { x: 600, rotation: -45 })];
  const { subjects: centered } = arrangeSubjects(subjects, 'center', context);
  const rects = centered.map((subject) => getSubjectFootprint(subject, FLOOR_Y));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  close((left + right) / 2, CANVAS_W / 2);
});

test('mise en page : sujets non pivotés inchangés (positions historiques)', () => {
  const subjects = [make('a', { x: 100 }), make('b', { x: 200, scale: 1.3 })];
  const { positions } = layoutRow(subjects, context);
  const widths = subjects.map((s) => getSubjectGeometry(s, FLOOR_Y).visible.width);
  const total = widths[0] + widths[1];
  const gap = Math.min(120, (CANVAS_W - 360 - total) / 1);
  const start = CANVAS_W / 2 - (total + gap) / 2;
  assert.equal(positions[0].x, start + widths[0] / 2);
});

test('import : un sujet existant pivoté repousse le nouveau sujet à droite de son empreinte', () => {
  const existing = [make('a', { x: 600, rotation: 90, placement: 'manual' })];
  const created = [make('n', { x: 0 })];
  const result = layoutOnImport(existing, created, context);
  const rotatedRect = getSubjectFootprint(existing[0], FLOOR_Y);
  const added = result.find((subject) => subject.id === 'n');
  const addedRect = getSubjectFootprint(added, FLOOR_Y);
  assert.ok(addedRect.left >= rotatedRect.left + rotatedRect.width - 1e-6);
});

test('cadrage : la composition inclut les coins du sujet pivoté', () => {
  const subjects = [make('a', { x: 500 }), make('b', { x: 1500, rotation: 90 })];
  const rect = getCompositionRect(subjects, FLOOR_Y);
  const { corners } = getSubjectGeometry(subjects[1], FLOOR_Y);
  corners.forEach((corner) => {
    assert.ok(corner.x >= rect.left - 1e-6 && corner.x <= rect.left + rect.width + 1e-6);
    assert.ok(corner.y >= rect.top - 1e-6 && corner.y <= rect.top + rect.height + 1e-6);
  });
});

test('cadrage : sujet masqué ignoré, rectangle inchangé à 0°', () => {
  const flat = make('a');
  assert.deepEqual(getSubjectRect(flat, FLOOR_Y), getSubjectGeometry(flat, FLOOR_Y).visible);
  assert.equal(getSubjectRect({ ...flat, visible: false }, FLOOR_Y), null);
  assert.equal(getBustRect({ ...flat, visible: false }, FLOOR_Y), null);
});

test('buste : le rectangle suit la tête du sujet pivoté', () => {
  const subject = make('a', { rotation: 90 });
  const bust = getBustRect(subject, FLOOR_Y);
  const { head } = getSubjectGeometry(subject, FLOOR_Y);
  assert.ok(head.x >= bust.left - 1e-6 && head.x <= bust.left + bust.width + 1e-6);
  assert.ok(head.y >= bust.top - 1e-6 && head.y <= bust.top + bust.height + 1e-6);
});

test('angle : normalisation après un geste', () => {
  close(normalizeAngle(190), -170);
  close(normalizeAngle(-180), 180);
});
