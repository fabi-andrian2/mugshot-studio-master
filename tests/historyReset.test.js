import test from 'node:test';
import assert from 'node:assert/strict';

import { createHistoryState, historyReducer } from '../src/hooks/useHistory.js';

const OPTIONS = { isEqual: Object.is, limit: 50, mergeWindowMs: 0 };

const apply = (state, updater) =>
  historyReducer(state, { type: 'apply', updater, mergeKey: null, time: 0, ...OPTIONS });

test('reset : remplace le contenu sans créer d\'entrée d\'historique', () => {
  const restored = [{ id: 'a' }, { id: 'b' }];
  const next = historyReducer(createHistoryState([]), { type: 'reset', state: restored });
  assert.equal(next.present, restored);
  assert.equal(next.committed, restored);
  assert.deepEqual(next.past, []);
  assert.deepEqual(next.future, []);
  assert.equal(next.lastMerge, null);
});

test('reset : annuler après restauration ne retire pas la session restaurée', () => {
  const restored = [{ id: 'a' }];
  const reset = historyReducer(createHistoryState([]), { type: 'reset', state: restored });
  const undone = historyReducer(reset, { type: 'undo' });
  assert.equal(undone.present, restored);
});

test('reset : les modifications suivantes restent annulables normalement', () => {
  const restored = [{ id: 'a', x: 1 }];
  let state = historyReducer(createHistoryState([]), { type: 'reset', state: restored });
  state = apply(state, (list) => list.map((s) => ({ ...s, x: 2 })));
  assert.equal(state.past.length, 1);
  state = historyReducer(state, { type: 'undo' });
  assert.equal(state.present, restored);
  state = historyReducer(state, { type: 'redo' });
  assert.equal(state.present[0].x, 2);
});

test('reset : efface un historique existant', () => {
  let state = createHistoryState([{ id: 'a' }]);
  state = apply(state, (list) => [...list, { id: 'b' }]);
  assert.equal(state.past.length, 1);
  const next = historyReducer(state, { type: 'reset', state: [] });
  assert.deepEqual(next.past, []);
  assert.deepEqual(next.future, []);
});