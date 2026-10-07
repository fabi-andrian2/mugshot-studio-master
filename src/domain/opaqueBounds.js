import { FOOT_BAND_RATIO, HEAD_MIN_ROW_RATIO } from './constants.js';

export const findOpaqueBounds = (data, width, height, threshold) => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[rowStart + x * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return {
    left: minX / width,
    top: minY / height,
    right: (maxX + 1) / width,
    bottom: (maxY + 1) / height,
  };
};

export const estimateGroundAnchor = (data, width, height, threshold, bounds, bandRatio = FOOT_BAND_RATIO) => {
  const left = Math.round(bounds.left * width);
  const right = Math.round(bounds.right * width);
  const top = Math.round(bounds.top * height);
  const bottom = Math.round(bounds.bottom * height);
  const bandRows = Math.max(1, Math.round((bottom - top) * bandRatio));
  const bandTop = Math.max(top, bottom - bandRows);

  const lowest = [];
  for (let x = left; x < right; x++) {
    for (let y = bottom - 1; y >= bandTop; y--) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        lowest.push({ x, row: y });
        break;
      }
    }
  }

  if (lowest.length === 0) {
    return { x: (bounds.left + bounds.right) / 2, y: bounds.bottom };
  }

  const rows = lowest.map((point) => point.row).sort((a, b) => a - b);
  const medianRow = rows[Math.floor((rows.length - 1) / 2)];
  const meanX = lowest.reduce((sum, point) => sum + point.x, 0) / lowest.length;

  return { x: (meanX + 0.5) / width, y: (medianRow + 1) / height };
};

export const estimateHeadAnchor = (data, width, height, threshold, bounds, minWidthRatio = HEAD_MIN_ROW_RATIO) => {
  const left = Math.round(bounds.left * width);
  const right = Math.round(bounds.right * width);
  const top = Math.round(bounds.top * height);
  const bottom = Math.round(bounds.bottom * height);
  const minCount = Math.max(1, Math.ceil((right - left) * minWidthRatio));

  for (let y = top; y < bottom; y++) {
    let count = 0;
    let sumX = 0;
    for (let x = left; x < right; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        count += 1;
        sumX += x;
      }
    }
    if (count >= minCount) {
      return { x: (sumX / count + 0.5) / width, y: y / height };
    }
  }

  return { x: (bounds.left + bounds.right) / 2, y: bounds.top };
};