import { CM_TO_PX, CM_PER_INCH, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from './constants.js';

export const cmToPx = (cm) => cm * CM_TO_PX;
export const pxToCm = (px) => px / CM_TO_PX;

export const heightCmFromScale = (visibleHeightPx, scale) => pxToCm(visibleHeightPx * scale);

export const scaleFromHeightCm = (visibleHeightPx, heightCm) =>
  visibleHeightPx > 0 ? cmToPx(heightCm) / visibleHeightPx : 1;

export const clampHeightCm = (heightCm) => Math.max(MIN_HEIGHT_CM, Math.min(MAX_HEIGHT_CM, heightCm));

export const getScaleLimits = (visibleHeightPx) => ({
  min: scaleFromHeightCm(visibleHeightPx, MIN_HEIGHT_CM),
  max: scaleFromHeightCm(visibleHeightPx, MAX_HEIGHT_CM),
});

export const clampScale = (visibleHeightPx, scale) => {
  const { min, max } = getScaleLimits(visibleHeightPx);
  return Math.max(min, Math.min(max, scale));
};

export const cmToInches = (cm) => cm / CM_PER_INCH;
export const inchesToCm = (inches) => inches * CM_PER_INCH;

export const cmToFeetInches = (cm) => {
  const totalInches = Math.round(cmToInches(cm));
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
};

export const feetInchesToCm = (feet, inches) => inchesToCm(feet * 12 + inches);

const formatDecimal = (value) => String(Math.round(value * 10) / 10);

export const formatHeight = (cm, unit) => {
  if (unit === 'ft') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${formatDecimal(cm)} cm`;
};