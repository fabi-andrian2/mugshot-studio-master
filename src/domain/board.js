export const DEFAULT_BACKGROUND_COLOR = '#f2f2f4';

export const DEFAULT_BACKGROUND = { color: DEFAULT_BACKGROUND_COLOR, image: null };

export const DEFAULT_BOARD_TITLE = 'Comparaison de tailles';

export const MAX_BOARD_TITLE_LENGTH = 60;

export const DEFAULT_BOARD = { background: DEFAULT_BACKGROUND, showGrid: true, title: DEFAULT_BOARD_TITLE };

export const BACKGROUND_PRESETS = [
  { value: '#f2f2f4', label: 'Gris clair (défaut)' },
  { value: '#ffffff', label: 'Blanc' },
  { value: '#e9e4d8', label: 'Beige' },
  { value: '#dbe7f0', label: 'Bleu pâle' },
  { value: '#dfe9df', label: 'Vert pâle' },
  { value: '#f3dede', label: 'Rose pâle' },
];

export const FRAMING_LIMITS = { minZoom: 1, maxZoom: 4, minPosition: 0, maxPosition: 1 };

export const DEFAULT_FRAMING = { zoom: 1, x: 0.5, y: 0.5 };

const FRAMING_MOVE_TOLERANCE = 0.5;

export const isValidColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export const setBackgroundColor = (board, color) => {
  if (!isValidColor(color)) return board;
  return { ...board, background: { color: color.toLowerCase(), image: null } };
};

const clampNumber = (value, min, max, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export const normalizeFraming = (value) => {
  const source = value !== null && typeof value === 'object' ? value : {};
  return {
    zoom: clampNumber(source.zoom, FRAMING_LIMITS.minZoom, FRAMING_LIMITS.maxZoom, DEFAULT_FRAMING.zoom),
    x: clampNumber(source.x, FRAMING_LIMITS.minPosition, FRAMING_LIMITS.maxPosition, DEFAULT_FRAMING.x),
    y: clampNumber(source.y, FRAMING_LIMITS.minPosition, FRAMING_LIMITS.maxPosition, DEFAULT_FRAMING.y),
  };
};

export const isDefaultFraming = (value) => {
  const framing = normalizeFraming(value);
  return (
    framing.zoom === DEFAULT_FRAMING.zoom && framing.x === DEFAULT_FRAMING.x && framing.y === DEFAULT_FRAMING.y
  );
};

export const withFraming = (image, framing) => {
  const rest = { ...image };
  delete rest.framing;
  return isDefaultFraming(framing) ? rest : { ...rest, framing: normalizeFraming(framing) };
};

export const setBackgroundImage = (board, image) => {
  if (image === null) {
    return { ...board, background: { ...board.background, image: null } };
  }
  if (!image || !(image.width > 0) || !(image.height > 0)) return board;
  const fresh = 'framing' in image ? withFraming(image, DEFAULT_FRAMING) : image;
  return { ...board, background: { ...board.background, image: fresh } };
};

const finiteOr = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export const setBackgroundFraming = (board, patch) => {
  const image = board.background.image;
  if (!image || patch === null || typeof patch !== 'object') return board;
  const current = normalizeFraming(image.framing);
  const next = normalizeFraming({
    zoom: finiteOr(patch.zoom, current.zoom),
    x: finiteOr(patch.x, current.x),
    y: finiteOr(patch.y, current.y),
  });
  if (next.zoom === current.zoom && next.x === current.x && next.y === current.y) return board;
  return { ...board, background: { ...board.background, image: withFraming(image, next) } };
};

export const normalizeBoardTitle = (value) => {
  if (typeof value !== 'string') return DEFAULT_BOARD_TITLE;
  return Array.from(value.replace(/\p{Cc}+/gu, ' ')).slice(0, MAX_BOARD_TITLE_LENGTH).join('');
};

export const setBoardTitle = (board, title) => {
  if (typeof title !== 'string') return board;
  const next = normalizeBoardTitle(title);
  return next === board.title ? board : { ...board, title: next };
};

export const toggleGrid = (board) => ({ ...board, showGrid: !board.showGrid });

export const getCoverRect = (imageW, imageH, canvasW, canvasH, framing) => {
  if (!(imageW > 0) || !(imageH > 0)) {
    return { left: 0, top: 0, width: canvasW, height: canvasH };
  }
  const { zoom, x, y } = normalizeFraming(framing);
  const scale = Math.max(canvasW / imageW, canvasH / imageH) * zoom;
  const width = imageW * scale;
  const height = imageH * scale;
  return { left: (canvasW - width) * x + 0, top: (canvasH - height) * y + 0, width, height };
};

export const getFramingAxes = (image, canvasW, canvasH) => {
  if (!image || !(image.width > 0) || !(image.height > 0)) {
    return { horizontal: false, vertical: false };
  }
  const { width, height } = getCoverRect(image.width, image.height, canvasW, canvasH, image.framing);
  return {
    horizontal: width - canvasW > FRAMING_MOVE_TOLERANCE,
    vertical: height - canvasH > FRAMING_MOVE_TOLERANCE,
  };
};