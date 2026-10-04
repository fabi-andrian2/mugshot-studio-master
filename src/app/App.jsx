import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Trash2, Download, Ruler,
  FlipHorizontal, Layers, Settings2,
  Image as ImageIcon, ArrowUp, ArrowDown,
  ZoomIn, ZoomOut, Info, RotateCcw, RotateCw, Maximize2
} from 'lucide-react';

import { DEFAULT_W, DEFAULT_H, FLOOR_MARGIN, SNAP_Y, MAX_HIST, DEFAULT_ZOOM } from '../domain/constants.js';
import { getBaseDimensions } from '../domain/geometry.js';
import NumField from '../components/inspector/NumField.jsx';
import Grid from '../components/canvas/Grid.jsx';
import FormatDialog from '../components/dialogs/FormatDialog.jsx';
import StatusBar from '../components/status/StatusBar.jsx';


// ─────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────
const MugshotStudio = () => {
  const [canvasW, setCanvasW] = useState(DEFAULT_W);
  const [canvasH, setCanvasH] = useState(DEFAULT_H);
  const floorY = canvasH - FLOOR_MARGIN;

  const [subjects,   setSubjects]   = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history,    setHistory]    = useState([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Drag d'un sujet
  const [dragInfo, setDragInfo]   = useState(null);
  // Resize manuel via les poignées vertes
  const [resizeInfo, setResizeInfo] = useState(null);
  
  // Pan de la vue (Coordonnées infinies style Photoshop)
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [panInfo, setPanInfo] = useState(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const [showSettings, setShowSettings] = useState(false);
  const workspaceRef = useRef(null);
  const containerRef = useRef(null);

  // Écoute de la touche Espace pour le raccourci de navigation pro
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

  // ── Reset vue (zoom + position) ──
  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPanX(0);
    setPanY(0);
  }, []);

  // Double-clic intelligent : réinitialise OU zoom à 80%
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

  // ─────────────────────────────────────────────
  // HISTORIQUE
  // ─────────────────────────────────────────────
  const pushHistory = useCallback((snap) => {
    setHistory(prev => {
      const next = [...prev.slice(0, historyIdx + 1), snap];
      return next.length > MAX_HIST ? next.slice(1) : next;
    });
    setHistoryIdx(i => Math.min(i + 1, MAX_HIST - 1));
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const i = historyIdx - 1;
    setHistoryIdx(i);
    setSubjects(history[i] || []);
    setSelectedId(null);
  }, [historyIdx, history]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const i = historyIdx + 1;
    setHistoryIdx(i);
    setSubjects(history[i]);
    setSelectedId(null);
  }, [historyIdx, history]);

  // ─────────────────────────────────────────────
  // UPDATE SUJETS (Temps réel et historique)
  // ─────────────────────────────────────────────
  const updateSubject = useCallback((id, upd) => {
    setSubjects(p => p.map(s => s.id === id ? { ...s, ...upd } : s));
  }, []);

  const updateSubjectH = useCallback((id, upd) => {
    setSubjects(prev => {
      pushHistory(prev);
      return prev.map(s => s.id === id ? { ...s, ...upd } : s);
    });
  }, [pushHistory]);


  // ─────────────────────────────────────────────
  // IMPORTATION
  // ─────────────────────────────────────────────
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
    setSubjects(p => { pushHistory(p); return [...p, ...arr]; });
    if (arr.length) setSelectedId(arr[0].id);
  }, [subjects, pushHistory, canvasW]);

  const handleDrop = (e) => { 
    e.preventDefault(); 
    handleFileUpload(e.dataTransfer.files); 
  };

  // ─────────────────────────────────────────────
  // CALQUES
  // ─────────────────────────────────────────────
  const bringToFront = id => { const m = Math.max(...subjects.map(s => s.zIndex), 0); updateSubjectH(id, { zIndex: m + 1 }); };
  const sendToBack   = id => { const m = Math.min(...subjects.map(s => s.zIndex), 1); updateSubjectH(id, { zIndex: m - 1 }); };

  // ─────────────────────────────────────────────
  // MOUVEMENT ET DRAG DES SUJETS
  // ─────────────────────────────────────────────
  const handleSubjectPointerDown = (e, id) => {
    if (e.button !== 0 || isSpacePressed) return; 
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    pushHistory(subjects);
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
    pushHistory(subjects);
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

      // Permettre de dépasser à l'extrême gauche / droite sans limite
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
  }, []);

  useEffect(() => {
    if (!dragInfo && !resizeInfo) return;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    return () => { 
      window.removeEventListener('pointermove', onDragMove); 
      window.removeEventListener('pointerup', onDragUp); 
    };
  }, [dragInfo, resizeInfo, onDragMove, onDragUp]);

  // ─────────────────────────────────────────────
  // NAVIGATION LIBRE (PANNING)
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // ZOOM MOLETTE
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // RACCOURCIS CLAVIER
  // ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }

      if (e.target.tagName === 'INPUT') return;

      if (selectedId && e.key === '[') {
        const s = subjects.find(x => x.id === selectedId);
        if (s) updateSubjectH(selectedId, { scale: Math.max(0.05, s.scale - (e.shiftKey ? 0.1 : 0.01)) });
        e.preventDefault(); return;
      }
      if (selectedId && e.key === ']') {
        const s = subjects.find(x => x.id === selectedId);
        if (s) updateSubjectH(selectedId, { scale: Math.min(4, s.scale + (e.shiftKey ? 0.1 : 0.01)) });
        e.preventDefault(); return;
      }

      if (!selectedId) return;
      const subj = subjects.find(s => s.id === selectedId);
      if (!subj) return;

      const step = e.shiftKey ? 20 : 2;
      if (e.key === 'ArrowLeft')  { updateSubjectH(selectedId, { x: subj.x - step }); e.preventDefault(); }
      if (e.key === 'ArrowRight') { updateSubjectH(selectedId, { x: subj.x + step }); e.preventDefault(); }
      if (e.key === 'ArrowUp')    { updateSubjectH(selectedId, { y: subj.y + step }); e.preventDefault(); } 
      if (e.key === 'ArrowDown')  { updateSubjectH(selectedId, { y: subj.y - step }); e.preventDefault(); }
      if (e.key === 'f')          { updateSubjectH(selectedId, { flipX: !subj.flipX }); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setSubjects(p => { pushHistory(p); return p.filter(s => s.id !== selectedId); });
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, subjects, undo, redo, updateSubjectH, pushHistory]);

  // ─────────────────────────────────────────────
  // EXPORT COHÉRENT ET SYNCHRONISÉ (0 décalage)
  // ─────────────────────────────────────────────
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


  const active     = subjects.find(s => s.id === selectedId);
  const canUndo    = historyIdx > 0;
  const canRedo    = historyIdx < history.length - 1;
  const isPanning  = !!panInfo || isSpacePressed;


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

      {/* ══ ZONE PRINCIPALE ══ */}
      <div className="flex-1 flex flex-col h-full min-w-0">

        {/* Barre d'outils du haut */}
        <header className="h-14 border-b border-gray-800 bg-[#111] flex items-center justify-between px-5 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <Ruler size={17} className="text-emerald-400"/>
            <span className="font-black tracking-[0.2em] text-sm">MUGSHOT <span className="text-emerald-400">STUDIO</span></span>
          </div>

          <div className="flex items-center gap-2">
            {/* Historique */}
            <div className="flex items-center bg-gray-800/60 border border-gray-700 rounded-md overflow-hidden">
              <button onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)"
                className="px-2.5 py-2 hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition"><RotateCcw size={13}/></button>
              <button onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)"
                className="px-2.5 py-2 hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed border-l border-gray-700 transition"><RotateCw size={13}/></button>
            </div>

            {/* Contrôle de zoom */}
            <div className="flex items-center gap-0.5 bg-gray-800/60 border border-gray-700 rounded-md px-1">
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.06))} className="p-1.5 hover:text-white transition"><ZoomOut size={13}/></button>
              <button onClick={resetView} title="Double-cliquer sur le fond pour réinitialiser"
                className="w-12 text-center text-xs font-mono hover:text-emerald-400 transition py-1">{Math.round(zoom*100)}%</button>
              <button onClick={() => setZoom(z => Math.min(1.5, z + 0.06))} className="p-1.5 hover:text-white transition"><ZoomIn size={13}/></button>
            </div>

            {/* Ajustement Format */}
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-md text-xs transition">
              <Maximize2 size={12}/> Format
            </button>

            {/* Bouton d'importation */}
            <label className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-md cursor-pointer text-xs font-semibold border border-gray-600 transition">
              <Upload size={12}/> Importer
              <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileUpload(e.target.files)}/>
            </label>

            {/* Bouton d'exportation */}
            <button onClick={exportCanvas}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-md text-xs font-semibold transition">
              <Download size={12}/> Exporter HD
            </button>
          </div>
        </header>

        {/* Espace de travail de l'éditeur */}
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
          {/* Canvas de montage transformable */}
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

            {/* AFFICHAGE DES SUJETS (IMAGES PNG TRANSPARENTES) */}
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
                    onLoad={e => updateSubject(s.id, { naturalW: e.currentTarget.naturalWidth, naturalH: e.currentTarget.naturalHeight })}
                  />

                  {/* Poignées vertes interactives style Photoshop */}
                  {sel && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 99999 }}>
                      {/* Lignes de contour */}
                      <div className="absolute inset-0 border-[3px] border-emerald-400 pointer-events-none" />
                      
                      {/* Poignée supérieure centrale */}
                      <div 
                        onPointerDown={e => handleResizePointerDown(e, s.id, 'top-center')}
                        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-[3px] border-emerald-400 rounded-full cursor-ns-resize pointer-events-auto" 
                        title="Faire glisser pour redimensionner"
                      />

                      {/* Poignée supérieure gauche */}
                      <div 
                        onPointerDown={e => handleResizePointerDown(e, s.id, 'top-left')}
                        className="absolute -top-2 -left-2 w-4 h-4 bg-white border-[3px] border-emerald-400 rounded-full cursor-nwse-resize pointer-events-auto" 
                      />

                      {/* Poignée supérieure droite */}
                      <div 
                        onPointerDown={e => handleResizePointerDown(e, s.id, 'top-right')}
                        className="absolute -top-2 -right-2 w-4 h-4 bg-white border-[3px] border-emerald-400 rounded-full cursor-nesw-resize pointer-events-auto" 
                      />
                    </div>
                  )}

                  {/* Bulle magnétique "Sol" */}
                  {drag && isSnapping && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-50 shadow-md">
                      📌 AIMANTÉ AU SOL
                    </div>
                  )}
                </div>
              );
            })}

            {subjects.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{paddingTop: canvasH*0.25}}>
                <Upload size={64} className="text-gray-400 opacity-10 mb-3"/>
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

      {/* ══ CONTRÔLES DE L'INSPECTEUR (PANNEAU DROIT) ══ */}
      <aside className="w-72 bg-[#111] border-l border-gray-800 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#151515]">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Settings2 size={11}/> Inspecteur
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {active ? (
            <div className="space-y-5">
              <p className="text-[11px] text-gray-500 truncate border-b border-gray-800 pb-3" title={active.name}>📁 {active.name}</p>

              {/* TRANSFORMATION MANUELLE */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Transformation</h3>

                {/* Champ Figma d'Échelle */}
                <div className="space-y-1.5">
                  <NumField
                    label="Échelle %"
                    value={parseFloat((active.scale * 100).toFixed(1))}
                    step={1}
                    min={5}
                    max={400}
                    decimals={1}
                    unit="%"
                    onChange={v => updateSubject(selectedId, { scale: v / 100 })}
                    onCommit={v => updateSubjectH(selectedId, { scale: v / 100 })}
                  />

                  {/* Curseur de contrôle en continu */}
                  <div className="flex items-center gap-2">
                    <input 
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.01"
                      className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      value={active.scale}
                      onChange={e => updateSubject(selectedId, { scale: parseFloat(e.target.value) })}
                      onMouseUp={e => updateSubjectH(selectedId, { scale: parseFloat(e.target.value) })}
                      onTouchEnd={e => updateSubjectH(selectedId, { scale: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-700">Molette / [ ] pour ±1%</span>
                    <button onClick={() => updateSubjectH(selectedId, { scale: 1 })}
                      className="text-[10px] text-gray-600 hover:text-emerald-400 transition">
                      Reset 100%
                    </button>
                  </div>
                </div>

                <hr className="border-gray-800/60"/>

                {/* Champ Figma de Position X */}
                <NumField
                  label="Position X (px)"
                  value={Math.round(active.x)}
                  step={1} min={-canvasW} max={canvasW * 2}
                  onChange={v => updateSubject(selectedId, { x: v })}
                  onCommit={v => updateSubjectH(selectedId, { x: v })}
                />

                {/* Champ Figma de Position Y */}
                <NumField
                  label="Position Y (0 = Sol)"
                  value={Math.round(active.y)}
                  step={1}
                  onChange={v => updateSubject(selectedId, { y: v })}
                  onCommit={v => updateSubjectH(selectedId, { y: v })}
                />

                {/* Ré-aimantation rapide au sol */}
                <button 
                  onClick={() => updateSubjectH(selectedId, { y: 0 })}
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs py-1.5 rounded text-gray-300 transition"
                >
                  Recaler au sol (0cm)
                </button>

                <hr className="border-gray-800/60"/>

                {/* Miroir horizontal */}
                <button onClick={() => updateSubjectH(selectedId, { flipX: !active.flipX })}
                  className={`w-full text-xs py-2 rounded border flex items-center justify-center gap-2 transition ${
                    active.flipX ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                  }`}>
                  <FlipHorizontal size={12}/> Miroir horizontal <span className="text-gray-600 text-[10px]">F</span>
                </button>
              </section>

              <hr className="border-gray-800"/>

              {/* Gestion de la profondeur des Calques */}
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Calques</h3>
                <div className="flex gap-2">
                  <button onClick={() => bringToFront(selectedId)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 py-1.5 rounded text-xs flex justify-center items-center gap-1 transition">
                    <ArrowUp size={11}/> Avancer
                  </button>
                  <button onClick={() => sendToBack(selectedId)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 py-1.5 rounded text-xs flex justify-center items-center gap-1 transition">
                    <ArrowDown size={11}/> Reculer
                  </button>
                </div>
              </section>

              <hr className="border-gray-800"/>

              {/* Bouton de Suppression */}
              <button
                onClick={() => { setSubjects(p => { pushHistory(p); return p.filter(s => s.id !== selectedId); }); setSelectedId(null); }}
                className="w-full bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/30 py-2 rounded text-xs flex items-center justify-center gap-2 transition">
                <Trash2 size={12}/> Supprimer <span className="text-gray-600 text-[10px]">Suppr</span>
              </button>

              {/* Panneau d'aide et Raccourcis */}
              <div className="bg-[#161616] border border-gray-800 rounded p-3 space-y-1.5 text-[11px]">
                <p className="text-gray-300 font-semibold flex items-center gap-1 mb-2"><Info size={10}/> Raccourcis Clavier</p>
                <p className="text-gray-600">↑↓←→ <span className="text-gray-500">déplacer ±2px</span></p>
                <p className="text-gray-600">Shift+↑↓ <span className="text-gray-500">déplacer ±20px</span></p>
                <p className="text-gray-600">[ ] <span className="text-gray-500">échelle ±1%</span></p>
                <p className="text-gray-600">Shift+[ ] <span className="text-gray-500">échelle ±10%</span></p>
                <p className="text-gray-600">F <span className="text-gray-500">miroir horizontal</span></p>
                <p className="text-gray-600">Ctrl+Z/Y <span className="text-gray-500">annuler/rétablir</span></p>
                <p className="text-gray-600">Espace + Glisser <span className="text-gray-500">naviguer</span></p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3 pt-16 text-gray-700">
              <ImageIcon size={36} className="opacity-15"/>
              <p className="text-xs">Sélectionnez une image pour voir ses propriétés.</p>
              <p className="text-[11px] text-gray-800">Double-cliquez sur une image pour la sélectionner.</p>
            </div>
          )}
        </div>

        {/* Liste des Sujets sous forme de Calques */}
        <div className="h-44 border-t border-gray-800 flex flex-col bg-[#0f0f0f]">
          <div className="px-4 py-2 border-b border-gray-800 bg-[#151515] shrink-0">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Layers size={11}/> Sujets ({subjects.length})
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {!subjects.length && <p className="text-[11px] text-gray-700 text-center p-4">Aucun sujet importé</p>}
            {[...subjects].sort((a,b) => b.zIndex-a.zIndex).map(s => (
              <div key={s.id} onClick={() => setSelectedId(s.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs border transition ${
                  selectedId===s.id ? 'bg-emerald-900/40 border-emerald-800/50 text-emerald-300' : 'hover:bg-gray-800 text-gray-400 border-transparent'
                }`}>
                <span className="truncate flex-1 mr-2">{s.name}</span>
                <button className="hover:text-red-400 transition shrink-0" onClick={e => {
                  e.stopPropagation();
                  setSubjects(p => { pushHistory(p); return p.filter(x => x.id !== s.id); });
                  if (selectedId===s.id) setSelectedId(null);
                }}><Trash2 size={11}/></button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default MugshotStudio;