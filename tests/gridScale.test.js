import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRID_TOP_MARGIN,
  getGridMaxCm,
  getGridCmTicks,
  getGridInchTicks,
} from '../src/domain/gridScale.js';
import {
  CM_TO_PX,
  CM_PER_INCH,
  DEFAULT_H,
  FLOOR_MARGIN,
  CANVAS_LIMITS,
  FORMAT_PRESETS,
} from '../src/domain/constants.js';

const HEADER_BOTTOM_Y = 76;
const MAX_LABEL_FONT_SIZE = 26;

const floorOf = (canvasH) => canvasH - FLOOR_MARGIN;
const lastOf = (list) => list[list.length - 1];

const EXPECTED = [
  { canvasH: 800, floorY: 600, maxCm: 55, lastCm: 54, cmCount: 28, lastInch: 21, inchCount: 22 },
  { canvasH: 1200, floorY: 1000, maxCm: 105, lastCm: 104, cmCount: 53, lastInch: 41, inchCount: 42 },
  { canvasH: 2200, floorY: 2000, maxCm: 230, lastCm: 230, cmCount: 116, lastInch: 90, inchCount: 91 },
  { canvasH: 3000, floorY: 2800, maxCm: 330, lastCm: 330, cmCount: 166, lastInch: 129, inchCount: 130 },
];

test('graduation : hauteurs 800, 1200, 2200 et 3000 px, limite théorique et dernier repère affiché', () => {
  EXPECTED.forEach(({ canvasH, floorY, maxCm, lastCm, cmCount, lastInch, inchCount }) => {
    assert.equal(floorOf(canvasH), floorY);
    assert.equal(getGridMaxCm(canvasH), maxCm, `limite théorique à ${canvasH}`);

    const cm = getGridCmTicks(canvasH);
    assert.equal(cm.length, cmCount, `nombre de repères cm à ${canvasH}`);
    assert.equal(lastOf(cm).cm, lastCm, `dernier repère cm à ${canvasH}`);
    assert.equal(lastOf(cm).y, floorY - lastCm * CM_TO_PX);

    const inches = getGridInchTicks(canvasH);
    assert.equal(inches.length, inchCount, `nombre de repères pouces à ${canvasH}`);
    assert.equal(lastOf(inches).inch, lastInch, `dernier repère pouces à ${canvasH}`);
  });
});

test('graduation : la limite théorique n\'impose pas un repère exactement à cette valeur', () => {
  EXPECTED.forEach(({ canvasH }) => {
    const maxCm = getGridMaxCm(canvasH);
    const cm = getGridCmTicks(canvasH);
    const last = lastOf(cm);

    assert.ok(last.cm <= maxCm);
    assert.equal(last.cm, maxCm - (maxCm % 2));
    assert.ok(floorOf(canvasH) - (last.cm + 2) * CM_TO_PX < GRID_TOP_MARGIN, 'le repère suivant sortirait de la zone');
    assert.ok(cm.every((tick) => tick.cm % 2 === 0));
  });

  assert.equal(getGridMaxCm(1200), 105);
  assert.ok(!getGridCmTicks(1200).some((tick) => tick.cm === 105));
  assert.equal(lastOf(getGridCmTicks(1200)).cm, 104);
  assert.equal(getGridMaxCm(800), 55);
  assert.ok(!getGridCmTicks(800).some((tick) => tick.cm === 55));
});

test('graduation : la planche standard garde les mêmes repères qu\'avant (0 à 230 cm, 0 à 90 pouces)', () => {
  const floorY = floorOf(DEFAULT_H);

  const legacyCm = [];
  for (let cm = 0; cm <= 230; cm += 2) legacyCm.push({ cm, y: floorY - cm * CM_TO_PX });
  assert.deepEqual(
    getGridCmTicks(DEFAULT_H).map(({ cm, y }) => ({ cm, y })),
    legacyCm,
  );

  const legacyIn = [];
  for (let i = 0; i <= Math.floor(230 / 2.54); i += 1) legacyIn.push({ inch: i, y: floorY - i * 2.54 * CM_TO_PX });
  assert.deepEqual(
    getGridInchTicks(DEFAULT_H).map(({ inch, y }) => ({ inch, y })),
    legacyIn,
  );
  assert.equal(lastOf(getGridCmTicks(DEFAULT_H)).y, GRID_TOP_MARGIN);
});

test('graduation : une planche plus haute dépasse 230 cm, une planche moins haute s\'arrête avant', () => {
  assert.ok(getGridMaxCm(3000) > 230);
  assert.ok(getGridCmTicks(3000).some((tick) => tick.cm === 300 && tick.kind === 'major'));
  assert.ok(getGridMaxCm(1200) < 230);
  assert.ok(!getGridCmTicks(1200).some((tick) => tick.cm > 230));
});

test('graduation : le changement de hauteur du format déplace la limite de 1 cm pour 8 px', () => {
  const heights = [1800, DEFAULT_H, 2400, 3200];
  const maxima = heights.map(getGridMaxCm);
  assert.deepEqual(maxima, [...maxima].sort((a, b) => a - b));
  assert.equal(new Set(maxima).size, heights.length);
  assert.equal(getGridMaxCm(2400) - getGridMaxCm(DEFAULT_H), 200 / CM_TO_PX);
  assert.equal(getGridMaxCm(DEFAULT_H + 8) - getGridMaxCm(DEFAULT_H), 1);
});

