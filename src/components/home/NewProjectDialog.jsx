import { useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { MAX_PROJECT_NAME_LENGTH, normalizeProjectName } from '../../domain/projects.js';

const NewProjectDialog = ({ defaultName, onCreate, onCancel }) => {
  const [name, setName] = useState(defaultName);
  const valid = normalizeProjectName(name) !== '';
  const submit = (event) => {
    event.preventDefault();
    if (valid) onCreate(normalizeProjectName(name));
  };
  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center animate-fade-in"
      onClick={onCancel}
    >
      <form
        onSubmit={submit}
        className="bg-[#1c1c1c] border border-gray-700 rounded-xl p-6 w-[26rem] max-w-[92vw] shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <FilePlus2 size={14} className="text-emerald-400" /> Nouveau projet
        </h2>
        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">
          Nom du projet
        </label>
        <input
          autoFocus
          value={name}
          maxLength={MAX_PROJECT_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-full bg-[#0d0d0d] border border-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-600"
        />
        <p className="text-[11px] text-gray-500 mt-2">
          Planche vierge avec les réglages par défaut. Le titre affiché sur la planche reste
          indépendant.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="text-xs px-3 py-2 rounded font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40"
          >
            Créer et ouvrir
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewProjectDialog;
