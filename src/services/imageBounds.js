import { IMAGE_ANALYSIS_MAX_SIDE, ALPHA_THRESHOLD } from '../domain/constants.js';
import { findOpaqueBounds } from '../domain/opaqueBounds.js';
import loadImage from './loadImage.js';

const FULL_BOUNDS = { left: 0, top: 0, right: 1, bottom: 1 };

export const analyzeImage = async (src) => {
  const img = await loadImage(src);
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) throw new Error('Image sans dimensions exploitables');

  const ratio = Math.min(1, IMAGE_ANALYSIS_MAX_SIDE / Math.max(naturalW, naturalH));
  const width = Math.max(1, Math.round(naturalW * ratio));
  const height = Math.max(1, Math.round(naturalH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const bounds = findOpaqueBounds(data, width, height, ALPHA_THRESHOLD);

  return {
    naturalW,
    naturalH,
    visibleBounds: bounds ?? FULL_BOUNDS,
    isEmpty: bounds === null,
  };
};