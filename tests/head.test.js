import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMeasuredHeightPx,
  getSubjectHeightCm,
  getSubjectGeometry,
  getScaleForHeightCm,
  getAnchorUpdateForCanvasPoint,
  getHeadUpdateForCanvasPoint,
} from '../src/domain/geometry.js';
import { findOpaqueBounds, estimateHeadAnchor } from '../src/domain/opaqueBounds.js';
import { createSubject, renameSubject, getLayerEntries } from '../src/domain/subjects.js';
import { getAnnotationItems } from '../src/domain/annotations.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} différent de ${expected}`);

const FLOOR_Y = 2000;

const withHair = {
  x: 700,
  y: 0,
  scale: 1,
  flipX: false,
  naturalW: 1000,
  naturalH: 2000,
  visibleBounds: { left: 0.25, top: 0.04, right: 0.75, bottom: 0.98 },
  groundAnchor: { x: 0.45, y: 0.95 },
  headAnchor: { x: 0.52, y: 0.1 },
};

const withScale = (subject, scale) => ({ ...subject, scale });
const at180 = () => withScale(withHair, getScaleForHeightCm(withHair, 180));

test('cheveux : la hauteur se mesure entre le repère de tête et le repère d\'appui', () => {
  close(getMeasuredHeightPx(withHair), 1700);
  const subject = at180();
  close(getSubjectHeightCm(subject), 180);
  const { head, anchor } = getSubjectGeometry(subject, FLOOR_Y);
  close(anchor.y, FLOOR_Y);
  close(FLOOR_Y - head.y, 180 * 8);
});

test('cheveux : ils dépassent au-dessus de 180 cm sans être coupés ni déformés', () => {
  const subject = at180();
  const { head, visible, box } = getSubjectGeometry(subject, FLOOR_Y);
  assert.ok(visible.top < head.y);
  close(head.y - visible.top, (0.1 - 0.04) * 2000 * subject.scale);
  close(visible.height, (0.98 - 0.04) * 2000 * subject.scale);
  close(box.width / box.height, 1000 / 2000);
});

test('la hauteur ne dépend plus de visibleBounds.top', () => {
  const higherHair = { ...withHair, visibleBounds: { ...withHair.visibleBounds, top: 0 } };
  close(getMeasuredHeightPx(higherHair), getMeasuredHeightPx(withHair));
  close(getScaleForHeightCm(higherHair, 180), getScaleForHeightCm(withHair, 180));
});

test('changer la hauteur garde les deux repères au même endroit de l\'image', () => {
  [150, 180, 195].forEach((cm) => {
    const subject = withScale(withHair, getScaleForHeightCm(withHair, cm));
    const g = getSubjectGeometry(subject, FLOOR_Y);
    close((g.anchor.y - g.box.top) / g.box.height, withHair.groundAnchor.y);
    close((g.head.y - g.box.top) / g.box.height, withHair.headAnchor.y);
    close(g.anchor.y, FLOOR_Y);
  });
});

test('déplacer le repère de tête ne bouge ni l\'image ni le repère d\'appui', () => {
  [false, true].forEach((flipX) => {
    const subject = { ...at180(), flipX };
    const before = getSubjectGeometry(subject, FLOOR_Y);
    const target = { x: before.box.left + 350, y: before.box.top + 400 };
    const update = getHeadUpdateForCanvasPoint(subject, FLOOR_Y, target);
    const after = getSubjectGeometry({ ...subject, ...update }, FLOOR_Y);
    ['left', 'top', 'width', 'height'].forEach((key) => close(after.box[key], before.box[key]));
    close(after.head.y, target.y);
    close(after.anchor.x, before.anchor.x);
    close(after.anchor.y, before.anchor.y);
    assert.equal(update.y, undefined);
  });
});

test('le repère de tête reste au-dessus du repère d\'appui', () => {
  const update = getHeadUpdateForCanvasPoint(at180(), FLOOR_Y, { x: 700, y: 99999 });
  assert.ok(update.headAnchor.y < withHair.groundAnchor.y);
});

test('le repère d\'appui ne peut pas passer au-dessus du repère de tête', () => {
  const update = getAnchorUpdateForCanvasPoint(at180(), FLOOR_Y, { x: 700, y: -99999 });
  assert.ok(update.groundAnchor.y > withHair.headAnchor.y);
});

const exportPoint = (subject, point) => {
  const g = getSubjectGeometry(subject, FLOOR_Y);
  const sign = subject.flipX ? -1 : 1;
  return {
    x: g.box.left + g.originX + sign * (point.x * g.box.width - g.originX),
    y: g.box.top + point.y * g.box.height,
  };
};

