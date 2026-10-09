export const DEFAULT_BACKGROUND_COLOR = '#f2f2f4';

export const DEFAULT_BACKGROUND = { color: DEFAULT_BACKGROUND_COLOR, image: null };

export const DEFAULT_BOARD = { background: DEFAULT_BACKGROUND, showGrid: true };

export const BACKGROUND_PRESETS = [
  { value: '#f2f2f4', label: 'Gris clair (défaut)' },
  { value: '#ffffff', label: 'Blanc' },
  { value: '#e9e4d8', label: 'Beige' },
  { value: '#dbe7f0', label: 'Bleu pâle' },
  { value: '#dfe9df', label: 'Vert pâle' },
  { value: '#f3dede', label: 'Rose pâle' },
];

export const isValidColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export const setBackgroundColor = (board, color) => {
  if (!isValidColor(color)) return board;
  return { ...board, background: { color: color.toLowerCase(), image: null } };
};

export const setBackgroundImage = (board, image) => {
  if (image === null) {
    return { ...board, background: { ...board.background, image: null } };
  }
  if (!image || !(image.width > 0) || !(image.height > 0)) return board;
  return { ...board, background: { ...board.background, image } };
};

export const toggleGrid = (board) => ({ ...board, showGrid: !board.showGrid });

export const getCoverRect = (imageW, imageH, canvasW, canvasH) => {
  if (!(imageW > 0) || !(imageH > 0)) {
    return { left: 0, top: 0, width: canvasW, height: canvasH };
  }
  const scale = Math.max(canvasW / imageW, canvasH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { left: (canvasW - width) / 2, top: (canvasH - height) / 2, width, height };
};