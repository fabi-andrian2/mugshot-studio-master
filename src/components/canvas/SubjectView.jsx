import { getSubjectGeometry } from '../../domain/geometry.js';
import SelectionOverlay from './SelectionOverlay.jsx';

const MARKER_SCREEN_PX = 30;
const MARKER_COLORS = { ground: '#10b981', head: '#38bdf8' };
const MARKER_TITLES = {
  ground: 'Repère d\'appui (talon) : glisser pour le placer sur le point de contact avec le sol',
  head: 'Repère de tête : glisser pour le placer sur le sommet réel du crâne',
};

const AnchorMarker = ({ kind, point, zoom, onPointerDown }) => {
  const size = MARKER_SCREEN_PX / zoom;
  const color = MARKER_COLORS[kind];

  return (
    <div
      onPointerDown={onPointerDown}
      title={MARKER_TITLES[kind]}
      className="absolute cursor-move"
      style={{
        left: point.x - size / 2,
        top: point.y - size / 2,
        width: size,
        height: size,
        zIndex: 99998,
      }}
    >
      <svg width={size} height={size} viewBox="-22 -22 44 44" className="pointer-events-none">
        <circle r="11" fill={`${color}26`} stroke={color} strokeWidth="3" />
        <line x1="-22" y1="0" x2="22" y2="0" stroke={color} strokeWidth="2.5" />
        <line x1="0" y1="-22" x2="0" y2="22" stroke={color} strokeWidth="2.5" />
      </svg>
    </div>
  );
};

const SubjectView = ({
  subject,
  floorY,
  zoom,
  selected,
  showSnap,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onAnchorStart,
}) => {
  const { box, visible, originX, anchor, head } = getSubjectGeometry(subject, floorY);

  return (
    <>
      <div
        className="absolute pointer-events-none"
        style={{
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          transform: subject.flipX ? 'scaleX(-1)' : undefined,
          transformOrigin: `${originX}px 0px`,
          zIndex: subject.zIndex,
        }}
      >
        <img
          src={subject.url}
          alt={subject.name}
          draggable="false"
          className="block w-full h-full"
        />
      </div>

      <div
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className="absolute"
        style={{
          left: visible.left,
          top: visible.top,
          width: visible.width,
          height: visible.height,
          zIndex: subject.zIndex,
        }}
      >
        {selected && <SelectionOverlay zoom={zoom} onResizeStart={onResizeStart} />}
      </div>

      {selected && (
        <>
          <AnchorMarker kind="head" point={head} zoom={zoom} onPointerDown={e => onAnchorStart(e, 'head')} />
          <AnchorMarker kind="ground" point={anchor} zoom={zoom} onPointerDown={e => onAnchorStart(e, 'ground')} />
        </>
      )}

      {showSnap && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: visible.left - 40 / zoom,
              top: anchor.y - 1 / zoom,
              width: visible.width + 80 / zoom,
              height: 2 / zoom,
              background: '#10b981',
              zIndex: 99997,
            }}
          />
          <div
            className="absolute pointer-events-none font-bold text-black bg-emerald-400 rounded whitespace-nowrap"
            style={{
              left: subject.x,
              top: anchor.y + 8 / zoom,
              transform: 'translateX(-50%)',
              fontSize: 12 / zoom,
              padding: `${2 / zoom}px ${6 / zoom}px`,
              zIndex: 99997,
            }}
          >
            ✓ Sol
          </div>
        </>
      )}
    </>
  );
};

export default SubjectView;