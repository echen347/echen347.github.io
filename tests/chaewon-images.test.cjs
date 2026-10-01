const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./chaewon/harness.cjs');


test('reduced motion avoids unused preload requests until an idle photo is displayed', async () => {
  const app = boot({ reduceMotion: true });
  app.loadChaewon();
  app.window.ChaewonMode.activate({ skipCinematic: true });
  await app.flush();
  assert.deepEqual(app.requests, []);
  await app.fireTimer(30000);
  assert.equal(app.requests.filter(request => request.kind === 'image').length, 1);
});

test('deactivation prevents a pending manifest from triggering photo requests', async () => {
  const app = boot({ pendingManifest: true });
  app.loadChaewon();
  app.window.ChaewonMode.activate({ skipCinematic: true });
  app.window.ChaewonMode.deactivate();
  app.resolveManifest();
  await app.flush();
  assert.deepEqual(app.requests.filter(request => request.kind === 'image'), []);
  assert.ok(!app.document.getElementById('chaewon-bubbles'));
});

test('deactivation prevents a pending idle popup from requesting or displaying a photo', async () => {
  const app = boot({ reduceMotion: true, pendingManifest: true });
  app.loadChaewon();
  app.window.ChaewonMode.activate({ skipCinematic: true });
  const idle = app.fireTimer(30000);
  app.window.ChaewonMode.deactivate();
  app.resolveManifest();
  await idle;
  assert.deepEqual(app.requests.filter(request => request.kind === 'image'), []);
  assert.ok(!app.document.querySelector('.chaewon-idle-popup'));
});

test('headshot decoration keeps picture sources beside their image through activation and exit', () => {
  const app = boot({ reduceMotion: true });
  const picture = app.document.createElement('picture');
  const source = app.document.createElement('source');
  const img = app.document.createElement('img');
  source.setAttribute('srcset', 'headshot-320.webp 320w, headshot-640.webp 640w');
  img.src = 'headshot-640.jpg';
  picture.appendChild(source);
  picture.appendChild(img);
  app.document.body.appendChild(picture);
  app.loadChaewon();
  app.window.ChaewonMode.activate({ skipCinematic: true });
  assert.equal(img.parentNode.tagName, 'PICTURE');
  assert.ok(picture.parentNode.classList.contains('chaewon-headshot-wrap'));
  assert.ok(img.classList.contains('chaewon-headshot'));
  app.window.ChaewonMode.deactivate();
  assert.ok(picture.parentNode === app.document.body);
  assert.ok(img.parentNode === picture);
  assert.ok(picture.children[0] === source);
  assert.ok(!img.classList.contains('chaewon-headshot'));
});

test('touch-first devices never start Chaewon mode from a stored session', async () => {
  const app = boot({ touch: true, reduceMotion: true });
  app.sessionStorage.setItem('chaewonMode', '1');
  app.loadChaewon();
  await app.flush();
  assert.equal(app.window.ChaewonMode.isActive(), false);
  assert.ok(!app.document.body.classList.contains('chaewon-mode'));
  assert.equal(app.sessionStorage.getItem('chaewonMode'), null, 'A stale session flag is cleared');
  assert.deepEqual(app.requests, []);
});

test('typing chaewon or calling activate does nothing on touch-first devices', async () => {
  const app = boot({ touch: true, reduceMotion: true });
  app.localStorage.setItem('chaewonModeFirstSeen', '1');
  app.loadChaewon();
  app.type('chaewon');
  app.window.ChaewonMode.activate({ skipCinematic: true });
  await app.flush();
  assert.equal(app.window.ChaewonMode.isActive(), false);
  assert.equal(app.sessionStorage.getItem('chaewonMode'), null);
  assert.deepEqual(app.requests, []);
  assert.equal(app.window.ChaewonMode._initHunt, undefined, 'The heart hunt is archived, not shipped');
});

test('typing chaewon still toggles the mode on desktop', () => {
  const app = boot({ reduceMotion: true });
  app.localStorage.setItem('chaewonModeFirstSeen', '1');
  app.loadChaewon();
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), true);
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), false);
});

test('Samsung Internet phones that also report hover are still blocked', () => {
  const app = boot({ touch: true, samsung: true, reduceMotion: true });
  app.sessionStorage.setItem('chaewonMode', '1');
  app.localStorage.setItem('chaewonModeFirstSeen', '1');
  app.loadChaewon();
  app.type('chaewon');
  app.window.ChaewonMode.activate({ skipCinematic: true });
  assert.equal(app.window.ChaewonMode.isActive(), false);
  assert.equal(app.sessionStorage.getItem('chaewonMode'), null);
});

test('a desktop that switches to touch mid-page leaves the mode and cannot restart it', () => {
  const app = boot({ reduceMotion: true });
  app.localStorage.setItem('chaewonModeFirstSeen', '1');
  app.loadChaewon();
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), true);
  app.setTouch(true);
  assert.equal(app.window.ChaewonMode.isActive(), false, 'Switching to touch ends the mode');
  assert.equal(app.sessionStorage.getItem('chaewonMode'), null);
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), false, 'and typing cannot restart it');
  app.setTouch(false);
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), true, 'Back on a fine pointer, typing works again');
});

test('a page restored from the back-forward cache on a touch device leaves the mode', () => {
  const app = boot({ reduceMotion: true });
  app.localStorage.setItem('chaewonModeFirstSeen', '1');
  app.loadChaewon();
  app.type('chaewon');
  app.setTouch(true);
  app.setTouch(false);
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), true);
  // Simulate a restore where the change event was missed while the page was frozen.
  app.window.matchMedia('(pointer: coarse)').matches = true;
  app.window.dispatchEvent({ type: 'pageshow', persisted: true });
  assert.equal(app.window.ChaewonMode.isActive(), false);
});
