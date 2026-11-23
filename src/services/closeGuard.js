export const FLUSH_TIMEOUT_MS = 10000;

const withTimeout = (promise, ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, error: { code: 'timeout', message: 'Délai dépassé.' } }),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        resolve({ ok: false, error });
      },
    );
  });

/**
 * Gère une demande de fermeture : on bloque d'abord la fermeture native, puis on ne
 * détruit la fenêtre qu'après sauvegarde confirmée ou « quitter sans enregistrer ».
 */
export const createCloseRequestHandler = ({
  flush,
  confirmQuitWithoutSaving,
  destroy,
  timeoutMs = FLUSH_TIMEOUT_MS,
}) => {
  let busy = false;
  return async (event) => {
    event?.preventDefault?.();
    if (busy) return 'busy';
    busy = true;
    try {
      const outcome = await withTimeout(Promise.resolve().then(flush), timeoutMs);
      if (outcome.ok) {
        await destroy();
        return 'closed';
      }
      const quit = await confirmQuitWithoutSaving(outcome.error);
      if (quit) {
        await destroy();
        return 'closed-unsaved';
      }
      return 'stayed';
    } finally {
      busy = false;
    }
  };
};

export const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

/** Installe la garde dans Tauri ; renvoie une fonction de désinstallation. */
export const installTauriCloseGuard = async ({ flush, confirmQuitWithoutSaving }) => {
  if (!isTauriRuntime()) return () => {};
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  const handler = createCloseRequestHandler({
    flush,
    confirmQuitWithoutSaving,
    destroy: () => win.destroy(),
  });
  return win.onCloseRequested(handler);
};

/** Navigateur : avertit quand des modifications ne sont pas encore écrites. */
export const installBeforeUnloadGuard = ({ hasUnsaved, flush }) => {
  const onBeforeUnload = (event) => {
    if (!hasUnsaved()) return;
    flush();
    event.preventDefault();
    event.returnValue = '';
  };
  const onHide = () => {
    flush();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('pagehide', onHide);
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
