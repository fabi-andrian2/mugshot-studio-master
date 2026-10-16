import { BOARD_TITLE_FONT_FAMILY } from '../domain/typography.js';
import { estimateGlyphWidth } from '../domain/boardTitle.js';

let context;

const getContext = () => {
  if (context === undefined) {
    context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return context;
};

export const measureTitleGlyphs = (text, fontSize) => {
  const ctx = getContext();
  if (!ctx) return estimateGlyphWidth(text, fontSize);
  ctx.font = `900 ${fontSize}px ${BOARD_TITLE_FONT_FAMILY}`;
  return ctx.measureText(text).width;
};