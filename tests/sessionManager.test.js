import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionManager } from '../src/services/sessionManager.js';

const BLANK = { blank: true };

const makeHarness = ({ load, replace, onRestore } = {}) => {
  const log = [];
  const saver = {
    start: () => log.push('start'),
    notify: (state) => {
      log.push(['notify', state]);
      return true;
    },
    flush: () => {
      log.push('flush');
      return Promise.resolve();
    },
    dispose: () => log.push('dispose'),
  };
  const phases = [];
  const problems = [];
  const released = [];
  const statuses = [];
  const manager = createSessionManager({
    load: load ?? (async () => ({ status: 'empty' })),
    replace: replace ?? (async () => ({ ok: true, savedAt: 1 })),
    createBlank: () => BLANK,
    createSaver: () => saver,
    release: (state) => released.push(state),
    logError: () => {},
    onRestore: (state) => {
      log.push('restore');
      if (onRestore) onRestore(state);
    },
    onPhase: (phase) => phases.push(phase),
    onProblem: (message) => problems.push(message),
    onSaveStatus: (status) => statuses.push(status.status),
  });
  return { manager, log, phases, problems, released, statuses };
};

const notifies = (log) => log.filter((entry) => Array.isArray(entry) && entry[0] === 'notify');

test('chargement : aucune sauvegarde transmise avant la fin de l\'initialisation', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { manager, log } = makeHarness({
    load: async () => {
      await gate;
      return { status: 'empty' };
    },
  });
  const init = manager.init();
  assert.equal(manager.getPhase(), 'loading');
  assert.equal(manager.notify({ v: 0 }), false);
  assert.deepEqual(log, []);
  release();
  await init;
  assert.equal(manager.getPhase(), 'ready');
  assert.deepEqual(log, ['start']);
});

test('session vide : démarrage normal, premier changement sauvegardé', async () => {
  const { manager, log } = makeHarness();
  await manager.init();
  assert.equal(manager.notify({ v: 1 }), true);
  assert.deepEqual(notifies(log), [['notify', { v: 1 }]]);
});

test('session restaurée : restauration avant start(), état restauré non réécrit, changements suivants sauvegardés', async () => {
  const state = { subjects: [] };
  const { manager, log } = makeHarness({ load: async () => ({ status: 'restored', state }) });
  await manager.init();
  assert.deepEqual(log, ['restore', 'start']);
  assert.equal(manager.notify({ v: 'restauré' }), false);
  assert.equal(manager.notify({ v: 'modifié' }), true);
  assert.deepEqual(notifies(log), [['notify', { v: 'modifié' }]]);
});

test('session bloquée : sauvegarde jamais démarrée, aucune écriture, message fourni', async () => {
  const { manager, log, problems, phases } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'version incompatible' }),
  });
  await manager.init();
  assert.deepEqual(phases, ['blocked']);
  assert.deepEqual(problems, ['version incompatible']);
  assert.equal(manager.notify({ v: 1 }), false);
  assert.equal(manager.notify({ v: 2 }), false);
  await manager.flush();
  assert.deepEqual(log, []);
});

test('lecture qui rejette sa promesse : bloqué, aucune écriture', async () => {
  const { manager, log, phases } = makeHarness({
    load: async () => {
      throw new Error('crash');
    },
  });
  await manager.init();
  assert.deepEqual(phases, ['blocked']);
  assert.equal(manager.notify({ v: 1 }), false);
  assert.deepEqual(log, []);
});

test('application de la restauration qui échoue : bloqué, URL libérées, aucune écriture', async () => {
  const state = { subjects: [{ url: 'blob:a' }] };
  const { manager, log, phases, released } = makeHarness({
    load: async () => ({ status: 'restored', state }),
    onRestore: () => {
      throw new Error('setState impossible');
    },
  });
  await manager.init();
  assert.deepEqual(phases, ['blocked']);
  assert.deepEqual(released, [state]);
  assert.equal(manager.notify({ v: 1 }), false);
  assert.deepEqual(log, ['restore']);
});

test('démontage pendant l\'initialisation : rien n\'est appliqué, URL libérées', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const state = { subjects: [] };
  const { manager, log, phases, released } = makeHarness({
    load: async () => {
      await gate;
      return { status: 'restored', state };
    },
  });
  const init = manager.init();
  manager.dispose();
  release();
  await init;
  assert.deepEqual(released, [state]);
  assert.deepEqual(phases, []);
  assert.deepEqual(log, ['dispose']);
});

