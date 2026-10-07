import { ANNOTATION_STYLE } from '../../domain/annotations.js';

const AnnotationsLayer = ({ items, canvasW, canvasH }) => {
  if (items.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasW}
      height={canvasH}
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      style={{ zIndex: 100000 }}
    >
      {items.map(item => (
        <g key={item.id}>
          <line
            x1={item.lineX1}
            y1={item.lineY}
            x2={item.lineX2}
            y2={item.lineY}
            stroke={item.emphasized ? ANNOTATION_STYLE.accentColor : ANNOTATION_STYLE.lineColor}
            strokeWidth={ANNOTATION_STYLE.lineWidth}
          />
          <text
            x={item.labelX}
            y={item.labelY}
            textAnchor="middle"
            fontSize={ANNOTATION_STYLE.fontSize}
            fontWeight="bold"
            fontFamily={ANNOTATION_STYLE.fontFamily}
            fill={item.emphasized ? ANNOTATION_STYLE.accentColor : ANNOTATION_STYLE.textColor}
            stroke={ANNOTATION_STYLE.haloColor}
            strokeWidth={ANNOTATION_STYLE.haloWidth}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {item.text}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default AnnotationsLayer;