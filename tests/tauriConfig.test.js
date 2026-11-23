import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const conf = readJson('../src-tauri/tauri.conf.json');
const capability = readJson('../src-tauri/capabilities/default.json');

test('identité Tauri inchangée : l’origine IndexedDB reste celle de l’ancienne version', () => {
  assert.equal(conf.identifier, 'mg.fabiandrian.mugshotstudio');
  assert.equal(conf.app.security?.useHttpsScheme, undefined);
  for (const window of conf.app.windows) {
    assert.equal(window.useHttpsScheme, undefined);
    assert.equal(window.dataDirectory, undefined);
    assert.equal(window.incognito, undefined);
    assert.equal(window.label, undefined);
  }
  assert.equal(conf.build.devUrl, 'http://localhost:5173');
});

test('capacité de la fenêtre principale : une seule permission ajoutée (destroy)', () => {
  assert.deepEqual(capability.windows, ['main']);
  assert.deepEqual(capability.permissions, [
    'core:default',
    'core:window:allow-destroy',
    'dialog:allow-save',
    'fs:allow-write-file',
  ]);
});

test('aucune permission élargie (pas de close/exit/wildcard)', () => {
  for (const permission of capability.permissions) {
    assert.ok(!permission.includes('*'));
    assert.ok(!permission.includes('allow-close'));
    assert.ok(!permission.includes('process'));
  }
});
