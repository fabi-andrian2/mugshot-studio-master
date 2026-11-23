import { AlertTriangle, Check } from 'lucide-react';
import { describeSaveError } from '../../services/projectSaver.js';
import { formatClockTime } from '../../domain/projects.js';

const SaveIndicator = ({ status, onRetry }) => {
  const s = status?.status ?? 'idle';
  let icon = <Check size={13} className="text-gray-600" />;
  let label = 'Enregistré';
  let tone = 'text-gray-500';
  let title = 'Ctrl+S pour enregistrer immédiatement';

  if (s === 'pending') {
    icon = <span className="h-2 w-2 rounded-full bg-amber-400" />;
    label = 'Modifications en attente';
    tone = 'text-amber-300';
  } else if (s === 'saving') {
    icon = <span className="h-2 w-2 rounded-full bg-emerald-400 opacity-70" />;
    label = 'Enregistrement…';
    tone = 'text-emerald-300';
  } else if (s === 'saved') {
    icon = <Check size={13} className="text-emerald-400" />;
    label = status.savedAt ? `Enregistré à ${formatClockTime(status.savedAt)}` : 'Enregistré';
    tone = 'text-emerald-300';
  } else if (s === 'error') {
    icon = <AlertTriangle size={13} className="text-red-400" />;
    label = status.fatal ? 'Non enregistré' : 'Échec — nouvelle tentative';
    tone = 'text-red-300';
    title = `${describeSaveError(status.error)} Cliquer pour réessayer.`;
  }

  return (
    <button
      type="button"
      onClick={onRetry}
      title={title}
      role="status"
      aria-live="polite"
      data-save-status={s}
      className={`flex items-center gap-1.5 text-[11px] whitespace-nowrap px-1.5 py-1 rounded hover:bg-[#1c1c1c] transition ${tone}`}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
};

export default SaveIndicator;
