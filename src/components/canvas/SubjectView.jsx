import { getBaseDimensions } from '../../domain/geometry.js';
import SelectionOverlay from './SelectionOverlay.jsx';

const SubjectView = ({
  subject,
  floorY,
  canvasH,
  selected,
  showSnapBadge,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onImageLoad,
}) => {
  const { w, h } = getBaseDimensions(subject, floorY);

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="absolute will-change-transform"
      style={{
        left: subject.x,
        bottom: (canvasH - floorY) + subject.y,
        width: w,
        height: h,
        transformOrigin: 'bottom center',
        transform: `scale(${subject.scale}) scaleX(${subject.flipX ? -1 : 1})`,
        zIndex: subject.zIndex,
      }}
    >
      <img
        src={subject.url}
        alt={subject.name}
        draggable="false"
        className="block pointer-events-none drop-shadow-2xl w-full h-full"
        onLoad={e => onImageLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
      />

      {selected && <SelectionOverlay onResizeStart={onResizeStart} />}

      {showSnapBadge && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-50 shadow-md">
          📌 AIMANTÉ AU SOL
        </div>
      )}
    </div>
  );
};

export default SubjectView;