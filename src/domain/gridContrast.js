import { isValidColor } from './board.js';

const LUMINANCE_THRESHOLD = 0.179;

const LIGHT_BACKGROUND_PALETTE = {
  strong: '#222222',
  mid: '#555555',
  minor: '#777777',
  ink: '#000000',
  label: '#555555',
  head: '#111111',
  sub: '#333333',
  caption: '#1a1a1a',
  halo: '#ffffff',
  haloOpacity: 0.5,
  floorShadow: '#000000',
  floorShadowStrength: 0.28,
};

export const GRID_PALETTES = {
  light: LIGHT_BACKGROUND_PALETTE,
  image: {
    ...LIGHT_BACKGROUND_PALETTE,
    haloOpacity: 0.75,
    floorShadowStrength: 0.38,
  },
  dark: {
    strong: '#e6e6e6',
    mid: '#bdbdbd',
    minor: '#8f8f8f',
    ink: '#ffffff',
    label: '#d0d0d0',
    head: '#f5f5f5',
    sub: '#dcdcdc',
    caption: '#e6e6e6',
    halo: '#000000',
    haloOpacity: 0.5,
    floorShadow: '#000000',
    floorShadowStrength: 0.5,
  },
};

export const FLOOR_SHADOW_FALLOFF = [
  [0, 1],
  [0.18, 0.55],
  [0.45, 0.18],
  [0.75, 0.04],
  [1, 0],
];

export const getFloorShadowOpacity = (palette, position) => {
  const t = Math.min(1, Math.max(0, position));
  for (let i = 1; i < FLOOR_SHADOW_FALLOFF.length; i += 1) {
    const [x1, y1] = FLOOR_SHADOW_FALLOFF[i];
    if (t <= x1) {
      const [x0, y0] = FLOOR_SHADOW_FALLOFF[i - 1];
      return palette.floorShadowStrength * (y0 + ((y1 - y0) * (t - x0)) / (x1 - x0));
    }
  }
  return 0;
};

const toLinear = (channel) =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

export const getRelativeLuminance = (color) => {
  if (!isValidColor(color)) return 1;
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(color.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const getGridTone = (background) => {
  if (background?.image) return 'image';
  return getRelativeLuminance(background?.color) < LUMINANCE_THRESHOLD ? 'dark' : 'light';
};

export const getGridPalette = (background) => GRID_PALETTES[getGridTone(background)];