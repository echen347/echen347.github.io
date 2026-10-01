const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '../studies/homepage-preview.js');
function target() {
  const listeners = new Map();
  return {
    hidden: false, inert: false, disabled: false, dataset: {}, attributes: {}, style: {}, textContent: '',
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    emit(type, values = {}) {
      let stopped = false;
      const event = { target: this, preventDefault() {}, stopImmediatePropagation() { stopped = true; }, ...values };
      for (const callback of listeners.get(type) || []) { callback(event); if (stopped) break; }
    },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return this.attributes[key] ?? null; },
    removeAttribute(key) { delete this.attributes[key]; },
    dispatchEvent(event) { this.emit(event.type, event); },
    focus() { this.focused = true; }
  };
}
function boot({ hash = '', search = '', content = false, reduce = false, missing = false, fail = false, concert = false, mode = false } = {}) {
  const ids = ['scene-layer', 'fluid-canvas', 'profile-panel', 'scene-status', 'site-header',
    'profile-status', 'view-toggle', 'view-label', 'book-icon', 'scene-icon', 'scene-reset', 'scene-home', 'paper-home'];
  const nodes = Object.fromEntries(ids.map(id => [id, target()]));
  if (content) {
    delete nodes['scene-reset'];
  }
  nodes['view-toggle'].hidden = true;
  nodes['profile-status'].hidden = true;
  const links = ['academic.html', 'photography.html', 'writing.html', '/', 'https://example.com/', '/mot'].map(href => {
    const link = target(); link.setAttribute('href', href); return link;
  });
  const document = Object.assign(target(), {
    hidden: false, body: { dataset: { view: 'profile', ...(content ? {scenePage: 'content'} : {}) } }, documentElement: { dataset: { view: 'scene', sceneBoot: 'scene' }, style: { overflow: '' } },
    getElementById: id => nodes[id],
    querySelectorAll: () => links
  });
  const media = Object.assign(target(), { matches: reduce });
  const calls = { creates: 0, disposals: 0, pauses: [], histories: [], resets: [], configs: [],
    order: [], concertCreates: 0, concertOptions: [], activations: [] };
  const location = new URL('http://localhost/' + (content ? 'academic.html' : 'homepage-preview.html') + search + hash);
  const history = {
    scrollRestoration: 'auto',
    state: null,
    pushState(state, title, url) { this.state = state; location.href = new URL(url, location).href; calls.histories.push(['push', location.hash]); },
    replaceState(state, title, url) { this.state = state; location.href = new URL(url, location).href; calls.histories.push(['replace', location.hash]); }
  };
  let options;
  const renderer = {
    setPaused(value) { calls.pauses.push(value); calls.order.push('fluid.paused:' + value); nodes['fluid-canvas'].dataset.paused = String(value); options.onPauseChange(value); },
    reset(seed) { calls.resets.push(seed); calls.order.push('fluid.reset'); nodes['fluid-canvas'].dataset.seed = String(seed); },
    render() {}, dispose() { calls.disposals++; calls.order.push('fluid.dispose'); }
  };
  // Concert fakes: the controller factory and chaewon.js's attach/refresh hooks.
  // A new controller starts enabled, as chaewon/concert-mode.js does.
  let concertEnabled = true, concertActive = false, attached = null;
  const controller = {
    setEnabled(value) { concertEnabled = !!value; if (!concertEnabled) concertActive = false; calls.order.push('concert.enabled:' + concertEnabled); },
    // The concert measures the header and starts the light here; record the layout it would see.
    activate() {
      concertActive = true;
      calls.order.push('concert.activate');
      calls.activations.push({ view: document.body.dataset.view, profileHidden: nodes['profile-panel'].hidden,
        scrollY: window.scrollY, paused: nodes['fluid-canvas'].dataset.paused });
    },
    reset() { calls.order.push('concert.reset'); },
    dispose() { calls.order.push('concert.dispose'); },
    isActive: () => concertActive, isEnabled: () => concertEnabled,
  };
  // chaewon.js's dispatch rule (render): with the mode on, an attached, enabled, inactive concert activates.
  const dispatch = () => { if (mode && attached && attached.isEnabled() && !attached.isActive()) attached.activate(); };
  const extras = concert ? {
    ChaewonConcert: { create(options) { calls.concertCreates++; calls.concertOptions.push(options); return controller; } },
    ChaewonMode: {
      setConcert(value) { attached = value || null; calls.order.push(value ? 'mode.attach' : 'mode.detach'); dispatch(); },
      refresh() { calls.order.push('mode.refresh'); dispatch(); }
    },
  } : {};
  const window = Object.assign(target(), extras, { location, history, scrollY: 0, matchMedia: () => media,
    scrollTo(value) { this.scrollY = typeof value === 'object' ? value.top : value; },
    FluidPrototype: missing ? undefined : { create(canvas, config) {
      calls.creates++; options = config; calls.configs.push(config);
      if (fail) throw new Error('GPU unavailable');
      canvas.dataset.state = 'ready'; canvas.dataset.paused = String(config.paused);
      // Match the renderer's own preference listener before the controller's listener.
      media.addEventListener('change', event => renderer.setPaused(event.matches));
      return renderer;
    } }
  });
  const script = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  class PointerEvent { constructor(type, values) { Object.assign(this, { type }, values); } }
  vm.runInNewContext(script, { window, document, history, location, console, URL, Uint32Array, Math, PointerEvent });
  return { nodes, document, window, media, calls, location, renderer, links,
    lateFailure() { options.onError(new Error('context lost')); },
    preference(value) { media.matches = value; media.emit('change', { matches: value }); },
    navigate(value) { location.hash = value; window.emit('popstate'); window.emit('hashchange'); }
  };
}

