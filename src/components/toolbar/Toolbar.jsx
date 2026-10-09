import { useState } from "react";
import {
  Upload,
  Download,
  Ruler,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Maximize2,
  Eye,
  EyeOff,
  Scan,
  AlignHorizontalSpaceAround,
  ChevronDown,
  Focus,
  Expand,
  Shrink,
} from "lucide-react";
import {
  ToolbarGroup,
  Divider,
  ToolButton,
  FileButton,
  Segmented,
} from "./controls.jsx";
import BoardMenu from "./BoardMenu.jsx";

const UNIT_OPTIONS = [
  { value: "cm", label: "CM" },
  { value: "ft", label: "FT/IN" },
];

const SCOPE_OPTIONS = [
  { value: "selected", label: "Sélection" },
  { value: "all", label: "Tous" },
];

const ARRANGE_COMMANDS = [
  { id: "center", label: "Centrer la composition" },
  { id: "space", label: "Espacer (ordre actuel)" },
  { id: "sort-asc", label: "Trier par hauteur ↑ croissante" },
  { id: "sort-desc", label: "Trier par hauteur ↓ décroissante" },
  { id: "floor", label: "Aligner tous les sujets au sol" },
];

const ArrangeMenu = ({ disabled, onArrange }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <ToolButton
        icon={AlignHorizontalSpaceAround}
        label="Réorganiser"
        title="Réorganiser les sujets (appliqué uniquement à la demande)"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown size={11} />
      </ToolButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-60 bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl py-1">
            {ARRANGE_COMMANDS.map((command) => (
              <button
                key={command.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onArrange(command.id);
                }}
                className="w-full text-left text-xs px-3 py-2 text-gray-300 hover:bg-gray-700 transition"
              >
                {command.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const VIEW_COMMANDS = [
  {
    id: "global",
    label: "Vue globale",
    hint: "Planche entière",
    unavailable: "",
  },
  {
    id: "composition",
    label: "Vue adaptée",
    hint: "Sujets visibles",
    unavailable: "Aucun sujet visible",
  },
  {
    id: "bust",
    label: "Vue buste",
    hint: "Sujet sélectionné",
    unavailable: "Sélectionne un sujet visible",
  },
  { id: "actual", label: "Zoom 100 %", hint: "Taille réelle", unavailable: "" },
];

const ViewMenu = ({ availability, onView }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <ToolButton
        icon={Focus}
        label="Vue"
        title="Presets de vue"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown size={11} />
      </ToolButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-52 bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl py-1">
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
                  <span className="text-[10px] text-gray-600">
                    {command.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const Toolbar = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
  unit,
  onUnitChange,
  annotations,
  onToggleAnnotations,
  onScopeChange,
  hasSubjects,
  onArrange,
  onOpenFormat,
  onImport,
  onExport,
  board,
  onBackgroundColor,
  onBackgroundImage,
  onRemoveBackgroundImage,
  onToggleGrid,
}) => (
  <header className="h-14 border-b border-gray-800 bg-[#111] flex items-center justify-between px-4 shrink-0 z-20">
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 mr-3">
        <Ruler size={17} className="text-emerald-400" />
        <span className="hidden xl:inline font-black tracking-[0.2em] text-sm">
          MUGSHOT <span className="text-emerald-400">STUDIO</span>
        </span>
      </div>

      <ToolbarGroup>
        <ToolButton
          icon={RotateCcw}
          title="Annuler (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        />
        <ToolButton
          icon={RotateCw}
          title="Rétablir (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
        />
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolButton icon={ZoomOut} title="Zoom arrière" onClick={onZoomOut} />
        <button
          type="button"
          onClick={onResetView}
          title="Revenir à la vue par défaut"
          className="w-14 text-center text-xs font-mono text-gray-300 hover:text-emerald-400 transition py-1"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ToolButton icon={ZoomIn} title="Zoom avant" onClick={onZoomIn} />
        <ToolButton
          icon={Scan}
          title="Ajuster la planche à l'écran"
          onClick={onFit}
        />
        <ViewMenu availability={viewAvailability} onView={onView} />
        <ToolButton
          icon={isFullscreen ? Shrink : Expand}
          title={
            isFullscreen ? "Quitter le plein écran (Échap)" : "Plein écran"
          }
          disabled={!canFullscreen}
          variant={isFullscreen ? "active" : "ghost"}
          pressed={isFullscreen}
          onClick={onToggleFullscreen}
        />
      </ToolbarGroup>

      <Segmented
        options={UNIT_OPTIONS}
        value={unit}
        onChange={onUnitChange}
        title="Unité d'affichage des hauteurs"
      />

      <Divider />

      <ToolbarGroup>
        <ToolButton
          icon={annotations.enabled ? Eye : EyeOff}
          label={`Annotations ${annotations.enabled ? "ON" : "OFF"}`}
          title="Afficher / masquer les annotations (nom, hauteur, ligne de sommet)"
          variant={annotations.enabled ? "active" : "ghost"}
          pressed={annotations.enabled}
          onClick={onToggleAnnotations}
        >
          <span className="2xl:hidden font-mono text-[10px]">
            {annotations.enabled ? "ON" : "OFF"}
          </span>
        </ToolButton>

        {annotations.enabled && (
          <Segmented
            options={SCOPE_OPTIONS}
            value={annotations.scope}
            onChange={onScopeChange}
            title="Annotations : sujet sélectionné ou tous les sujets"
          />
        )}

        <ArrangeMenu disabled={!hasSubjects} onArrange={onArrange} />
      </ToolbarGroup>
    </div>

    <BoardMenu
      board={board}
      onColor={onBackgroundColor}
      onImage={onBackgroundImage}
      onRemoveImage={onRemoveBackgroundImage}
      onToggleGrid={onToggleGrid}
    />

    <ToolbarGroup>
      <ToolButton
        icon={Maximize2}
        label="Format"
        title="Format de la planche"
        onClick={onOpenFormat}
      />
      <FileButton
        icon={Upload}
        label="Importer"
        title="Importer des images"
        onFiles={onImport}
      />
      <ToolButton
        icon={Download}
        label="Exporter HD"
        variant="primary"
        alwaysLabel
        onClick={onExport}
      />
    </ToolbarGroup>
  </header>
);

export default Toolbar;
