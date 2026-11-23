import { DEFAULT_W, DEFAULT_H } from './constants.js';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_BOARD, normalizeBoardTitle } from './board.js';
import { DEFAULT_ANNOTATIONS } from './annotations.js';
import { DEFAULT_MANNEQUIN } from './mannequin.js';
import { DEFAULT_SHADOWS, normalizeShadows } from './shadows.js';

export const MAX_PROJECT_NAME_LENGTH = 80;
export const DEFAULT_PROJECT_NAME = 'Nouveau projet';
export const RECENT_PROJECTS_COUNT = 6;
export const SORT_KEYS = ['recent', 'name', 'created'];
export const LEGACY_PROJECT_NAME = 'Ancienne session';

export const normalizeProjectName = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_PROJECT_NAME_LENGTH).trim();
};

const namesSet = (existing) => new Set(existing.map((name) => normalizeProjectName(name).toLowerCase()));

export const suggestProjectName = (existingNames = [], base = DEFAULT_PROJECT_NAME) => {
  const taken = namesSet(existingNames);
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
};

export const getCopyName = (name, existingNames = []) => {
  const taken = namesSet(existingNames);
  const fit = (suffix) => {
    const room = MAX_PROJECT_NAME_LENGTH - suffix.length;
    return `${normalizeProjectName(name).slice(0, room).trim()}${suffix}`;
  };
  let candidate = fit(' (copie)');
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = fit(` (copie ${n})`);
    n += 1;
  }
  return candidate;
};

const fold = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const filterProjects = (projects, query) => {
  const needle = fold(query).trim();
  if (!needle) return projects;
  return projects.filter((project) => fold(project.name).includes(needle));
};

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const sortProjects = (projects, key = 'recent') => {
  const list = [...projects];
  if (key === 'name') {
    return list.sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true }) || byId(a, b),
    );
  }
  if (key === 'created') return list.sort((a, b) => b.createdAt - a.createdAt || byId(a, b));
  return list.sort(
    (a, b) => b.lastOpenedAt - a.lastOpenedAt || b.updatedAt - a.updatedAt || byId(a, b),
  );
};

export const getHomeSections = (projects, lastProjectId, count = RECENT_PROJECTS_COUNT) => {
  const sorted = sortProjects(projects, 'recent');
  const last = sorted.find((project) => project.id === lastProjectId) ?? sorted[0] ?? null;
  const recent = sorted.filter((project) => project !== last).slice(0, count);
  return { last, recent };
};

export const getProjectStats = (data) => ({
  subjects: Array.isArray(data?.subjects) ? data.subjects.length : 0,
  measures: Array.isArray(data?.measure?.items) ? data.measure.items.length : 0,
  canvasW: data?.canvas?.width ?? DEFAULT_W,
  canvasH: data?.canvas?.height ?? DEFAULT_H,
});

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const fingerprint = (data) => ({
  subjects: Array.isArray(data?.subjects) ? data.subjects.length : -1,
  measures: Array.isArray(data?.measure?.items) ? data.measure.items.length : -1,
  canvas: [data?.canvas?.width, data?.canvas?.height],
  unit: data?.unit,
  showGrid: data?.board?.showGrid,
  title: normalizeBoardTitle(data?.board?.title),
  backgroundColor: data?.board?.background?.color,
  backgroundImage: Boolean(data?.board?.background?.image),
  annotations: [data?.annotations?.enabled, data?.annotations?.scope],
  shadows:
    data?.shadows === undefined
      ? null
      : normalizeShadows(data.shadows),
  mannequin: [data?.mannequin?.visible, data?.mannequin?.heightCm, data?.mannequin?.x ?? null],
});

const PRISTINE = fingerprint({
  subjects: [],
  measure: { items: [] },
  canvas: { width: DEFAULT_W, height: DEFAULT_H },
  unit: 'cm',
  board: {
    showGrid: DEFAULT_BOARD.showGrid,
    title: DEFAULT_BOARD.title,
    background: { color: DEFAULT_BACKGROUND_COLOR, image: null },
  },
  annotations: DEFAULT_ANNOTATIONS,
  shadows: DEFAULT_SHADOWS,
  mannequin: DEFAULT_MANNEQUIN,
});

export const isPristineSnapshotData = (data) => {
  const current = fingerprint(data);
  if (current.shadows === null) current.shadows = PRISTINE.shadows;
  return sameJson(current, PRISTINE);
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatRelativeTime = (timestamp, now = Date.now()) => {
  if (!Number.isFinite(timestamp)) return '';
  const delta = now - timestamp;
  if (delta < MINUTE) return "à l'instant";
  if (delta < HOUR) return `il y a ${Math.floor(delta / MINUTE)} min`;
  if (delta < DAY) return `il y a ${Math.floor(delta / HOUR)} h`;
  if (delta < 2 * DAY) return 'hier';
  if (delta < 30 * DAY) return `il y a ${Math.floor(delta / DAY)} j`;
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatClockTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
