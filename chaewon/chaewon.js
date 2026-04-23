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
    const { skipCinematic = false } = opts;
    document.body.classList.add('chaewon-mode');
    sessionStorage.setItem('chaewonMode', '1');
    state.active = true;
    // Subsequent phases will hook in here: assets, marquee, bubbles, etc.
  }

  function deactivate() {
    document.body.classList.remove('chaewon-mode');
    sessionStorage.removeItem('chaewonMode');
    state.active = false;
    // Subsequent phases: cleanup listeners, restore SMC rendering, etc.
  }

  // ---------- Init ----------
  function init() {
    if (sessionStorage.getItem('chaewonMode') === '1') {
      activate({ skipCinematic: true });
    }
    // Triggers wired in Task 1.4.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
