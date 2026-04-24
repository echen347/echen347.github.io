// chaewon/chaewon.js
// Chaewon Mode entry point. See docs/superpowers/specs/2026-04-22-chaewon-mode-design.md
(function () {
  'use strict';

  // Will hold all module state. Populated by init().
  const state = {
    active: false,
    keyBuffer: '',
    huntProgress: 0,
  };

  // ---------- Public API (exposed for tests + console use) ----------
  window.ChaewonMode = {
    activate,
    deactivate,
    isActive: () => state.active,
    _state: state, // exposed for tests; do not rely on in production code
  };

  // ---------- Lifecycle ----------
  function activate(opts = {}) {
    if (state.active) return;
    const { skipCinematic = false } = opts;
    void skipCinematic; // consumed by cinematic logic wired in Task 7.1
    document.body.classList.add('chaewon-mode');
    setStoredActive();
    state.active = true;
    ensureExitButton();
    applyCardClassMarkers();
    ensureMarquees();
    ensureBackground();
    decorateHeadshot();
    // Subsequent phases will hook in here: assets, marquee, bubbles, etc.
  }

  function deactivate() {
    if (!state.active) return;
    document.body.classList.remove('chaewon-mode');
    clearStoredActive();
    state.active = false;
    removeExitButton();
    removeCardClassMarkers();
    removeMarquees();
    removeBackground();
    undecorateHeadshot();
    // Subsequent phases: cleanup listeners, restore SMC rendering, etc.
  }

  // ---------- Keyboard buffer trigger ----------
  const TRIGGERS = ['chaewon']; // sub-eggs added in Phase 5
  const BUFFER_MAX = 16;
  // Pre-sorted longest-first to avoid shadowing during match. Recomputed only at module load.
  const SORTED_TRIGGERS = [...TRIGGERS].sort((a, b) => b.length - a.length);

  // Placeholder phrase rotation — see spec §10 for tone framing
  const MARQUEE_PHRASES = [
    'STAN CHAEWON',
    'STREAM CRAZY',
    'KIM CHAEWON IS PEAK PERFORMANCE',
    'LE SSERAFIM FOREVER',
    'CHAEWON WORLD DOMINATION',
  ];

  function buildMarqueeContent() {
    // Each phrase separated by ♡♡♡; loop the whole sequence twice for seamless scroll
    const sep = ' ♡♡♡ ';
    const single = MARQUEE_PHRASES.map(p => p).join(sep) + sep;
    return single + single; // duplicated for seamless infinite loop
  }

  // ---------- Persistence helpers — mirror tests/chaewon/persistence.test.js ----------
  const SESSION_KEY = 'chaewonMode';
  const FIRST_SEEN_KEY = 'chaewonModeFirstSeen';
  const HUNT_KEY = 'chaewonHuntProgress';

  function isStoredActive() { return sessionStorage.getItem(SESSION_KEY) === '1'; }
  function setStoredActive() { sessionStorage.setItem(SESSION_KEY, '1'); }
  function clearStoredActive() { sessionStorage.removeItem(SESSION_KEY); }
  function hasFirstSeen() { return localStorage.getItem(FIRST_SEEN_KEY) === '1'; }
  function markFirstSeen() { localStorage.setItem(FIRST_SEEN_KEY, '1'); }
  function getHuntProgress() {
    const v = sessionStorage.getItem(HUNT_KEY);
    if (v == null) return 0;
    return Math.max(0, Math.min(5, parseInt(v, 10) || 0));
  }
  function setHuntProgress(n) { sessionStorage.setItem(HUNT_KEY, String(n)); }

  // ---------- Asset loading — cached for the session ----------
  let _manifestCache = null;

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

  async function loadManifest() {
    if (_manifestCache) return _manifestCache;
    try {
      const res = await fetch('/images/chaewon/manifest.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      const data = await res.json();
      _manifestCache = parseManifest(data);
      return _manifestCache;
    } catch (err) {
      console.warn('[chaewon] manifest load failed; using empty asset set:', err);
      // Don't poison the cache — let next call retry.
      return { bubbles: [], gifs: [], mascots: [], stickers: [] };
    }
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

  function assetUrl(file) {
    return `/images/chaewon/${file}`;
  }

  // Expose for inspection / debugging
  window.ChaewonMode.loadManifest = loadManifest;
  window.ChaewonMode.assetUrl = assetUrl;

  function handleKeydown(e) {
    const key = e.key;
    if (typeof key !== 'string' || key.length !== 1) return;
    const normalized = key.toLowerCase();
    if (!/^[a-z0-9]$/.test(normalized)) return;
    state.keyBuffer = (state.keyBuffer + normalized).slice(-BUFFER_MAX);
    for (const t of SORTED_TRIGGERS) {
      if (state.keyBuffer.endsWith(t)) {
        state.keyBuffer = '';   // reset to prevent ghost matches
        if (t === 'chaewon') {
          if (state.active) deactivate();
          else activate();
        } else {
          handleSubEgg(t);
        }
        return;
      }
    }
  }

  function handleSubEgg(name) {
    // Stub — Phase 5 (Task 5.6) implements the visual flourishes per sub-egg.
    // The warn helps debugging if a sub-egg trigger is added prematurely.
    console.warn('[ChaewonMode] sub-egg matched but handler not yet implemented:', name);
  }

  // ---------- Exit button ----------
  let exitBtn = null;

  function ensureExitButton() {
    if (exitBtn) return;
    exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'chaewon-exit';
    exitBtn.textContent = '× exit ♡';
    exitBtn.setAttribute('aria-label', 'Exit Chaewon Mode');
    exitBtn.addEventListener('click', deactivate);
    document.body.appendChild(exitBtn);
  }

  function removeExitButton() {
    if (!exitBtn) return;
    exitBtn.remove();
    exitBtn = null;
  }

  // ---------- Card markers ----------
  // Mark major content blocks as cards. Idempotent: skips headings already
  // inside a chaewon-card, so calling this twice doesn't produce nested cards.
  function applyCardClassMarkers() {
    const main = document.querySelector('main');
    if (!main) return;

    // Pass 1: wrap any leading content (before the first h2/h3/h4) in a "lead" card.
    // This handles index.html's bio-flex (no preceding heading) and similar intro paragraphs.
    const firstHeading = main.querySelector('h2, h3, h4');
    const leadChildren = [];
    for (const child of Array.from(main.children)) {
      if (child === firstHeading) break;
      leadChildren.push(child);
    }
    if (leadChildren.length > 0 && !leadChildren[0].closest('.chaewon-card')) {
      const leadWrap = document.createElement('div');
      leadWrap.className = 'chaewon-card';
      main.insertBefore(leadWrap, firstHeading || null);
      for (const el of leadChildren) leadWrap.appendChild(el);
    }

    // Pass 2: wrap each heading-led block (h2/h3/h4) in a card.
    document.querySelectorAll('main h2, main h3, main h4').forEach(h => {
      if (h.closest('.chaewon-card')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'chaewon-card';
      const parent = h.parentNode;
      // Collect siblings until next h1-h6
      const collected = [h];
      let next = h.nextElementSibling;
      while (next && !/^H[1-6]$/.test(next.tagName)) {
        collected.push(next);
        next = next.nextElementSibling;
      }
      parent.insertBefore(wrapper, h);
      for (const el of collected) wrapper.appendChild(el);
    });
  }

  function removeCardClassMarkers() {
    document.querySelectorAll('.chaewon-card').forEach(card => {
      const parent = card.parentNode;
      while (card.firstChild) parent.insertBefore(card.firstChild, card);
      card.remove();
    });
  }

  function ensureMarquees() {
    if (document.getElementById('chaewon-marquee-top')) return;
    const positions = ['top', 'bottom', 'left', 'right'];
    for (const pos of positions) {
      const bar = document.createElement('div');
      bar.id = `chaewon-marquee-${pos}`;
      bar.className = `chaewon-marquee chaewon-marquee-${pos}`;
      const inner = document.createElement('div');
      inner.className = 'chaewon-marquee-inner';
      inner.textContent = buildMarqueeContent();
      bar.appendChild(inner);
      document.body.appendChild(bar);
    }
  }

  function removeMarquees() {
    document.querySelectorAll('.chaewon-marquee').forEach(el => el.remove());
  }

  function ensureBackground() {
    if (document.getElementById('chaewon-bg')) return;
    const bg = document.createElement('div');
    bg.id = 'chaewon-bg';
    bg.className = 'chaewon-bg';
    bg.setAttribute('aria-hidden', 'true');
    const text = 'I LOVE CHAEWON';
    // 4 stacked rows for visual fill
    for (let row = 0; row < 4; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'chaewon-bg-row';
      [...text].forEach((ch, i) => {
        const span = document.createElement('span');
        span.textContent = ch;
        span.style.animationDelay = `${(row * text.length + i) * 0.12}s`;
        rowEl.appendChild(span);
      });
      bg.appendChild(rowEl);
    }
    // Insert as first child of body so it's behind everything
    document.body.insertBefore(bg, document.body.firstChild);
  }

  function removeBackground() {
    const bg = document.getElementById('chaewon-bg');
    if (bg) bg.remove();
  }

  function decorateHeadshot() {
    const img = document.querySelector('img[src*="headshot"]');
    if (!img) return;
    img.classList.add('chaewon-headshot');
    // Wrap the img if not already wrapped, so we can position the sticker
    if (!img.parentNode.classList.contains('chaewon-headshot-wrap')) {
      const wrap = document.createElement('span');
      wrap.className = 'chaewon-headshot-wrap';
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
      const sticker = document.createElement('span');
      sticker.className = 'chaewon-headshot-sticker';
      sticker.textContent = '❤';
      sticker.setAttribute('aria-hidden', 'true');
      wrap.appendChild(sticker);
    }
  }

  function undecorateHeadshot() {
    const wrap = document.querySelector('.chaewon-headshot-wrap');
    if (!wrap) return;
    const img = wrap.querySelector('img');
    if (img) {
      img.classList.remove('chaewon-headshot');
      wrap.parentNode.insertBefore(img, wrap);
    }
    wrap.remove();
  }

  // ---------- Init ----------
  function init() {
    if (isStoredActive()) {
      activate({ skipCinematic: true });
    }
    document.addEventListener('keydown', handleKeydown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
