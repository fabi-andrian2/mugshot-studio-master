import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSubjectVisible,
  getExportableSubjects,
} from '../src/domain/appearance.js';
import { DEFAULT_SECTIONS, toggleSection } from '../src/domain/panels.js';
import { DEFAULT_ANNOTATIONS, getAnnotationItems } from '../src/domain/annotations.js';
import { arrangeSubjects } from '../src/domain/layout.js';
import {
  areSubjectListsEqual,
  renameSubject,
  toggleVisibility,
  reorderSubject,
  getLayerEntries,
  getSelectionLabel,
} from '../src/domain/subjects.js';
import { getSubjectGeometry, getSubjectHeightCm, getScaleForHeightCm } from '../src/domain/geometry.js';

const FLOOR_Y = 1000;
const CANVAS_W = 2000;

const make = (id, name, overrides = {}) => ({
  id,
  url: `blob:${id}`,
  fileName: `${id}.png`,
  name,
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

test('annotations désactivées par défaut', () => {
  assert.equal(DEFAULT_ANNOTATIONS.enabled, false);
  assert.equal(DEFAULT_ANNOTATIONS.scope, 'selected');
});

test('sections : valeurs par défaut et bascule sans muter', () => {
  assert.equal(DEFAULT_SECTIONS.measure, true);
  assert.equal(DEFAULT_SECTIONS.help, false);
  const next = toggleSection(DEFAULT_SECTIONS, 'measure');
  assert.equal(next.measure, false);
  assert.equal(DEFAULT_SECTIONS.measure, true);
});

test('visibilité : un sujet sans champ visible est visible', () => {
  const legacy = make('a', 'A');
  delete legacy.visible;
  assert.equal(isSubjectVisible(legacy), true);
});

test('visibilité : masquer est non destructif', () => {
  const subject = make('a', 'John');
  const hidden = toggleVisibility(subject);
  assert.equal(isSubjectVisible(hidden), false);
  assert.deepEqual({ ...hidden, visible: true }, subject);
  assert.deepEqual(toggleVisibility(hidden), subject);
});

test('visibilité : visible dans l\'historique (égalité des listes)', () => {
  const list = [make('a', 'A')];
  const hidden = [toggleVisibility(list[0])];
  assert.equal(areSubjectListsEqual(list, hidden), false);
  assert.equal(areSubjectListsEqual(list, [toggleVisibility(hidden[0])]), true);
});

test('visibilité : un sujet masqué reste dans les calques mais pas dans l\'export', () => {
  const list = [make('a', 'A', { zIndex: 1 }), toggleVisibility(make('b', 'B', { zIndex: 2 }))];
  const entries = getLayerEntries(list);
  assert.equal(entries.length, 2);
  assert.equal(entries.find((e) => e.id === 'b').visible, false);
  assert.deepEqual(getExportableSubjects(list).map((s) => s.id), ['a']);
});

test('visibilité : un sujet masqué n\'a pas d\'annotation', () => {
  const list = [make('a', 'A'), toggleVisibility(make('b', 'B', { zIndex: 2 }))];
  const items = getAnnotationItems({
    subjects: list,
    selectedId: 'b',
    annotations: { enabled: true, scope: 'all' },
    floorY: FLOOR_Y,
    unit: 'cm',
  });
  assert.deepEqual(items.map((i) => i.id), ['a']);
});

test('annotations OFF : aucune annotation', () => {
  const items = getAnnotationItems({
    subjects: [make('a', 'A')],
    selectedId: 'a',
    annotations: DEFAULT_ANNOTATIONS,
    floorY: FLOOR_Y,
    unit: 'cm',
  });
  assert.equal(items.length, 0);
});

test('Réorganiser conserve les sujets masqués dans la composition', () => {
  const hidden = toggleVisibility(
    make('h', 'H', { x: 100, zIndex: 3 }),
  );

  const list = [
    make('a', 'A', { x: 300 }),
    make('b', 'B', { x: 900, zIndex: 2 }),
    hidden,
  ];

  const result = arrangeSubjects(list, 'space', {
    canvasW: CANVAS_W,
    floorY: FLOOR_Y,
  });

  assert.equal(result.subjects.length, list.length);

  const after = result.subjects.find((s) => s.id === 'h');

  assert.ok(after, 'Le sujet masqué doit rester dans le document');
  assert.equal(
    isSubjectVisible(after),
    false,
    'La réorganisation ne doit pas réafficher le sujet masqué',
  );

  assert.notEqual(
    after.x,
    100,
    'La commande Réorganiser conserve le comportement de disposition existant',
  );

  assert.notEqual(
    result.subjects.find((s) => s.id === 'a').x,
    300,
  );
});

test('silhouette : effet purement visuel', () => {
  const subject = make('a', 'A');
  const silhouette = { ...subject, silhouette: true };
  assert.deepEqual(getSubjectGeometry(subject, FLOOR_Y), getSubjectGeometry(silhouette, FLOOR_Y));
  close(getSubjectHeightCm(subject), getSubjectHeightCm(silhouette));
  assert.equal(silhouette.groundAnchor, subject.groundAnchor);
  assert.equal(silhouette.headAnchor, subject.headAnchor);
});

test('renommage : name change, fileName intact, utilisé partout', () => {
  const subject = make('a', 'Ancien');
  const renamed = renameSubject(subject, '  John Doe  ');
  assert.equal(renamed.name, 'John Doe');
  assert.equal(renamed.fileName, subject.fileName);

  const label = getSelectionLabel(renamed, 'cm');
  assert.ok(label.startsWith('John Doe'));
  assert.ok(label.includes('180'));

  assert.equal(getLayerEntries([renamed])[0].label, 'John Doe');

  const [item] = getAnnotationItems({
    subjects: [renamed],
    selectedId: 'a',
    annotations: { enabled: true, scope: 'selected' },
    floorY: FLOOR_Y,
    unit: 'cm',
  });
  assert.ok(item.text.startsWith('JOHN DOE'));
});

test('renommage : vide ignoré, 60 caractères maximum', () => {
  const subject = make('a', 'Nom');
  assert.equal(renameSubject(subject, '   ').name, 'Nom');
  assert.equal(renameSubject(subject, 'x'.repeat(100)).name.length, 60);
});

test('sélection vide : étiquette vide', () => {
  assert.equal(getSelectionLabel(undefined, 'cm'), '');
});

test('ordre : avancer, reculer, premier plan, arrière-plan', () => {
  const list = [make('a', 'A', { zIndex: 1 }), make('b', 'B', { zIndex: 2 }), make('c', 'C', { zIndex: 3 })];
  const order = (subjects) =>
    [...subjects].sort((x, y) => x.zIndex - y.zIndex).map((s) => s.id).join('');

  assert.equal(order(reorderSubject(list, 'a', 'forward')), 'bac');
  assert.equal(order(reorderSubject(list, 'c', 'backward')), 'acb');
  assert.equal(order(reorderSubject(list, 'a', 'front')), 'bca');
  assert.equal(order(reorderSubject(list, 'c', 'back')), 'cab');
});

test('ordre : zIndex de 1 à n, bords inchangés, sujet masqué conserve sa place', () => {
  const list = [
    make('a', 'A', { zIndex: 5 }),
    toggleVisibility(make('b', 'B', { zIndex: 9 })),
  ];
  const result = reorderSubject(list, 'b', 'forward');
  assert.deepEqual(result.map((s) => s.zIndex).sort(), [1, 2]);
  assert.equal(result.find((s) => s.id === 'b').visible, false);
  assert.equal(areSubjectListsEqual(reorderSubject(result, 'b', 'front'), result), true);
});

test('hauteur 150 → 180 → 200 : repères intacts', () => {
  const base = make('a', 'A');
  [150, 180, 200].forEach((cm) => {
    const next = { ...base, scale: getScaleForHeightCm(base, cm) };
    close(getSubjectHeightCm(next), cm);
    assert.equal(next.groundAnchor, base.groundAnchor);
    assert.equal(next.headAnchor, base.headAnchor);
  });
});