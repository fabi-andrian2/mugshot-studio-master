import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload } from 'lucide-react';

import { DEFAULT_W, DEFAULT_H, FLOOR_MARGIN, SNAP_Y, MAX_HIST } from '../domain/constants.js';
import {
  getSubjectGeometry,
  getMeasuredHeightPx,
  getScaleForGroundToTopPx,
  getAnchorUpdateForCanvasPoint,
  getHeadUpdateForCanvasPoint,
} from '../domain/geometry.js';
import { getAnnotationItems } from '../domain/annotations.js';
import { clampScale } from '../domain/measurement.js';
import { areSubjectListsEqual, createSubject, renameSubject } from '../domain/subjects.js';
import { renderBoard, downloadCanvasAsPng } from '../services/export.js';
import { importImageFiles } from '../services/imageImport.js';
import useHistory from '../hooks/useHistory.js';
import useCanvasNavigation from '../hooks/useCanvasNavigation.js';
import Toolbar from '../components/toolbar/Toolbar.jsx';
import Grid from '../components/canvas/Grid.jsx';
import SubjectView from '../components/canvas/SubjectView.jsx';
import AnnotationsLayer from '../components/canvas/AnnotationsLayer.jsx';
import Inspector from '../components/inspector/Inspector.jsx';
import LayersPanel from '../components/layers/LayersPanel.jsx';
import FormatDialog from '../components/dialogs/FormatDialog.jsx';
import StatusBar from '../components/status/StatusBar.jsx';

const HISTORY_OPTIONS = { isEqual: areSubjectListsEqual, limit: MAX_HIST, mergeWindowMs: 500 };

const isTextField = (el) =>
  el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'range');

const shiftScale = (subject, delta) =>
  clampScale(getMeasuredHeightPx(subject), subject.scale + delta);

