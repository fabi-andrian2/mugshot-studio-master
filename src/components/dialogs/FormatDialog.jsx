import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { FORMAT_PRESETS, CANVAS_LIMITS } from '../../domain/constants.js';

const isValidSize = (w, h) =>
  Number.isInteger(w) && Number.isInteger(h) &&
  w >= CANVAS_LIMITS.minW && w <= CANVAS_LIMITS.maxW &&
  h >= CANVAS_LIMITS.minH && h <= CANVAS_LIMITS.maxH;

const FormatDialog = ({ canvasW, canvasH, onApply, onCancel }) => {
  const [draftW, setDraftW] = useState(String(canvasW));
  const [draftH, setDraftH] = useState(String(canvasH));

  const w = Number(draftW);
  const h = Number(draftH);
  const valid = isValidSize(w, h);

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#1c1c1c] border border-gray-700 rounded-xl p-6 w-[26rem] shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
          <Maximize2 size={14} className="text-emerald-400" /> Format de la planche
        </h2>
        <div className="grid grid-cols-1 gap-1.5 mb-5">
          {FORMAT_PRESETS.map(p => (
            <button key={p.label} onClick={() => { setDraftW(String(p.w)); setDraftH(String(p.h)); }}
              className={`text-xs px-3 py-2.5 rounded border text-left transition flex justify-between items-center ${
                w === p.w && h === p.h ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-gray-800/60 border-gray-700 hover:bg-gray-700 text-gray-300'
              }`}>
              <span className="font-semibold">{p.label}</span>
              <span className="text-gray-500 font-mono text-[10px]">{p.w} × {p.h}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Largeur px</label>
            <input type="number" value={draftW} min={CANVAS_LIMITS.minW} max={CANVAS_LIMITS.maxW}
              onChange={e => setDraftW(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-emerald-500 text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Hauteur px</label>
            <input type="number" value={draftH} min={CANVAS_LIMITS.minH} max={CANVAS_LIMITS.maxH}
              onChange={e => setDraftH(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-emerald-500 text-white" />
          </div>
        </div>
        {!valid && (
          <p className="text-[10px] text-red-400 mb-1">
            Largeur {CANVAS_LIMITS.minW}–{CANVAS_LIMITS.maxW} px, hauteur {CANVAS_LIMITS.minH}–{CANVAS_LIMITS.maxH} px.
          </p>
        )}
        <p className="text-[10px] text-gray-600 mb-5">Les sujets existants ne sont pas déplacés.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs py-2 rounded transition text-gray-300">Annuler</button>
          <button onClick={() => onApply(w, h)} disabled={!valid}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-xs py-2 rounded font-semibold transition text-white disabled:opacity-40 disabled:cursor-not-allowed">
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatDialog;