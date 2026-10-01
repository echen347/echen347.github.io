// Concert controller lifecycle on the real chaewon/concert-mode.js, with a small
// DOM fake, a fluid fake that mirrors the renderer's look semantics, and
// controllable timers and media queries.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const coreSource = fs.readFileSync(path.join(root, 'chaewon/concert-core.js'), 'utf8');
const modeSource = fs.readFileSync(path.join(root, 'chaewon/concert-mode.js'), 'utf8');

function emitter(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    addEventListener(type, fn, options) {
      const capture = options === true || !!(options && options.capture);
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ fn, capture });
    },
    removeEventListener(type, fn, options) {
      const capture = options === true || !!(options && options.capture);
      const list = listeners.get(type) || [];
      const i = list.findIndex(entry => entry.fn === fn && entry.capture === capture);
      if (i >= 0) list.splice(i, 1);
    },
    dispatch(event, phase) {
      for (const { fn, capture } of [...(listeners.get(event.type) || [])]) {
        if (phase === 'capture' && !capture) continue;
        if (phase === 'bubble' && capture) continue;
        fn(event);
      }
    },
    listenerTotal() { let n = 0; for (const list of listeners.values()) n += list.length; return n; },
  });
}

function environment({ coarse = false, reduce = false, width = 1280, height = 800 } = {}) {
  const timers = new Map();
  let timerId = 0;
  const media = new Map();
  const answers = { '(pointer: coarse)': coarse, '(prefers-reduced-motion: reduce)': reduce };
  const matchMedia = query => {
    if (!media.has(query)) media.set(query, emitter({ media: query, matches: !!answers[query] }));
    return media.get(query);
  };
  const document = emitter({ activeElement: null });
  function element(tag) {
    const classes = new Set();
    const attributes = {};
    const node = emitter({
      tagName: tag.toUpperCase(), children: [], parentNode: null, dataset: {}, textContent: '', hidden: false, type: '',
      style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
      classList: {
        add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)),
        contains: v => classes.has(v), toggle: (v, on) => (on ?? !classes.has(v)) ? classes.add(v) : classes.delete(v),
      },
      setAttribute(k, v) { attributes[k] = String(v); }, getAttribute(k) { return k in attributes ? attributes[k] : null; },
      removeAttribute(k) { delete attributes[k]; }, hasAttribute(k) { return k in attributes; },
      appendChild(child) { child.remove(); child.parentNode = node; node.children.push(child); return child; },
      remove() { if (node.parentNode) { const list = node.parentNode.children; list.splice(list.indexOf(node), 1); node.parentNode = null; } },
      contains(other) { for (let n = other; n; n = n.parentNode) if (n === node) return true; return false; },
      closest() { return null; },
      querySelector(selector) { return node.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector) {
        const all = node.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
        if (selector === '*') return all;
        return all.filter(child => selector.split(',').some(part => {
          const s = part.trim();
          return s[0] === '.' ? s.slice(1).split('.').every(c => child.classList.contains(c)) : child.tagName === s.toUpperCase();
        }));
      },
      focus() { document.activeElement = node; },
      click() { node.dispatch({ type: 'click', target: node }, 'bubble'); },
      getBoundingClientRect() {
        const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(node.style.transform || '');
        const w = parseFloat(node.style.width) || (classes.has('is-forward') ? 196 : 112);
        const h = parseFloat(node.style.height) || (classes.has('is-forward') ? 303 : 173);
        const left = m ? +m[1] : 0, top = m ? +m[2] : 0;
        return { left, top, width: w, height: h, right: left + w, bottom: top + h };
      },
    });
    Object.defineProperty(node, 'className', {
      get: () => [...classes].join(' '),
      set: value => { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
    });
    return node;
  }
  document.createElement = element;
  const body = element('body');
  document.body = body;
  const host = element('section'); host.id = 'scene-layer'; body.appendChild(host);
  const header = element('header'); header.getBoundingClientRect = () => ({ top: 0, bottom: 190, left: 0, right: width, height: 190, width });
  const footer = element('div');
  host.appendChild(footer);
  const canvas = element('canvas'); host.appendChild(canvas);
  const window = emitter({ innerWidth: width, innerHeight: height });
  footer.getBoundingClientRect = () => ({ top: window.innerHeight - 70, bottom: window.innerHeight, left: 0,
    right: window.innerWidth, height: 70, width: window.innerWidth });
  const context = vm.createContext({
    window, document, matchMedia, console, Math, structuredClone,
    getComputedStyle: el => ({
      getPropertyValue: name => ({ '--card-w': '112px', '--card-h': '173px', '--forward-w': '196px', '--forward-h': '303px' })[name] || '',
      visibility: el.style.visibility || 'visible',
    }),
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  context.self = context;
  context.addEventListener = window.addEventListener.bind(window);
  context.removeEventListener = window.removeEventListener.bind(window);
  Object.defineProperty(context, 'innerWidth', { get: () => window.innerWidth });
  Object.defineProperty(context, 'innerHeight', { get: () => window.innerHeight });
  vm.runInContext(coreSource, context);
  vm.runInContext(modeSource, context);
  const keydown = (key, target = document.activeElement || body) => {
    const event = { type: 'keydown', key, target, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
    document.dispatch(event, 'capture'); document.dispatch(event, 'bubble');
    return event;
  };
  return {
    window, document, host, header, footer, canvas, body, timers, context,
    api: window.ChaewonConcert || context.ChaewonConcert,
    media: matchMedia,
    flushTimers() { for (let i = 0; i < 50 && timers.size; i++) for (const [id, t] of [...timers]) { timers.delete(id); t.fn(); } },
    keydown,
    resize(w, h) { window.innerWidth = w; window.innerHeight = h; window.dispatch({ type: 'resize' }, 'bubble'); },
    setPointer(coarseNow) { const mq = matchMedia('(pointer: coarse)'); mq.matches = coarseNow; mq.dispatch({ type: 'change', matches: coarseNow }, 'bubble'); },
  };
}

// Mirrors the renderer's look contract: a new setLook settles the previous
// front's callback first; cuts, and any look while paused, settle at once.
// Frame hooks form a list, as in the renderer: each onFrame call adds one, and
// its remover takes out one.
function fakeFluid({ paused = false } = {}) {
  const hooks = [];
  let pending = null, frame = 0, points = [], tuning = { fadeTime: 4 }, override = null;
  let flow = [0, 0];
  let stock = { a: [.03, .45, .3], b: [1, .43, .12], mist: [.54, .72, .82], core: [.92, .91, .85],
    cool: [.82, .95, 1.08], warm: [1.1, .64, .36], palette: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]] };
  const fluid = {
    calls: { setLook: [], clearLook: 0, hooks: 0, disposed: 0 },
    paused,
    setLook(look, transition = {}) {
      if (pending) { const done = pending; pending = null; override = fluid.calls.setLook.at(-1).look; done(); }
      fluid.calls.setLook.push({ look, transition });
      if (transition.type === 'cut' || fluid.paused) { override = look; transition.done?.(); }
      else pending = transition.done || (() => {});
    },
    finishFront() { if (pending) { const done = pending; pending = null; override = fluid.calls.setLook.at(-1).look; done(); } },
    clearLook() { fluid.calls.clearLook++; override = null; },
    override: () => override,
    getStockLook: () => structuredClone(stock),
    setStock(next) { stock = structuredClone(next); },
    setFlow(next) { flow = next; },
    getLook: () => structuredClone(override || stock),
    onFrame(fn) { hooks.push(fn); fluid.calls.hooks++; return () => { const i = hooks.indexOf(fn); if (i >= 0) hooks.splice(i, 1); }; },
    hooked: () => hooks.length > 0,
    hookCount: () => hooks.length,
    setProbePoints(p) { points = p.map(x => [...x]); },
    probePoints: () => points,
    readProbe: () => (points.length ? { frame, samples: points.map(point => ({ point, velocity: [...flow], light: [.6, .6, .6] })) } : null),
    ambientDirection: () => [0, 0],
    isPaused: () => fluid.paused,
    getTuning: () => ({ ...tuning }),
    setTuning(patch) { tuning = { ...tuning, ...patch }; return { ...tuning }; },
    runFrames(n = 1) { for (let i = 0; i < n; i++) { frame++; for (const fn of [...hooks]) fn({ frames: frame, dt: 1 / 60, simDt: .45 / 60 }); } },
    dispose() { fluid.calls.disposed++; },
  };
  return fluid;
}

