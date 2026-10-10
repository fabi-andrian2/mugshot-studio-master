import { isValidColor } from './board.js';

export const DEFAULT_SILHOUETTE_COLOR = '#2e2e2e';
export const DEFAULT_SILHOUETTE_OPACITY = 1;
export const MIN_SILHOUETTE_OPACITY = 0.1;

export const SILHOUETTE_PRESETS = [
  { value: '#2e2e2e', label: 'Anthracite (défaut)' },
  { value: '#000000', label: 'Noir' },
  { value: '#6b7280', label: 'Gris' },
  { value: '#10b981', label: 'Vert' },
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#ef4444', label: 'Rouge' },
];

const clampOpacity = (value) => Math.max(MIN_SILHOUETTE_OPACITY, Math.min(1, value));

export const isSubjectVisible = (subject) => subject.visible !== false;

export const getSilhouetteStyle = (subject) => ({
  color: isValidColor(subject.silhouetteColor)
    ? subject.silhouetteColor.toLowerCase()
    : DEFAULT_SILHOUETTE_COLOR,
  opacity: Number.isFinite(subject.silhouetteOpacity)
    ? clampOpacity(subject.silhouetteOpacity)
    : DEFAULT_SILHOUETTE_OPACITY,
});

export const updateSilhouette = (subject, { color, opacity }) => {
  const next = { ...subject };
  if (color !== undefined && isValidColor(color)) next.silhouetteColor = color.toLowerCase();
  if (opacity !== undefined && Number.isFinite(opacity)) next.silhouetteOpacity = clampOpacity(opacity);
  return next;
};

export const getExportableSubjects = (subjects) =>
  subjects.filter(isSubjectVisible).sort((a, b) => a.zIndex - b.zIndex);