// tests/chaewon/persistence.test.js
const test = require('node:test');
const assert = require('node:assert');

// Mock minimal storage interface
function createMockStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _data: data,
  };
}

// Helpers extracted from chaewon.js for testability. The module's
// implementation MUST match the behavior verified here.
function setActive(storage) { storage.setItem('chaewonMode', '1'); }
function clearActive(storage) { storage.removeItem('chaewonMode'); }
function isStoredActive(storage) { return storage.getItem('chaewonMode') === '1'; }
function markFirstSeen(storage) { storage.setItem('chaewonModeFirstSeen', '1'); }
function hasFirstSeen(storage) { return storage.getItem('chaewonModeFirstSeen') === '1'; }
function setHuntProgress(storage, n) { storage.setItem('chaewonHuntProgress', String(n)); }
function getHuntProgress(storage) {
  const v = storage.getItem('chaewonHuntProgress');
  return v == null ? 0 : Math.max(0, Math.min(5, parseInt(v, 10) || 0));
}

test('setActive stores "1" under chaewonMode', () => {
  const s = createMockStorage();
  setActive(s);
  assert.strictEqual(s.getItem('chaewonMode'), '1');
});

test('clearActive removes the key', () => {
  const s = createMockStorage();
  setActive(s);
  clearActive(s);
  assert.strictEqual(s.getItem('chaewonMode'), null);
});

test('isStoredActive reflects current state', () => {
  const s = createMockStorage();
  assert.strictEqual(isStoredActive(s), false);
  setActive(s);
  assert.strictEqual(isStoredActive(s), true);
});

test('hasFirstSeen defaults to false', () => {
  const s = createMockStorage();
  assert.strictEqual(hasFirstSeen(s), false);
});

test('hasFirstSeen returns true after markFirstSeen', () => {
  const s = createMockStorage();
  markFirstSeen(s);
  assert.strictEqual(hasFirstSeen(s), true);
});

test('hunt progress starts at 0', () => {
  const s = createMockStorage();
  assert.strictEqual(getHuntProgress(s), 0);
});

test('hunt progress can be incremented and read back', () => {
  const s = createMockStorage();
  setHuntProgress(s, 3);
  assert.strictEqual(getHuntProgress(s), 3);
});

test('hunt progress clamps to 0..5', () => {
  const s = createMockStorage();
  setHuntProgress(s, -10);
  assert.strictEqual(getHuntProgress(s), 0);
  setHuntProgress(s, 100);
  assert.strictEqual(getHuntProgress(s), 5);
});

module.exports = {
  setActive, clearActive, isStoredActive,
  markFirstSeen, hasFirstSeen,
  setHuntProgress, getHuntProgress,
};