function setup(options = {}) {
  const env = environment(options);
  const fluid = fakeFluid({ paused: !!options.reduce || !!options.paused });
  const baseline = { document: env.document.listenerTotal(), window: env.window.listenerTotal() };
  const concert = env.api.create({ fluid, canvas: env.canvas, host: env.host, header: env.header, footer: env.footer });
  return { env, fluid, concert, baseline };
}
const cards = env => env.host.querySelectorAll('.card');
const layer = env => env.host.querySelector('.chaewon-concert');
// Values built inside the sandbox have another realm's prototypes; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));
function placeCards({ env, fluid }) {
  fluid.runFrames(3);
  env.flushTimers();
}

test('creating the controller changes nothing until activation', () => {
  const { env, fluid, concert } = setup();
  assert.equal(concert.isActive(), false);
  assert.equal(fluid.calls.setLook.length, 0);
  assert.equal(fluid.hooked(), false);
  assert.equal(cards(env).length, 0);
  assert.equal(layer(env).hidden, true, 'the concert layer starts hidden');
  assert.equal(env.footer.children.length, 0, 'nothing is added to the Reset footer');
});

test('activation relights the scene, places three cards, and announces the cue outside the footer', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  assert.equal(concert.isActive(), true);
  assert.deepEqual(plain(fluid.calls.setLook[0].look.a), plain([.10, .16, .95]));
  assert.equal(fluid.calls.setLook[0].transition.type, undefined, 'animated front');
  placeCards({ env, fluid });
  assert.equal(cards(env).length, 3);
  assert.equal(layer(env).hidden, false, 'the cards sit in a shown layer');
  const region = env.host.querySelector('.chaewon-concert-status');
  assert.ok(region, 'a live region exists');
  assert.equal(region.getAttribute('aria-live'), 'polite');
  assert.equal(region.textContent, 'Lit for Chaewon');
  assert.ok(!env.footer.contains(region), 'the announcement is not in the footer');
  assert.equal(env.footer.children.length, 0);
});

