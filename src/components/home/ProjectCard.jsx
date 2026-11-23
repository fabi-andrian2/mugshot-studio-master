import { useEffect, useState } from 'react';
import { Copy, ImageOff, Pencil, Trash2 } from 'lucide-react';
import { MAX_PROJECT_NAME_LENGTH, formatRelativeTime } from '../../domain/projects.js';

const useThumbnailUrl = (blob) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!(blob instanceof Blob)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
};

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

const ProjectCard = ({
  project,
  highlighted = false,
  disabled = false,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const thumbUrl = useThumbnailUrl(project.thumbnail);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [error, setError] = useState('');

  const commit = async () => {
    const value = draft.trim();
    if (!value || value === project.name) {
      setEditing(false);
      setError('');
      return;
    }
    const result = await onRename(project.id, value);
    if (result.ok) {
      setEditing(false);
      setError('');
    } else {
      setError(result.message);
    }
  };

  const stats = project.stats ?? {};
  return (
    <div
      className={`group relative flex flex-col rounded-lg border bg-[#151515] overflow-hidden transition ${
        highlighted ? 'border-emerald-700/70' : 'border-gray-800 hover:border-gray-600'
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpen(project.id)}
        className="relative aspect-[4/3] w-full bg-[#0d0d0d] flex items-center justify-center overflow-hidden disabled:opacity-60"
        title="Ouvrir ce projet"
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          <ImageOff size={22} className="text-gray-700" />
        )}
      </button>
      <div className="p-3 flex flex-col gap-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={MAX_PROJECT_NAME_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(project.name);
                setError('');
              }
            }}
            className="bg-[#0d0d0d] border border-emerald-700 rounded px-2 py-1 text-sm text-white outline-none"
          />
        ) : (
          <div className="text-sm font-semibold text-white truncate" title={project.name}>
            {project.name}
          </div>
        )}
        {error && <div className="text-[11px] text-red-400">{error}</div>}
        <div className="text-[11px] text-gray-500 truncate">
          {plural(stats.subjects ?? 0, 'sujet', 'sujets')} ·{' '}
          {plural(stats.measures ?? 0, 'mesure', 'mesures')} · {stats.canvasW}×{stats.canvasH}
        </div>
        <div className="text-[11px] text-gray-600">
          Modifié {formatRelativeTime(project.updatedAt)}
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        {[
          { icon: Pencil, label: 'Renommer', run: () => { setDraft(project.name); setEditing(true); } },
          { icon: Copy, label: 'Dupliquer', run: () => onDuplicate(project.id) },
          { icon: Trash2, label: 'Supprimer', run: () => onDelete(project) },
        ].map(({ icon: Icon, label, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={run}
            className="p-1.5 rounded bg-black/70 border border-gray-700 text-gray-300 hover:text-white hover:bg-black transition disabled:opacity-40"
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProjectCard;
