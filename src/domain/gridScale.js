import { CM_TO_PX, CM_PER_INCH, FLOOR_MARGIN } from './constants.js';

export const GRID_TOP_MARGIN = 160;

const getFloorY = (canvasH) => canvasH - FLOOR_MARGIN;

const hasGridRoom = (canvasH) => Number.isFinite(canvasH) && getFloorY(canvasH) >= GRID_TOP_MARGIN;

export const getGridMaxCm = (canvasH) => {
  if (!Number.isFinite(canvasH)) return 0;
  return Math.max(0, Math.floor((getFloorY(canvasH) - GRID_TOP_MARGIN) / CM_TO_PX));
};

export const getGridCmTicks = (canvasH) => {
  if (!hasGridRoom(canvasH)) return [];
  const floorY = getFloorY(canvasH);
  const maxCm = getGridMaxCm(canvasH);
  const ticks = [];
  for (let cm = 0; cm <= maxCm; cm += 2) {
    const major = cm % 10 === 0;
    const mid = cm % 5 === 0 && !major;
    ticks.push({ cm, y: floorY - cm * CM_TO_PX, kind: major ? 'major' : mid ? 'mid' : 'minor' });
  }
  return ticks;
};

export const getGridInchTicks = (canvasH) => {
  if (!hasGridRoom(canvasH)) return [];
  const floorY = getFloorY(canvasH);
  const maxInch = Math.floor(getGridMaxCm(canvasH) / CM_PER_INCH);
  const ticks = [];
  for (let inch = 0; inch <= maxInch; inch += 1) {
    ticks.push({
      inch,
      y: floorY - inch * CM_PER_INCH * CM_TO_PX,
      feet: Math.floor(inch / 12),
      remainder: inch % 12,
    });
  }
  return ticks;
};