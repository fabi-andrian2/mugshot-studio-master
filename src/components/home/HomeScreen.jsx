import { useMemo, useState } from 'react';
import { Plus, Play, Ruler, Search, X } from 'lucide-react';
import ProjectCard from './ProjectCard.jsx';
import NewProjectDialog from './NewProjectDialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {
  filterProjects,
  formatRelativeTime,
  getHomeSections,
  sortProjects,
  suggestProjectName,
} from '../../domain/projects.js';

const SORT_LABELS = [
  { value: 'recent', label: 'Récemment ouverts' },
  { value: 'name', label: 'Nom (A → Z)' },
  { value: 'created', label: 'Date de création' },
];

const NOTICE_STYLES = {
  info: 'border-emerald-700/60 text-emerald-200',
  warning: 'border-amber-600/60 text-amber-200',
  error: 'border-red-700/60 text-red-200',
};

const HomeScreen = ({
  projects,
  lastProjectId,
  notice,
  busy,
  onDismissNotice,
  onCreate,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');

  const { last, recent } = useMemo(
    () => getHomeSections(projects, lastProjectId),
    [projects, lastProjectId],
  );
  const library = useMemo(
    () => sortProjects(filterProjects(projects, query), sort),
    [projects, query, sort],
  );
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const cardProps = { disabled: busy, onOpen, onRename, onDuplicate, onDelete: setToDelete };

  return (
    <div className="h-screen overflow-y-auto bg-[#0d0d0d] text-gray-200 font-sans antialiased">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Ruler size={20} className="text-emerald-400" />
            <span className="font-semibold tracking-[0.2em] text-sm">
              MUGSHOT <span className="text-emerald-400">STUDIO</span>
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
          >
            <Plus size={14} /> Nouveau projet
          </button>
        </header>

        {notice && (
          <div
            role="status"
            className={`mb-6 flex items-start justify-between gap-3 rounded-md border bg-[#111] px-4 py-3 text-xs ${NOTICE_STYLES[notice.kind] ?? NOTICE_STYLES.info}`}
          >
            <span>{notice.message}</span>
            <button type="button" aria-label="Fermer" onClick={onDismissNotice}>
              <X size={14} />
            </button>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 py-20 text-center">
            <p className="text-sm text-gray-300 mb-1">Aucun projet pour l’instant.</p>
            <p className="text-xs text-gray-500 mb-5">
              Chaque projet garde ses propres sujets, mesures et réglages.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition"
            >
              <Plus size={14} /> Créer mon premier projet
            </button>
          </div>
        ) : (
          <>
            {last && (
              <section className="mb-10">
                <h2 className="text-[11px] uppercase tracking-wider text-gray-500 mb-3">
                  Reprendre
                </h2>
                <div className="flex flex-col sm:flex-row gap-5 items-stretch">
                  <div className="w-full sm:w-72 shrink-0">
                    <ProjectCard project={last} highlighted {...cardProps} />
                  </div>
                  <div className="flex flex-col justify-center gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{last.name}</div>
                      <div className="text-xs text-gray-500">
                        Dernière ouverture {formatRelativeTime(last.lastOpenedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onOpen(last.id)}
                      className="self-start flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                    >
                      <Play size={13} /> Reprendre ce projet
                    </button>
                  </div>
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section className="mb-10">
                <h2 className="text-[11px] uppercase tracking-wider text-gray-500 mb-3">
                  Projets récents
                </h2>
                <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                  {recent.map((project) => (
                    <ProjectCard key={project.id} project={project} {...cardProps} />
                  ))}
                </div>
              </section>
            )}

            <section className="mb-10">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="text-[11px] uppercase tracking-wider text-gray-500">
                  Tous les projets ({projects.length})
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher…"
                      aria-label="Rechercher un projet"
                      className="bg-[#151515] border border-gray-800 rounded pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-emerald-700 w-48"
                    />
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Trier les projets"
                    className="bg-[#151515] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-300 outline-none"
                  >
                    {SORT_LABELS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {library.length === 0 ? (
                <p className="text-xs text-gray-500 py-6">Aucun projet ne correspond à « {query} ».</p>
              ) : (
                <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                  {library.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      highlighted={project.id === last?.id}
                      {...cardProps}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <footer className="text-[11px] text-gray-600 border-t border-gray-900 pt-4">
          Projets enregistrés localement sur cet appareil · stockage {origin}
        </footer>
      </div>

      {creating && (
        <NewProjectDialog
          defaultName={suggestProjectName(projects.map((p) => p.name))}
          onCancel={() => setCreating(false)}
          onCreate={(name) => {
            setCreating(false);
            onCreate(name);
          }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Supprimer ce projet ?"
          message={`« ${toDelete.name} » et toutes ses images seront supprimés définitivement. Les autres projets ne sont pas touchés.`}
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const id = toDelete.id;
            setToDelete(null);
            onDelete(id);
          }}
        />
      )}
    </div>
  );
};

export default HomeScreen;
