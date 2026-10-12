import { MEASURE_STYLE } from '../../domain/measure.js';

const MeasureLine = ({ start, end, label, zoom }) => {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <g>
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
    </g>
  );
};

const MeasureLayer = ({ entries, draft, unit, zoom, canvasW, canvasH, formatDraft }) => {
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
            start={entry.start}
            end={entry.end}
            label={entry.label}
            zoom={zoom}
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