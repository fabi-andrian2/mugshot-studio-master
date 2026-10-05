const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Chargement impossible : ${src}`));
    img.src = src;
  });

export default loadImage;