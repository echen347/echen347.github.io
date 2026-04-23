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
    sessionStorage.setItem('chaewonMode', '1');
    state.active = true;
    // Subsequent phases will hook in here: assets, marquee, bubbles, etc.
  }

  function deactivate() {
    if (!state.active) return;
    document.body.classList.remove('chaewon-mode');
    sessionStorage.removeItem('chaewonMode');
    state.active = false;
    // Subsequent phases: cleanup listeners, restore SMC rendering, etc.
  }

  // ---------- Keyboard buffer trigger ----------
  const TRIGGERS = ['chaewon']; // sub-eggs added in Phase 5
  const BUFFER_MAX = 16;
  // Pre-sorted longest-first to avoid shadowing during match. Recomputed only at module load.
  const SORTED_TRIGGERS = [...TRIGGERS].sort((a, b) => b.length - a.length);

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

  // ---------- Init ----------
  function init() {
    if (sessionStorage.getItem('chaewonMode') === '1') {
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
