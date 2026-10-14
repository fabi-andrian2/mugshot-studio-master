const SessionNotice = ({ phase, problem, saveStatus, restored, onDiscard }) => {
  if (phase === 'loading') {
    return (
      <div
        role="status"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0d0d]/90 text-sm text-gray-300"
      >
        Restauration de la session…
      </div>
    );
  }

  if (phase === 'blocked') {
    return (
      <div
        role="alert"
        className="fixed top-14 left-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2 rounded-md border border-amber-600/60 bg-[#111] px-4 py-3 text-sm text-gray-200 shadow-2xl"
      >
        <p className="font-semibold text-amber-400">Sauvegarde automatique désactivée</p>
        <p className="mt-1 text-gray-300">
          {problem} La session enregistrée est conservée telle quelle et ne sera pas écrasée. Ce
          que tu fais maintenant n'est pas sauvegardé.
        </p>
        <button
          type="button"
          className="mt-2 rounded border border-gray-600 px-3 py-1 text-xs transition hover:bg-[#1c1c1c]"
          onClick={() => {
            if (
              window.confirm(
                "L'état actuel de la planche remplacera définitivement la sauvegarde précédente. Continuer ?",
              )
            ) {
              onDiscard();
            }
          }}
        >
          Démarrer une nouvelle session et réactiver la sauvegarde
        </button>
      </div>
    );
  }

  if (saveStatus?.status === 'error') {
    return (
      <div
        role="alert"
        className="fixed bottom-10 left-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2 rounded-md border border-red-600/60 bg-[#111] px-4 py-3 text-sm text-gray-200 shadow-2xl"
      >
        <p className="font-semibold text-red-400">Sauvegarde automatique impossible</p>
        <p className="mt-1 text-gray-300">
          {saveStatus.error?.message ?? 'Erreur inconnue.'} Ton travail reste ouvert ici mais n'est
          pas enregistré : exporte-le pour ne pas le perdre.
        </p>
      </div>
    );
  }

  const label =
    saveStatus?.status === 'saving'
      ? 'Sauvegarde…'
      : saveStatus?.status === 'saved'
        ? 'Sauvegardé'
        : restored
          ? 'Session restaurée'
          : null;

  if (!label) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-10 left-4 z-40 rounded border border-gray-800 bg-[#111]/90 px-2 py-1 text-[11px] text-gray-400"
    >
      {label}
    </div>
  );
};

export default SessionNotice;