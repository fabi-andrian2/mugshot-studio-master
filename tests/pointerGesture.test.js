import test from 'node:test';
import assert from 'node:assert/strict';

import { isForeignPointer, getPanView } from '../src/domain/pointerGesture.js';

test('pointeur : sans geste actif, aucun pointeur n\'est étranger', () => {
  assert.equal(isForeignPointer(null, 3), false);
  assert.equal(isForeignPointer(undefined, 3), false);
});

test('pointeur : seul le pointeur du geste actif est accepté', () => {
  assert.equal(isForeignPointer(7, 7), false);
  assert.equal(isForeignPointer(7, 8), true);
  assert.equal(isForeignPointer(0, 0), false);
  assert.equal(isForeignPointer(0, 1), true);
});

test('panoramique : le déplacement suit le pointeur depuis la vue initiale', () => {
  const panInfo = { pointerId: 1, startX: 100, startY: 200, initPanX: 30, initPanY: -40 };

  assert.deepEqual(getPanView(panInfo, { x: 100, y: 200 }, 0.5), { zoom: 0.5, panX: 30, panY: -40 });
  assert.deepEqual(getPanView(panInfo, { x: 160, y: 150 }, 0.5), { zoom: 0.5, panX: 90, panY: -90 });
  assert.deepEqual(getPanView(panInfo, { x: 40, y: 260 }, 1.25), { zoom: 1.25, panX: -30, panY: 20 });
});

test('panoramique : le calcul ne modifie pas l\'état de départ', () => {
  const panInfo = { pointerId: 1, startX: 0, startY: 0, initPanX: 5, initPanY: 6 };
  const copy = { ...panInfo };

  getPanView(panInfo, { x: 50, y: 50 }, 1);

  assert.deepEqual(panInfo, copy);
});