const MugshotStudio = () => {
  const [canvasW, setCanvasW] = useState(DEFAULT_W);
  const [canvasH, setCanvasH] = useState(DEFAULT_H);
  const floorY = canvasH - FLOOR_MARGIN;

  const {
    state: subjects,
    set: setLive,
    apply,
    commit,
    rollback,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory([], HISTORY_OPTIONS);
  const [selectedId, setSelectedId] = useState(null);

  const [dragInfo, setDragInfo] = useState(null);
  const [resizeInfo, setResizeInfo] = useState(null);
  const [anchorInfo, setAnchorInfo] = useState(null);
  const [isSnapping, setIsSnapping] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [unit, setUnit] = useState('cm');
  const [annotations, setAnnotations] = useState({ enabled: false, scope: 'selected' });

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
    startPan,
    onBackgroundDoubleClick,
  } = useCanvasNavigation({ containerRef, workspaceRef });

  const gestureActive = !!dragInfo || !!resizeInfo || !!anchorInfo;

  const handleUndo = useCallback(() => {
    if (gestureActive) return;
    undo();
    setSelectedId(null);
  }, [gestureActive, undo]);

  const handleRedo = useCallback(() => {
    if (gestureActive) return;
    redo();
    setSelectedId(null);
  }, [gestureActive, redo]);

  const updateSubject = useCallback((id, upd) => {
    setLive(list => list.map(s => s.id === id ? { ...s, ...upd } : s));
  }, [setLive]);

  const updateSubjectH = useCallback((id, upd, mergeKey) => {
    apply(list => list.map(s => s.id === id ? { ...s, ...upd } : s), mergeKey);
  }, [apply]);

  const handleFileUpload = useCallback(async (fileList) => {
    const { images, failed } = await importImageFiles(fileList);
    if (failed.length) {
      window.alert(`Fichiers non importés (image invalide) :\n${failed.join('\n')}`);
    }
    if (!images.length) return;
    apply(list => {
      const topZ = list.reduce((max, s) => Math.max(max, s.zIndex), 0);
      const created = images.map((image, i) =>
        createSubject(image, { index: list.length + i, canvasW, zIndex: topZ + i + 1 }),
      );
      return [...list, ...created];
    });
    setSelectedId(images[0].id);
  }, [apply, canvasW]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const removeSubject = useCallback((id) => {
    apply(list => list.filter(s => s.id !== id));
    setSelectedId(current => (current === id ? null : current));
  }, [apply]);

  const handleRename = useCallback((id, name) => {
    apply(list => list.map(s => s.id === id ? renameSubject(s, name) : s));
  }, [apply]);

  const bringToFront = id => { const m = Math.max(...subjects.map(s => s.zIndex), 0); updateSubjectH(id, { zIndex: m + 1 }); };
  const sendToBack   = id => { const m = Math.min(...subjects.map(s => s.zIndex), 1); updateSubjectH(id, { zIndex: m - 1 }); };

  const handleSubjectPointerDown = (e, id) => {
    if (e.button !== 0 || isSpacePressed) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    const s = subjects.find(s => s.id === id);
    setDragInfo({ id, startX: e.clientX, startY: e.clientY, initX: s.x, initY: s.y });
  };

  const handleSubjectDoubleClick = (e, id) => {
    e.stopPropagation();
    setSelectedId(id);
  };

  const handleResizePointerDown = (e, id, handleType) => {
    if (isSpacePressed) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = subjects.find(x => x.id === id);
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

  const onDragMove = useCallback((e) => {
    if (dragInfo) {
      let nx = dragInfo.initX + (e.clientX - dragInfo.startX) / zoom;
      let ny = dragInfo.initY - (e.clientY - dragInfo.startY) / zoom;

      const snap = Math.abs(ny) < SNAP_Y;
      setIsSnapping(snap);
      if (snap) ny = 0;

      nx = Math.max(-canvasW, Math.min(nx, canvasW * 2));
      updateSubject(dragInfo.id, { x: nx, y: ny });
    } else if (resizeInfo) {
      const s = subjects.find(x => x.id === resizeInfo.id);
      if (!s) return;
      const dy = (resizeInfo.startY - e.clientY) / zoom;
      updateSubject(resizeInfo.id, { scale: getScaleForGroundToTopPx(s, resizeInfo.initH + dy) });
    } else if (anchorInfo) {
      const s = subjects.find(x => x.id === anchorInfo.id);
      const workspace = workspaceRef.current;
      if (!s || !workspace) return;
      const rect = workspace.getBoundingClientRect();
      const point = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
      const update = anchorInfo.kind === 'head'
        ? getHeadUpdateForCanvasPoint(s, floorY, point)
        : getAnchorUpdateForCanvasPoint(s, floorY, point);
      updateSubject(anchorInfo.id, update);
    }
  }, [dragInfo, resizeInfo, anchorInfo, zoom, canvasW, floorY, subjects, updateSubject]);

  const onDragUp = useCallback(() => {
    setDragInfo(null);
    setResizeInfo(null);
    setAnchorInfo(null);
    setIsSnapping(false);
    commit();
  }, [commit]);

  useEffect(() => {
    if (!dragInfo && !resizeInfo && !anchorInfo) return;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    return () => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragUp);
    };
  }, [dragInfo, resizeInfo, anchorInfo, onDragMove, onDragUp]);

  useEffect(() => {
    const onKey = (e) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && (key === 'z' || key === 'y') && !isTextField(e.target)) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (e.target.tagName === 'INPUT') return;

      if (selectedId && (e.key === '[' || e.key === ']')) {
        const s = subjects.find(x => x.id === selectedId);
        if (s) {
          const delta = (e.shiftKey ? 0.1 : 0.01) * (e.key === ']' ? 1 : -1);
          updateSubjectH(selectedId, { scale: shiftScale(s, delta) }, `scale-${selectedId}`);
        }
        e.preventDefault();
        return;
      }

      if (!selectedId) return;
      const subj = subjects.find(s => s.id === selectedId);
      if (!subj) return;

      const step = e.shiftKey ? 20 : 2;
      const nudgeKey = `nudge-${selectedId}`;
      if (e.key === 'ArrowLeft')  { updateSubjectH(selectedId, { x: subj.x - step }, nudgeKey); e.preventDefault(); }
      if (e.key === 'ArrowRight') { updateSubjectH(selectedId, { x: subj.x + step }, nudgeKey); e.preventDefault(); }
      if (e.key === 'ArrowUp')    { updateSubjectH(selectedId, { y: subj.y + step }, nudgeKey); e.preventDefault(); }
      if (e.key === 'ArrowDown')  { updateSubjectH(selectedId, { y: subj.y - step }, nudgeKey); e.preventDefault(); }
      if (e.key === 'f' && !mod)  { updateSubjectH(selectedId, { flipX: !subj.flipX }); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSubject(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, subjects, handleUndo, handleRedo, updateSubjectH, removeSubject]);

  const annotationItems = getAnnotationItems({ subjects, selectedId, annotations, floorY, unit });

  const exportCanvas = async () => {
    try {
      const canvas = await renderBoard({
        svgElement: workspaceRef.current?.querySelector(':scope > svg'),
        subjects,
        annotations: annotationItems,
        canvasW,
        canvasH,
        floorY,
      });
      downloadCanvasAsPng(canvas);
    } catch (err) {
      console.error(err);
    }
  };

  const active = subjects.find(s => s.id === selectedId);

  return (
    <div className="flex h-screen bg-[#0d0d0d] text-gray-200 font-sans overflow-hidden select-none">
      {showSettings && (
        <FormatDialog
          canvasW={canvasW}
          canvasH={canvasH}
          onApply={(w, h) => { setCanvasW(w); setCanvasH(h); setShowSettings(false); }}
          onCancel={() => setShowSettings(false)}
        />
      )}

      <div className="flex-1 flex flex-col h-full min-w-0">
        <Toolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
          unit={unit}
          onUnitChange={setUnit}
          annotations={annotations}
          onToggleAnnotations={() => setAnnotations(a => ({ ...a, enabled: !a.enabled }))}
          onScopeChange={(scope) => setAnnotations(a => ({ ...a, scope }))}
          onOpenFormat={() => setShowSettings(true)}
          onImport={handleFileUpload}
          onExport={exportCanvas}
        />

        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-[#1a1a1a] flex items-center justify-center relative"
          style={{ cursor: isSpacePressed ? 'grab' : isPanning ? 'grabbing' : 'default' }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onMouseDown={(e) => {
            if (e.button === 0) {
              if (isSpacePressed || e.target === containerRef.current || e.target === workspaceRef.current) {
                if (!isSpacePressed) setSelectedId(null);
                startPan(e);
              }
            }
          }}
          onDoubleClick={onBackgroundDoubleClick}
        >
          <div
            ref={workspaceRef}
            className="relative bg-[#f2f2f4] shadow-2xl ring-1 ring-gray-600 shrink-0 select-none"
            style={{
              width: canvasW,
              height: canvasH,
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: 'center center'
            }}
          >
            <Grid canvasW={canvasW} canvasH={canvasH} />

            {subjects.map(s => (
              <SubjectView
                key={s.id}
                subject={s}
                floorY={floorY}
                zoom={zoom}
                selected={selectedId === s.id}
                showSnap={dragInfo?.id === s.id && isSnapping}
                onPointerDown={e => handleSubjectPointerDown(e, s.id)}
                onDoubleClick={e => handleSubjectDoubleClick(e, s.id)}
                onResizeStart={(e, handleType) => handleResizePointerDown(e, s.id, handleType)}
                onAnchorStart={(e, kind) => handleAnchorPointerDown(e, s.id, kind)}
              />
            ))}

            <AnnotationsLayer items={annotationItems} canvasW={canvasW} canvasH={canvasH} />

            {subjects.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: canvasH * 0.25 }}>
                <Upload size={64} className="text-gray-400 opacity-10 mb-3" />
                <p className="text-gray-400 text-3xl font-black opacity-10 tracking-widest">GLISSE DES IMAGES ICI</p>
              </div>
            )}
          </div>
        </div>

        <StatusBar
          containerRef={containerRef}
          workspaceRef={workspaceRef}
          zoom={zoom}
          floorY={floorY}
          subjectCount={subjects.length}
          canvasW={canvasW}
          canvasH={canvasH}
        />
      </div>

      <aside className="w-72 bg-[#111] border-l border-gray-800 flex flex-col shrink-0">
        <Inspector
          subject={active}
          unit={unit}
          canvasW={canvasW}
          onPreview={(upd) => updateSubject(selectedId, upd)}
          onApply={(upd) => updateSubjectH(selectedId, upd)}
          onCancelEdit={rollback}
          onEndGesture={commit}
          onBringToFront={() => bringToFront(selectedId)}
          onSendToBack={() => sendToBack(selectedId)}
          onRemove={() => removeSubject(selectedId)}
        />
        <LayersPanel
          subjects={subjects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={removeSubject}
          onRename={handleRename}
        />
      </aside>
    </div>
  );
};

export default MugshotStudio;