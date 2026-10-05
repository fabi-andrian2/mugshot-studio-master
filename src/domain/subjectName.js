const EXTENSION = /\.[a-z0-9]{1,5}$/i;
const UUID_SUFFIX = /[\s_-]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const cleanSubjectName = (fileName) => {
  const withoutExtension = fileName.replace(EXTENSION, '');
  const withoutUuid = withoutExtension.replace(UUID_SUFFIX, '');
  const spaced = withoutUuid.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  const base = spaced || 'Sujet';
  if (/[A-Z]/.test(base)) return base;
  return base.replace(/(^|\s)(\p{L})/gu, (match, separator, letter) => separator + letter.toUpperCase());
};