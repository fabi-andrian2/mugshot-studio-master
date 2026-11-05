import { normalizeAngle, rotatePoint } from './rotation.js';

export const ROTATION_SNAP_STEP = 15;
export const ROTATE_HANDLE_OFFSET_SCREEN_PX = 44;

const MIN_GESTURE_RADIUS = 2;

const toDegrees = (radians) => (radians * 180) / Math.PI;

const wrapDelta = (degrees) => {
  const wrapped = ((degrees % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
};

const getPointerAngle = (pivot, point) => toDegrees(Math.atan2(point.x - pivot.x, pivot.y - point.y));

const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const startRotationGesture = ({ pivot, point, rotation }) => {
  if (getDistance(pivot, point) < MIN_GESTURE_RADIUS) return null;
  return { pivot, startAngle: getPointerAngle(pivot, point), initRotation: normalizeAngle(rotation) };
};

export const getRotationForPointer = (gesture, point, { snap = false } = {}) => {
  if (getDistance(gesture.pivot, point) < MIN_GESTURE_RADIUS) return null;
  const delta = wrapDelta(getPointerAngle(gesture.pivot, point) - gesture.startAngle);
  const raw = gesture.initRotation + delta;
  const target = snap ? Math.round(raw / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP : raw;
  return normalizeAngle(Math.round(target * 1e4) / 1e4);
};

export const getRotationHandle = ({ subjectX, visible, anchor, rotation }, offsetPx) => ({
  base: rotatePoint({ x: subjectX, y: visible.top }, anchor, rotation),
  tip: rotatePoint({ x: subjectX, y: visible.top - offsetPx }, anchor, rotation),
});

export const getResizeDistancePx = (initDistance, delta, rotation) =>
  initDistance - rotatePoint(delta, { x: 0, y: 0 }, -rotation).y;

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];

export const getResizeCursor = (handle, rotation, mirrored) => {
  const sideX = { 'top-left': -1, 'top-center': 0, 'top-right': 1 }[handle];
  const local = { x: mirrored ? -sideX : sideX, y: -1 };
  const turned = rotatePoint(local, { x: 0, y: 0 }, rotation);
  const axis = (toDegrees(Math.atan2(turned.x, -turned.y)) + 360) % 180;
  return CURSORS[Math.round(axis / 45) % 4];
};
