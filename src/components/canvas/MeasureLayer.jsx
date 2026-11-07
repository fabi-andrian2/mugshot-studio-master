import { memo } from 'react';
import { MEASURE_STYLE } from '../../domain/measure.js';
import {
  getMeasureKind,
  getMeasureNodes,
  getMeasurePath,
  getMeasureTicks,
  getLabelAnchor,
  getLabelStride,
  getTickLabelPlacement,
  getHandlePositions,
} from '../../domain/measurePath.js';

const HIT_PROPS = { stroke: 'transparent', pointerEvents: 'stroke', style: { cursor: 'pointer' } };
const NO_TOUCH = { touchAction: 'none' };

const pointsAttr = (points) => points.map((p) => `${p.x},${p.y}`).join(' ');

const Handle = ({ x, y, zoom, kind, selected, onPointerDown }) => {
  const r = MEASURE_STYLE.handleRadius / zoom;
  const hit = MEASURE_STYLE.handleHitRadius / zoom;
  const isControl = kind !== 'anchor';
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: 'move', ...NO_TOUCH }}>
      <circle cx={x} cy={y} r={hit} fill="transparent" pointerEvents="all" style={NO_TOUCH} />
      {isControl ? (
        <rect
          x={x - r * 0.8}
          y={y - r * 0.8}
          width={r * 1.6}
          height={r * 1.6}
          transform={`rotate(45 ${x} ${y})`}
          fill="#0d0d0d"
          stroke={MEASURE_STYLE.selectionColor}
          strokeWidth={1.5 / zoom}
        />
      ) : (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={selected ? MEASURE_STYLE.selectionColor : '#0d0d0d'}
          stroke={MEASURE_STYLE.selectionColor}
          strokeWidth={2 / zoom}
        />
      )}
    </g>
  );
};

