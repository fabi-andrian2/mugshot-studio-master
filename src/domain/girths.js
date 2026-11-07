import { CM_PER_INCH } from './constants.js';

// Mensurations anatomiques : valeurs réelles saisies par l'utilisateur, jamais
// déduites de l'image. Stockées dans le sujet (`subject.girths`), en cm.

export const GIRTH_SIDES = ['both', 'left', 'right'];
export const MAX_GIRTH_CM = 500;
export const MAX_GIRTHS_PER_SUBJECT = 40;
export const MAX_GIRTH_LABEL_LENGTH = 40;

export const GIRTH_CATALOG = [
  { kind: 'waist', label: 'Tour de taille', lateral: false },
  { kind: 'chest', label: 'Tour de poitrine', lateral: false },
  { kind: 'hips', label: 'Tour de hanches', lateral: false },
  { kind: 'arm', label: 'Tour de bras', lateral: true },
  { kind: 'thigh', label: 'Tour de cuisse', lateral: true },
];

export const SIDE_LABELS = { both: 'Les deux', left: 'Gauche', right: 'Droite' };

const CATALOG_BY_KIND = new Map(GIRTH_CATALOG.map((entry) => [entry.kind, entry]));

export const isLateralKind = (kind) => CATALOG_BY_KIND.get(kind)?.lateral === true;
export const isGirthKind = (kind) => kind === 'custom' || CATALOG_BY_KIND.has(kind);

export const isValidGirthCm = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_GIRTH_CM;

