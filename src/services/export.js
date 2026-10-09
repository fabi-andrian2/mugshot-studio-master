import { getSubjectGeometry } from '../domain/geometry.js';
import { ANNOTATION_STYLE } from '../domain/annotations.js';
import { SILHOUETTE_COLOR, getExportableSubjects } from '../domain/appearance.js';
import loadImage from './loadImage.js';
import { DEFAULT_BACKGROUND, getCoverRect } from '../domain/board.js';

const drawBackground = async (ctx, background, canvasW, canvasH) => {
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (!background.image) return;

  try {
    const img = await loadImage(background.image.url);
    const rect = getCoverRect(img.naturalWidth, img.naturalHeight, canvasW, canvasH);
    ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height);
  } catch (error) {
    console.error(error);
  }
};

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

const toSilhouette = (img) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = SILHOUETTE_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};

const drawSubject = (ctx, img, subject, floorY) => {
  const { box, originX } = getSubjectGeometry(subject, floorY);
  const source = subject.silhouette ? toSilhouette(img) : img;
  ctx.save();
  ctx.translate(box.left + originX, box.top);
  if (subject.flipX) ctx.scale(-1, 1);
  ctx.drawImage(source, -originX, 0, box.width, box.height);
  ctx.restore();
};

const drawAnnotations = (ctx, items) => {
  items.forEach((item) => {
    ctx.save();

    ctx.strokeStyle = item.emphasized ? ANNOTATION_STYLE.accentColor : ANNOTATION_STYLE.lineColor;
    ctx.lineWidth = ANNOTATION_STYLE.lineWidth;
    ctx.beginPath();
    ctx.moveTo(item.lineX1, item.lineY);
    ctx.lineTo(item.lineX2, item.lineY);
    ctx.stroke();

    ctx.font = `bold ${ANNOTATION_STYLE.fontSize}px ${ANNOTATION_STYLE.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = ANNOTATION_STYLE.haloWidth;
    ctx.strokeStyle = ANNOTATION_STYLE.haloColor;
    ctx.strokeText(item.text, item.labelX, item.labelY);
    ctx.fillStyle = item.emphasized ? ANNOTATION_STYLE.accentColor : ANNOTATION_STYLE.textColor;
    ctx.fillText(item.text, item.labelX, item.labelY);

    ctx.restore();
  });
};

export const renderBoard = async ({
  svgElement,
  subjects,
  annotations = [],
  background = DEFAULT_BACKGROUND,
  canvasW,
  canvasH,
  floorY,
}) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  await drawBackground(ctx, background, canvasW, canvasH);

  if (svgElement) {
    await drawGrid(ctx, svgElement, canvasW, canvasH);
  }

  for (const subject of getExportableSubjects(subjects)) {
    const img = await loadImage(subject.url);
    drawSubject(ctx, img, subject, floorY);
  }

  drawAnnotations(ctx, annotations);

  return canvas;
};

export const downloadCanvasAsPng = (canvas) => {
  const link = document.createElement('a');
  link.download = `Mugshot_Studio_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};