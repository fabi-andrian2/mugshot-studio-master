import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeGirths,
  upsertGirth,
  updateGirthValue,
  renameCustomGirth,
  setGirthSide,
  removeGirth,
  setSubjectGirths,
  getSubjectGirths,
  getGirthLabel,
  areGirthsEqual,
  parseGirthInput,
  formatGirth,
  cmToGirthDisplay,
  isValidGirthCm,
} from '../src/domain/girths.js';
import { areSubjectListsEqual } from '../src/domain/subjects.js';
import { removeSubjectsById } from '../src/domain/subjectSelection.js';
import { serializeSession, restoreSession } from '../src/services/sessionSnapshot.js';
import { SCHEMA_VERSION } from '../src/services/persistence.js';
import { createDocumentState, areDocumentStatesEqual, liftSubjects } from '../src/domain/documentHistory.js';
import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';

let counter = 0;
const id = () => `g${(counter += 1)}`;

test('valeurs : strictement positives, finies et plausibles', () => {
  for (const bad of [0, -1, NaN, Infinity, '80', null, undefined, 501]) assert.equal(isValidGirthCm(bad), false);
  assert.equal(isValidGirthCm(82.5), true);
});

test('saisie : virgule, point, unités, rejet des valeurs invalides', () => {
  assert.equal(parseGirthInput('82,5', 'cm'), 82.5);
  assert.ok(Math.abs(parseGirthInput('32', 'ft') - 81.28) < 1e-9);
  for (const bad of ['', 'abc', '-5', '0', '1e3', '12 cm', ' ', '5.5.5']) assert.equal(parseGirthInput(bad, 'cm'), null);
  assert.equal(parseGirthInput(undefined, 'cm'), null);
});

test('unités : la valeur stockée n’est jamais modifiée par l’affichage', () => {
  const list = upsertGirth([], { kind: 'waist', cm: 81.28 }, id);
  const before = list[0].cm;
  assert.equal(formatGirth(before, 'cm'), '81.3 cm');
  assert.equal(formatGirth(before, 'ft'), '32 in');
  assert.equal(cmToGirthDisplay(before, 'cm'), 81.3);
  assert.equal(list[0].cm, before);
});

test('mensurations prédéfinies : une seule valeur par type, remplacement', () => {
  let list = upsertGirth([], { kind: 'waist', cm: 80 }, id);
  list = upsertGirth(list, { kind: 'waist', cm: 82 }, id);
  assert.equal(list.length, 1);
  assert.equal(list[0].cm, 82);
  assert.equal(upsertGirth(list, { kind: 'waist', cm: 82 }, id), list);
  assert.equal(upsertGirth(list, { kind: 'waist', cm: -2 }, id), list);
  assert.equal(upsertGirth(list, { kind: 'inconnu', cm: 2 }, id), list);
});

test('latéralité : gauche, droite et commun sans ambiguïté', () => {
  let list = upsertGirth([], { kind: 'arm', side: 'left', cm: 30 }, id);
  list = upsertGirth(list, { kind: 'arm', side: 'right', cm: 31 }, id);
  assert.deepEqual(list.map((g) => g.side).sort(), ['left', 'right']);
  list = upsertGirth(list, { kind: 'arm', side: 'both', cm: 30.5 }, id);
  assert.deepEqual(list.map((g) => g.side), ['both']);
  list = upsertGirth(list, { kind: 'arm', side: 'left', cm: 29 }, id);
  assert.deepEqual(list.map((g) => g.side), ['left']);
  assert.equal(getGirthLabel(list[0]), 'Tour de bras (gauche)');
  list = upsertGirth(list, { kind: 'arm', cm: 30 }, id);
  assert.deepEqual(list.map((g) => g.side), ['both']);
});

test('changement de côté : unicité conservée', () => {
  let list = upsertGirth([], { kind: 'thigh', side: 'left', cm: 50 }, id);
  list = upsertGirth(list, { kind: 'thigh', side: 'right', cm: 52 }, id);
  const left = list.find((g) => g.side === 'left');
  const moved = setGirthSide(list, left.id, 'both');
  assert.equal(moved.length, 1);
  assert.equal(moved[0].side, 'both');
  assert.equal(setGirthSide(moved, moved[0].id, 'both'), moved);
  const waist = upsertGirth([], { kind: 'waist', cm: 70 }, id);
  assert.equal(setGirthSide(waist, waist[0].id, 'left'), waist);
});

test('personnalisées : nom requis, plusieurs autorisées, renommage', () => {
  let list = upsertGirth([], { kind: 'custom', label: '  Tour   de cou ', cm: 38 }, id);
  list = upsertGirth(list, { kind: 'custom', label: 'Poignet', cm: 16 }, id);
  assert.equal(list.length, 2);
  assert.equal(list[0].label, 'Tour de cou');
  assert.equal(upsertGirth(list, { kind: 'custom', label: '   ', cm: 5 }, id), list);
  const renamed = renameCustomGirth(list, list[0].id, 'Cou');
  assert.equal(renamed[0].label, 'Cou');
  assert.equal(renameCustomGirth(list, list[0].id, ''), list);
  assert.equal(updateGirthValue(list, list[0].id, 0), list);
  assert.equal(updateGirthValue(list, list[0].id, 39)[0].cm, 39);
});

