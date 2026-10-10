import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SILHOUETTE_COLOR,
  DEFAULT_SILHOUETTE_OPACITY,
  MIN_SILHOUETTE_OPACITY,
  SILHOUETTE_PRESETS,
  getSilhouetteStyle,
  updateSilhouette,
} from '../src/domain/appearance.js';
import { isValidColor } from '../src/domain/board.js';
import { areSubjectListsEqual } from '../src/domain/subjects.js';
import { getSubjectGeometry, getSubjectHeightCm } from '../src/domain/geometry.js';

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
  silhouette: true,
  naturalW: 500,
  naturalH: 1000,
  visibleBounds: { left: 0.1, top: 0.05, right: 0.9, bottom: 0.95 },
  groundAnchor: { x: 0.5, y: 0.9 },
  headAnchor: { x: 0.5, y: 0.1 },
  ...overrides,
});

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('silhouette : réglages par défaut anthracite et opaque', () => {
  assert.deepEqual(getSilhouetteStyle(make('a')), {
    color: '#2e2e2e',
    opacity: 1,
  });
  assert.equal(DEFAULT_SILHOUETTE_COLOR, '#2e2e2e');
  assert.equal(DEFAULT_SILHOUETTE_OPACITY, 1);
  assert.equal(SILHOUETTE_PRESETS[0].value, DEFAULT_SILHOUETTE_COLOR);
  assert.ok(SILHOUETTE_PRESETS.every((preset) => isValidColor(preset.value)));
});

test('silhouette : changer la couleur, ignorer une couleur invalide', () => {
  const subject = make('a');
  const updated = updateSilhouette(subject, { color: '#3B82F6' });
  assert.equal(updated.silhouetteColor, '#3b82f6');
  assert.equal(getSilhouetteStyle(updated).color, '#3b82f6');
  assert.equal(updateSilhouette(updated, { color: 'rouge' }).silhouetteColor, '#3b82f6');
});

test('silhouette : opacité bornée, valeurs invalides ignorées', () => {
  const subject = make('a');
  assert.equal(updateSilhouette(subject, { opacity: 0.5 }).silhouetteOpacity, 0.5);
  assert.equal(updateSilhouette(subject, { opacity: 0 }).silhouetteOpacity, MIN_SILHOUETTE_OPACITY);
  assert.equal(updateSilhouette(subject, { opacity: 5 }).silhouetteOpacity, 1);
  assert.equal(updateSilhouette(subject, { opacity: Number.NaN }).silhouetteOpacity, undefined);
});

test('silhouette : valeurs corrompues lues avec repli sur les défauts', () => {
  const broken = make('a', { silhouetteColor: 'x', silhouetteOpacity: 'a' });
  assert.deepEqual(getSilhouetteStyle(broken), { color: '#2e2e2e', opacity: 1 });
  assert.equal(getSilhouetteStyle(make('a', { silhouetteOpacity: 3 })).opacity, 1);
  assert.equal(getSilhouetteStyle(make('a', { silhouetteOpacity: 0.01 })).opacity, MIN_SILHOUETTE_OPACITY);
});

test('silhouette : les réglages ne modifient ni géométrie, ni ancres, ni hauteur', () => {
  const subject = make('a');
  const updated = updateSilhouette(subject, { color: '#ef4444', opacity: 0.4 });
  assert.deepEqual(getSubjectGeometry(updated, FLOOR_Y), getSubjectGeometry(subject, FLOOR_Y));
  close(getSubjectHeightCm(updated), getSubjectHeightCm(subject));
  assert.equal(updated.groundAnchor, subject.groundAnchor);
  assert.equal(updated.headAnchor, subject.headAnchor);
  assert.equal(updated.scale, subject.scale);
  assert.equal(updated.x, subject.x);
});

test('silhouette : réglages indépendants par sujet', () => {
  const a = make('a');
  const b = make('b', { x: 900 });
  const list = [a, b].map((subject) => (subject.id === 'a' ? updateSilhouette(subject, { color: '#10b981' }) : subject));
  assert.equal(getSilhouetteStyle(list[0]).color, '#10b981');
  assert.equal(list[1], b);
  assert.equal(getSilhouetteStyle(list[1]).color, DEFAULT_SILHOUETTE_COLOR);
});

test('silhouette : visible dans l\'historique seulement quand une valeur change', () => {
  const list = [make('a')];
  const changed = [updateSilhouette(list[0], { color: '#ef4444' })];
  assert.equal(areSubjectListsEqual(list, changed), false);

  const same = [updateSilhouette(changed[0], { color: '#ef4444' })];
  assert.equal(areSubjectListsEqual(changed, same), true);
});