import { useState } from 'react';
import { Ruler, ChevronDown, Trash2, Check, X } from 'lucide-react';
import { ToolButton } from './controls.jsx';
import { formatHeight, inchesToCm } from '../../domain/measurement.js';
import {
  GIRTH_CATALOG,
  SIDE_LABELS,
  getGirthLabel,
  isLateralKind,
  getSubjectGirths,
  upsertGirth,
  updateGirthValue,
  renameCustomGirth,
  setGirthSide,
  removeGirth,
  cmToGirthDisplay,
  parseGirthInput,
  cleanGirthLabel,
} from '../../domain/girths.js';

const TOOLS = [
  { id: 'segment', label: 'Segment', hint: 'Glisse pour mesurer une distance' },
  { id: 'polyline', label: 'Polyligne', hint: 'Clique les points · Entrée ou double-clic pour terminer' },
  { id: 'bezier', label: 'Courbe', hint: 'Clique les points · Entrée ou double-clic pour terminer' },
];

const KIND_LABELS = { segment: 'Segment', polyline: 'Polyligne', bezier: 'Courbe' };

const CM_STEPS = [5, 10, 20, 25, 50, 100];
const INCH_STEPS = [1, 2, 6, 12, 24, 36];

const FIELD =
  'bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-emerald-600';

const SectionTitle = ({ children }) => (
  <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">{children}</p>
);

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`flex-1 px-2 py-1.5 text-xs border-b-2 transition ${
      active ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-gray-400 hover:text-gray-200'
    }`}
  >
    {children}
  </button>
);

const getStepOptions = (unit, current) => {
  const presets = (unit === 'ft' ? INCH_STEPS.map(inchesToCm) : CM_STEPS).map((cm) => ({
    value: String(cm),
    label: formatHeight(cm, unit),
  }));
  if (current && !presets.some((p) => Math.abs(Number(p.value) - current) < 1e-6)) {
    presets.push({ value: String(current), label: `${formatHeight(current, unit)} (perso)` });
  }
  return presets;
};

const BoardTab = ({
  tool,
  onToolChange,
  ticks,
  onTicksChange,
  unit,
  entries,
  selectedIds,
  onSelect,
  onDelete,
  onClear,
  draft,
  onFinishDraft,
  onCancelDraft,
  selectedNode,
  onDeleteNode,
  onResetHandles,
}) => {
  const mode = !ticks.enabled ? 'off' : ticks.step ? String(ticks.step) : 'auto';
  const hint = TOOLS.find((t) => t.id === tool)?.hint;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <SectionTitle>Outil</SectionTitle>
        <div className="grid grid-cols-3 gap-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tool === t.id}
              onClick={() => onToolChange(t.id)}
              className={`rounded-md px-2 py-1.5 text-xs border transition ${
                tool === t.id
                  ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                  : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 leading-snug">{hint}</p>
        {draft && (
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-800 bg-emerald-950/30 px-2 py-1.5">
            <span className="flex-1 text-xs text-emerald-300 font-mono">
              {draft.count} pt · {draft.label}
            </span>
            <button type="button" title="Terminer (Entrée)" disabled={draft.count < 2} onClick={onFinishDraft} className="p-1 rounded hover:bg-emerald-900/50 text-emerald-300 disabled:opacity-30">
              <Check size={14} />
            </button>
            <button type="button" title="Annuler (Échap)" onClick={onCancelDraft} className="p-1 rounded hover:bg-gray-700 text-gray-300">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <label className="flex items-center justify-between gap-2">
        <SectionTitle>Graduations</SectionTitle>
        <select
          aria-label="Graduations"
          className={FIELD}
          value={mode}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'off') onTicksChange({ enabled: false, step: null });
            else if (v === 'auto') onTicksChange({ enabled: true, step: null });
            else onTicksChange({ enabled: true, step: Number(v) });
          }}
        >
          <option value="off">Aucune</option>
          <option value="auto">Auto</option>
          {getStepOptions(unit, ticks.step).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {selectedNode && (
        <div className="flex gap-1.5">
          <button type="button" onClick={onDeleteNode} className="flex-1 rounded-md px-2 py-1.5 text-xs border bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300">
            Supprimer le point
          </button>
          {selectedNode.canResetHandles && (
            <button type="button" onClick={onResetHandles} className="flex-1 rounded-md px-2 py-1.5 text-xs border bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300">
              Poignées auto
            </button>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <SectionTitle>Mesures ({entries.length})</SectionTitle>
          {entries.length > 0 && (
            <button type="button" onClick={onClear} className="text-[11px] text-gray-400 hover:text-red-300">
              Tout effacer
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="text-[11px] text-gray-500">Aucune mesure sur la planche.</p>
        ) : (
          <ul className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <div
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                    selectedIds.includes(entry.id)
                      ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200'
                      : 'border-gray-700 bg-gray-800/60 text-gray-300'
                  }`}
                >
                  <button type="button" className="flex-1 text-left" onClick={() => onSelect(entry.id)}>
                    <span className="text-gray-500">{KIND_LABELS[entry.kind]} · </span>
                    <span className="font-mono">{entry.label}</span>
                  </button>
                  <button type="button" title="Supprimer la mesure" aria-label="Supprimer la mesure" onClick={() => onDelete(entry.id)} className="p-0.5 text-gray-400 hover:text-red-300">
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const ValueInput = ({ cm, unit, label, onCommit }) => {
  const [invalid, setInvalid] = useState(false);
  const display = String(cmToGirthDisplay(cm, unit));
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      defaultValue={display}
      aria-invalid={invalid}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.currentTarget.value = display;
          e.currentTarget.blur();
        }
        e.stopPropagation();
      }}
      onBlur={(e) => {
        const parsed = parseGirthInput(e.currentTarget.value, unit);
        if (parsed === null) {
          setInvalid(true);
          e.currentTarget.value = display;
          return;
        }
        setInvalid(false);
        onCommit(parsed);
      }}
      className={`${FIELD} w-16 text-right font-mono ${invalid ? 'border-red-500' : ''}`}
    />
  );
};

