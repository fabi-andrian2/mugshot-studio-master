import { Image as ImageIcon, X } from 'lucide-react';
import useFileDropZone from '../../hooks/useFileDropZone.js';

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

const BackgroundImageField = ({ image, onImage, onImageFiles, onRemove, onDone }) => {
  const { dropState, dropProps } = useFileDropZone({
    onFiles: (files) => {
      onDone();
      onImageFiles(files);
    },
  });
  const zone = dropState ?? 'idle';

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
    </div>
  );
};

export default BackgroundImageField;