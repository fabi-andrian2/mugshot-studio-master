import { useState } from 'react';
import { Palette, ChevronDown, Image as ImageIcon, X } from 'lucide-react';
import { ToolButton } from './controls.jsx';
import NumField from '../inspector/NumField.jsx';
import { BACKGROUND_PRESETS } from '../../domain/board.js';
import { MIN_HEIGHT_CM, MAX_HEIGHT_CM } from '../../domain/constants.js';
import { splitFeetInches, feetInchesToCm } from '../../domain/measurement.js';

const SectionTitle = ({ children }) => (
  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{children}</p>
);

const ToggleRow = ({ label, active, title, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    title={title}
    className={`w-full flex items-center justify-between rounded-md px-3 py-1.5 text-xs border transition ${
      active
        ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
        : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
    }`}
  >
    <span>{label}</span>
    <span className="font-mono text-[10px]">{active ? 'ON' : 'OFF'}</span>
  </button>
);

const BoardMenu = ({
  board,
  onColor,
  onImage,
  onRemoveImage,
  onToggleGrid,
  unit,
  mannequin,
  mannequinX,
  onToggleMannequin,
  onMannequinHeight,
  onMannequinX,
  onMannequinAutoX,
}) => {
  const [open, setOpen] = useState(false);
  const { color, image } = board.background;
  const { feet, inches } = splitFeetInches(mannequin.heightCm);

  return (
    <div className="relative">
      <ToolButton icon={Palette} label="Planche" title="Fond, grille et étalon" onClick={() => setOpen(o => !o)}>
        <ChevronDown size={11} />
      </ToolButton>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-[80vh] overflow-auto bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl p-3 space-y-4">
            <div className="space-y-2">
              <SectionTitle>Fond uni</SectionTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                {BACKGROUND_PRESETS.map(preset => {
                  const selected = !image && preset.value === color;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.label}
                      aria-label={preset.label}
                      aria-pressed={selected}
                      onClick={() => onColor(preset.value)}
                      className={`w-6 h-6 rounded border transition ${
                        selected ? 'ring-2 ring-emerald-400 border-transparent' : 'border-gray-600 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: preset.value }}
                    />
                  );
                })}
                <input
                  type="color"
                  value={color}
                  title="Couleur personnalisée"
                  aria-label="Couleur personnalisée"
                  onChange={(e) => onColor(e.target.value)}
                  className="w-6 h-6 p-0 bg-transparent border border-gray-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>Image de fond</SectionTitle>
              <p className="text-[11px] text-gray-500 truncate" title={image ? image.fileName : ''}>
                {image ? image.fileName : 'Aucune image'}
              </p>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-2.5 py-1.5 text-xs text-gray-300 cursor-pointer transition">
                  <ImageIcon size={12} /> {image ? 'Remplacer' : 'Choisir une image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      e.target.value = '';
                      setOpen(false);
                      if (file) onImage(file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={!image}
                  onClick={onRemoveImage}
                  title="Retirer l'image et revenir au fond uni"
                  className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-2.5 py-1.5 text-xs text-gray-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <X size={12} /> Retirer
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>Grille</SectionTitle>
              <ToggleRow
                label="Quadrillage"
                active={board.showGrid}
                title="Afficher / masquer le quadrillage (les règles et le sol restent visibles)"
                onClick={onToggleGrid}
              />
            </div>

            <div className="space-y-2">
              <SectionTitle>Étalon (mannequin 2D)</SectionTitle>
              <ToggleRow
                label="Afficher l'étalon"
                active={mannequin.visible}
                title="Afficher / masquer le mannequin de référence"
                onClick={onToggleMannequin}
              />

              {mannequin.visible && (
                <div className="space-y-2">
                  {unit === 'cm' ? (
                    <NumField
                      label="Hauteur de référence"
                      value={parseFloat(mannequin.heightCm.toFixed(1))}
                      step={1}
                      min={MIN_HEIGHT_CM}
                      max={MAX_HEIGHT_CM}
                      decimals={1}
                      unit="cm"
                      onChange={onMannequinHeight}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <NumField
                        label="Pieds"
                        value={feet}
                        step={1}
                        min={0}
                        max={9}
                        unit="ft"
                        onChange={(v) => onMannequinHeight(feetInchesToCm(v, inches))}
                      />
                      <NumField
                        label="Pouces"
                        value={inches}
                        step={1}
                        min={0}
                        max={11.9}
                        decimals={1}
                        unit="in"
                        onChange={(v) => onMannequinHeight(feetInchesToCm(feet, v))}
                      />
                    </div>
                  )}

                  <NumField
                    label="Position X (centre)"
                    value={Math.round(mannequinX)}
                    step={1}
                    unit="px"
                    onChange={onMannequinX}
                  />

                  <button
                    type="button"
                    disabled={mannequin.x === null}
                    onClick={onMannequinAutoX}
                    className="text-[10px] text-gray-500 hover:text-emerald-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Position automatique (à gauche)
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BoardMenu;