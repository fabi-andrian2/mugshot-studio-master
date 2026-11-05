export const DEFAULT_ROTATION = 0;

const EPSILON = 1e-9;

export const normalizeAngle = (degrees) => {
  const value = typeof degrees === 'number' ? degrees : Number.NaN;
  if (!Number.isFinite(value)) return DEFAULT_ROTATION;
  const wrapped = ((value % 360) + 360) % 360;
  const normalized = wrapped > 180 ? wrapped - 360 : wrapped;
  return normalized === 0 ? 0 : normalized;
};

export const getRotation = (subject) => normalizeAngle(subject?.rotation);

export const isRotated = (subject) => Math.abs(getRotation(subject)) > EPSILON;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const rotatePoint = (point, pivot, degrees) => {
  if (degrees === 0) return { x: point.x, y: point.y };
  const radians = toRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
};

export const unrotatePoint = (point, pivot, degrees) => rotatePoint(point, pivot, -degrees);

export const getBoundsOfPoints = (points) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
};

export const buildSubjectTransform = ({ pivot, flipAxisX, flipped, rotation }) => {
  const steps = [];
  if (!flipped && Math.abs(rotation) <= EPSILON) return steps;

  if (Math.abs(rotation) > EPSILON) {
    steps.push({ op: 'translate', x: pivot.x, y: pivot.y });
    steps.push({ op: 'rotate', degrees: rotation });
    steps.push({ op: 'translate', x: -pivot.x, y: -pivot.y });
  }
  if (flipped) {
    steps.push({ op: 'translate', x: flipAxisX, y: 0 });
    steps.push({ op: 'scale', x: -1, y: 1 });
    steps.push({ op: 'translate', x: -flipAxisX, y: 0 });
  }
  return steps;
};

export const applyStepsToPoint = (steps, point) => {
  let current = point;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step.op === 'translate') current = { x: current.x + step.x, y: current.y + step.y };
    else if (step.op === 'scale') current = { x: current.x * step.x, y: current.y * step.y };
    else current = rotatePoint(current, { x: 0, y: 0 }, step.degrees);
  }
  return current;
};

const round = (value) => Math.round(value * 1e6) / 1e6;

export const stepsToCssTransform = (steps, element) => {
  if (steps.length === 0) return undefined;
  const parts = [`translate(${round(-element.left)}px, ${round(-element.top)}px)`];
  steps.forEach((step) => {
    if (step.op === 'translate') parts.push(`translate(${round(step.x)}px, ${round(step.y)}px)`);
    else if (step.op === 'scale') parts.push(`scale(${step.x}, ${step.y})`);
    else parts.push(`rotate(${round(step.degrees)}deg)`);
  });
  parts.push(`translate(${round(element.left)}px, ${round(element.top)}px)`);
  return parts.join(' ');
};

export const applyStepsToContext = (ctx, steps) => {
  steps.forEach((step) => {
    if (step.op === 'translate') ctx.translate(step.x, step.y);
    else if (step.op === 'scale') ctx.scale(step.x, step.y);
    else ctx.rotate(toRadians(step.degrees));
  });
};
