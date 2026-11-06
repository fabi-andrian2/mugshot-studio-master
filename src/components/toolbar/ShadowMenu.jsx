import { useState } from 'react';
import { Sun, ChevronDown } from 'lucide-react';
import { ToolButton } from './controls.jsx';
import { SHADOW_PRESETS } from '../../domain/shadows.js';

const SectionTitle = ({ children }) => (
  <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">{children}</p>
);

const Slider = ({ label, value, min, max, step = 1, unit, disabled, onChange }) => (
  <label className="flex flex-col gap-1">
    <span className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider">
      <span>{label}</span>
      <span className="font-mono normal-case">{Math.round(value)}{unit}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-emerald-500 disabled:opacity-40"
    />
  </label>
);

const LightDial = ({ direction, disabled }) => (
  <svg width="28" height="28" viewBox="-14 -14 28 28" aria-hidden="true" className="shrink-0">
    <circle r="12" fill="none" stroke="#4b5563" strokeWidth="1" />
    <g transform={`rotate(${direction})`} opacity={disabled ? 0.4 : 1}>
      <line x1="0" y1="0" x2="0" y2="-9" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <circle cy="-9" r="2.5" fill="#fbbf24" />
    </g>
  </svg>
);

const ShadowMenu = ({ shadows, onToggle, onPreset, onChange }) => {
  const [open, setOpen] = useState(false);
  const off = !shadows.enabled;

  return (
    <div className="relative flex items-center gap-1.5">
      <ToolButton
        icon={Sun}
        label="Ombres"
        title="Afficher / masquer toutes les ombres"
        variant={shadows.enabled ? 'active' : 'ghost'}
        pressed={shadows.enabled}
        onClick={onToggle}
      >
        <span className="font-mono text-[10px]">{shadows.enabled ? 'ON' : 'OFF'}</span>
      </ToolButton>
      <ToolButton title="Réglages des ombres" onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={11} />
      </ToolButton>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 origin-top-right animate-pop-in bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl p-3 space-y-4">
            <div className="space-y-2">
              <SectionTitle>Préréglage</SectionTitle>
              <div className="grid grid-cols-2 gap-1.5">
                {[...SHADOW_PRESETS, { id: 'custom', label: 'Personnalisé' }].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={shadows.preset === preset.id}
                    disabled={preset.id === 'custom'}
                    onClick={() => onPreset(preset.id)}
                    className={`rounded-md px-2 py-1.5 text-xs border transition disabled:cursor-default ${
                      shadows.preset === preset.id
                        ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                        : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 disabled:opacity-40 disabled:hover:bg-gray-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SectionTitle>Lumière</SectionTitle>
              <div className="flex items-center gap-3">
                <LightDial direction={shadows.direction} disabled={off} />
                <div className="flex-1">
                  <Slider
                    label="Direction"
                    value={shadows.direction}
                    min={0}
                    max={359}
                    unit="°"
                    disabled={off}
                    onChange={(direction) => onChange({ direction })}
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 leading-snug">
                0° : lumière du haut, 90° : de la droite, 180° : du bas, 270° : de la gauche.
              </p>
              <Slider label="Intensité" value={shadows.intensity} min={0} max={100} unit="%" disabled={off} onChange={(intensity) => onChange({ intensity })} />
              <Slider label="Longueur" value={shadows.length} min={0} max={100} unit="%" disabled={off} onChange={(length) => onChange({ length })} />
              <Slider label="Diffusion" value={shadows.softness} min={0} max={100} unit="%" disabled={off} onChange={(softness) => onChange({ softness })} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ShadowMenu;
