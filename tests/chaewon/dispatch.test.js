// chaewon.js is the single dispatcher for typed triggers. On the homepage
// entrance an attached, enabled concert presents Chaewon Mode; elsewhere the
// legacy decorations do. The two presentations never overlap.
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./harness.cjs');

function fakeConcert({ enabled = true } = {}) {
  let active = false, on = enabled;
  const calls = { activate: 0, leave: [], cues: [] };
  return {
    calls,
    activate() { if (on && !active) { active = true; calls.activate++; } },
    leave(options = {}) { if (active) { active = false; calls.leave.push(options); } },
    applyCue(name) { if (active) calls.cues.push(name); },
    setEnabled(value) { on = !!value; if (!on && active) { active = false; calls.leave.push({ immediate: true }); } },
    isActive: () => active,
    isEnabled: () => on,
  };
}
function start(options = {}) {
  const app = boot({ reduceMotion: true, ...options });
  app.localStorage.setItem('chaewonModeFirstSeen', '1');
  return app;
}
const legacyShown = app => app.document.body.classList.contains('chaewon-mode');

test('with an enabled concert attached, typing chaewon starts the concert and not the legacy mode', () => {
  const app = start();
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), true);
  assert.equal(concert.calls.activate, 1);
  assert.equal(legacyShown(app), false, 'no marquee, wallpaper, or bubbles alongside the cards');
  assert.ok(!app.document.querySelector('.chaewon-exit'), 'no legacy exit button');
});

test('song names go to the running concert, and the second chaewon leaves it with the animated exit', () => {
  const app = start();
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.type('chaewon');
  app.type('crazy');
  assert.deepEqual(concert.calls.cues, ['crazy']);
  assert.ok(!app.document.body.classList.contains('chaewon-egg-crazy'), 'no legacy sub-egg');
  app.type('chaewon');
  assert.equal(app.window.ChaewonMode.isActive(), false);
  assert.equal(concert.calls.leave.length, 1);
  assert.ok(!concert.calls.leave[0].immediate, 'typed exit animates');
  assert.equal(app.sessionStorage.getItem('chaewonMode'), null);
});

test('a stored session in homepage script order starts the concert without showing legacy decorations', () => {
  const app = start({ readyState: 'interactive' });
  app.sessionStorage.setItem('chaewonMode', '1');
  app.loadChaewon();
  assert.equal(legacyShown(app), false, 'nothing rendered before the page is ready');
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.ready();
  assert.equal(concert.calls.activate, 1);
  assert.equal(legacyShown(app), false);
});

test('switching the homepage to Paper hands the mode to the legacy presentation and back', () => {
  const app = start();
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.type('chaewon');
  concert.setEnabled(false);
  app.window.ChaewonMode.refresh();
  assert.equal(concert.isActive(), false);
  assert.equal(legacyShown(app), true, 'Paper keeps the existing Chaewon Mode');
  concert.setEnabled(true);
  app.window.ChaewonMode.refresh();
  assert.equal(legacyShown(app), false);
  assert.equal(concert.isActive(), true);
  assert.equal(app.window.ChaewonMode.isActive(), true);
});

test('typing inside an editable field does not trigger anything', () => {
  const app = start();
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  const input = app.document.createElement('input');
  app.type('chaewon', input);
  assert.equal(app.window.ChaewonMode.isActive(), false);
  assert.equal(concert.calls.activate, 0);
});

test('detaching the concert while the mode is on falls back to the legacy presentation', () => {
  const app = start();
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.type('chaewon');
  app.window.ChaewonMode.setConcert(null);
  assert.equal(concert.isActive(), false);
  assert.ok(concert.calls.leave[0].immediate, 'detaching settles at once');
  assert.equal(legacyShown(app), true);
});

test('legacy click bursts and cursor hearts stay silent while the concert presents the mode', () => {
  const app = start({ reduceMotion: false });
  app.loadChaewon();
  app.window.ChaewonMode.setConcert(fakeConcert());
  app.type('chaewon');
  const before = app.document.body.children.length;
  const target = { closest: () => null };
  app.document.dispatchEvent({ type: 'click', target, clientX: 10, clientY: 10 });
  app.document.dispatchEvent({ type: 'mousemove', target, clientX: 20, clientY: 20 });
  assert.equal(app.document.body.children.length, before);
});

test('without a concert, typing chaewon still runs the legacy mode', () => {
  const app = start();
  app.loadChaewon();
  app.type('chaewon');
  assert.equal(legacyShown(app), true);
  assert.equal(app.window.ChaewonMode.isActive(), true);
});

test('switching from Paper to the scene ends classic song effects and an idle popup already showing', () => {
  const app = start();
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.type('chaewon');
  concert.setEnabled(false);
  app.window.ChaewonMode.refresh();
  app.type('fearless');
  app.type('perfectnight');
  app.type('antifragile');
  app.type('crazy');
  app.type('easy');
  const eggs = ['crazy', 'easy'].map(name => 'chaewon-egg-' + name);
  assert.ok(eggs.every(cls => app.document.body.classList.contains(cls)), 'the CSS-only songs are playing');
  const popup = app.document.createElement('div');
  popup.className = 'chaewon-idle-popup';
  app.document.body.appendChild(popup);
  const effects = '.chaewon-petal, .chaewon-star, .chaewon-shooting-star, .chaewon-laser-stage, .chaewon-laser-dim, .chaewon-idle-popup';
  assert.ok(app.document.querySelectorAll(effects).length > 1, 'the songs ran on Paper');
  concert.setEnabled(true);
  app.window.ChaewonMode.refresh();
  assert.equal(concert.isActive(), true);
  assert.equal(app.document.querySelectorAll(effects).length, 0, 'no petals, stars, lasers, dim, or popup over the concert');
  // A song class left on body would replay its strobe when Paper brings the classic mode back.
  assert.ok(eggs.every(cls => !app.document.body.classList.contains(cls)), 'no CSS-only song waits to replay');
});

test('switching from Paper to the scene restores a hovered heading translation', () => {
  const app = start();
  const heading = app.document.createElement('h2');
  const text = { nodeType: 3, textContent: 'Research' };
  heading.childNodes = [text];
  app.document.body.appendChild(heading);
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.type('chaewon');
  concert.setEnabled(false);
  app.window.ChaewonMode.refresh();
  heading.dispatchEvent({ type: 'mouseenter' });
  assert.notEqual(text.textContent, 'Research', 'hover shows the translation on Paper');
  concert.setEnabled(true);
  app.window.ChaewonMode.refresh();
  assert.equal(text.textContent, 'Research');
  heading.dispatchEvent({ type: 'mouseleave' });
  app.type('chaewon');
  assert.equal(text.textContent, 'Research', 'the heading stays restored after the mode ends');
});

test('the hover translation still works after a round trip through the scene', () => {
  const app = start();
  const heading = app.document.createElement('h2');
  const text = { nodeType: 3, textContent: 'Research' };
  heading.childNodes = [text];
  app.document.body.appendChild(heading);
  app.loadChaewon();
  const concert = fakeConcert();
  app.window.ChaewonMode.setConcert(concert);
  app.type('chaewon');
  concert.setEnabled(false);
  app.window.ChaewonMode.refresh();
  concert.setEnabled(true);
  app.window.ChaewonMode.refresh();
  concert.setEnabled(false);
  app.window.ChaewonMode.refresh();
  assert.equal(legacyShown(app), true);
  heading.dispatchEvent({ type: 'mouseenter' });
  assert.notEqual(text.textContent, 'Research');
  heading.dispatchEvent({ type: 'mouseleave' });
  assert.equal(text.textContent, 'Research');
});
