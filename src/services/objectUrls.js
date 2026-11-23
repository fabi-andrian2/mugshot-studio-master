const live = new Set();

export const createTrackedUrl = (blob) => {
  const url = URL.createObjectURL(blob);
  live.add(url);
  return url;
};

export const revokeTrackedUrl = (url) => {
  live.delete(url);
  URL.revokeObjectURL(url);
};

export const revokeAllTrackedUrls = () => {
  const urls = [...live];
  live.clear();
  urls.forEach((url) => URL.revokeObjectURL(url));
  return urls.length;
};

export const getTrackedUrlCount = () => live.size;
