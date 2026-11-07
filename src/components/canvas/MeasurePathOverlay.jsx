import { useRef } from 'react';
import { screenPointToCanvas, clampPointToCanvas, MIN_MEASURE_SCREEN_PX } from '../../domain/measure.js';
import { MAX_MEASURE_NODES } from '../../domain/measurePath.js';

// Création d'une polyligne ou d'une courbe par clics successifs.
// Un clic sur le dernier point (ou un double-clic) termine la mesure.
const MeasurePathOverlay = ({ zoom, canvasW, canvasH, isSpacePressed, draft, onChange, onFinish }) => {
  const finishedRef = useRef(null);
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
    const done = finishedRef.current;
    if (done && e.timeStamp - done.time < 450 && Math.hypot(e.clientX - done.x, e.clientY - done.y) < 12) {
      return;
    }
    const point = getPoint(e);
    const nodes = draft?.nodes ?? [];
    const last = nodes[nodes.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) * zoom < MIN_MEASURE_SCREEN_PX) {
      if (nodes.length >= 2) {
        finishedRef.current = { time: e.timeStamp, x: e.clientX, y: e.clientY };
        onFinish();
      }
      return;
    }
    if (nodes.length >= MAX_MEASURE_NODES) return;
    onChange({ nodes: [...nodes, point], cursor: point });
  };

  const handlePointerMove = (e) => {
    if (!draft || draft.nodes.length === 0) return;
    onChange({ nodes: draft.nodes, cursor: getPoint(e) });
  };

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 90001, cursor: isSpacePressed ? 'inherit' : 'crosshair', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    />
  );
};

export default MeasurePathOverlay;