const GirthsTab = ({ subjects, subjectId, onSubjectChange, unit, onGirthsChange }) => {
  const [kind, setKind] = useState(GIRTH_CATALOG[0].kind);
  const [side, setSide] = useState('both');
  const [customName, setCustomName] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) {
    return <p className="text-xs text-gray-500">Importe un sujet pour saisir ses mensurations.</p>;
  }
  const girths = getSubjectGirths(subject);
  const unitLabel = unit === 'ft' ? 'in' : 'cm';
  const change = (fn) => onGirthsChange(subject.id, fn);

  const handleAdd = () => {
    const cm = parseGirthInput(value, unit);
    if (cm === null) return setError('Valeur positive requise.');
    if (kind === 'custom' && !cleanGirthLabel(customName)) return setError('Nom requis.');
    setError('');
    change((list) => upsertGirth(list, { kind, side, label: customName, cm }));
    setValue('');
    if (kind === 'custom') setCustomName('');
  };

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1">
        <SectionTitle>Sujet</SectionTitle>
        <select aria-label="Sujet" className={FIELD} value={subject.id} onChange={(e) => onSubjectChange(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5">
        <SectionTitle>Mensurations réelles</SectionTitle>
        {girths.length === 0 ? (
          <p className="text-[11px] text-gray-500">Aucune mensuration saisie. Les valeurs sont celles que tu indiques ; elles ne sont pas déduites de l’image.</p>
        ) : (
          <ul className="space-y-1">
            {girths.map((g) => (
              <li key={g.id} className="flex items-center gap-1.5 text-xs text-gray-300">
                <span className="flex-1 min-w-0 truncate" title={getGirthLabel(g)}>
                  {g.kind === 'custom' ? (
                    <input
                      type="text"
                      aria-label="Nom de la mensuration"
                      defaultValue={g.label}
                      maxLength={40}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        e.stopPropagation();
                      }}
                      onBlur={(e) => change((list) => renameCustomGirth(list, g.id, e.currentTarget.value))}
                      className={`${FIELD} w-full`}
                    />
                  ) : (
                    GIRTH_CATALOG.find((c) => c.kind === g.kind)?.label
                  )}
                </span>
                {isLateralKind(g.kind) && (
                  <select
                    aria-label="Côté"
                    className={FIELD}
                    value={g.side}
                    onChange={(e) => change((list) => setGirthSide(list, g.id, e.target.value))}
                  >
                    {Object.entries(SIDE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                <ValueInput
                  key={`${g.id}-${g.cm}-${unit}`}
                  cm={g.cm}
                  unit={unit}
                  label={`${getGirthLabel(g)} (${unitLabel})`}
                  onCommit={(cm) => change((list) => updateGirthValue(list, g.id, cm))}
                />
                <span className="w-5 text-[10px] text-gray-500">{unitLabel}</span>
                <button type="button" title="Supprimer" aria-label={`Supprimer ${getGirthLabel(g)}`} onClick={() => change((list) => removeGirth(list, g.id))} className="p-0.5 text-gray-400 hover:text-red-300">
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5 border-t border-gray-800 pt-2.5">
        <SectionTitle>Ajouter</SectionTitle>
        <div className="flex gap-1.5">
          <select aria-label="Type de mensuration" className={`${FIELD} flex-1 min-w-0`} value={kind} onChange={(e) => setKind(e.target.value)}>
            {GIRTH_CATALOG.map((c) => (
              <option key={c.kind} value={c.kind}>
                {c.label}
              </option>
            ))}
            <option value="custom">Personnalisée…</option>
          </select>
          {isLateralKind(kind) && (
            <select aria-label="Côté de la mensuration" className={FIELD} value={side} onChange={(e) => setSide(e.target.value)}>
              {Object.entries(SIDE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        {kind === 'custom' && (
          <input
            type="text"
            aria-label="Nom personnalisé"
            placeholder="Nom (ex. Tour de cou)"
            maxLength={40}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className={`${FIELD} w-full`}
          />
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Valeur (${unitLabel})`}
            placeholder={`Valeur (${unitLabel})`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              e.stopPropagation();
            }}
            className={`${FIELD} flex-1 min-w-0 font-mono`}
          />
          <button type="button" onClick={handleAdd} className="rounded-md px-3 py-1 text-xs border bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white">
            Ajouter
          </button>
        </div>
        {error && <p role="alert" className="text-[11px] text-red-400">{error}</p>}
        <p className="text-[10px] text-gray-500">Visibles ici uniquement : ni sur la planche, ni dans l’export.</p>
      </div>
    </div>
  );
};

const MeasureMenu = ({ active, onToggle, subjects, selectedSubjectId, onGirthsChange, ...boardProps }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('board');
  const [girthSubjectId, setGirthSubjectId] = useState(null);
  const subjectId = subjects.some((s) => s.id === girthSubjectId)
    ? girthSubjectId
    : selectedSubjectId ?? subjects[0]?.id ?? null;

  return (
    <div className="relative flex items-center gap-1.5">
      <ToolButton
        icon={Ruler}
        label="Mesure"
        title="Outil de mesure (Échap pour quitter)"
        variant={active ? 'active' : 'ghost'}
        pressed={active}
        onClick={onToggle}
      />
      <ToolButton title="Options de mesure et mensurations" onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={11} />
      </ToolButton>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Mesure"
            className="absolute left-0 top-full mt-1 z-50 w-80 max-w-[92vw] origin-top-left animate-pop-in bg-[#1c1c1c] border border-gray-700 rounded-md shadow-2xl"
          >
            <div role="tablist" className="flex border-b border-gray-800">
              <TabButton active={tab === 'board'} onClick={() => setTab('board')}>Planche</TabButton>
              <TabButton active={tab === 'girths'} onClick={() => setTab('girths')}>Mensurations</TabButton>
            </div>
            <div className="p-3 max-h-[70vh] overflow-y-auto">
              {tab === 'board' ? (
                <BoardTab {...boardProps} />
              ) : (
                <GirthsTab
                  subjects={subjects}
                  subjectId={subjectId}
                  onSubjectChange={setGirthSubjectId}
                  unit={boardProps.unit}
                  onGirthsChange={onGirthsChange}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MeasureMenu;
