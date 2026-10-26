import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('tailwind : index.html ne charge plus aucune ressource distante', () => {
  const html = read('../index.html');
  assert.doesNotMatch(html, /cdn\.jsdelivr|@tailwindcss\/browser/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /type="text\/tailwindcss"/);
  assert.match(html, /<script type="module" src="\/src\/main\.jsx">/);
});

test('tailwind : la feuille de styles est importée par le point d\'entrée et charge tailwindcss', () => {
  assert.match(read('../src/main.jsx'), /import '\.\/index\.css'/);
  assert.match(read('../src/index.css'), /@import "tailwindcss"/);
});

test('tailwind : la config Vite garde les réglages Tauri et ajoute le plugin', () => {
  const config = read('../vite.config.js');
  assert.match(config, /tailwindcss\(\)/);
  assert.match(config, /clearScreen: false/);
  assert.match(config, /port: 5173/);
  assert.match(config, /strictPort: true/);
  assert.match(config, /\*\*\/src-tauri\/\*\*/);
});
