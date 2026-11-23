import test from 'node:test';
import { setImmediate } from 'node:timers';
import assert from 'node:assert/strict';

import { acquireProjectLock } from '../src/services/projectLock.js';

const makeLocks = () => {
  const held = new Set();
  return {
    held,
    request: (name, opts, cb) => {
      if (held.has(name)) return cb(null);
      held.add(name);
      return Promise.resolve(cb({ name })).finally(() => held.delete(name));
    },
  };
};

test('verrou libre puis libéré', async () => {
  const locks = makeLocks();
  const a = await acquireProjectLock('p', { locks });
  assert.equal(a.ok, true);
  assert.equal(locks.held.size, 1);
  a.release();
  a.release();
  await new Promise((r) => setImmediate(r));
  assert.equal(locks.held.size, 0);
});

test('projet déjà ouvert ailleurs : refus après tentatives', async () => {
  const locks = makeLocks();
  const a = await acquireProjectLock('p', { locks });
  let waits = 0;
  const b = await acquireProjectLock('p', { locks, retries: 2, wait: async () => void (waits += 1) });
  assert.deepEqual(b, { ok: false, reason: 'held' });
  assert.equal(waits, 2);
  const other = await acquireProjectLock('q', { locks });
  assert.equal(other.ok, true);
  a.release();
});

test('réessai réussi quand l’autre fenêtre libère', async () => {
  const locks = makeLocks();
  const a = await acquireProjectLock('p', { locks });
  const b = await acquireProjectLock('p', {
    locks,
    retries: 3,
    wait: async () => {
      a.release();
      await new Promise((r) => setImmediate(r));
    },
  });
  assert.equal(b.ok, true);
});

test('sans Web Locks : dégradation sans blocage', async () => {
  const r = await acquireProjectLock('p', { locks: null });
  assert.equal(r.ok, true);
  assert.equal(r.supported, false);
});