test('repeated activation installs one frame hook and one card set', () => {
  const { env, fluid, concert } = setup();
  concert.activate(); concert.activate();
  placeCards({ env, fluid });
  concert.activate();
  assert.equal(fluid.calls.hooks, 1);
  assert.equal(fluid.hookCount(), 1);
  assert.equal(fluid.calls.setLook.length, 1);
  assert.equal(cards(env).length, 3);
});

test('a coarse primary pointer or a disabled controller refuses activation', () => {
  const coarse = setup({ coarse: true });
  coarse.concert.activate();
  assert.equal(coarse.concert.isActive(), false);
  assert.equal(coarse.fluid.calls.setLook.length, 0);
  const off = setup();
  off.concert.setEnabled(false);
  off.concert.activate();
  assert.equal(off.concert.isActive(), false);
  off.concert.setEnabled(true);
  off.concert.activate();
  assert.equal(off.concert.isActive(), true);
});

test('song cues retune only while the concert runs', () => {
  const { fluid, concert } = setup();
  concert.applyCue('crazy');
  assert.equal(fluid.calls.setLook.length, 0);
  concert.activate();
  concert.applyCue('crazy');
  assert.deepEqual(plain(fluid.calls.setLook.at(-1).look.a), plain([.95, .03, .22]));
  concert.applyCue('not-a-song');
  assert.equal(fluid.calls.setLook.length, 2);
});

test('leaving restores the current stock light, clears the override, and restores dye fade', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  fluid.finishFront();
  const later = { ...fluid.getStockLook(), a: [.5, .2, .1] };
  fluid.setStock(later);
  concert.leave();
  assert.equal(concert.isActive(), false);
  const exit = fluid.calls.setLook.at(-1);
  assert.deepEqual(plain(exit.look.a), [.5, .2, .1], 'exit targets the stock light at leave time, not at activation');
  assert.equal(fluid.getTuning().fadeTime, 1, 'concert dye fades quickly during the exit');
  fluid.finishFront();
  assert.equal(fluid.override(), null, 'override cleared when the exit completes');
  assert.equal(fluid.getTuning().fadeTime, 4, 'fade time restored');
  env.flushTimers();
  assert.equal(cards(env).length, 0);
  assert.equal(layer(env).hidden, true, 'the layer hides once the cards have faded');
  assert.equal(fluid.hooked(), false);
  assert.deepEqual(plain(fluid.probePoints()), []);
});

