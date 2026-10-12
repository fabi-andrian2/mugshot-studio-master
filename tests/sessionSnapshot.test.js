import test from 'node:test';
import assert from 'node:assert/strict';

import { serializeSession, restoreSession } from '../src/services/sessionSnapshot.js';
import { SCHEMA_VERSION } from '../src/services/persistence.js';

const pngBlob = (label) => new Blob([label], { type: 'image/png' });

const makeSubject = (id, overrides = {}) => ({
  id,
  url: `blob:${id}`,
  fileName: `${id}.png`,
  name: id,
  x: 700,
  y: 0,
  scale: 1.2,
  flipX: true,
  zIndex: 2,
  placement: 'manual',
  visible: false,
  silhouette: true,
  silhouetteColor: '#ef4444',
  silhouetteOpacity: 0.5,
  naturalW: 300,
  naturalH: 900,
  visibleBounds: { left: 0.1, top: 0.05, right: 0.9, bottom: 0.98 },
  groundAnchor: { x: 0.5, y: 0.98 },
  headAnchor: { x: 0.5, y: 0.06 },
  ...overrides,
});

const makeState = (overrides = {}) => ({
  canvasW: 2800,
  canvasH: 2200,
  unit: 'ft',
  subjects: [makeSubject('a'), makeSubject('b', { zIndex: 1, visible: true, silhouette: false })],
  board: {
    showGrid: false,
    background: {
      color: '#e9e4d8',
      image: { url: 'blob:bg', width: 1920, height: 1080, fileName: 'fond.jpg' },
    },
  },
  annotations: { enabled: true, scope: 'all' },
  mannequin: { visible: true, heightCm: 180, x: 400 },
  measure: {
    active: true,
    items: [{ id: 3, start: { x: 10, y: 20 }, end: { x: 30, y: 400 } }],
  },
  selectedId: 'a',
  measureDraft: { x: 1, y: 1 },
  ...overrides,
});

const makeFetch = (missing = []) => async (url) => {
  if (missing.includes(url)) throw new Error('introuvable');
  return pngBlob(url);
};

const fakeUrls = () => {
  const revoked = [];
  let n = 0;
  return {
    revoked,
    createUrl: () => `blob:restored-${(n += 1)}`,
    revokeUrl: (url) => revoked.push(url),
  };
};

test('serializeSession convertit les images en Blob et exclut les états temporaires', async () => {
  const result = await serializeSession(makeState(), { fetchBlob: makeFetch() });
  assert.equal(result.ok, true);
  const { data } = result;
  assert.ok(data.subjects[0].blob instanceof Blob);
  assert.ok(data.board.background.image.blob instanceof Blob);
  assert.equal('url' in data.subjects[0], false);
  assert.equal('url' in data.board.background.image, false);
  assert.equal('selectedId' in data, false);
  assert.equal('measureDraft' in data, false);
  assert.equal('active' in data.measure, false);
  assert.deepEqual(data.canvas, { width: 2800, height: 2200 });
  assert.equal(data.unit, 'ft');
});

test('aller-retour : propriétés, ordre, fond, annotations, mannequin et mesures conservés', async () => {
  const state = makeState();
  const { data } = await serializeSession(state, { fetchBlob: makeFetch() });
  const urls = fakeUrls();
  const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, urls);
  assert.equal(result.ok, true);
  const restored = result.state;

  assert.equal(restored.canvasW, 2800);
  assert.equal(restored.canvasH, 2200);
  assert.equal(restored.unit, 'ft');
  assert.deepEqual(restored.annotations, state.annotations);
  assert.deepEqual(restored.mannequin, state.mannequin);
  assert.deepEqual(restored.measure, { active: false, items: state.measure.items });
  assert.equal(restored.board.showGrid, false);
  assert.equal(restored.board.background.color, '#e9e4d8');
  assert.equal(restored.board.background.image.fileName, 'fond.jpg');
  assert.equal(restored.board.background.image.width, 1920);
  assert.match(restored.board.background.image.url, /^blob:restored-/);

  assert.deepEqual(restored.subjects.map((s) => s.id), ['a', 'b']);
  restored.subjects.forEach((subject, i) => {
    const { url, ...rest } = subject;
    const { url: oldUrl, ...before } = state.subjects[i];
    assert.match(url, /^blob:restored-/);
    assert.notEqual(url, oldUrl);
    assert.deepEqual(rest, before);
  });
});

