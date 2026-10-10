const COLOR = '#f59e0b';
const OUTLINE = '#0d0d0d';
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

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
        stroke={COLOR}
        strokeWidth={2 / zoom}
        strokeLinecap="round"
      />
      <circle cx={start.x} cy={start.y} r={4 / zoom} fill={COLOR} />
      <circle cx={end.x} cy={end.y} r={4 / zoom} fill={COLOR} />
      <text
        x={midX}
        y={midY - 10 / zoom}
        fontSize={13 / zoom}
        fontFamily={FONT_FAMILY}
        fontWeight="bold"
        textAnchor="middle"
        fill={COLOR}
        stroke={OUTLINE}
        strokeWidth={4 / zoom}
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