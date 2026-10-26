import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UI_FONT_FAMILY,
  NUMERIC_FONT_FAMILY,
  CANVAS_FONT_FAMILY,
  BOARD_TITLE_FONT_FAMILY,
} from '../src/domain/typography.js';
import { ANNOTATION_STYLE } from '../src/domain/annotations.js';
import { MEASURE_STYLE } from '../src/domain/measure.js';
import { getMannequinGeometry } from '../src/domain/mannequin.js';

const stacks = { UI_FONT_FAMILY, NUMERIC_FONT_FAMILY, CANVAS_FONT_FAMILY, BOARD_TITLE_FONT_FAMILY };

test('chaque pile de polices se termine par une famille générique locale', () => {
  Object.values(stacks).forEach((stack) => {
    assert.match(stack, /(sans-serif|monospace)$/);
    assert.doesNotMatch(stack, /url\(|https?:/);
  });
});

test('les textes du canvas et de l export partagent la même pile que l interface', () => {
  assert.equal(CANVAS_FONT_FAMILY, UI_FONT_FAMILY);
  assert.equal(ANNOTATION_STYLE.fontFamily, CANVAS_FONT_FAMILY);
  assert.equal(MEASURE_STYLE.fontFamily, CANVAS_FONT_FAMILY);
  const geometry = getMannequinGeometry({ visible: true, heightCm: 180, scale: 1 }, { floorY: 1000, unit: 'cm' });
  assert.equal(geometry.labelFontFamily, CANVAS_FONT_FAMILY);
});

test('index.css déclare les mêmes piles que le module typography', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(css.includes(`--font-sans: ${UI_FONT_FAMILY};`));
  assert.ok(css.includes(`--font-mono: ${NUMERIC_FONT_FAMILY};`));
  assert.ok(html.includes('lang="fr"'));
});