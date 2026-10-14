import { useState } from "react";
import { Eraser } from 'lucide-react';
import {
  Upload,
  Download,
  Ruler,
  RotateCcw,
  RotateCw,
  Maximize2,
  Eye,
  EyeOff,
  AlignHorizontalSpaceAround,
  ChevronDown,
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

const Toolbar = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
  onBackgroundImageFiles,
  onRemoveBackgroundImage,
  onToggleGrid,
  mannequin,
  mannequinX,
  onToggleMannequin,
  onMannequinHeight,
  onMannequinX,
  onMannequinAutoX,
  measureActive,
  measureCount,
  onToggleMeasure,
  onClearMeasures,
  hidden = false,
}) => (
  <header className={`${hidden ? "hidden" : "flex"} h-12 border-b border-gray-800 bg-[#111] items-center gap-2 px-3 shrink-0 z-20`}>
    <div className="flex items-center gap-2 shrink-0 mr-1">
      <Ruler size={17} className="text-emerald-400" />
      <span className="hidden 2xl:inline font-black tracking-[0.2em] text-sm whitespace-nowrap">
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
      <FileButton
        icon={Upload}
        label="Importer"
        title="Importer des images"
        onFiles={onImport}
      />
      <ArrangeMenu disabled={!hasSubjects} onArrange={onArrange} />
    </ToolbarGroup>

    <Divider />

    <ToolbarGroup>
      <ToolButton
        icon={Ruler}
        label="Mesurer"
        title="Outil de mesure : glisse sur la planche pour mesurer une distance (Échap pour quitter)"
        variant={measureActive ? "active" : "ghost"}
        pressed={measureActive}
        onClick={onToggleMeasure}
      />
      {measureCount > 0 && (
        <ToolButton
          icon={Eraser}
          label={`Effacer (${measureCount})`}
          title={`Effacer les ${measureCount} mesure(s) temporaire(s)`}
          onClick={onClearMeasures}
        >
          <span className="min-[1320px]:hidden font-mono text-[10px]">{measureCount}</span>
        </ToolButton>
      )}
      <ToolButton
        icon={annotations.enabled ? Eye : EyeOff}
        label="Annotations"
        title="Afficher / masquer les annotations (nom, hauteur, ligne de sommet)"
        variant={annotations.enabled ? "active" : "ghost"}
        pressed={annotations.enabled}
        onClick={onToggleAnnotations}
      >
        <span className="font-mono text-[10px]">
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
    </ToolbarGroup>

    <Divider />

    <Segmented
      options={UNIT_OPTIONS}
      value={unit}
      onChange={onUnitChange}
      title="Unité d'affichage des hauteurs"
    />

    <div className="flex-1 min-w-0" />

    <ToolbarGroup>
      <BoardMenu
        board={board}
        onColor={onBackgroundColor}
        onImage={onBackgroundImage}
        onImageFiles={onBackgroundImageFiles}
        onRemoveImage={onRemoveBackgroundImage}
        onToggleGrid={onToggleGrid}
        unit={unit}
        mannequin={mannequin}
        mannequinX={mannequinX}
        onToggleMannequin={onToggleMannequin}
        onMannequinHeight={onMannequinHeight}
        onMannequinX={onMannequinX}
        onMannequinAutoX={onMannequinAutoX}
      />
      <ToolButton
        icon={Maximize2}
        label="Format"
        title="Format de la planche"
        onClick={onOpenFormat}
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