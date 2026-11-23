import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTrackedUrl,
  revokeTrackedUrl,
  revokeAllTrackedUrls,
  getTrackedUrlCount,
} from '../src/services/objectUrls.js';

const patch = () => {
  const created = [];
  const revoked = [];
  const original = { c: URL.createObjectURL, r: URL.revokeObjectURL };
  URL.createObjectURL = () => {
    const url = `blob:test/${created.length}`;
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url) => revoked.push(url);
  return { created, revoked, restore: () => Object.assign(URL, { createObjectURL: original.c, revokeObjectURL: original.r }) };
};

test('création, révocation unitaire et révocation globale', () => {
  const p = patch();
  try {
    revokeAllTrackedUrls();
    const a = createTrackedUrl(new Blob(['a']));
    const b = createTrackedUrl(new Blob(['b']));
    const c = createTrackedUrl(new Blob(['c']));
    assert.equal(getTrackedUrlCount(), 3);
    revokeTrackedUrl(b);
    assert.equal(getTrackedUrlCount(), 2);
    assert.equal(revokeAllTrackedUrls(), 2);
    assert.equal(getTrackedUrlCount(), 0);
    assert.deepEqual(p.revoked.sort(), [a, b, c].sort());
    assert.equal(revokeAllTrackedUrls(), 0);
  } finally {
    p.restore();
  }
});
