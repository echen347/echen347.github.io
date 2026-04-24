// tests/chaewon/manifest.test.js
const test = require('node:test');
const assert = require('node:assert');

// Pure helpers extracted from chaewon.js
function parseManifest(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const out = { bubbles: [], gifs: [], mascots: [], stickers: [] };
  for (const cat of Object.keys(out)) {
    if (Array.isArray(data[cat])) {
      out[cat] = data[cat].filter(e => e && typeof e.file === 'string');
    }
  }
  return out;
}

function pickRandom(arr, n) {
  if (n >= arr.length) return [...arr];
  const copy = [...arr];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

test('parseManifest accepts valid manifest', () => {
  const m = parseManifest({
    bubbles: [{ file: 'bubbles/01.jpg', alt: 'a' }],
    gifs: [{ file: 'gifs/x.gif' }],
    mascots: [],
    stickers: [],
  });
  assert.strictEqual(m.bubbles.length, 1);
  assert.strictEqual(m.bubbles[0].file, 'bubbles/01.jpg');
  assert.strictEqual(m.gifs.length, 1);
});

test('parseManifest skips entries without "file"', () => {
  const m = parseManifest({ bubbles: [{ file: 'ok.jpg' }, { alt: 'no file' }, null] });
  assert.strictEqual(m.bubbles.length, 1);
});

test('parseManifest defaults missing categories to []', () => {
  const m = parseManifest({ bubbles: [{ file: 'a.jpg' }] });
  assert.deepStrictEqual(m.gifs, []);
  assert.deepStrictEqual(m.mascots, []);
});

test('parseManifest accepts JSON string input', () => {
  const m = parseManifest('{"bubbles":[{"file":"a.jpg"}]}');
  assert.strictEqual(m.bubbles.length, 1);
});

test('pickRandom returns full array when n >= length', () => {
  const r = pickRandom([1, 2, 3], 5);
  assert.strictEqual(r.length, 3);
});

test('pickRandom returns n elements when n < length', () => {
  const r = pickRandom([1, 2, 3, 4, 5], 2);
  assert.strictEqual(r.length, 2);
});

module.exports = { parseManifest, pickRandom };
