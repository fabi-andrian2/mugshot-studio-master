import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_MEASURE_SELECTION,
  selectMeasure,
  clearMeasureSelection,
  pruneMeasureSelection,
  isMeasureSelected,
} from '../src/domain/measureSelection.js';
import {
  addMeasure,
  clearMeasures,
  removeMeasures,
  shiftMeasures,
  getMeasureEntries,
  getMeasureExportItems,
} from '../src/domain/measure.js';
import {
  createDocumentState,
  areDocumentStatesEqual,
  liftSubjects,
  liftMeasureItems,
  liftMeasureOperation,
} from '../src/domain/documentHistory.js';
import { areSubjectListsEqual } from '../src/domain/subjects.js';
import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';
import { serializeSession } from '../src/services/sessionSnapshot.js';

const OPTIONS = { isEqual: areDocumentStatesEqual, limit: 50, mergeWindowMs: 0 };

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

const item = (id, x1, y1, x2, y2) => ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });

const ITEMS = [item(1, 0, 100, 800, 100), item(2, 50, 0, 50, 400), item(3, 0, 0, 300, 400)];

const deepFreeze = (value) => {
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') deepFreeze(child);
  });
  return Object.freeze(value);
};

const applyDoc = (state, updater) =>
  historyReducer(state, { type: 'apply', updater, mergeKey: null, time: 0, ...OPTIONS });
const patchDoc = (state, fn) => historyReducer(state, { type: 'patchAll', fn });
const undo = (state) => historyReducer(state, { type: 'undo' });
const redo = (state) => historyReducer(state, { type: 'redo' });

const deleteMeasures = (state, ids) =>
  applyDoc(state, liftMeasureItems(liftMeasureOperation((measure) => removeMeasures(measure, ids))));
const clearAll = (state) => applyDoc(state, liftMeasureItems(liftMeasureOperation(clearMeasures)));
const addTo = (state, start, end) =>
  patchDoc(state, liftMeasureItems(liftMeasureOperation((measure) => addMeasure(measure, start, end))));

const makeDocument = (subjects = [make('a'), make('b', { zIndex: 2 })], items = ITEMS) =>
  createHistoryState(createDocumentState(subjects, items));

const ids = (list) => list.map((entry) => entry.id);

test('sélection de mesures : un clic sélectionne une seule mesure et remplace la précédente', () => {
  let selection = selectMeasure(EMPTY_MEASURE_SELECTION, 2);
  assert.deepEqual(selection, [2]);
  assert.ok(isMeasureSelected(selection, 2));
  assert.ok(!isMeasureSelected(selection, 1));

  selection = selectMeasure(selection, 3);
  assert.deepEqual(selection, [3]);
  assert.equal(selectMeasure(selection, 3), selection);
});

test('sélection de mesures : Ctrl ou Cmd-clic ajoute puis retire une mesure', () => {
  let selection = selectMeasure(EMPTY_MEASURE_SELECTION, 1);
  selection = selectMeasure(selection, 3, true);
  assert.deepEqual(selection, [1, 3]);

  selection = selectMeasure(selection, 2, true);
  assert.deepEqual(selection, [1, 3, 2]);

  selection = selectMeasure(selection, 3, true);
  assert.deepEqual(selection, [1, 2]);

  selection = selectMeasure(selection, 1, true);
  selection = selectMeasure(selection, 2, true);
  assert.deepEqual(selection, []);
});

test('sélection de mesures : un clic simple après une multi-sélection la remplace', () => {
  const multiple = selectMeasure(selectMeasure(EMPTY_MEASURE_SELECTION, 1), 2, true);
  assert.deepEqual(selectMeasure(multiple, 3), [3]);
  assert.deepEqual(selectMeasure(multiple, 1), [1]);
});

test('sélection de mesures : désélection et nettoyage des identifiants disparus', () => {
  const selection = [1, 2];
  assert.equal(clearMeasureSelection(selection), EMPTY_MEASURE_SELECTION);
  assert.equal(clearMeasureSelection(EMPTY_MEASURE_SELECTION), EMPTY_MEASURE_SELECTION);

  assert.equal(pruneMeasureSelection(selection, ITEMS), selection);
  assert.deepEqual(pruneMeasureSelection([1, 9], ITEMS), [1]);
  assert.equal(pruneMeasureSelection([9], ITEMS), EMPTY_MEASURE_SELECTION);
  assert.equal(pruneMeasureSelection(selection, []), EMPTY_MEASURE_SELECTION);
  assert.equal(pruneMeasureSelection(EMPTY_MEASURE_SELECTION, ITEMS), EMPTY_MEASURE_SELECTION);
});

