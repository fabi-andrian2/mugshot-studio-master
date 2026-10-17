import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isImageFile,
  partitionDroppedFiles,
  getDropSummary,
  getImportMessage,
} from '../src/domain/fileDrop.js';

const file = (name, type = '') => ({ name, type });
const item = (type, kind = 'file') => ({ kind, type });

test('image : reconnue par son type, ou par son extension si le type est absent', () => {
  assert.equal(isImageFile(file('a.png', 'image/png')), true);
  assert.equal(isImageFile(file('a.heic', 'image/heic')), true);
  assert.equal(isImageFile(file('photo.WEBP', '')), true);
  assert.equal(isImageFile(file('photo.jpg', 'application/octet-stream')), true);
  assert.equal(isImageFile(file('archive.avif')), true);
});

test('image : refusée si le type est connu et n\'est pas une image, ou sans extension d\'image', () => {
  assert.equal(isImageFile(file('notes.txt', 'text/plain')), false);
  assert.equal(isImageFile(file('faux.png', 'application/pdf')), false);
  assert.equal(isImageFile(file('inconnu', '')), false);
  assert.equal(isImageFile(file('script.js', '')), false);
  assert.equal(isImageFile(file('.png', 'text/plain')), false);
  assert.equal(isImageFile(null), false);
  assert.equal(isImageFile(undefined), false);
});

test('dépôt : séparation des images candidates et des fichiers refusés, ordre conservé', () => {
  const png = file('a.png', 'image/png');
  const noType = file('b.webp', '');
  const { candidates, rejected } = partitionDroppedFiles([
    file('doc.pdf', 'application/pdf'),
    png,
    file('c.txt', 'text/plain'),
    noType,
  ]);
  assert.deepEqual(candidates, [png, noType]);
  assert.deepEqual(rejected, ['doc.pdf', 'c.txt']);
  assert.deepEqual(partitionDroppedFiles([]), { candidates: [], rejected: [] });
  assert.deepEqual(partitionDroppedFiles(undefined), { candidates: [], rejected: [] });
});

test('survol : état et nombre de fichiers non image signalés', () => {
  assert.deepEqual(getDropSummary([item('image/png')]), { state: 'accept', ignored: 0 });
  assert.deepEqual(getDropSummary([item('')]), { state: 'accept', ignored: 0 });
  assert.deepEqual(getDropSummary([item('image/png'), item('text/plain'), item('application/pdf')]), {
    state: 'accept',
    ignored: 2,
  });
  assert.deepEqual(getDropSummary([item('text/plain'), item('application/zip')]), { state: 'reject', ignored: 2 });
  assert.deepEqual(getDropSummary([item('text/plain', 'string')]), { state: 'accept', ignored: 0 });
  assert.deepEqual(getDropSummary(undefined), { state: 'accept', ignored: 0 });
});

test('message d\'import : aucun message quand tout est importé', () => {
  assert.equal(getImportMessage({ imported: 3, rejected: [], unreadable: [] }), null);
  assert.equal(getImportMessage({}), null);
});

test('message d\'import : dépôt sans aucune image', () => {
  const message = getImportMessage({ imported: 0, rejected: ['doc.pdf', 'notes.txt'], unreadable: [] });
  assert.match(message, /^Aucune image importée\./);
  assert.match(message, /Fichiers refusés \(ce ne sont pas des images\)/);
  assert.match(message, /• doc\.pdf\n• notes\.txt/);
  assert.match(message, /sujets déjà présents ne sont pas modifiés/);
});

test('message d\'import : dépôt mixte, images importées et fichiers ignorés', () => {
  const message = getImportMessage({ imported: 2, rejected: ['doc.pdf'], unreadable: [] });
  assert.match(message, /^2 images importées\./);
  assert.match(message, /Fichiers ignorés/);
  assert.doesNotMatch(message, /ne sont pas modifiés/);
  assert.match(getImportMessage({ imported: 1, rejected: ['a.pdf'], unreadable: [] }), /^1 image importée\./);
});

test('message d\'import : images illisibles distinguées des fichiers non image, liste tronquée', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => `${n}.png`);
  const message = getImportMessage({ imported: 0, rejected: [], unreadable: names });
  assert.match(message, /Images illisibles/);
  assert.doesNotMatch(message, /ce ne sont pas des images/);
  assert.match(message, /• e\.png\n… et 2 autre\(s\)/);
  assert.doesNotMatch(message, /f\.png/);
});