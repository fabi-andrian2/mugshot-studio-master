const MannequinLayer = ({ geometry, canvasW, canvasH }) => {
  if (!geometry) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="absolute inset-0"
        width={canvasW}
        height={canvasH}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        <g transform={`translate(${geometry.left} ${geometry.top}) scale(${geometry.scale})`}>
          <path d={geometry.path} fill={geometry.color} fillOpacity={geometry.opacity} />
        </g>
        <text
          x={geometry.labelX}
          y={geometry.labelY}
          fontSize={geometry.labelFontSize}
          fontFamily={geometry.labelFontFamily}
          fontWeight="bold"
          textAnchor="middle"
          fill={geometry.color}
        >
          {geometry.label}
        </text>
      </svg>
    </div>
  );
};

export default MannequinLayer;