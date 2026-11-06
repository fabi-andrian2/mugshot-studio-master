import { getSubjectGeometry } from './geometry.js';
import { isSubjectVisible } from './appearance.js';
import { stepsToCssTransform } from './rotation.js';

export const SHADOW_PRESETS = [
  { id: 'natural', label: 'Naturel', values: { intensity: 40, length: 20, softness: 40 } },
  { id: 'studio', label: 'Studio', values: { intensity: 65, length: 45, softness: 15 } },
  { id: 'soft', label: 'Doux', values: { intensity: 35, length: 35, softness: 85 } },
];

export const SHADOW_PRESET_IDS = [...SHADOW_PRESETS.map((preset) => preset.id), 'custom'];

export const DEFAULT_SHADOWS = {
  enabled: true,
  preset: 'natural',
  direction: 300,
  intensity: 40,
  length: 20,
  softness: 40,
};

export const LEGACY_SHADOWS = { ...DEFAULT_SHADOWS, enabled: false };

const PARAMETERS = ['intensity', 'length', 'softness'];

const CAST_MAX_ALPHA = 0.65;
const CONTACT_MAX_ALPHA = 0.9;
const MIN_REACH = 0.06;
const MAX_REACH = 0.9;
const DEPTH_FORESHORTENING = 0.45;
const DEPTH_BIAS = 0.12;
const MIN_BLUR = 2;
const MAX_BLUR = 30;
const CONTACT_WIDTH_RATIO = 0.32;
const CONTACT_HEIGHT_RATIO = 0.2;
const CONTACT_PUSH_RATIO = 0.25;
const TIP_ALPHA = 0.25;

export const SHADOW_CLIP_EXTENT = 50000;

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeDirection = (value) => {
  if (!isNum(value)) return DEFAULT_SHADOWS.direction;
  const wrapped = ((value % 360) + 360) % 360;
  return wrapped;
};

export const normalizeShadows = (value) => {
  const source = value !== null && typeof value === 'object' ? value : {};
  const next = {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_SHADOWS.enabled,
    preset: SHADOW_PRESET_IDS.includes(source.preset) ? source.preset : DEFAULT_SHADOWS.preset,
    direction: normalizeDirection(source.direction),
  };
  PARAMETERS.forEach((key) => {
    next[key] = isNum(source[key]) ? clamp(source[key], 0, 100) : DEFAULT_SHADOWS[key];
  });
  const preset = SHADOW_PRESETS.find((item) => item.id === next.preset);
  return preset ? { ...next, ...preset.values } : next;
};

export const applyShadowPreset = (settings, presetId) => {
  const preset = SHADOW_PRESETS.find((item) => item.id === presetId);
  if (!preset) return { ...settings, preset: 'custom' };
  return { ...settings, preset: preset.id, ...preset.values };
};

export const updateShadows = (settings, patch) => {
  const next = { ...settings };
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
  if (isNum(patch.direction)) next.direction = normalizeDirection(patch.direction);
  PARAMETERS.forEach((key) => {
    if (isNum(patch[key])) {
      next[key] = clamp(patch[key], 0, 100);
      next.preset = 'custom';
    }
  });
  return next;
};

export const getShadowStyle = (settings) => {
  const intensity = settings.intensity / 100;
  const blur = MIN_BLUR + (MAX_BLUR - MIN_BLUR) * (settings.softness / 100);
  return {
    castOpacity: CAST_MAX_ALPHA * intensity,
    castBlur: blur,
    contactOpacity: CONTACT_MAX_ALPHA * intensity,
    contactBlur: 1 + blur * 0.35,
    reach: MIN_REACH + (MAX_REACH - MIN_REACH) * (settings.length / 100),
  };
};

export const getShadowDirection = (lightDirection) => {
  const radians = (normalizeDirection(lightDirection) * Math.PI) / 180;
  return { x: -Math.sin(radians), y: Math.cos(radians) };
};

export const getProjection = ({ lineY, direction, reach }) => {
  const shadow = getShadowDirection(direction);
  const kx = reach * shadow.x;
  const ky = reach * (DEPTH_FORESHORTENING * shadow.y + DEPTH_BIAS);
  return { a: 1, b: 0, c: -kx, d: -ky, e: lineY * kx, f: lineY * (1 + ky) };
};

export const projectPoint = (matrix, point) => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.e,
  y: matrix.b * point.x + matrix.d * point.y + matrix.f,
});

const round = (value) => Math.round(value * 1e6) / 1e6;

export const projectionToCss = (matrix) =>
  `matrix(${[matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].map(round).join(', ')})`;

export const getSpriteTransformCss = (plan) => {
  const steps = stepsToCssTransform(plan.transformSteps, { left: 0, top: 0 });
  return `${steps ?? ''} translate(${round(plan.box.left)}px, ${round(plan.box.top)}px)`.trim();
};

export const getShadowPlan = (subject, floorY, settings) => {
  if (!settings.enabled || !isSubjectVisible(subject)) return null;

  const { box, visible, anchor, transformSteps } = getSubjectGeometry(subject, floorY);
  const style = getShadowStyle(settings);
  const direction = getShadowDirection(settings.direction);
  const bounds = subject.visibleBounds ?? { left: 0, top: 0, right: 1, bottom: 1 };
  const ground = subject.groundAnchor ?? { x: 0.5, y: bounds.bottom };
  const radiusX = visible.width * CONTACT_WIDTH_RATIO;
  const radiusY = radiusX * CONTACT_HEIGHT_RATIO;

  return {
    id: subject.id,
    url: subject.url,
    box,
    transformSteps,
    clipY: anchor.y,
    projection: getProjection({ lineY: anchor.y, direction: settings.direction, reach: style.reach }),
    fade: { top: bounds.top, ground: Math.max(bounds.top, ground.y), tipAlpha: TIP_ALPHA },
    contact: {
      cx: anchor.x + direction.x * radiusX * CONTACT_PUSH_RATIO,
      cy: anchor.y,
      rx: radiusX,
      ry: radiusY,
    },
  };
};

export const getShadowPlans = (subjects, floorY, settings) => {
  if (!settings.enabled) return null;
  const items = [...subjects]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((subject) => getShadowPlan(subject, floorY, settings))
    .filter(Boolean);
  if (items.length === 0) return null;
  return { style: getShadowStyle(settings), items };
};
