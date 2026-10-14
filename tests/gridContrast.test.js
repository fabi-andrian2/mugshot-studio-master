import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRID_PALETTES,
  getGridPalette,
  getGridTone,
  getRelativeLuminance,
} from '../src/domain/gridContrast.js';
import { DEFAULT_BOARD, setBackgroundColor, setBackgroundImage } from '../src/domain/board.js';

const contrast = (a, b) => {
  const [hi, lo] = [getRelativeLuminance(a), getRelativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const IMAGE = { url: 'blob:x', width: 800, height: 600, fileName: 'x.png' };

test('luminance : noir, blanc et valeur invalide', () => {
  assert.equal(getRelativeLuminance('#000000'), 0);
  assert.ok(Math.abs(getRelativeLuminance('#ffffff') - 1) < 1e-9);
  assert.equal(getRelativeLuminance('rouge'), 1);
  assert.equal(getRelativeLuminance(undefined), 1);
});

test('ton : les fonds clairs, y compris les préréglages, gardent l\'encre sombre', () => {
  for (const color of ['#f2f2f4', '#ffffff', '#e9e4d8', '#dbe7f0', '#dfe9df', '#f3dede', '#808080']) {
    assert.equal(getGridTone({ color, image: null }), 'light', color);
  }
});

test('ton : les fonds sombres passent à l\'encre claire', () => {
  for (const color of ['#000000', '#111111', '#222831', '#1a2a4a', '#333333']) {
    assert.equal(getGridTone({ color, image: null }), 'dark', color);
  }
});

test('ton : une image de fond prime sur la couleur', () => {
  assert.equal(getGridTone({ color: '#000000', image: IMAGE }), 'image');
  assert.equal(getGridTone({ color: '#ffffff', image: IMAGE }), 'image');
  assert.equal(getGridTone(undefined), 'light');
});

test('palette : le fond par défaut garde l\'encre d\'origine', () => {
  const palette = getGridPalette(DEFAULT_BOARD.background);
  assert.equal(palette.ink, '#000000');
  assert.equal(palette.strong, '#222222');
  assert.equal(palette.mid, '#555555');
});

test('palette : contraste suffisant sur chaque fond', () => {
  const cases = [
    ['#f2f2f4', 'light'],
    ['#ffffff', 'light'],
    ['#e9e4d8', 'light'],
    ['#000000', 'dark'],
    ['#222831', 'dark'],
    ['#333333', 'dark'],
  ];
  for (const [color, tone] of cases) {
    const palette = GRID_PALETTES[tone];
    assert.equal(getGridPalette({ color, image: null }), palette);
    assert.ok(contrast(palette.ink, color) >= 7, `ink ${color}`);
    assert.ok(contrast(palette.strong, color) >= 4.5, `strong ${color}`);
    assert.ok(contrast(palette.label, color) >= 4.5, `label ${color}`);
    assert.ok(contrast(palette.minor, color) >= 3, `minor ${color}`);
  }
});

test('palette : le halo oppose l\'encre et reste discret', () => {
  for (const palette of Object.values(GRID_PALETTES)) {
    assert.ok(contrast(palette.halo, palette.ink) >= 15);
    assert.ok(palette.haloOpacity > 0 && palette.haloOpacity <= 0.8);
  }
  assert.ok(GRID_PALETTES.image.haloOpacity > GRID_PALETTES.light.haloOpacity);
});

test('palette : suit les changements de fond de la planche', () => {
  const dark = setBackgroundColor(DEFAULT_BOARD, '#101010');
  assert.equal(getGridTone(dark.background), 'dark');
  const withImage = setBackgroundImage(dark, IMAGE);
  assert.equal(getGridTone(withImage.background), 'image');
  const removed = setBackgroundImage(withImage, null);
  assert.equal(getGridTone(removed.background), 'dark');
});