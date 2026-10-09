import { useCallback, useEffect, useState } from 'react';

const isActive = () => Boolean(document.fullscreenElement);

const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(isActive);
  const isSupported = document.fullscreenEnabled === true;

  useEffect(() => {
    const sync = () => setIsFullscreen(isActive());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error(error);
    }
  }, []);

  return { isFullscreen, isSupported, toggleFullscreen };
};

export default useFullscreen;