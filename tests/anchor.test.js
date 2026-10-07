import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getVisibleSizePx,
  getMeasuredHeightPx,
  getSubjectHeightCm,
  getSubjectGeometry,
  getScaleForHeightCm,
  getAnchorUpdateForCanvasPoint,
} from '../src/domain/geometry.js';
import { findOpaqueBounds, estimateGroundAnchor } from '../src/domain/opaqueBounds.js';
import { createSubject } from '../src/domain/subjects.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} différent de ${expected}`);

const FLOOR_Y = 2000;

const perspective = {
  x: 700,
  y: 0,
  scale: 1,
  flipX: false,
  naturalW: 1000,
  naturalH: 2000,
  visibleBounds: { left: 0.25, top: 0.05, right: 0.75, bottom: 0.98 },
  groundAnchor: { x: 0.45, y: 0.95 },
};

const withScale = (subject, scale) => ({ ...subject, scale });

test('la zone visible et le repère d\'appui sont deux notions distinctes', () => {
  close(getVisibleSizePx(perspective).height, 1860);
  close(getMeasuredHeightPx(perspective), 1800);
});

test('perspective : 180 cm se mesurent du repère au sommet, pas du pixel le plus bas', () => {
  const scale = getScaleForHeightCm(perspective, 180);
  close(scale, 0.8);
  close(getSubjectHeightCm(withScale(perspective, scale)), 180);
  close((getVisibleSizePx(perspective).height * scale) / 8, 186);
});

test('le repère est sur le sol et le bas visible dépasse sous le sol sans être coupé', () => {
  const subject = withScale(perspective, 0.8);
  const { anchor, visible } = getSubjectGeometry(subject, FLOOR_Y);
  close(anchor.y, FLOOR_Y);
  close(visible.top + visible.height - FLOOR_Y, 0.03 * 2000 * 0.8);
});

test('le sommet de la tête est à 180 cm au-dessus du sol', () => {
  const { visible } = getSubjectGeometry(withScale(perspective, 0.8), FLOOR_Y);
  close(FLOOR_Y - visible.top, 180 * 8);
});

test('changer la hauteur conserve le repère au sol', () => {
  const at180 = getSubjectGeometry(withScale(perspective, getScaleForHeightCm(perspective, 180)), FLOOR_Y);
  const at150 = getSubjectGeometry(withScale(perspective, getScaleForHeightCm(perspective, 150)), FLOOR_Y);
  close(at180.anchor.y, FLOOR_Y);
  close(at150.anchor.y, FLOOR_Y);
  close(FLOOR_Y - at150.visible.top, 150 * 8);
});

test('un repère surélevé place le sujet au-dessus du sol (y positif)', () => {
  const { anchor, visible } = getSubjectGeometry({ ...withScale(perspective, 0.8), y: 100 }, FLOOR_Y);
  close(anchor.y, FLOOR_Y - 100);
  close(FLOOR_Y - 100 - visible.top, 1440);
});

const exportPoint = (subject, point) => {
  const g = getSubjectGeometry(subject, FLOOR_Y);
  const sign = subject.flipX ? -1 : 1;
  return {
    x: g.box.left + g.originX + sign * (point.x * g.box.width - g.originX),
    y: g.box.top + point.y * g.box.height,
  };
};

test('cohérence écran / export : l\'équation de dessin retombe sur le repère et le sommet', () => {
  [false, true].forEach((flipX) => {
    const subject = { ...withScale(perspective, 0.8), flipX };
    const g = getSubjectGeometry(subject, FLOOR_Y);
    const anchorDrawn = exportPoint(subject, subject.groundAnchor);
    close(anchorDrawn.x, g.anchor.x);
    close(anchorDrawn.y, g.anchor.y);
    const centerTop = exportPoint(subject, { x: 0.5, y: subject.visibleBounds.top });
    close(centerTop.y, g.visible.top);
    close(centerTop.x, subject.x);
  });
});

test('le miroir retourne le repère autour de l\'axe vertical du sujet', () => {
  const normal = getSubjectGeometry(withScale(perspective, 0.8), FLOOR_Y);
  const flipped = getSubjectGeometry({ ...withScale(perspective, 0.8), flipX: true }, FLOOR_Y);
  close(normal.anchor.x + flipped.anchor.x, 2 * perspective.x);
  close(normal.anchor.y, flipped.anchor.y);
});

test('déplacer le repère ne bouge pas l\'image', () => {
  [false, true].forEach((flipX) => {
    const subject = { ...withScale(perspective, 0.8), flipX };
    const before = getSubjectGeometry(subject, FLOOR_Y);
    const target = { x: before.box.left + 300, y: before.box.top + 1400 };
    const update = getAnchorUpdateForCanvasPoint(subject, FLOOR_Y, target);
    const after = getSubjectGeometry({ ...subject, ...update }, FLOOR_Y);
    ['left', 'top', 'width', 'height'].forEach((key) => close(after.box[key], before.box[key]));
    close(after.anchor.y, target.y);
    close(update.y, FLOOR_Y - target.y);
  });
});

test('le repère reste dans l\'image et sous le sommet', () => {
  const update = getAnchorUpdateForCanvasPoint(withScale(perspective, 0.8), FLOOR_Y, { x: -5000, y: -5000 });
  assert.ok(update.groundAnchor.x >= 0 && update.groundAnchor.x <= 1);
  assert.ok(update.groundAnchor.y > perspective.visibleBounds.top);
});

const paint = (data, width, x0, y0, x1, y1) => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) data[(y * width + x) * 4 + 3] = 255;
  }
};

test('estimation du repère : le bout du pied plus bas ne l\'emporte pas sur la semelle', () => {
  const width = 10;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);
  paint(data, width, 2, 2, 7, 96);
  paint(data, width, 8, 91, 9, 99);
  const bounds = findOpaqueBounds(data, width, height, 20);
  const anchor = estimateGroundAnchor(data, width, height, 20, bounds);
  close(bounds.bottom, 1);
  close(anchor.y, 0.97);
  close(anchor.x, 0.6);
  assert.ok(anchor.y < bounds.bottom);
});

test('estimation du repère : pied plat, le repère est le bas visible', () => {
  const width = 10;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);
  paint(data, width, 3, 5, 6, 94);
  const bounds = findOpaqueBounds(data, width, height, 20);
  const anchor = estimateGroundAnchor(data, width, height, 20, bounds);
  close(anchor.y, bounds.bottom);
});

test('création d\'un sujet : 170 cm mesurés depuis le repère', () => {
  const subject = createSubject(
    {
      id: 'a',
      url: 'blob:x',
      fileName: 'perspective.png',
      naturalW: 1000,
      naturalH: 2000,
      visibleBounds: perspective.visibleBounds,
      groundAnchor: perspective.groundAnchor,
    },
    { index: 0, canvasW: 1400, zIndex: 1 },
  );
  close(getSubjectHeightCm(subject), 170);
  assert.deepEqual(subject.groundAnchor, perspective.groundAnchor);
  const { anchor } = getSubjectGeometry(subject, FLOOR_Y);
  close(anchor.y, FLOOR_Y);
});