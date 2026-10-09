import { getCoverRect } from '../../domain/board.js';

const BackgroundLayer = ({ image, canvasW, canvasH }) => {
  if (!image) return null;

  const rect = getCoverRect(image.width, image.height, canvasW, canvasH);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <img
        src={image.url}
        alt=""
        draggable="false"
        className="absolute max-w-none"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      />
    </div>
  );
};

export default BackgroundLayer;