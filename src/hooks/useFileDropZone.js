import { useCallback, useRef, useState } from 'react';
import { dragCarriesFiles, getDropSummary } from '../domain/fileDrop.js';

const useFileDropZone = ({ onFiles }) => {
  const depth = useRef(0);
  const [summary, setSummary] = useState(null);

  const showSummary = useCallback((items) => {
    const next = getDropSummary(items);
    setSummary((current) =>
      current && current.state === next.state && current.ignored === next.ignored ? current : next,
    );
  }, []);

  const onDragEnter = useCallback((e) => {
    if (!dragCarriesFiles(e.dataTransfer?.types)) return;
    e.preventDefault();
    depth.current += 1;
    showSummary(e.dataTransfer.items);
  }, [showSummary]);

  const onDragOver = useCallback((e) => {
    if (!dragCarriesFiles(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    showSummary(e.dataTransfer.items);
  }, [showSummary]);

  const onDragLeave = useCallback((e) => {
    if (!dragCarriesFiles(e.dataTransfer?.types)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setSummary(null);
  }, []);

  const onDrop = useCallback(
    (e) => {
      if (!dragCarriesFiles(e.dataTransfer?.types)) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setSummary(null);
      onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  return {
    dropState: summary?.state ?? null,
    ignoredCount: summary?.ignored ?? 0,
    dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
};

export default useFileDropZone;