test('cohérence écran / export avec repère de tête, repère d\'appui et miroir', () => {
  [false, true].forEach((flipX) => {
    const subject = { ...at180(), flipX };
    const g = getSubjectGeometry(subject, FLOOR_Y);
    const ground = exportPoint(subject, subject.groundAnchor);
    const head = exportPoint(subject, subject.headAnchor);
    close(ground.x, g.anchor.x);
    close(ground.y, g.anchor.y);
    close(head.x, g.head.x);
    close(head.y, g.head.y);
  });
});

test('le miroir retourne le repère de tête autour de l\'axe du sujet', () => {
  const normal = getSubjectGeometry(at180(), FLOOR_Y);
  const flipped = getSubjectGeometry({ ...at180(), flipX: true }, FLOOR_Y);
  close(normal.head.x + flipped.head.x, 2 * withHair.x);
  close(normal.head.y, flipped.head.y);
});

const paint = (data, width, x0, y0, x1, y1) => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) data[(y * width + x) * 4 + 3] = 255;
  }
};

test('estimation de la tête : une mèche fine est ignorée', () => {
  const width = 200;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);
  paint(data, width, 50, 20, 149, 90);
  paint(data, width, 100, 10, 101, 19);
  const bounds = findOpaqueBounds(data, width, height, 20);
  const head = estimateHeadAnchor(data, width, height, 20, bounds);
  close(bounds.top, 0.1);
  close(head.y, 0.2);
  assert.ok(head.y > bounds.top);
  close(head.x, 0.5, 0.01);
});

test('estimation de la tête : sans mèche, le repère est le haut visible', () => {
  const width = 200;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);
  paint(data, width, 50, 20, 149, 90);
  const bounds = findOpaqueBounds(data, width, height, 20);
  close(estimateHeadAnchor(data, width, height, 20, bounds).y, bounds.top);
});

const image = {
  id: 'a',
  url: 'blob:x',
  fileName: 'subject_01.png',
  naturalW: 1000,
  naturalH: 2000,
  visibleBounds: withHair.visibleBounds,
  groundAnchor: withHair.groundAnchor,
  headAnchor: withHair.headAnchor,
};

test('création : nom d\'affichage dérivé du fichier, fileName conservé', () => {
  const subject = createSubject(image, { index: 0, canvasW: 1400, zIndex: 1 });
  assert.equal(subject.name, 'Subject 01');
  assert.equal(subject.fileName, 'subject_01.png');
  close(getSubjectHeightCm(subject), 170);
  assert.deepEqual(subject.headAnchor, withHair.headAnchor);
});

test('renommage : le nom change, le fichier source reste inchangé', () => {
  const subject = createSubject(image, { index: 0, canvasW: 1400, zIndex: 1 });
  const renamed = renameSubject(subject, '  John Doe  ');
  assert.equal(renamed.name, 'John Doe');
  assert.equal(renamed.fileName, 'subject_01.png');
  assert.equal(renameSubject(subject, '   ').name, 'Subject 01');
});

test('renommage : le nom modifié est utilisé dans les annotations', () => {
  const subject = renameSubject(createSubject(image, { index: 0, canvasW: 1400, zIndex: 1 }), 'John Doe');
  const tall = { ...subject, scale: getScaleForHeightCm(subject, 180) };
  const [item] = getAnnotationItems({
    subjects: [tall],
    selectedId: tall.id,
    annotations: { enabled: true, scope: 'selected' },
    floorY: FLOOR_Y,
    unit: 'cm',
  });
  assert.equal(item.text, 'JOHN DOE · 180 cm');
});

test('renommage : le nom modifié est utilisé dans les calques', () => {
  const first = createSubject(image, { index: 0, canvasW: 1400, zIndex: 1 });
  const second = renameSubject(createSubject({ ...image, id: 'b', fileName: 'other.png' }, { index: 1, canvasW: 1400, zIndex: 2 }), 'John Doe');
  const entries = getLayerEntries([first, second]);
  assert.deepEqual(entries.map((entry) => entry.label), ['John Doe', 'Subject 01']);
  assert.ok(entries.every((entry) => !entry.label.endsWith('.png')));
});

test('la ligne d\'annotation suit le repère de tête, pas le haut des cheveux', () => {
  const subject = at180();
  const [item] = getAnnotationItems({
    subjects: [{ ...subject, id: 'h', name: 'Kira' }],
    selectedId: 'h',
    annotations: { enabled: true, scope: 'selected' },
    floorY: FLOOR_Y,
    unit: 'cm',
  });
  const { head, visible } = getSubjectGeometry(subject, FLOOR_Y);
  close(item.lineY, head.y);
  assert.ok(item.lineY > visible.top);
});