test('an immediate leave settles synchronously, with no timers or frames needed', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  concert.leave({ immediate: true });
  assert.equal(fluid.calls.setLook.at(-1).transition.type, 'cut');
  assert.equal(fluid.override(), null);
  assert.equal(fluid.getTuning().fadeTime, 4);
  assert.equal(cards(env).length, 0, 'cards removed at once');
  assert.equal(layer(env).hidden, true, 'layer hidden at once');
  assert.equal(fluid.hooked(), false);
});

test('disabling exits immediately and blocks cues until re-enabled', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  concert.setEnabled(false);
  assert.equal(concert.isActive(), false);
  assert.equal(cards(env).length, 0);
  assert.equal(fluid.override(), null);
  const count = fluid.calls.setLook.length;
  concert.activate();
  concert.applyCue('easy');
  assert.equal(concert.isActive(), false, 'the trigger cannot restart a disabled concert');
  assert.equal(fluid.calls.setLook.length, count, 'cues are blocked while disabled');
  concert.setEnabled(false);
  assert.equal(fluid.calls.setLook.length, count, 'repeated disable is a no-op');
  concert.setEnabled(true);
  concert.activate();
  concert.applyCue('easy');
  assert.equal(concert.isActive(), true);
  assert.deepEqual(plain(fluid.calls.setLook.at(-1).look.a), plain([.85, .66, .44]), 'cues retune again once re-enabled');
});

test('re-entering before the exit finishes keeps the new concert and the restored fade time', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  fluid.finishFront();
  concert.leave();
  concert.activate();
  assert.equal(concert.isActive(), true);
  assert.deepEqual(plain(fluid.calls.setLook.at(-1).look.a), plain([.10, .16, .95]));
  assert.equal(fluid.getTuning().fadeTime, 4, 'the old exit cleanup ran once, at replacement');
  fluid.finishFront();
  assert.deepEqual(plain(fluid.override().a), plain([.10, .16, .95]), 'no stale cleanup clears the new mood');
  env.flushTimers();
  assert.equal(layer(env).hidden, false, 'the old exit timer does not hide the new concert');
  placeCards({ env, fluid });
  assert.equal(cards(env).length, 3, 'old cards gone, one new set');
});

test('reset keeps the mood, rebuilds the cards, and a later exit uses the new stock light', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  fluid.finishFront();
  const before = cards(env);
  fluid.setStock({ ...fluid.getStockLook(), a: [.7, .1, .3] });
  concert.reset();
  placeCards({ env, fluid });
  const after = cards(env);
  assert.equal(after.length, 3);
  assert.ok(after.every(card => !before.includes(card)), 'cards reinitialized for the new flow');
  assert.equal(layer(env).hidden, false, 'the rebuilt cards sit in a shown layer');
  assert.equal(concert.isActive(), true);
  assert.equal(fluid.hookCount(), 1, 'reset keeps one frame hook');
  concert.leave({ immediate: true });
  assert.equal(fluid.hookCount(), 0, 'no frame hook outlives the concert');
  assert.deepEqual(plain(fluid.calls.setLook.at(-1).look.a), [.7, .1, .3], 'exit uses the new seed stock light');
});

test('Escape returns a forward card before the homepage can switch to Paper', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  const card = cards(env)[1];
  card.click();
  card.focus();
  assert.ok(card.classList.contains('is-forward'));
  const event = env.keydown('Escape', card);
  assert.equal(event.defaultPrevented, true, 'the homepage Escape handler sees defaultPrevented');
  assert.ok(!card.classList.contains('is-forward'));
  assert.equal(env.document.activeElement, card, 'focus stays on the returned card');
  const plain = env.keydown('Escape');
  assert.equal(plain.defaultPrevented, false, 'with no forward card, Escape belongs to the homepage');
});

