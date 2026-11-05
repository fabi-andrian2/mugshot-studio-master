import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyStepsToContext,
  buildSubjectTransform,
  applyStepsToPoint,
  getRotation,
  isRotated,
  normalizeAngle,
  rotatePoint,
  stepsToCssTransform,
  unrotatePoint,
} from '../src/domain/rotation.js';
import { getSubjectGeometry, getSubjectHeightCm, getHeadAnchor, getGroundAnchor } from '../src/domain/geometry.js';
import { getAnnotationItems } from '../src/domain/annotations.js';
import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';
import { areSubjectListsEqual, createSubject } from '../src/domain/subjects.js';
import { serializeSession, restoreSession } from '../src/services/sessionSnapshot.js';
import { SCHEMA_VERSION } from '../src/services/persistence.js';

const FLOOR_Y = 2000;
const close = (actual, expected, message, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} ${actual} ≠ ${expected}`);
const closePoint = (actual, expected, message) => {
  close(actual.x, expected.x, `${message ?? ''} x`);
  close(actual.y, expected.y, `${message ?? ''} y`);
};

const makeSubject = (overrides = {}) => ({
  id: 'a',
  name: 'Kira',
  fileName: 'kira.png',
  x: 700,
  y: 40,
  scale: 0.8,
  zIndex: 1,
  flipX: false,
  rotation: 0,
  placement: 'manual',
  visible: true,
  silhouette: false,
  naturalW: 1000,
  naturalH: 2000,
  visibleBounds: { left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 },
  groundAnchor: { x: 0.45, y: 0.88 },
  headAnchor: { x: 0.52, y: 0.12 },
  ...overrides,
});

test('normalisation : plage ]-180, 180]', () => {
  assert.equal(normalizeAngle(90), 90);
  assert.equal(normalizeAngle(180), 180);
  assert.equal(normalizeAngle(-180), 180);
  assert.equal(normalizeAngle(270), -90);
  assert.equal(normalizeAngle(370), 10);
  assert.equal(normalizeAngle(-190), 170);
  assert.equal(normalizeAngle(360), 0);
  assert.equal(normalizeAngle(-720), 0);
  assert.equal(normalizeAngle(45.5), 45.5);
  assert.equal(normalizeAngle(-45.25), -45.25);
  assert.equal(Object.is(normalizeAngle(-0), 0), true);
});

test('normalisation : valeurs invalides ramenées à 0', () => {
  [NaN, Infinity, -Infinity, undefined, null, '12', {}, []].forEach((value) => {
    assert.equal(normalizeAngle(value), 0);
  });
  assert.equal(getRotation({}), 0);
  assert.equal(getRotation({ rotation: 'abc' }), 0);
  assert.equal(getRotation({ rotation: 450 }), 90);
  assert.equal(isRotated({ rotation: 360 }), false);
  assert.equal(isRotated({ rotation: 0.5 }), true);
});

test('rotation de point : sens horaire à l\'écran, 0°, 90°, -90°, 180°', () => {
  const pivot = { x: 10, y: 20 };
  const right = { x: 20, y: 20 };
  assert.deepEqual(rotatePoint(right, pivot, 0), right);
  closePoint(rotatePoint(right, pivot, 90), { x: 10, y: 30 }, '90° : la droite passe vers le bas');
  closePoint(rotatePoint(right, pivot, -90), { x: 10, y: 10 }, '-90°');
  closePoint(rotatePoint(right, pivot, 180), { x: 0, y: 20 }, '180°');
  closePoint(rotatePoint({ x: 10, y: 10 }, pivot, 90), { x: 20, y: 20 }, 'le haut passe vers la droite');
});

test('rotation de point : pivot invariant, distance conservée, inverse exacte', () => {
  const pivot = { x: 123.5, y: -40 };
  const point = { x: 400, y: 250 };
  const distance = Math.hypot(point.x - pivot.x, point.y - pivot.y);
  [0, 10, 33.3, 90, -90, 135, 180, -179].forEach((angle) => {
    closePoint(rotatePoint(pivot, pivot, angle), pivot, `pivot ${angle}°`);
    const rotated = rotatePoint(point, pivot, angle);
    close(Math.hypot(rotated.x - pivot.x, rotated.y - pivot.y), distance, `distance ${angle}°`);
    closePoint(unrotatePoint(rotated, pivot, angle), point, `inverse ${angle}°`);
  });
});

test('géométrie à 0° : identique au calcul historique', () => {
  const subject = makeSubject({ rotation: undefined });
  const geometry = getSubjectGeometry(subject, FLOOR_Y);

  const anchorY = FLOOR_Y - subject.y;
  const boxTop = anchorY - 0.88 * 2000 * 0.8;
  assert.equal(geometry.box.top, boxTop);
  assert.equal(geometry.box.width, 1000 * 0.8);
  assert.deepEqual(geometry.anchor, { x: geometry.box.left + 0.45 * 1000 * 0.8, y: anchorY });
  assert.deepEqual(geometry.head, { x: geometry.box.left + 0.52 * 1000 * 0.8, y: boxTop + 0.12 * 2000 * 0.8 });
  assert.deepEqual(geometry.head, geometry.localHead);
  assert.equal(geometry.rotation, 0);
  assert.deepEqual(geometry.transformSteps, []);
  assert.deepEqual(
    geometry.corners,
    [
      { x: geometry.visible.left, y: geometry.visible.top },
      { x: geometry.visible.left + geometry.visible.width, y: geometry.visible.top },
      { x: geometry.visible.left + geometry.visible.width, y: geometry.visible.top + geometry.visible.height },
      { x: geometry.visible.left, y: geometry.visible.top + geometry.visible.height },
    ],
  );
  assert.deepEqual(geometry.projectedBounds, geometry.visible);
});

test('géométrie à 0° avec miroir : même point d\'appui et même tête qu\'avant', () => {
  const subject = makeSubject({ flipX: true });
  const geometry = getSubjectGeometry(subject, FLOOR_Y);
  const { box } = geometry;
  assert.equal(geometry.anchor.x, 2 * subject.x - (box.left + 0.45 * 1000 * 0.8));
  assert.equal(geometry.head.x, 2 * subject.x - (box.left + 0.52 * 1000 * 0.8));
  const steps = geometry.transformSteps;
  const raw = { x: box.left + 0.3 * 800, y: box.top + 500 };
  closePoint(applyStepsToPoint(steps, raw), { x: 2 * subject.x - raw.x, y: raw.y }, 'miroir seul');
});

test('rotation : le point d\'appui reste fixe, avec et sans miroir', () => {
  [false, true].forEach((flipX) => {
    const reference = getSubjectGeometry(makeSubject({ flipX }), FLOOR_Y);
    [10, 45, 90, -90, 180, -135, 37.5].forEach((rotation) => {
      const geometry = getSubjectGeometry(makeSubject({ flipX, rotation }), FLOOR_Y);
      assert.deepEqual(geometry.anchor, reference.anchor);
      assert.deepEqual(geometry.box, reference.box);
      assert.deepEqual(geometry.visible, reference.visible);
    });
  });
});

test('rotation : la tête suit la rotation et garde sa distance à l\'appui', () => {
  const base = getSubjectGeometry(makeSubject(), FLOOR_Y);
  const distance = Math.hypot(base.head.x - base.anchor.x, base.head.y - base.anchor.y);
  [10, 45, 90, -90, 180].forEach((rotation) => {
    const geometry = getSubjectGeometry(makeSubject({ rotation }), FLOOR_Y);
    close(Math.hypot(geometry.head.x - geometry.anchor.x, geometry.head.y - geometry.anchor.y), distance, `${rotation}°`);
    closePoint(geometry.localHead, base.localHead, 'tête locale conservée');
    closePoint(unrotatePoint(geometry.head, geometry.anchor, rotation), base.head, 'tête inverse');
  });
});

test('rotation horaire : la tête passe à droite de l\'appui, avec ou sans miroir', () => {
  [false, true].forEach((flipX) => {
    const geometry = getSubjectGeometry(
      makeSubject({ flipX, rotation: 90, headAnchor: { x: 0.45, y: 0.12 } }),
      FLOOR_Y,
    );
    assert.ok(geometry.head.x > geometry.anchor.x + 100, `miroir ${flipX}`);
    close(geometry.head.y, geometry.anchor.y, `niveau ${flipX}`);
  });
});

test('hauteur réelle : inchangée par la rotation et le miroir', () => {
  const reference = getSubjectHeightCm(makeSubject());
  [0, 10, 45, 90, -90, 180].forEach((rotation) => {
    [false, true].forEach((flipX) => {
      assert.equal(getSubjectHeightCm(makeSubject({ rotation, flipX })), reference);
    });
  });
  const subject = makeSubject({ rotation: 33 });
  assert.deepEqual(getHeadAnchor(subject), { x: 0.52, y: 0.12 });
  assert.deepEqual(getGroundAnchor(subject), { x: 0.45, y: 0.88 });
});

test('cohérence : les étapes de transformation projettent l\'image comme la géométrie', () => {
  [false, true].forEach((flipX) => {
    [0, 10, 45, 90, -90, 180, 37.5].forEach((rotation) => {
      const subject = makeSubject({ flipX, rotation });
      const geometry = getSubjectGeometry(subject, FLOOR_Y);
      const { box, transformSteps } = geometry;
      const toRaw = (point) => ({
        x: box.left + point.x * box.width,
        y: box.top + point.y * box.height,
      });
      closePoint(applyStepsToPoint(transformSteps, toRaw(subject.groundAnchor)), geometry.anchor, `appui ${rotation} ${flipX}`);
      closePoint(applyStepsToPoint(transformSteps, toRaw(subject.headAnchor)), geometry.head, `tête ${rotation} ${flipX}`);
    });
  });
});

const parseCssTransform = (css) => {
  const matches = [...css.matchAll(/(translate|scale|rotate)\(([^)]*)\)/g)];
  return matches.map(([, op, args]) => {
    const values = args.split(',').map((value) => parseFloat(value));
    if (op === 'translate') return { op, x: values[0], y: values[1] };
    if (op === 'scale') return { op, x: values[0], y: values[1] };
    return { op, degrees: values[0] };
  });
};

const makeFakeContext = () => {
  let matrix = [1, 0, 0, 1, 0, 0];
  const multiply = (m) => {
    const [a, b, c, d, e, f] = matrix;
    matrix = [
      a * m[0] + c * m[1], b * m[0] + d * m[1],
      a * m[2] + c * m[3], b * m[2] + d * m[3],
      a * m[4] + c * m[5] + e, b * m[4] + d * m[5] + f,
    ];
  };
  return {
    translate: (x, y) => multiply([1, 0, 0, 1, x, y]),
    scale: (x, y) => multiply([x, 0, 0, y, 0, 0]),
    rotate: (radians) => multiply([Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0]),
    project: (p) => ({ x: matrix[0] * p.x + matrix[2] * p.y + matrix[4], y: matrix[1] * p.x + matrix[3] * p.y + matrix[5] }),
  };
};

test('DOM et export : transformation CSS et contexte canvas donnent la même projection', () => {
  [false, true].forEach((flipX) => {
    [0, 10, 45, 90, -90, 180, 37.5].forEach((rotation) => {
      const { box, visible, transformSteps } = getSubjectGeometry(makeSubject({ flipX, rotation }), FLOOR_Y);
      const probe = { x: 0.3, y: 0.6 };

      const ctx = makeFakeContext();
      applyStepsToContext(ctx, transformSteps);
      const expected = ctx.project({ x: box.left + probe.x * box.width, y: box.top + probe.y * box.height });
      closePoint(applyStepsToPoint(transformSteps, { x: box.left + probe.x * box.width, y: box.top + probe.y * box.height }), expected, 'contexte');

      [box, visible].forEach((element) => {
        const css = stepsToCssTransform(transformSteps, element);
        if (transformSteps.length === 0) {
          assert.equal(css, undefined);
          return;
        }
        const cssSteps = parseCssTransform(css);
        const local = { x: probe.x * (element.width ?? box.width), y: probe.y * (element.height ?? box.height) };
        const cssPoint = applyStepsToPoint(cssSteps, local);
        const canvasPoint = applyStepsToPoint(transformSteps, { x: element.left + local.x, y: element.top + local.y });
        closePoint({ x: cssPoint.x + element.left, y: cssPoint.y + element.top }, canvasPoint, 'css');
      });
    });
  });
});

test('rotation : le cadre de sélection tourne avec le sujet autour de l\'appui', () => {
  const geometry = getSubjectGeometry(makeSubject({ rotation: 90 }), FLOOR_Y);
  const { anchor, visible, corners } = geometry;
  const topLeft = { x: visible.left, y: visible.top };
  closePoint(corners[0], rotatePoint(topLeft, anchor, 90), 'coin haut gauche');
  assert.ok(geometry.projectedBounds.width > visible.width);
  corners.forEach((corner, i) => {
    const local = [
      { x: visible.left, y: visible.top },
      { x: visible.left + visible.width, y: visible.top },
      { x: visible.left + visible.width, y: visible.top + visible.height },
      { x: visible.left, y: visible.top + visible.height },
    ][i];
    close(Math.hypot(corner.x - anchor.x, corner.y - anchor.y), Math.hypot(local.x - anchor.x, local.y - anchor.y), `coin ${i}`);
  });
});

test('annotations : pas de ligne de comparaison pour un sujet pivoté, hauteur réelle conservée', () => {
  const run = (subject) =>
    getAnnotationItems({
      subjects: [subject],
      selectedId: 'a',
      annotations: { enabled: true, scope: 'selected' },
      floorY: FLOOR_Y,
      unit: 'cm',
    })[0];

  const upright = run(makeSubject());
  const tilted = run(makeSubject({ rotation: 30 }));

  assert.equal(upright.showLine, true);
  assert.equal(upright.labelX, 700);
  assert.equal(tilted.showLine, false);
  assert.equal(tilted.text, upright.text);
  assert.equal(tilted.labelX, getSubjectGeometry(makeSubject({ rotation: 30 }), FLOOR_Y).head.x);
});

test('création : un nouveau sujet démarre à 0°', () => {
  const subject = createSubject(
    { id: 'i', url: 'blob:i', fileName: 'i.png', naturalW: 500, naturalH: 1000, visibleBounds: { left: 0, top: 0, right: 1, bottom: 1 } },
    { index: 0, canvasW: 1400, zIndex: 1 },
  );
  assert.equal(subject.rotation, 0);
});

const HISTORY = { isEqual: areSubjectListsEqual, limit: 50, mergeWindowMs: 500 };
const applyHistory = (state, updater, mergeKey = null, time = 0) =>
  historyReducer(state, { type: 'apply', updater, mergeKey, time, ...HISTORY });
const withRotation = (rotation) => (list) => list.map((s) => ({ ...s, rotation }));

test('historique : la rotation s\'annule et se rétablit', () => {
  let state = createHistoryState([makeSubject()]);
  state = applyHistory(state, withRotation(45));
  assert.equal(state.present[0].rotation, 45);
  state = historyReducer(state, { type: 'undo' });
  assert.equal(state.present[0].rotation, 0);
  state = historyReducer(state, { type: 'redo' });
  assert.equal(state.present[0].rotation, 45);
});

test('historique : aperçu puis annulation de la saisie sans entrée', () => {
  let state = createHistoryState([makeSubject()]);
  state = historyReducer(state, { type: 'set', updater: withRotation(30) });
  state = historyReducer(state, { type: 'set', updater: withRotation(31) });
  assert.equal(state.present[0].rotation, 31);
  state = historyReducer(state, { type: 'rollback' });
  assert.equal(state.present[0].rotation, 0);
  assert.equal(state.past.length, 0);
});

test('historique : un aperçu suivi d\'une validation crée une seule entrée', () => {
  let state = createHistoryState([makeSubject()]);
  [10, 20, 30].forEach((angle) => {
    state = historyReducer(state, { type: 'set', updater: withRotation(angle) });
  });
  state = applyHistory(state, withRotation(30), 'rotation');
  assert.equal(state.past.length, 1);
  assert.equal(state.committed[0].rotation, 30);
});

test('historique : les incréments rapprochés (molette) fusionnent en une entrée', () => {
  let state = createHistoryState([makeSubject()]);
  state = applyHistory(state, withRotation(1), 'rotation', 1000);
  state = applyHistory(state, withRotation(2), 'rotation', 1200);
  state = applyHistory(state, withRotation(3), 'rotation', 1400);
  assert.equal(state.past.length, 1);
  state = historyReducer(state, { type: 'undo' });
  assert.equal(state.present[0].rotation, 0);
});

test('historique : deux sujets de rotation différente ne sont pas égaux', () => {
  assert.equal(areSubjectListsEqual([makeSubject()], [makeSubject({ rotation: 5 })]), false);
});

const pngBlob = (label) => new Blob([label], { type: 'image/png' });
const fetchBlob = async (url) => pngBlob(url);
const fakeUrls = () => {
  let n = 0;
  return { createUrl: () => `blob:restored-${(n += 1)}`, revokeUrl: () => {} };
};
const makeState = (subject) => ({
  canvasW: 2800,
  canvasH: 2200,
  unit: 'cm',
  subjects: [{ url: 'blob:a', ...subject }],
  board: { showGrid: true, background: { color: '#ffffff', image: null } },
  annotations: { enabled: false, scope: 'selected' },
  mannequin: { visible: true, heightCm: 180, x: 400 },
  measure: { active: false, items: [] },
});

const roundTrip = async (subject) => {
  const serialized = await serializeSession(makeState(subject), { fetchBlob });
  assert.equal(serialized.ok, true);
  const restored = await restoreSession(
    { schemaVersion: SCHEMA_VERSION, savedAt: 1, data: serialized.data },
    fakeUrls(),
  );
  assert.equal(restored.ok, true);
  return { data: serialized.data, subject: restored.state.subjects[0] };
};

test('persistance : la rotation est sauvegardée et restaurée', async () => {
  const { data, subject } = await roundTrip(makeSubject({ rotation: 45.5 }));
  assert.equal(data.subjects[0].rotation, 45.5);
  assert.equal(subject.rotation, 45.5);
  assert.equal((await roundTrip(makeSubject({ rotation: -90 }))).subject.rotation, -90);
});

test('persistance : à 0° rien n\'est ajouté au format de sauvegarde', async () => {
  const { data } = await roundTrip(makeSubject({ rotation: 0 }));
  assert.equal('rotation' in data.subjects[0], false);
});

test('persistance : une ancienne session sans rotation est restaurée à 0°', async () => {
  const legacy = makeSubject();
  delete legacy.rotation;
  const { data, subject } = await roundTrip(legacy);
  assert.equal('rotation' in data.subjects[0], false);
  assert.equal(subject.rotation, 0);
});

test('persistance : une rotation invalide est normalisée sans rejeter la session', async () => {
  assert.equal((await roundTrip(makeSubject({ rotation: 370 }))).subject.rotation, 10);
  assert.equal((await roundTrip(makeSubject({ rotation: 'abc' }))).subject.rotation, 0);
  assert.equal((await roundTrip(makeSubject({ rotation: NaN }))).subject.rotation, 0);

  const serialized = await serializeSession(makeState(makeSubject({ rotation: 20 })), { fetchBlob });
  serialized.data.subjects[0].rotation = 'corrompu';
  const restored = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data: serialized.data }, fakeUrls());
  assert.equal(restored.ok, true);
  assert.equal(restored.state.subjects[0].rotation, 0);
});

test('ordre miroir puis rotation : exemple asymétrique P=(0,0), (40,-100), miroir, +90°', () => {
  const steps = buildSubjectTransform({ pivot: { x: 0, y: 0 }, flipAxisX: 0, flipped: true, rotation: 90 });
  const point = { x: 40, y: -100 };

  closePoint(applyStepsToPoint(steps, point), { x: 100, y: -40 }, 'étapes');

  const ctx = makeFakeContext();
  applyStepsToContext(ctx, steps);
  closePoint(ctx.project(point), { x: 100, y: -40 }, 'contexte canvas');

  const element = { left: 0, top: 0, width: 10, height: 10 };
  closePoint(applyStepsToPoint(parseCssTransform(stepsToCssTransform(steps, element)), point), { x: 100, y: -40 }, 'css');

  const mirrored = { x: -40, y: -100 };
  closePoint(rotatePoint(mirrored, { x: 0, y: 0 }, 90), { x: 100, y: -40 }, 'miroir puis rotation');
  closePoint(rotatePoint(point, { x: 0, y: 0 }, 90), { x: 100, y: 40 }, 'rotation seule');
  const rotatedFirst = rotatePoint(point, { x: 0, y: 0 }, 90);
  closePoint({ x: -rotatedFirst.x, y: rotatedFirst.y }, { x: -100, y: 40 }, 'ordre inverse (rotation puis miroir) : résultat différent');
});

test('ordre miroir puis rotation : axe de miroir décalé du pivot', () => {
  const steps = buildSubjectTransform({ pivot: { x: 10, y: 20 }, flipAxisX: 30, flipped: true, rotation: 90 });
  const point = { x: 40, y: -100 };
  const mirrored = { x: 2 * 30 - 40, y: -100 };
  closePoint(applyStepsToPoint(steps, point), rotatePoint(mirrored, { x: 10, y: 20 }, 90), 'miroir autour de x=30 puis rotation autour de P');
});
