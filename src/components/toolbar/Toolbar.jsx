import {
  Upload, Download, Ruler, ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2, Eye, EyeOff,
} from 'lucide-react';

const UNIT_OPTIONS = [
  { value: 'cm', label: 'CM' },
  { value: 'ft', label: 'FT/IN' },
];

const SCOPE_OPTIONS = [
  { value: 'selected', label: 'Sélection' },
  { value: 'all', label: 'Tous' },
];

const Segmented = ({ options, value, onChange, title }) => (
  <div title={title} className="flex items-center bg-gray-800/60 border border-gray-700 rounded-md overflow-hidden text-[11px]">
    {options.map((option, index) => (
      <button
        key={option.value}
        onClick={() => onChange(option.value)}
        className={`px-2.5 py-2 transition ${index > 0 ? 'border-l border-gray-700' : ''} ${
          value === option.value ? 'bg-emerald-900/50 text-emerald-300' : 'hover:bg-gray-700 text-gray-300'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const Toolbar = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  unit,
  onUnitChange,
  annotations,
  onToggleAnnotations,
  onScopeChange,
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

      <Segmented options={UNIT_OPTIONS} value={unit} onChange={onUnitChange} title="Unité d'affichage des hauteurs" />

      <button
        onClick={onToggleAnnotations}
        aria-pressed={annotations.enabled}
        title="Afficher / Masquer les annotations (nom, hauteur, ligne de sommet)"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition ${
          annotations.enabled
            ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
            : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
        }`}
      >
        {annotations.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
        Annotations
        <span className="font-mono text-[10px]">{annotations.enabled ? 'ON' : 'OFF'}</span>
      </button>

      {annotations.enabled && (
        <Segmented
          options={SCOPE_OPTIONS}
          value={annotations.scope}
          onChange={onScopeChange}
          title="Annotations : sujet sélectionné ou tous les sujets"
        />
      )}

      <button onClick={onOpenFormat}
        className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-md text-xs transition">
        <Maximize2 size={12} /> Format
      </button>

      <label className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-md cursor-pointer text-xs font-semibold border border-gray-600 transition">
        <Upload size={12} /> Importer
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files);
            e.target.value = '';
            onImport(files);
          }}
        />
      </label>

      <button onClick={onExport}
        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-md text-xs font-semibold transition">
        <Download size={12} /> Exporter HD
      </button>
    </div>
  </header>
);

export default Toolbar;