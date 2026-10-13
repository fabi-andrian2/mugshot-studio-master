import { MEASURE_STYLE } from '../../domain/measure.js';

const HIT_PROPS = { stroke: 'transparent', pointerEvents: 'stroke', style: { cursor: 'pointer' } };

const MeasureLine = ({
  id,
  start,
  end,
  label,
  zoom,
  selected,
  onSelect,
  isSpacePressed = false,
}) => {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const interactive = typeof onSelect === 'function';

  const handlePointerDown = (e) => {
  if (!interactive || e.button !== 0 || isSpacePressed) return;

  e.stopPropagation();
  onSelect(id, e.ctrlKey || e.metaKey);
};

  return (
    <g onPointerDown={interactive ? handlePointerDown : undefined}>
      {selected && (
        <>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={MEASURE_STYLE.selectionColor}
            strokeOpacity={0.6}
            strokeWidth={MEASURE_STYLE.selectionHaloWidth / zoom}
            strokeLinecap="round"
          />
          {[start, end].map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={MEASURE_STYLE.selectionRingRadius / zoom}
              fill="none"
              stroke={MEASURE_STYLE.selectionColor}
              strokeWidth={2 / zoom}
            />
          ))}
        </>
      )}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={MEASURE_STYLE.color}
        strokeWidth={MEASURE_STYLE.lineWidth / zoom}
        strokeLinecap="round"
      />
      <circle cx={start.x} cy={start.y} r={MEASURE_STYLE.endpointRadius / zoom} fill={MEASURE_STYLE.color} />
      <circle cx={end.x} cy={end.y} r={MEASURE_STYLE.endpointRadius / zoom} fill={MEASURE_STYLE.color} />
      <text
        x={midX}
        y={midY - MEASURE_STYLE.labelOffset / zoom}
        fontSize={MEASURE_STYLE.fontSize / zoom}
        fontFamily={MEASURE_STYLE.fontFamily}
        fontWeight="bold"
        textAnchor="middle"
        fill={MEASURE_STYLE.color}
        stroke={MEASURE_STYLE.outlineColor}
        strokeWidth={MEASURE_STYLE.haloWidth / zoom}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {label}
      </text>
      {interactive && (
        <>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            strokeWidth={MEASURE_STYLE.hitWidth / zoom}
            strokeLinecap="round"
            {...HIT_PROPS}
          />
          <text
            x={midX}
            y={midY - MEASURE_STYLE.labelOffset / zoom}
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
    </g>
  );
};

const MeasureLayer = ({
  entries,
  draft,
  unit,
  zoom,
  canvasW,
  canvasH,
  formatDraft,
  selectedIds = [],
  onSelect,
  isSpacePressed = false,
}) => {
  if (!entries.length && !draft) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 90000 }}>
      <svg
        className="absolute inset-0"
        width={canvasW}
        height={canvasH}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        {entries.map(entry => (
          <MeasureLine
            key={entry.id}
            id={entry.id}
            start={entry.start}
            end={entry.end}
            label={entry.label}
            zoom={zoom}
            selected={selectedIds.includes(entry.id)}
            onSelect={onSelect}
            isSpacePressed={isSpacePressed}
          />
        ))}
        {draft && (
          <MeasureLine
            start={draft.start}
            end={draft.end}
            label={formatDraft(draft, unit)}
            zoom={zoom}
          />
        )}
      </svg>
    </div>
  );
};

export default MeasureLayer;