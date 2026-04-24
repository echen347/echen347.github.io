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
    // Subsequent phases will hook in here: assets, marquee, bubbles, etc.
  }

  function deactivate() {
    if (!state.active) return;
    document.body.classList.remove('chaewon-mode');
    clearStoredActive();
    state.active = false;
    removeExitButton();
    // Subsequent phases: cleanup listeners, restore SMC rendering, etc.
  }

  // ---------- Keyboard buffer trigger ----------
  const TRIGGERS = ['chaewon']; // sub-eggs added in Phase 5
  const BUFFER_MAX = 16;
  // Pre-sorted longest-first to avoid shadowing during match. Recomputed only at module load.
  const SORTED_TRIGGERS = [...TRIGGERS].sort((a, b) => b.length - a.length);

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

  function parseManifest(data) {
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
      _manifestCache = { bubbles: [], gifs: [], mascots: [], stickers: [] };
      return _manifestCache;
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
