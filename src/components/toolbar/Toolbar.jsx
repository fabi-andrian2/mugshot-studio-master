import { Upload, Download, Ruler, ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2 } from 'lucide-react';

const Toolbar = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onOpenFormat,
  onImport,
  onExport,
}) => (
  <header className="h-14 border-b border-gray-800 bg-[#111] flex items-center justify-between px-5 shrink-0 z-20">
    <div className="flex items-center gap-3">
      <Ruler size={17} className="text-emerald-400" />
      <span className="font-black tracking-[0.2em] text-sm">MUGSHOT <span className="text-emerald-400">STUDIO</span></span>
    </div>

    <div className="flex items-center gap-2">
      <div className="flex items-center bg-gray-800/60 border border-gray-700 rounded-md overflow-hidden">
        <button onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)"
          className="px-2.5 py-2 hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition"><RotateCcw size={13} /></button>
        <button onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)"
          className="px-2.5 py-2 hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed border-l border-gray-700 transition"><RotateCw size={13} /></button>
      </div>

      <div className="flex items-center gap-0.5 bg-gray-800/60 border border-gray-700 rounded-md px-1">
        <button onClick={onZoomOut} className="p-1.5 hover:text-white transition"><ZoomOut size={13} /></button>
        <button onClick={onResetView} title="Double-cliquer sur le fond pour réinitialiser"
          className="w-12 text-center text-xs font-mono hover:text-emerald-400 transition py-1">{Math.round(zoom * 100)}%</button>
        <button onClick={onZoomIn} className="p-1.5 hover:text-white transition"><ZoomIn size={13} /></button>
      </div>

      <button onClick={onOpenFormat}
        className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-md text-xs transition">
        <Maximize2 size={12} /> Format
      </button>

      <label className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-md cursor-pointer text-xs font-semibold border border-gray-600 transition">
        <Upload size={12} /> Importer
        <input type="file" multiple accept="image/*" className="hidden" onChange={e => onImport(e.target.files)} />
      </label>

      <button onClick={onExport}
        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-md text-xs font-semibold transition">
        <Download size={12} /> Exporter HD
      </button>
    </div>
  </header>
);

export default Toolbar;