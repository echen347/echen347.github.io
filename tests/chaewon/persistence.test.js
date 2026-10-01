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

// Startup on a touch-first device, then pointer changes and page restores,
// driven through the real chaewon.js and its event-emitting media queries.
const { boot } = require('./harness.cjs');
function touchStart() {
  const app = boot({ touch: true, reduceMotion: true });
  app.localStorage.setItem('chaewonModeFirstSeen', '1');
  return app;
}
const mode = app => app.window.ChaewonMode;

test('coarse startup with a stale stored flag stays inactive and clears the flag', () => {
  const app = touchStart();
  app.sessionStorage.setItem('chaewonMode', '1');
  app.loadChaewon();
  assert.strictEqual(mode(app).isActive(), false);
  assert.strictEqual(app.sessionStorage.getItem('chaewonMode'), null);
});

test('coarse startup, then a fine pointer, then typing chaewon activates once', () => {
  const app = touchStart();
  app.loadChaewon();
  app.setTouch(false);
  app.type('chaewon');
  assert.strictEqual(mode(app).isActive(), true);
});

test('coarse startup, fine, activate, then coarse again deactivates at once', () => {
  const app = touchStart();
  app.loadChaewon();
  app.setTouch(false);
  mode(app).activate({ skipCinematic: true });
  assert.strictEqual(mode(app).isActive(), true);
  app.setTouch(true);
  assert.strictEqual(mode(app).isActive(), false);
  assert.strictEqual(app.sessionStorage.getItem('chaewonMode'), null);
});

test('coarse startup, fine, activate, then a coarse page restore leaves the mode', () => {
  const app = touchStart();
  app.loadChaewon();
  app.setTouch(false);
  mode(app).activate({ skipCinematic: true });
  app.window.matchMedia('(pointer: coarse)').matches = true;
  app.window.dispatchEvent({ type: 'pageshow', persisted: true });
  assert.strictEqual(mode(app).isActive(), false);
});

test('repeated pointer changes and page restores add no duplicate listeners', () => {
  const app = touchStart();
  app.loadChaewon();
  const keydown = app.document.listenerCount('keydown');
  const change = app.window.matchMedia('(pointer: coarse)').listenerCount('change');
  const pageshow = app.window.listenerCount('pageshow');
  for (let i = 0; i < 4; i++) {
    app.setTouch(false);
    app.setTouch(true);
    app.window.dispatchEvent({ type: 'pageshow', persisted: true });
  }
  assert.strictEqual(app.document.listenerCount('keydown'), keydown);
  assert.strictEqual(app.window.matchMedia('(pointer: coarse)').listenerCount('change'), change);
  assert.strictEqual(app.window.listenerCount('pageshow'), pageshow);
  app.setTouch(false);
  app.type('chaewon');
  assert.strictEqual(mode(app).isActive(), true, 'one trigger, one toggle');
});

module.exports = {
  setActive, clearActive, isStoredActive,
  markFirstSeen, hasFirstSeen,
};
