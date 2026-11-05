import { getSubjectGeometry } from '../../domain/geometry.js';
import { getSilhouetteStyle, isSubjectVisible } from '../../domain/appearance.js';
import { stepsToCssTransform } from '../../domain/rotation.js';
import { ROTATE_HANDLE_OFFSET_SCREEN_PX, getRotationHandle } from '../../domain/transformGesture.js';
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

const RotationHandle = ({ geometry, subjectX, zoom, onPointerDown }) => {
  const { base, tip } = getRotationHandle(
    { subjectX, visible: geometry.visible, anchor: geometry.anchor, rotation: geometry.rotation },
    ROTATE_HANDLE_OFFSET_SCREEN_PX / zoom,
  );
  const hit = 36 / zoom;
  const dot = 16 / zoom;
  const stroke = 2 / zoom;

  return (
    <>
      <svg
        width="1"
        height="1"
        className="absolute pointer-events-none"
        style={{ left: 0, top: 0, overflow: 'visible', zIndex: 99999 }}
      >
        <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="#34d399" strokeWidth={stroke} />
      </svg>
      <div
        onPointerDown={onPointerDown}
        title="Faire glisser pour pivoter autour de l'appui (Maj : pas de 15°)"
        className="absolute flex items-center justify-center"
        style={{
          left: tip.x - hit / 2,
          top: tip.y - hit / 2,
          width: hit,
          height: hit,
          cursor: 'grab',
          zIndex: 99999,
        }}
      >
        <div
          className="bg-white rounded-full pointer-events-none"
          style={{ width: dot, height: dot, border: `${stroke * 1.5}px solid #10b981`, boxSizing: 'border-box' }}
        />
      </div>
    </>
  );
};

const SubjectView = ({
  subject,
  floorY,
  zoom,
  selected,
  grouped,
  showSnap,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onAnchorStart,
  onRotateStart,
}) => {
  if (!isSubjectVisible(subject)) return null;

  const geometry = getSubjectGeometry(subject, floorY);
  const { box, visible, originX, anchor, head, rotation, transformSteps, projectedBounds } = geometry;
  const rotated = rotation !== 0;
  const silhouette = getSilhouetteStyle(subject);

  return (
    <>
      <div
        className="absolute pointer-events-none"
        style={{
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          transform: rotated ? stepsToCssTransform(transformSteps, box) : subject.flipX ? 'scaleX(-1)' : undefined,
          transformOrigin: rotated ? '0 0' : `${originX}px 0px`,
          zIndex: subject.zIndex,
        }}
      >
        {subject.silhouette ? (
          <div
            role="img"
            aria-label={subject.name}
            className="block w-full h-full"
            style={{
              backgroundColor: silhouette.color,
              opacity: silhouette.opacity,
              WebkitMaskImage: `url("${subject.url}")`,
              maskImage: `url("${subject.url}")`,
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
            }}
          />
        ) : (
          <img
            src={subject.url}
            alt={subject.name}
            draggable="false"
            className="block w-full h-full"
          />
        )}
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
          transform: rotated ? stepsToCssTransform(transformSteps, visible) : undefined,
          transformOrigin: rotated ? '0 0' : undefined,
          zIndex: subject.zIndex,
        }}
      >
        {selected && <SelectionOverlay
            zoom={zoom}
            onResizeStart={onResizeStart}
            rotation={rotation}
            mirrored={rotated && Boolean(subject.flipX)}
          />}
        {grouped && <SelectionOverlay zoom={zoom} showHandles={false} />}
      </div>

      {selected && (
        <>
          <AnchorMarker kind="head" point={head} zoom={zoom} onPointerDown={e => onAnchorStart(e, 'head')} />
          <RotationHandle geometry={geometry} subjectX={subject.x} zoom={zoom} onPointerDown={onRotateStart} />
          <AnchorMarker kind="ground" point={anchor} zoom={zoom} onPointerDown={e => onAnchorStart(e, 'ground')} />
        </>
      )}

      {showSnap && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: (rotated ? projectedBounds : visible).left - 40 / zoom,
              top: anchor.y - 1 / zoom,
              width: (rotated ? projectedBounds : visible).width + 80 / zoom,
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