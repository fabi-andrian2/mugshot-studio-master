import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_ZOOM } from '../domain/constants.js';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 1.5;
const BUTTON_ZOOM_FACTOR = 1.2;
const WHEEL_ZOOM_FACTOR = 1.1;
const QUICK_ZOOM = 0.8;
const FIT_PADDING = 40;

const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

const zoomAround = (view, nextZoom, offsetX, offsetY) => {
  const ratio = nextZoom / view.zoom;
  return {
    zoom: nextZoom,
    panX: offsetX - (offsetX - view.panX) * ratio,
    panY: offsetY - (offsetY - view.panY) * ratio,
  };
};

const useCanvasNavigation = ({ containerRef, workspaceRef }) => {
  const [view, setView] = useState({ zoom: DEFAULT_ZOOM, panX: 0, panY: 0 });
  const [panInfo, setPanInfo] = useState(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const viewRef = useRef(view);

  const { zoom, panX, panY } = view;

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const commitView = useCallback((next) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const resetView = useCallback(() => {
    commitView({ zoom: DEFAULT_ZOOM, panX: 0, panY: 0 });
  }, [commitView]);

  const zoomBy = useCallback((factor) => {
    const current = viewRef.current;
    commitView(zoomAround(current, clampZoom(current.zoom * factor), 0, 0));
  }, [commitView]);

  const zoomIn = useCallback(() => zoomBy(BUTTON_ZOOM_FACTOR), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / BUTTON_ZOOM_FACTOR), [zoomBy]);

  const fitToScreen = useCallback((canvasW, canvasH) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fitZoom = Math.min(
      (rect.width - 2 * FIT_PADDING) / canvasW,
      (rect.height - 2 * FIT_PADDING) / canvasH,
    );
    commitView({ zoom: clampZoom(fitZoom), panX: 0, panY: 0 });
  }, [containerRef, commitView]);

  const startPan = useCallback((e) => {
    if (e.button !== 0) return;
    setPanInfo({ startX: e.clientX, startY: e.clientY, initPanX: panX, initPanY: panY });
  }, [panX, panY]);

  const onBackgroundDoubleClick = useCallback((e) => {
    if (e.target !== containerRef.current && e.target !== workspaceRef.current) return;
    if (zoom !== DEFAULT_ZOOM || panX !== 0 || panY !== 0) {
      resetView();
    } else {
      commitView({ zoom: QUICK_ZOOM, panX: 0, panY: 0 });
    }
  }, [containerRef, workspaceRef, zoom, panX, panY, resetView, commitView]);

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

  useEffect(() => {
    if (!panInfo) return;
    const onMove = (e) => {
      commitView({
        zoom: viewRef.current.zoom,
        panX: panInfo.initPanX + (e.clientX - panInfo.startX),
        panY: panInfo.initPanY + (e.clientY - panInfo.startY),
      });
    };
    const onUp = () => setPanInfo(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panInfo, commitView]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const current = viewRef.current;
      const nextZoom = clampZoom(current.zoom * (e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR));
      const rect = el.getBoundingClientRect();
      const offsetX = e.clientX - (rect.left + rect.width / 2);
      const offsetY = e.clientY - (rect.top + rect.height / 2);
      commitView(zoomAround(current, nextZoom, offsetX, offsetY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, commitView]);

  return {
    zoom,
    panX,
    panY,
    isSpacePressed,
    isPanning: !!panInfo || isSpacePressed,
    zoomIn,
    zoomOut,
    resetView,
    fitToScreen,
    startPan,
    onBackgroundDoubleClick,
  };
};

export default useCanvasNavigation;