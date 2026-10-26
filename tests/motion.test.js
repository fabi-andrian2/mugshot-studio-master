import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

const listSources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listSources(path) : /\.(jsx?|css)$/.test(name) ? [path] : [];
  });

const sources = listSources(srcDir).map((path) => readFileSync(path, 'utf8')).join('\n');

test('chaque animation utilisée dans le code est déclarée dans index.css', () => {
  const used = new Set([...sources.matchAll(/animate-([a-z-]+)/g)].map((m) => m[1]));
  assert.ok(used.size > 0);
  used.forEach((name) => {
    assert.ok(css.includes(`--animate-${name}:`), `animation manquante : ${name}`);
  });
});

test('prefers-reduced-motion neutralise animations et transitions', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration: 0\.01ms !important/);
  assert.match(css, /transition-duration: 0\.01ms !important/);
});

test('aucune transition globale non ciblée', () => {
  const forbidden = /transition-all|transition:\s*all/;
  const cssFiles = listSources(srcDir).filter((path) => path.endsWith('.css'));

  assert.ok(cssFiles.some((path) => path.endsWith('index.css')));
  cssFiles.forEach((path) => {
    assert.doesNotMatch(readFileSync(path, 'utf8'), forbidden, path);
  });
  assert.doesNotMatch(css, forbidden);
  assert.doesNotMatch(html, forbidden);
  assert.doesNotMatch(sources, forbidden);
});