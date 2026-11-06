import { SHADOW_CLIP_EXTENT as FAR, getSpriteTransformCss, projectionToCss } from '../../domain/shadows.js';

const getMask = (plan) => {
  const { top, ground, tipAlpha } = plan.fade;
  return `url("${plan.url}"), linear-gradient(to bottom, rgba(0, 0, 0, ${tipAlpha}) ${top * 100}%, #000 ${ground * 100}%)`;
};

const CastShadow = ({ plan }) => {
  const mask = getMask(plan);
  return (
    <div
      className="absolute"
      style={{ left: 0, top: 0, width: 1, height: 1, transformOrigin: '0 0', transform: projectionToCss(plan.projection) }}
    >
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          clipPath: `polygon(-${FAR}px -${FAR}px, ${FAR}px -${FAR}px, ${FAR}px ${plan.clipY}px, -${FAR}px ${plan.clipY}px)`,
        }}
      >
        <div
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: plan.box.width,
            height: plan.box.height,
            transformOrigin: '0 0',
            transform: getSpriteTransformCss(plan),
            backgroundColor: '#000',
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        />
      </div>
    </div>
  );
};

const ShadowLayer = ({ shadows }) => {
  if (!shadows) return null;
  const { style, items } = shadows;

  return (
    <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 0 }} data-shadow-layer>
      <div
        className="absolute"
        style={{ left: 0, top: 0, width: 1, height: 1, filter: `blur(${style.castBlur}px)`, opacity: style.castOpacity }}
        data-shadow-cast
      >
        {items.map((plan) => (
          <CastShadow key={plan.id} plan={plan} />
        ))}
      </div>
      <div
        className="absolute"
        style={{ left: 0, top: 0, width: 1, height: 1, filter: `blur(${style.contactBlur}px)`, opacity: style.contactOpacity }}
        data-shadow-contact
      >
        {items.map((plan) => (
          <div
            key={plan.id}
            className="absolute"
            style={{
              left: plan.contact.cx - plan.contact.rx,
              top: plan.contact.cy - plan.contact.ry,
              width: plan.contact.rx * 2,
              height: plan.contact.ry * 2,
              borderRadius: '50%',
              backgroundColor: '#000',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ShadowLayer;