test('sélection de mesures : les fonctions ne modifient pas leurs entrées', () => {
  const selection = deepFreeze([1, 2]);
  const items = deepFreeze(ITEMS.map((entry) => ({ ...entry })));
  selectMeasure(selection, 3, true);
  selectMeasure(selection, 1, true);
  selectMeasure(selection, 3);
  pruneMeasureSelection(selection, items);
  clearMeasureSelection(selection);
  assert.deepEqual(selection, [1, 2]);
});

test('suppression : une seule mesure, les autres gardent leur géométrie et leur libellé', () => {
  const measure = deepFreeze({ active: false, items: ITEMS.map((entry) => ({ ...entry })) });
  const next = removeMeasures(measure, [2]);

  assert.deepEqual(ids(next.items), [1, 3]);
  assert.equal(next.items[0], measure.items[0]);
  assert.equal(next.items[1], measure.items[2]);
  assert.deepEqual(
    getMeasureEntries(next, 'cm'),
    getMeasureEntries(measure, 'cm').filter((entry) => entry.id !== 2),
  );
  assert.equal(measure.items.length, 3);
});

test('suppression : plusieurs mesures en une seule opération', () => {
  const measure = { active: false, items: ITEMS };
  assert.deepEqual(ids(removeMeasures(measure, [1, 3]).items), [2]);
  assert.deepEqual(ids(removeMeasures(measure, [3, 2, 1]).items), []);
});

test('suppression : identifiants inconnus ou liste vide ne changent rien', () => {
  const measure = { active: true, items: ITEMS };
  assert.equal(removeMeasures(measure, []), measure);
  assert.equal(removeMeasures(measure, [42]), measure);
  assert.equal(removeMeasures({ active: false, items: [] }, [1]).items.length, 0);
  assert.equal(removeMeasures(measure, [2]).active, true);
});

test('suppression de toutes les mesures : commande conservée', () => {
  const measure = { active: true, items: ITEMS };
  const cleared = clearMeasures(measure);
  assert.deepEqual(cleared.items, []);
  assert.equal(cleared.active, true);
  assert.equal(clearMeasures(cleared), cleared);
});

test('historique : supprimer une mesure puis annuler la restaure exactement, rétablir la supprime', () => {
  const start = makeDocument();
  const deleted = deleteMeasures(start, [2]);

  assert.deepEqual(ids(deleted.present.measureItems), [1, 3]);
  assert.equal(deleted.past.length, 1);

  const undone = undo(deleted);
  assert.deepEqual(undone.present.measureItems, ITEMS);
  assert.equal(undone.present.measureItems, start.present.measureItems);

  const redone = redo(undone);
  assert.deepEqual(ids(redone.present.measureItems), [1, 3]);
});

test('historique : une suppression multiple est une seule opération annulable', () => {
  const start = makeDocument();
  const deleted = deleteMeasures(start, [1, 3]);

  assert.deepEqual(ids(deleted.present.measureItems), [2]);
  assert.equal(deleted.past.length, 1);

  const undone = undo(deleted);
  assert.deepEqual(undone.present.measureItems, ITEMS);
  assert.equal(undone.past.length, 0);

  assert.deepEqual(ids(redo(undone).present.measureItems), [2]);
});

test('historique : « supprimer toutes les mesures » est annulable et rétablissable', () => {
  const start = makeDocument();
  const cleared = clearAll(start);
  assert.deepEqual(cleared.present.measureItems, []);
  assert.deepEqual(undo(cleared).present.measureItems, ITEMS);
  assert.deepEqual(redo(undo(cleared)).present.measureItems, []);
});

test('historique : supprimer des mesures ne touche jamais aux sujets', () => {
  const subjects = deepFreeze([make('a'), make('b', { zIndex: 2 })]);
  const start = makeDocument(subjects);

  const deleted = deleteMeasures(start, [1, 2, 3]);
  assert.equal(deleted.present.subjects, subjects);
  assert.equal(undo(deleted).present.subjects, subjects);

  const cleared = clearAll(start);
  assert.equal(cleared.present.subjects, subjects);
  assert.equal(undo(cleared).present.subjects, subjects);
});

test('historique : annuler une action sur un sujet ne modifie pas les mesures', () => {
  const start = makeDocument();
  const moved = applyDoc(start, liftSubjects((list) => list.map((s) => (s.id === 'a' ? { ...s, x: 5 } : s))));
  assert.equal(moved.present.measureItems, ITEMS);

  const undone = undo(moved);
  assert.equal(undone.present.measureItems, ITEMS);
  assert.equal(undone.present.subjects[0].x, 700);
});

test('historique : une suppression sans effet ne crée pas d\'entrée', () => {
  const start = makeDocument();
  assert.equal(deleteMeasures(start, [42]).past.length, 0);
  assert.equal(deleteMeasures(start, []).past.length, 0);
  assert.equal(clearAll(makeDocument(undefined, [])).past.length, 0);
});