test('a resize keeps the forward card on screen with its face and focus', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  const card = cards(env)[2];
  card.click(); card.click();
  card.focus();
  assert.ok(card.classList.contains('is-flipped'));
  env.resize(320, 800);
  const r = card.getBoundingClientRect();
  assert.ok(r.left >= 0 && r.top >= 0 && r.right <= 320 && r.bottom <= 800, JSON.stringify(r));
  assert.ok(card.classList.contains('is-flipped'));
  assert.equal(env.document.activeElement, card);
  assert.equal(cards(env).length, 3);
});

test('reduced motion cuts the light and places still cards without waiting for frames', () => {
  const { env, fluid, concert } = setup({ reduce: true });
  concert.activate();
  assert.equal(fluid.calls.setLook[0].transition.type, 'cut');
  env.flushTimers();
  assert.equal(cards(env).length, 3);
  assert.equal(fluid.hooked(), true, 'the hook waits for the fluid to run');
});

test('reduced motion turned on during an animated exit settles the exit without frames', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  fluid.finishFront();
  concert.leave();
  assert.equal(fluid.getTuning().fadeTime, 1, 'the exit sweep is under way');
  // The homepage and the renderer pause on the same change, so no frame finishes the sweep.
  fluid.paused = true;
  const motion = env.media('(prefers-reduced-motion: reduce)');
  motion.matches = true;
  motion.dispatch({ type: 'change', matches: true }, 'bubble');
  assert.equal(fluid.override(), null, 'no concert light remains');
  assert.equal(fluid.getTuning().fadeTime, 4, 'fade time restored');
  const exit = fluid.calls.setLook.at(-1);
  assert.equal(exit.transition.type, 'cut', 'the exit settles as a cut');
  assert.deepEqual(plain(exit.look.a), plain(fluid.getStockLook().a), 'the cut restores the stock light');
  assert.equal(concert.isActive(), false, 'the concert stays off');
  const count = fluid.calls.setLook.length;
  motion.matches = false;
  motion.dispatch({ type: 'change', matches: false }, 'bubble');
  assert.equal(fluid.calls.setLook.length, count, 'a settled exit ignores later motion changes');
});

test('dispose removes owned UI and listeners without disposing the fluid', () => {
  const { env, fluid, concert, baseline } = setup();
  concert.activate();
  placeCards({ env, fluid });
  concert.dispose();
  assert.equal(env.host.querySelectorAll('.chaewon-concert').length, 0);
  assert.equal(env.host.querySelectorAll('.chaewon-concert-status').length, 0);
  assert.equal(fluid.hooked(), false);
  assert.equal(fluid.calls.disposed, 0);
  assert.equal(env.document.listenerTotal(), baseline.document);
  assert.equal(env.window.listenerTotal(), baseline.window);
  concert.dispose();
  concert.activate();
  assert.equal(concert.isActive(), false, 'a disposed controller stays inert');
});

test('a concert started while the renderer is paused rides the current once the scene runs', () => {
  const { env, fluid, concert } = setup({ paused: true });
  concert.activate();
  env.flushTimers();
  assert.equal(cards(env).length, 3, 'still cards placed at once');
  assert.equal(fluid.hooked(), true, 'frame hook installed while paused');
  assert.equal(fluid.probePoints().length, 3 + 12, 'probe slots set for cards and hearts');
  const before = cards(env).map(card => card.getBoundingClientRect().left);
  fluid.paused = false;
  fluid.setFlow([.05, 0]);
  fluid.runFrames(30);
  const after = cards(env).map(card => card.getBoundingClientRect().left);
  assert.ok(after.every((left, i) => left > before[i]), 'cards ride the current: ' + before + ' -> ' + after);
  const card = cards(env)[0];
  card.click(); card.click();
  const hearts = () => env.host.querySelectorAll('.heart');
  assert.ok(hearts().length > 0, 'turning a card releases hearts');
  fluid.runFrames(3);
  assert.ok(hearts().every(heart => /translate3d/.test(heart.style.transform || '')), 'hearts move with the flow');
  fluid.runFrames(200);
  assert.equal(hearts().length, 0, 'hearts expire');
});

test('under reduced motion a resize redraws the still cards on screen', () => {
  const { env, concert } = setup({ reduce: true });
  concert.activate();
  env.flushTimers();
  env.resize(600, 800);
  for (const card of cards(env)) {
    const r = card.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    assert.ok(cx >= 0 && cx <= 600, 'card center ' + cx + ' within a 600 px window');
  }
});

