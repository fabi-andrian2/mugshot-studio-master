import { getBaseDimensions } from '../domain/geometry.js';

const BOARD_BACKGROUND = '#f2f2f4';

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Chargement impossible : ${src}`));
    img.src = src;
  });

const drawGrid = async (ctx, svgElement, canvasW, canvasH) => {
  const svgText = new XMLSerializer().serializeToString(svgElement);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    ctx.drawImage(img, 0, 0, canvasW, canvasH);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const drawSubject = (ctx, img, subject, floorY) => {
  const base = getBaseDimensions({ naturalW: img.naturalWidth, naturalH: img.naturalHeight }, floorY);
  const renderedW = base.w * subject.scale;
  const renderedH = base.h * subject.scale;
  const centerX = subject.x + base.w / 2;
  const centerY = floorY - subject.y;

  ctx.save();
  ctx.translate(centerX, centerY);
  if (subject.flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -renderedW / 2, -renderedH, renderedW, renderedH);
  ctx.restore();
};

export const renderBoard = async ({ svgElement, subjects, canvasW, canvasH, floorY }) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BOARD_BACKGROUND;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (svgElement) {
    await drawGrid(ctx, svgElement, canvasW, canvasH);
  }

  const ordered = [...subjects].sort((a, b) => a.zIndex - b.zIndex);
  for (const subject of ordered) {
    const img = await loadImage(subject.url);
    drawSubject(ctx, img, subject, floorY);
  }

  return canvas;
};

export const downloadCanvasAsPng = (canvas) => {
  const link = document.createElement('a');
  link.download = `Mugshot_Studio_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};