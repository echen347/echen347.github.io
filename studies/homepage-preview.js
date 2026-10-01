(function () {
  'use strict';

  const scene = document.getElementById('scene-layer');
  const canvas = document.getElementById('fluid-canvas');
  const profile = document.getElementById('profile-panel');
  const toggle = document.getElementById('view-toggle');
  const label = document.getElementById('view-label');
  const bookIcon = document.getElementById('book-icon');
  const sceneIcon = document.getElementById('scene-icon');
  const reset = document.getElementById('scene-reset');
  const controls = document.getElementById('scene-controls');
  const sceneHome = document.getElementById('scene-home');
  const paperHome = document.getElementById('paper-home');
  const sceneStatus = document.getElementById('scene-status');
  const profileStatus = document.getElementById('profile-status');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const contentPage = document.body.dataset.scenePage === 'content';
  const localPages = new Set(['/', '/index.html', '/homepage-preview.html', '/profile.html', '/academic.html', '/photography.html', '/writing.html']);
  const pageLinks = [...document.querySelectorAll('a[href]')].map(link => ({
    link, original: link.getAttribute('href'), url: new URL(link.getAttribute('href'), window.location.href)
  })).filter(item => item.url.origin === window.location.origin && localPages.has(item.url.pathname)
    && !item.original.startsWith('#'));
  function readSeed() {
    const value = new URL(window.location.href).searchParams.get('seed');
    return value !== null && /^\d+$/.test(value) && Number(value) <= 4294967295 ? Number(value) : null;
  }
  function freshSeed(previous) {
    const value = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(value);
    else value[0] = Math.floor(Math.random() * 4294967296);
    return value[0] === previous ? (value[0] + 1) >>> 0 : value[0];
  }
  let seed = readSeed() ?? freshSeed();
  const originalOverflow = document.documentElement.style.overflow;
  // The two views share one document but retain different scroll positions.
  // Native restoration runs after popstate and would undo our profile position.
  if (!contentPage && 'scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  let fluid = null, concert = null, view = 'profile', failed = false, suspended = false, modalOpen = false;
  let actualPaused = true, syncing = false, listeningToMotion = false;
  let profileScroll = window.scrollY || 0;

  function syncPlayback() {
    const shouldPause = view !== 'scene' || document.hidden || suspended || modalOpen || media.matches || failed;
    if (!fluid || syncing || actualPaused === shouldPause) return;
    syncing = true;
    try {
      actualPaused = shouldPause;
      fluid.setPaused(shouldPause);
    } finally {
      syncing = false;
    }
  }

  function writeHash(next, replace) {
    const url = new URL(window.location.href);
    if (contentPage) {
      if (next === 'scene') url.searchParams.set('view', 'scene');
      else url.searchParams.delete('view');
    } else url.hash = next;
    if (next === 'scene') url.searchParams.set('seed', String(seed));
    else url.searchParams.delete('seed');
    if (url.href === window.location.href && window.history.state?.sceneSeed === seed) return;
    window.history[replace ? 'replaceState' : 'pushState']({ sceneSeed: seed }, '', url.pathname + url.search + url.hash);
  }

  function updateLinks() {
    for (const { link, original, url: source } of pageLinks) {
      const home = ['/', '/index.html', '/homepage-preview.html'].includes(source.pathname);
      if (view !== 'scene') {
        link.setAttribute('href', home ? source.pathname + '#profile' : original);
        continue;
      }
      const url = new URL(source.href);
      url.searchParams.set('seed', String(seed));
      if (home) url.hash = 'scene';
      else url.searchParams.set('view', 'scene');
      link.setAttribute('href', url.pathname + url.search + url.hash);
    }
    const destination = new URL(window.location.href);
    if (contentPage) {
      if (view === 'scene') {
        destination.searchParams.delete('view');
        destination.searchParams.delete('seed');
      } else {
        destination.searchParams.set('view', 'scene');
        destination.searchParams.set('seed', String(seed));
      }
      toggle.setAttribute('href', destination.pathname + destination.search + destination.hash);
    } else toggle.setAttribute('href', view === 'scene' ? '#profile' : '#scene');
  }

  // The entrance's Chaewon concert consumes this renderer; chaewon.js dispatches
  // the typed trigger to it. It is disposed before the renderer. A page that
  // stays open also detaches it, so the mode moves to the classic decorations;
  // an unloading page keeps it attached, so nothing mounts on the way out.
  function ensureConcert() {
    if (contentPage || concert || !fluid || !window.ChaewonConcert) return;
    try {
      concert = window.ChaewonConcert.create({
        fluid, canvas, host: scene,
        header: document.getElementById('site-header'),
        footer: scene.querySelector?.('.scene-footer') || null
      });
    } catch (error) {
      concert = null;
      return;
    }
    // Attached disabled: showView enables it once the scene is laid out and running.
    concert.setEnabled(false);
    window.ChaewonMode?.setConcert?.(concert);
  }

  function disposeConcert(unloading = false) {
    if (!concert) return;
    const controller = concert;
    concert = null;
    if (!unloading) window.ChaewonMode?.setConcert?.(null);
    controller.dispose();
  }

  function fail() {
    if (failed) return;
    failed = true;
    disposeConcert();
    if (fluid) fluid.dispose();
    fluid = null;
    actualPaused = true;
    profileStatus.textContent = 'The animated scene is unavailable in this browser. The page is still available on paper.';
    profileStatus.hidden = false;
    toggle.hidden = true;
    showView('profile');
    writeHash('profile', true);
  }

  function ensureFluid() {
    if (fluid || failed) return !!fluid;
    try {
      if (!window.FluidPrototype) throw new Error('Fluid renderer unavailable');
      fluid = window.FluidPrototype.create(canvas, {
        paused: true,
        interactive: !contentPage,
        pauseOnSpace: false,
        seed,
        randomized: true,
        onPauseChange(value) {
          // Renderer visibility and media callbacks are not user choices.
          actualPaused = value;
          syncPlayback();
        },
        onError: fail
      });
      if (failed || !fluid || canvas.dataset.state === 'error') {
        fluid?.dispose();
        fluid = null;
        fail();
        return false;
      }
      if (!listeningToMotion) {
        media.addEventListener('change', syncPlayback);
        listeningToMotion = true;
      }
      sceneStatus.hidden = true;
      ensureConcert();
      return true;
    } catch (error) {
      fail();
      return false;
    }
  }

  function showView(next, moveFocus = false) {
    if (next === 'scene' && !ensureFluid()) return;
    if (!contentPage && next !== view && view === 'profile') profileScroll = window.scrollY || 0;
    const changed = next !== view;
    view = next;
    const inScene = view === 'scene';
    if (sceneHome) sceneHome.hidden = !inScene;
    if (paperHome) paperHome.hidden = inScene;
    document.body.dataset.view = view;
    document.documentElement.dataset.view = view;
    delete document.documentElement.dataset.sceneBoot;
    scene.inert = !inScene || modalOpen;
    scene.setAttribute('aria-hidden', String(!inScene || modalOpen));
    if (controls) {
      controls.hidden = !inScene;
      controls.inert = !inScene || modalOpen;
    }
    if (profile && !contentPage) {
      profile.hidden = inScene;
      profile.inert = inScene;
    }
    document.documentElement.style.overflow = inScene && !contentPage ? 'hidden' : originalOverflow;
    label.textContent = inScene ? 'Paper' : 'Scene';
    bookIcon[inScene ? 'removeAttribute' : 'setAttribute']('hidden', '');
    sceneIcon[inScene ? 'setAttribute' : 'removeAttribute']('hidden', '');
    toggle.setAttribute('aria-label', inScene ? 'Show paper' : 'Show scene');
    toggle.hidden = failed;
    // The concert measures the header, so the scene is at the top before it starts.
    if (changed && !contentPage && inScene) window.scrollTo({ top: 0, behavior: 'instant' });
    // The concert must settle before the renderer pauses; it needs no further frame.
    concert?.setEnabled(inScene && !failed);
    syncPlayback();
    window.ChaewonMode?.refresh?.();
    updateLinks();
    if (changed && !contentPage && !inScene) window.scrollTo({ top: profileScroll, behavior: 'instant' });
    if (moveFocus && !failed) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showView(view === 'scene' ? 'profile' : 'scene', true);
    writeHash(view, false);
  });
  reset?.addEventListener('click', () => {
    if (view !== 'scene' || failed || modalOpen || !fluid) return;
    seed = freshSeed(seed);
    fluid.reset(seed);
    concert?.reset();
    writeHash(view, true);
    updateLinks();
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || modalOpen || event.key !== 'Escape' || view !== 'scene') return;
    event.preventDefault();
    showView('profile', true);
    writeHash('profile', false);
  });
  document.addEventListener('visibilitychange', syncPlayback);
  document.addEventListener('site:modalchange', event => {
    modalOpen = !!event.detail.open;
    scene.inert = modalOpen || view !== 'scene';
    scene.setAttribute('aria-hidden', String(scene.inert));
    if (controls) controls.inert = scene.inert;
    syncPlayback();
  });
  window.addEventListener('pagehide', event => {
    suspended = true;
    syncPlayback();
    if (!event.persisted) {
      disposeConcert(true);
      if (fluid) fluid.dispose();
    }
  });
  window.addEventListener('pageshow', () => {
    suspended = false;
    syncPlayback();
  });
  function followHash() {
    const restoredSeed = readSeed() ?? window.history.state?.sceneSeed;
    if (Number.isInteger(restoredSeed) && restoredSeed >= 0 && restoredSeed <= 4294967295 && restoredSeed !== seed) {
      seed = restoredSeed;
      fluid?.reset(seed);
    }
    const inScene = contentPage ? new URL(window.location.href).searchParams.get('view') === 'scene'
      : !window.location.hash || window.location.hash === '#scene';
    showView(inScene ? 'scene' : 'profile');
  }
  window.addEventListener('popstate', followHash);
  window.addEventListener('hashchange', followHash);
  followHash();
  if (view === 'scene') writeHash(view, true);
})();
