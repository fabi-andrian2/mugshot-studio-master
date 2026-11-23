import test from 'node:test';
import { setImmediate } from 'node:timers';
import assert from 'node:assert/strict';

import { createProjectSaver, isFatalSaveError } from '../src/services/projectSaver.js';
import { PersistenceError } from '../src/services/idb.js';

const makeTimers = () => {
  const timers = [];
  return {
    timers,
    setTimer: (fn, ms) => {
      const t = { fn, ms, active: true };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      if (t) t.active = false;
    },
    fire: async () => {
      const t = timers.filter((x) => x.active).pop();
      assert.ok(t, 'aucun timer actif');
      t.active = false;
      t.fn();
      await new Promise((r) => setImmediate(r));
    },
  };
};

const make = ({ save, serialize } = {}) => {
  const clock = makeTimers();
  const statuses = [];
  const writes = [];
  const store = {
    saveProject: save ?? (async (id, { data, expectedRevision }) => {
      writes.push({ id, data, expectedRevision });
      return { revision: expectedRevision + 1, savedAt: 10 };
    }),
  };
  const saver = createProjectSaver({
    projectId: 'p1',
    initialRevision: 1,
    store,
    serialize: serialize ?? (async (state) => ({ ok: true, data: { s: state } })),
    onStatus: (s) => statuses.push(s.status),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    retryDelays: [10, 20],
  });
  saver.start();
  return { saver, clock, statuses, writes };
};

test('notify → pending, debounce puis saving → saved', async () => {
  const { saver, clock, statuses, writes } = make();
  saver.notify(1);
  saver.notify(2);
  assert.equal(saver.getStatus().status, 'pending');
  await clock.fire();
  assert.deepEqual(writes.map((w) => w.data.s), [2]);
  assert.deepEqual(statuses, ['pending', 'saving', 'saved']);
  assert.equal(saver.isDirty(), false);
});

test('révisions attendues successives', async () => {
  const { saver, writes } = make();
  saver.notify(1);
  assert.deepEqual(await saver.flush(), { ok: true });
  saver.notify(2);
  await saver.flush();
  assert.deepEqual(writes.map((w) => w.expectedRevision), [1, 2]);
  assert.equal(saver.getRevision(), 3);
});

test('flush sans modification : ok immédiat', async () => {
  const { saver, writes } = make();
  assert.deepEqual(await saver.flush(), { ok: true });
  assert.equal(writes.length, 0);
});

test('modification pendant une écriture : réécriture de la dernière version', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const writes = [];
  const { saver } = make({
    save: async (id, { data, expectedRevision }) => {
      writes.push(data.s);
      if (writes.length === 1) await gate;
      return { revision: expectedRevision + 1, savedAt: 1 };
    },
  });
  saver.notify('a');
  const f = saver.flush();
  await new Promise((r) => setImmediate(r));
  saver.notify('b');
  release();
  assert.deepEqual(await f, { ok: true });
  assert.deepEqual(writes, ['a', 'b']);
  assert.equal(saver.isDirty(), false);
});

test('échec retentable : statut error, flush {ok:false}, retry puis saved', async () => {
  let fail = true;
  const { saver, clock, statuses } = make({
    save: async (id, { expectedRevision }) => {
      if (fail) throw new PersistenceError('write', 'boom');
      return { revision: expectedRevision + 1, savedAt: 5 };
    },
  });
  saver.notify(1);
  const out = await saver.flush();
  assert.equal(out.ok, false);
  assert.equal(saver.getStatus().status, 'error');
  assert.equal(saver.getStatus().retrying, true);
  assert.equal(saver.isDirty(), true);
  fail = false;
  await clock.fire();
  assert.equal(saver.getStatus().status, 'saved');
  assert.equal(saver.isDirty(), false);
  assert.equal(statuses.at(-1), 'saved');
});

test('un échec n’est jamais présenté comme réussi', async () => {
  const { saver, statuses } = make({
    save: async () => {
      throw new PersistenceError('quota', 'plein');
    },
  });
  saver.notify(1);
  await saver.flush();
  assert.ok(!statuses.includes('saved'));
  assert.equal(saver.getStatus().error.code, 'quota');
});

test('conflit : fatal, pas de retry, notify ignoré, flush échoue', async () => {
  const { saver, clock } = make({
    save: async () => {
      throw new PersistenceError('conflict', 'x');
    },
  });
  saver.notify(1);
  const out = await saver.flush();
  assert.equal(out.ok, false);
  assert.equal(saver.getStatus().fatal, true);
  assert.equal(clock.timers.filter((t) => t.active).length, 0);
  assert.equal(saver.notify(2), false);
  assert.equal((await saver.flush()).ok, false);
  assert.ok(isFatalSaveError({ code: 'not-found' }));
  assert.ok(!isFatalSaveError({ code: 'quota' }));
});

test('échec de sérialisation remonté', async () => {
  const { saver } = make({ serialize: async () => ({ ok: false, error: { code: 'invalid-state' } }) });
  saver.notify(1);
  const out = await saver.flush();
  assert.equal(out.ok, false);
  assert.equal(saver.getStatus().fatal, true);
});

test('dispose : plus aucune écriture', async () => {
  const { saver, clock, writes } = make();
  saver.notify(1);
  saver.dispose();
  assert.equal(clock.timers.filter((t) => t.active).length, 0);
  assert.deepEqual(await saver.flush(), { ok: true });
  assert.equal(writes.length, 0);
});
