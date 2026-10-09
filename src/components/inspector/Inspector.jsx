import { useState, useRef } from 'react';
import {
  FlipHorizontal, User, ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Image as ImageIcon,
} from 'lucide-react';
import NumField from './NumField.jsx';
import Section from './Section.jsx';
import { MIN_HEIGHT_CM, MAX_HEIGHT_CM } from '../../domain/constants.js';
import { getMeasuredHeightPx, getSubjectHeightCm, getScaleForHeightCm } from '../../domain/geometry.js';
import { getScaleLimits, splitFeetInches, feetInchesToCm, formatHeight } from '../../domain/measurement.js';
import { isSubjectVisible } from '../../domain/appearance.js';
import { DEFAULT_SECTIONS, toggleSection } from '../../domain/panels.js';

const SHORTCUTS = [
  ['↑ ↓ ← →', 'déplacer ±2 px'],
  ['Shift + flèches', 'déplacer ±20 px'],
  ['[ ]', 'échelle ±1 %'],
  ['Shift + [ ]', 'échelle ±10 %'],
  ['F', 'miroir horizontal'],
  ['Suppr', 'supprimer le sujet'],
  ['Ctrl + Z / Y', 'annuler / rétablir'],
  ['Espace + glisser', 'naviguer'],
];

const ActionButton = ({ icon: Icon, label, onClick, active = false, danger = false }) => {
  let tone = 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300';
  if (active) tone = 'bg-emerald-900/40 border-emerald-700 text-emerald-300';
  if (danger) tone = 'bg-red-900/20 hover:bg-red-900/40 border-red-900/30 text-red-400';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs border transition ${tone}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
};

const NameField = ({ subject, onRename }) => {
  const [draft, setDraft] = useState(subject.name);
  const skipCommit = useRef(false);

  const commit = () => {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    const next = draft.trim();
    if (!next) {
      setDraft(subject.name);
      return;
    }
    if (next !== subject.name) onRename(next);
  };

  return (
    <div className="space-y-1">
      <input
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            skipCommit.current = true;
            setDraft(subject.name);
            e.currentTarget.blur();
          }
        }}
        title="Entrée : valider · Échap : annuler"
        className="w-full bg-[#1a1a1a] border border-gray-700 hover:border-gray-500 focus:border-emerald-500 rounded-md px-3 py-2 text-sm font-semibold text-white outline-none transition-colors"
      />
      <p className="text-[10px] text-gray-600 truncate" title={subject.fileName}>
        Fichier : {subject.fileName}
      </p>
    </div>
  );
};

