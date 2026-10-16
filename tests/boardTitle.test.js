import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BOARD,
  DEFAULT_BOARD_TITLE,
  MAX_BOARD_TITLE_LENGTH,
  normalizeBoardTitle,
  setBoardTitle,
  setBackgroundColor,
  toggleGrid,
} from '../src/domain/board.js';
import { createBlankState } from '../src/domain/blankSession.js';
import {
  TITLE_FONT_SIZE,
  TITLE_BASELINE_Y,
  TITLE_SIDE_MARGIN,
  getBoardTitleLayout,
} from '../src/domain/boardTitle.js';
import { getExportLayers } from '../src/domain/exportPlan.js';
import { serializeSession, restoreSession } from '../src/services/sessionSnapshot.js';
import { SCHEMA_VERSION } from '../src/services/persistence.js';

const measure = (text, fontSize) => Array.from(text).length * fontSize * 0.5;

const lineWidth = (line) =>
  line.textLength ?? ((measure(line.text, TITLE_FONT_SIZE) + Array.from(line.text).length * 3) * line.fontSize) / TITLE_FONT_SIZE;

const pngBlob = (label) => new Blob([label], { type: 'image/png' });

const makeStateWithTitle = (title) => ({
  ...createBlankState(),
  subjects: [
    {
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
    },
  ],
  board: { ...createBlankState().board, ...(title === undefined ? {} : { title }), showGrid: false },
});

const fetchBlob = async (url) => pngBlob(url);

test('titre : une planche neuve reçoit le titre par défaut, sans préfixe de marque', () => {
  assert.equal(DEFAULT_BOARD_TITLE, 'Comparaison de tailles');
  assert.equal(DEFAULT_BOARD.title, DEFAULT_BOARD_TITLE);
  assert.equal(createBlankState().board.title, DEFAULT_BOARD_TITLE);
});

test('titre : mise à jour sans toucher au fond, à la grille ni à l’objet source', () => {
  const board = Object.freeze({ ...DEFAULT_BOARD, background: Object.freeze({ ...DEFAULT_BOARD.background }) });
  const next = setBoardTitle(board, 'Les Générations Miracles de Kuroko');
  assert.equal(next.title, 'Les Générations Miracles de Kuroko');
  assert.equal(board.title, DEFAULT_BOARD_TITLE);
  assert.equal(next.background, board.background);
  assert.equal(next.showGrid, board.showGrid);
  assert.equal(setBoardTitle(next, 'Les Générations Miracles de Kuroko'), next);

  const styled = toggleGrid(setBackgroundColor(next, '#ffffff'));
  assert.equal(styled.title, next.title);
});

test('titre : texte vide conservé tel quel, valeur non textuelle ignorée', () => {
  const board = { ...DEFAULT_BOARD };
  assert.equal(setBoardTitle(board, '').title, '');
  assert.equal(setBoardTitle(board, '   ').title, '   ');
  [undefined, null, 12, {}, []].forEach((bad) => {
    assert.equal(setBoardTitle(board, bad), board);
  });
  assert.equal(normalizeBoardTitle(undefined), DEFAULT_BOARD_TITLE);
  assert.equal(normalizeBoardTitle(null), DEFAULT_BOARD_TITLE);
  assert.equal(normalizeBoardTitle(''), '');
});

test('titre : longueur limitée en caractères, retours à la ligne et contrôles neutralisés', () => {
  const long = 'x'.repeat(MAX_BOARD_TITLE_LENGTH + 40);
  assert.equal(Array.from(setBoardTitle(DEFAULT_BOARD, long).title).length, MAX_BOARD_TITLE_LENGTH);

  const emoji = '😀'.repeat(MAX_BOARD_TITLE_LENGTH + 5);
  assert.equal(Array.from(normalizeBoardTitle(emoji)).length, MAX_BOARD_TITLE_LENGTH);
  assert.equal(normalizeBoardTitle(emoji).includes('\ufffd'), false);

  assert.equal(normalizeBoardTitle('Ligne 1\nLigne 2\t!'), 'Ligne 1 Ligne 2 !');
});

test('titre : conservé par la sérialisation et la restauration', async () => {
  const state = makeStateWithTitle('Les Générations Miracles de Kuroko');
  const serialized = await serializeSession(state, { fetchBlob });
  assert.equal(serialized.ok, true);
  assert.equal(serialized.data.board.title, 'Les Générations Miracles de Kuroko');

  const restored = await restoreSession(
    { schemaVersion: SCHEMA_VERSION, savedAt: 1, data: serialized.data },
    { createUrl: () => 'blob:restored', revokeUrl: () => {} },
  );
  assert.equal(restored.ok, true);
  assert.equal(restored.state.board.title, 'Les Générations Miracles de Kuroko');
  assert.equal(restored.state.board.showGrid, false);
  assert.equal(restored.state.subjects.length, 1);
});

test('titre : un titre vide enregistré reste vide après restauration', async () => {
  const serialized = await serializeSession(makeStateWithTitle(''), { fetchBlob });
  assert.equal(serialized.data.board.title, '');
  const restored = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data: serialized.data });
  assert.equal(restored.state.board.title, '');
});