test('suppression d’une mensuration', () => {
  const list = upsertGirth([], { kind: 'hips', cm: 95 }, id);
  assert.deepEqual(removeGirth(list, list[0].id), []);
  assert.equal(removeGirth(list, 'absent'), list);
});

test('normalisation : données corrompues écartées sans exception', () => {
  assert.deepEqual(normalizeGirths(undefined), []);
  assert.deepEqual(normalizeGirths('x'), []);
  const clean = normalizeGirths([
    { id: 'a', kind: 'waist', cm: 70 },
    { id: 'a', kind: 'chest', cm: 90 },
    { id: 'b', kind: 'waist', cm: 71 },
    { id: 'c', kind: 'arm', side: 'both', cm: 30 },
    { id: 'd', kind: 'arm', side: 'left', cm: 30 },
    { id: 'e', kind: 'custom', cm: 30 },
    { id: 'f', kind: 'hips', cm: '95' },
    null,
  ]);
  assert.deepEqual(clean.map((g) => g.id), ['a', 'c']);
});

test('sujet : stockage dans girths, propriété omise quand vide, égalité structurelle', () => {
  const subject = { id: 's', name: 'S' };
  const list = upsertGirth([], { kind: 'waist', cm: 70 }, id);
  const withGirths = setSubjectGirths(subject, list);
  assert.deepEqual(getSubjectGirths(withGirths), list);
  assert.equal('girths' in setSubjectGirths(withGirths, []), false);
  const copy = setSubjectGirths(subject, list.map((g) => ({ ...g })));
  assert.ok(areGirthsEqual(withGirths.girths, copy.girths));
  assert.ok(areSubjectListsEqual([withGirths], [copy]));
  assert.ok(!areSubjectListsEqual([withGirths], [setSubjectGirths(subject, [{ ...list[0], cm: 71 }])]));
});

test('sujet supprimé : plus aucune donnée orpheline, undo les restaure', () => {
  const a = setSubjectGirths({ id: 'a', name: 'A' }, upsertGirth([], { kind: 'waist', cm: 70 }, id));
  const b = { id: 'b', name: 'B' };
  const options = { isEqual: areDocumentStatesEqual, limit: 50, mergeWindowMs: 0 };
  let state = createHistoryState(createDocumentState([a, b], []));
  state = historyReducer(state, {
    type: 'apply',
    updater: liftSubjects((list) => removeSubjectsById(list, ['a'])),
    mergeKey: null,
    time: 0,
    ...options,
  });
  assert.deepEqual(state.present.subjects.map((s) => s.id), ['b']);
  assert.equal(JSON.stringify(state.present).includes('girths'), false);
  state = historyReducer(state, { type: 'undo' });
  assert.equal(state.present.subjects[0].girths[0].cm, 70);
});

test('modification d’une mensuration : un enregistrement, annulable', () => {
  const options = { isEqual: areDocumentStatesEqual, limit: 50, mergeWindowMs: 0 };
  const subject = { id: 'a', name: 'A' };
  let state = createHistoryState(createDocumentState([subject], []));
  const edit = (fn) =>
    historyReducer(state, {
      type: 'apply',
      updater: liftSubjects((list) => list.map((s) => setSubjectGirths(s, fn(getSubjectGirths(s))))),
      mergeKey: null,
      time: 0,
      ...options,
    });
  state = edit((g) => upsertGirth(g, { kind: 'waist', cm: 70 }, id));
  assert.equal(state.past.length, 1);
  state = edit((g) => upsertGirth(g, { kind: 'waist', cm: 70 }, id));
  assert.equal(state.past.length, 1);
  state = historyReducer(state, { type: 'undo' });
  assert.equal('girths' in state.present.subjects[0], false);
});

test('session : mensurations conservées au rôle de sujet, ni mesure ni export', async () => {
  const girths = [
    { id: 'g1', kind: 'waist', cm: 71.5 },
    { id: 'g2', kind: 'arm', side: 'left', cm: 30 },
    { id: 'g3', kind: 'custom', label: 'Cou', cm: 38 },
  ];
  const subject = {
    id: 'a', url: 'blob:a', fileName: 'a.png', name: 'a', x: 1, y: 0, scale: 1, flipX: false, zIndex: 1,
    placement: 'auto', visible: true, silhouette: false, naturalW: 10, naturalH: 20, girths,
    visibleBounds: { left: 0, top: 0, right: 1, bottom: 1 }, groundAnchor: { x: 0.5, y: 1 }, headAnchor: { x: 0.5, y: 0 },
  };
  const state = {
    canvasW: 1000, canvasH: 1000, unit: 'ft', subjects: [subject],
    board: { showGrid: true, background: { color: '#ffffff', image: null } },
    annotations: { enabled: true, scope: 'all' }, mannequin: { visible: false, heightCm: 180, x: 0 },
    measure: { active: false, items: [] },
  };
  const { data } = await serializeSession(state, { fetchBlob: async () => new Blob(['x'], { type: 'image/png' }) });
  assert.deepEqual(data.subjects[0].girths, girths);
  const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, { createUrl: () => 'blob:r', revokeUrl() {} });
  assert.deepEqual(result.state.subjects[0].girths, girths);
  assert.equal(result.state.unit, 'ft');
  assert.deepEqual(data.measure.items, []);
});
