import { getSubjectGeometry } from '../domain/geometry.js';
import { ANNOTATION_STYLE } from '../domain/annotations.js';
import { MEASURE_STYLE } from '../domain/measure.js';
import { getSilhouetteStyle } from '../domain/appearance.js';
import { applyStepsToContext } from '../domain/rotation.js';
import { SHADOW_CLIP_EXTENT } from '../domain/shadows.js';
import { DEFAULT_BACKGROUND, getCoverRect } from '../domain/board.js';
import { getExportSize, getExportLayers } from '../domain/exportPlan.js';
import loadImage from './loadImage.js';
import { savePngBlob } from './saveFile.js';

export const drawBackground = async (ctx, background, canvasW, canvasH, load = loadImage) => {
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (!background.image) return;

  let img;
  try {
    img = await load(background.image.url);
  } catch (error) {
    throw new Error(`Image de fond illisible (${background.image.fileName ?? 'sans nom'}).`, { cause: error });
  }

  const rect = getCoverRect(img.naturalWidth, img.naturalHeight, canvasW, canvasH, background.image.framing);
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

  const { box, transformSteps } = getSubjectGeometry(subject, floorY);
  const silhouette = getSilhouetteStyle(subject);
  const source = subject.silhouette ? toSilhouette(img, silhouette.color) : img;

  ctx.save();
  if (subject.silhouette) ctx.globalAlpha = silhouette.opacity;
  applyStepsToContext(ctx, transformSteps);
  ctx.drawImage(source, box.left, box.top, box.width, box.height);
  ctx.restore();

  if (subject.silhouette) {
    source.width = 0;
    source.height = 0;
  }
};

const createLayer = (width, height) => {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  return layer;
};

const toShadowSilhouette = (img, fade) => {
  const canvas = createLayer(img.naturalWidth, img.naturalHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, fade.top * canvas.height, 0, fade.ground * canvas.height);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${fade.tipAlpha})`);
  gradient.addColorStop(1, '#000');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};

const compositeLayer = (ctx, layer, { blur, opacity }) => {
  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  ctx.globalAlpha = opacity;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
};

const drawShadows = async (ctx, shadows, width, height) => {
  const { style, items } = shadows;
  const cast = createLayer(width, height);
  const castCtx = cast.getContext('2d');
  const contact = createLayer(width, height);
  const contactCtx = contact.getContext('2d');
  contactCtx.fillStyle = '#000';

  for (const plan of items) {
    let img;
    try {
      img = await loadImage(plan.url);
    } catch (error) {
      throw new Error('Image du sujet illisible (ombre).', { cause: error });
    }
    const silhouette = toShadowSilhouette(img, plan.fade);
    const { a, b, c, d, e, f } = plan.projection;

    castCtx.save();
    castCtx.transform(a, b, c, d, e, f);
    castCtx.beginPath();
    castCtx.rect(-SHADOW_CLIP_EXTENT, -SHADOW_CLIP_EXTENT, 2 * SHADOW_CLIP_EXTENT, SHADOW_CLIP_EXTENT + plan.clipY);
    castCtx.clip();
    applyStepsToContext(castCtx, plan.transformSteps);
    castCtx.drawImage(silhouette, plan.box.left, plan.box.top, plan.box.width, plan.box.height);
    castCtx.restore();

    silhouette.width = 0;
    silhouette.height = 0;

    contactCtx.beginPath();
    contactCtx.ellipse(plan.contact.cx, plan.contact.cy, plan.contact.rx, plan.contact.ry, 0, 0, Math.PI * 2);
    contactCtx.fill();
  }

  compositeLayer(ctx, cast, { blur: style.castBlur, opacity: style.castOpacity });
  compositeLayer(ctx, contact, { blur: style.contactBlur, opacity: style.contactOpacity });

  cast.width = 0;
  cast.height = 0;
  contact.width = 0;
  contact.height = 0;
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
    if (item.showLine) {
      ctx.beginPath();
      ctx.moveTo(item.lineX1, item.lineY);
      ctx.lineTo(item.lineX2, item.lineY);
      ctx.stroke();
    }

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

const drawMeasures = (ctx, items) => {
  items.forEach((item) => {
    ctx.save();

    ctx.strokeStyle = MEASURE_STYLE.color;
    ctx.lineWidth = MEASURE_STYLE.lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(item.x1, item.y1);
    ctx.lineTo(item.x2, item.y2);
    ctx.stroke();

    ctx.fillStyle = MEASURE_STYLE.color;
    [[item.x1, item.y1], [item.x2, item.y2]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, MEASURE_STYLE.endpointRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = `bold ${MEASURE_STYLE.fontSize}px ${MEASURE_STYLE.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = MEASURE_STYLE.haloWidth;
    ctx.strokeStyle = MEASURE_STYLE.outlineColor;
    ctx.strokeText(item.text, item.labelX, item.labelY);
    ctx.fillStyle = MEASURE_STYLE.color;
    ctx.fillText(item.text, item.labelX, item.labelY);

    ctx.restore();
  });
};

export const renderBoard = async ({
  svgElement,
  subjects,
  annotations = [],
  measures = [],
  background = DEFAULT_BACKGROUND,
  mannequin = null,
  shadows = null,
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

  const layers = getExportLayers({ subjects, mannequin, measures, annotations, shadows, background });

  for (const layer of layers) {
    if (layer.kind === 'background') await drawBackground(ctx, layer.background, width, height);
    else if (layer.kind === 'grid') await drawGrid(ctx, svgElement, width, height);
    else if (layer.kind === 'mannequin') drawMannequin(ctx, layer.geometry);
    else if (layer.kind === 'shadows') await drawShadows(ctx, layer.shadows, width, height);
    else if (layer.kind === 'subject') await drawSubject(ctx, layer.subject, floorY);
    else if (layer.kind === 'measures') drawMeasures(ctx, layer.items);
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

export const saveCanvasAsPng = async (canvas, options) => savePngBlob(await canvasToBlob(canvas), options);
