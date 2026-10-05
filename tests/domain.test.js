import test from 'node:test';
import assert from 'node:assert/strict';

import { CM_TO_PX, DEFAULT_SUBJECT_HEIGHT_CM } from '../src/domain/constants.js';
import {
  cmToPx,
  heightCmFromScale,
  scaleFromHeightCm,
  clampScale,
  getScaleLimits,
  cmToFeetInches,
  feetInchesToCm,
  formatHeight,
} from '../src/domain/measurement.js';
import {
  getVisibleSizePx,
  getSubjectHeightCm,
  getSubjectGeometry,
  getScaleForHeightCm,
} from '../src/domain/geometry.js';
import { cleanSubjectName } from '../src/domain/subjectName.js';
import { findOpaqueBounds } from '../src/domain/opaqueBounds.js';
import { createSubject } from '../src/domain/subjects.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} différent de ${expected}`);

const FLOOR_Y = 2000;

const withMargins = {
  x: 700,
  y: 0,
  scale: 0.875,
  naturalW: 1000,
  naturalH: 2000,
  visibleBounds: { left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 },
};

test('constante de conversion : 1 cm = 8 px', () => {
  assert.equal(CM_TO_PX, 8);
});

test('hauteur : 1600 px visibles à l\'échelle 0,875 donnent 175 cm', () => {
  assert.equal(heightCmFromScale(1600, 0.875), 175);
});

test('conversion inverse : 175 cm donnent 1400 px et l\'échelle 0,875', () => {
  assert.equal(cmToPx(175), 1400);
  assert.equal(scaleFromHeightCm(1600, 175), 0.875);
});

test('aller-retour hauteur, échelle, hauteur', () => {
  const scale = scaleFromHeightCm(1234, 163.4);
  close(heightCmFromScale(1234, scale), 163.4);
});

test('une marge transparente ne change pas la hauteur mesurée', () => {
  const sansMarge = { naturalW: 1000, naturalH: 1600, scale: 0.875 };
  assert.equal(getVisibleSizePx(withMargins).height, 1600);
  assert.equal(getVisibleSizePx(sansMarge).height, 1600);
  assert.equal(getSubjectHeightCm(withMargins), 175);
  assert.equal(getSubjectHeightCm(sansMarge), 175);
});

test('sol : à y = 0 le bas visible est exactement sur le sol', () => {
  const { visible, box } = getSubjectGeometry(withMargins, FLOOR_Y);
  close(visible.top + visible.height, FLOOR_Y);
  assert.ok(box.top + box.height > FLOOR_Y);
  close(box.top + box.height, FLOOR_Y + (1 - 0.9) * 2000 * 0.875);
});

test('sol : y positif relève le bas visible au-dessus du sol', () => {
  const { visible } = getSubjectGeometry({ ...withMargins, y: 100 }, FLOOR_Y);
  close(visible.top + visible.height, FLOOR_Y - 100);
});

test('x est le centre de la zone visible, retournée ou non', () => {
  const normal = getSubjectGeometry(withMargins, FLOOR_Y);
  const flipped = getSubjectGeometry({ ...withMargins, flipX: true }, FLOOR_Y);
  close(normal.visible.left + normal.visible.width / 2, 700);
  assert.deepEqual(flipped.visible, normal.visible);
});

test('géométrie : valeurs attendues pour un cas calculé à la main', () => {
  const { visible, box, originX } = getSubjectGeometry(withMargins, FLOOR_Y);
  close(visible.width, 437.5);
  close(visible.height, 1400);
  close(visible.left, 481.25);
  close(visible.top, 600);
  close(originX, 437.5);
  close(box.left, 262.5);
  close(box.top, 425);
  close(box.width, 875);
  close(box.height, 1750);
});

test('la géométrie est une fonction pure qui ne reçoit jamais le zoom', () => {
  assert.deepEqual(getSubjectGeometry(withMargins, FLOOR_Y), getSubjectGeometry(withMargins, FLOOR_Y));
  assert.equal(getSubjectGeometry.length, 2);
});

test('échelle pour une hauteur cible, avec bornes', () => {
  close(getScaleForHeightCm(withMargins, 175), 0.875);
  const { min, max } = getScaleLimits(1600);
  assert.equal(clampScale(1600, 0.0001), min);
  assert.equal(clampScale(1600, 1000), max);
});

test('unités : 175 cm valent 5\'9"', () => {
  assert.deepEqual(cmToFeetInches(175), { feet: 5, inches: 9 });
  assert.equal(formatHeight(175, 'ft'), '5\'9"');
  assert.equal(formatHeight(175, 'cm'), '175 cm');
  assert.equal(formatHeight(174.46, 'cm'), '174.5 cm');
});

test('unités : l\'arrondi au pouce peut passer au pied suivant', () => {
  assert.deepEqual(cmToFeetInches(182.6), { feet: 6, inches: 0 });
});

test('unités : 5 pieds 9 pouces valent 175,26 cm', () => {
  close(feetInchesToCm(5, 9), 175.26);
});

test('noms : extension et suffixe UUID retirés', () => {
  assert.equal(cleanSubjectName('kira_c0fa157d-0805-4e50-ad2b-023fd95b5e8e.png'), 'Kira');
  assert.equal(cleanSubjectName('Jean_Dupont.PNG'), 'Jean Dupont');
  assert.equal(cleanSubjectName('Naruto Uzumaki.jpg'), 'Naruto Uzumaki');
  assert.equal(cleanSubjectName('c0fa157d-0805-4e50-ad2b-023fd95b5e8e.png'), 'Sujet');
});

const makePixels = (width, height, rect, alpha) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      data[(y * width + x) * 4 + 3] = alpha;
    }
  }
  return data;
};

test('analyse alpha : rectangle visible normalisé', () => {
  const data = makePixels(10, 10, { x0: 2, y0: 3, x1: 5, y1: 8 }, 255);
  const bounds = findOpaqueBounds(data, 10, 10, 20);
  close(bounds.left, 0.2);
  close(bounds.top, 0.3);
  close(bounds.right, 0.6);
  close(bounds.bottom, 0.9);
});

test('analyse alpha : image entièrement transparente', () => {
  assert.equal(findOpaqueBounds(new Uint8ClampedArray(400), 10, 10, 20), null);
});

test('analyse alpha : les pixels sous le seuil sont ignorés', () => {
  const data = makePixels(10, 10, { x0: 0, y0: 0, x1: 9, y1: 9 }, 10);
  assert.equal(findOpaqueBounds(data, 10, 10, 20), null);
});

test('analyse alpha : image opaque, la zone visible est l\'image entière', () => {
  const data = makePixels(8, 8, { x0: 0, y0: 0, x1: 7, y1: 7 }, 255);
  assert.deepEqual(findOpaqueBounds(data, 8, 8, 20), { left: 0, top: 0, right: 1, bottom: 1 });
});

test('création d\'un sujet : hauteur par défaut, nom nettoyé, centre horizontal', () => {
  const subject = createSubject(
    {
      id: 'a',
      url: 'blob:x',
      fileName: 'kira_c0fa157d-0805-4e50-ad2b-023fd95b5e8e.png',
      naturalW: 1000,
      naturalH: 2000,
      visibleBounds: { left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 },
    },
    { index: 2, canvasW: 1400, zIndex: 3 },
  );
  close(getSubjectHeightCm(subject), DEFAULT_SUBJECT_HEIGHT_CM);
  assert.equal(subject.name, 'Kira');
  assert.equal(subject.x, 700 + 2 * 50);
  assert.equal(subject.y, 0);
  assert.equal(subject.zIndex, 3);
});