import { DEFAULT_SUBJECT_HEIGHT_CM, SUBJECT_STAGGER_PX } from './constants.js';
import { getGroundAnchor, getHeadAnchor, getMeasuredHeightPx } from './geometry.js';
import { clampScale, scaleFromHeightCm } from './measurement.js';
import { cleanSubjectName } from './subjectName.js';

const MAX_NAME_LENGTH = 60;

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
    fileName: image.fileName,
    name: cleanSubjectName(image.fileName),
    x: canvasW / 2 + index * SUBJECT_STAGGER_PX,
    y: 0,
    scale: 1,
    flipX: false,
    zIndex,
    placement: 'auto',
    naturalW: image.naturalW,
    naturalH: image.naturalH,
    visibleBounds: image.visibleBounds,
  };
  const groundAnchor = image.groundAnchor ?? getGroundAnchor(draft);
  const headAnchor = image.headAnchor ?? getHeadAnchor(draft);
  const measuredHeightPx = getMeasuredHeightPx({ ...draft, groundAnchor, headAnchor });
  const scale = clampScale(measuredHeightPx, scaleFromHeightCm(measuredHeightPx, DEFAULT_SUBJECT_HEIGHT_CM));
  return { ...draft, groundAnchor, headAnchor, scale };
};

export const renameSubject = (subject, newName) => {
  const name = newName.trim().slice(0, MAX_NAME_LENGTH);
  return name ? { ...subject, name } : subject;
};

export const getLayerEntries = (subjects) =>
  [...subjects]
    .sort((a, b) => b.zIndex - a.zIndex)
    .map((subject) => ({ id: subject.id, label: subject.name }));