const Inspector = ({
  subject,
  unit,
  canvasW,
  onPreview,
  onApply,
  onCancelEdit,
  onEndGesture,
  onRename,
  onToggleVisible,
  onMove,
  onRemove,
}) => {
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const toggle = (id) => setSections((current) => toggleSection(current, id));

  if (!subject) {
    return (
      <>
        <div className="px-4 py-3 border-b border-gray-800 bg-[#151515]">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inspecteur</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3 text-gray-600">
          <ImageIcon size={32} className="opacity-30" />
          <p className="text-xs text-gray-400">Aucun sujet sélectionné</p>
          <p className="text-[11px] text-gray-600">
            Clique sur un sujet du canvas ou de la liste pour afficher sa mesure, sa position et son apparence.
          </p>
        </div>
      </>
    );
  }

  const limits = getScaleLimits(getMeasuredHeightPx(subject));
  const heightCm = getSubjectHeightCm(subject);
  const { feet, inches } = splitFeetInches(heightCm);
  const scaleForCm = (cm) => ({ scale: getScaleForHeightCm(subject, cm) });
  const shown = isSubjectVisible(subject);
  const otherUnit = unit === 'cm' ? 'ft' : 'cm';

  return (
    <>
      <div className="px-4 py-3 border-b border-gray-800 bg-[#151515]">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inspecteur</h2>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-4 py-4 border-b border-gray-800 space-y-2">
          <NameField key={`${subject.id}:${subject.name}`} subject={subject} onRename={onRename} />
          {!shown && (
            <p className="text-[11px] text-amber-400">Sujet masqué : absent du canvas et de l'export.</p>
          )}
        </div>

        <Section
          title="Mesure"
          open={sections.measure}
          onToggle={() => toggle('measure')}
          summary={formatHeight(heightCm, unit)}
        >
          {unit === 'cm' ? (
            <NumField
              size="lg"
              label="Hauteur"
              value={parseFloat(heightCm.toFixed(1))}
              step={1}
              min={MIN_HEIGHT_CM}
              max={MAX_HEIGHT_CM}
              decimals={1}
              unit="cm"
              onChange={v => onPreview(scaleForCm(v))}
              onCommit={v => onApply(scaleForCm(v))}
              onCancel={onCancelEdit}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <NumField
                size="lg"
                label="Pieds"
                value={feet}
                step={1}
                min={0}
                max={9}
                unit="ft"
                onChange={v => onPreview(scaleForCm(feetInchesToCm(v, inches)))}
                onCommit={v => onApply(scaleForCm(feetInchesToCm(v, inches)))}
                onCancel={onCancelEdit}
              />
              <NumField
                size="lg"
                label="Pouces"
                value={inches}
                step={1}
                min={0}
                max={11.9}
                decimals={1}
                unit="in"
                onChange={v => onPreview(scaleForCm(feetInchesToCm(feet, v)))}
                onCommit={v => onApply(scaleForCm(feetInchesToCm(feet, v)))}
                onCancel={onCancelEdit}
              />
            </div>
          )}

          <p className="text-[11px] text-gray-500 font-mono">≈ {formatHeight(heightCm, otherUnit)}</p>

          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Tête
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Appui (pied)
            </span>
          </div>
          <p className="text-[10px] text-gray-600 leading-snug">
            Mesurée du repère d'appui au repère de tête. Glisse les repères sur le canvas pour les corriger.
          </p>

          <div className="space-y-1.5 pt-1">
            <NumField
              label="Échelle"
              value={parseFloat((subject.scale * 100).toFixed(1))}
              step={1}
              min={limits.min * 100}
              max={limits.max * 100}
              decimals={1}
              unit="%"
              onChange={v => onPreview({ scale: v / 100 })}
              onCommit={v => onApply({ scale: v / 100 })}
              onCancel={onCancelEdit}
            />
            <input
              type="range"
              min={limits.min}
              max={limits.max}
              step="any"
              className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              value={subject.scale}
              onChange={e => onPreview({ scale: parseFloat(e.target.value) })}
              onPointerUp={onEndGesture}
              onKeyUp={onEndGesture}
              onBlur={onEndGesture}
            />
            <button
              type="button"
              onClick={() => onApply({ scale: 1 })}
              className="text-[10px] text-gray-500 hover:text-emerald-400 transition"
            >
              Taille d'origine (100 %)
            </button>
          </div>
        </Section>

        <Section
          title="Position"
          open={sections.position}
          onToggle={() => toggle('position')}
          summary={`X ${Math.round(subject.x)} · Y ${Math.round(subject.y)}`}
        >
          <div className="grid grid-cols-2 gap-2">
            <NumField
              label="X · centre"
              value={Math.round(subject.x)}
              step={1}
              min={-canvasW}
              max={canvasW * 2}
              unit="px"
              onChange={v => onPreview({ x: v })}
              onCommit={v => onApply({ x: v })}
              onCancel={onCancelEdit}
            />
            <NumField
              label="Y · appui"
              value={Math.round(subject.y)}
              step={1}
              unit="px"
              onChange={v => onPreview({ y: v })}
              onCommit={v => onApply({ y: v })}
              onCancel={onCancelEdit}
            />
          </div>
          <p className="text-[10px] text-gray-600 leading-snug">
            Y est la hauteur du repère d'appui au-dessus du sol (0 = posé au sol).
          </p>
          <button
            type="button"
            onClick={() => onApply({ y: 0 })}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs py-2 rounded-md text-gray-300 transition"
          >
            Recaler au sol
          </button>
        </Section>

        <Section
          title="Apparence"
          open={sections.appearance}
          onToggle={() => toggle('appearance')}
          summary={[subject.flipX && 'Miroir', subject.silhouette && 'Silhouette'].filter(Boolean).join(' · ') || 'Normal'}
        >
          <div className="flex gap-2">
            <ActionButton
              icon={FlipHorizontal}
              label="Miroir (F)"
              active={!!subject.flipX}
              onClick={() => onApply({ flipX: !subject.flipX })}
            />
            <ActionButton
              icon={User}
              label="Silhouette"
              active={!!subject.silhouette}
              onClick={() => onApply({ silhouette: !subject.silhouette })}
            />
          </div>
          <p className="text-[10px] text-gray-600 leading-snug">
            La silhouette ne change ni la hauteur ni les repères. Elle apparaît aussi à l'export.
          </p>
        </Section>

        <Section
          title="Calques"
          open={sections.layers}
          onToggle={() => toggle('layers')}
          summary={shown ? 'Visible' : 'Masqué'}
        >
          <div className="flex gap-2">
            <ActionButton icon={ArrowUp} label="Avancer" onClick={() => onMove('forward')} />
            <ActionButton icon={ArrowDown} label="Reculer" onClick={() => onMove('backward')} />
          </div>
          <div className="flex gap-2">
            <ActionButton
              icon={shown ? Eye : EyeOff}
              label={shown ? 'Masquer' : 'Afficher'}
              onClick={onToggleVisible}
            />
            <ActionButton icon={Trash2} label="Supprimer" danger onClick={onRemove} />
          </div>
        </Section>

        <Section
          title="Aide · Raccourcis"
          open={sections.help}
          onToggle={() => toggle('help')}
        >
          <ul className="space-y-1.5 text-[11px]">
            {SHORTCUTS.map(([keys, action]) => (
              <li key={keys} className="flex justify-between gap-2">
                <span className="text-gray-400 font-mono">{keys}</span>
                <span className="text-gray-600 text-right">{action}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
};

export default Inspector;