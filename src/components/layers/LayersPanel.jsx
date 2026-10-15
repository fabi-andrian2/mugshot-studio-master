import { useRef, useState } from 'react';
import { Layers, Eye, EyeOff, MoreVertical, X, PanelLeftClose, PanelLeftOpen, GripVertical } from 'lucide-react';
import { getLayerEntries, getLayerDropSlot, getLayerIndexForDrop } from '../../domain/subjects.js';

const LAYER_DRAG_TYPE = 'application/x-mugshot-layer';
const isLayerDrag = (e) => Array.from(e.dataTransfer?.types ?? []).includes(LAYER_DRAG_TYPE);

const MENU_ITEMS = [
  { id: 'rename', label: 'Renommer' },
  { id: 'forward', label: 'Avancer' },
  { id: 'backward', label: 'Reculer' },
  { id: 'front', label: 'Premier plan' },
  { id: 'back', label: 'Arrière-plan' },
  { id: 'remove', label: 'Supprimer', danger: true },
];

const LayerRow = ({
  entry,
  tag,
  selected,
  editing,
  reorderable,
  dragging,
  dropBefore,
  dropAfter,
  onSelect,
  onToggleVisible,
  onOpenMenu,
  onStartEdit,
  onRename,
  onStopEdit,
  onDragStart,
  onDragEnd,
}) => {
  const [draft, setDraft] = useState(entry.label);
  const skipCommit = useRef(false);

  const commit = () => {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    onStopEdit();
    const next = draft.trim();
    if (next && next !== entry.label) onRename(entry.id, next);
  };

  return (
    <div
      onClick={() => onSelect(entry.id)}
      onDoubleClick={onStartEdit}
      data-layer-row
      className={`relative flex items-center gap-1.5 px-1.5 py-1.5 rounded-md cursor-pointer text-xs border transition ${
        selected ? 'bg-emerald-900/40 border-emerald-800/50 text-emerald-300' : 'hover:bg-gray-800 text-gray-400 border-transparent'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      {dropBefore && <div className="pointer-events-none absolute inset-x-0 -top-[3px] h-0.5 rounded bg-emerald-400" />}
      {dropAfter && <div className="pointer-events-none absolute inset-x-0 -bottom-[3px] h-0.5 rounded bg-emerald-400" />}
      {reorderable && (
        <span
          draggable
          title="Glisser pour réorganiser"
          aria-label="Glisser pour réorganiser"
          onDragStart={(e) => onDragStart(e, entry.id)}
          onDragEnd={onDragEnd}
          className="shrink-0 -ml-0.5 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-300 transition"
        >
          <GripVertical size={12} />
        </span>
      )}
      <button
        type="button"
        title={entry.visible ? 'Masquer' : 'Afficher'}
        onClick={(e) => { e.stopPropagation(); onToggleVisible(entry.id); }}
        className="shrink-0 p-0.5 hover:text-white transition"
      >
        {entry.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-gray-600" />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              skipCommit.current = true;
              onStopEdit();
            }
          }}
          className="flex-1 min-w-0 bg-[#1a1a1a] border border-emerald-600 rounded px-1 py-0.5 text-xs text-white outline-none"
        />
      ) : (
        <span
          className={`truncate flex-1 ${entry.visible ? '' : 'line-through text-gray-600'}`}
          title="Double-clic pour renommer"
        >
          {entry.label}
        </span>
      )}

      {tag && !editing && <span className="text-[10px] text-gray-500 shrink-0">{tag}</span>}

      <button
        type="button"
        title="Actions"
        onClick={(e) => { e.stopPropagation(); onOpenMenu(e, entry.id); }}
        className="shrink-0 p-0.5 hover:text-white transition"
      >
        <MoreVertical size={13} />
      </button>
    </div>
  );
};

export const LayersRail = ({ count, onExpand, hidden = false }) => (
  <button
    type="button"
    onClick={onExpand}
    title="Afficher la liste des sujets"
    aria-label="Afficher la liste des sujets"
    className={`${hidden ? 'hidden' : 'flex'} w-10 shrink-0 border-r border-gray-800 bg-[#111] flex-col items-center gap-2 pt-3 text-gray-500 hover:text-white hover:bg-[#161616] transition`}
  >
    <PanelLeftOpen size={15} />
    <Layers size={14} />
    <span className="text-[10px] font-mono">{count}</span>
  </button>
);

const LayersPanel = ({ subjects, selectedId, onSelect, onToggleVisible, onMove, onReorder, onRename, onRemove, onCollapse }) => {
  const [menu, setMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropSlot, setDropSlot] = useState(null);
  const listRef = useRef(null);
  const entries = getLayerEntries(subjects);
  const dragIndex = entries.findIndex((entry) => entry.id === dragId);
  const reorderable = entries.length > 1;

  const resetDrag = () => {
    setDragId(null);
    setDropSlot(null);
  };

  const slotFromPointer = (clientY) => {
    const rows = listRef.current ? Array.from(listRef.current.querySelectorAll('[data-layer-row]')) : [];
    const middles = rows.map((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    return getLayerDropSlot(middles, clientY);
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(LAYER_DRAG_TYPE, id);
    const row = e.currentTarget.closest('[data-layer-row]');
    if (row) e.dataTransfer.setDragImage(row, 16, 14);
    setDragId(id);
  };

  const handleListDragOver = (e) => {
    if (!isLayerDrag(e) || dragId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const slot = slotFromPointer(e.clientY);
    setDropSlot(getLayerIndexForDrop(dragIndex, slot) === dragIndex ? null : slot);
  };

  const handleListDragLeave = (e) => {
    if (!listRef.current?.contains(e.relatedTarget)) setDropSlot(null);
  };

  const handleListDrop = (e) => {
    if (!isLayerDrag(e) || dragId === null) return;
    e.preventDefault();
    e.stopPropagation();
    const target = getLayerIndexForDrop(dragIndex, slotFromPointer(e.clientY));
    const id = dragId;
    resetDrag();
    if (target !== dragIndex) onReorder(id, target);
  };

  const openMenu = (e, id) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ id, x: Math.max(8, rect.right - 160), y: rect.bottom + 4 });
  };

  const runMenuItem = (item) => {
    const { id } = menu;
    setMenu(null);
    if (item.id === 'rename') setEditingId(id);
    else if (item.id === 'remove') onRemove(id);
    else onMove(id, item.id);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#0f0f0f]">
      <div className="px-4 py-2 border-b border-gray-800 bg-[#151515] shrink-0 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onCollapse}
            title="Replier la liste des sujets"
            aria-label="Replier la liste des sujets"
            className="shrink-0 text-gray-500 hover:text-white transition"
          >
            <PanelLeftClose size={14} />
          </button>
          <span className="flex items-center gap-1.5 truncate">
            <Layers size={11} /> Sujets ({subjects.length})
          </span>
        </h2>
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            title="Désélectionner"
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition"
          >
            <X size={10} /> Désélect.
          </button>
        )}
      </div>

      <div
        ref={listRef}
        onDragOver={handleListDragOver}
        onDragLeave={handleListDragLeave}
        onDrop={handleListDrop}
        className="flex-1 min-h-0 overflow-auto p-2 space-y-1"
      >
        {!subjects.length && <p className="text-[11px] text-gray-500 text-center p-4">Aucun sujet importé</p>}
        {entries.map((entry, index) => (
          <LayerRow
            key={`${entry.id}:${entry.label}`}
            entry={entry}
            tag={entries.length > 1 ? (index === 0 ? 'Premier plan' : index === entries.length - 1 ? 'Arrière-plan' : '') : ''}
            selected={selectedId === entry.id}
            editing={editingId === entry.id}
            reorderable={reorderable}
            dragging={dragId === entry.id}
            dropBefore={dropSlot === index}
            dropAfter={dropSlot === entries.length && index === entries.length - 1}
            onSelect={onSelect}
            onToggleVisible={onToggleVisible}
            onOpenMenu={openMenu}
            onStartEdit={() => setEditingId(entry.id)}
            onRename={onRename}
            onStopEdit={() => setEditingId(null)}
            onDragStart={handleDragStart}
            onDragEnd={resetDrag}
          />
        ))}
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-40 origin-top-left animate-pop-in bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl py-1"
            style={{ left: menu.x, top: menu.y }}
          >
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => runMenuItem(item)}
                className={`w-full text-left text-xs px-3 py-1.5 hover:bg-gray-700 transition ${
                  item.danger ? 'text-red-400' : 'text-gray-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LayersPanel;