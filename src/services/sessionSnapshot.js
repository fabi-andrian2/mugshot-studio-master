import { CANVAS_LIMITS, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from '../domain/constants.js';
import { isValidColor, normalizeBoardTitle, withFraming } from '../domain/board.js';
import { SCHEMA_VERSION } from './persistence.js';

export class SnapshotError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

const UNITS = ['cm', 'ft'];
const SCOPES = ['selected', 'all'];
const PLACEMENTS = ['auto', 'manual'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const isPositive = (value) => isNum(value) && value > 0;
const isPoint = (value) => isObject(value) && isNum(value.x) && isNum(value.y);
const isImageBlob = (value) =>
  typeof Blob !== 'undefined' &&
  value instanceof Blob &&
  value.size > 0 &&
  value.type.startsWith('image/');

const pickPoint = (point) => (isPoint(point) ? { x: point.x, y: point.y } : point);

const pickBounds = (bounds) =>
  isObject(bounds)
    ? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
    : bounds;

const fail = (message) => new SnapshotError('invalid-snapshot', message);

const checkSubject = (subject, index) => {
  const at = `Sujet ${index + 1}`;
  if (!isObject(subject)) return fail(`${at} : structure invalide.`);
  if (typeof subject.id !== 'string' || !subject.id) return fail(`${at} : identifiant manquant.`);
  if (typeof subject.name !== 'string' || !subject.name.trim()) return fail(`${at} : nom manquant.`);
  if (typeof subject.fileName !== 'string') return fail(`${at} : nom de fichier manquant.`);
  if (!isNum(subject.x) || !isNum(subject.y)) return fail(`${at} : position invalide.`);
  if (!isPositive(subject.scale)) return fail(`${at} : échelle invalide.`);
  if (typeof subject.flipX !== 'boolean') return fail(`${at} : miroir invalide.`);
  if (!isNum(subject.zIndex)) return fail(`${at} : ordre invalide.`);
  if (!PLACEMENTS.includes(subject.placement)) return fail(`${at} : placement invalide.`);
  if (typeof subject.visible !== 'boolean') return fail(`${at} : visibilité invalide.`);
  if (typeof subject.silhouette !== 'boolean') return fail(`${at} : silhouette invalide.`);
  if (!isPositive(subject.naturalW) || !isPositive(subject.naturalH)) {
    return fail(`${at} : dimensions de l'image invalides.`);
  }
  const b = subject.visibleBounds;
  if (!isObject(b) || ![b.left, b.top, b.right, b.bottom].every(isNum)) {
    return fail(`${at} : zone visible invalide.`);
  }
  if (!isPoint(subject.groundAnchor)) return fail(`${at} : ancre du sol invalide.`);
  if (!isPoint(subject.headAnchor)) return fail(`${at} : ancre de la tête invalide.`);
  if (subject.silhouetteColor !== undefined && !isValidColor(subject.silhouetteColor)) {
    return fail(`${at} : couleur de silhouette invalide.`);
  }
  if (subject.silhouetteOpacity !== undefined && !isNum(subject.silhouetteOpacity)) {
    return fail(`${at} : opacité de silhouette invalide.`);
  }
  if (!isImageBlob(subject.blob)) return fail(`${at} : image absente ou illisible.`);
  return null;
};

const checkMeasureItem = (item, index) => {
  const at = `Mesure ${index + 1}`;
  if (!isObject(item) || !isNum(item.id)) return fail(`${at} : identifiant invalide.`);
  if (!isPoint(item.start) || !isPoint(item.end)) return fail(`${at} : points invalides.`);
  return null;
};

const checkData = (data) => {
  if (!isObject(data)) return fail('Données de session absentes.');

  const { canvas, unit, board, annotations, mannequin, measure, subjects } = data;

  if (
    !isObject(canvas) ||
    !isNum(canvas.width) ||
    !isNum(canvas.height) ||
    canvas.width < CANVAS_LIMITS.minW ||
    canvas.width > CANVAS_LIMITS.maxW ||
    canvas.height < CANVAS_LIMITS.minH ||
    canvas.height > CANVAS_LIMITS.maxH
  ) {
    return fail('Dimensions de planche invalides.');
  }
  if (!UNITS.includes(unit)) return fail('Unité invalide.');

  if (!isObject(board) || typeof board.showGrid !== 'boolean' || !isObject(board.background)) {
    return fail('Planche invalide.');
  }
  if (board.title !== undefined && typeof board.title !== 'string') {
    return fail('Titre de planche invalide.');
  }
  if (!isValidColor(board.background.color)) return fail('Couleur de fond invalide.');
  const image = board.background.image;
  if (image !== null) {
    if (
      !isObject(image) ||
      !isImageBlob(image.blob) ||
      !isPositive(image.width) ||
      !isPositive(image.height) ||
      typeof image.fileName !== 'string'
    ) {
      return fail('Image de fond invalide.');
    }
  }

  if (
    !isObject(annotations) ||
    typeof annotations.enabled !== 'boolean' ||
    !SCOPES.includes(annotations.scope)
  ) {
    return fail('Annotations invalides.');
  }

  if (
    !isObject(mannequin) ||
    typeof mannequin.visible !== 'boolean' ||
    !isNum(mannequin.heightCm) ||
    mannequin.heightCm < MIN_HEIGHT_CM ||
    mannequin.heightCm > MAX_HEIGHT_CM ||
    !(mannequin.x === null || isNum(mannequin.x))
  ) {
    return fail('Mannequin invalide.');
  }

  if (!isObject(measure) || !Array.isArray(measure.items)) return fail('Mesures invalides.');
  for (let i = 0; i < measure.items.length; i += 1) {
    const problem = checkMeasureItem(measure.items[i], i);
    if (problem) return problem;
  }
  if (new Set(measure.items.map((item) => item.id)).size !== measure.items.length) {
    return fail('Identifiants de mesure en double.');
  }

  if (!Array.isArray(subjects)) return fail('Liste de sujets invalide.');
  for (let i = 0; i < subjects.length; i += 1) {
    const problem = checkSubject(subjects[i], i);
    if (problem) return problem;
  }
  if (new Set(subjects.map((subject) => subject.id)).size !== subjects.length) {
    return fail('Identifiants de sujet en double.');
  }

  return null;
};

const defaultFetchBlob = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Réponse ${response.status}`);
  return response.blob();
};

const fetchImageBlob = async (url, label, fetchBlob) => {
  try {
    return await fetchBlob(url);
  } catch (cause) {
    throw new SnapshotError('image-unavailable', `Image introuvable : ${label}.`, cause);
  }
};

const copySubjectFields = (subject, blob) => ({
  id: subject.id,
  name: subject.name,
  fileName: subject.fileName,
  x: subject.x,
  y: subject.y,
  scale: subject.scale,
  flipX: subject.flipX,
  zIndex: subject.zIndex,
  placement: subject.placement,
  visible: subject.visible !== false,
  silhouette: Boolean(subject.silhouette),
  ...(subject.silhouetteColor !== undefined && { silhouetteColor: subject.silhouetteColor }),
  ...(subject.silhouetteOpacity !== undefined && { silhouetteOpacity: subject.silhouetteOpacity }),
  naturalW: subject.naturalW,
  naturalH: subject.naturalH,
  visibleBounds: pickBounds(subject.visibleBounds),
  groundAnchor: pickPoint(subject.groundAnchor),
  headAnchor: pickPoint(subject.headAnchor),
  blob,
});

export const serializeSession = async (state, { fetchBlob = defaultFetchBlob } = {}) => {
  try {
    if (!isObject(state) || !Array.isArray(state.subjects) || !isObject(state.board)) {
      throw new SnapshotError('invalid-state', 'État de session invalide.');
    }
    const { subjects, board, annotations, mannequin, measure } = state;
    const background = board.background;
    if (!isObject(background)) throw new SnapshotError('invalid-state', 'Fond invalide.');

    const subjectBlobs = await Promise.all(
      subjects.map((subject) =>
        fetchImageBlob(subject?.url, subject?.fileName ?? 'sujet', fetchBlob),
      ),
    );
    const backgroundBlob = background.image
      ? await fetchImageBlob(background.image.url, background.image.fileName ?? 'fond', fetchBlob)
      : null;

    const data = {
      canvas: { width: state.canvasW, height: state.canvasH },
      unit: state.unit,
      board: {
        showGrid: board.showGrid,
        title: normalizeBoardTitle(board.title),
        background: {
          color: background.color,
          image: background.image
            ? withFraming(
                {
                  blob: backgroundBlob,
                  width: background.image.width,
                  height: background.image.height,
                  fileName: background.image.fileName,
                },
                background.image.framing,
              )
            : null,
        },
      },
      annotations: isObject(annotations)
        ? { enabled: annotations.enabled, scope: annotations.scope }
        : annotations,
      mannequin: isObject(mannequin)
        ? { visible: mannequin.visible, heightCm: mannequin.heightCm, x: mannequin.x }
        : mannequin,
      measure: {
        items: Array.isArray(measure?.items)
          ? measure.items.map((item) =>
              isObject(item)
                ? { id: item.id, start: pickPoint(item.start), end: pickPoint(item.end) }
                : item,
            )
          : measure?.items,
      },
      subjects: subjects.map((subject, i) => copySubjectFields(subject, subjectBlobs[i])),
    };

    const problem = checkData(data);
    if (problem) throw new SnapshotError('invalid-state', problem.message);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof SnapshotError
          ? error
          : new SnapshotError('invalid-state', 'Sérialisation impossible.', error),
    };
  }
};

export const restoreSession = async (
  snapshot,
  { createUrl = (blob) => URL.createObjectURL(blob), revokeUrl = (url) => URL.revokeObjectURL(url) } = {},
) => {
  const created = [];
  try {
    if (!isObject(snapshot) || snapshot.schemaVersion !== SCHEMA_VERSION) {
      throw new SnapshotError('unsupported-version', 'Version de sauvegarde non prise en charge.');
    }
    const problem = checkData(snapshot.data);
    if (problem) throw problem;

    const { canvas, unit, board, annotations, mannequin, measure, subjects } = snapshot.data;
    const makeUrl = (blob) => {
      const url = createUrl(blob);
      created.push(url);
      return url;
    };

    const restoredSubjects = subjects.map(({ blob, ...subject }) => ({
      ...subject,
      visibleBounds: pickBounds(subject.visibleBounds),
      groundAnchor: pickPoint(subject.groundAnchor),
      headAnchor: pickPoint(subject.headAnchor),
      url: makeUrl(blob),
    }));

    const image = board.background.image;
    const restoredImage = image
      ? withFraming(
          { url: makeUrl(image.blob), width: image.width, height: image.height, fileName: image.fileName },
          image.framing,
        )
      : null;

    return {
      ok: true,
      state: {
        canvasW: canvas.width,
        canvasH: canvas.height,
        unit,
        subjects: restoredSubjects,
        board: {
          showGrid: board.showGrid,
          title: normalizeBoardTitle(board.title),
          background: { color: board.background.color, image: restoredImage },
        },
        annotations: { enabled: annotations.enabled, scope: annotations.scope },
        mannequin: { visible: mannequin.visible, heightCm: mannequin.heightCm, x: mannequin.x },
        measure: {
          active: false,
          items: measure.items.map((item) => ({
            id: item.id,
            start: pickPoint(item.start),
            end: pickPoint(item.end),
          })),
        },
      },
    };
  } catch (error) {
    created.forEach((url) => revokeUrl(url));
    return {
      ok: false,
      error:
        error instanceof SnapshotError
          ? error
          : new SnapshotError('restore-failed', 'Restauration impossible.', error),
    };
  }
};