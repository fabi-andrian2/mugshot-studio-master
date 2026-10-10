import test from 'node:test';
import assert from 'node:assert/strict';

import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';
import { areSubjectListsEqual, getLayerEntries } from '../src/domain/subjects.js';
import { updateSilhouette } from '../src/domain/appearance.js';
import { getSubjectGeometry, getSubjectHeightCm } from '../src/domain/geometry.js';
import { getExportLayers } from '../src/domain/exportPlan.js';
import { DEFAULT_BACKGROUND, DEFAULT_BOARD, toggleGrid } from '../src/domain/board.js';
import {
  DEFAULT_MANNEQUIN,
  toggleMannequin,
  setMannequinHeight,
  getMannequinGeometry,
} from '../src/domain/mannequin.js';
import {
  DEFAULT_MEASURE,
  toggleMeasureMode,
  addMeasure,
  clearMeasures,
  shiftMeasures,
  getDistancePx,
} from '../src/domain/measure.js';

const FLOOR_Y = 1800;
const OPTIONS = { isEqual: areSubjectListsEqual, limit: 50, mergeWindowMs: 500 };

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
  silhouette: true,
  naturalW: 500,
  naturalH: 1000,
  visibleBounds: { left: 0.1, top: 0.05, right: 0.9, bottom: 0.95 },
  groundAnchor: { x: 0.5, y: 0.9 },
  headAnchor: { x: 0.5, y: 0.1 },
  ...overrides,
});

const deepFreeze = (value) => {
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') deepFreeze(child);
  });
  return Object.freeze(value);
};

const close = (a, b, eps = 0.001) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

const apply = (state, updater, mergeKey = null, time = 0) =>
  historyReducer(state, { type: 'apply', updater, mergeKey, time, ...OPTIONS });
const set = (state, updater) => historyReducer(state, { type: 'set', updater });
const commit = (state, time = 0) =>
  historyReducer(state, { type: 'commit', mergeKey: null, time, ...OPTIONS });
const rollback = (state) => historyReducer(state, { type: 'rollback' });
const undo = (state) => historyReducer(state, { type: 'undo' });
const redo = (state) => historyReducer(state, { type: 'redo' });

const mapSubject = (id, fn) => (list) => list.map((s) => (s.id === id ? fn(s) : s));

test('intégrité : un changement de couleur de silhouette = une entrée, annulable et rétablissable', () => {
  const s0 = createHistoryState([make('a')]);
  const s1 = apply(s0, mapSubject('a', (s) => updateSilhouette(s, { color: '#ef4444' })));

  assert.equal(s1.past.length, 1);
  assert.equal(s1.present[0].silhouetteColor, '#ef4444');

  const s2 = undo(s1);
  assert.deepEqual(s2.present, s0.present);
  assert.equal(s2.future.length, 1);

  const s3 = redo(s2);
  assert.equal(s3.present[0].silhouetteColor, '#ef4444');
  assert.deepEqual(undo(undo(s0)).present, s0.present);
});

test('intégrité : un glissement continu d\'opacité est fusionné, un geste ultérieur est séparé', () => {
  const key = 'silhouette-a';
  let state = createHistoryState([make('a')]);
  [0.9, 0.8, 0.7, 0.6, 0.5].forEach((opacity, i) => {
    state = apply(state, mapSubject('a', (s) => updateSilhouette(s, { opacity })), key, i * 100);
  });
  assert.equal(state.past.length, 1);
  assert.equal(state.present[0].silhouetteOpacity, 0.5);

  state = apply(state, mapSubject('a', (s) => updateSilhouette(s, { opacity: 0.3 })), key, 5000);
  assert.equal(state.past.length, 2);

  const once = undo(state);
  assert.equal(once.present[0].silhouetteOpacity, 0.5);
  const twice = undo(once);
  assert.equal(twice.present[0].silhouetteOpacity, undefined);
});

test('intégrité : valeur inchangée, aperçu abandonné ou aperçu validé', () => {
  let state = createHistoryState([make('a')]);
  state = apply(state, mapSubject('a', (s) => updateSilhouette(s, { color: '#ef4444' })));
  const entries = state.past.length;

  state = apply(state, mapSubject('a', (s) => updateSilhouette(s, { color: '#ef4444' })));
  assert.equal(state.past.length, entries);

  const moveTo = (x) => mapSubject('a', (s) => ({ ...s, x }));
  const preview = set(set(set(state, moveTo(800)), moveTo(900)), moveTo(1000));
  assert.equal(preview.past.length, entries);
  assert.equal(rollback(preview).present[0].x, 700);
  assert.equal(rollback(preview).past.length, entries);

  const committed = commit(preview);
  assert.equal(committed.past.length, entries + 1);
  assert.equal(committed.present[0].x, 1000);
});

