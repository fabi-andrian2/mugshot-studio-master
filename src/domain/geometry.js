import { FALLBACK_NATURAL_W, FALLBACK_NATURAL_H, MIN_ANCHOR_SPAN } from './constants.js';
import { heightCmFromScale, scaleFromHeightCm, clampScale } from './measurement.js';

const FULL_BOUNDS = { left: 0, top: 0, right: 1, bottom: 1 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const getVisibleBounds = (subject) => subject.visibleBounds ?? FULL_BOUNDS;

export const getGroundAnchor = (subject) => {
  if (subject.groundAnchor) return subject.groundAnchor;
  const bounds = getVisibleBounds(subject);
  return { x: (bounds.left + bounds.right) / 2, y: bounds.bottom };
};

export const getHeadAnchor = (subject) => {
  if (subject.headAnchor) return subject.headAnchor;
  const bounds = getVisibleBounds(subject);
  return { x: (bounds.left + bounds.right) / 2, y: bounds.top };
};

const getNaturalSize = (subject) => ({
  width: subject.naturalW || FALLBACK_NATURAL_W,
  height: subject.naturalH || FALLBACK_NATURAL_H,
});

export const getVisibleSizePx = (subject) => {
  const bounds = getVisibleBounds(subject);
  const natural = getNaturalSize(subject);
  return {
    width: Math.max(1, (bounds.right - bounds.left) * natural.width),
    height: Math.max(1, (bounds.bottom - bounds.top) * natural.height),
  };
};

export const getMeasuredHeightPx = (subject) => {
  const natural = getNaturalSize(subject);
  return Math.max(1, (getGroundAnchor(subject).y - getHeadAnchor(subject).y) * natural.height);
};

export const getSubjectHeightCm = (subject) =>
  heightCmFromScale(getMeasuredHeightPx(subject), subject.scale);

export const getScaleForHeightCm = (subject, heightCm) => {
  const measuredHeightPx = getMeasuredHeightPx(subject);
  return clampScale(measuredHeightPx, scaleFromHeightCm(measuredHeightPx, heightCm));
};

export const getScaleForGroundToTopPx = (subject, distancePx) => {
  const bounds = getVisibleBounds(subject);
  const natural = getNaturalSize(subject);
  const naturalDistance = Math.max(1, (getGroundAnchor(subject).y - bounds.top) * natural.height);
  return clampScale(getMeasuredHeightPx(subject), distancePx / naturalDistance);
};

export const getSubjectGeometry = (subject, floorY) => {
  const bounds = getVisibleBounds(subject);
  const ground = getGroundAnchor(subject);
  const head = getHeadAnchor(subject);
  const natural = getNaturalSize(subject);
  const scale = subject.scale;

  const anchorY = floorY - subject.y;
  const boxTop = anchorY - ground.y * natural.height * scale;

  const visibleW = Math.max(1, (bounds.right - bounds.left) * natural.width) * scale;
  const visibleH = Math.max(1, (bounds.bottom - bounds.top) * natural.height) * scale;
  const visible = {
    left: subject.x - visibleW / 2,
    top: boxTop + bounds.top * natural.height * scale,
    width: visibleW,
    height: visibleH,
  };

  const originX = ((bounds.left + bounds.right) / 2) * natural.width * scale;
  const box = {
    left: subject.x - originX,
    top: boxTop,
    width: natural.width * scale,
    height: natural.height * scale,
  };

  const toCanvasX = (normalizedX) => {
    const raw = box.left + normalizedX * natural.width * scale;
    return subject.flipX ? 2 * subject.x - raw : raw;
  };

  return {
    box,
    visible,
    originX,
    anchor: { x: toCanvasX(ground.x), y: anchorY },
    head: { x: toCanvasX(head.x), y: boxTop + head.y * natural.height * scale },
  };
};

const pointToImage = (subject, floorY, point) => {
  const { box } = getSubjectGeometry(subject, floorY);
  const unflippedX = subject.flipX ? 2 * subject.x - point.x : point.x;
  return {
    box,
    x: clamp((unflippedX - box.left) / box.width, 0, 1),
    y: (point.y - box.top) / box.height,
  };
};

export const getAnchorUpdateForCanvasPoint = (subject, floorY, point) => {
  const { box, x, y: rawY } = pointToImage(subject, floorY, point);
  const y = clamp(rawY, Math.min(getHeadAnchor(subject).y + MIN_ANCHOR_SPAN, 1), 1);
  return {
    groundAnchor: { x, y },
    y: floorY - (box.top + y * box.height),
  };
};

export const getHeadUpdateForCanvasPoint = (subject, floorY, point) => {
  const { x, y: rawY } = pointToImage(subject, floorY, point);
  const y = clamp(rawY, 0, Math.max(0, getGroundAnchor(subject).y - MIN_ANCHOR_SPAN));
  return { headAnchor: { x, y } };
};