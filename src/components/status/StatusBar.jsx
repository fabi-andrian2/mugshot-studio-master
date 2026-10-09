import { useEffect, useState } from 'react';
import { CM_TO_PX } from '../../domain/constants.js';

const StatusBar = ({
  containerRef,
  workspaceRef,
  zoom,
  floorY,
  subjectCount,
  hiddenCount = 0,
  selectionLabel,
  canvasW,
  canvasH,
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, yCm: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;
      const r = workspace.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) / zoom);
      const yCm = Math.round((floorY - (e.clientY - r.top) / zoom) / CM_TO_PX);
      setMousePos(prev => (prev.x === x && prev.yCm === yCm ? prev : { x, yCm }));
    };
    container.addEventListener('mousemove', onMove);
    return () => container.removeEventListener('mousemove', onMove);
  }, [containerRef, workspaceRef, zoom, floorY]);

  return (
    <footer className="h-8 border-t border-gray-800 bg-[#111] flex items-center px-4 gap-5 text-[11px] text-gray-600 shrink-0">
      <span>X <span className="text-gray-400 font-mono">{mousePos.x}px</span></span>
      <span>H <span className="text-emerald-500 font-mono">{Math.max(0, mousePos.yCm)} cm</span></span>
      <span>
        Sujets <strong className="text-gray-300">{subjectCount}</strong>
        {hiddenCount > 0 && <span className="text-amber-400"> · {hiddenCount} masqué{hiddenCount > 1 ? 's' : ''}</span>}
      </span>
      <span>{canvasW}×{canvasH} px</span>
      {selectionLabel && (
        <span>Sélection <strong className="text-emerald-400 font-mono">{selectionLabel}</strong></span>
      )}
      <span className="ml-auto">
        Espace + glisser : naviguer · Ctrl + molette : zoom · Repères : tête (bleu), pied (vert)
      </span>
    </footer>
  );
};

export default StatusBar;