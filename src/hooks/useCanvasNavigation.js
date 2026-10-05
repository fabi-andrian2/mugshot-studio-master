import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ZOOM } from '../domain/constants.js';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 1.5;
const BUTTON_ZOOM_STEP = 0.06;
const WHEEL_ZOOM_STEP = 0.05;
const QUICK_ZOOM = 0.8;

const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

const useCanvasNavigation = ({ containerRef, workspaceRef }) => {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [panInfo, setPanInfo] = useState(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPanX(0);
    setPanY(0);
  }, []);

  const zoomIn = useCallback(() => setZoom(z => clampZoom(z + BUTTON_ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom(z => clampZoom(z - BUTTON_ZOOM_STEP)), []);

  const startPan = useCallback((e) => {
    if (e.button !== 0) return;
    setPanInfo({ startX: e.clientX, startY: e.clientY, initPanX: panX, initPanY: panY });
  }, [panX, panY]);

  const onBackgroundDoubleClick = useCallback((e) => {
    if (e.target !== containerRef.current && e.target !== workspaceRef.current) return;
    if (zoom !== DEFAULT_ZOOM || panX !== 0 || panY !== 0) {
      resetView();
    } else {
      setZoom(QUICK_ZOOM);
      setPanX(0);
      setPanY(0);
    }
  }, [containerRef, workspaceRef, zoom, panX, panY, resetView]);

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
      setPanX(panInfo.initPanX + (e.clientX - panInfo.startX));
      setPanY(panInfo.initPanY + (e.clientY - panInfo.startY));
    };
    const onUp = () => setPanInfo(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panInfo]);

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
      setZoom(z => clampZoom(z + (e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef]);

  return {
    zoom,
    panX,
    panY,
    isSpacePressed,
    isPanning: !!panInfo || isSpacePressed,
    zoomIn,
    zoomOut,
    resetView,
    startPan,
    onBackgroundDoubleClick,
  };
};

export default useCanvasNavigation;