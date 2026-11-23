import test from 'node:test';
import assert from 'node:assert/strict';

import { createCloseRequestHandler } from '../src/services/closeGuard.js';

const make = ({ flush, quit = false, timeoutMs = 50 } = {}) => {
  const log = [];
  const handler = createCloseRequestHandler({
    flush: flush ?? (async () => ({ ok: true })),
    confirmQuitWithoutSaving: async (e) => {
      log.push(['confirm', e?.code]);
      return quit;
    },
    destroy: async () => log.push('destroy'),
    timeoutMs,
  });
  const event = { preventDefault: () => log.push('prevent') };
  return { handler, event, log };
};

test('fermeture bloquée immédiatement puis fenêtre détruite après sauvegarde', async () => {
  const { handler, event, log } = make();
  assert.equal(await handler(event), 'closed');
  assert.deepEqual(log, ['prevent', 'destroy']);
});

test('échec de sauvegarde : on reste, sauf « quitter sans enregistrer »', async () => {
  const flush = async () => ({ ok: false, error: { code: 'quota' } });
  const a = make({ flush });
  assert.equal(await a.handler(a.event), 'stayed');
  assert.deepEqual(a.log, ['prevent', ['confirm', 'quota']]);
  const b = make({ flush, quit: true });
  assert.equal(await b.handler(b.event), 'closed-unsaved');
  assert.equal(b.log.at(-1), 'destroy');
});

test('sauvegarde qui ne répond pas : délai puis demande à l’utilisateur', async () => {
  const { handler, event, log } = make({ flush: () => new Promise(() => {}) });
  assert.equal(await handler(event), 'stayed');
  assert.deepEqual(log[1], ['confirm', 'timeout']);
});

test('flush qui lève une exception : traité comme un échec', async () => {
  const { handler, event } = make({
    flush: async () => {
      throw new Error('x');
    },
  });
  assert.equal(await handler(event), 'stayed');
});

test('double demande de fermeture simultanée ignorée', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const { handler, event } = make({ flush: async () => (await gate, { ok: true }), timeoutMs: 1000 });
  const first = handler(event);
  assert.equal(await handler(event), 'busy');
  release();
  assert.equal(await first, 'closed');
});
