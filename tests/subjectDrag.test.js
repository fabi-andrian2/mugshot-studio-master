import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_SUBJECT_SELECTION,
  selectSubject,
  deselectSubject,
  removeSubjectsById,
  pruneSubjectSelection,
  getSingleSelectedId,
  getDragIds,
  getSelectionCountLabel,
} from '../src/domain/subjectSelection.js';
import {
  getPointerDelta,
  captureDragOrigins,
  resolveDragDelta,
  translateSubjects,
} from '../src/domain/subjectDrag.js';
import { SNAP_Y } from '../src/domain/constants.js';
import {
  createDocumentState,
  areDocumentStatesEqual,
  liftSubjects,
} from '../src/domain/documentHistory.js';
import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';
import { getSubjectGeometry } from '../src/domain/geometry.js';

const CANVAS_W = 1400;
const FLOOR_Y = 2000;
const OPTIONS = { isEqual: areDocumentStatesEqual, limit: 50, mergeWindowMs: 500 };
const DRAG_OPTIONS = { canvasW: CANVAS_W, snapY: SNAP_Y };

const make = (id, overrides = {}) => ({
  id,
  url: `blob:${id}`,
  fileName: `${id}.png`,
  name: id,
  x: 700,
  y: 0,
  scale: 1.4,
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

const trio = () => [
  make('a', { x: 300, y: 0, scale: 1.2, zIndex: 1 }),
  make('b', { x: 650.5, y: 12.25, scale: 1.6, flipX: true, zIndex: 2 }),
  make('c', { x: 1000, y: -40, scale: 0.9, zIndex: 3 }),
];

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

const move = (subjects, ids, delta, leadId = ids[0]) => {
  const origins = captureDragOrigins(subjects, ids);
  const resolved = resolveDragDelta(origins, leadId, delta, DRAG_OPTIONS);
  return { origins, resolved, next: translateSubjects(subjects, origins, resolved) };
};

const legacyDrag = (initX, initY, dx, dy) => {
  let nx = initX + dx;
  let ny = initY + dy;
  if (Math.abs(ny) < SNAP_Y) ny = 0;
  nx = Math.max(-CANVAS_W, Math.min(nx, CANVAS_W * 2));
  return { x: nx, y: ny };
};

test('sélection : clic simple remplace, Ctrl/Cmd-clic ajoute ou retire', () => {
  let selection = EMPTY_SUBJECT_SELECTION;
  selection = selectSubject(selection, 'a');
  assert.deepEqual(selection, ['a']);
  assert.equal(selectSubject(selection, 'a'), selection);
  selection = selectSubject(selection, 'b', true);
  assert.deepEqual(selection, ['a', 'b']);
  selection = selectSubject(selection, 'c', true);
  assert.deepEqual(selection, ['a', 'b', 'c']);
  selection = selectSubject(selection, 'b', true);
  assert.deepEqual(selection, ['a', 'c']);
  assert.deepEqual(selectSubject(selection, 'b'), ['b']);
  assert.deepEqual(selectSubject(['a'], 'a', true), []);
});

test('suppression : seul l\'identifiant supprimé quitte la sélection', () => {
  const group = ['a', 'b', 'c'];

  assert.equal(deselectSubject(group, 'z'), group);
  assert.deepEqual(deselectSubject(group, 'b'), ['a', 'c']);
  assert.deepEqual(group, ['a', 'b', 'c']);
  assert.deepEqual(deselectSubject(['a', 'c'], 'a'), ['c']);
  assert.equal(deselectSubject(['a'], 'a'), EMPTY_SUBJECT_SELECTION);
  assert.equal(deselectSubject(EMPTY_SUBJECT_SELECTION, 'a'), EMPTY_SUBJECT_SELECTION);
  assert.equal(deselectSubject(['a'], 'z').length, 1);

  const remaining = deselectSubject(['a', 'b'], 'b');
  assert.deepEqual(remaining, ['a']);
  assert.equal(getSingleSelectedId(remaining), 'a');
  assert.deepEqual(pruneSubjectSelection(deselectSubject(group, 'b'), trio().filter((s) => s.id !== 'b')), ['a', 'c']);
});

test('sélection : le sujet actif n\'existe que pour une sélection unique', () => {
  assert.equal(getSingleSelectedId([]), null);
  assert.equal(getSingleSelectedId(['a']), 'a');
  assert.equal(getSingleSelectedId(['a', 'b']), null);
  assert.equal(getSelectionCountLabel(0), '');
  assert.equal(getSelectionCountLabel(1), '');
  assert.equal(getSelectionCountLabel(3), '3 sujets');
});

test('sélection : les sujets supprimés sortent de la sélection, sans copie inutile', () => {
  const subjects = trio();
  const selection = ['a', 'b'];
  assert.equal(pruneSubjectSelection(selection, subjects), selection);
  assert.deepEqual(pruneSubjectSelection(selection, subjects.filter((s) => s.id !== 'b')), ['a']);
  assert.equal(pruneSubjectSelection(selection, []), EMPTY_SUBJECT_SELECTION);
  assert.equal(pruneSubjectSelection(EMPTY_SUBJECT_SELECTION, subjects), EMPTY_SUBJECT_SELECTION);
});

test('clic : seul un membre d\'une sélection multiple déclenche un déplacement groupé', () => {
  const group = ['a', 'b', 'c'];
  assert.deepEqual(getDragIds(group, 'b'), group);
  assert.deepEqual(getDragIds(group, 'z'), ['z']);
  assert.deepEqual(getDragIds(['a'], 'a'), ['a']);
  assert.deepEqual(getDragIds([], 'a'), ['a']);
  assert.deepEqual(getDragIds(['a', 'b'], 'c'), ['c']);
});

test('glissement : un sujet seul se comporte comme avant (aimantation au sol et limites)', () => {
  const xs = [-1400, -50, 0, 1, 299.5, 700, 1399.25, 2800];
  const ys = [-300, -40, -16, -15, -14.9, 0, 3, 14.9, 15, 16, 200];
  const deltas = [-5000, -1234.5, -15, -0.5, 0, 0.5, 7, 15, 333.3, 5000];

  for (const x of xs) {
    for (const y of ys) {
      for (const dx of deltas) {
        for (const dy of deltas) {
          const subjects = [make('s', { x, y })];
          const { next, resolved } = move(subjects, ['s'], { dx, dy });
          const expected = legacyDrag(x, y, dx, dy);
          close(next[0].x, expected.x);
          close(next[0].y, expected.y);
          assert.equal(resolved.snapped, Math.abs(y + dy) < SNAP_Y);
        }
      }
    }
  }
});

test('glissement : un seul sujet bouge, les autres gardent la même référence', () => {
  const subjects = trio();
  const { next } = move(subjects, ['b'], { dx: 120, dy: 30 });

  assert.equal(next[0], subjects[0]);
  assert.equal(next[2], subjects[2]);
  close(next[1].x, 770.5);
  close(next[1].y, 42.25);
  assert.equal(next[1].placement, 'manual');
});

test('glissement groupé : deux sujets bougent de la même distance, le troisième ne bouge pas', () => {
  const subjects = trio();
  const { next } = move(subjects, ['a', 'c'], { dx: 90, dy: 20 }, 'a');

  close(next[0].x, 390);
  close(next[0].y, 20);
  close(next[2].x, 1090);
  close(next[2].y, -20);
  assert.equal(next[1], subjects[1]);
  assert.equal(next[0].placement, 'manual');
  assert.equal(next[2].placement, 'manual');
  assert.equal(next[1].placement, 'auto');
});

test('glissement groupé : les écarts relatifs restent identiques sur un geste à plusieurs étapes', () => {
  const subjects = trio();
  const ids = ['a', 'b', 'c'];
  const origins = captureDragOrigins(subjects, ids);
  const steps = [
    { dx: 3.7, dy: 1.1 },
    { dx: 41.3, dy: -9.9 },
    { dx: -77.77, dy: 120.5 },
    { dx: 250.25, dy: 33.3 },
  ];

  for (const step of steps) {
    const resolved = resolveDragDelta(origins, 'b', step, DRAG_OPTIONS);
    const next = translateSubjects(subjects, origins, resolved);
    for (let i = 1; i < ids.length; i += 1) {
      close(next[i].x - next[0].x, subjects[i].x - subjects[0].x);
      close(next[i].y - next[0].y, subjects[i].y - subjects[0].y);
    }
  }
});

test('glissement groupé : hauteurs, échelles, miroirs, ancres, calques et fichiers restent inchangés', () => {
  const subjects = trio();
  const { next } = move(subjects, ['a', 'b', 'c'], { dx: 200, dy: 60 }, 'b');

  next.forEach((subject, i) => {
    const before = subjects[i];
    const { x, y, placement, ...rest } = subject;
    const { x: x0, y: y0, placement: p0, ...restBefore } = before;
    assert.deepEqual(rest, restBefore);
    assert.notEqual(x, x0);
    assert.notEqual(y, y0);
    assert.equal(placement, 'manual');
    assert.equal(p0, 'auto');
  });

  next.forEach((subject, i) => {
    const before = getSubjectGeometry(subjects[i], FLOOR_Y);
    const after = getSubjectGeometry(subject, FLOOR_Y);
    close(after.visible.width, before.visible.width);
    close(after.visible.height, before.visible.height);
    close(after.anchor.x - before.anchor.x, 200);
    close(before.anchor.y - after.anchor.y, 60);
  });
});

test('glissement groupé : l\'aimantation au sol suit le sujet saisi et conserve les écarts de hauteur', () => {
  const subjects = trio();
  const { next, resolved } = move(subjects, ['a', 'b', 'c'], { dx: 0, dy: 8 }, 'a');

  assert.equal(resolved.snapped, true);
  assert.equal(next[0].y, 0);
  close(next[1].y - next[0].y, 12.25);
  close(next[2].y - next[0].y, -40);

  const lead = move(subjects, ['a', 'b', 'c'], { dx: 0, dy: 8 }, 'c');
  assert.equal(lead.resolved.snapped, false);
  close(lead.next[2].y, -32);
});

test('glissement groupé : les limites du canevas s\'appliquent au groupe sans le déformer', () => {
  const subjects = trio();

  const right = move(subjects, ['a', 'b', 'c'], { dx: 99999, dy: 0 }, 'a');
  close(right.next[2].x, CANVAS_W * 2);
  close(right.next[1].x - right.next[0].x, 350.5);
  close(right.next[2].x - right.next[0].x, 700);

  const left = move(subjects, ['a', 'b', 'c'], { dx: -99999, dy: 0 }, 'c');
  close(left.next[0].x, -CANVAS_W);
  close(left.next[1].x - left.next[0].x, 350.5);
  close(left.next[2].x - left.next[0].x, 700);
});

test('glissement : aucun sujet capturé ne produit aucun déplacement', () => {
  const resolved = resolveDragDelta([], 'x', { dx: 50, dy: 50 }, DRAG_OPTIONS);
  assert.deepEqual(resolved, { dx: 0, dy: 0, snapped: false });
  const subjects = trio();
  assert.deepEqual(translateSubjects(subjects, [], resolved), subjects);
});

test('zoom et panoramique : le déplacement suit le pointeur en unités du canevas', () => {
  const start = { x: 400, y: 300 };
  const current = { x: 460, y: 270 };

  assert.deepEqual(getPointerDelta(start, current, 1), { dx: 60, dy: 30 });
  assert.deepEqual(getPointerDelta(start, current, 0.5), { dx: 120, dy: 60 });
  assert.deepEqual(getPointerDelta(start, current, 2), { dx: 30, dy: 15 });

  const panned = getPointerDelta(
    { x: start.x + 333, y: start.y - 71 },
    { x: current.x + 333, y: current.y - 71 },
    0.5,
  );
  assert.deepEqual(panned, getPointerDelta(start, current, 0.5));

  const subjects = trio();
  const zoomedOut = move(subjects, ['a', 'b'], getPointerDelta(start, current, 0.5), 'a');
  const zoomedIn = move(subjects, ['a', 'b'], getPointerDelta(start, current, 2), 'a');
  close(zoomedOut.next[0].x - subjects[0].x, 120);
  close(zoomedIn.next[0].x - subjects[0].x, 30);
  close(zoomedOut.next[1].x - zoomedOut.next[0].x, subjects[1].x - subjects[0].x);
  close(zoomedIn.next[1].x - zoomedIn.next[0].x, subjects[1].x - subjects[0].x);
});

const startHistory = (subjects) => createHistoryState(createDocumentState(subjects));
const live = (state, subjects, origins, step, leadId) => {
  const resolved = resolveDragDelta(origins, leadId, step, DRAG_OPTIONS);
  return historyReducer(state, {
    type: 'set',
    updater: liftSubjects((list) => translateSubjects(list, origins, resolved)),
  });
};
const commitGesture = (state) =>
  historyReducer(state, { type: 'commit', mergeKey: null, time: 0, ...OPTIONS });

test('historique : un glissement groupé continu = une seule entrée, annulable et rétablissable', () => {
  const subjects = trio();
  const ids = ['a', 'b', 'c'];
  const origins = captureDragOrigins(subjects, ids);
  let state = startHistory(subjects);

  for (let i = 1; i <= 25; i += 1) {
    state = live(state, subjects, origins, { dx: i * 4.5, dy: i * 1.5 }, 'b');
    assert.equal(state.past.length, 0, 'aucune entrée pendant le geste');
  }
  assert.equal(state.committed.subjects, subjects);

  const finalSubjects = state.present.subjects;
  state = commitGesture(state);
  assert.equal(state.past.length, 1);
  assert.equal(state.future.length, 0);
  assert.equal(state.committed.subjects, finalSubjects);

  const undone = historyReducer(state, { type: 'undo' });
  assert.equal(undone.present.subjects, subjects);
  assert.equal(undone.past.length, 0);
  assert.equal(undone.future.length, 1);

  const redone = historyReducer(undone, { type: 'redo' });
  assert.equal(redone.present.subjects, finalSubjects);
  redone.present.subjects.forEach((subject, i) => {
    assert.equal(subject.x, finalSubjects[i].x);
    assert.equal(subject.y, finalSubjects[i].y);
  });
});

test('historique : deux gestes successifs donnent deux entrées indépendantes', () => {
  const subjects = trio();
  let state = startHistory(subjects);

  let origins = captureDragOrigins(state.present.subjects, ['a', 'b']);
  state = live(state, state.present.subjects, origins, { dx: 80, dy: 0 }, 'a');
  state = commitGesture(state);

  origins = captureDragOrigins(state.present.subjects, ['c']);
  state = live(state, state.present.subjects, origins, { dx: -60, dy: 20 }, 'c');
  state = commitGesture(state);

  assert.equal(state.past.length, 2);
  const first = historyReducer(state, { type: 'undo' });
  close(first.present.subjects[2].x, 1000);
  close(first.present.subjects[0].x, 380);
  const second = historyReducer(first, { type: 'undo' });
  assert.equal(second.present.subjects, subjects);
});

test('historique : un clic sans déplacement, ou un déplacement revenu au départ, n\'ajoute rien', () => {
  const subjects = trio();
  const ids = ['a', 'b'];
  const origins = captureDragOrigins(subjects, ids);

  const click = commitGesture(startHistory(subjects));
  assert.equal(click.past.length, 0);

  let state = startHistory(subjects);
  state = live(state, subjects, origins, { dx: 150, dy: 40 }, 'a');
  state = historyReducer(state, {
    type: 'set',
    updater: liftSubjects((list) =>
      list.map((subject) => subjects.find((s) => s.id === subject.id) ?? subject).map((s) => ({ ...s })),
    ),
  });
  state = commitGesture(state);
  assert.equal(state.past.length, 0);
});

test('historique : un glissement annulé restaure exactement l\'état validé', () => {
  const subjects = trio();
  const origins = captureDragOrigins(subjects, ['a', 'b', 'c']);
  let state = startHistory(subjects);

  state = live(state, subjects, origins, { dx: 220, dy: 70 }, 'a');
  assert.notEqual(state.present.subjects, subjects);

  state = historyReducer(state, { type: 'rollback' });
  assert.equal(state.present.subjects, subjects);
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 0);

  state = commitGesture(state);
  assert.equal(state.past.length, 0);
});

test('historique : annuler un glissement après un geste précédent ne touche pas l\'historique existant', () => {
  const subjects = trio();
  let state = startHistory(subjects);
  state = live(state, subjects, captureDragOrigins(subjects, ['a', 'b']), { dx: 40, dy: 0 }, 'a');
  state = commitGesture(state);
  const committed = state.present.subjects;

  state = live(state, committed, captureDragOrigins(committed, ['b', 'c']), { dx: 100, dy: 50 }, 'b');
  state = historyReducer(state, { type: 'rollback' });

  assert.equal(state.present.subjects, committed);
  assert.equal(state.past.length, 1);
});

const five = () => [
  make('a', { x: 200, zIndex: 1 }),
  make('b', { x: 450, y: 8, scale: 1.6, flipX: true, zIndex: 2 }),
  make('c', { x: 700, zIndex: 3 }),
  make('d', { x: 950, y: -20, scale: 0.9, zIndex: 4 }),
  make('e', { x: 1200, zIndex: 5 }),
];

const removeThroughHistory = (state, ids) =>
  historyReducer(state, {
    type: 'apply',
    updater: liftSubjects((list) => removeSubjectsById(list, ids)),
    time: 0,
    ...OPTIONS,
  });

test('suppression multiple : seuls les sujets sélectionnés disparaissent, les autres restent identiques', () => {
  const subjects = five();
  const next = removeSubjectsById(subjects, ['b', 'c', 'e']);

  assert.deepEqual(next.map((s) => s.id), ['a', 'd']);
  assert.equal(next[0], subjects[0]);
  assert.equal(next[1], subjects[3]);
  assert.equal(subjects.length, 5);
  assert.equal(removeSubjectsById(subjects, []), subjects);
  assert.equal(removeSubjectsById(subjects, ['z']), subjects);
});

test('suppression individuelle : un seul identifiant donne le même résultat qu\'avant', () => {
  const subjects = five();
  const expected = subjects.filter((s) => s.id !== 'c');

  assert.deepEqual(removeSubjectsById(subjects, ['c']), expected);
});

test('suppression multiple : une seule entrée d\'historique, Undo restaure tout, Redo supprime à nouveau', () => {
  const subjects = five();
  let state = startHistory(subjects);

  state = removeThroughHistory(state, ['b', 'c', 'e']);
  const afterDelete = state.present.subjects;
  assert.deepEqual(afterDelete.map((s) => s.id), ['a', 'd']);
  assert.equal(state.past.length, 1);

  const undone = historyReducer(state, { type: 'undo' });
  assert.equal(undone.present.subjects, subjects);
  assert.deepEqual(undone.present.subjects.map((s) => s.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(undone.present.subjects.map((s) => s.zIndex), [1, 2, 3, 4, 5]);
  assert.equal(undone.past.length, 0);

  const redone = historyReducer(undone, { type: 'redo' });
  assert.equal(redone.present.subjects, afterDelete);
  assert.deepEqual(redone.present.subjects.map((s) => s.id), ['a', 'd']);
});

test('suppression multiple : la sélection vide ne crée aucune entrée d\'historique', () => {
  const state = removeThroughHistory(startHistory(five()), []);

  assert.equal(state.past.length, 0);
});

test('suppression : le groupe restant ne dépend pas de la sélection après suppression', () => {
  const subjects = five();
  const selection = ['b', 'c'];
  const remaining = removeSubjectsById(subjects, selection);

  assert.equal(pruneSubjectSelection(selection, remaining).length, 0);
  assert.equal(pruneSubjectSelection(selection, remaining), EMPTY_SUBJECT_SELECTION);
});
