const HANDLE_SCREEN_PX = 14;
const FRAME_SCREEN_PX = 2;

const HANDLES = [
  { type: 'top-left', left: '0%', cursor: 'nwse-resize' },
  { type: 'top-center', left: '50%', cursor: 'ns-resize', title: 'Faire glisser pour redimensionner' },
  { type: 'top-right', left: '100%', cursor: 'nesw-resize' },
];

const SelectionOverlay = ({ zoom, onResizeStart }) => {
  const handleSize = HANDLE_SCREEN_PX / zoom;
  const frame = FRAME_SCREEN_PX / zoom;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 99999 }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ border: `${frame}px solid #34d399` }}
      />
      {HANDLES.map(handle => (
        <div
          key={handle.type}
          onPointerDown={e => onResizeStart(e, handle.type)}
          title={handle.title}
          className="absolute pointer-events-auto bg-white rounded-full"
          style={{
            left: handle.left,
            top: 0,
            width: handleSize,
            height: handleSize,
            marginLeft: -handleSize / 2,
            marginTop: -handleSize / 2,
            border: `${frame * 1.5}px solid #10b981`,
            boxSizing: 'border-box',
            cursor: handle.cursor,
          }}
        />
      ))}
    </div>
  );
};

export default SelectionOverlay;