test('fond uni : image null conservée', async () => {
  const state = makeState();
  state.board = { showGrid: true, background: { color: '#ffffff', image: null } };
  const { data } = await serializeSession(state, { fetchBlob: makeFetch() });
  const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, fakeUrls());
  assert.equal(result.ok, true);
  assert.equal(result.state.board.background.image, null);
});

test('session sans sujet : restaurable', async () => {
  const { data } = await serializeSession(makeState({ subjects: [] }), { fetchBlob: makeFetch() });
  const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, fakeUrls());
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.subjects, []);
});

test('image de sujet introuvable : aucun instantané partiel', async () => {
  const result = await serializeSession(makeState(), { fetchBlob: makeFetch(['blob:b']) });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'image-unavailable');
  assert.equal('data' in result, false);
});

test('image de fond introuvable : aucun instantané partiel', async () => {
  const result = await serializeSession(makeState(), { fetchBlob: makeFetch(['blob:bg']) });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'image-unavailable');
});

test('Blob vide ou non image : refusé', async () => {
  const empty = await serializeSession(makeState(), { fetchBlob: async () => new Blob([]) });
  assert.equal(empty.ok, false);
  const text = await serializeSession(makeState(), {
    fetchBlob: async () => new Blob(['x'], { type: 'text/plain' }),
  });
  assert.equal(text.ok, false);
  assert.equal(text.error.code, 'invalid-state');
});

test('état invalide : refusé', async () => {
  const bad = makeState({ canvasW: 10 });
  const result = await serializeSession(bad, { fetchBlob: makeFetch() });
  assert.equal(result.ok, false);
  assert.equal((await serializeSession(null)).ok, false);
});

test('restoreSession : version inconnue refusée', async () => {
  const result = await restoreSession({ schemaVersion: 99, savedAt: 1, data: {} }, fakeUrls());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'unsupported-version');
});

test('restoreSession : élément indispensable invalide, aucune URL créée', async () => {
  const { data } = await serializeSession(makeState(), { fetchBlob: makeFetch() });
  data.subjects[1].scale = 0;
  const urls = fakeUrls();
  let created = 0;
  const result = await restoreSession(
    { schemaVersion: SCHEMA_VERSION, savedAt: 1, data },
    { ...urls, createUrl: () => `blob:${(created += 1)}` },
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'invalid-snapshot');
  assert.equal(created, 0);
});

test('restoreSession : Blob manquant refusé', async () => {
  const { data } = await serializeSession(makeState(), { fetchBlob: makeFetch() });
  data.subjects[0].blob = undefined;
  const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, fakeUrls());
  assert.equal(result.ok, false);
});

test('restoreSession : identifiants en double refusés', async () => {
  const { data } = await serializeSession(makeState(), { fetchBlob: makeFetch() });
  data.subjects[1].id = data.subjects[0].id;
  const result = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, fakeUrls());
  assert.equal(result.ok, false);
});

test('restoreSession : échec en cours de route, URL déjà créées libérées', async () => {
  const { data } = await serializeSession(makeState(), { fetchBlob: makeFetch() });
  const revoked = [];
  let n = 0;
  const result = await restoreSession(
    { schemaVersion: SCHEMA_VERSION, savedAt: 1, data },
    {
      createUrl: () => {
        n += 1;
        if (n === 3) throw new Error('échec');
        return `blob:r${n}`;
      },
      revokeUrl: (url) => revoked.push(url),
    },
  );
  assert.equal(result.ok, false);
  assert.deepEqual(revoked, ['blob:r1', 'blob:r2']);
});