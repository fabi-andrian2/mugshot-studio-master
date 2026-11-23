import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Applique l'état du projet à l'ouverture (avant le premier affichage), puis notifie
 * le saver à chaque modification réelle. L'ouverture seule n'écrit rien.
 */
const useProjectPersistence = ({ saver, initialState, onRestore, snapshot }) => {
  const [ready, setReady] = useState(false);
  const appliedRef = useRef(false);
  const touchedRef = useRef(false);

  useLayoutEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    onRestore(initialState);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { subjects, canvasW, canvasH, unit, board, annotations, shadows, mannequin, measureItems } =
    snapshot;

  useEffect(() => {
    if (!ready) return;
    if (!touchedRef.current) {
      const unchanged =
        subjects === initialState.subjects &&
        board === initialState.board &&
        annotations === initialState.annotations &&
        shadows === initialState.shadows &&
        mannequin === initialState.mannequin &&
        measureItems === initialState.measure.items &&
        canvasW === initialState.canvasW &&
        canvasH === initialState.canvasH &&
        unit === initialState.unit;
      if (unchanged) return;
      touchedRef.current = true;
    }
    saver.notify({
      subjects,
      canvasW,
      canvasH,
      unit,
      board,
      annotations,
      shadows,
      mannequin,
      measure: { items: measureItems },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, subjects, canvasW, canvasH, unit, board, annotations, shadows, mannequin, measureItems]);

  return { ready };
};

export default useProjectPersistence;
