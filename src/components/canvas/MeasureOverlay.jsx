import { screenPointToCanvas, clampPointToCanvas, isMeasurable } from '../../domain/measure.js';

const MeasureOverlay = ({ zoom, canvasW, canvasH, isSpacePressed, draft, onDraft, onComplete }) => {
  const getPoint = (e) =>
    clampPointToCanvas(
      screenPointToCanvas(
        { x: e.clientX, y: e.clientY },
        e.currentTarget.getBoundingClientRect(),
        zoom,
      ),
      canvasW,
      canvasH,
    );

  const handlePointerDown = (e) => {
    if (e.button !== 0 || isSpacePressed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getPoint(e);
    onDraft({ start: point, end: point });
  };

  const handlePointerMove = (e) => {
    if (!draft) return;
    onDraft({ start: draft.start, end: getPoint(e) });
  };

  const handlePointerUp = (e) => {
    if (!draft) return;
    const end = getPoint(e);
    if (isMeasurable(draft.start, end, zoom)) onComplete(draft.start, end);
    onDraft(null);
  };

  const handlePointerCancel = () => onDraft(null);

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 90001, cursor: isSpacePressed ? 'inherit' : 'crosshair', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
};

export default MeasureOverlay;