test('nouvelle session : une modification faite pendant le blocage n\'est ni écrite ni conservée', async () => {
  const order = [];
  const { manager, log, phases, statuses } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    replace: async (state) => {
      order.push(['replace', state]);
      return { ok: true, savedAt: 42 };
    },
    onRestore: (state) => order.push(['apply', state]),
  });
  await manager.init();
  manager.notify({ modifie: 'pendant le blocage' });
  assert.equal(await manager.discard(), true);
  assert.deepEqual(order, [
    ['replace', BLANK],
    ['apply', BLANK],
  ]);
  assert.equal(order[0][1], order[1][1]);
  assert.deepEqual(phases, ['blocked', 'ready']);
  assert.deepEqual(statuses, ['saved']);
  assert.deepEqual(log, ['restore', 'start']);
  assert.equal(manager.notify(BLANK), false);
  assert.equal(manager.notify({ v: 'suite' }), true);
  assert.deepEqual(notifies(log), [['notify', { v: 'suite' }]]);
});

test('nouvelle session : passage à ready seulement après confirmation de l\'écriture', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { manager, log, phases } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    replace: async () => {
      await gate;
      return { ok: true, savedAt: 1 };
    },
  });
  await manager.init();
  const pendingDiscard = manager.discard();
  assert.equal(manager.getPhase(), 'blocked');
  assert.deepEqual(log, []);
  release();
  await pendingDiscard;
  assert.deepEqual(phases, ['blocked', 'ready']);
});

test('nouvelle session : un changement survenu pendant l\'écriture est écarté, jamais sauvegardé', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { manager, log } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    replace: async () => {
      await gate;
      return { ok: true, savedAt: 1 };
    },
  });
  await manager.init();
  const pendingDiscard = manager.discard();
  assert.equal(manager.notify({ v: 'pendant écriture' }), false);
  release();
  await pendingDiscard;
  assert.equal(manager.notify(BLANK), false);
  assert.deepEqual(notifies(log), []);
});

test('nouvelle session : échec d\'écriture = reste bloqué, rien n\'est appliqué, ancienne sauvegarde conservée', async () => {
  const applied = [];
  const { manager, log, phases, problems, statuses } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    replace: async () => ({ ok: false, error: new Error('quota') }),
    onRestore: (state) => applied.push(state),
  });
  await manager.init();
  manager.notify({ v: 1 });
  assert.equal(await manager.discard(), false);
  assert.deepEqual(phases, ['blocked']);
  assert.deepEqual(statuses, []);
  assert.deepEqual(applied, []);
  assert.match(problems.at(-1), /quota/);
  assert.match(problems.at(-1), /précédente est conservée/);
  assert.equal(manager.notify({ v: 2 }), false);
  assert.deepEqual(log, []);
});

test('nouvelle session : exception ou rejet = traité comme un échec, rien n\'est appliqué', async () => {
  const applied = [];
  const { manager, log, phases, problems } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    replace: async () => {
      throw new Error('crash');
    },
    onRestore: (state) => applied.push(state),
  });
  await manager.init();
  assert.equal(await manager.discard(), false);
  assert.deepEqual(phases, ['blocked']);
  assert.deepEqual(applied, []);
  assert.match(problems.at(-1), /crash/);
  assert.deepEqual(log, []);
});

test('nouvelle session : après un échec, une nouvelle tentative réussie est possible', async () => {
  let calls = 0;
  const { manager, phases } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    replace: async () => {
      calls += 1;
      return calls === 1 ? { ok: false, error: new Error('verrouillé') } : { ok: true, savedAt: 1 };
    },
  });
  await manager.init();
  assert.equal(await manager.discard(), false);
  assert.equal(await manager.discard(), true);
  assert.deepEqual(phases, ['blocked', 'ready']);
});

test('nouvelle session : écriture réussie mais application impossible = reste bloqué, sauvegarde non démarrée', async () => {
  const { manager, log, phases, problems, statuses } = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    onRestore: () => {
      throw new Error('setState impossible');
    },
  });
  await manager.init();
  assert.equal(await manager.discard(), false);
  assert.deepEqual(phases, ['blocked']);
  assert.deepEqual(statuses, []);
  assert.match(problems.at(-1), /recharge la page/);
  assert.equal(manager.notify({ v: 1 }), false);
  assert.deepEqual(log, ['restore']);
});

test('nouvelle session : ignorée hors état bloqué, double appel ignoré', async () => {
  let called = 0;
  const ready = makeHarness({
    replace: async () => {
      called += 1;
      return { ok: true, savedAt: 1 };
    },
  });
  await ready.manager.init();
  assert.equal(await ready.manager.discard(), false);
  assert.equal(called, 0);

  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const blocked = makeHarness({
    load: async () => ({ status: 'blocked', message: 'illisible' }),
    replace: async () => {
      called += 1;
      await gate;
      return { ok: true, savedAt: 1 };
    },
  });
  await blocked.manager.init();
  const first = blocked.manager.discard();
  assert.equal(await blocked.manager.discard(), false);
  release();
  assert.equal(await first, true);
  assert.equal(called, 1);
});

test('flush : transmis seulement quand la sauvegarde est active', async () => {
  const { manager, log } = makeHarness();
  await manager.flush();
  assert.deepEqual(log, []);
  await manager.init();
  await manager.flush();
  assert.deepEqual(log, ['start', 'flush']);
});