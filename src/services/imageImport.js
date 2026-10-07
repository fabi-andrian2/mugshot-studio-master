import { analyzeImage } from './imageBounds.js';

const readImageFile = async (file) => {
  const url = URL.createObjectURL(file);
  try {
    const analysis = await analyzeImage(url);
    if (analysis.isEmpty) console.warn(`Image entièrement transparente : ${file.name}`);
    return { id: crypto.randomUUID(), url, fileName: file.name, ...analysis };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

export const importImageFiles = async (fileList) => {
  const files = Array.from(fileList);
  const imageFiles = files.filter((file) => file.type.startsWith('image/'));
  const failed = files.filter((file) => !file.type.startsWith('image/')).map((file) => file.name);

  const results = await Promise.allSettled(imageFiles.map(readImageFile));
  const images = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') images.push(result.value);
    else failed.push(imageFiles[index].name);
  });

  return { images, failed };
};