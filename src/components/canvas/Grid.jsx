import { memo } from 'react';
import { FLOOR_MARGIN } from '../../domain/constants.js';
import { getGridCmTicks, getGridInchTicks } from '../../domain/gridScale.js';
import { getGridPalette } from '../../domain/gridContrast.js';

const CASING_EXTRA = 2.5;
const TEXT_HALO_WIDTH = 4;

const haloedText = (palette, { key, ...props }, children) => (
  <text
    key={key}
    {...props}
    stroke={palette.halo}
    strokeOpacity={palette.haloOpacity}
    strokeWidth={TEXT_HALO_WIDTH}
    strokeLinejoin="round"
    paintOrder="stroke"
  >
    {children}
  </text>
);

const casedLine = (palette, key, x1, x2, y, stroke, strokeWidth) => [
  <line key={`${key}-c`} x1={x1} y1={y} x2={x2} y2={y} stroke={palette.halo}
    strokeOpacity={palette.haloOpacity} strokeWidth={strokeWidth + CASING_EXTRA} />,
  <line key={key} x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={strokeWidth} />,
];

const buildGridElements = (canvasW, canvasH, showGrid, palette) => {
  const els = [];
  for (const { cm, y, kind } of getGridCmTicks(canvasH)) {
    const major = kind === 'major';
    const mid = kind === 'mid';
    if (major) {
      if (showGrid) {
        els.push(...casedLine(palette, `cl${cm}`, 130, canvasW - 130, y, palette.strong, 2));
      }
      els.push(haloedText(palette, { key: `ctl${cm}`, x: 122, y: y + 6, fontSize: 22, fill: palette.ink, fontWeight: 'bold', textAnchor: 'end' }, cm));
      els.push(haloedText(palette, { key: `ctr${cm}`, x: canvasW - 122, y: y + 6, fontSize: 22, fill: palette.ink, fontWeight: 'bold', textAnchor: 'start' }, cm));
    } else if (mid) {
      els.push(...casedLine(palette, `ml${cm}`, 130, 162, y, palette.mid, 1.2));
      els.push(...casedLine(palette, `mr${cm}`, canvasW - 130, canvasW - 162, y, palette.mid, 1.2));
    } else {
      els.push(...casedLine(palette, `sl${cm}`, 130, 147, y, palette.minor, 0.8));
      els.push(...casedLine(palette, `sr${cm}`, canvasW - 130, canvasW - 147, y, palette.minor, 0.8));
    }
  }
  for (const { inch: i, y, feet: foot, remainder: rem } of getGridInchTicks(canvasH)) {
    const ft = rem === 0;
    const tl = ft ? 36 : i % 6 === 0 ? 22 : 12;
    const w = ft ? 2 : 0.8;
    els.push(...casedLine(palette, `il${i}`, 80 - tl, 80, y, palette.ink, w));
    els.push(...casedLine(palette, `ir${i}`, canvasW - 80, canvasW - 80 + tl, y, palette.ink, w));
    if (ft) {
      els.push(haloedText(palette, { key: `fl${i}`, x: 38, y: y + 7, fontSize: 26, fill: palette.ink, fontWeight: '900', textAnchor: 'middle' }, `${foot}'`));
      els.push(haloedText(palette, { key: `fr${i}`, x: canvasW - 38, y: y + 7, fontSize: 26, fill: palette.ink, fontWeight: '900', textAnchor: 'middle' }, `${foot}'`));
    } else if (i % 3 === 0 && rem > 0) {
      els.push(haloedText(palette, { key: `inl${i}`, x: 40, y: y + 5, fontSize: 13, fill: palette.label, textAnchor: 'middle' }, `${rem}"`));
      els.push(haloedText(palette, { key: `inr${i}`, x: canvasW - 40, y: y + 5, fontSize: 13, fill: palette.label, textAnchor: 'middle' }, `${rem}"`));
    }
  }
  return els;
};

const Grid = memo(function Grid({ canvasW, canvasH, showGrid = true, background }) {
  const floorY = canvasH - FLOOR_MARGIN;
  const palette = getGridPalette(background);
  return (
    <svg className="absolute inset-0 pointer-events-none" data-export-grid="true"
      width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`}>
      {haloedText(palette, { x: canvasW / 2, y: 60, fontSize: 38, fill: palette.head, fontWeight: '900', textAnchor: 'middle', fontFamily: 'Impact,sans-serif', letterSpacing: 3 }, 'MUGSHOT STUDIO — PLANCHE DE TAILLE')}
      {haloedText(palette, { x: 120, y: 55, fontSize: 16, fill: palette.sub, fontWeight: 'bold' }, 'FEET / IN')}
      {haloedText(palette, { x: canvasW - 120, y: 55, fontSize: 16, fill: palette.sub, fontWeight: 'bold', textAnchor: 'end' }, 'FEET / IN')}
      {haloedText(palette, { x: 120, y: 76, fontSize: 16, fill: palette.sub }, 'CM')}
      {haloedText(palette, { x: canvasW - 120, y: 76, fontSize: 16, fill: palette.sub, textAnchor: 'end' }, 'CM')}
      {haloedText(palette, { x: canvasW / 2, y: canvasH - 10, fontSize: 14, fill: palette.caption, textAnchor: 'middle' }, `${canvasW} × ${canvasH} px`)}
      {buildGridElements(canvasW, canvasH, showGrid, palette)}
      <rect x="0" y={floorY} width={canvasW} height={canvasH - floorY} fill="#c8c8cc" />
      <line x1="0" y1={floorY} x2={canvasW} y2={floorY} stroke="#000" strokeWidth="6" />
      <text x={canvasW / 2} y={floorY + 34} fontSize="24" fill="#333" fontWeight="bold" textAnchor="middle">▲ SOL — 0 cm ▲</text>
    </svg>
  );
});

export default Grid;