test('titre : une ancienne session sans titre est restaurée avec le titre par défaut', async () => {
  const serialized = await serializeSession(makeStateWithTitle('Autre'), { fetchBlob });
  const legacy = structuredClone({ ...serialized.data, board: { ...serialized.data.board } });
  delete legacy.board.title;
  assert.equal('title' in legacy.board, false);

  const restored = await restoreSession(
    { schemaVersion: SCHEMA_VERSION, savedAt: 1, data: legacy },
    { createUrl: () => 'blob:restored', revokeUrl: () => {} },
  );
  assert.equal(restored.ok, true);
  assert.equal(restored.state.board.title, DEFAULT_BOARD_TITLE);
  assert.equal(restored.state.subjects.length, 1);
  assert.equal(restored.state.canvasW, serialized.data.canvas.width);
  assert.equal(restored.state.board.background.color, serialized.data.board.background.color);
});

test('titre : état sans titre sérialisé avec le titre par défaut, titre non textuel refusé', async () => {
  const bare = makeStateWithTitle(undefined);
  delete bare.board.title;
  const serialized = await serializeSession(bare, { fetchBlob });
  assert.equal(serialized.ok, true);
  assert.equal(serialized.data.board.title, DEFAULT_BOARD_TITLE);

  const corrupted = { ...serialized.data, board: { ...serialized.data.board, title: 42 } };
  const restored = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data: corrupted });
  assert.equal(restored.ok, false);
  assert.equal(restored.error.code, 'invalid-snapshot');
});

test('titre : une valeur trop longue enregistrée est ramenée à la limite à la restauration', async () => {
  const serialized = await serializeSession(makeStateWithTitle('ok'), { fetchBlob });
  const data = { ...serialized.data, board: { ...serialized.data.board, title: 'y'.repeat(500) } };
  const restored = await restoreSession({ schemaVersion: SCHEMA_VERSION, savedAt: 1, data });
  assert.equal(Array.from(restored.state.board.title).length, MAX_BOARD_TITLE_LENGTH);
});

test('titre : disposition d’un titre court, taille et position d’origine conservées', () => {
  const { lines } = getBoardTitleLayout(DEFAULT_BOARD_TITLE, 1400, measure);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, DEFAULT_BOARD_TITLE);
  assert.equal(lines[0].fontSize, TITLE_FONT_SIZE);
  assert.equal(lines[0].y, TITLE_BASELINE_Y);
  assert.equal(lines[0].letterSpacing, 3);
  assert.equal(lines[0].textLength, null);
});

test('titre : vide ou blanc, aucune ligne dessinée', () => {
  assert.deepEqual(getBoardTitleLayout('', 1400, measure).lines, []);
  assert.deepEqual(getBoardTitleLayout('   ', 1400, measure).lines, []);
  assert.equal(getBoardTitleLayout(undefined, 1400, measure).lines[0].text, DEFAULT_BOARD_TITLE);
});

test('titre : un titre long réduit la taille sans jamais dépasser la zone libre', () => {
  const long = 'Comparaison complète des personnages de la saison finale';
  [1400, 2800, 5600].forEach((width) => {
    const { lines } = getBoardTitleLayout(long, width, measure);
    lines.forEach((line) => {
      assert.ok(lineWidth(line) <= width - 2 * TITLE_SIDE_MARGIN, `${width} px`);
    });
  });
  const wide = getBoardTitleLayout(long, 1400, measure).lines[0];
  assert.ok(wide.fontSize < TITLE_FONT_SIZE);
  assert.ok(wide.fontSize >= 24);
});

test('titre : sur un format étroit, passage sur deux lignes lisibles', () => {
  const { lines } = getBoardTitleLayout('Les Générations Miracles de Kuroko', 700, measure);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].y > lines[0].y);
  assert.equal(lines.map((line) => line.text).join(' '), 'Les Générations Miracles de Kuroko');
  lines.forEach((line) => {
    assert.ok(lineWidth(line) <= 700 - 2 * TITLE_SIDE_MARGIN);
    assert.ok(line.fontSize >= 14);
  });
});

test('titre : un mot unique trop long est comprimé plutôt que de déborder', () => {
  const word = 'W'.repeat(MAX_BOARD_TITLE_LENGTH);
  const { lines } = getBoardTitleLayout(word, 600, measure);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].fontSize, 14);
  assert.ok(lines[0].textLength > 0);
  assert.ok(lines[0].textLength <= 600 - 2 * TITLE_SIDE_MARGIN);
});

test('titre : aucun débordement sur toutes les largeurs et longueurs testées', () => {
  const samples = ['A', 'Kuroko', 'Les Générations Miracles de Kuroko', 'M'.repeat(60), 'ab cd '.repeat(10)];
  [600, 700, 800, 1000, 1400, 4000].forEach((width) => {
    samples.forEach((sample) => {
      getBoardTitleLayout(sample, width, measure).lines.forEach((line) => {
        assert.ok(lineWidth(line) <= Math.max(0, width - 2 * TITLE_SIDE_MARGIN) + 1e-9, `${sample} @${width}`);
        assert.ok(line.y > 0 && line.y < 150);
      });
    });
  });
});

test('titre : le titre n’est pas une couche d’export, il vit dans le SVG de la grille', () => {
  const layers = getExportLayers({ subjects: [], mannequin: null, measures: [], annotations: [], background: DEFAULT_BOARD.background });
  assert.deepEqual(layers.map((layer) => layer.kind), ['background', 'grid']);
});