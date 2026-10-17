import { analyzeImage } from './imageBounds.js';
import { partitionDroppedFiles } from '../domain/fileDrop.js';

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
  const { candidates, rejected } = partitionDroppedFiles(fileList);

  const results = await Promise.allSettled(candidates.map(readImageFile));
  const images = [];
  const unreadable = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') images.push(result.value);
    else unreadable.push(candidates[index].name);
  });

  return { images, rejected, unreadable };
};