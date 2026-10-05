import { DEFAULT_SUBJECT_HEIGHT_CM, SUBJECT_STAGGER_PX } from './constants.js';
import { getVisibleSizePx } from './geometry.js';
import { clampScale, scaleFromHeightCm } from './measurement.js';
import { cleanSubjectName } from './subjectName.js';

const isSameSubject = (a, b) => {
  if (a === b) return true;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((key) => a[key] === b[key]);
};

export const areSubjectListsEqual = (a, b) =>
  a === b || (a.length === b.length && a.every((subject, i) => isSameSubject(subject, b[i])));

export const createSubject = (image, { index, canvasW, zIndex }) => {
  const draft = {
    id: image.id,
    url: image.url,
    name: cleanSubjectName(image.fileName),
    x: canvasW / 2 + index * SUBJECT_STAGGER_PX,
    y: 0,
    scale: 1,
    flipX: false,
    zIndex,
    naturalW: image.naturalW,
    naturalH: image.naturalH,
    visibleBounds: image.visibleBounds,
  };
  const visibleHeightPx = getVisibleSizePx(draft).height;
  const scale = clampScale(visibleHeightPx, scaleFromHeightCm(visibleHeightPx, DEFAULT_SUBJECT_HEIGHT_CM));
  return { ...draft, scale };
};