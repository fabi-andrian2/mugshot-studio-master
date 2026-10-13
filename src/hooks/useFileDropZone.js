import { useCallback, useRef, useState } from 'react';
import { dragCarriesFiles, getImageDropState } from '../domain/fileDrop.js';

const useFileDropZone = ({ onFiles }) => {
  const depth = useRef(0);
  const [dropState, setDropState] = useState(null);

  const onDragEnter = useCallback((e) => {
    if (!dragCarriesFiles(e.dataTransfer?.types)) return;
    e.preventDefault();
    depth.current += 1;
    setDropState(getImageDropState(e.dataTransfer.items));
  }, []);

  const onDragOver = useCallback((e) => {
    if (!dragCarriesFiles(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropState(getImageDropState(e.dataTransfer.items));
  }, []);

  const onDragLeave = useCallback((e) => {
    if (!dragCarriesFiles(e.dataTransfer?.types)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDropState(null);
  }, []);

  const onDrop = useCallback(
    (e) => {
      if (!dragCarriesFiles(e.dataTransfer?.types)) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setDropState(null);
      onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  return { dropState, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
};

export default useFileDropZone;