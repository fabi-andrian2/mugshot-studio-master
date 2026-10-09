import { getSubjectGeometry } from './geometry.js';
import { isSubjectVisible } from './appearance.js';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 1.5;
export const COMPOSITION_PADDING = 60;
export const BUST_PADDING = 60;
export const BUST_HEIGHT_RATIO = 0.38;
export const BUST_ASPECT = 1.25;

export const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

export const getViewForRect = ({ rect, container, canvas, padding = 0, zoom }) => {
  const availableW = Math.max(1, container.width - 2 * padding);
  const availableH = Math.max(1, container.height - 2 * padding);
  const fitted = Math.min(
    availableW / Math.max(1, rect.width),
    availableH / Math.max(1, rect.height),
  );
  const nextZoom = clampZoom(zoom ?? fitted);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    zoom: nextZoom,
    panX: (canvas.width / 2 - centerX) * nextZoom,
    panY: (canvas.height / 2 - centerY) * nextZoom,
  };
};

export const getSubjectRect = (subject, floorY) =>
  isSubjectVisible(subject) ? getSubjectGeometry(subject, floorY).visible : null;

export const getCompositionRect = (subjects, floorY) => {
  const rects = subjects.map((subject) => getSubjectRect(subject, floorY)).filter(Boolean);
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));

  return { left, top, width: right - left, height: bottom - top };
};

export const getBustRect = (subject, floorY) => {
  const rect = getSubjectRect(subject, floorY);
  if (!rect) return null;

  const height = rect.height * BUST_HEIGHT_RATIO;
  const width = Math.min(rect.width, height * BUST_ASPECT);

  return { left: rect.left + (rect.width - width) / 2, top: rect.top, width, height };
};