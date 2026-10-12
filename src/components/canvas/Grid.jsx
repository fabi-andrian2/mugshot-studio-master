import { memo } from 'react';
import { FLOOR_MARGIN } from '../../domain/constants.js';
import { getGridCmTicks, getGridInchTicks } from '../../domain/gridScale.js';

const buildGridElements = (canvasW, canvasH, showGrid) => {
  const els = [];
  for (const { cm, y, kind } of getGridCmTicks(canvasH)) {
    const major = kind === 'major';
    const mid = kind === 'mid';
    if (major) {
      if (showGrid) {
        els.push(<line key={`cl${cm}`} x1="130" y1={y} x2={canvasW - 130} y2={y} stroke="#222" strokeWidth="2" />);
      }
      els.push(<text key={`ctl${cm}`} x="122" y={y + 6} fontSize="22" fill="#000" fontWeight="bold" textAnchor="end">{cm}</text>);
      els.push(<text key={`ctr${cm}`} x={canvasW - 122} y={y + 6} fontSize="22" fill="#000" fontWeight="bold" textAnchor="start">{cm}</text>);
    } else if (mid) {
      els.push(<line key={`ml${cm}`} x1="130" y1={y} x2="162" y2={y} stroke="#555" strokeWidth="1.2" />);
      els.push(<line key={`mr${cm}`} x1={canvasW - 130} y1={y} x2={canvasW - 162} y2={y} stroke="#555" strokeWidth="1.2" />);
    } else {
      els.push(<line key={`sl${cm}`} x1="130" y1={y} x2="147" y2={y} stroke="#aaa" strokeWidth="0.8" />);
      els.push(<line key={`sr${cm}`} x1={canvasW - 130} y1={y} x2={canvasW - 147} y2={y} stroke="#aaa" strokeWidth="0.8" />);
    }
  }
  for (const { inch: i, y, feet: foot, remainder: rem } of getGridInchTicks(canvasH)) {
    const ft = rem === 0;
    const tl = ft ? 36 : i % 6 === 0 ? 22 : 12;
    els.push(<line key={`il${i}`} x1={80 - tl} y1={y} x2="80" y2={y} stroke="#000" strokeWidth={ft ? 2 : 0.8} />);
    els.push(<line key={`ir${i}`} x1={canvasW - 80} y1={y} x2={canvasW - 80 + tl} y2={y} stroke="#000" strokeWidth={ft ? 2 : 0.8} />);
    if (ft) {
      els.push(<text key={`fl${i}`} x="38" y={y + 7} fontSize="26" fill="#000" fontWeight="900" textAnchor="middle">{foot}'</text>);
      els.push(<text key={`fr${i}`} x={canvasW - 38} y={y + 7} fontSize="26" fill="#000" fontWeight="900" textAnchor="middle">{foot}'</text>);
    } else if (i % 3 === 0 && rem > 0) {
      els.push(<text key={`inl${i}`} x="40" y={y + 5} fontSize="13" fill="#555" textAnchor="middle">{rem}"</text>);
      els.push(<text key={`inr${i}`} x={canvasW - 40} y={y + 5} fontSize="13" fill="#555" textAnchor="middle">{rem}"</text>);
    }
  }
  return els;
};

const Grid = memo(function Grid({ canvasW, canvasH, showGrid = true }) {
  const floorY = canvasH - FLOOR_MARGIN;
  return (
    <svg className="absolute inset-0 pointer-events-none" data-export-grid="true"
      width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`}>
      <text x={canvasW / 2} y="60" fontSize="38" fill="#111" fontWeight="900"
        textAnchor="middle" fontFamily="Impact,sans-serif" letterSpacing="3">
        MUGSHOT STUDIO — PLANCHE DE TAILLE
      </text>
      <text x="120" y="55" fontSize="16" fill="#333" fontWeight="bold">FEET / IN</text>
      <text x={canvasW - 120} y="55" fontSize="16" fill="#333" fontWeight="bold" textAnchor="end">FEET / IN</text>
      <text x="120" y="76" fontSize="16" fill="#333">CM</text>
      <text x={canvasW - 120} y="76" fontSize="16" fill="#333" textAnchor="end">CM</text>
      <text x={canvasW / 2} y={canvasH - 10} fontSize="14" fill="#aaa" textAnchor="middle">{canvasW} × {canvasH} px</text>
      {buildGridElements(canvasW, canvasH, showGrid)}
      <rect x="0" y={floorY} width={canvasW} height={canvasH - floorY} fill="#c8c8cc" />
      <line x1="0" y1={floorY} x2={canvasW} y2={floorY} stroke="#000" strokeWidth="6" />
      <text x={canvasW / 2} y={floorY + 34} fontSize="24" fill="#333" fontWeight="bold" textAnchor="middle">▲ SOL — 0 cm ▲</text>
    </svg>
  );
});

export default Grid;