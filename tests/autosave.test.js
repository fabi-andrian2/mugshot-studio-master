import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';

import {
  createAutosaver,
  loadInitialSession,
  releaseRestoredUrls,
} from '../src/services/autosave.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

const makeTimers = () => {
  let next = 1;
  const timers = new Map();
  return {
    setTimer: (fn) => {
      const id = next;
      next += 1;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    fire: () => {
      const fns = [...timers.values()];
      timers.clear();
      fns.forEach((fn) => fn());
    },
    count: () => timers.size,
  };
};

const makeSaver = (overrides = {}) => {
  const timers = makeTimers();
  const log = { serialized: [], written: [], statuses: [], active: 0, maxActive: 0 };
  const saver = createAutosaver({
    serialize: async (state) => {
      log.serialized.push(state);
      return { ok: true, data: { copy: state } };
    },
    write: async (data) => {
      log.active += 1;
      log.maxActive = Math.max(log.maxActive, log.active);
      await tick();
      log.written.push(data.copy);
      log.active -= 1;
      return { ok: true, savedAt: log.written.length };
    },
    onStatus: (status) => log.statuses.push(status.status),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    ...overrides,
  });
  return { saver, timers, log };
};

test('autosave : aucune écriture avant start()', async () => {
  const { saver, timers, log } = makeSaver();
  assert.equal(saver.notify({ v: 1 }), false);
  assert.equal(timers.count(), 0);
  timers.fire();
  await saver.flush();
  assert.deepEqual(log.serialized, []);
  assert.deepEqual(log.written, []);
});

test('autosave : plusieurs changements rapprochés = une seule écriture du dernier état', async () => {
  const { saver, timers, log } = makeSaver();
  saver.start();
  saver.notify({ v: 1 });
  saver.notify({ v: 2 });
  saver.notify({ v: 3 });
  assert.equal(timers.count(), 1);
  timers.fire();
  await saver.flush();
  assert.deepEqual(log.written, [{ v: 3 }]);
  assert.deepEqual(log.statuses, ['saving', 'saved']);
});

test('autosave : un changement pendant une écriture est écrit ensuite, jamais en parallèle', async () => {
  const { saver, timers, log } = makeSaver();
  saver.start();
  saver.notify({ v: 1 });
  timers.fire();
  await tick();
  saver.notify({ v: 2 });
  timers.fire();
  await saver.flush();
  await tick();
  await tick();
  assert.deepEqual(log.written, [{ v: 1 }, { v: 2 }]);
  assert.equal(log.maxActive, 1);
});

test('autosave : une sérialisation devenue obsolète est ignorée, seul l\'état le plus récent est écrit', async () => {
  let releaseFirst;
  const gate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  const { saver, timers, log } = makeSaver({
    serialize: async (state) => {
      calls += 1;
      if (calls === 1) await gate;
      return { ok: true, data: { copy: state } };
    },
  });
  saver.start();
  saver.notify({ v: 1 });
  timers.fire();
  await tick();
  saver.notify({ v: 2 });
  timers.fire();
  releaseFirst();
  await saver.flush();
  await tick();
  await tick();
  assert.equal(calls, 2);
  assert.deepEqual(log.written, [{ v: 2 }]);
  assert.equal(log.statuses.includes('error'), false);
});

test('autosave : une erreur de sérialisation obsolète n\'est pas signalée', async () => {
  let releaseFirst;
  const gate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  const { saver, timers, log } = makeSaver({
    serialize: async (state) => {
      calls += 1;
      if (calls === 1) {
        await gate;
        return { ok: false, error: new Error('ancien état') };
      }
      return { ok: true, data: { copy: state } };
    },
  });
  saver.start();
  saver.notify({ v: 1 });
  timers.fire();
  await tick();
  saver.notify({ v: 2 });
  timers.fire();
  releaseFirst();
  await saver.flush();
  await tick();
  await tick();
  assert.deepEqual(log.written, [{ v: 2 }]);
  assert.equal(log.statuses.includes('error'), false);
});

test('autosave : échec de sérialisation = erreur signalée, aucune écriture, nouvel essai au changement suivant', async () => {
  let fail = true;
  const { saver, timers, log } = makeSaver({
    serialize: async (state) =>
      fail ? { ok: false, error: new Error('image introuvable') } : { ok: true, data: { copy: state } },
  });
  saver.start();
  saver.notify({ v: 1 });
  timers.fire();
  await saver.flush();
  assert.deepEqual(log.written, []);
  assert.equal(log.statuses.at(-1), 'error');
  fail = false;
  saver.notify({ v: 2 });
  timers.fire();
  await saver.flush();
  assert.deepEqual(log.written, [{ v: 2 }]);
  assert.equal(log.statuses.at(-1), 'saved');
});

test('autosave : échec d\'écriture = erreur, jamais présenté comme sauvegardé', async () => {
  const { saver, timers, log } = makeSaver({
    write: async () => ({ ok: false, error: new Error('quota') }),
  });
  saver.start();
  saver.notify({ v: 1 });
  timers.fire();
  await saver.flush();
  assert.equal(log.statuses.includes('saved'), false);
  assert.equal(log.statuses.at(-1), 'error');
});

test('autosave : exception inattendue capturée', async () => {
  const { saver, timers, log } = makeSaver({
    write: async () => {
      throw new Error('boom');
    },
  });
  saver.start();
  saver.notify({ v: 1 });
  timers.fire();
  await saver.flush();
  assert.equal(log.statuses.at(-1), 'error');
});

test('autosave : flush écrit immédiatement l\'état en attente', async () => {
  const { saver, timers, log } = makeSaver();
  saver.start();
  saver.notify({ v: 1 });
  await saver.flush();
  assert.deepEqual(log.written, [{ v: 1 }]);
  assert.equal(timers.count(), 0);
});

test('autosave : dispose annule l\'écriture en attente', async () => {
  const { saver, timers, log } = makeSaver();
  saver.start();
  saver.notify({ v: 1 });
  saver.dispose();
  timers.fire();
  await saver.flush();
  assert.deepEqual(log.written, []);
  assert.equal(saver.notify({ v: 2 }), false);
});

const snapshot = { schemaVersion: 1, savedAt: 1, data: {} };

test('démarrage : aucune session = empty, restauration non appelée', async () => {
  let restored = false;
  const outcome = await loadInitialSession({
    read: async () => ({ status: 'empty' }),
    restore: async () => {
      restored = true;
      return { ok: true, state: {} };
    },
  });
  assert.deepEqual(outcome, { status: 'empty' });
  assert.equal(restored, false);
});

test('démarrage : erreur de lecture = blocked, rien n\'est restauré', async () => {
  let restored = false;
  const outcome = await loadInitialSession({
    read: async () => ({ status: 'error', error: Object.assign(new Error('x'), { code: 'read' }) }),
    restore: async () => {
      restored = true;
      return { ok: true, state: {} };
    },
  });
  assert.equal(outcome.status, 'blocked');
  assert.equal(restored, false);
});

test('démarrage : version inconnue = blocked avec message explicite', async () => {
  const outcome = await loadInitialSession({
    read: async () => ({
      status: 'error',
      error: Object.assign(new Error('v'), { code: 'unsupported-version' }),
    }),
  });
  assert.equal(outcome.status, 'blocked');
  assert.match(outcome.message, /incompatible/);
});

test('démarrage : lecture qui lève une exception = blocked', async () => {
  const outcome = await loadInitialSession({
    read: async () => {
      throw new Error('crash');
    },
  });
  assert.equal(outcome.status, 'blocked');
});

test('démarrage : échec de restauration = blocked', async () => {
  const outcome = await loadInitialSession({
    read: async () => ({ status: 'ok', snapshot }),
    restore: async () => ({
      ok: false,
      error: Object.assign(new Error('r'), { code: 'invalid-snapshot' }),
    }),
  });
  assert.equal(outcome.status, 'blocked');
  assert.match(outcome.message, /illisible/);
});

test('démarrage : restauration qui rejette sa promesse = blocked, pas de rejet', async () => {
  const outcome = await loadInitialSession({
    read: async () => ({ status: 'ok', snapshot }),
    restore: async () => {
      throw new Error('inattendu');
    },
  });
  assert.equal(outcome.status, 'blocked');
});

test('démarrage : restauration qui lève de façon synchrone = blocked, pas de rejet', async () => {
  const outcome = await loadInitialSession({
    read: async () => ({ status: 'ok', snapshot }),
    restore: () => {
      throw new Error('inattendu');
    },
  });
  assert.equal(outcome.status, 'blocked');
});

test('démarrage : restauration réussie = état fourni', async () => {
  const state = { subjects: [], board: { background: { image: null } } };
  const outcome = await loadInitialSession({
    read: async () => ({ status: 'ok', snapshot }),
    restore: async () => ({ ok: true, state }),
  });
  assert.deepEqual(outcome, { status: 'restored', state });
});

test('releaseRestoredUrls : libère les URL des sujets et du fond', () => {
  const revoked = [];
  releaseRestoredUrls(
    {
      subjects: [{ url: 'blob:a' }, { url: 'blob:b' }],
      board: { background: { image: { url: 'blob:bg' } } },
    },
    (url) => revoked.push(url),
  );
  assert.deepEqual(revoked, ['blob:a', 'blob:b', 'blob:bg']);
  const none = [];
  releaseRestoredUrls(
    { subjects: [], board: { background: { image: null } } },
    (url) => none.push(url),
  );
  assert.deepEqual(none, []);
});