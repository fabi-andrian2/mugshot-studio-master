import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BOARD,
  DEFAULT_FRAMING,
  FRAMING_LIMITS,
  getCoverRect,
  getFramingAxes,
  isDefaultFraming,
  normalizeFraming,
  setBackgroundColor,
  setBackgroundFraming,
  setBackgroundImage,
} from '../src/domain/board.js';
import { restoreSession, serializeSession } from '../src/services/sessionSnapshot.js';
import { SCHEMA_VERSION } from '../src/services/persistence.js';
import { drawBackground } from '../src/services/export.js';

const IMAGE = { url: 'blob:x', width: 1600, height: 900, fileName: 'x.jpg' };

const close = (actual, expected, message) => {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} ${actual} ≠ ${expected}`);
};

const legacyCoverRect = (imageW, imageH, canvasW, canvasH) => {
  const scale = Math.max(canvasW / imageW, canvasH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { left: (canvasW - width) / 2, top: (canvasH - height) / 2, width, height };
};

const SIZES = [
  [1600, 900],
  [900, 1600],
  [1000, 1000],
  [3, 7],
  [4096, 512],
  [333, 4000],
];
const CANVASES = [
  [1400, 2200],
  [2800, 2200],
  [600, 800],
  [2000, 2000],
  [1234, 987],
];

test('cadrage : valeurs par défaut conformes aux limites annoncées', () => {
  assert.deepEqual(DEFAULT_FRAMING, { zoom: 1, x: 0.5, y: 0.5 });
  assert.equal(FRAMING_LIMITS.minZoom, 1);
  assert.equal(FRAMING_LIMITS.maxZoom, 4);
  assert.equal(FRAMING_LIMITS.minPosition, 0);
  assert.equal(FRAMING_LIMITS.maxPosition, 1);
  assert.equal(isDefaultFraming(undefined), true);
  assert.equal(isDefaultFraming({ zoom: 1, x: 0.5, y: 0.5 }), true);
  assert.equal(isDefaultFraming({ zoom: 1.01, x: 0.5, y: 0.5 }), false);
});

test('cadrage par défaut : identique à l\'ancien comportement, sans écart sur toutes les tailles', () => {
  for (const [imageW, imageH] of SIZES) {
    for (const [canvasW, canvasH] of CANVASES) {
      const expected = legacyCoverRect(imageW, imageH, canvasW, canvasH);
      for (const framing of [undefined, null, {}, DEFAULT_FRAMING, { zoom: 'x', x: NaN, y: Infinity }]) {
        const rect = getCoverRect(imageW, imageH, canvasW, canvasH, framing);
        assert.deepEqual(rect, expected, `${imageW}x${imageH} sur ${canvasW}x${canvasH}`);
      }
    }
  }
});

test('cadrage : images larges, hautes et de même ratio, aux bords', () => {
  const wide = getCoverRect(2000, 1000, 1000, 1000, { zoom: 1, x: 0, y: 0 });
  assert.deepEqual(wide, { left: 0, top: 0, width: 2000, height: 1000 });
  const wideEnd = getCoverRect(2000, 1000, 1000, 1000, { zoom: 1, x: 1, y: 1 });
  assert.deepEqual(wideEnd, { left: -1000, top: 0, width: 2000, height: 1000 });

  const tall = getCoverRect(1000, 2000, 1000, 1000, { zoom: 1, x: 0, y: 0 });
  assert.deepEqual(tall, { left: 0, top: 0, width: 1000, height: 2000 });
  const tallEnd = getCoverRect(1000, 2000, 1000, 1000, { zoom: 1, x: 1, y: 1 });
  assert.deepEqual(tallEnd, { left: 0, top: -1000, width: 1000, height: 2000 });

  const same = getCoverRect(500, 500, 1000, 1000, { zoom: 1, x: 0, y: 1 });
  assert.deepEqual(same, { left: 0, top: 0, width: 1000, height: 1000 });
});

test('cadrage : le zoom agrandit sans déformer et la position choisit la partie visible', () => {
  const base = getCoverRect(1600, 900, 1400, 2200);
  const zoomed = getCoverRect(1600, 900, 1400, 2200, { zoom: 2, x: 0.5, y: 0.5 });
  close(zoomed.width, base.width * 2);
  close(zoomed.height, base.height * 2);
  close(zoomed.width / zoomed.height, 1600 / 900);
  close(zoomed.left + zoomed.width / 2, 700);
  close(zoomed.top + zoomed.height / 2, 1100);

  const start = getCoverRect(1600, 900, 1400, 2200, { zoom: 3, x: 0, y: 0 });
  assert.equal(start.left, 0);
  assert.equal(start.top, 0);
  const end = getCoverRect(1600, 900, 1400, 2200, { zoom: 3, x: 1, y: 1 });
  close(end.left + end.width, 1400);
  close(end.top + end.height, 2200);

  const quarter = getCoverRect(1600, 900, 1400, 2200, { zoom: 3, x: 0.25, y: 0.75 });
  close(quarter.left, (1400 - quarter.width) * 0.25);
  close(quarter.top, (2200 - quarter.height) * 0.75);
});

test('cadrage : la planche reste toujours entièrement couverte, ratio conservé', () => {
  const framings = [
    { zoom: 1, x: 0, y: 0 },
    { zoom: 1, x: 1, y: 1 },
    { zoom: 1.7, x: 0.31, y: 0.9 },
    { zoom: 4, x: 0, y: 1 },
    { zoom: 4, x: 1, y: 0 },
  ];
  for (const [imageW, imageH] of SIZES) {
    for (const [canvasW, canvasH] of CANVASES) {
      for (const framing of framings) {
        const rect = getCoverRect(imageW, imageH, canvasW, canvasH, framing);
        assert.ok(rect.left <= 1e-6 && rect.top <= 1e-6);
        assert.ok(rect.left + rect.width >= canvasW - 1e-6);
        assert.ok(rect.top + rect.height >= canvasH - 1e-6);
        close(rect.width / rect.height, imageW / imageH);
      }
    }
  }
});

test('cadrage : une position relative garde le même sens quand le format de la planche change', () => {
  const framing = { zoom: 2, x: 0.25, y: 0.8 };
  for (const [canvasW, canvasH] of CANVASES) {
    const rect = getCoverRect(1600, 900, canvasW, canvasH, framing);
    const overflowX = rect.width - canvasW;
    const overflowY = rect.height - canvasH;
    close(-rect.left / overflowX, 0.25);
    close(-rect.top / overflowY, 0.8);
  }
});

test('cadrage : valeurs hors bornes ramenées aux bornes, valeurs invalides au défaut', () => {
  assert.deepEqual(normalizeFraming({ zoom: 0.2, x: -3, y: 9 }), { zoom: 1, x: 0, y: 1 });
  assert.deepEqual(normalizeFraming({ zoom: 99, x: 0.3, y: 0.4 }), { zoom: 4, x: 0.3, y: 0.4 });
  assert.deepEqual(normalizeFraming({ zoom: NaN, x: Infinity, y: -Infinity }), { zoom: 1, x: 0.5, y: 0.5 });
  assert.deepEqual(normalizeFraming({ zoom: '2', x: null, y: undefined }), DEFAULT_FRAMING);
  assert.deepEqual(normalizeFraming({ zoom: 2 }), { zoom: 2, x: 0.5, y: 0.5 });
  for (const bad of [undefined, null, 12, 'texte', true, []]) {
    assert.deepEqual(normalizeFraming(bad), DEFAULT_FRAMING);
  }
  const rect = getCoverRect(1600, 900, 1400, 2200, { zoom: -5, x: 'a', y: 50 });
  assert.ok(Number.isFinite(rect.left) && Number.isFinite(rect.top));
  assert.ok(rect.width > 0 && rect.height > 0);
  assert.deepEqual(normalizeFraming(normalizeFraming({ zoom: 7, x: -1, y: 2 })), { zoom: 4, x: 0, y: 1 });
});

test('cadrage : dimensions d\'image invalides, planche inchangée', () => {
  const full = { left: 0, top: 0, width: 1000, height: 800 };
  assert.deepEqual(getCoverRect(0, 0, 1000, 800, { zoom: 3, x: 0, y: 0 }), full);
  assert.deepEqual(getCoverRect(-4, 10, 1000, 800), full);
});

test('setBackgroundFraming : fusionne, borne, et retire la clé au cadrage par défaut', () => {
  const board = setBackgroundImage(DEFAULT_BOARD, IMAGE);
  assert.equal('framing' in board.background.image, false);

  const zoomed = setBackgroundFraming(board, { zoom: 2.5 });
  assert.deepEqual(zoomed.background.image.framing, { zoom: 2.5, x: 0.5, y: 0.5 });
  assert.equal(board.background.image, IMAGE);

  const moved = setBackgroundFraming(zoomed, { x: 0.1, y: 7 });
  assert.deepEqual(moved.background.image.framing, { zoom: 2.5, x: 0.1, y: 1 });
  assert.equal(moved.background.image.url, IMAGE.url);
  assert.equal(moved.background.color, DEFAULT_BOARD.background.color);

  const reset = setBackgroundFraming(moved, DEFAULT_FRAMING);
  assert.equal('framing' in reset.background.image, false);
  assert.deepEqual(reset.background.image, IMAGE);
});

test('setBackgroundFraming : sans effet sans image, sans changement ou avec un patch invalide', () => {
  assert.equal(setBackgroundFraming(DEFAULT_BOARD, { zoom: 2 }), DEFAULT_BOARD);

  const board = setBackgroundImage(DEFAULT_BOARD, IMAGE);
  assert.equal(setBackgroundFraming(board, DEFAULT_FRAMING), board);
  assert.equal(setBackgroundFraming(board, {}), board);
  assert.equal(setBackgroundFraming(board, null), board);
  assert.equal(setBackgroundFraming(board, 'zoom'), board);

  const zoomed = setBackgroundFraming(board, { zoom: 2 });
  assert.equal(setBackgroundFraming(zoomed, { zoom: 2 }), zoomed);
  assert.equal(setBackgroundFraming(zoomed, { zoom: 'abc' }), zoomed);
  assert.equal(setBackgroundFraming(zoomed, { zoom: 99 }).background.image.framing.zoom, 4);
});

test('cadrage : remplacer l\'image le réinitialise, retirer l\'image ou choisir un fond uni l\'efface', () => {
  const framed = setBackgroundFraming(setBackgroundImage(DEFAULT_BOARD, IMAGE), { zoom: 3, x: 0.2, y: 0.9 });
  assert.ok(framed.background.image.framing);

  const replacement = { url: 'blob:y', width: 800, height: 1200, fileName: 'y.png' };
  const replaced = setBackgroundImage(framed, replacement);
  assert.equal(replaced.background.image, replacement);
  assert.equal('framing' in replaced.background.image, false);

  const carried = setBackgroundImage(framed, { ...replacement, framing: { zoom: 2, x: 0, y: 0 } });
  assert.equal('framing' in carried.background.image, false);

  assert.equal(setBackgroundImage(framed, null).background.image, null);
  assert.equal(setBackgroundColor(framed, '#ffffff').background.image, null);
  assert.equal(setBackgroundImage(setBackgroundImage(framed, null), IMAGE).background.image, IMAGE);
});

test('axes mobiles : aucun déplacement possible quand l\'image épouse déjà la planche', () => {
  assert.deepEqual(getFramingAxes(null, 1400, 2200), { horizontal: false, vertical: false });
  assert.deepEqual(getFramingAxes({ width: 0, height: 0 }, 1400, 2200), { horizontal: false, vertical: false });

  const square = { width: 500, height: 500 };
  assert.deepEqual(getFramingAxes(square, 1000, 1000), { horizontal: false, vertical: false });
  assert.deepEqual(getFramingAxes({ ...square, framing: { zoom: 2, x: 0, y: 0 } }, 1000, 1000), {
    horizontal: true,
    vertical: true,
  });
});

test('axes mobiles : seul l\'axe en excès est mobile, et ils suivent le format de la planche', () => {
  const wide = { width: 2000, height: 1000 };
  assert.deepEqual(getFramingAxes(wide, 1000, 1000), { horizontal: true, vertical: false });
  const tall = { width: 1000, height: 2000 };
  assert.deepEqual(getFramingAxes(tall, 1000, 1000), { horizontal: false, vertical: true });

  assert.deepEqual(getFramingAxes(wide, 2000, 1000), { horizontal: false, vertical: false });
  assert.deepEqual(getFramingAxes(wide, 1000, 2000), { horizontal: true, vertical: false });
  assert.deepEqual(getFramingAxes(wide, 3000, 1000), { horizontal: false, vertical: true });
});

const pngBlob = (label) => new Blob([label], { type: 'image/png' });
const fetchBlob = async (url) => pngBlob(url);

const makeSubject = () => ({
  id: 'a',
  url: 'blob:a',
  fileName: 'a.png',
  name: 'A',
  x: 700,
  y: 0,
  scale: 1.2,
  flipX: false,
  zIndex: 1,
  placement: 'auto',
  visible: true,
  silhouette: false,
  naturalW: 300,
  naturalH: 900,
  visibleBounds: { left: 0.1, top: 0.05, right: 0.9, bottom: 0.98 },
  groundAnchor: { x: 0.5, y: 0.98 },
  headAnchor: { x: 0.5, y: 0.06 },
});

const makeState = (framing) => ({
  canvasW: 1400,
  canvasH: 2200,
  unit: 'cm',
  subjects: [makeSubject()],
  board: {
    showGrid: true,
    title: 'Titre',
    background: {
      color: '#e9e4d8',
      image: framing === undefined ? { ...IMAGE } : { ...IMAGE, framing },
    },
  },
  annotations: { enabled: true, scope: 'all' },
  mannequin: { visible: false, heightCm: 180, x: 400 },
  measure: { active: false, items: [] },
});

const urls = () => {
  let n = 0;
  return { createUrl: () => `blob:restored-${(n += 1)}`, revokeUrl: () => {} };
};

const roundTrip = async (state, mutate = (data) => data) => {
  const serialized = await serializeSession(state, { fetchBlob });
  assert.equal(serialized.ok, true);
  const data = mutate(structuredClone(serialized.data));
  return restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data }, urls());
};

test('persistance : un cadrage personnalisé est sauvegardé puis restauré à l\'identique', async () => {
  const framing = { zoom: 2.5, x: 0.2, y: 0.9 };
  const serialized = await serializeSession(makeState(framing), { fetchBlob });
  assert.equal(serialized.ok, true);
  assert.deepEqual(serialized.data.board.background.image.framing, framing);

  const restored = await roundTrip(makeState(framing));
  assert.equal(restored.ok, true);
  const image = restored.state.board.background.image;
  assert.deepEqual(image.framing, framing);
  assert.equal(image.width, IMAGE.width);
  assert.equal(image.height, IMAGE.height);
  assert.equal(image.fileName, IMAGE.fileName);
  assert.equal(restored.state.board.background.color, '#e9e4d8');
  assert.equal(restored.state.subjects.length, 1);
  assert.equal(restored.state.canvasW, 1400);
});

test('persistance : le cadrage par défaut n\'ajoute aucune clé, comme avant', async () => {
  for (const framing of [undefined, DEFAULT_FRAMING, {}, { zoom: 'x' }]) {
    const serialized = await serializeSession(makeState(framing), { fetchBlob });
    assert.equal('framing' in serialized.data.board.background.image, false);
    const restored = await roundTrip(makeState(framing));
    assert.equal('framing' in restored.state.board.background.image, false);
  }
});

test('persistance : une ancienne session sans cadrage est restaurée au cadrage d\'origine', async () => {
  const restored = await roundTrip(makeState({ zoom: 3, x: 0, y: 0 }), (data) => {
    delete data.board.background.image.framing;
    assert.equal('framing' in data.board.background.image, false);
    return data;
  });
  assert.equal(restored.ok, true);
  const image = restored.state.board.background.image;
  assert.equal('framing' in image, false);
  assert.deepEqual(
    getCoverRect(image.width, image.height, 1400, 2200, image.framing),
    getCoverRect(image.width, image.height, 1400, 2200),
  );
});

test('persistance : un fond uni sans image reste valide', async () => {
  const state = makeState();
  state.board.background.image = null;
  const restored = await roundTrip(state);
  assert.equal(restored.ok, true);
  assert.equal(restored.state.board.background.image, null);
});

test('persistance : valeurs hors bornes normalisées, valeurs invalides ignorées sans refuser la session', async () => {
  const outOfRange = await roundTrip(makeState({ zoom: 2, x: 0.5, y: 0.5 }), (data) => {
    data.board.background.image.framing = { zoom: 99, x: -4, y: 12 };
    return data;
  });
  assert.equal(outOfRange.ok, true);
  assert.deepEqual(outOfRange.state.board.background.image.framing, { zoom: 4, x: 0, y: 1 });

  for (const bad of ['zoom', 12, null, [], { zoom: 'a', x: NaN, y: {} }]) {
    const restored = await roundTrip(makeState({ zoom: 2, x: 0.5, y: 0.5 }), (data) => {
      data.board.background.image.framing = bad;
      return data;
    });
    assert.equal(restored.ok, true, JSON.stringify(bad));
    const image = restored.state.board.background.image;
    assert.equal('framing' in image, false);
    const rect = getCoverRect(image.width, image.height, 1400, 2200, image.framing);
    assert.ok(Number.isFinite(rect.left) && Number.isFinite(rect.width) && rect.width > 0);
  }
});

test('persistance : la sérialisation ne modifie pas l\'état de la planche', async () => {
  const state = makeState({ zoom: 2, x: 0.1, y: 0.2 });
  const before = JSON.stringify(state);
  await serializeSession(state, { fetchBlob });
  assert.equal(JSON.stringify(state), before);
});

const makeCtx = () => {
  const calls = { fills: [], draws: [] };
  return {
    calls,
    set fillStyle(value) {
      calls.fillStyle = value;
    },
    fillRect: (...args) => calls.fills.push(args),
    drawImage: (...args) => calls.draws.push(args),
  };
};

const loadNatural = (width, height) => async () => ({ naturalWidth: width, naturalHeight: height });

test('export : le fond est tracé au même rectangle que le canvas, cadrage par défaut compris', async () => {
  const ctx = makeCtx();
  const background = { color: '#f2f2f4', image: { ...IMAGE } };
  await drawBackground(ctx, background, 1400, 2200, loadNatural(IMAGE.width, IMAGE.height));
  const rect = getCoverRect(IMAGE.width, IMAGE.height, 1400, 2200, background.image.framing);
  assert.deepEqual(ctx.calls.draws, [[{ naturalWidth: IMAGE.width, naturalHeight: IMAGE.height }, rect.left, rect.top, rect.width, rect.height]]);
  assert.deepEqual(rect, legacyCoverRect(IMAGE.width, IMAGE.height, 1400, 2200));
  assert.deepEqual(ctx.calls.fills, [[0, 0, 1400, 2200]]);
  assert.equal(ctx.calls.fillStyle, '#f2f2f4');
});

test('export : un cadrage personnalisé donne exactement le rectangle calculé pour le canvas', async () => {
  const framings = [
    { zoom: 2, x: 0.5, y: 0.5 },
    { zoom: 1, x: 0, y: 0 },
    { zoom: 3.2, x: 0.8, y: 0.1 },
    { zoom: 4, x: 1, y: 1 },
  ];
  for (const [canvasW, canvasH] of CANVASES) {
    for (const framing of framings) {
      const ctx = makeCtx();
      const image = { ...IMAGE, framing };
      await drawBackground(ctx, { color: '#ffffff', image }, canvasW, canvasH, loadNatural(image.width, image.height));
      const [, left, top, width, height] = ctx.calls.draws[0];
      assert.deepEqual(
        { left, top, width, height },
        getCoverRect(image.width, image.height, canvasW, canvasH, image.framing),
      );
    }
  }
});

test('export : cadrage invalide, rendu fini ; fond uni, aucune image tracée ; image illisible, erreur claire', async () => {
  const ctx = makeCtx();
  const image = { ...IMAGE, framing: { zoom: 'x', x: NaN, y: 99 } };
  await drawBackground(ctx, { color: '#ffffff', image }, 1400, 2200, loadNatural(IMAGE.width, IMAGE.height));
  const [, left, top, width, height] = ctx.calls.draws[0];
  assert.ok([left, top, width, height].every(Number.isFinite) && width > 0 && height > 0);

  const plain = makeCtx();
  await drawBackground(plain, { color: '#123456', image: null }, 1400, 2200);
  assert.equal(plain.calls.draws.length, 0);
  assert.equal(plain.calls.fillStyle, '#123456');

  await assert.rejects(
    drawBackground(makeCtx(), { color: '#ffffff', image: { ...IMAGE } }, 1400, 2200, async () => {
      throw new Error('échec');
    }),
    /Image de fond illisible \(x\.jpg\)/,
  );
});