import { DEFAULT_W, DEFAULT_H } from './constants.js';
import { DEFAULT_BOARD } from './board.js';
import { DEFAULT_ANNOTATIONS } from './annotations.js';
import { DEFAULT_MANNEQUIN } from './mannequin.js';
import { DEFAULT_MEASURE } from './measure.js';

export const createBlankState = () => ({
  subjects: [],
  canvasW: DEFAULT_W,
  canvasH: DEFAULT_H,
  unit: 'cm',
  board: { ...DEFAULT_BOARD, background: { ...DEFAULT_BOARD.background } },
  annotations: { ...DEFAULT_ANNOTATIONS },
  mannequin: { ...DEFAULT_MANNEQUIN },
  measure: { ...DEFAULT_MEASURE, items: [] },
});