test('historique : Annuler puis rétablir plusieurs suppressions successives dans l\'ordre', () => {
  let state = makeDocument();
  state = deleteMeasures(state, [1]);
  state = deleteMeasures(state, [2, 3]);
  assert.deepEqual(state.present.measureItems, []);

  state = undo(state);
  assert.deepEqual(ids(state.present.measureItems), [2, 3]);
  state = undo(state);
  assert.deepEqual(state.present.measureItems, ITEMS);
  state = redo(state);
  assert.deepEqual(ids(state.present.measureItems), [2, 3]);
});

test('historique : l\'ajout d\'une mesure reste hors historique et survit aux annulations', () => {
  const start = makeDocument(undefined, []);
  const moved = applyDoc(start, liftSubjects((list) => list.map((s) => ({ ...s, x: 5 }))));
  const added = addTo(moved, { x: 0, y: 0 }, { x: 80, y: 0 });

  assert.equal(added.past.length, moved.past.length);
  assert.equal(added.present.measureItems.length, 1);

  const undone = undo(added);
  assert.equal(undone.present.subjects[0].x, 700);
  assert.equal(undone.present.measureItems.length, 1);
});

test('historique : supprimer puis ajouter une mesure, annuler la suppression garde les deux', () => {
  let state = makeDocument();
  state = deleteMeasures(state, [3]);
  state = addTo(state, { x: 10, y: 10 }, { x: 90, y: 10 });
  assert.equal(state.present.measureItems.length, 3);

  const undone = undo(state);
  assert.equal(undone.present.measureItems.length, 4);
  assert.equal(new Set(ids(undone.present.measureItems)).size, 4);
});

test('historique : le décalage dû au changement de format reste cohérent après annulation', () => {
  let state = makeDocument();
  state = deleteMeasures(state, [1]);
  state = patchDoc(state, liftMeasureItems(liftMeasureOperation((measure) => shiftMeasures(measure, 400))));

  assert.equal(state.present.measureItems[0].start.y, 400);
  const undone = undo(state);
  const restored = undone.present.measureItems.find((entry) => entry.id === 1);
  assert.equal(restored.start.y, 500);
  assert.equal(undone.present.measureItems.find((entry) => entry.id === 2).start.y, 400);
});

test('état du document : comparaison des sujets et des mesures', () => {
  const subjects = [make('a')];
  const a = createDocumentState(subjects, ITEMS);

  assert.ok(areDocumentStatesEqual(a, a));
  assert.ok(areDocumentStatesEqual(a, createDocumentState([subjects[0]], ITEMS)));
  assert.ok(!areDocumentStatesEqual(a, createDocumentState(subjects, [...ITEMS])));
  assert.ok(!areDocumentStatesEqual(a, createDocumentState([make('a', { x: 1 })], ITEMS)));
  assert.ok(areSubjectListsEqual(a.subjects, subjects));
});

test('état du document : les mises à jour de sujets et de mesures conservent l\'autre partie', () => {
  const state = createDocumentState([make('a')], ITEMS);
  assert.equal(liftSubjects((list) => list)(state), state);
  assert.equal(liftMeasureItems((items) => items)(state), state);

  const withSubject = liftSubjects((list) => [...list, make('b')])(state);
  assert.equal(withSubject.measureItems, ITEMS);
  const withMeasures = liftMeasureItems(() => [])(state);
  assert.equal(withMeasures.subjects, state.subjects);
});

test('autosauvegarde : la sélection de mesures n\'est jamais écrite dans la session', async () => {
  const state = {
    canvasW: 1400,
    canvasH: 2200,
    unit: 'cm',
    subjects: [],
    board: { showGrid: true, background: { color: '#ffffff', image: null } },
    annotations: { enabled: false, scope: 'selected' },
    mannequin: { visible: false, heightCm: 175, x: null },
    measure: { active: false, items: ITEMS },
    selectedMeasureIds: [1, 2],
    selectedId: null,
  };

  const result = await serializeSession(state, { fetchBlob: async () => new Blob(['x']) });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.measure.items, ITEMS);
  assert.ok(!JSON.stringify(result.data).includes('selectedMeasureIds'));
  assert.deepEqual(Object.keys(result.data.measure), ['items']);
});

test('export : la sélection n\'apparaît pas et les mesures restantes gardent leurs coordonnées', () => {
  const before = getMeasureExportItems({ active: false, items: ITEMS }, 'cm');
  const after = getMeasureExportItems(removeMeasures({ active: false, items: ITEMS }, [2]), 'cm');

  assert.deepEqual(after, before.filter((entry) => entry.id !== 2));
  after.forEach((entry) => {
    assert.ok(!('selected' in entry));
    assert.ok(!('selectedIds' in entry));
  });
});