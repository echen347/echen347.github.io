// tests/chaewon/buffer.test.js
const test = require('node:test');
const assert = require('node:assert');

// Pure-logic helper extracted for testability.
// Mirrors the buffer logic in chaewon.js. We re-implement here to avoid
// the JS module's DOM globals; the impl in chaewon.js MUST match.
function processKey(buffer, key, triggers, maxLen = 16) {
  // Accept only printable single-character keys
  if (typeof key !== 'string' || key.length !== 1) return { buffer, matched: null };
  const normalized = key.toLowerCase();
  if (!/^[a-z0-9]$/.test(normalized)) return { buffer, matched: null };
  const newBuffer = (buffer + normalized).slice(-maxLen);
  // Check longest triggers first to avoid shadowing
  const sorted = [...triggers].sort((a, b) => b.length - a.length);
  for (const t of sorted) {
    if (newBuffer.endsWith(t)) {
      return { buffer: '', matched: t };
    }
  }
  return { buffer: newBuffer, matched: null };
}

test('buffer accumulates printable lowercase characters', () => {
  let buf = '';
  for (const c of 'abc') buf = processKey(buf, c, ['xyz']).buffer;
  assert.strictEqual(buf, 'abc');
});

test('buffer normalizes uppercase to lowercase', () => {
  const r = processKey('', 'C', ['c']);
  assert.strictEqual(r.matched, 'c');
});

test('buffer ignores non-printable / multi-char keys', () => {
  const r = processKey('abc', 'Shift', ['xyz']);
  assert.strictEqual(r.buffer, 'abc');
  assert.strictEqual(r.matched, null);
});

test('buffer matches "chaewon" trigger', () => {
  let buf = '';
  let matched = null;
  for (const c of 'chaewon') {
    const r = processKey(buf, c, ['chaewon']);
    buf = r.buffer;
    matched = r.matched;
  }
  assert.strictEqual(matched, 'chaewon');
});

test('buffer trims to maxLen', () => {
  let buf = '';
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    buf = processKey(buf, c, [], 16).buffer;
  }
  assert.strictEqual(buf.length, 16);
  assert.strictEqual(buf, 'klmnopqrstuvwxyz');
});

test('buffer matches longest trigger first when overlapping', () => {
  let buf = '';
  let matched = null;
  for (const c of 'chaewon') {
    const r = processKey(buf, c, ['on', 'chaewon']);
    buf = r.buffer;
    matched = r.matched;
  }
  assert.strictEqual(matched, 'chaewon');
});

test('buffer matches sub-egg "fearless" (longer than chaewon)', () => {
  let buf = '';
  let matched = null;
  for (const c of 'fearless') {
    const r = processKey(buf, c, ['chaewon', 'fearless']);
    buf = r.buffer;
    matched = r.matched;
  }
  assert.strictEqual(matched, 'fearless');
});

test('buffer is cleared after a match (prevents ghost matches)', () => {
  let buf = '';
  for (const c of 'chaewon') {
    buf = processKey(buf, c, ['chaewon']).buffer;
  }
  // After match, buffer should be empty so subsequent keys start fresh
  assert.strictEqual(buf, '');
  // A subsequent key should land in a clean buffer
  const r = processKey(buf, 'x', ['chaewon']);
  assert.strictEqual(r.buffer, 'x');
  assert.strictEqual(r.matched, null);
});

module.exports = { processKey };
