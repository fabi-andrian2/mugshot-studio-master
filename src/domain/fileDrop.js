export const dragCarriesFiles = (types) => Array.from(types ?? []).includes('Files');

export const getImageDropState = (items) => {
  const files = Array.from(items ?? []).filter((item) => item.kind === 'file');
  const allUnsupported =
    files.length > 0 && files.every((item) => item.type && !item.type.startsWith('image/'));
  return allUnsupported ? 'reject' : 'accept';
};

export const pickImageFile = (files) =>
  Array.from(files ?? []).find((file) => file.type && file.type.startsWith('image/')) ?? null;


const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'gif', 'avif', 'bmp'];
const UNKNOWN_TYPES = ['', 'application/octet-stream'];
const MAX_LISTED_NAMES = 5;

const getExtension = (name) => {
  const dot = typeof name === 'string' ? name.lastIndexOf('.') : -1;
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
};

export const isImageFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return UNKNOWN_TYPES.includes(file.type ?? '') && IMAGE_EXTENSIONS.includes(getExtension(file.name));
};

export const partitionDroppedFiles = (files) => {
  const list = Array.from(files ?? []);
  return {
    candidates: list.filter(isImageFile),
    rejected: list.filter((file) => !isImageFile(file)).map((file) => file.name),
  };
};

export const getDropSummary = (items) => {
  const files = Array.from(items ?? []).filter((item) => item.kind === 'file');
  const ignored = files.filter((item) => item.type && !item.type.startsWith('image/')).length;
  return { state: getImageDropState(items), ignored };
};

const listNames = (names) => {
  const shown = names.slice(0, MAX_LISTED_NAMES).map((name) => `• ${name}`);
  if (names.length > MAX_LISTED_NAMES) {
    shown.push(`… et ${names.length - MAX_LISTED_NAMES} autre(s)`);
  }
  return shown.join('\n');
};

export const getImportMessage = ({ imported = 0, rejected = [], unreadable = [] }) => {
  if (!rejected.length && !unreadable.length) return null;
  const parts = [
    imported > 0
      ? `${imported} image${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}.`
      : 'Aucune image importée.',
  ];
  if (rejected.length) {
    parts.push(
      `${imported > 0 ? 'Fichiers ignorés' : 'Fichiers refusés'} (ce ne sont pas des images) :\n${listNames(rejected)}`,
    );
  }
  if (unreadable.length) {
    parts.push(`Images illisibles (fichier corrompu ou format non pris en charge) :\n${listNames(unreadable)}`);
  }
  if (!imported) parts.push('Les sujets déjà présents ne sont pas modifiés.');
  return parts.join('\n\n');
};