test('default view reveals the scene with a profile link and one paused-first renderer', () => {
  const app = boot();
  assert.equal(app.document.body.dataset.view, 'scene');
  assert.equal(app.calls.creates, 1);
  assert.equal(app.nodes['profile-panel'].hidden, true);
  assert.equal(app.nodes['profile-panel'].inert, true);
  assert.equal(app.nodes['scene-layer'].inert, false);
  assert.equal(app.nodes['scene-layer'].attributes['aria-hidden'], 'false');
  assert.equal(app.nodes['view-label'].textContent, 'Paper');
  assert.equal(app.nodes['view-toggle'].hidden, false);
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
});

test('the document backdrop follows style changes after the early theme hands off', () => {
  const app = boot({ search: '?seed=123' });
  assert.equal(app.document.documentElement.dataset.view, 'scene');
  assert.equal(app.document.documentElement.dataset.sceneBoot, undefined);
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.document.documentElement.dataset.view, 'profile');
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.document.documentElement.dataset.view, 'scene');
});

test('renderer failure releases the early dark theme for the readable paper fallback', () => {
  const app = boot({ fail: true });
  assert.equal(app.document.documentElement.dataset.view, 'profile');
  assert.equal(app.document.documentElement.dataset.sceneBoot, undefined);
  assert.equal(app.nodes['profile-panel'].hidden, false);
});

test('scene navigation carries its seed while paper navigation restores original destinations', () => {
  const app = boot({ search: '?seed=123' });
  const scene = new URL(app.links[0].getAttribute('href'), app.location);
  assert.equal(scene.pathname, '/academic.html');
  assert.equal(scene.searchParams.get('view'), 'scene');
  assert.equal(scene.searchParams.get('seed'), '123');
  assert.equal(app.calls.configs[0].randomized, true);
  assert.equal(app.calls.configs[0].seed, 123);
  assert.equal(app.links[4].getAttribute('href'), 'https://example.com/');
  assert.equal(app.links[5].getAttribute('href'), '/mot');
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.links[0].getAttribute('href'), 'academic.html');
  assert.equal(app.links[1].getAttribute('href'), 'photography.html');
});

test('content pages default to original paper with no GPU and a paper Home link', () => {
  const app = boot({ content: true });
  assert.equal(app.document.body.dataset.view, 'profile');
  assert.equal(app.calls.creates, 0);
  assert.equal(app.nodes['scene-home'].hidden, true);
  assert.equal(app.nodes['paper-home'].hidden, false);
  assert.equal(app.window.history.scrollRestoration, 'auto');
  assert.equal(app.links[3].getAttribute('href'), '/#profile');
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.document.body.dataset.view, 'scene');
  assert.equal(app.nodes['scene-home'].hidden, false);
  assert.equal(app.nodes['paper-home'].hidden, true);
  assert.equal(app.location.searchParams.get('view'), 'scene');
  assert.equal(app.nodes['profile-panel'].hidden, false);
  assert.equal(app.nodes['profile-panel'].inert, false);
  assert.equal(app.document.documentElement.style.overflow, '');
  assert.equal(app.nodes['view-label'].textContent, 'Paper');
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.nodes['scene-home'].hidden, true);
  assert.equal(app.nodes['paper-home'].hidden, false);
});

test('Reset generates a new seed without changing the view or reduced-motion suspension', () => {
  const app = boot({ search: '?seed=123', reduce: true });
  app.nodes['scene-reset'].emit('click');
  assert.equal(app.calls.resets.length, 1);
  assert.notEqual(app.calls.resets[0], 123);
  assert.equal(app.document.body.dataset.view, 'scene');
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  assert.equal(app.location.searchParams.get('seed'), String(app.calls.resets[0]));
  assert.equal(new URL(app.links[1].getAttribute('href'), app.location).searchParams.get('seed'), String(app.calls.resets[0]));
});