test('a short window shrinks the forward card to fit', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  const card = cards(env)[1];
  card.click();
  env.resize(1280, 300);
  const r = card.getBoundingClientRect();
  assert.ok(r.top >= 0 && r.bottom <= 300 && r.height <= 300 - 32, JSON.stringify(r));
  assert.ok(Math.abs(r.width / r.height - 196 / 303) < .01, 'keeps the 55:85 proportion');
});

test('a card returning to the stage settles at its resting place when the window changes', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  const card = cards(env)[0];
  card.click(); card.click(); card.click();
  assert.ok(card.classList.contains('is-returning'));
  env.resize(900, 800);
  assert.ok(!card.classList.contains('is-returning'), 'the return settles at once');
  const r = card.getBoundingClientRect();
  assert.ok(r.left >= -56 && r.right <= 900 + 56 && r.width === 112, 'resting size and place: ' + JSON.stringify(r));
});

test('a shorter window clamps resting cards into the band between header and footer', () => {
  const { env, concert } = setup({ reduce: true });
  concert.activate();
  env.flushTimers();
  env.resize(1280, 560);
  // The whole card sits between the header (bottom 190) and the footer (top 490),
  // keeping the controller's 14 px margin from each.
  for (const card of cards(env)) {
    const r = card.getBoundingClientRect();
    assert.ok(r.top >= 190 + 14 - .5 && r.bottom <= 490 - 14 + .5, 'card spans ' + r.top + '..' + r.bottom);
  }
});

test('a window too short for the band never stacks two resting cards', () => {
  const { env, fluid, concert } = setup();
  // A bright strand down the middle probe column, so the brightest spots share an x.
  const read = fluid.readProbe;
  fluid.readProbe = () => {
    const probe = read();
    if (probe) for (const s of probe.samples) s.light = Math.abs(s.point[0] - .5) < 1e-6 ? [.9, .9, .9] : [.2, .2, .2];
    return probe;
  };
  concert.activate();
  placeCards({ env, fluid });
  env.resize(1280, 300);
  const rects = cards(env).map(card => card.getBoundingClientRect());
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    assert.ok(!overlap, 'cards ' + i + ' and ' + j + ' overlap: ' + JSON.stringify([a, b]));
  }
});

test('a card stays hidden until it surfaces, out of hit testing and the tab order', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  fluid.runFrames(3);
  assert.equal(cards(env).length, 3, 'placed and waiting to surface');
  for (const card of cards(env)) {
    assert.ok(!card.classList.contains('is-shown'));
    assert.equal(card.style.opacity, '0');
    assert.equal(card.style.visibility, 'hidden', 'an unseen card is out of hit testing and the tab order');
  }
  env.flushTimers();
  for (const card of cards(env)) assert.equal(card.style.visibility, '', 'a surfaced card takes clicks');
});

test('after a quick re-entry, a card still fading from the last concert takes no clicks', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  fluid.finishFront();
  concert.leave();
  const old = cards(env);
  assert.equal(old.length, 3, 'the old cards are still fading out');
  concert.activate();
  for (const card of old) assert.equal(card.inert, true, 'a fading card is out of hit testing and focus');
  old[0].click();
  assert.equal(env.host.querySelectorAll('.card.is-forward').length, 0, 'a fading card cannot come forward');
});

test('turning a card over announces its back through the live region', () => {
  const { env, fluid, concert } = setup();
  concert.activate();
  placeCards({ env, fluid });
  const region = env.host.querySelector('.chaewon-concert-status');
  const [first, second] = env.context.ConcertCore.BACKS;
  const card = cards(env)[1];
  card.click(); card.click();
  assert.ok(card.classList.contains('is-flipped'));
  assert.equal(region.textContent, 'Theorem. ' + first.statement + ' Proof. ' + first.proof);
  assert.equal(card.getAttribute('aria-label'), region.textContent + ' Return the card to the stage.',
    'the focused card keeps the same text in its name');
  card.click();
  const other = cards(env)[0];
  other.click(); other.click();
  assert.equal(region.textContent, 'Lemma. ' + second.statement + ' Proof. ' + second.proof, 'each turn announces its own back');
});
