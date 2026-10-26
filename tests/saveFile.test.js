import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPngFileName,
  isTauriRuntime,
  saveBlobWithTauri,
  savePngBlob,
} from '../src/services/saveFile.js';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128, 1]);
const makeBlob = () => new Blob([PNG_BYTES], { type: 'image/png' });

const makeLoaders = (options = {}) => {
  const savedPath = 'savedPath' in options ? options.savedPath : 'C:\\Planches\\test.png';
  const { writeError = null, saveError = null } = options;
  const calls = { save: [], write: [] };
  return {
    calls,
    loadDialog: async () => ({
      save: async (options) => {
        calls.save.push(options);
        if (saveError) throw saveError;
        return savedPath;
      },
    }),
    loadFs: async () => ({
      writeFile: async (path, data) => {
        calls.write.push({ path, data });
        if (writeError) throw writeError;
      },
    }),
  };
};

test('enregistrement : nom de fichier horodaté à l\'heure locale', () => {
  assert.equal(buildPngFileName(new Date(2026, 9, 27, 0, 46, 5)), 'Mugshot_Studio_20261027_004605.png');
  assert.equal(buildPngFileName(new Date(2026, 0, 2, 13, 4, 9)), 'Mugshot_Studio_20260102_130409.png');
});

test('enregistrement : l\'environnement Tauri est reconnu seulement s\'il expose son pont', () => {
  assert.equal(isTauriRuntime({}), false);
  assert.equal(isTauriRuntime({ __TAURI_INTERNALS__: {} }), true);
});

test('enregistrement : le navigateur garde le téléchargement, sans appel natif', async () => {
  const blob = makeBlob();
  const calls = [];
  const result = await savePngBlob(blob, {
    fileName: 'a.png',
    isNative: false,
    nativeSave: async () => assert.fail('le chemin natif ne doit pas être utilisé'),
    browserSave: (b, name) => {
      calls.push([b, name]);
      return { status: 'downloaded' };
    },
  });

  assert.deepEqual(result, { status: 'downloaded' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], blob);
  assert.equal(calls[0][1], 'a.png');
});

test('enregistrement : sous Tauri, le chemin natif est utilisé sans téléchargement navigateur', async () => {
  const blob = makeBlob();
  const result = await savePngBlob(blob, {
    fileName: 'b.png',
    isNative: true,
    nativeSave: async (b, name) => ({ status: 'saved', path: `D:\\${name}`, same: b === blob }),
    browserSave: () => assert.fail('le téléchargement navigateur ne doit pas être utilisé'),
  });

  assert.deepEqual(result, { status: 'saved', path: 'D:\\b.png', same: true });
});

test('enregistrement natif : la boîte propose le nom et le filtre PNG', async () => {
  const loaders = makeLoaders();
  await saveBlobWithTauri(makeBlob(), 'Mugshot_Studio_20261027_004605.png', loaders);

  assert.equal(loaders.calls.save.length, 1);
  assert.equal(loaders.calls.save[0].defaultPath, 'Mugshot_Studio_20261027_004605.png');
  assert.deepEqual(loaders.calls.save[0].filters, [{ name: 'Image PNG', extensions: ['png'] }]);
});

test('enregistrement natif : les octets PNG sont écrits à l\'identique au chemin choisi', async () => {
  const loaders = makeLoaders({ savedPath: 'E:\\Export\\planche.png' });
  const result = await saveBlobWithTauri(makeBlob(), 'x.png', loaders);

  assert.deepEqual(result, { status: 'saved', path: 'E:\\Export\\planche.png' });
  assert.equal(loaders.calls.write.length, 1);
  assert.equal(loaders.calls.write[0].path, 'E:\\Export\\planche.png');
  assert.ok(loaders.calls.write[0].data instanceof Uint8Array);
  assert.deepEqual([...loaders.calls.write[0].data], [...PNG_BYTES]);
});

test('enregistrement natif : la fermeture de la boîte annule sans rien écrire', async () => {
  for (const cancelled of [null, undefined, '']) {
    const loaders = makeLoaders({ savedPath: cancelled });
    const result = await saveBlobWithTauri(makeBlob(), 'x.png', loaders);

    assert.deepEqual(result, { status: 'cancelled' });
    assert.equal(loaders.calls.write.length, 0);
  }
});

test('enregistrement natif : une écriture refusée produit une erreur explicite avec le chemin', async () => {
  const loaders = makeLoaders({ writeError: new Error('forbidden path') });

  await assert.rejects(
    () => saveBlobWithTauri(makeBlob(), 'x.png', loaders),
    (error) => {
      assert.match(error.message, /Écriture impossible/);
      assert.match(error.message, /C:\\Planches\\test\.png/);
      assert.match(error.message, /forbidden path/);
      assert.equal(error.cause.message, 'forbidden path');
      return true;
    },
  );
});

test('enregistrement natif : une boîte de dialogue en échec n\'écrit rien et propage l\'erreur', async () => {
  const loaders = makeLoaders({ saveError: new Error('dialog failed') });

  await assert.rejects(() => saveBlobWithTauri(makeBlob(), 'x.png', loaders), /dialog failed/);
  assert.equal(loaders.calls.write.length, 0);
});

test('enregistrement natif : un plugin indisponible est signalé sans écriture', async () => {
  await assert.rejects(
    () =>
      saveBlobWithTauri(makeBlob(), 'x.png', {
        loadDialog: async () => {
          throw new Error('plugin missing');
        },
      }),
    /plugin missing/,
  );
});
