import {
  MAX_BASE_HEIGHT_RATIO,
  FALLBACK_NATURAL_W,
  FALLBACK_NATURAL_H,
} from './constants.js';
import { heightCmFromScale, scaleFromHeightCm, clampScale } from './measurement.js';

const FULL_BOUNDS = { left: 0, top: 0, right: 1, bottom: 1 };

export const getBaseDimensions = (subject, floorY) => {
  const naturalW = subject.naturalW || FALLBACK_NATURAL_W;
  const naturalH = subject.naturalH || FALLBACK_NATURAL_H;
  const maxH = floorY * MAX_BASE_HEIGHT_RATIO;
  const h = Math.min(naturalH, maxH);
  const w = naturalW * (h / naturalH);
  return { w, h };
};

export const getVisibleBounds = (subject) => subject.visibleBounds ?? FULL_BOUNDS;

export const getVisibleSizePx = (subject) => {
  const bounds = getVisibleBounds(subject);
  const naturalW = subject.naturalW || FALLBACK_NATURAL_W;
  const naturalH = subject.naturalH || FALLBACK_NATURAL_H;
  return {
    width: Math.max(1, (bounds.right - bounds.left) * naturalW),
    height: Math.max(1, (bounds.bottom - bounds.top) * naturalH),
  };
};

export const getSubjectHeightCm = (subject) =>
  heightCmFromScale(getVisibleSizePx(subject).height, subject.scale);

export const getScaleForHeightCm = (subject, heightCm) => {
  const visibleHeightPx = getVisibleSizePx(subject).height;
  return clampScale(visibleHeightPx, scaleFromHeightCm(visibleHeightPx, heightCm));
};

export const getScaleForDisplayedHeightPx = (subject, displayedHeightPx) => {
  const visibleHeightPx = getVisibleSizePx(subject).height;
  return clampScale(visibleHeightPx, displayedHeightPx / visibleHeightPx);
};

export const getSubjectGeometry = (subject, floorY) => {
  const bounds = getVisibleBounds(subject);
  const naturalW = subject.naturalW || FALLBACK_NATURAL_W;
  const naturalH = subject.naturalH || FALLBACK_NATURAL_H;
  const scale = subject.scale;

  const visibleW = Math.max(1, (bounds.right - bounds.left) * naturalW) * scale;
  const visibleH = Math.max(1, (bounds.bottom - bounds.top) * naturalH) * scale;
  const bottomY = floorY - subject.y;

  const visible = {
    left: subject.x - visibleW / 2,
    top: bottomY - visibleH,
    width: visibleW,
    height: visibleH,
  };

  const originX = ((bounds.left + bounds.right) / 2) * naturalW * scale;
  const box = {
    left: subject.x - originX,
    top: bottomY - bounds.bottom * naturalH * scale,
    width: naturalW * scale,
    height: naturalH * scale,
  };

  return { box, visible, originX };
};