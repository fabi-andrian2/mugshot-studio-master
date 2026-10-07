import { getSubjectGeometry, getSubjectHeightCm } from './geometry.js';

export const LAYOUT_SIDE_MARGIN = 180;
export const LAYOUT_MAX_GAP = 120;
export const LAYOUT_MAX_OVERLAP_RATIO = 0.3;
export const IMPORT_GAP = 60;

const getVisibleRect = (subject, floorY) => getSubjectGeometry(subject, floorY).visible;

export const sortSubjects = (subjects, order) => {
  const list = [...subjects];
  if (order === 'height-asc') {
    return list.sort((a, b) => getSubjectHeightCm(a) - getSubjectHeightCm(b) || a.x - b.x);
  }
  if (order === 'height-desc') {
    return list.sort((a, b) => getSubjectHeightCm(b) - getSubjectHeightCm(a) || a.x - b.x);
  }
  return list.sort((a, b) => a.x - b.x || a.zIndex - b.zIndex);
};

export const layoutRow = (ordered, { canvasW, floorY }) => {
  if (ordered.length === 0) return { positions: [], gap: 0, fits: true };

  const widths = ordered.map((subject) => getVisibleRect(subject, floorY).width);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const count = ordered.length;
  const available = canvasW - 2 * LAYOUT_SIDE_MARGIN;
  const minGap = -(total / count) * LAYOUT_MAX_OVERLAP_RATIO;
  const ideal = count > 1 ? (available - total) / (count - 1) : 0;
  const gap = count > 1 ? Math.max(minGap, Math.min(LAYOUT_MAX_GAP, ideal)) : 0;
  const fits = count > 1 ? ideal >= minGap : total <= available;

  let cursor = canvasW / 2 - (total + gap * (count - 1)) / 2;
  const positions = ordered.map((subject, i) => {
    const x = cursor + widths[i] / 2;
    cursor += widths[i] + gap;
    return { id: subject.id, x };
  });

  return { positions, gap, fits };
};

const withPositions = (subjects, positions) => {
  const xById = new Map(positions.map((position) => [position.id, position.x]));
  return subjects.map((subject) =>
    xById.has(subject.id) ? { ...subject, x: xById.get(subject.id), placement: 'auto' } : subject,
  );
};

export const arrangeSubjects = (subjects, command, { canvasW, floorY }) => {
  if (subjects.length === 0) return { subjects, fits: true };

  if (command === 'center') {
    const rects = subjects.map((subject) => getVisibleRect(subject, floorY));
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.left + rect.width));
    const delta = canvasW / 2 - (left + right) / 2;
    return { subjects: subjects.map((subject) => ({ ...subject, x: subject.x + delta })), fits: true };
  }

  if (command === 'floor') {
    return { subjects: subjects.map((subject) => ({ ...subject, y: 0 })), fits: true };
  }

  const orders = { space: 'current', 'sort-asc': 'height-asc', 'sort-desc': 'height-desc' };
  if (orders[command]) {
    const { positions, fits } = layoutRow(sortSubjects(subjects, orders[command]), { canvasW, floorY });
    return { subjects: withPositions(subjects, positions), fits };
  }

  return { subjects, fits: true };
};

export const layoutOnImport = (existing, created, { canvasW, floorY }) => {
  const context = { canvasW, floorY };

  if (existing.every((subject) => subject.placement !== 'manual')) {
    const ordered = [...sortSubjects(existing, 'current'), ...created];
    const { positions } = layoutRow(ordered, context);
    return withPositions([...existing, ...created], positions);
  }

  const widths = created.map((subject) => getVisibleRect(subject, floorY).width);
  const rowWidth = widths.reduce((sum, width) => sum + width, 0) + IMPORT_GAP * (created.length - 1);
  const rightEdge = Math.max(
    ...existing.map((subject) => {
      const rect = getVisibleRect(subject, floorY);
      return rect.left + rect.width;
    }),
  );
  const startLeft = rightEdge + IMPORT_GAP;

  if (startLeft + rowWidth <= canvasW - LAYOUT_SIDE_MARGIN) {
    let cursor = startLeft;
    const positions = created.map((subject, i) => {
      const x = cursor + widths[i] / 2;
      cursor += widths[i] + IMPORT_GAP;
      return { id: subject.id, x };
    });
    return [...existing, ...withPositions(created, positions)];
  }

  const { positions } = layoutRow(created, context);
  return [...existing, ...withPositions(created, positions)];
};