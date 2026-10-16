import { normalizeBoardTitle } from './board.js';

export const TITLE_FONT_SIZE = 38;
export const TITLE_LETTER_SPACING = 3;
export const TITLE_BASELINE_Y = 60;
export const TITLE_SIDE_MARGIN = 215;

const TWO_LINES_MAX_FONT_SIZE = 28;
const TWO_LINES_BASELINE_Y = 44;
const TWO_LINES_LEADING = 1.15;
const SINGLE_LINE_MIN_FONT_SIZE = 24;
const MIN_FONT_SIZE = 14;
const FIT_RATIO = 0.97;
const AVERAGE_GLYPH_RATIO = 0.55;

export const estimateGlyphWidth = (text, fontSize) => Array.from(text).length * fontSize * AVERAGE_GLYPH_RATIO;

const floorToTenth = (value) => Math.floor(value * 10) / 10;

export const getBoardTitleLayout = (title, canvasW, measure = estimateGlyphWidth) => {
  const text = normalizeBoardTitle(title).trim().replace(/\s+/g, ' ');
  if (!text) return { lines: [] };

  const maxWidth = Math.max(0, canvasW - 2 * TITLE_SIDE_MARGIN);
  const naturalWidth = (value) =>
    measure(value, TITLE_FONT_SIZE) + Array.from(value).length * TITLE_LETTER_SPACING;
  const fittingSize = (width, limit) =>
    width > 0 ? Math.min(limit, (TITLE_FONT_SIZE * maxWidth * FIT_RATIO) / width) : limit;

  const buildLine = (value, size, y) => {
    const fontSize = floorToTenth(Math.max(MIN_FONT_SIZE, size));
    const width = (naturalWidth(value) * fontSize) / TITLE_FONT_SIZE;
    return {
      text: value,
      y,
      fontSize,
      letterSpacing: floorToTenth((fontSize * TITLE_LETTER_SPACING) / TITLE_FONT_SIZE),
      textLength: width > maxWidth ? Math.floor(maxWidth) : null,
    };
  };

  const singleSize = fittingSize(naturalWidth(text), TITLE_FONT_SIZE);
  const single = { lines: [buildLine(text, singleSize, TITLE_BASELINE_Y)] };
  if (singleSize >= SINGLE_LINE_MIN_FONT_SIZE) return single;

  const words = text.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const first = words.slice(0, i).join(' ');
    const second = words.slice(i).join(' ');
    const widest = Math.max(naturalWidth(first), naturalWidth(second));
    if (!best || widest < best.widest) best = { first, second, widest };
  }
  if (!best) return single;

  const doubleSize = fittingSize(best.widest, TWO_LINES_MAX_FONT_SIZE);
  if (doubleSize <= singleSize) return single;

  const first = buildLine(best.first, doubleSize, TWO_LINES_BASELINE_Y);
  const secondY = Math.round(TWO_LINES_BASELINE_Y + first.fontSize * TWO_LINES_LEADING);
  return { lines: [first, buildLine(best.second, doubleSize, secondY)] };
};