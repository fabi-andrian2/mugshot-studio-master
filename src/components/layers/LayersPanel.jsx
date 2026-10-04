import { Layers, Trash2 } from 'lucide-react';

const LayersPanel = ({ subjects, selectedId, onSelect, onRemove }) => (
  <div className="h-44 border-t border-gray-800 flex flex-col bg-[#0f0f0f]">
    <div className="px-4 py-2 border-b border-gray-800 bg-[#151515] shrink-0">
      <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Layers size={11} /> Sujets ({subjects.length})
      </h2>
    </div>
    <div className="flex-1 overflow-auto p-2 space-y-1">
      {!subjects.length && <p className="text-[11px] text-gray-700 text-center p-4">Aucun sujet importé</p>}
      {[...subjects].sort((a, b) => b.zIndex - a.zIndex).map(s => (
        <div key={s.id} onClick={() => onSelect(s.id)}
          className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs border transition ${
            selectedId === s.id ? 'bg-emerald-900/40 border-emerald-800/50 text-emerald-300' : 'hover:bg-gray-800 text-gray-400 border-transparent'
          }`}>
          <span className="truncate flex-1 mr-2">{s.name}</span>
          <button className="hover:text-red-400 transition shrink-0" onClick={e => {
            e.stopPropagation();
            onRemove(s.id);
          }}><Trash2 size={11} /></button>
        </div>
      ))}
    </div>
  </div>
);

export default LayersPanel;