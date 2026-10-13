import test from 'node:test';
import assert from 'node:assert/strict';

import { dragCarriesFiles, getImageDropState, pickImageFile } from '../src/domain/fileDrop.js';
import { loadBackgroundImage } from '../src/services/backgroundImage.js';
import { DEFAULT_BOARD, setBackgroundImage } from '../src/domain/board.js';

const file = (name, type) => ({ name, type });
const item = (type, kind = 'file') => ({ kind, type });

const makeDeps = ({ width = 1920, height = 1080, fail = false } = {}) => {
  const created = [];
  const revoked = [];
  return {
    created,
    revoked,
    deps: {
      createUrl: (source) => {
        const url = `blob:${source.name}`;
        created.push(url);
        return url;
      },
      revokeUrl: (url) => revoked.push(url),
      load: async () => {
        if (fail) throw new Error('décodage impossible');
        return { naturalWidth: width, naturalHeight: height };
      },
    },
  };
};

test('dépôt : seul un glissement de fichiers est pris en compte', () => {
  assert.equal(dragCarriesFiles(['Files']), true);
  assert.equal(dragCarriesFiles(['text/plain', 'Files']), true);
  assert.equal(dragCarriesFiles(['text/plain']), false);
  assert.equal(dragCarriesFiles([]), false);
  assert.equal(dragCarriesFiles(undefined), false);
});

test('dépôt : retour visuel accepté pour une image, y compris type inconnu', () => {
  assert.equal(getImageDropState([item('image/png')]), 'accept');
  assert.equal(getImageDropState([item('image/webp')]), 'accept');
  assert.equal(getImageDropState([item('')]), 'accept');
  assert.equal(getImageDropState([]), 'accept');
  assert.equal(getImageDropState(undefined), 'accept');
});

test('dépôt : retour visuel refusé seulement si aucun fichier n\'est une image', () => {
  assert.equal(getImageDropState([item('application/pdf')]), 'reject');
  assert.equal(getImageDropState([item('text/plain'), item('application/zip')]), 'reject');
  assert.equal(getImageDropState([item('text/plain'), item('image/jpeg')]), 'accept');
  assert.equal(getImageDropState([item('text/plain', 'string')]), 'accept');
});

test('dépôt : le premier fichier image est retenu', () => {
  const png = file('fond.png', 'image/png');
  const jpg = file('autre.jpg', 'image/jpeg');
  assert.equal(pickImageFile([png, jpg]), png);
  assert.equal(pickImageFile([file('notes.txt', 'text/plain'), jpg]), jpg);
});

test('dépôt : aucun fichier image, aucune sélection', () => {
  assert.equal(pickImageFile([file('doc.pdf', 'application/pdf')]), null);
  assert.equal(pickImageFile([file('inconnu', '')]), null);
  assert.equal(pickImageFile([]), null);
  assert.equal(pickImageFile(undefined), null);
});

test('chargement du fond : une image valide donne ses dimensions et son nom', async () => {
  const { deps, created, revoked } = makeDeps({ width: 3000, height: 2000 });
  const image = await loadBackgroundImage(file('plage.png', 'image/png'), deps);

  assert.deepEqual(image, { url: 'blob:plage.png', width: 3000, height: 2000, fileName: 'plage.png' });
  assert.deepEqual(created, ['blob:plage.png']);
  assert.deepEqual(revoked, []);
});

test('chargement du fond : un fichier non image est refusé sans créer d\'URL', async () => {
  const { deps, created } = makeDeps();
  await assert.rejects(loadBackgroundImage(file('notes.txt', 'text/plain'), deps), /pas une image/);
  await assert.rejects(loadBackgroundImage(file('inconnu', ''), deps), /pas une image/);
  await assert.rejects(loadBackgroundImage(null, deps), /pas une image/);
  assert.deepEqual(created, []);
});

test('chargement du fond : une image illisible libère son URL et signale l\'erreur', async () => {
  const { deps, created, revoked } = makeDeps({ fail: true });
  await assert.rejects(loadBackgroundImage(file('cassee.png', 'image/png'), deps), /décodage impossible/);
  assert.deepEqual(revoked, created);
});

test('chargement du fond : une image sans dimensions est refusée et libérée', async () => {
  const { deps, created, revoked } = makeDeps({ width: 0, height: 0 });
  await assert.rejects(loadBackgroundImage(file('vide.png', 'image/png'), deps), /sans dimensions/);
  assert.deepEqual(revoked, created);
});

test('fond : une image invalide ne remplace pas l\'image valide de la planche', () => {
  const valid = { url: 'blob:a', width: 800, height: 600, fileName: 'a.png' };
  const board = setBackgroundImage(DEFAULT_BOARD, valid);

  assert.equal(setBackgroundImage(board, undefined), board);
  assert.equal(setBackgroundImage(board, { url: 'blob:b', width: 0, height: 0 }), board);
  assert.equal(board.background.image, valid);
});

test('fond : remplacer puis retirer l\'image conserve la couleur de fond', () => {
  const first = { url: 'blob:a', width: 800, height: 600, fileName: 'a.png' };
  const second = { url: 'blob:b', width: 1200, height: 900, fileName: 'b.png' };

  const withFirst = setBackgroundImage(DEFAULT_BOARD, first);
  const replaced = setBackgroundImage(withFirst, second);
  assert.equal(replaced.background.image, second);
  assert.equal(replaced.background.color, DEFAULT_BOARD.background.color);

  const removed = setBackgroundImage(replaced, null);
  assert.equal(removed.background.image, null);
  assert.equal(removed.background.color, DEFAULT_BOARD.background.color);
});