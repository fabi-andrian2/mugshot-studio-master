import loadImage from './loadImage.js';

export const loadBackgroundImage = async (file) => {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Le fichier choisi n\'est pas une image.');
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('Image de fond sans dimensions.');
    }
    return { url, width: img.naturalWidth, height: img.naturalHeight, fileName: file.name };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

export const releaseBackgroundImage = (image) => {
  if (image) URL.revokeObjectURL(image.url);
};