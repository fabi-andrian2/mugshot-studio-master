import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Upload, X } from "lucide-react";

import {
  DEFAULT_W,
  DEFAULT_H,
  FLOOR_MARGIN,
  SNAP_Y,
  MAX_HIST,
} from "../domain/constants.js";
import {
  getSubjectGeometry,
  getMeasuredHeightPx,
  getScaleForGroundToTopPx,
  getAnchorUpdateForCanvasPoint,
  getHeadUpdateForCanvasPoint,
} from "../domain/geometry.js";
import {
  getAnnotationItems,
  DEFAULT_ANNOTATIONS,
} from "../domain/annotations.js";
import { clampScale } from "../domain/measurement.js";
import { arrangeSubjects, layoutOnImport } from "../domain/layout.js";
import { isSubjectVisible, updateSilhouette } from "../domain/appearance.js";
import {
  createSubject,
  renameSubject,
  reorderSubject,
  moveSubjectToLayerIndex,
  toggleVisibility,
  getSelectionLabel,
} from "../domain/subjects.js";
import { pickImageFile, getImportMessage } from "../domain/fileDrop.js";
import { renderBoard, downloadCanvasAsPng } from "../services/export.js";
import { importImageFiles } from "../services/imageImport.js";
import {
  loadBackgroundImage,
  releaseBackgroundImage,
} from "../services/backgroundImage.js";
import {
  DEFAULT_BOARD,
  isValidColor,
  setBackgroundColor,
  setBackgroundImage,
  toggleGrid,
  setBoardTitle,
} from "../domain/board.js";
import useDocumentHistory from "../hooks/useDocumentHistory.js";
import useCanvasNavigation from "../hooks/useCanvasNavigation.js";
import useFullscreen from "../hooks/useFullscreen.js";
import useFileDropZone from "../hooks/useFileDropZone.js";
import useSessionPersistence from "../hooks/useSessionPersistence.js";
import SessionNotice from "../components/status/SessionNotice.jsx";
import {
  COMPOSITION_PADDING,
  BUST_PADDING,
  getSubjectRect,
  getCompositionRect,
  getBustRect,
} from "../domain/views.js";
import Toolbar from "../components/toolbar/Toolbar.jsx";
import Grid from "../components/canvas/Grid.jsx";
import BackgroundLayer from "../components/canvas/BackgroundLayer.jsx";
import MannequinLayer from "../components/canvas/MannequinLayer.jsx";
import MeasureLayer from '../components/canvas/MeasureLayer.jsx';
import MeasureOverlay from '../components/canvas/MeasureOverlay.jsx';
import { areDocumentStatesEqual, liftMeasureOperation } from '../domain/documentHistory.js';
import {
  EMPTY_MEASURE_SELECTION,
  selectMeasure,
  clearMeasureSelection,
  pruneMeasureSelection,
} from '../domain/measureSelection.js';
import {
  addMeasure,
  clearMeasures,
  removeMeasures,
  getMeasureEntries,
  getMeasureExportItems,
  formatDistance,
  shiftMeasures,
} from '../domain/measure.js';
import {
  DEFAULT_MANNEQUIN,
  toggleMannequin,
  setMannequinHeight,
  setMannequinX,
  resolveMannequinX,
  getMannequinGeometry,
} from "../domain/mannequin.js";
import SubjectView from "../components/canvas/SubjectView.jsx";
import AnnotationsLayer from "../components/canvas/AnnotationsLayer.jsx";
import Inspector from "../components/inspector/Inspector.jsx";
import LayersPanel, { LayersRail } from "../components/layers/LayersPanel.jsx";
import ViewportControls from "../components/viewport/ViewportControls.jsx";
import { getInitialPanelLayout, toggleLayersPanel } from "../domain/panels.js";
import FormatDialog from "../components/dialogs/FormatDialog.jsx";
import StatusBar from "../components/status/StatusBar.jsx";

const HISTORY_OPTIONS = {
  isEqual: areDocumentStatesEqual,
  limit: MAX_HIST,
  mergeWindowMs: 500,
};

const isTextField = (el) =>
  el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "range");

const markManual = (upd) =>
  Object.prototype.hasOwnProperty.call(upd, "x")
    ? { ...upd, placement: "manual" }
    : upd;

const shiftScale = (subject, delta) =>
  clampScale(getMeasuredHeightPx(subject), subject.scale + delta);

