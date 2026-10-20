export const isForeignPointer = (activePointerId, pointerId) =>
  activePointerId !== null && activePointerId !== undefined && activePointerId !== pointerId;

export const getPanView = (panInfo, point, zoom) => ({
  zoom,
  panX: panInfo.initPanX + (point.x - panInfo.startX),
  panY: panInfo.initPanY + (point.y - panInfo.startY),
});
