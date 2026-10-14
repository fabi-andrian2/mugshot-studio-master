import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

const listSources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listSources(path) : /\.(jsx?|css)$/.test(name) ? [path] : [];
  });

const sources = listSources(srcDir).map((path) => readFileSync(path, 'utf8')).join('\n');

test('chaque animation utilisée dans le code est déclarée dans index.html', () => {
  const used = new Set([...sources.matchAll(/animate-([a-z-]+)/g)].map((m) => m[1]));
  assert.ok(used.size > 0);
  used.forEach((name) => {
    assert.ok(html.includes(`--animate-${name}:`), `animation manquante : ${name}`);
  });
});

test('prefers-reduced-motion neutralise animations et transitions', () => {
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /animation-duration: 0\.01ms !important/);
  assert.match(html, /transition-duration: 0\.01ms !important/);
});

test('aucune transition globale non ciblée', () => {
  assert.doesNotMatch(sources, /transition-all|transition:\s*all/);
  assert.doesNotMatch(html, /transition-all|transition:\s*all/);
});