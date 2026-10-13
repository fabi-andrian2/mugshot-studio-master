export const dragCarriesFiles = (types) => Array.from(types ?? []).includes('Files');

export const getImageDropState = (items) => {
  const files = Array.from(items ?? []).filter((item) => item.kind === 'file');
  const allUnsupported =
    files.length > 0 && files.every((item) => item.type && !item.type.startsWith('image/'));
  return allUnsupported ? 'reject' : 'accept';
};

export const pickImageFile = (files) =>
  Array.from(files ?? []).find((file) => file.type && file.type.startsWith('image/')) ?? null;