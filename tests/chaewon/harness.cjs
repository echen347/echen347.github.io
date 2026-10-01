// Shared sandbox for chaewon.js tests: a small DOM, storage, timers, fetch, and
// event-emitting media queries. Loads the real chaewon/chaewon.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const chaewonSource = fs.readFileSync(path.join(root, 'chaewon/chaewon.js'), 'utf8');

function events() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    dispatchEvent(event) { for (const fn of [...(listeners.get(event.type) || [])]) fn(event); },
    listenerCount(type) { return (listeners.get(type) || []).length; },
  };
}

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

// touch: the primary pointer is coarse. samsung: a touch device whose browser
// also reports hover, as Samsung Internet does on Galaxy panels (Chromium < 149).
function boot({ reduceMotion = false, pendingManifest = false, touch = false, samsung = false, readyState = 'complete' } = {}) {
  const requests = [];
  // The DOM boundary records both Image.src and element/HTML image requests.
  // Layout and painting are verified by the browser integration checks.
  function element(tag = 'div') {
    const classes = new Set();
    let src = '';
    const node = Object.assign(events(), {
      tagName: tag.toUpperCase(), children: [], style: { setProperty() {} }, dataset: {}, attributes: {},
      classList: {
        add(value) { classes.add(value); }, remove(value) { classes.delete(value); }, contains(value) { return classes.has(value); },
      },
      setAttribute(key, value) { this.attributes[key] = String(value); },
      appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; },
      insertBefore(child, before) {
        if (!before) return this.appendChild(child);
        child.remove(); child.parentNode = this; this.children.splice(this.children.indexOf(before), 0, child); return child;
      },
      remove() {
        if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
        this.parentNode = null;
      },
      querySelectorAll(selector) {
        const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
        return descendants.filter(child => selector.split(',').some(part => {
          const last = part.trim().split(/\s+/).at(-1);
          if (last === 'img[src*="headshot"]') return child.tagName === 'IMG' && child.src.includes('headshot');
          return last === '*' || (last[0] === '.' ? child.classList.contains(last.slice(1)) : last[0] === '#' ? child.id === last.slice(1) : child.tagName === last.toUpperCase());
        }));
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    });
    Object.defineProperties(node, {
      className: { get: () => [...classes].join(' '), set(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach(value => classes.add(value)); } },
      firstChild: { get: () => node.children[0] || null },
      src: { get: () => src, set(value) { src = value; if (value) requests.push({ kind: 'image', url: value }); } },
      innerHTML: { set(value) {
        for (const match of value.matchAll(/<img[^>]*src="([^"]+)"/g)) {
          const img = element('img'); img.src = match[1]; this.appendChild(img);
        }
      } },
    });
    return node;
  }
  const body = element('body');
  const document = Object.assign(events(), {
    readyState, body,
    createElement: element,
    getElementById: id => body.querySelector('#' + id),
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => body.querySelectorAll(selector),
  });
  const localStorage = storage();
  const sessionStorage = storage();
  const media = new Map();
  const answer = query => {
    if (query === '(prefers-reduced-motion: reduce)') return reduceMotion;
    if (query === '(pointer: coarse)') return touch;
    if (query === '(hover: none)') return touch && !samsung;
    if (query === '(hover: none) and (pointer: coarse)') return touch && !samsung;
    return false;
  };
  const window = Object.assign(events(), { innerWidth: 1000, innerHeight: 700,
    matchMedia(query) {
      if (!media.has(query)) media.set(query, Object.assign(events(), { media: query, matches: answer(query) }));
      return media.get(query);
    } });
  // Flip the primary pointer mid-page, as a 2-in-1 does when it detaches its keyboard.
  const setTouch = value => {
    touch = value;
    for (const [query, list] of media) {
      const matches = answer(query);
      if (list.matches !== matches) { list.matches = matches; list.dispatchEvent({ type: 'change', matches, media: query }); }
    }
  };
  const timers = new Map();
  let timerId = 0;
  let resolveManifest;
  const manifestWait = new Promise(resolve => { resolveManifest = resolve; });
  const context = vm.createContext({ window, document, localStorage, sessionStorage, Node: { TEXT_NODE: 3 },
    Image: function () { return Object.assign(element('img'), { complete: true, naturalWidth: 100 }); },
    fetch: async url => {
      requests.push({ kind: 'fetch', url });
      if (pendingManifest) await manifestWait;
      return { ok: true, json: async () => ({ bubbles: [{ file: 'bubbles/a.jpg', alt: 'photo' }], gifs: [{ file: 'gifs/a.gif' }], mascots: [], stickers: [] }) };
    },
    setTimeout(fn, duration) { const id = ++timerId; timers.set(id, { fn, duration }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame: () => ++timerId, cancelAnimationFrame() {}, console,
  });
  return {
    window, document, requests, timers, resolveManifest, localStorage, sessionStorage, setTouch,
    loadChaewon() { vm.runInContext(chaewonSource, context); },
    type(text, target = body) { for (const key of text) document.dispatchEvent({ type: 'keydown', key, target }); },
    // Deferred scripts run before DOMContentLoaded; this fires it.
    ready() { document.readyState = 'interactive'; document.dispatchEvent({ type: 'DOMContentLoaded' }); },
    async flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); },
    async fireTimer(duration) {
      const entry = [...timers].find(([, value]) => value.duration === duration);
      assert.ok(entry, 'expected a timer at ' + duration + 'ms');
      timers.delete(entry[0]);
      await entry[1].fn();
    },
  };
}

module.exports = { boot };
