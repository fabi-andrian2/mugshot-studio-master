import { memo, useMemo } from 'react';
import { FLOOR_MARGIN } from '../../domain/constants.js';
import { getGridCmTicks, getGridInchTicks } from '../../domain/gridScale.js';
import { FLOOR_SHADOW_FALLOFF, getGridPalette } from '../../domain/gridContrast.js';
import { CANVAS_FONT_FAMILY, BOARD_TITLE_FONT_FAMILY } from '../../domain/typography.js';
import { DEFAULT_BOARD_TITLE } from '../../domain/board.js';
import { getBoardTitleLayout } from '../../domain/boardTitle.js';
import { measureTitleGlyphs } from '../../services/textMeasure.js';

const CASING_EXTRA = 2.5;
const TEXT_HALO_WIDTH = 4;
const FLOOR_SHADOW_ID = 'floor-shadow';

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
      els.push(haloedText(palette, { key: `fl${i}`, x: 38, y: y + 7, fontSize: 26, fill: palette.ink, fontWeight: 'bold', textAnchor: 'middle' }, `${foot}'`));
      els.push(haloedText(palette, { key: `fr${i}`, x: canvasW - 38, y: y + 7, fontSize: 26, fill: palette.ink, fontWeight: 'bold', textAnchor: 'middle' }, `${foot}'`));
    } else if (i % 3 === 0 && rem > 0) {
      els.push(haloedText(palette, { key: `inl${i}`, x: 40, y: y + 5, fontSize: 13, fill: palette.label, textAnchor: 'middle' }, `${rem}"`));
      els.push(haloedText(palette, { key: `inr${i}`, x: canvasW - 40, y: y + 5, fontSize: 13, fill: palette.label, textAnchor: 'middle' }, `${rem}"`));
    }
  }
  return els;
};

const Grid = memo(function Grid({ canvasW, canvasH, showGrid = true, background, title = DEFAULT_BOARD_TITLE }) {
  const floorY = canvasH - FLOOR_MARGIN;
  const palette = getGridPalette(background);
  const titleLayout = useMemo(() => getBoardTitleLayout(title, canvasW, measureTitleGlyphs), [title, canvasW]);
  return (
    <svg className="absolute inset-0 pointer-events-none" data-export-grid="true"
      width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`}
      fontFamily={CANVAS_FONT_FAMILY}>
      {titleLayout.lines.map((line, index) =>
        haloedText(palette, {
          key: `title-${index}`,
          'data-board-title': index,
          x: canvasW / 2,
          y: line.y,
          fontSize: line.fontSize,
          fill: palette.head,
          fontWeight: '900',
          textAnchor: 'middle',
          fontFamily: BOARD_TITLE_FONT_FAMILY,
          letterSpacing: line.letterSpacing,
          ...(line.textLength && { textLength: line.textLength, lengthAdjust: 'spacingAndGlyphs' }),
        }, line.text),
      )}
      {haloedText(palette, { x: 120, y: 55, fontSize: 16, fill: palette.sub, fontWeight: 'bold' }, 'FEET / IN')}
      {haloedText(palette, { x: canvasW - 120, y: 55, fontSize: 16, fill: palette.sub, fontWeight: 'bold', textAnchor: 'end' }, 'FEET / IN')}
      {haloedText(palette, { x: 120, y: 76, fontSize: 16, fill: palette.sub }, 'CM')}
      {haloedText(palette, { x: canvasW - 120, y: 76, fontSize: 16, fill: palette.sub, textAnchor: 'end' }, 'CM')}
      <defs>
        <linearGradient id={FLOOR_SHADOW_ID} x1="0" y1="0" x2="0" y2="1">
          {FLOOR_SHADOW_FALLOFF.map(([offset, weight]) => (
            <stop key={offset} offset={offset} stopColor={palette.floorShadow} stopOpacity={palette.floorShadowStrength * weight} />
          ))}
        </linearGradient>
      </defs>
      {buildGridElements(canvasW, canvasH, showGrid, palette)}
      <rect x="0" y={floorY} width={canvasW} height={canvasH - floorY} fill={`url(#${FLOOR_SHADOW_ID})`} data-floor-shadow="true" />
      {haloedText(palette, { x: canvasW / 2, y: canvasH - 10, fontSize: 14, fill: palette.caption, textAnchor: 'middle' }, `${canvasW} × ${canvasH} px`)}
      {casedLine(palette, 'floor', 0, canvasW, floorY, palette.ink, 6)}
      {haloedText(palette, { x: canvasW / 2, y: floorY + 34, fontSize: 24, fill: palette.ink, fontWeight: 'bold', textAnchor: 'middle' }, '▲ SOL — 0 cm ▲')}
    </svg>
  );
});

export default Grid;