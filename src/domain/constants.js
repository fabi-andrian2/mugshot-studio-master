export const DEFAULT_W = 1400;
export const DEFAULT_H = 2200;
export const FLOOR_MARGIN = 200;
export const CM_TO_PX = 8;
export const CM_PER_INCH = 2.54;
export const MAX_CM = 230;
export const SNAP_Y = 15;
export const MAX_HIST = 60;
export const DEFAULT_ZOOM = 0.38;

export const DEFAULT_SUBJECT_HEIGHT_CM = 170;
export const MIN_HEIGHT_CM = 10;
export const MAX_HEIGHT_CM = 300;
export const SUBJECT_STAGGER_PX = 50;

export const IMAGE_ANALYSIS_MAX_SIDE = 1024;
export const ALPHA_THRESHOLD = 20;
export const FOOT_BAND_RATIO = 0.05;
export const HEAD_MIN_ROW_RATIO = 0.04;
export const MIN_ANCHOR_SPAN = 0.02;

export const FALLBACK_NATURAL_W = 300;
export const FALLBACK_NATURAL_H = 600;

export const CANVAS_LIMITS = { minW: 600, maxW: 8000, minH: 800, maxH: 6000 };

export const FORMAT_PRESETS = [
  { label: 'Portrait (Standard)', w: 1400, h: 2200 },
  { label: 'Portrait Large', w: 1800, h: 2400 },
  { label: 'Paysage 2 pers.', w: 2800, h: 2200 },
  { label: 'Paysage 4 pers.', w: 4000, h: 2200 },
  { label: 'Bannière', w: 5600, h: 2200 },
];