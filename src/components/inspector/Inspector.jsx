import { Settings2, FlipHorizontal, ArrowUp, ArrowDown, Trash2, Info, Image as ImageIcon } from 'lucide-react';
import NumField from './NumField.jsx';

const Inspector = ({
  subject,
  canvasW,
  onPreview,
  onApply,
  onCancelEdit,
  onEndGesture,
  onBringToFront,
  onSendToBack,
  onRemove,
}) => (
  <>
    <div className="px-4 py-3 border-b border-gray-800 bg-[#151515]">
      <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Settings2 size={11} /> Inspecteur
      </h2>
    </div>

    <div className="flex-1 overflow-auto p-4">
      {subject ? (
        <div className="space-y-5">
          <p className="text-[11px] text-gray-500 truncate border-b border-gray-800 pb-3" title={subject.name}>📁 {subject.name}</p>

          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Transformation</h3>

            <div className="space-y-1.5">
              <NumField
                label="Échelle %"
                value={parseFloat((subject.scale * 100).toFixed(1))}
                step={1}
                min={5}
                max={400}
                decimals={1}
                unit="%"
                onChange={v => onPreview({ scale: v / 100 })}
                onCommit={v => onApply({ scale: v / 100 })}
                onCancel={onCancelEdit}
              />

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.01"
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  value={subject.scale}
                  onChange={e => onPreview({ scale: parseFloat(e.target.value) })}
                  onPointerUp={onEndGesture}
                  onKeyUp={onEndGesture}
                  onBlur={onEndGesture}
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-700">Molette / [ ] pour ±1%</span>
                <button onClick={() => onApply({ scale: 1 })}
                  className="text-[10px] text-gray-600 hover:text-emerald-400 transition">
                  Reset 100%
                </button>
              </div>
            </div>

            <hr className="border-gray-800/60" />

            <NumField
              label="Position X (px)"
              value={Math.round(subject.x)}
              step={1} min={-canvasW} max={canvasW * 2}
              onChange={v => onPreview({ x: v })}
              onCommit={v => onApply({ x: v })}
              onCancel={onCancelEdit}
            />

            <NumField
              label="Position Y (0 = Sol)"
              value={Math.round(subject.y)}
              step={1}
              onChange={v => onPreview({ y: v })}
              onCommit={v => onApply({ y: v })}
              onCancel={onCancelEdit}
            />

            <button
              onClick={() => onApply({ y: 0 })}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs py-1.5 rounded text-gray-300 transition"
            >
              Recaler au sol (0cm)
            </button>

            <hr className="border-gray-800/60" />

            <button onClick={() => onApply({ flipX: !subject.flipX })}
              className={`w-full text-xs py-2 rounded border flex items-center justify-center gap-2 transition ${
                subject.flipX ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
              }`}>
              <FlipHorizontal size={12} /> Miroir horizontal <span className="text-gray-600 text-[10px]">F</span>
            </button>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Calques</h3>
            <div className="flex gap-2">
              <button onClick={onBringToFront}
                className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 py-1.5 rounded text-xs flex justify-center items-center gap-1 transition">
                <ArrowUp size={11} /> Avancer
              </button>
              <button onClick={onSendToBack}
                className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 py-1.5 rounded text-xs flex justify-center items-center gap-1 transition">
                <ArrowDown size={11} /> Reculer
              </button>
            </div>
          </section>

          <hr className="border-gray-800" />

          <button
            onClick={onRemove}
            className="w-full bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/30 py-2 rounded text-xs flex items-center justify-center gap-2 transition">
            <Trash2 size={12} /> Supprimer <span className="text-gray-600 text-[10px]">Suppr</span>
          </button>

          <div className="bg-[#161616] border border-gray-800 rounded p-3 space-y-1.5 text-[11px]">
            <p className="text-gray-300 font-semibold flex items-center gap-1 mb-2"><Info size={10} /> Raccourcis Clavier</p>
            <p className="text-gray-600">↑↓←→ <span className="text-gray-500">déplacer ±2px</span></p>
            <p className="text-gray-600">Shift+↑↓ <span className="text-gray-500">déplacer ±20px</span></p>
            <p className="text-gray-600">[ ] <span className="text-gray-500">échelle ±1%</span></p>
            <p className="text-gray-600">Shift+[ ] <span className="text-gray-500">échelle ±10%</span></p>
            <p className="text-gray-600">F <span className="text-gray-500">miroir horizontal</span></p>
            <p className="text-gray-600">Ctrl+Z/Y <span className="text-gray-500">annuler/rétablir</span></p>
            <p className="text-gray-600">Espace + Glisser <span className="text-gray-500">naviguer</span></p>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3 pt-16 text-gray-700">
          <ImageIcon size={36} className="opacity-15" />
          <p className="text-xs">Sélectionnez une image pour voir ses propriétés.</p>
          <p className="text-[11px] text-gray-800">Double-cliquez sur une image pour la sélectionner.</p>
        </div>
      )}
    </div>
  </>
);

export default Inspector;