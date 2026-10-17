import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLOOR_SHADOW_FALLOFF,
  GRID_PALETTES,
  getFloorShadowOpacity,
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

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
const blend = (background, overlay, opacity) => {
  const base = hexToRgb(background);
  const top = hexToRgb(overlay);
  return rgbToHex(base.map((c, i) => c * (1 - opacity) + top[i] * opacity));
};
const shadowed = (background, palette, position) =>
  blend(background, palette.floorShadow, getFloorShadowOpacity(palette, position));
const withHalo = (background, palette) => blend(background, palette.halo, palette.haloOpacity);

const LABEL_POSITION = 34 / 200;
const CAPTION_POSITION = 190 / 200;

const GRAY_SCAN = Array.from({ length: 52 }, (_, i) => {
  const v = Math.min(255, i * 5).toString(16).padStart(2, '0');
  return `#${v}${v}${v}`;
});

test('ombre de contact : ombre sombre dans chaque palette, jamais une zone éclaircie', () => {
  for (const [tone, palette] of Object.entries(GRID_PALETTES)) {
    assert.match(palette.floorShadow, /^#[0-9a-f]{6}$/i, tone);
    assert.ok(getRelativeLuminance(palette.floorShadow) < 0.05, `${tone} sombre`);
    assert.ok(palette.floorShadowStrength > 0 && palette.floorShadowStrength <= 0.6, `${tone} force`);
    for (const color of GRAY_SCAN) {
      const tint = shadowed(color, palette, 0);
      assert.ok(getRelativeLuminance(tint) <= getRelativeLuminance(color) + 1e-9, `${tone} ${color}`);
    }
  }
});

test('ombre de contact : la plus marquée sous la ligne, estompée jusqu\'à disparaître en bas', () => {
  assert.equal(FLOOR_SHADOW_FALLOFF[0][0], 0);
  assert.equal(FLOOR_SHADOW_FALLOFF[0][1], 1);
  assert.equal(FLOOR_SHADOW_FALLOFF.at(-1)[0], 1);
  assert.equal(FLOOR_SHADOW_FALLOFF.at(-1)[1], 0);
  for (let i = 1; i < FLOOR_SHADOW_FALLOFF.length; i += 1) {
    assert.ok(FLOOR_SHADOW_FALLOFF[i][0] > FLOOR_SHADOW_FALLOFF[i - 1][0]);
    assert.ok(FLOOR_SHADOW_FALLOFF[i][1] < FLOOR_SHADOW_FALLOFF[i - 1][1]);
  }
  for (const palette of Object.values(GRID_PALETTES)) {
    let previous = Infinity;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const opacity = getFloorShadowOpacity(palette, t);
      assert.ok(opacity <= previous + 1e-12, `t=${t}`);
      previous = opacity;
    }
    assert.ok(Math.abs(getFloorShadowOpacity(palette, 0) - palette.floorShadowStrength) < 1e-12);
    assert.equal(getFloorShadowOpacity(palette, 1), 0);
    assert.ok(getFloorShadowOpacity(palette, 0.5) < palette.floorShadowStrength * 0.25);
  }
});

test('ombre de contact : ombre visible mais discrète sur fond clair, sans masquer le fond', () => {
  const palette = GRID_PALETTES.light;
  for (const color of ['#f2f2f4', '#ffffff', '#e9e4d8']) {
    const edge = contrast(shadowed(color, palette, 0), color);
    assert.ok(edge >= 1.3, `visible ${color}`);
    assert.ok(edge <= 3, `discrète ${color}`);
    assert.equal(shadowed(color, palette, 1), color);
  }
});

test('ombre de contact : libellé SOL et légende lisibles sur toute la gamme de gris, halo compris', () => {
  for (const color of GRAY_SCAN) {
    const palette = getGridPalette({ color, image: null });
    const label = shadowed(color, palette, LABEL_POSITION);
    const caption = shadowed(color, palette, CAPTION_POSITION);
    assert.ok(contrast(palette.ink, label) >= 3, `SOL sans halo ${color}`);
    assert.ok(contrast(palette.ink, withHalo(label, palette)) >= 7, `SOL avec halo ${color}`);
    assert.ok(contrast(palette.caption, caption) >= 3, `légende sans halo ${color}`);
    assert.ok(contrast(palette.caption, withHalo(caption, palette)) >= 7, `légende avec halo ${color}`);
  }
});

test('ombre de contact : gris moyen #808080, légende et libellé lisibles', () => {
  const color = '#808080';
  assert.equal(getGridTone({ color, image: null }), 'light');
  const palette = getGridPalette({ color, image: null });
  const caption = shadowed(color, palette, CAPTION_POSITION);
  const label = shadowed(color, palette, LABEL_POSITION);
  assert.ok(contrast(palette.caption, caption) >= 4);
  assert.ok(contrast(palette.caption, withHalo(caption, palette)) >= 9);
  assert.ok(contrast(palette.ink, label) >= 3.5);
});