import { getSubjectGeometry, getSubjectHeightCm } from './geometry.js';
import { formatHeight } from './measurement.js';

export const ANNOTATION_STYLE = {
  fontSize: 30,
  fontFamily: 'Arial, Helvetica, sans-serif',
  lineWidth: 4,
  haloWidth: 7,
  haloColor: '#f2f2f4',
  textColor: '#111827',
  lineColor: '#374151',
  accentColor: '#059669',
  linePadding: 70,
  labelGap: 14,
};

export const getAnnotationItems = ({ subjects, selectedId, annotations, floorY, unit }) => {
  if (!annotations.enabled) return [];

  const targets = annotations.scope === 'all'
    ? [...subjects].sort((a, b) => a.zIndex - b.zIndex)
    : subjects.filter((subject) => subject.id === selectedId);

  return targets.map((subject) => {
    const { visible, head } = getSubjectGeometry(subject, floorY);
    return {
      id: subject.id,
      text: `${subject.name.toUpperCase()} · ${formatHeight(getSubjectHeightCm(subject), unit)}`,
      lineY: head.y,
      lineX1: visible.left - ANNOTATION_STYLE.linePadding,
      lineX2: visible.left + visible.width + ANNOTATION_STYLE.linePadding,
      labelX: subject.x,
      labelY: Math.max(ANNOTATION_STYLE.fontSize + 8, head.y - ANNOTATION_STYLE.labelGap),
      emphasized: subject.id === selectedId,
    };
  });
};