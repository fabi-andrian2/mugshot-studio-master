import { useCallback, useEffect, useRef, useState } from 'react';
import { createSessionManager } from '../services/sessionManager.js';

const useSessionPersistence = ({
  subjects,
  canvasW,
  canvasH,
  unit,
  board,
  annotations,
  mannequin,
  measureItems,
  onRestore,
}) => {
  const [phase, setPhase] = useState('loading');
  const [problem, setProblem] = useState('');
  const [saveStatus, setSaveStatus] = useState({ status: 'idle' });
  const [restored, setRestored] = useState(false);
  const managerRef = useRef(null);
  const onRestoreRef = useRef(onRestore);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    const manager = createSessionManager({
      onRestore: (state) => {
        onRestoreRef.current(state);
        setRestored(true);
      },
      onPhase: setPhase,
      onProblem: setProblem,
      onSaveStatus: setSaveStatus,
    });
    managerRef.current = manager;
    manager.init();
    return () => {
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    managerRef.current?.notify({
      subjects,
      canvasW,
      canvasH,
      unit,
      board,
      annotations,
      mannequin,
      measure: { items: measureItems },
    });
  }, [subjects, canvasW, canvasH, unit, board, annotations, mannequin, measureItems]);

  useEffect(() => {
    const flush = () => {
      managerRef.current?.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const discardSavedSession = useCallback(() => managerRef.current?.discard(), []);

  return { phase, problem, saveStatus, restored, discardSavedSession };
};

export default useSessionPersistence;