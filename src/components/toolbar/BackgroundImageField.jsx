import { Image as ImageIcon, RotateCcw, X } from 'lucide-react';
import useFileDropZone from '../../hooks/useFileDropZone.js';
import { DEFAULT_FRAMING, FRAMING_LIMITS, isDefaultFraming, normalizeFraming } from '../../domain/board.js';

const ZONE_STYLES = {
  idle: 'border-gray-700 text-gray-500',
  accept: 'border-emerald-500/70 bg-emerald-950/40 text-emerald-300',
  reject: 'border-red-500/70 bg-red-950/40 text-red-300',
};

const ZONE_LABELS = {
  idle: 'Glisse une image ici',
  accept: 'Déposer pour définir le fond',
  reject: 'Fichier non pris en charge : image uniquement',
};

const AXIS_LOCKED_HINT = "L'image remplit déjà la planche sur cet axe : augmente le zoom pour la déplacer.";

const FramingSlider = ({ label, value, min, max, step, display, disabled = false, hint, onChange }) => (
  <label className="block space-y-1" title={disabled ? hint : undefined}>
    <span className="flex items-center justify-between text-[11px] text-gray-400">
      <span>{label}</span>
      <span className="font-mono text-[10px] text-gray-500">{disabled ? 'Fixe' : display}</span>
    </span>
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"
    />
  </label>
);

const BackgroundImageField = ({ image, axes, onImage, onImageFiles, onRemove, onFraming, onDone }) => {
  const { dropState, dropProps } = useFileDropZone({
    onFiles: (files) => {
      onDone();
      onImageFiles(files);
    },
  });
  const zone = dropState ?? 'idle';
  const framing = normalizeFraming(image?.framing);

  return (
    <div className="space-y-2" {...dropProps}>
      <p className="text-[11px] text-gray-500 truncate" title={image ? image.fileName : ''}>
        {image ? image.fileName : 'Aucune image'}
      </p>
      <div
        aria-live="polite"
        className={`rounded-md border border-dashed px-2 py-2 text-center text-[11px] transition ${ZONE_STYLES[zone]}`}
      >
        {ZONE_LABELS[zone]}
      </div>
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
              onDone();
              if (file) onImage(file);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!image}
          onClick={onRemove}
          title="Retirer l'image et revenir au fond uni"
          className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-2.5 py-1.5 text-xs text-gray-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <X size={12} /> Retirer
        </button>
      </div>
      {image && (
        <div className="space-y-2 pt-1">
          <FramingSlider
            label="Zoom"
            value={framing.zoom}
            min={FRAMING_LIMITS.minZoom}
            max={FRAMING_LIMITS.maxZoom}
            step="0.05"
            display={`${Math.round(framing.zoom * 100)} %`}
            onChange={(zoom) => onFraming({ zoom })}
          />
          <FramingSlider
            label="Horizontal"
            value={framing.x}
            min={FRAMING_LIMITS.minPosition}
            max={FRAMING_LIMITS.maxPosition}
            step="0.01"
            display={`${Math.round(framing.x * 100)} %`}
            disabled={!axes.horizontal}
            hint={AXIS_LOCKED_HINT}
            onChange={(x) => onFraming({ x })}
          />
          <FramingSlider
            label="Vertical"
            value={framing.y}
            min={FRAMING_LIMITS.minPosition}
            max={FRAMING_LIMITS.maxPosition}
            step="0.01"
            display={`${Math.round(framing.y * 100)} %`}
            disabled={!axes.vertical}
            hint={AXIS_LOCKED_HINT}
            onChange={(y) => onFraming({ y })}
          />
          <button
            type="button"
            disabled={isDefaultFraming(framing)}
            onClick={() => onFraming(DEFAULT_FRAMING)}
            title="Revenir au zoom 100 % et à l'image centrée"
            className="w-full flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md px-2.5 py-1.5 text-xs text-gray-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RotateCcw size={12} /> Cadrage initial
          </button>
        </div>
      )}
    </div>
  );
};

export default BackgroundImageField;