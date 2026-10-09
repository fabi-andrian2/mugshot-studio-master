import { useRef, useState } from 'react';
import { Layers, Eye, EyeOff, MoreVertical, X } from 'lucide-react';
import { getLayerEntries } from '../../domain/subjects.js';

const MENU_ITEMS = [
  { id: 'rename', label: 'Renommer' },
  { id: 'forward', label: 'Avancer' },
  { id: 'backward', label: 'Reculer' },
  { id: 'front', label: 'Premier plan' },
  { id: 'back', label: 'Arrière-plan' },
  { id: 'remove', label: 'Supprimer', danger: true },
];

const LayerRow = ({ entry, tag, selected, editing, onSelect, onToggleVisible, onOpenMenu, onStartEdit, onRename, onStopEdit }) => {
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
      className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded-md cursor-pointer text-xs border transition ${
        selected ? 'bg-emerald-900/40 border-emerald-800/50 text-emerald-300' : 'hover:bg-gray-800 text-gray-400 border-transparent'
      }`}
    >
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

      {tag && !editing && <span className="text-[9px] text-gray-600 shrink-0">{tag}</span>}

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

const LayersPanel = ({ subjects, selectedId, onSelect, onToggleVisible, onMove, onRename, onRemove }) => {
  const [menu, setMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const entries = getLayerEntries(subjects);

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
    <div className="h-52 border-t border-gray-800 flex flex-col bg-[#0f0f0f]">
      <div className="px-4 py-2 border-b border-gray-800 bg-[#151515] shrink-0 flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Layers size={11} /> Sujets ({subjects.length})
        </h2>
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            title="Désélectionner"
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition"
          >
            <X size={10} /> Désélectionner
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {!subjects.length && <p className="text-[11px] text-gray-700 text-center p-4">Aucun sujet importé</p>}
        {entries.map((entry, index) => (
          <LayerRow
            key={`${entry.id}:${entry.label}`}
            entry={entry}
            tag={entries.length > 1 ? (index === 0 ? 'Premier plan' : index === entries.length - 1 ? 'Arrière-plan' : '') : ''}
            selected={selectedId === entry.id}
            editing={editingId === entry.id}
            onSelect={onSelect}
            onToggleVisible={onToggleVisible}
            onOpenMenu={openMenu}
            onStartEdit={() => setEditingId(entry.id)}
            onRename={onRename}
            onStopEdit={() => setEditingId(null)}
          />
        ))}
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-40 bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl py-1"
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