test('graduation : cm et pouces cohérents avec la ligne de sol et CM_TO_PX', () => {
  EXPECTED.forEach(({ canvasH, floorY }) => {
    const cm = getGridCmTicks(canvasH);
    assert.equal(cm[0].cm, 0);
    assert.equal(cm[0].y, floorY);
    cm.forEach((tick) => {
      assert.equal(tick.y, floorY - tick.cm * CM_TO_PX);
    });

    const inches = getGridInchTicks(canvasH);
    assert.equal(inches[0].inch, 0);
    assert.equal(inches[0].y, floorY);
    inches.forEach((tick) => {
      assert.equal(tick.y, floorY - tick.inch * CM_PER_INCH * CM_TO_PX);
      assert.equal(tick.feet * 12 + tick.remainder, tick.inch);
    });
    assert.equal(inches.find((tick) => tick.inch === 12).y, floorY - 30.48 * CM_TO_PX);
    const hundred = cm.find((tick) => tick.cm === 100);
    if (hundred) assert.equal(hundred.y, floorY - 100 * CM_TO_PX);
  });
});

test('graduation : repères majeurs tous les 10 cm', () => {
  const majors = getGridCmTicks(DEFAULT_H).filter((tick) => tick.kind === 'major').map((tick) => tick.cm);
  assert.equal(majors[0], 0);
  assert.equal(lastOf(majors), 230);
  assert.ok(majors.every((value, index) => value === index * 10));
});

test('graduation : repères et libellés restent entre la zone d\'en-tête et le sol', () => {
  const heights = [...FORMAT_PRESETS.map((preset) => preset.h), CANVAS_LIMITS.minH, CANVAS_LIMITS.maxH, 1200, 3000];
  heights.forEach((canvasH) => {
    const floorY = floorOf(canvasH);
    [...getGridCmTicks(canvasH), ...getGridInchTicks(canvasH)].forEach((tick) => {
      assert.ok(tick.y <= floorY, `sous le sol à ${canvasH}`);
      assert.ok(tick.y >= GRID_TOP_MARGIN, `au-dessus de la marge haute à ${canvasH}`);
      assert.ok(tick.y - MAX_LABEL_FONT_SIZE > HEADER_BOTTOM_Y, `libellé sur l'en-tête à ${canvasH}`);
      assert.ok(tick.y + MAX_LABEL_FONT_SIZE < canvasH, `libellé hors de la planche à ${canvasH}`);
    });
  });
});

test('graduation : hauteur invalide, aucune graduation', () => {
  assert.equal(getGridMaxCm(Number.NaN), 0);
  assert.equal(getGridMaxCm(undefined), 0);
  assert.deepEqual(getGridCmTicks(Number.NaN), []);
  assert.deepEqual(getGridCmTicks(undefined), []);
  assert.deepEqual(getGridInchTicks(Number.NaN), []);
  assert.deepEqual(getGridInchTicks(undefined), []);
});

test('graduation : hauteur trop petite, aucun repère et aucune coordonnée négative', () => {
  [100, 0, 200, 359].forEach((canvasH) => {
    assert.equal(getGridMaxCm(canvasH), 0, `limite à ${canvasH}`);
    assert.deepEqual(getGridCmTicks(canvasH), [], `repères cm à ${canvasH}`);
    assert.deepEqual(getGridInchTicks(canvasH), [], `repères pouces à ${canvasH}`);
  });
});

test('graduation : hauteur minimale qui garde le repère 0 cm dans la zone', () => {
  const minimalH = GRID_TOP_MARGIN + FLOOR_MARGIN;
  assert.equal(minimalH, 360);
  assert.equal(getGridMaxCm(minimalH), 0);

  const cm = getGridCmTicks(minimalH);
  assert.equal(cm.length, 1);
  assert.equal(cm[0].cm, 0);
  assert.equal(cm[0].y, GRID_TOP_MARGIN);
  assert.equal(cm[0].y, floorOf(minimalH));

  const inches = getGridInchTicks(minimalH);
  assert.equal(inches.length, 1);
  assert.equal(inches[0].inch, 0);
  assert.equal(inches[0].y, GRID_TOP_MARGIN);

  assert.deepEqual(getGridCmTicks(minimalH - 1), []);
  assert.deepEqual(getGridInchTicks(minimalH - 1), []);
});

test('graduation : tout repère produit a une coordonnée dans la zone de graduation', () => {
  [360, 367, 368, 400, 800, 1200, DEFAULT_H, 3000].forEach((canvasH) => {
    const floorY = floorOf(canvasH);
    [...getGridCmTicks(canvasH), ...getGridInchTicks(canvasH)].forEach((tick) => {
      assert.ok(tick.y >= GRID_TOP_MARGIN, `y=${tick.y} à ${canvasH}`);
      assert.ok(tick.y <= floorY, `y=${tick.y} sous le sol à ${canvasH}`);
    });
    assert.ok(getGridCmTicks(canvasH).length >= 1, `repère 0 cm manquant à ${canvasH}`);
  });
});