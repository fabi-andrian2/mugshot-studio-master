import { getSubjectGeometry } from '../domain/geometry.js';
import { ANNOTATION_STYLE } from '../domain/annotations.js';
import { getSilhouetteStyle } from '../domain/appearance.js';
import { DEFAULT_BACKGROUND, getCoverRect } from '../domain/board.js';
import { getExportSize, getExportLayers } from '../domain/exportPlan.js';
import loadImage from './loadImage.js';

const DOWNLOAD_URL_LIFETIME_MS = 10000;

const drawBackground = async (ctx, background, canvasW, canvasH) => {
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (!background.image) return;

  let img;
  try {
    img = await loadImage(background.image.url);
  } catch (error) {
    throw new Error(`Image de fond illisible (${background.image.fileName ?? 'sans nom'}).`, { cause: error });
  }

  const rect = getCoverRect(img.naturalWidth, img.naturalHeight, canvasW, canvasH);
  ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height);
};

const drawGrid = async (ctx, svgElement, canvasW, canvasH) => {
  if (!svgElement) {
    throw new Error('Grille introuvable : le rendu de la planche est incomplet.');
  }

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

const toSilhouette = (img, color) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};

const drawSubject = async (ctx, subject, floorY) => {
  let img;
  try {
    img = await loadImage(subject.url);
  } catch (error) {
    throw new Error(`Image du sujet illisible (${subject.name}).`, { cause: error });
  }

  const { box, originX } = getSubjectGeometry(subject, floorY);
  const silhouette = getSilhouetteStyle(subject);
  const source = subject.silhouette ? toSilhouette(img, silhouette.color) : img;

  ctx.save();
  if (subject.silhouette) ctx.globalAlpha = silhouette.opacity;
  ctx.translate(box.left + originX, box.top);
  if (subject.flipX) ctx.scale(-1, 1);
  ctx.drawImage(source, -originX, 0, box.width, box.height);
  ctx.restore();

  if (subject.silhouette) {
    source.width = 0;
    source.height = 0;
  }
};

const drawMannequin = (ctx, geometry) => {
  ctx.save();
  ctx.translate(geometry.left, geometry.top);
  ctx.scale(geometry.scale, geometry.scale);
  ctx.globalAlpha = geometry.opacity;
  ctx.fillStyle = geometry.color;
  ctx.fill(new Path2D(geometry.path));
  ctx.restore();

  ctx.save();
  ctx.font = `bold ${geometry.labelFontSize}px ${geometry.labelFontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = geometry.color;
  ctx.fillText(geometry.label, geometry.labelX, geometry.labelY);
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
  mannequin = null,
  canvasW,
  canvasH,
  floorY,
}) => {
  const { width, height } = getExportSize(canvasW, canvasH);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Le navigateur n\'a pas pu créer la surface de rendu (planche trop grande ?).');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const layers = getExportLayers({ subjects, mannequin, annotations, background });

  for (const layer of layers) {
    if (layer.kind === 'background') await drawBackground(ctx, layer.background, width, height);
    else if (layer.kind === 'grid') await drawGrid(ctx, svgElement, width, height);
    else if (layer.kind === 'mannequin') drawMannequin(ctx, layer.geometry);
    else if (layer.kind === 'subject') await drawSubject(ctx, layer.subject, floorY);
    else if (layer.kind === 'annotations') drawAnnotations(ctx, layer.items);
  }

  return canvas;
};

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Le navigateur n\'a pas pu encoder le PNG (planche trop grande ?).'));
    }, 'image/png');
  });

export const downloadCanvasAsPng = async (canvas) => {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `Mugshot_Studio_${Date.now()}.png`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
};