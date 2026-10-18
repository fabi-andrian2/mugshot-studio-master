export const getPointerDelta = (start, current, zoom) => ({
  dx: (current.x - start.x) / zoom,
  dy: (start.y - current.y) / zoom,
});

export const captureDragOrigins = (subjects, ids) => {
  const wanted = new Set(ids);
  return subjects.filter((subject) => wanted.has(subject.id)).map(({ id, x, y }) => ({ id, x, y }));
};

export const resolveDragDelta = (origins, leadId, delta, { canvasW, snapY }) => {
  if (origins.length === 0) return { dx: 0, dy: 0, snapped: false };

  const lead = origins.find((origin) => origin.id === leadId) ?? origins[0];
  const snapped = Math.abs(lead.y + delta.dy) < snapY;
  const dy = snapped ? -lead.y : delta.dy;

  const minX = Math.min(...origins.map((origin) => origin.x));
  const maxX = Math.max(...origins.map((origin) => origin.x));
  const dx = Math.max(-canvasW - minX, Math.min(delta.dx, canvasW * 2 - maxX));

  return { dx, dy, snapped };
};

export const translateSubjects = (subjects, origins, { dx, dy }) => {
  const byId = new Map(origins.map((origin) => [origin.id, origin]));
  return subjects.map((subject) => {
    const origin = byId.get(subject.id);
    return origin ? { ...subject, x: origin.x + dx, y: origin.y + dy, placement: 'manual' } : subject;
  });
};
