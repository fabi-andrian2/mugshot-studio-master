import { CM_TO_PX, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from './constants.js';
import { formatHeight } from './measurement.js';

export const MANNEQUIN_VIEWBOX = { width: 200, height: 400 };

export const MANNEQUIN_PATH = [
  'M 72 28 a 28 28 0 1 1 56 0 a 28 28 0 1 1 -56 0 Z',
  'M 91 54 H 109 V 70 H 91 Z',
  'M 58 72 Q 58 66 66 66 H 134 Q 142 66 142 72 L 132 150 L 134 214 H 66 L 68 150 Z',
  'M 34 76 Q 34 70 42 70 H 52 L 54 150 L 52 214 H 36 L 34 150 Z',
  'M 148 70 H 158 Q 166 70 166 76 L 166 150 L 164 214 H 148 L 146 150 Z',
  'M 66 214 H 98 L 96 310 L 94 392 Q 94 400 86 400 H 70 Q 64 400 66 394 L 68 310 Z',
  'M 102 214 H 134 L 132 310 L 134 394 Q 136 400 130 400 H 114 Q 106 400 106 392 L 104 310 Z',
].join(' ');

export const MANNEQUIN_COLOR = '#6b7280';
export const MANNEQUIN_OPACITY = 0.4;
export const DEFAULT_MANNEQUIN_HEIGHT_CM = 175;

const FIGURE_HALF_WIDTH = 66;
const EDGE_MARGIN = 150;
const LABEL_GAP = 16;
const LABEL_MIN_Y = 30;
const LABEL_FONT_SIZE = 26;
const LABEL_FONT_FAMILY = 'Arial, Helvetica, sans-serif';

export const DEFAULT_MANNEQUIN = {
  visible: false,
  heightCm: DEFAULT_MANNEQUIN_HEIGHT_CM,
  x: null,
};

export const toggleMannequin = (mannequin) => ({ ...mannequin, visible: !mannequin.visible });

export const setMannequinHeight = (mannequin, heightCm) => {
  if (!Number.isFinite(heightCm)) return mannequin;
  return { ...mannequin, heightCm: Math.max(MIN_HEIGHT_CM, Math.min(MAX_HEIGHT_CM, heightCm)) };
};

export const setMannequinX = (mannequin, x) => {
  if (x === null) return { ...mannequin, x: null };
  if (!Number.isFinite(x)) return mannequin;
  return { ...mannequin, x };
};

const getScale = (mannequin) => (mannequin.heightCm * CM_TO_PX) / MANNEQUIN_VIEWBOX.height;

export const resolveMannequinX = (mannequin) =>
  mannequin.x ?? EDGE_MARGIN + FIGURE_HALF_WIDTH * getScale(mannequin);

export const getMannequinGeometry = (mannequin, { floorY, unit }) => {
  if (!mannequin.visible) return null;

  const scale = getScale(mannequin);
  const height = mannequin.heightCm * CM_TO_PX;
  const width = MANNEQUIN_VIEWBOX.width * scale;
  const x = resolveMannequinX(mannequin);
  const top = floorY - height;

  return {
    x,
    left: x - width / 2,
    top,
    width,
    height,
    bottom: floorY,
    scale,
    path: MANNEQUIN_PATH,
    color: MANNEQUIN_COLOR,
    opacity: MANNEQUIN_OPACITY,
    label: `ÉTALON · ${formatHeight(mannequin.heightCm, unit)}`,
    labelX: x,
    labelY: Math.max(LABEL_MIN_Y, top - LABEL_GAP),
    labelFontSize: LABEL_FONT_SIZE,
    labelFontFamily: LABEL_FONT_FAMILY,
  };
};