const MugshotStudio = () => {
  const [canvasW, setCanvasW] = useState(DEFAULT_W);
  const [canvasH, setCanvasH] = useState(DEFAULT_H);
  const floorY = canvasH - FLOOR_MARGIN;

  const {
    subjects,
    measureItems,
    set: setLive,
    apply,
    applyMeasures,
    patchMeasures,
    commit,
    rollback,
    undo,
    redo,
    reset: resetHistory,
    canUndo,
    canRedo,
  } = useDocumentHistory(HISTORY_OPTIONS);
  const [selectedId, setSelectedIdRaw] = useState(null);
  const [selectedMeasureIds, setSelectedMeasureIds] = useState(EMPTY_MEASURE_SELECTION);

  const setSelectedId = useCallback((value) => {
    setSelectedIdRaw(value);
    if (typeof value !== "function" && value !== null) {
      setSelectedMeasureIds((current) => clearMeasureSelection(current));
    }
  }, []);

  const [dragInfo, setDragInfo] = useState(null);
  const [resizeInfo, setResizeInfo] = useState(null);
  const [anchorInfo, setAnchorInfo] = useState(null);
  const [isSnapping, setIsSnapping] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [layout, setLayout] = useState(() => getInitialPanelLayout(window.innerWidth));
  const [presentation, setPresentation] = useState(false);
  const [unit, setUnit] = useState("cm");
  const [annotations, setAnnotations] = useState(DEFAULT_ANNOTATIONS);

  const [board, setBoard] = useState(DEFAULT_BOARD);
  const backgroundImageRef = useRef(null);

  const [mannequin, setMannequin] = useState(DEFAULT_MANNEQUIN);
  const [measureActive, setMeasureActive] = useState(false);
  const [measureDraft, setMeasureDraft] = useState(null);
  const measure = useMemo(
    () => ({ active: measureActive, items: measureItems }),
    [measureActive, measureItems],
  );
  const activeMeasureIds = useMemo(
    () => pruneMeasureSelection(selectedMeasureIds, measureItems),
    [selectedMeasureIds, measureItems],
  );

  useEffect(() => {
    return () => {
      releaseBackgroundImage(backgroundImageRef.current);
    };
  }, []);

  const handleRestore = useCallback(
    (restored) => {
      releaseBackgroundImage(backgroundImageRef.current);
      resetHistory(restored.subjects, restored.measure.items);
      setSelectedId(null);
      setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
      setMeasureDraft(null);
      setCanvasW(restored.canvasW);
      setCanvasH(restored.canvasH);
      setUnit(restored.unit);
      setAnnotations(restored.annotations);
      backgroundImageRef.current = restored.board.background.image;
      setBoard(restored.board);
      setMannequin(restored.mannequin);
      setMeasureActive(false);
    },
    [resetHistory, setSelectedId],
  );
  const {
  phase,
  problem,
  saveStatus,
  restored,
  discardSavedSession,
} = useSessionPersistence({
  subjects,
  canvasW,
  canvasH,
  unit,
  board,
  annotations,
  mannequin,
  measureItems: measure.items,
  onRestore: handleRestore,
});
  const workspaceRef = useRef(null);
  const containerRef = useRef(null);

  const {
    zoom,
    panX,
    panY,
    isSpacePressed,
    isPanning,
    zoomIn,
    zoomOut,
    resetView,
    fitToScreen,
    showRect,
    startPan,
    onBackgroundDoubleClick,
  } = useCanvasNavigation({ containerRef, workspaceRef });

  const {
    isFullscreen,
    isSupported: canFullscreen,
    toggleFullscreen,
  } = useFullscreen();


  useEffect(() => {
    const hasFiles = (e) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const preventFileNavigation = (e) => {
      if (hasFiles(e) && !e.defaultPrevented) e.preventDefault();
    };
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  const gestureActive = !!dragInfo || !!resizeInfo || !!anchorInfo;

  const handleUndo = useCallback(() => {
    if (gestureActive) return;
    setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
    undo();
  }, [gestureActive, undo]);

  const handleRedo = useCallback(() => {
    if (gestureActive) return;
    setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
    redo();
  }, [gestureActive, redo]);

  const updateSubject = useCallback(
    (id, upd) => {
      setLive((list) =>
        list.map((s) => (s.id === id ? { ...s, ...markManual(upd) } : s)),
      );
    },
    [setLive],
  );

  const updateSubjectH = useCallback(
    (id, upd, mergeKey) => {
      apply(
        (list) =>
          list.map((s) => (s.id === id ? { ...s, ...markManual(upd) } : s)),
        mergeKey,
      );
    },
    [apply],
  );

  const handleFileUpload = useCallback(
    async (fileList) => {
      const { images, rejected, unreadable } = await importImageFiles(fileList);
      const message = getImportMessage({
        imported: images.length,
        rejected,
        unreadable,
      });
      if (!images.length) {
        if (message) window.alert(message);
        return;
      }
      if (message) {
        requestAnimationFrame(() => setTimeout(() => window.alert(message), 0));
      }
      apply((list) => {
        const topZ = list.reduce((max, s) => Math.max(max, s.zIndex), 0);
        const created = images.map((image, i) =>
          createSubject(image, { index: i, canvasW, zIndex: topZ + i + 1 }),
        );
        return layoutOnImport(list, created, { canvasW, floorY });
      });
      setSelectedId(images[0].id);
    },
    [apply, canvasW, floorY, setSelectedId],
  );

  const handleArrange = useCallback(
    (command) => {
      const result = arrangeSubjects(subjects, command, { canvasW, floorY });
      apply(() => result.subjects);
      if (!result.fits) {
        window.alert(
          "Les sujets ne tiennent pas dans ce format : ils se chevauchent. Choisis un format plus large.",
        );
      }
    },
    [subjects, apply, canvasW, floorY],
  );

  const { dropState, ignoredCount, dropProps } = useFileDropZone({
    onFiles: handleFileUpload,
  });

  const removeSubject = useCallback(
    (id) => {
      apply((list) => list.filter((s) => s.id !== id));
      setSelectedId((current) => (current === id ? null : current));
    },
    [apply, setSelectedId],
  );

  const handleSelectMeasure = useCallback((id, additive) => {
    setSelectedIdRaw(null);
    setSelectedMeasureIds((current) => selectMeasure(current, id, additive));
  }, []);

  const deleteSelectedMeasures = useCallback(() => {
    if (activeMeasureIds.length === 0) return;
    applyMeasures(
      liftMeasureOperation((current) => removeMeasures(current, activeMeasureIds)),
    );
    setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
  }, [activeMeasureIds, applyMeasures]);

  const handleRename = useCallback(
    (id, name) => {
      apply((list) =>
        list.map((s) => (s.id === id ? renameSubject(s, name) : s)),
      );
    },
    [apply],
  );

  const handleToggleVisible = useCallback(
    (id) => {
      apply((list) => list.map((s) => (s.id === id ? toggleVisibility(s) : s)));
    },
    [apply],
  );

  const handleMove = useCallback(
    (id, move) => {
      apply((list) => reorderSubject(list, id, move));
    },
    [apply],
  );

  const handleReorder = useCallback(
    (id, layerIndex) => {
      apply((list) => moveSubjectToLayerIndex(list, id, layerIndex));
    },
    [apply],
  );

  const handleSubjectPointerDown = (e, id) => {
    if (e.button !== 0 || isSpacePressed) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    const s = subjects.find((s) => s.id === id);
    setDragInfo({
      id,
      startX: e.clientX,
      startY: e.clientY,
      initX: s.x,
      initY: s.y,
    });
  };

  const handleSubjectDoubleClick = (e, id) => {
    e.stopPropagation();
    setSelectedId(id);
  };

  const handleResizePointerDown = (e, id, handleType) => {
    if (isSpacePressed) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = subjects.find((x) => x.id === id);
    const { visible, anchor } = getSubjectGeometry(s, floorY);
    setResizeInfo({
      id,
      handleType,
      startX: e.clientX,
      startY: e.clientY,
      initH: anchor.y - visible.top,
    });
  };

  const handleAnchorPointerDown = (e, id, kind) => {
    if (e.button !== 0 || isSpacePressed) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    setAnchorInfo({ id, kind });
  };

  const onDragMove = useCallback(
    (e) => {
      if (dragInfo) {
        let nx = dragInfo.initX + (e.clientX - dragInfo.startX) / zoom;
        let ny = dragInfo.initY - (e.clientY - dragInfo.startY) / zoom;

        const snap = Math.abs(ny) < SNAP_Y;
        setIsSnapping(snap);
        if (snap) ny = 0;

        nx = Math.max(-canvasW, Math.min(nx, canvasW * 2));
        updateSubject(dragInfo.id, { x: nx, y: ny });
      } else if (resizeInfo) {
        const s = subjects.find((x) => x.id === resizeInfo.id);
        if (!s) return;
        const dy = (resizeInfo.startY - e.clientY) / zoom;
        updateSubject(resizeInfo.id, {
          scale: getScaleForGroundToTopPx(s, resizeInfo.initH + dy),
        });
      } else if (anchorInfo) {
        const s = subjects.find((x) => x.id === anchorInfo.id);
        const workspace = workspaceRef.current;
        if (!s || !workspace) return;
        const rect = workspace.getBoundingClientRect();
        const point = {
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom,
        };
        const update =
          anchorInfo.kind === "head"
            ? getHeadUpdateForCanvasPoint(s, floorY, point)
            : getAnchorUpdateForCanvasPoint(s, floorY, point);
        updateSubject(anchorInfo.id, update);
      }
    },
    [
      dragInfo,
      resizeInfo,
      anchorInfo,
      zoom,
      canvasW,
      floorY,
      subjects,
      updateSubject,
    ],
  );

  const onDragUp = useCallback(() => {
    setDragInfo(null);
    setResizeInfo(null);
    setAnchorInfo(null);
    setIsSnapping(false);
    commit();
  }, [commit]);

  useEffect(() => {
    if (!dragInfo && !resizeInfo && !anchorInfo) return;
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
    return () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragUp);
    };
  }, [dragInfo, resizeInfo, anchorInfo, onDragMove, onDragUp]);

  useEffect(() => {
    const onKey = (e) => {
      if (phase === "loading" || showSettings) return;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && (key === "z" || key === "y") && !isTextField(e.target)) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (presentation) return;
      if (e.target.tagName === "INPUT") return;
      if (measure.active) return;

      if (activeMeasureIds.length > 0) {
        if (e.key === "Delete" || e.key === "Backspace") {
          deleteSelectedMeasures();
          e.preventDefault();
          return;
        }
        if (e.key === "Escape") {
          setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
          e.preventDefault();
          return;
        }
      }

      if (selectedId && (e.key === "[" || e.key === "]")) {
        const s = subjects.find((x) => x.id === selectedId);
        if (s) {
          const delta = (e.shiftKey ? 0.1 : 0.01) * (e.key === "]" ? 1 : -1);
          updateSubjectH(
            selectedId,
            { scale: shiftScale(s, delta) },
            `scale-${selectedId}`,
          );
        }
        e.preventDefault();
        return;
      }

      if (!selectedId) return;
      const subj = subjects.find((s) => s.id === selectedId);
      if (!subj) return;

      const step = e.shiftKey ? 20 : 2;
      const nudgeKey = `nudge-${selectedId}`;
      if (e.key === "ArrowLeft") {
        updateSubjectH(selectedId, { x: subj.x - step }, nudgeKey);
        e.preventDefault();
      }
      if (e.key === "ArrowRight") {
        updateSubjectH(selectedId, { x: subj.x + step }, nudgeKey);
        e.preventDefault();
      }
      if (e.key === "ArrowUp") {
        updateSubjectH(selectedId, { y: subj.y + step }, nudgeKey);
        e.preventDefault();
      }
      if (e.key === "ArrowDown") {
        updateSubjectH(selectedId, { y: subj.y - step }, nudgeKey);
        e.preventDefault();
      }
      if (key === "f" && !mod && !e.altKey && !e.repeat) {
        updateSubjectH(selectedId, { flipX: !subj.flipX });
        e.preventDefault();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        removeSubject(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    phase,
    showSettings,
    presentation,
    selectedId,
    measure.active,
    activeMeasureIds,
    deleteSelectedMeasures,
    subjects,
    handleUndo,
    handleRedo,
    updateSubjectH,
    removeSubject,
  ]);

  const annotationItems = getAnnotationItems({
    subjects,
    selectedId,
    annotations,
    floorY,
    unit,
  });

  const mannequinGeometry = getMannequinGeometry(mannequin, { floorY, unit });

  const exportCanvas = async () => {
    try {
      const canvas = await renderBoard({
        svgElement: workspaceRef.current?.querySelector(':scope > svg[data-export-grid]'),
        subjects,
        annotations: annotationItems,
        measures: getMeasureExportItems(measure, unit),
        background: board.background,
        mannequin: mannequinGeometry,
        canvasW,
        canvasH,
        floorY,
      });
      await downloadCanvasAsPng(canvas);
    } catch (err) {
      console.error(err);
      window.alert(`Export impossible : ${err.message}`);
    }
  };

  const active = subjects.find((s) => s.id === selectedId);
  const hiddenCount = subjects.filter((s) => !isSubjectVisible(s)).length;
  const compositionRect = getCompositionRect(subjects, floorY);
  const bustRect = active ? getBustRect(active, floorY) : null;
  const viewAvailability = {
    global: true,
    composition: compositionRect !== null,
    bust: bustRect !== null,
    actual: true,
  };

  const handleView = (id) => {
    const canvasSize = { width: canvasW, height: canvasH };
    if (id === "global") fitToScreen(canvasW, canvasH);
    if (id === "composition" && compositionRect) {
      showRect(compositionRect, canvasSize, { padding: COMPOSITION_PADDING });
    }
    if (id === "bust" && bustRect) {
      showRect(bustRect, canvasSize, { padding: BUST_PADDING });
    }
    if (id === "actual") {
      const focus = active ? getSubjectRect(active, floorY) : null;
      showRect(
        focus ?? { left: 0, top: 0, width: canvasW, height: canvasH },
        canvasSize,
        { zoom: 1 },
      );
    }
  };

  const applyBackgroundImage = (image) => {
    releaseBackgroundImage(backgroundImageRef.current);
    backgroundImageRef.current = image;
    setBoard((current) => setBackgroundImage(current, image));
  };

  const handleBackgroundColor = (color) => {
    if (!isValidColor(color)) return;
    releaseBackgroundImage(backgroundImageRef.current);
    backgroundImageRef.current = null;
    setBoard((current) => setBackgroundColor(current, color));
  };

  const handleBackgroundImage = async (file) => {
    try {
      applyBackgroundImage(await loadBackgroundImage(file));
    } catch (error) {
      console.error(error);
      window.alert(
        "Image de fond non chargée : le fichier n'est pas une image valide.",
      );
    }
  };

  const handleBackgroundFiles = (files) => {
    const file = pickImageFile(files);
    if (!file) {
      window.alert(
        "Fichier non pris en charge : dépose une image pour l'utiliser comme fond.",
      );
      return;
    }
    handleBackgroundImage(file);
  };

  const handleToggleGrid = () => setBoard((current) => toggleGrid(current));

  const handleBoardTitle = (title) => setBoard((current) => setBoardTitle(current, title));

  const handleSilhouette = (patch) => {
    apply(
      list => list.map(s => s.id === selectedId ? updateSilhouette(s, patch) : s),
      `silhouette-${selectedId}`,
    );
  };

  const handleToggleMannequin = () => setMannequin(current => toggleMannequin(current));
  const handleMannequinHeight = (heightCm) => setMannequin(current => setMannequinHeight(current, heightCm));
  const handleMannequinX = (x) => setMannequin(current => setMannequinX(current, x));
  const handleMannequinAutoX = () => setMannequin(current => setMannequinX(current, null));

  const setPresentationMode = useCallback(
    (next) => {
      if (next) {
        setSelectedId(null);
        setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
        setMeasureDraft(null);
        setMeasureActive(false);
      }
      setPresentation(next);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => fitToScreen(canvasW, canvasH)),
      );
    },
    [setSelectedId, fitToScreen, canvasW, canvasH],
  );

  useEffect(() => {
    if (!presentation) return;
    const onEscape = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPresentationMode(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [presentation, setPresentationMode]);

  const handleToggleMeasure = () => {
    setMeasureDraft(null);
    setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
    setMeasureActive(current => !current);
  };
  const handleClearMeasures = () => {
    applyMeasures(liftMeasureOperation(clearMeasures));
    setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
  };
  const handleMeasureComplete = (start, end) =>
    patchMeasures(liftMeasureOperation(current => addMeasure(current, start, end)));

  useEffect(() => {
    if (!measure.active) return;
    const onEscape = (e) => {
      if (e.key !== 'Escape') return;
      setMeasureDraft(null);
      setMeasureActive(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [measure.active]);

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] text-gray-200 font-sans antialiased overflow-hidden select-none">
      <SessionNotice
        phase={phase}
        problem={problem}
        saveStatus={saveStatus}
        restored={restored}
        onDiscard={discardSavedSession}
      />
      {showSettings && (
        <FormatDialog
          canvasW={canvasW}
          canvasH={canvasH}
          onApply={(w, h) => {
            patchMeasures(liftMeasureOperation(current => shiftMeasures(current, h - canvasH)));
            setMeasureDraft(null);
            setCanvasW(w);
            setCanvasH(h);
            setShowSettings(false);
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}

        <Toolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          unit={unit}
          onUnitChange={setUnit}
          annotations={annotations}
          onToggleAnnotations={() =>
            setAnnotations((a) => ({ ...a, enabled: !a.enabled }))
          }
          onScopeChange={(scope) => setAnnotations((a) => ({ ...a, scope }))}
          hasSubjects={subjects.length > 0}
          onArrange={handleArrange}
          onOpenFormat={() => setShowSettings(true)}
          onImport={handleFileUpload}
          onExport={exportCanvas}
          board={board}
          onBackgroundColor={handleBackgroundColor}
          onBackgroundImage={handleBackgroundImage}
          onBackgroundImageFiles={handleBackgroundFiles}
          onRemoveBackgroundImage={() => applyBackgroundImage(null)}
          onToggleGrid={handleToggleGrid}
          onBoardTitle={handleBoardTitle}
          mannequin={mannequin}
          mannequinX={resolveMannequinX(mannequin)}
          onToggleMannequin={handleToggleMannequin}
          onMannequinHeight={handleMannequinHeight}
          onMannequinX={handleMannequinX}
          onMannequinAutoX={handleMannequinAutoX}
          measureActive={measure.active}
          measureCount={measure.items.length}
          onToggleMeasure={handleToggleMeasure}
          onClearMeasures={handleClearMeasures}
          hidden={presentation}
        />

      <div className="flex flex-1 min-h-0">
        {layout.layersOpen ? (
          <aside className={`${presentation ? "hidden" : "flex"} w-56 bg-[#111] border-r border-gray-800 flex-col shrink-0`}>
            <LayersPanel
              subjects={subjects}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleVisible={handleToggleVisible}
              onMove={handleMove}
              onReorder={handleReorder}
              onRename={handleRename}
              onRemove={removeSubject}
              onCollapse={() => setLayout(toggleLayersPanel)}
            />
          </aside>
        ) : (
          <LayersRail count={subjects.length} onExpand={() => setLayout(toggleLayersPanel)} hidden={presentation} />
        )}

        <div className="flex-1 flex flex-col min-h-0 min-w-0">

        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-[#1a1a1a] flex items-center justify-center relative"
          style={{
            cursor: isSpacePressed
              ? "grab"
              : isPanning
                ? "grabbing"
                : "default",
          }}
          {...dropProps}
          onMouseDown={(e) => {
            if (e.button === 0) {
              if (
                isSpacePressed ||
                e.target === containerRef.current ||
                e.target === workspaceRef.current
              ) {
                if (!isSpacePressed) {
                  setSelectedId(null);
                  setSelectedMeasureIds(EMPTY_MEASURE_SELECTION);
                }
                startPan(e);
              }
            }
          }}
          onDoubleClick={onBackgroundDoubleClick}
        >
          <div
            ref={workspaceRef}
            className="relative shadow-2xl ring-1 ring-gray-600 shrink-0 select-none"
            style={{
              width: canvasW,
              height: canvasH,
              backgroundColor: board.background.color,
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <BackgroundLayer
              image={board.background.image}
              canvasW={canvasW}
              canvasH={canvasH}
            />
            <Grid canvasW={canvasW} canvasH={canvasH} showGrid={board.showGrid} background={board.background} title={board.title} />
            <MannequinLayer geometry={mannequinGeometry} canvasW={canvasW} canvasH={canvasH} />

            {subjects.map((s) => (
              <SubjectView
                key={s.id}
                subject={s}
                floorY={floorY}
                zoom={zoom}
                selected={selectedId === s.id}
                showSnap={dragInfo?.id === s.id && isSnapping}
                onPointerDown={(e) => handleSubjectPointerDown(e, s.id)}
                onDoubleClick={(e) => handleSubjectDoubleClick(e, s.id)}
                onResizeStart={(e, handleType) =>
                  handleResizePointerDown(e, s.id, handleType)
                }
                onAnchorStart={(e, kind) =>
                  handleAnchorPointerDown(e, s.id, kind)
                }
              />
            ))}

            <AnnotationsLayer
              items={annotationItems}
              canvasW={canvasW}
              canvasH={canvasH}
            />

            <MeasureLayer
              entries={getMeasureEntries(measure, unit)}
              draft={measure.active ? measureDraft : null}
              unit={unit}
              zoom={zoom}
              isSpacePressed={isSpacePressed}
              canvasW={canvasW}
              canvasH={canvasH}
              formatDraft={(d, u) => formatDistance(d.start, d.end, u)}
              selectedIds={activeMeasureIds}
              onSelect={measure.active ? undefined : handleSelectMeasure}
            />
            {measure.active && (
              <MeasureOverlay
                zoom={zoom}
                canvasW={canvasW}
                canvasH={canvasH}
                isSpacePressed={isSpacePressed}
                draft={measureDraft}
                onDraft={setMeasureDraft}
                onComplete={handleMeasureComplete}
              />
            )}

            {subjects.length === 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ paddingTop: canvasH * 0.25 }}
              >
                <Upload size={64} className="text-gray-400 opacity-10 mb-3" />
                <p className="text-gray-400 text-3xl font-semibold opacity-10 tracking-widest">
                  GLISSE DES IMAGES ICI
                </p>
              </div>
            )}
          </div>

          {dropState && (
            <div
              role="status"
              className={`absolute inset-3 z-30 pointer-events-none rounded-lg border-2 border-dashed flex items-center justify-center animate-fade-in ${
                dropState === "reject"
                  ? "border-red-500/70 bg-red-950/25"
                  : "border-emerald-500/70 bg-emerald-950/20"
              }`}
            >
              <div className="flex items-center gap-2 rounded-md border border-gray-700 bg-[#111] px-4 py-2 text-sm text-gray-100 shadow-2xl">
                {dropState === "reject" ? (
                  <X size={16} className="shrink-0 text-red-400" />
                ) : (
                  <Upload size={16} className="shrink-0 text-emerald-400" />
                )}
                <div>
                  <p>
                    {dropState === "reject"
                      ? "Dépôt refusé : aucune image dans ces fichiers"
                      : "Déposer les images pour importer"}
                  </p>
                  {dropState === "accept" && ignoredCount > 0 && (
                    <p className="text-[11px] text-gray-400">
                      {ignoredCount} fichier{ignoredCount > 1 ? "s" : ""} non image ignoré{ignoredCount > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <ViewportControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetView={resetView}
            onFit={() => fitToScreen(canvasW, canvasH)}
            onView={handleView}
            viewAvailability={viewAvailability}
            isFullscreen={isFullscreen}
            canFullscreen={canFullscreen}
            onToggleFullscreen={toggleFullscreen}
            presentation={presentation}
            onTogglePresentation={() => setPresentationMode(!presentation)}
          />
        </div>

        <StatusBar
          containerRef={containerRef}
          workspaceRef={workspaceRef}
          zoom={zoom}
          floorY={floorY}
          subjectCount={subjects.length}
          hiddenCount={hiddenCount}
          selectionLabel={getSelectionLabel(active, unit)}
          measureActive={measure.active}
          canvasW={canvasW}
          canvasH={canvasH}
          hidden={presentation}
        />
      </div>

      <aside className={`${presentation ? "hidden" : "flex"} w-64 xl:w-72 bg-[#111] border-l border-gray-800 flex-col shrink-0`}>
        <Inspector
          subject={active}
          unit={unit}
          canvasW={canvasW}
          onPreview={(upd) => updateSubject(selectedId, upd)}
          onApply={(upd) => updateSubjectH(selectedId, upd)}
          onCancelEdit={rollback}
          onEndGesture={commit}
          onRename={(name) => handleRename(selectedId, name)}
          onToggleVisible={() => handleToggleVisible(selectedId)}
          onMove={(move) => handleMove(selectedId, move)}
          onRemove={() => removeSubject(selectedId)}
          onSilhouette={handleSilhouette}
        />
      </aside>
    </div>
  </div>
  );
};

export default MugshotStudio;