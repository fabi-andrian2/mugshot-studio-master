export const SILHOUETTE_COLOR = '#2e2e2e';
export const SILHOUETTE_CSS_FILTER = 'brightness(0) invert(0.18)';

export const isSubjectVisible = (subject) => subject.visible !== false;

export const getImageFilter = (subject) =>
  subject.silhouette ? SILHOUETTE_CSS_FILTER : 'none';

export const getExportableSubjects = (subjects) =>
  subjects.filter(isSubjectVisible).sort((a, b) => a.zIndex - b.zIndex);