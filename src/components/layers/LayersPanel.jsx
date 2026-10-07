import { useRef, useState } from 'react';
import { Layers, Trash2 } from 'lucide-react';
import { getLayerEntries } from '../../domain/subjects.js';

const LayerRow = ({ entry, selected, onSelect, onRemove, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.label);
  const skipCommit = useRef(false);

  const startEdit = () => {
    skipCommit.current = false;
    setDraft(entry.label);
    setEditing(true);
  };

  const commit = () => {
    if (skipCommit.current) return;
    setEditing(false);
    if (draft.trim() && draft.trim() !== entry.label) onRename(entry.id, draft);
  };

  const cancel = () => {
    skipCommit.current = true;
    setEditing(false);
  };

  return (
    <div
      onClick={() => onSelect(entry.id)}
      onDoubleClick={startEdit}
      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs border transition ${
        selected ? 'bg-emerald-900/40 border-emerald-800/50 text-emerald-300' : 'hover:bg-gray-800 text-gray-400 border-transparent'
      }`}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          maxLength={60}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          className="flex-1 mr-2 min-w-0 bg-[#1e1e1e] border border-emerald-600 rounded px-1 py-0.5 text-xs text-white outline-none"
        />
      ) : (
        <span className="truncate flex-1 mr-2" title="Double-clic pour renommer">{entry.label}</span>
      )}
      <button className="hover:text-red-400 transition shrink-0" onClick={e => {
        e.stopPropagation();
        onRemove(entry.id);
      }}><Trash2 size={11} /></button>
    </div>
  );
};

const LayersPanel = ({ subjects, selectedId, onSelect, onRemove, onRename }) => (
  <div className="h-44 border-t border-gray-800 flex flex-col bg-[#0f0f0f]">
    <div className="px-4 py-2 border-b border-gray-800 bg-[#151515] shrink-0">
      <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Layers size={11} /> Sujets ({subjects.length})
      </h2>
    </div>
    <div className="flex-1 overflow-auto p-2 space-y-1">
      {!subjects.length && <p className="text-[11px] text-gray-700 text-center p-4">Aucun sujet importé</p>}
      {getLayerEntries(subjects).map(entry => (
        <LayerRow
          key={entry.id}
          entry={entry}
          selected={selectedId === entry.id}
          onSelect={onSelect}
          onRemove={onRemove}
          onRename={onRename}
        />
      ))}
    </div>
  </div>
);

export default LayersPanel;