export const THUMBNAIL_MAX_SIDE = 320;

export const getThumbnailSize = (width, height, maxSide = THUMBNAIL_MAX_SIDE) => {
  if (!(width > 0) || !(height > 0)) return { width: maxSide, height: maxSide };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/** Réduit un canvas de rendu en miniature PNG (proportions conservées). */
export const canvasToThumbnailBlob = (canvas, maxSide = THUMBNAIL_MAX_SIDE) =>
  new Promise((resolve, reject) => {
    const size = getThumbnailSize(canvas.width, canvas.height, maxSide);
    const small = document.createElement('canvas');
    small.width = size.width;
    small.height = size.height;
    const ctx = small.getContext('2d');
    if (!ctx) {
      reject(new Error('Miniature impossible.'));
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, size.width, size.height);
    small.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Miniature impossible.'))),
      'image/png',
    );
  });
