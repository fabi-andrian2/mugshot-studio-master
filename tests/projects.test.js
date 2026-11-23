import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterProjects,
  getCopyName,
  getHomeSections,
  isPristineSnapshotData,
  normalizeProjectName,
  sortProjects,
  suggestProjectName,
} from '../src/domain/projects.js';
import { serializeSession } from '../src/services/sessionSnapshot.js';
import { createBlankState } from '../src/domain/blankSession.js';

const P = (id, name, lastOpenedAt, createdAt = 0) => ({ id, name, lastOpenedAt, createdAt, updatedAt: lastOpenedAt });

test('noms : normalisation, suggestion, copie', () => {
  assert.equal(normalizeProjectName('  a   b '), 'a b');
  assert.equal(normalizeProjectName(null), '');
  assert.equal(suggestProjectName(['Nouveau projet']), 'Nouveau projet 2');
  assert.equal(getCopyName('A', ['A', 'A (copie)']), 'A (copie 2)');
  assert.ok(getCopyName('x'.repeat(200), []).length <= 80);
});

test('filtre insensible à la casse et aux accents', () => {
  const list = [P('1', 'Été 2026', 1), P('2', 'Hiver', 2)];
  assert.deepEqual(filterProjects(list, 'ete').map((p) => p.id), ['1']);
  assert.equal(filterProjects(list, '  ').length, 2);
});

test('tri : récent, nom, création', () => {
  const list = [P('a', 'b', 1, 3), P('b', 'A', 2, 1), P('c', 'c', 3, 2)];
  assert.deepEqual(sortProjects(list, 'recent').map((p) => p.id), ['c', 'b', 'a']);
  assert.deepEqual(sortProjects(list, 'name').map((p) => p.id), ['b', 'a', 'c']);
  assert.deepEqual(sortProjects(list, 'created').map((p) => p.id), ['a', 'c', 'b']);
});

test('accueil : dernier projet puis six récents', () => {
  const list = Array.from({ length: 10 }, (_, i) => P(`p${i}`, `P${i}`, i));
  const { last, recent } = getHomeSections(list, 'p3');
  assert.equal(last.id, 'p3');
  assert.equal(recent.length, 6);
  assert.ok(!recent.some((p) => p.id === 'p3'));
  assert.equal(getHomeSections([], null).last, null);
});

test('session vierge = pristine ; toute personnalisation est conservée', async () => {
  const snap = async (mutate) => {
    const s = createBlankState();
    mutate?.(s);
    return (await serializeSession(s)).data;
  };
  assert.equal(isPristineSnapshotData(await snap()), true);
  assert.equal(isPristineSnapshotData(await snap((s) => (s.canvasW += 100))), false);
  assert.equal(isPristineSnapshotData(await snap((s) => (s.unit = 'ft'))), false);
  assert.equal(isPristineSnapshotData(await snap((s) => (s.board.title = 'Titre'))), false);
  assert.equal(isPristineSnapshotData(await snap((s) => (s.annotations.enabled = true))), false);
  assert.equal(isPristineSnapshotData(await snap((s) => (s.mannequin.visible = !s.mannequin.visible))), false);
  assert.equal(isPristineSnapshotData(await snap((s) => (s.board.background.color = '#123456'))), false);
  const withoutShadows = await snap();
  delete withoutShadows.shadows;
  assert.equal(isPristineSnapshotData(withoutShadows), true);
});
