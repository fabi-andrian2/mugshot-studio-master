const HANDLES = [
  { type: 'top-center', position: '-top-2 left-1/2 -translate-x-1/2 cursor-ns-resize', title: 'Faire glisser pour redimensionner' },
  { type: 'top-left', position: '-top-2 -left-2 cursor-nwse-resize' },
  { type: 'top-right', position: '-top-2 -right-2 cursor-nesw-resize' },
];

const SelectionOverlay = ({ onResizeStart }) => (
  <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 99999 }}>
    <div className="absolute inset-0 border-[3px] border-emerald-400 pointer-events-none" />
    {HANDLES.map(handle => (
      <div
        key={handle.type}
        onPointerDown={e => onResizeStart(e, handle.type)}
        title={handle.title}
        className={`absolute w-4 h-4 bg-white border-[3px] border-emerald-400 rounded-full pointer-events-auto ${handle.position}`}
      />
    ))}
  </div>
);

export default SelectionOverlay;