test('a photo modal suspends and resumes the background without playback buttons', () => {
  const app = boot({ content: true, search: '?view=scene&seed=123' });
  app.document.emit('site:modalchange', { detail: { open: true } });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  assert.equal(app.nodes['scene-layer'].inert, true);
  app.document.emit('keydown', { key: 'Escape', defaultPrevented: true });
  assert.equal(app.document.body.dataset.view, 'scene');
  app.document.emit('site:modalchange', { detail: { open: false } });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
  app.preference(true);
  app.document.emit('site:modalchange', { detail: { open: true } });
  app.document.emit('site:modalchange', { detail: { open: false } });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
});

test('content playback follows visibility and reduced motion without Reset or Pause buttons', () => {
  const app = boot({ content: true, search: '?view=scene&seed=123' });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
  app.document.hidden = true;
  app.document.emit('visibilitychange');
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  app.document.hidden = false;
  app.document.emit('visibilitychange');
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
  app.preference(true);
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  app.preference(false);
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
});

test('content pages keep the animated background passive while the entrance accepts input', () => {
  const app = boot({ content: true, search: '?view=scene&seed=123' });
  const forwarded = [];
  app.nodes['fluid-canvas'].addEventListener('pointermove', event => forwarded.push(event.pointerId));
  app.document.emit('pointermove', { pointerType: 'mouse', pointerId: 7, clientX: 80, clientY: 90 });
  assert.deepEqual(forwarded, [], 'Reading content must not forward mouse movement into the fluid');
  assert.equal(app.calls.configs[0].interactive, false);
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false', 'The passive scene must keep animating');
  const entrance = boot();
  assert.equal(entrance.calls.configs[0].interactive, true);
});

test('profile deep link stays readable and postpones GPU creation', () => {
  const app = boot({ hash: '#profile' });
  assert.equal(app.document.body.dataset.view, 'profile');
  assert.equal(app.calls.creates, 0);
  assert.equal(app.nodes['view-label'].textContent, 'Scene');
  assert.equal(app.nodes['scene-layer'].inert, true);
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.calls.creates, 1);
  assert.equal(app.document.body.dataset.view, 'scene');
});

test('switching preserves profile scroll and reuses the scene renderer', () => {
  const app = boot();
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.location.hash, '#profile');
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  assert.equal(app.nodes['profile-panel'].hidden, false);
  app.window.scrollY = 620;
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.window.scrollY, 0);
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.window.scrollY, 620);
  assert.equal(app.calls.creates, 1);
});

test('the shared toggle hides the inactive SVG icon with a reflected attribute', () => {
  const app = boot();
  assert.equal(app.nodes['scene-icon'].attributes.hidden, '');
  assert.equal(app.nodes['book-icon'].attributes.hidden, undefined);
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.nodes['book-icon'].attributes.hidden, '');
  assert.equal(app.nodes['scene-icon'].attributes.hidden, undefined);
});

test('back and forward hashes switch views without writing more history', () => {
  const app = boot();
  const writes = app.calls.histories.length;
  app.navigate('#profile');
  assert.equal(app.document.body.dataset.view, 'profile');
  app.navigate('#scene');
  assert.equal(app.document.body.dataset.view, 'scene');
  assert.equal(app.calls.histories.length, writes);
});

test('the scene resumes after profile switches, tab visibility, and media changes', () => {
  const app = boot();
  app.nodes['view-toggle'].emit('click'); app.nodes['view-toggle'].emit('click');
  app.document.hidden = true; app.document.emit('visibilitychange');
  app.document.hidden = false; app.document.emit('visibilitychange');
  app.preference(true); app.preference(false);
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
});

test('renderer-owned preference callbacks cannot start the inactive scene', () => {
  const app = boot();
  app.nodes['view-toggle'].emit('click');
  app.preference(true); app.preference(false);
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  assert.equal(app.document.body.dataset.view, 'profile');
});

test('reduced motion and background tabs suspend playback without playback controls', () => {
  const app = boot({ reduce: true });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  app.preference(false);
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
  app.document.hidden = true; app.document.emit('visibilitychange');
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  app.document.hidden = false; app.document.emit('visibilitychange');
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
});

test('canvas Space leaves the scene playing instead of creating a hidden pause state', () => {
  const app = boot();
  app.nodes['fluid-canvas'].emit('keydown', { code: 'Space', key: ' ' });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
  app.nodes['view-toggle'].emit('click'); app.nodes['view-toggle'].emit('click');
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
  assert.equal(app.calls.configs[0].pauseOnSpace, false);
});