test('intégrité : miroir + silhouette + undo/redo préservent hauteur, ancres, échelle et position', () => {
  const original = make('a');
  const heightCm = getSubjectHeightCm(original);

  let state = createHistoryState([original]);
  state = apply(state, mapSubject('a', (s) => ({ ...s, flipX: !s.flipX })));
  state = apply(state, mapSubject('a', (s) => updateSilhouette(s, { color: '#3b82f6', opacity: 0.4 })));

  const backToStart = undo(undo(state));
  const afterFlip = undo(state);
  const afterRedo = redo(redo(backToStart));

  assert.equal(backToStart.present[0].flipX, false);
  assert.equal(afterFlip.present[0].flipX, true);
  assert.equal(state.present[0].flipX, true);
  assert.equal(afterRedo.present[0].flipX, true);
  assert.equal(afterRedo.present[0].silhouetteColor, '#3b82f6');

  [backToStart, afterFlip, state, afterRedo].forEach((snapshot) => {
    const subject = snapshot.present[0];
    close(getSubjectHeightCm(subject), heightCm);
    assert.deepEqual(subject.groundAnchor, original.groundAnchor);
    assert.deepEqual(subject.headAnchor, original.headAnchor);
    assert.equal(subject.scale, original.scale);
    assert.equal(subject.x, original.x);
    assert.equal(subject.y, original.y);
  });
});

test('intégrité : un sujet masqué reste dans la liste, les calques et l\'historique, mais pas dans l\'export', () => {
  const initial = [make('a'), make('b', { zIndex: 2, x: 1100 })];
  const hide = mapSubject('a', (s) => ({ ...s, visible: false }));

  let state = createHistoryState(initial);
  state = apply(state, hide);

  assert.equal(state.present.length, 2);
  assert.equal(getLayerEntries(state.present).length, 2);

  const exported = getExportLayers({ subjects: state.present, background: DEFAULT_BACKGROUND })
    .filter((layer) => layer.kind === 'subject')
    .map((layer) => layer.subject.id);
  assert.deepEqual(exported, ['b']);

  assert.equal(undo(state).present[0].visible, true);
  assert.equal(redo(undo(state)).present[0].visible, false);
  assert.equal(redo(undo(state)).present.length, 2);
  assert.equal(getLayerEntries(redo(undo(state)).present).length, 2);
});

test('intégrité : mesures, mannequin, fond et export n\'ajoutent aucune entrée et ne sont pas touchés par Annuler', () => {
  const initial = deepFreeze([make('a'), make('b', { zIndex: 2, x: 1100 })]);
  let history = createHistoryState(initial);

  history = apply(history, mapSubject('a', (s) => ({ ...s, x: 900 })));
  assert.equal(history.past.length, 1);

  let measure = addMeasure(toggleMeasureMode(DEFAULT_MEASURE), { x: 100, y: 100 }, { x: 900, y: 100 });
  let mannequin = toggleMannequin(DEFAULT_MANNEQUIN);
  const board = toggleGrid(DEFAULT_BOARD);

  const layers = getExportLayers({
    subjects: history.present,
    mannequin: getMannequinGeometry(mannequin, { floorY: FLOOR_Y, unit: 'cm' }),
    background: board.background,
    measures: measure.items,
  });
  assert.equal(layers.filter((layer) => layer.kind === 'subject').length, 2);

  measure = clearMeasures(measure);
  mannequin = setMannequinHeight(mannequin, 190);

  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 0);

  const undone = undo(history);
  assert.equal(undone.present[0].x, 700);
  assert.equal(measure.items.length, 0);
  assert.equal(measure.active, true);
  assert.equal(mannequin.heightCm, 190);
  assert.equal(mannequin.visible, true);
  assert.equal(board.showGrid, false);
});

test('intégrité : un changement de hauteur de format garde les mesures alignées sur le sol et les sujets', () => {
  const subject = make('a');
  const before = getSubjectGeometry(subject, FLOOR_Y);

  const measure = addMeasure(
    toggleMeasureMode(DEFAULT_MEASURE),
    { x: 500, y: before.head.y },
    { x: 500, y: before.anchor.y },
  );
  const snapshot = JSON.parse(JSON.stringify(measure));

  const deltaH = 400;
  const shifted = shiftMeasures(measure, deltaH);
  const after = getSubjectGeometry(subject, FLOOR_Y + deltaH);

  close(shifted.items[0].start.y, after.head.y);
  close(shifted.items[0].end.y, after.anchor.y);
  assert.equal(shifted.items[0].start.x, 500);
  close(
    getDistancePx(shifted.items[0].start, shifted.items[0].end),
    getDistancePx(measure.items[0].start, measure.items[0].end),
  );
  assert.deepEqual(measure, snapshot);

  assert.equal(shiftMeasures(measure, 0), measure);
  assert.equal(shiftMeasures(DEFAULT_MEASURE, 400), DEFAULT_MEASURE);
  close(shiftMeasures(shifted, -deltaH).items[0].start.y, before.head.y);
});

test('intégrité : le reducer ne mute jamais ses états, même figés', () => {
  const frozen = deepFreeze(createHistoryState(deepFreeze([make('a'), make('b', { zIndex: 2 })])));

  let state = apply(frozen, mapSubject('a', (s) => updateSilhouette(s, { color: '#10b981' })), 'k', 0);
  state = apply(state, mapSubject('a', (s) => updateSilhouette(s, { opacity: 0.5 })), 'k', 100);
  state = set(state, mapSubject('b', (s) => ({ ...s, x: 5 })));
  state = rollback(state);
  state = apply(state, mapSubject('b', (s) => ({ ...s, visible: false })));
  state = undo(undo(state));
  state = redo(state);
  state = commit(state);

  assert.equal(historyReducer(state, { type: 'patchAll', fn: (list) => list }), state);
  assert.equal(frozen.past.length, 0);
  assert.equal(frozen.present[0].silhouetteColor, undefined);
});