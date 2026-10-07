import { CM_TO_PX, CM_PER_INCH, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from './constants.js';

export const cmToPx = (cm) => cm * CM_TO_PX;
export const pxToCm = (px) => px / CM_TO_PX;

export const heightCmFromScale = (measuredHeightPx, scale) => pxToCm(measuredHeightPx * scale);

export const scaleFromHeightCm = (measuredHeightPx, heightCm) =>
  measuredHeightPx > 0 ? cmToPx(heightCm) / measuredHeightPx : 1;

export const clampHeightCm = (heightCm) => Math.max(MIN_HEIGHT_CM, Math.min(MAX_HEIGHT_CM, heightCm));

export const getScaleLimits = (measuredHeightPx) => ({
  min: scaleFromHeightCm(measuredHeightPx, MIN_HEIGHT_CM),
  max: scaleFromHeightCm(measuredHeightPx, MAX_HEIGHT_CM),
});

export const clampScale = (measuredHeightPx, scale) => {
  const { min, max } = getScaleLimits(measuredHeightPx);
  return Math.max(min, Math.min(max, scale));
};

export const cmToInches = (cm) => cm / CM_PER_INCH;
export const inchesToCm = (inches) => inches * CM_PER_INCH;

export const cmToFeetInches = (cm) => {
  const totalInches = Math.round(cmToInches(cm));
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
};

export const splitFeetInches = (cm) => {
  const totalInches = Math.round(cmToInches(cm) * 10) / 10;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round((totalInches - feet * 12) * 10) / 10;
  return { feet, inches };
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