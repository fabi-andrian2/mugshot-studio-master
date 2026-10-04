import {
  MAX_BASE_HEIGHT_RATIO,
  FALLBACK_NATURAL_W,
  FALLBACK_NATURAL_H,
} from './constants.js';

export const getBaseDimensions = (subject, floorY) => {
  const naturalW = subject.naturalW || FALLBACK_NATURAL_W;
  const naturalH = subject.naturalH || FALLBACK_NATURAL_H;
  const maxH = floorY * MAX_BASE_HEIGHT_RATIO;
  const h = Math.min(naturalH, maxH);
  const w = naturalW * (h / naturalH);
  return { w, h };
};