import { getSubjectGeometry, getSubjectHeightCm } from './geometry.js';
import { formatHeight } from './measurement.js';
import { CANVAS_FONT_FAMILY } from './typography.js';
import { isSubjectVisible } from './appearance.js';

export const ANNOTATION_STYLE = {
  fontSize: 30,
  fontFamily: CANVAS_FONT_FAMILY,
  lineWidth: 4,
  haloWidth: 7,
  haloColor: '#f2f2f4',
  textColor: '#111827',
  lineColor: '#374151',
  accentColor: '#059669',
  linePadding: 70,
  labelGap: 14,
};

export const DEFAULT_ANNOTATIONS = { enabled: false, scope: 'selected' };

export const getAnnotationItems = ({ subjects, selectedId, annotations, floorY, unit }) => {
  if (!annotations.enabled) return [];

  const shown = subjects.filter(isSubjectVisible);
  const targets = annotations.scope === 'all'
    ? [...shown].sort((a, b) => a.zIndex - b.zIndex)
    : shown.filter((subject) => subject.id === selectedId);

  return targets.map((subject) => {
    const { visible, head, rotation, projectedBounds } = getSubjectGeometry(subject, floorY);
    const rotated = rotation !== 0;
    const span = rotated
      ? {
          left: Math.min(projectedBounds.left, head.x),
          right: Math.max(projectedBounds.left + projectedBounds.width, head.x),
        }
      : { left: visible.left, right: visible.left + visible.width };
    return {
      id: subject.id,
      text: `${subject.name.toUpperCase()} · ${formatHeight(getSubjectHeightCm(subject), unit)}`,
      showLine: true,
      lineY: head.y,
      lineX1: span.left - ANNOTATION_STYLE.linePadding,
      lineX2: span.right + ANNOTATION_STYLE.linePadding,
      labelX: rotated ? head.x : subject.x,
      labelY: Math.max(ANNOTATION_STYLE.fontSize + 8, head.y - ANNOTATION_STYLE.labelGap),
      emphasized: subject.id === selectedId,
    };
  });
};