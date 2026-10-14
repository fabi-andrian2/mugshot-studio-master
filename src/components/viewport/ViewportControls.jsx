import { useState } from 'react';
import { ZoomIn, ZoomOut, Scan, Focus, ChevronDown, Expand, Shrink, Presentation, X } from 'lucide-react';
import { ToolButton } from '../toolbar/controls.jsx';

const VIEW_COMMANDS = [
  { id: 'global', label: 'Vue globale', hint: 'Planche entière', unavailable: '' },
  { id: 'composition', label: 'Vue adaptée', hint: 'Sujets visibles', unavailable: 'Aucun sujet visible' },
  { id: 'bust', label: 'Vue buste', hint: 'Sujet sélectionné', unavailable: 'Sélectionne un sujet visible' },
  { id: 'actual', label: 'Zoom 100 %', hint: 'Taille réelle', unavailable: '' },
];

const ViewMenu = ({ availability, onView }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <ToolButton icon={Focus} label="Vue" title="Presets de vue" onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={11} />
      </ToolButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-50 w-52 bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl py-1">
            {VIEW_COMMANDS.map((command) => {
              const enabled = availability[command.id];
              return (
                <button
                  key={command.id}
                  type="button"
                  disabled={!enabled}
                  title={enabled ? command.hint : command.unavailable}
                  onClick={() => {
                    setOpen(false);
                    onView(command.id);
                  }}
                  className="w-full flex items-center justify-between text-left text-xs px-3 py-2 text-gray-300 hover:bg-gray-700 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <span>{command.label}</span>
                  <span className="text-[10px] text-gray-600">{command.hint}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const ViewportControls = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFit,
  onView,
  viewAvailability,
  isFullscreen,
  canFullscreen,
  onToggleFullscreen,
  presentation = false,
  onTogglePresentation,
}) => (
  <div className={`absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-lg border border-gray-800 bg-[#111]/95 p-1.5 shadow-2xl ${presentation ? 'opacity-70 hover:opacity-100' : ''}`}>    <ToolButton icon={ZoomOut} title="Zoom arrière" onClick={onZoomOut} />
    <button
      type="button"
      onClick={onResetView}
      title="Revenir à la vue par défaut"
      className="w-12 text-center text-xs font-mono text-gray-300 hover:text-emerald-400 transition py-1"
    >
      {Math.round(zoom * 100)}%
    </button>
    <ToolButton icon={ZoomIn} title="Zoom avant" onClick={onZoomIn} />
    <ToolButton icon={Scan} label="Ajuster" title="Ajuster la planche à l'écran" onClick={onFit} />
    <ViewMenu availability={viewAvailability} onView={onView} />
    <ToolButton
      icon={isFullscreen ? Shrink : Expand}
      title={isFullscreen ? 'Quitter le plein écran du navigateur (Échap)' : 'Plein écran du navigateur'}
      disabled={!canFullscreen}
      variant={isFullscreen ? 'active' : 'ghost'}
      pressed={isFullscreen}
      onClick={onToggleFullscreen}
    />
    {presentation ? (
      <ToolButton
        icon={X}
        label="Quitter la présentation"
        title="Quitter le mode présentation (Échap)"
        variant="primary"
        alwaysLabel
        onClick={onTogglePresentation}
      />
    ) : (
      <ToolButton
        icon={Presentation}
        label="Présentation"
        title="Mode présentation : masque l'interface pour ne garder que la planche (Échap pour quitter)"
        onClick={onTogglePresentation}
      />
    )}
  </div>
);

export default ViewportControls;