test('missing, failed, or lost graphics leave the profile readable with a status', () => {
  for (const config of [{ missing: true }, { fail: true }, {}]) {
    const app = boot(config);
    if (!config.missing && !config.fail) app.lateFailure();
    assert.equal(app.document.body.dataset.view, 'profile');
    assert.equal(app.nodes['profile-panel'].hidden, false);
    assert.equal(app.nodes['profile-panel'].inert, false);
    assert.equal(app.nodes['view-toggle'].hidden, true);
    assert.equal(app.nodes['profile-status'].hidden, false);
    assert.ok(app.nodes['profile-status'].textContent.length > 0);
  }
});

test('page cache suspension resumes only the active unpaused scene', () => {
  const app = boot();
  app.window.emit('pagehide', { persisted: true });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'true');
  app.window.emit('pageshow', { persisted: true });
  assert.equal(app.nodes['fluid-canvas'].dataset.paused, 'false');
  app.window.emit('pagehide', { persisted: false });
  assert.equal(app.calls.disposals, 1);
});

test('the entrance creates one concert on its renderer, attaches it, and enables it in the scene', () => {
  const app = boot({ concert: true });
  assert.equal(app.calls.creates, 1);
  assert.equal(app.calls.concertCreates, 1);
  const options = app.calls.concertOptions[0];
  assert.equal(options.fluid, app.renderer, 'the concert consumes the homepage renderer');
  assert.equal(options.canvas, app.nodes['fluid-canvas']);
  assert.equal(options.host, app.nodes['scene-layer']);
  assert.ok(app.calls.order.includes('mode.attach'));
  assert.ok(app.calls.order.includes('concert.enabled:true'));
});

test('Paper disables the concert before the renderer pauses, then refreshes the mode', () => {
  const app = boot({ concert: true });
  app.calls.order.length = 0;
  app.nodes['view-toggle'].emit('click');
  const order = app.calls.order;
  assert.ok(order.indexOf('concert.enabled:false') >= 0);
  assert.ok(order.indexOf('concert.enabled:false') < order.indexOf('fluid.paused:true'), order.join(' '));
  assert.ok(order.indexOf('mode.refresh') > order.indexOf('concert.enabled:false'));
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.calls.concertCreates, 1, 'switching views reuses one controller');
  assert.ok(app.calls.order.includes('concert.enabled:true'));
});

test('Reset resets the fluid before the concert', () => {
  const app = boot({ concert: true });
  app.calls.order.length = 0;
  app.nodes['scene-reset'].emit('click');
  assert.deepEqual(app.calls.order.filter(entry => /reset/.test(entry)), ['fluid.reset', 'concert.reset']);
  assert.equal(app.calls.concertCreates, 1);
});

test('leaving the page disposes the concert before the renderer without handing the mode to the classic decorations', () => {
  const app = boot({ concert: true });
  app.window.emit('pagehide', { persisted: true });
  assert.ok(!app.calls.order.includes('concert.dispose'), 'a cached page keeps its concert');
  app.window.emit('pageshow', { persisted: true });
  app.calls.order.length = 0;
  app.window.emit('pagehide', { persisted: false });
  const order = app.calls.order;
  assert.ok(order.indexOf('concert.dispose') >= 0 && order.indexOf('concert.dispose') < order.indexOf('fluid.dispose'), order.join(' '));
  // A detach makes chaewon.js mount the classic decorations and fetch their manifest on the unloading page.
  assert.ok(!order.includes('mode.detach') && !order.includes('mode.refresh'), order.join(' '));
});

test('a late graphics failure disposes and detaches the concert and keeps Paper usable', () => {
  const app = boot({ concert: true });
  app.calls.order.length = 0;
  app.lateFailure();
  const order = app.calls.order;
  assert.ok(order.includes('concert.dispose') && order.includes('mode.detach'), order.join(' '));
  assert.ok(order.indexOf('concert.dispose') < order.indexOf('fluid.dispose'));
  assert.equal(app.document.body.dataset.view, 'profile');
});

test('content pages never create a concert, and a missing concert script is harmless', () => {
  const content = boot({ concert: true, content: true, search: '?view=scene&seed=5' });
  assert.equal(content.calls.concertCreates, 0);
  const plain = boot();
  assert.equal(plain.calls.creates, 1);
  assert.equal(plain.document.body.dataset.view, 'scene');
});

test('with the mode on, Scene from scrolled Paper activates the concert in the laid-out, running scene', () => {
  const app = boot({ hash: '#profile', concert: true, mode: true });
  const scene = { view: 'scene', profileHidden: true, scrollY: 0, paused: 'false' };
  app.window.scrollY = 282;
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.calls.activations.length, 1, app.calls.order.join(' '));
  assert.deepEqual(app.calls.activations[0], scene, 'the first switch creates the concert; it must not activate on Paper');
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.window.scrollY, 282, 'Paper keeps its reading position');
  app.nodes['view-toggle'].emit('click');
  assert.equal(app.calls.activations.length, 2);
  assert.deepEqual(app.calls.activations[1], scene, 'a later switch measures the scene at the top');
});
