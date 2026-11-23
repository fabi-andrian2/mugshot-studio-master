import useProjectLibrary from '../hooks/useProjectLibrary.js';
import HomeScreen from '../components/home/HomeScreen.jsx';
import ConfirmDialog from '../components/home/ConfirmDialog.jsx';
import { describeSaveError } from '../services/projectSaver.js';
import MugshotStudio from './App.jsx';

const ProjectShell = () => {
  const lib = useProjectLibrary();
  const { phase, session, leavePrompt } = lib;

  if (phase === 'loading') {
    return (
      <div
        role="status"
        className="h-screen flex items-center justify-center bg-[#0d0d0d] text-sm text-gray-400"
      >
        Chargement de la bibliothèque…
      </div>
    );
  }

  if (phase === 'fatal') {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d0d0d] px-6">
        <div role="alert" className="max-w-md rounded-lg border border-red-700/60 bg-[#111] p-5 text-sm text-gray-200">
          <p className="font-semibold text-red-300 mb-1">Stockage inaccessible</p>
          <p className="text-gray-400 text-xs leading-relaxed">{lib.fatal}</p>
        </div>
      </div>
    );
  }

  const prompt = leavePrompt && (
    <ConfirmDialog
      title="Les dernières modifications ne sont pas enregistrées"
      message={`${describeSaveError(leavePrompt.error)} ${
        leavePrompt.closing
          ? 'Vous pouvez rester dans l’application pour réessayer, ou quitter en perdant ces modifications.'
          : 'Vous pouvez réessayer, rester dans le projet, ou revenir à l’accueil en perdant ces modifications.'
      }`}
      cancelLabel="Rester dans le projet"
      confirmLabel={leavePrompt.closing ? 'Quitter sans enregistrer' : 'Accueil sans enregistrer'}
      extraLabel={leavePrompt.closing ? undefined : 'Réessayer'}
      onCancel={() => (leavePrompt.closing ? lib.resolveClosePrompt(false) : lib.resolveLeave('stay'))}
      onExtra={() => lib.resolveLeave('retry')}
      onConfirm={() => (leavePrompt.closing ? lib.resolveClosePrompt(true) : lib.resolveLeave('discard'))}
    />
  );

  if (phase === 'editor' && session) {
    return (
      <>
        <MugshotStudio
          key={session.id}
          project={{ id: session.id, name: session.meta.name, initialState: session.initialState }}
          saver={session.saver}
          saveStatus={lib.saveStatus}
          controlsRef={lib.controlsRef}
          onHome={lib.goHome}
          onSaveNow={lib.saveNow}
          onRenameProject={(name) => lib.renameProject(session.id, name)}
          onThumbnail={lib.saveThumbnail}
        />
        {prompt}
      </>
    );
  }

  return (
    <>
      <HomeScreen
        projects={lib.projects}
        lastProjectId={lib.lastProjectId}
        notice={lib.notice}
        busy={lib.busy}
        onDismissNotice={lib.dismissNotice}
        onCreate={lib.createProject}
        onOpen={lib.openProject}
        onRename={lib.renameProject}
        onDuplicate={lib.duplicateProject}
        onDelete={lib.deleteProject}
      />
      {prompt}
    </>
  );
};

export default ProjectShell;