const MeasureEntry = memo(function MeasureEntry({
  id,
  item,
  label,
  unit,
  zoom,
  selected,
  selectedNode,
  isSpacePressed,
  onSelect,
  onEditStart,
}) {
  const kind = getMeasureKind(item);
  const nodes = getMeasureNodes(item);
  const path = getMeasurePath(item);
  const poly = pointsAttr(path.points);
  const labelAnchor = getLabelAnchor(item, MEASURE_STYLE.labelOffset / zoom);
  const { ticks, stepPx } = getMeasureTicks(item, unit);
  const stride = getLabelStride(stepPx, zoom);
  const interactive = typeof onSelect === 'function';
  const handles = selected && interactive && typeof onEditStart === 'function';
  const half = MEASURE_STYLE.tickHalfLength / zoom;

  const handlePointerDown = (e) => {
    if (!interactive || e.button !== 0 || isSpacePressed) return;
    e.stopPropagation();
    onSelect(id, e.ctrlKey || e.metaKey, e);
  };

  const textProps = {
    fontFamily: MEASURE_STYLE.fontFamily,
    fontWeight: 'bold',
    strokeLinejoin: 'round',
    paintOrder: 'stroke',
  };

  return (
    <g onPointerDown={interactive ? handlePointerDown : undefined}>
      {selected && (
        <>
          <polyline
            points={poly}
            fill="none"
            stroke={MEASURE_STYLE.selectionColor}
            strokeOpacity={0.6}
            strokeWidth={MEASURE_STYLE.selectionHaloWidth / zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {nodes.map((p, index) => (
            <circle
              key={index}
              cx={p.x}
              cy={p.y}
              r={MEASURE_STYLE.selectionRingRadius / zoom}
              fill="none"
              stroke={MEASURE_STYLE.selectionColor}
              strokeWidth={2 / zoom}
            />
          ))}
        </>
      )}
      <polyline
        points={poly}
        fill="none"
        stroke={MEASURE_STYLE.color}
        strokeWidth={MEASURE_STYLE.lineWidth / zoom}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {ticks.length > 0 && (
        <g>
          {ticks.map((t) => (
            <line
              key={t.index}
              x1={t.x - t.nx * half}
              y1={t.y - t.ny * half}
              x2={t.x + t.nx * half}
              y2={t.y + t.ny * half}
              stroke={MEASURE_STYLE.color}
              strokeWidth={MEASURE_STYLE.tickLineWidth / zoom}
              strokeLinecap="round"
            />
          ))}
          {ticks
            .filter((t) => t.index % stride === 0)
            .map((t) => {
              const place = getTickLabelPlacement(t, MEASURE_STYLE.tickLabelOffset / zoom);
              return (
                <text
                  key={t.index}
                  x={place.x}
                  y={place.y}
                  fontSize={MEASURE_STYLE.tickFontSize / zoom}
                  textAnchor={place.align}
                  dominantBaseline={place.baseline === 'middle' ? 'central' : 'auto'}
                  fill={MEASURE_STYLE.color}
                  stroke={MEASURE_STYLE.outlineColor}
                  strokeWidth={MEASURE_STYLE.haloWidth / zoom}
                  {...textProps}
                >
                  {t.label}
                </text>
              );
            })}
        </g>
      )}
      {nodes.map((p, index) => (
        <circle
          key={index}
          cx={p.x}
          cy={p.y}
          r={MEASURE_STYLE.endpointRadius / zoom}
          fill={MEASURE_STYLE.color}
        />
      ))}
      <text
        x={labelAnchor.x}
        y={labelAnchor.y}
        fontSize={MEASURE_STYLE.fontSize / zoom}
        textAnchor="middle"
        fill={MEASURE_STYLE.color}
        stroke={MEASURE_STYLE.outlineColor}
        strokeWidth={MEASURE_STYLE.haloWidth / zoom}
        {...textProps}
      >
        {label}
      </text>
      {interactive && (
        <>
          <polyline
            points={poly}
            fill="none"
            strokeWidth={MEASURE_STYLE.hitWidth / zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...HIT_PROPS}
          />
          <text
            x={labelAnchor.x}
            y={labelAnchor.y}
            fontSize={MEASURE_STYLE.fontSize / zoom}
            fontFamily={MEASURE_STYLE.fontFamily}
            fontWeight="bold"
            textAnchor="middle"
            fill="transparent"
            pointerEvents="all"
            style={{ cursor: 'pointer' }}
          >
            {label}
          </text>
        </>
      )}
      {handles && kind === 'bezier' &&
        getHandlePositions(item).map((h) => (
          <g key={`h${h.index}`}>
            {[
              ['in', h.hin],
              ['out', h.hout],
            ].map(([which, pos]) =>
              pos ? (
                <g key={which}>
                  <line
                    x1={h.anchor.x}
                    y1={h.anchor.y}
                    x2={pos.x}
                    y2={pos.y}
                    stroke={MEASURE_STYLE.selectionColor}
                    strokeOpacity={0.7}
                    strokeWidth={1 / zoom}
                  />
                  <Handle
                    x={pos.x}
                    y={pos.y}
                    zoom={zoom}
                    kind={which}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || isSpacePressed) return;
                      e.stopPropagation();
                      onEditStart(e, id, { type: which, index: h.index });
                    }}
                  />
                </g>
              ) : null,
            )}
          </g>
        ))}
      {handles &&
        nodes.map((p, index) => (
          <Handle
            key={`a${index}`}
            x={p.x}
            y={p.y}
            zoom={zoom}
            kind="anchor"
            selected={selectedNode?.id === id && selectedNode.index === index}
            onPointerDown={(e) => {
              if (e.button !== 0 || isSpacePressed) return;
              e.stopPropagation();
              onEditStart(e, id, { type: 'point', index });
            }}
          />
        ))}
    </g>
  );
});

const MeasureLayer = ({
  entries,
  draftItem,
  draftLabel,
  unit,
  zoom,
  canvasW,
  canvasH,
  selectedIds = [],
  selectedNode = null,
  onSelect,
  onEditStart,
  isSpacePressed = false,
}) => {
  if (!entries.length && !draftItem) return null;
  const single = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 90000 }}>
      <svg
        className="absolute inset-0"
        width={canvasW}
        height={canvasH}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        {entries.map((entry) => (
          <MeasureEntry
            key={entry.id}
            id={entry.id}
            item={entry.item}
            label={entry.label}
            unit={unit}
            zoom={zoom}
            selected={selectedIds.includes(entry.id)}
            selectedNode={entry.id === single ? selectedNode : null}
            isSpacePressed={isSpacePressed}
            onSelect={onSelect}
            onEditStart={entry.id === single ? onEditStart : undefined}
          />
        ))}
        {draftItem && (
          <MeasureEntry
            id={0}
            item={draftItem}
            label={draftLabel}
            unit={unit}
            zoom={zoom}
            selected={false}
            isSpacePressed={isSpacePressed}
          />
        )}
      </svg>
    </div>
  );
};

export default MeasureLayer;