export const cleanGirthLabel = (label) =>
  typeof label === 'string' ? label.trim().replace(/\s+/g, ' ').slice(0, MAX_GIRTH_LABEL_LENGTH) : '';

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `girth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Clé d'unicité : un seul tour par (type, côté) pour les mensurations prédéfinies.
const slotOf = (entry) => (entry.kind === 'custom' ? `custom:${entry.id}` : `${entry.kind}:${entry.side ?? ''}`);

const cleanEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (!isGirthKind(raw.kind) || !isValidGirthCm(raw.cm)) return null;
  if (raw.kind === 'custom') {
    const label = cleanGirthLabel(raw.label);
    if (!label) return null;
    return { id: raw.id, kind: 'custom', label, cm: raw.cm };
  }
  if (isLateralKind(raw.kind)) {
    if (!GIRTH_SIDES.includes(raw.side)) return null;
    return { id: raw.id, kind: raw.kind, side: raw.side, cm: raw.cm };
  }
  return { id: raw.id, kind: raw.kind, cm: raw.cm };
};

// Tolère des données corrompues : les entrées invalides ou en double sont écartées.
export const normalizeGirths = (raw) => {
  if (!Array.isArray(raw)) return [];
  const slots = new Set();
  const ids = new Set();
  const out = [];
  for (const item of raw) {
    const entry = cleanEntry(item);
    if (!entry || ids.has(entry.id)) continue;
    const slot = slotOf(entry);
    if (slots.has(slot)) continue;
    // « les deux » est incompatible avec gauche/droite du même type.
    if (isLateralKind(entry.kind)) {
      const others = ['both', 'left', 'right'].filter((s) => s !== entry.side);
      const conflicting = entry.side === 'both'
        ? others.some((s) => slots.has(`${entry.kind}:${s}`))
        : slots.has(`${entry.kind}:both`);
      if (conflicting) continue;
    }
    slots.add(slot);
    ids.add(entry.id);
    out.push(entry);
    if (out.length >= MAX_GIRTHS_PER_SUBJECT) break;
  }
  return out;
};

export const getSubjectGirths = (subject) => normalizeGirths(subject?.girths);

export const setSubjectGirths = (subject, girths) => {
  const rest = { ...subject };
  delete rest.girths;
  return girths.length ? { ...rest, girths } : rest;
};

export const getGirthLabel = (entry) => {
  const base = entry.kind === 'custom' ? entry.label : CATALOG_BY_KIND.get(entry.kind)?.label ?? entry.kind;
  return entry.side && entry.side !== 'both' ? `${base} (${SIDE_LABELS[entry.side].toLowerCase()})` : base;
};

export const getGirthSlotLabel = (kind) => CATALOG_BY_KIND.get(kind)?.label ?? 'Personnalisée';

// Ajoute ou remplace une mensuration. Retourne la même liste si rien ne change.
export const upsertGirth = (girths, { kind, side, label, cm }, createId = makeId) => {
  if (!isGirthKind(kind) || !isValidGirthCm(cm)) return girths;
  const lateral = isLateralKind(kind);
  const nextSide = lateral ? (GIRTH_SIDES.includes(side) ? side : 'both') : undefined;
  if (kind === 'custom') {
    const clean = cleanGirthLabel(label);
    if (!clean || girths.length >= MAX_GIRTHS_PER_SUBJECT) return girths;
    return [...girths, { id: createId(), kind, label: clean, cm }];
  }
  const existing = girths.find((g) => g.kind === kind && (g.side ?? undefined) === nextSide);
  if (existing && existing.cm === cm) return girths;
  const kept = girths.filter((g) => {
    if (g.kind !== kind) return true;
    if (!lateral) return false;
    if (nextSide === 'both') return false; // remplace gauche/droite/commune
    return g.side === (nextSide === 'left' ? 'right' : 'left'); // supprime « les deux »
  });
  const entry = { id: existing?.id ?? createId(), kind, ...(nextSide && { side: nextSide }), cm };
  if (!existing && kept.length >= MAX_GIRTHS_PER_SUBJECT) return girths;
  return [...kept, entry];
};

export const updateGirthValue = (girths, id, cm) => {
  if (!isValidGirthCm(cm)) return girths;
  const target = girths.find((g) => g.id === id);
  if (!target || target.cm === cm) return girths;
  return girths.map((g) => (g.id === id ? { ...g, cm } : g));
};

export const renameCustomGirth = (girths, id, label) => {
  const clean = cleanGirthLabel(label);
  const target = girths.find((g) => g.id === id);
  if (!target || target.kind !== 'custom' || !clean || target.label === clean) return girths;
  return girths.map((g) => (g.id === id ? { ...g, label: clean } : g));
};

// Change le côté d'une mensuration latérale en gardant l'unicité.
export const setGirthSide = (girths, id, side) => {
  const target = girths.find((g) => g.id === id);
  if (!target || !isLateralKind(target.kind) || !GIRTH_SIDES.includes(side) || target.side === side) {
    return girths;
  }
  const next = girths.filter((g) => {
    if (g.id === id || g.kind !== target.kind) return true;
    return side === 'both' ? false : g.side === (side === 'left' ? 'right' : 'left');
  });
  return next.map((g) => (g.id === id ? { ...g, side } : g));
};

export const removeGirth = (girths, id) =>
  girths.some((g) => g.id === id) ? girths.filter((g) => g.id !== id) : girths;

export const areGirthsEqual = (a, b) => {
  if (a === b) return true;
  const la = Array.isArray(a) ? a : [];
  const lb = Array.isArray(b) ? b : [];
  return (
    la.length === lb.length &&
    la.every((g, i) => {
      const o = lb[i];
      return g.id === o.id && g.kind === o.kind && g.side === o.side && g.label === o.label && g.cm === o.cm;
    })
  );
};

// ------------------------------------------------------------- unités

export const cmToGirthDisplay = (cm, unit) => {
  const value = unit === 'ft' ? cm / CM_PER_INCH : cm;
  return Math.round(value * 10) / 10;
};

export const formatGirth = (cm, unit) =>
  unit === 'ft' ? `${cmToGirthDisplay(cm, unit)} in` : `${cmToGirthDisplay(cm, unit)} cm`;

// Texte saisi (virgule ou point) -> cm, ou null si invalide.
export const parseGirthInput = (text, unit) => {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  const cm = unit === 'ft' ? value * CM_PER_INCH : value;
  return isValidGirthCm(cm) ? cm : null;
};
