import { getExportableSubjects } from './appearance.js';

export const MAX_EXPORT_SIDE = 16384;
export const MAX_EXPORT_AREA = 268435456;

export const EXPORT_LAYER_KINDS = ['background', 'grid', 'mannequin', 'subject', 'annotations'];

export const getExportSize = (canvasW, canvasH) => {
  if (!Number.isFinite(canvasW) || !Number.isFinite(canvasH) || canvasW <= 0 || canvasH <= 0) {
    throw new Error(`Dimensions de planche invalides (${canvasW} × ${canvasH}).`);
  }

  const width = Math.round(canvasW);
  const height = Math.round(canvasH);

  if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE || width * height > MAX_EXPORT_AREA) {
    throw new Error(
      `La planche ${width} × ${height} px dépasse la taille maximale exportable par le navigateur. Réduis le format.`,
    );
  }

  return { width, height };
};

export const getExportLayers = ({ subjects, mannequin = null, annotations = [], background }) => {
  const layers = [{ kind: 'background', background }, { kind: 'grid' }];

  if (mannequin) layers.push({ kind: 'mannequin', geometry: mannequin });

  getExportableSubjects(subjects).forEach((subject) => {
    layers.push({ kind: 'subject', subject });
  });

  if (annotations.length > 0) layers.push({ kind: 'annotations', items: annotations });

  return layers;
};