import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SHADOWS,
  LEGACY_SHADOWS,
  SHADOW_PRESETS,
  applyShadowPreset,
  getProjection,
  getShadowPlan,
  getShadowPlans,
  getShadowStyle,
  getSpriteTransformCss,
  normalizeShadows,
  projectPoint,
  projectionToCss,
  updateShadows,
} from '../src/domain/shadows.js';
import { getSubjectGeometry } from '../src/domain/geometry.js';
import { applyStepsToPoint } from '../src/domain/rotation.js';
import { getExportLayers } from '../src/domain/exportPlan.js';
import { serializeSession, restoreSession } from '../src/services/sessionSnapshot.js';
import { createBlankState } from '../src/domain/blankSession.js';

const FLOOR_Y = 2000;

const make = (id, overrides = {}) => ({
  id,
  name: id,
  url: `blob:${id}`,
  fileName: `${id}.png`,
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

const settings = (overrides = {}) => normalizeShadows({ ...DEFAULT_SHADOWS, ...overrides });

const close = (actual, expected, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} différent de ${expected}`);

const headShadow = (subject, direction, reach = 0.3) => {
  const geometry = getSubjectGeometry(subject, FLOOR_Y);
  const matrix = getProjection({ lineY: geometry.anchor.y, direction, reach });
  return { anchor: geometry.anchor, head: geometry.head, shadow: projectPoint(matrix, geometry.head), matrix };
};

test('réglages : défauts, préréglages et normalisation', () => {
  assert.equal(DEFAULT_SHADOWS.enabled, true);
  assert.equal(DEFAULT_SHADOWS.preset, 'natural');
  assert.equal(LEGACY_SHADOWS.enabled, false);
  assert.deepEqual(SHADOW_PRESETS.map((preset) => preset.id), ['natural', 'studio', 'soft']);
  assert.deepEqual(normalizeShadows(undefined), DEFAULT_SHADOWS);
  assert.deepEqual(normalizeShadows('x'), DEFAULT_SHADOWS);
  const clamped = normalizeShadows({ preset: 'custom', direction: -90, intensity: 300, length: -4, softness: 'a' });
  assert.equal(clamped.direction, 270);
  assert.equal(clamped.intensity, 100);
  assert.equal(clamped.length, 0);
  assert.equal(clamped.softness, DEFAULT_SHADOWS.softness);
  assert.equal(normalizeShadows({ preset: 'inconnu' }).preset, 'natural');
  assert.equal(normalizeShadows({ enabled: 'oui' }).enabled, true);
  assert.equal(normalizeShadows({ direction: 725 }).direction, 5);
});

test('préréglages : chacun impose ses valeurs et conserve direction et activation', () => {
  const base = { ...DEFAULT_SHADOWS, direction: 120, enabled: false };
  SHADOW_PRESETS.forEach((preset) => {
    const next = applyShadowPreset(base, preset.id);
    assert.equal(next.preset, preset.id);
    assert.equal(next.direction, 120);
    assert.equal(next.enabled, false);
    assert.equal(next.intensity, preset.values.intensity);
    assert.equal(next.length, preset.values.length);
    assert.equal(next.softness, preset.values.softness);
    assert.deepEqual(normalizeShadows(next), next);
  });
  const studio = getShadowStyle(applyShadowPreset(DEFAULT_SHADOWS, 'studio'));
  const soft = getShadowStyle(applyShadowPreset(DEFAULT_SHADOWS, 'soft'));
  const natural = getShadowStyle(DEFAULT_SHADOWS);
  assert.ok(studio.castOpacity > natural.castOpacity);
  assert.ok(soft.castBlur > natural.castBlur && natural.castBlur > studio.castBlur);
});

test('réglages manuels : passage en Personnalisé, la direction ne change pas le préréglage', () => {
  const turned = updateShadows(DEFAULT_SHADOWS, { direction: 45 });
  assert.equal(turned.preset, 'natural');
  assert.equal(turned.direction, 45);
  ['intensity', 'length', 'softness'].forEach((key) => {
    const custom = updateShadows(DEFAULT_SHADOWS, { [key]: 77 });
    assert.equal(custom.preset, 'custom');
    assert.equal(custom[key], 77);
  });
  assert.equal(updateShadows(DEFAULT_SHADOWS, { intensity: 500 }).intensity, 100);
  assert.equal(updateShadows(DEFAULT_SHADOWS, { enabled: false }).enabled, false);
  assert.equal(updateShadows(DEFAULT_SHADOWS, { enabled: false }).preset, 'natural');
});

test('style : intensité, diffusion et longueur croissent de façon monotone', () => {
  const low = getShadowStyle(settings({ preset: 'custom', intensity: 10, length: 10, softness: 10 }));
  const high = getShadowStyle(settings({ preset: 'custom', intensity: 90, length: 90, softness: 90 }));
  assert.ok(high.castOpacity > low.castOpacity && high.contactOpacity > low.contactOpacity);
  assert.ok(high.castBlur > low.castBlur && high.contactBlur > low.contactBlur);
  assert.ok(high.reach > low.reach);
  assert.ok(getShadowStyle(settings({ preset: 'custom', intensity: 0 })).castOpacity === 0);
});

test('direction : 0° du haut, 90° de la droite, 180° du bas, 270° de la gauche', () => {
  const subject = make('a');
  const top = headShadow(subject, 0);
  close(top.shadow.x, top.head.x);
  assert.ok(top.shadow.y > top.anchor.y, 'lumière du haut : ombre vers le spectateur');

  const right = headShadow(subject, 90);
  assert.ok(right.shadow.x < right.head.x - 10, 'lumière de la droite : ombre vers la gauche');

  const bottom = headShadow(subject, 180);
  close(bottom.shadow.x, bottom.head.x);
  assert.ok(bottom.shadow.y < bottom.anchor.y, 'lumière du bas : ombre vers l\'arrière');

  const left = headShadow(subject, 270);
  assert.ok(left.shadow.x > left.head.x + 10, 'lumière de la gauche : ombre vers la droite');
});

test('projection : les points de la ligne d\'appui sont fixes, la longueur croît avec la hauteur', () => {
  const matrix = getProjection({ lineY: 1500, direction: 300, reach: 0.4 });
  [-200, 0, 733].forEach((x) => {
    const point = projectPoint(matrix, { x, y: 1500 });
    close(point.x, x);
    close(point.y, 1500);
  });
  const near = projectPoint(matrix, { x: 0, y: 1400 });
  const far = projectPoint(matrix, { x: 0, y: 1000 });
  assert.ok(Math.abs(far.x) > Math.abs(near.x));
  assert.match(projectionToCss(matrix), /^matrix\(1, 0, /);
});

[0, 30, -60, 90, 150, 180].forEach((rotation) => {
  [false, true].forEach((flipX) => {
    test(`composition à ${rotation}° (miroir ${flipX}) : projection appliquée après miroir et rotation`, () => {
      const subject = make('a', { rotation, flipX });
      const plan = getShadowPlan(subject, FLOOR_Y, settings({ direction: 300 }));
      const geometry = getSubjectGeometry(subject, FLOOR_Y);
      const { box } = geometry;
      const imageHead = {
        x: box.left + subject.headAnchor.x * box.width,
        y: box.top + subject.headAnchor.y * box.height,
      };
      const transformed = applyStepsToPoint(plan.transformSteps, imageHead);
      close(transformed.x, geometry.head.x);
      close(transformed.y, geometry.head.y);

      const shadow = projectPoint(plan.projection, transformed);
      const ky = -plan.projection.d;
      const kx = -plan.projection.c;
      close(shadow.x, geometry.head.x + (geometry.anchor.y - geometry.head.y) * kx);
      close(shadow.y, geometry.anchor.y + (geometry.anchor.y - geometry.head.y) * ky);
      assert.equal(plan.clipY, geometry.anchor.y);
    });
  });
});

test('la direction lumineuse reste fixe : rotation et miroir ne modifient pas la projection', () => {
  const reference = getShadowPlan(make('a'), FLOOR_Y, settings({ direction: 210 })).projection;
  [{ rotation: 45 }, { rotation: -120 }, { flipX: true }, { rotation: 30, flipX: true }].forEach((change) => {
    const plan = getShadowPlan(make('a', change), FLOOR_Y, settings({ direction: 210 }));
    const asReference = getProjection({ lineY: plan.clipY, direction: 210, reach: getShadowStyle(settings({ direction: 210 })).reach });
    ['a', 'b', 'c', 'd'].forEach((key) => close(plan.projection[key], reference[key]));
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((key) => close(plan.projection[key], asReference[key]));
  });
});

test('la rotation modifie la forme de l\'ombre mais pas sa direction', () => {
  const upright = headShadow(make('a'), 300);
  const turned = headShadow(make('a', { rotation: 40 }), 300);
  assert.notEqual(Math.round(upright.shadow.x), Math.round(turned.shadow.x));
  ['a', 'b', 'c', 'd'].forEach((key) => close(upright.matrix[key], turned.matrix[key]));
});

test('déplacement et échelle : l\'ombre suit le sujet et grandit avec lui', () => {
  const base = getShadowPlan(make('a'), FLOOR_Y, settings());
  const moved = getShadowPlan(make('a', { x: 1300, y: 40 }), FLOOR_Y, settings());
  close(moved.contact.cx - base.contact.cx, 300);
  close(moved.clipY - base.clipY, -40);
  const bigger = getShadowPlan(make('a', { scale: 2 }), FLOOR_Y, settings());
  assert.ok(bigger.contact.rx > base.contact.rx * 1.9);
  const head = (subject, plan) => {
    const geometry = getSubjectGeometry(subject, FLOOR_Y);
    return projectPoint(plan.projection, geometry.head);
  };
  const big = make('a', { scale: 2 });
  const smallShadow = head(make('a'), base);
  const bigShadow = head(big, bigger);
  assert.ok(Math.abs(bigShadow.x - bigger.contact.cx) > Math.abs(smallShadow.x - base.contact.cx));
});

test('ombre de contact : centrée sous les pieds, aplatie, identique à toute rotation', () => {
  const upright = getShadowPlan(make('a'), FLOOR_Y, settings());
  const turned = getShadowPlan(make('a', { rotation: 70, flipX: true }), FLOOR_Y, settings());
  const geometry = getSubjectGeometry(make('a'), FLOOR_Y);
  assert.ok(upright.contact.ry < upright.contact.rx * 0.3);
  close(upright.contact.cy, geometry.anchor.y);
  assert.ok(Math.abs(upright.contact.cx - geometry.anchor.x) < upright.contact.rx);
  close(turned.contact.cy, getSubjectGeometry(make('a', { rotation: 70, flipX: true }), FLOOR_Y).anchor.y);
});

test('plans : rien si désactivé, sujet masqué ignoré, ordre par calque', () => {
  assert.equal(getShadowPlan(make('a'), FLOOR_Y, settings({ enabled: false })), null);
  assert.equal(getShadowPlan(make('a', { visible: false }), FLOOR_Y, settings()), null);
  assert.equal(getShadowPlans([make('a')], FLOOR_Y, settings({ enabled: false })), null);
  assert.equal(getShadowPlans([], FLOOR_Y, settings()), null);
  const plans = getShadowPlans(
    [make('front', { zIndex: 3 }), make('hidden', { zIndex: 2, visible: false }), make('back', { zIndex: 1 })],
    FLOOR_Y,
    settings(),
  );
  assert.deepEqual(plans.items.map((item) => item.id), ['back', 'front']);
  assert.ok(plans.style.castOpacity > 0);
});

test('mode silhouette : l\'ombre est conservée et n\'emprunte pas la couleur de silhouette', () => {
  const subject = make('a', { silhouette: true, silhouetteColor: '#ef4444', silhouetteOpacity: 0.3 });
  const plan = getShadowPlan(subject, FLOOR_Y, settings());
  assert.ok(plan);
  assert.equal(JSON.stringify(plan).includes('ef4444'), false);
});

test('fondu : la pointe de l\'ombre est plus transparente que le pied', () => {
  const plan = getShadowPlan(make('a'), FLOOR_Y, settings());
  assert.ok(plan.fade.tipAlpha > 0 && plan.fade.tipAlpha < 1);
  assert.ok(plan.fade.ground >= plan.fade.top);
});

test('CSS du sprite : translation seule à 0°, rotation et miroir sinon', () => {
  const flat = getSpriteTransformCss(getShadowPlan(make('a'), FLOOR_Y, settings()));
  assert.match(flat, /^translate\(/);
  assert.equal(flat.includes('rotate'), false);
  const turned = getSpriteTransformCss(getShadowPlan(make('a', { rotation: 30, flipX: true }), FLOOR_Y, settings()));
  assert.match(turned, /rotate\(30deg\)/);
  assert.match(turned, /scale\(-1/);
});

test('export : la couche d\'ombres se place entre le mannequin et les sujets', () => {
  const subjects = [make('a'), make('b', { zIndex: 2 })];
  const shadows = getShadowPlans(subjects, FLOOR_Y, settings());
  const kinds = getExportLayers({
    subjects,
    mannequin: { path: '' },
    shadows,
    measures: [{}],
    annotations: [{}],
    background: { color: '#fff', image: null },
  }).map((layer) => layer.kind);
  assert.deepEqual(kinds, ['background', 'grid', 'mannequin', 'shadows', 'subject', 'subject', 'measures', 'annotations']);
  const without = getExportLayers({ subjects, background: { color: '#fff', image: null } }).map((layer) => layer.kind);
  assert.equal(without.includes('shadows'), false);
});

const stateWith = (shadows) => ({
  canvasW: 2800,
  canvasH: 2200,
  unit: 'cm',
  subjects: [{ ...make('a'), blob: undefined }],
  board: { showGrid: true, background: { color: '#f2f2f4', image: null } },
  annotations: { enabled: true, scope: 'all' },
  ...(shadows !== undefined && { shadows }),
  mannequin: { visible: true, heightCm: 180, x: null },
  measure: { items: [] },
});

const fetchBlob = async (url) => new Blob([url], { type: 'image/png' });
const restoreOptions = { createUrl: () => 'blob:r', revokeUrl: () => {} };

test('persistance : aller-retour des réglages, y compris désactivés et personnalisés', async () => {
  const custom = { enabled: false, preset: 'custom', direction: 123.5, intensity: 77, length: 12, softness: 3 };
  const saved = await serializeSession(stateWith(custom), { fetchBlob });
  assert.equal(saved.ok, true);
  const restored = await restoreSession({ schemaVersion: 1, data: saved.data }, restoreOptions);
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.state.shadows, custom);
});

test('persistance : ancienne session sans réglages restaurée avec les ombres désactivées', async () => {
  const saved = await serializeSession(stateWith(undefined), { fetchBlob });
  assert.equal(saved.ok, true);
  assert.equal('shadows' in saved.data, false);
  const restored = await restoreSession({ schemaVersion: 1, data: saved.data }, restoreOptions);
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.state.shadows, LEGACY_SHADOWS);
  assert.equal(restored.state.shadows.enabled, false);
});

test('persistance : valeurs hors limites normalisées, structure invalide refusée', async () => {
  const saved = await serializeSession(
    stateWith({ enabled: true, preset: 'custom', direction: 400, intensity: 250, length: -5, softness: 50 }),
    { fetchBlob },
  );
  const restored = await restoreSession({ schemaVersion: 1, data: saved.data }, restoreOptions);
  assert.equal(restored.state.shadows.direction, 40);
  assert.equal(restored.state.shadows.intensity, 100);
  assert.equal(restored.state.shadows.length, 0);
  const broken = await restoreSession({ schemaVersion: 1, data: { ...saved.data, shadows: 'nope' } }, restoreOptions);
  assert.equal(broken.ok, false);
});

test('nouvelle planche : ombres activées en Naturel', () => {
  const blank = createBlankState();
  assert.deepEqual(blank.shadows, DEFAULT_SHADOWS);
  assert.equal(blank.shadows.preset, 'natural');
});
