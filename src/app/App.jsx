import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload } from 'lucide-react';

import { DEFAULT_W, DEFAULT_H, FLOOR_MARGIN, SNAP_Y, MAX_HIST, DEFAULT_ZOOM } from '../domain/constants.js';
import { getBaseDimensions } from '../domain/geometry.js';
import { areSubjectListsEqual } from '../domain/subjects.js';
import useHistory from '../hooks/useHistory.js';
import Toolbar from '../components/toolbar/Toolbar.jsx';
import Grid from '../components/canvas/Grid.jsx';
import Inspector from '../components/inspector/Inspector.jsx';
import LayersPanel from '../components/layers/LayersPanel.jsx';
import FormatDialog from '../components/dialogs/FormatDialog.jsx';
import StatusBar from '../components/status/StatusBar.jsx';

const HISTORY_OPTIONS = { isEqual: areSubjectListsEqual, limit: MAX_HIST, mergeWindowMs: 500 };

const isTextField = (el) =>
  el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'range');

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
    patchAll,
    canUndo,
    canRedo,
  } = useHistory([], HISTORY_OPTIONS);
  const [selectedId, setSelectedId] = useState(null);

  const [dragInfo, setDragInfo] = useState(null);
  const [resizeInfo, setResizeInfo] = useState(null);

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [panInfo, setPanInfo] = useState(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const [showSettings, setShowSettings] = useState(false);

  const workspaceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPanX(0);
    setPanY(0);
  }, []);

  const handleDoubleClickBackground = useCallback((e) => {
    if (e.target === containerRef.current || e.target === workspaceRef.current) {
      if (zoom !== DEFAULT_ZOOM || panX !== 0 || panY !== 0) {
        resetView();
      } else {
        setZoom(0.8);
        setPanX(0);
        setPanY(0);
      }
    }
  }, [zoom, panX, panY, resetView]);

  const gestureActive = !!dragInfo || !!resizeInfo;

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

  const handleImageLoad = useCallback((id, naturalW, naturalH) => {
    patchAll(list => {
      const needsPatch = list.some(s => s.id === id && (s.naturalW !== naturalW || s.naturalH !== naturalH));
      return needsPatch
        ? list.map(s => s.id === id ? { ...s, naturalW, naturalH } : s)
        : list;
    });
  }, [patchAll]);

  const handleFileUpload = useCallback((files) => {
    const arr = Array.from(files).map((f, i) => ({
      id: Date.now() + Math.random(),
      url: URL.createObjectURL(f),
      x: (canvasW / 2) - 150 + (subjects.length + i) * 50,
      y: 0,
      scale: 0.8,
      flipX: false,
      zIndex: subjects.length + i + 1,
      name: f.name,
      naturalW: null,
      naturalH: null,
    }));
    if (!arr.length) return;
    apply(list => [...list, ...arr]);
    setSelectedId(arr[0].id);
  }, [subjects, apply, canvasW]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const removeSubject = useCallback((id) => {
    apply(list => list.filter(s => s.id !== id));
    setSelectedId(current => (current === id ? null : current));
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
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = subjects.find(x => x.id === id);
    const { h: unscaledH } = getBaseDimensions(s, floorY);
    setResizeInfo({
      id,
      handleType,
      startX: e.clientX,
      startY: e.clientY,
      initScale: s.scale,
      initH: unscaledH * s.scale
    });
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
      const { h: unscaledH } = getBaseDimensions(s, floorY);
      const dy = (resizeInfo.startY - e.clientY) / zoom;
      let newH = resizeInfo.initH + dy;
      newH = Math.max(50, newH);
      const newScale = newH / unscaledH;
      updateSubject(resizeInfo.id, { scale: newScale });
    }
  }, [dragInfo, resizeInfo, zoom, canvasW, floorY, subjects, updateSubject]);

  const onDragUp = useCallback(() => {
    setDragInfo(null);
    setResizeInfo(null);
    setIsSnapping(false);
    commit();
  }, [commit]);

  useEffect(() => {
    if (!dragInfo && !resizeInfo) return;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    return () => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragUp);
    };
  }, [dragInfo, resizeInfo, onDragMove, onDragUp]);

  const startPan = (e) => {
    if (e.button !== 0) return;
    setPanInfo({
      startX: e.clientX,
      startY: e.clientY,
      initPanX: panX,
      initPanY: panY
    });
  };

  const onPanMove = useCallback((e) => {
    if (!panInfo) return;
    setPanX(panInfo.initPanX + (e.clientX - panInfo.startX));
    setPanY(panInfo.initPanY + (e.clientY - panInfo.startY));
  }, [panInfo]);

  const onPanUp = useCallback(() => setPanInfo(null), []);

  useEffect(() => {
    if (!panInfo) return;
    window.addEventListener('mousemove', onPanMove);
    window.addEventListener('mouseup',   onPanUp);
    return () => {
      window.removeEventListener('mousemove', onPanMove);
      window.removeEventListener('mouseup', onPanUp);
    };
  }, [panInfo, onPanMove, onPanUp]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = e => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(z => Math.max(0.1, Math.min(1.5, z + (e.deltaY < 0 ? 0.05 : -0.05))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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

      if (selectedId && e.key === '[') {
        const s = subjects.find(x => x.id === selectedId);
        if (s) updateSubjectH(selectedId, { scale: Math.max(0.05, s.scale - (e.shiftKey ? 0.1 : 0.01)) }, `scale-${selectedId}`);
        e.preventDefault(); return;
      }
      if (selectedId && e.key === ']') {
        const s = subjects.find(x => x.id === selectedId);
        if (s) updateSubjectH(selectedId, { scale: Math.min(4, s.scale + (e.shiftKey ? 0.1 : 0.01)) }, `scale-${selectedId}`);
        e.preventDefault(); return;
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

  const exportCanvas = async () => {
    const was = selectedId;
    setSelectedId(null);
    await new Promise(r => setTimeout(r, 120));
    try {
      const cv  = document.createElement('canvas');
      cv.width  = canvasW; cv.height = canvasH;
      const ctx = cv.getContext('2d');

      ctx.fillStyle = '#f2f2f4';
      ctx.fillRect(0, 0, canvasW, canvasH);

      const svgEl = workspaceRef.current?.querySelector('svg');
      if (svgEl) {
        const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], { type: 'image/svg+xml;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        await new Promise(res => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0, canvasW, canvasH); URL.revokeObjectURL(url); res(); };
          img.src = url;
        });
      }

      for (const s of [...subjects].sort((a, b) => a.zIndex - b.zIndex)) {
        await new Promise(res => {
          const img = new Image();
          img.onload = () => {
            const maxH = floorY * 0.95;
            const unscaledH = Math.min(img.naturalHeight, maxH);
            const unscaledW = img.naturalWidth * (unscaledH / img.naturalHeight);

            const rW = unscaledW * s.scale;
            const rH = unscaledH * s.scale;

            const centerX = s.x + unscaledW / 2;
            const centerY = floorY - s.y;

            ctx.save();
            ctx.translate(centerX, centerY);
            if (s.flipX) ctx.scale(-1, 1);
            ctx.drawImage(img, -rW / 2, -rH, rW, rH);
            ctx.restore();
            res();
          };
          img.src = s.url;
        });
      }

      const a = document.createElement('a');
      a.download = `Mugshot_Studio_${Date.now()}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
    } catch (err) { console.error(err); }
    setSelectedId(was);
  };

  const active    = subjects.find(s => s.id === selectedId);
  const isPanning = !!panInfo || isSpacePressed;

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
          onZoomIn={() => setZoom(z => Math.min(1.5, z + 0.06))}
          onZoomOut={() => setZoom(z => Math.max(0.1, z - 0.06))}
          onResetView={resetView}
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
                setSelectedId(null);
                startPan(e);
              }
            }
          }}
          onDoubleClick={handleDoubleClickBackground}
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

            {subjects.map(s => {
              const sel  = selectedId === s.id;
              const drag = dragInfo?.id === s.id;

              const { w: unscaledW, h: unscaledH } = getBaseDimensions(s, floorY);

              return (
                <div key={s.id}
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => handleSubjectPointerDown(e, s.id)}
                  onDoubleClick={e => handleSubjectDoubleClick(e, s.id)}
                  className="absolute will-change-transform"
                  style={{
                    left: s.x,
                    bottom: (canvasH - floorY) + s.y,
                    width: unscaledW,
                    height: unscaledH,
                    transformOrigin: 'bottom center',
                    transform: `scale(${s.scale}) scaleX(${s.flipX ? -1 : 1})`,
                    zIndex: s.zIndex,
                  }}
                >
                  <img src={s.url} alt={s.name} draggable="false"
                    className="block pointer-events-none drop-shadow-2xl w-full h-full"
                    onLoad={e => handleImageLoad(s.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                  />

                  {sel && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 99999 }}>
                      <div className="absolute inset-0 border-[3px] border-emerald-400 pointer-events-none" />

                      <div
                        onPointerDown={e => handleResizePointerDown(e, s.id, 'top-center')}
                        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-[3px] border-emerald-400 rounded-full cursor-ns-resize pointer-events-auto"
                        title="Faire glisser pour redimensionner"
                      />

                      <div
                        onPointerDown={e => handleResizePointerDown(e, s.id, 'top-left')}
                        className="absolute -top-2 -left-2 w-4 h-4 bg-white border-[3px] border-emerald-400 rounded-full cursor-nwse-resize pointer-events-auto"
                      />

                      <div
                        onPointerDown={e => handleResizePointerDown(e, s.id, 'top-right')}
                        className="absolute -top-2 -right-2 w-4 h-4 bg-white border-[3px] border-emerald-400 rounded-full cursor-nesw-resize pointer-events-auto"
                      />
                    </div>
                  )}

                  {drag && isSnapping && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-50 shadow-md">
                      📌 AIMANTÉ AU SOL
                    </div>
                  )}
                </div>
              );
            })}

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
        />
      </aside>
    </div>
  );
};

export default MugshotStudio;