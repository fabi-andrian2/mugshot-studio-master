import test from 'node:test';
import assert from 'node:assert/strict';

import { createBlankState } from '../src/domain/blankSession.js';
import { DEFAULT_W, DEFAULT_H } from '../src/domain/constants.js';
import { DEFAULT_BOARD } from '../src/domain/board.js';
import { DEFAULT_ANNOTATIONS } from '../src/domain/annotations.js';
import { DEFAULT_MANNEQUIN } from '../src/domain/mannequin.js';
import { DEFAULT_MEASURE } from '../src/domain/measure.js';
import { serializeSession, restoreSession } from '../src/services/sessionSnapshot.js';
import { SCHEMA_VERSION } from '../src/services/persistence.js';

test('état vierge : reprend les valeurs par défaut réelles du projet', () => {
  const blank = createBlankState();
  assert.deepEqual(blank.subjects, []);
  assert.equal(blank.canvasW, DEFAULT_W);
  assert.equal(blank.canvasH, DEFAULT_H);
  assert.equal(blank.unit, 'cm');
  assert.deepEqual(blank.board, DEFAULT_BOARD);
  assert.deepEqual(blank.annotations, DEFAULT_ANNOTATIONS);
  assert.deepEqual(blank.mannequin, DEFAULT_MANNEQUIN);
  assert.deepEqual(blank.measure, DEFAULT_MEASURE);
});

test('état vierge : nouvelles références à chaque appel, constantes non partagées', () => {
  const a = createBlankState();
  const b = createBlankState();
  assert.notEqual(a.subjects, b.subjects);
  assert.notEqual(a.board, b.board);
  assert.notEqual(a.board.background, DEFAULT_BOARD.background);
  assert.notEqual(a.measure.items, DEFAULT_MEASURE.items);
  a.measure.items.push({ id: 1 });
  a.annotations.enabled = true;
  assert.deepEqual(DEFAULT_MEASURE.items, []);
  assert.equal(DEFAULT_ANNOTATIONS.enabled, false);
});

test('état vierge : sérialisable puis restaurable sans perte', async () => {
  const blank = createBlankState();
  const serialized = await serializeSession(blank);
  assert.equal(serialized.ok, true);
  const restored = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data: serialized.data });
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.state, blank);
});