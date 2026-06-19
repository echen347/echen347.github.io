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
    document.body.classList.add('chaewon-mode');
    setStoredActive();
    state.active = true;
    removeHuntHearts();   // hunt is done once the mode is on
    ensureExitButton();
    applyCardClassMarkers();
    attachAllCardTilts();
    resetIdleTimer();
    ensureMarquees();
    ensureBackground();
    decorateHeadshot();
    preloadPhotos();      // warm the image cache for the SMC reskin + bubbles
    ensureBubbles();      // floating Chaewon photo bubbles on the bio page
    injectStanContent();  // per-page stan comments / intro (no-op where N/A)
    // First manual activation per browser plays the reveal cinematic.
    if (!skipCinematic && !hasFirstSeen()) playCinematic();
    markFirstSeen();
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
    removeBubbles();
    endCinematic();
    removeStanContent();
    if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
    // Subsequent phases: cleanup listeners, restore SMC rendering, etc.
  }

  // ---------- Keyboard buffer trigger ----------
  const TRIGGERS = ['chaewon', 'crazy', 'fearless', 'antifragile', 'easy', 'perfectnight'];
  const BUFFER_MAX = 16;
  // Pre-sorted longest-first to avoid shadowing during match. Recomputed only at module load.
  const SORTED_TRIGGERS = [...TRIGGERS].sort((a, b) => b.length - a.length);

  // Deep-cut LE SSERAFIM / Chaewon references — eras, songs, nickname, fandom,
  // her birthday. Celebrate Chaewon (see spec §10 tone rule). Edit freely.
  const MARQUEE_PHRASES = [
    'STAN KIM CHAEWON',
    'KKURA OUR LEADER',
    'EASY CRAZY HOT',
    'ANTIFRAGILE ON REPEAT',
    'UNFORGIVEN ERA SUPREMACY',
    'PERFECT NIGHT WITH CHAEWON',
    'FEARNOT FOREVER',
    'AUG 1 = NATIONAL HOLIDAY',
  ];

  function buildMarqueeContent() {
    // Each phrase separated by ♡♡♡; repeat the phrase set 3x within "single" so
    // even at frame 0 the doubled content overflows wide viewports. Then doubled
    // for seamless infinite loop (animation translates 0 → -50%).
    const sep = ' ♡♡♡ ';
    const oneRound = MARQUEE_PHRASES.join(sep) + sep;
    const single = oneRound + oneRound + oneRound; // 3 phrase-rounds per "single"
    return single + single; // 6 phrase-rounds total — fills any reasonable viewport
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

  // ---------- Photo preloading (drives the SMC reskin + bubble layer) ----------
  // Bubble photos are preloaded into HTMLImageElements once per session so the
  // homepage SMC canvas (index.html) can drawImage() them without a mid-render
  // network fetch. randomPhoto() returns null until at least one has decoded, so
  // callers should fall back gracefully and retry on a later frame.
  let _photoImages = [];
  let _photoPreloadStarted = false;
  async function preloadPhotos() {
    if (_photoPreloadStarted) return _photoImages;
    _photoPreloadStarted = true;
    const manifest = await loadManifest();
    _photoImages = manifest.bubbles.map(b => {
      const img = new Image();
      img.src = assetUrl(b.file);
      img.alt = b.alt || 'chaewon';
      return { img, alt: img.alt };
    });
    return _photoImages;
  }
  function loadedPhotos() {
    return _photoImages.filter(p => p.img.complete && p.img.naturalWidth > 0).map(p => p.img);
  }
  function randomPhoto() {
    const ready = loadedPhotos();
    return ready.length ? ready[Math.floor(Math.random() * ready.length)] : null;
  }
  window.ChaewonMode.preloadPhotos = preloadPhotos;
  window.ChaewonMode.loadedPhotos = loadedPhotos;
  window.ChaewonMode.randomPhoto = randomPhoto;

  // ---------- Floating Chaewon bubble layer (every page) ----------
  // Gentle drift-and-bounce (no gravity pile-up, so the bio stays readable).
  // Each bubble: hover to pause + zoom, click to pop into a heart burst + respawn.
  // Skipped entirely under prefers-reduced-motion.
  const BUBBLE_COUNT = 9;
  let _bubbleLayer = null;
  let _bubbles = [];
  let _bubbleRAF = null;
  let _bubbleRetry = null;
  let _bubbleRetryCount = 0;
  const _reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function ensureBubbles() {
    if (_bubbleLayer || _reduceMotion) return;
    await preloadPhotos();
    const photos = loadedPhotos();
    if (!photos.length) {
      // Images still decoding — retry while still active. Tracked (so deactivate
      // can cancel it) and capped (so a permanently-failing manifest can't
      // re-arm the timer forever).
      if (_bubbleRetry) { clearTimeout(_bubbleRetry); _bubbleRetry = null; }
      if (_bubbleRetryCount < 12) {
        _bubbleRetryCount++;
        _bubbleRetry = setTimeout(() => {
          _bubbleRetry = null;
          if (state.active) ensureBubbles();
        }, 400);
      }
      return;
    }
    _bubbleRetryCount = 0;
    if (_bubbleLayer || !state.active) return; // guard against double-init after await
    _bubbleLayer = document.createElement('div');
    _bubbleLayer.id = 'chaewon-bubbles';
    _bubbleLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_bubbleLayer);

    const vw = window.innerWidth, vh = window.innerHeight;
    _bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const size = 52 + Math.random() * 42;
      const wrap = document.createElement('div');
      wrap.className = 'chaewon-bubble-wrap';
      const bubble = document.createElement('div');
      bubble.className = 'chaewon-bubble';
      const img = document.createElement('img');
      img.src = photos[i % photos.length].src;
      img.alt = 'chaewon';
      bubble.style.width = bubble.style.height = `${size}px`;
      bubble.appendChild(img);
      wrap.appendChild(bubble);
      _bubbleLayer.appendChild(wrap);
      const b = {
        wrap, bubble, size,
        x: Math.random() * (vw - size),
        y: Math.random() * (vh - size),
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.9,
        paused: false,
      };
      bubble.addEventListener('mouseenter', () => { b.paused = true; });
      bubble.addEventListener('mouseleave', () => { b.paused = false; });
      bubble.addEventListener('click', (ev) => {
        ev.stopPropagation();
        spawnClickBurst(b.x + b.size / 2, b.y + b.size / 2);
        popBubble(b);
      });
      _bubbles.push(b);
    }
    if (!_bubbleRAF) _bubbleRAF = requestAnimationFrame(stepBubbles);
  }

  function popBubble(b) {
    b.bubble.classList.add('chaewon-bubble-popping');
    b._popTimer = setTimeout(() => {
      b._popTimer = null;
      const photos = loadedPhotos();
      if (photos.length) {
        b.bubble.querySelector('img').src =
          photos[Math.floor(Math.random() * photos.length)].src;
      }
      b.bubble.classList.remove('chaewon-bubble-popping');
      // Respawn drifting in from the top edge.
      b.x = Math.random() * (window.innerWidth - b.size);
      b.y = -b.size;
      b.vx = (Math.random() - 0.5) * 0.9;
      b.vy = 0.35 + Math.random() * 0.5;
      b.paused = false;
    }, 340);
  }

  function stepBubbles() {
    if (!state.active || !_bubbleLayer) { _bubbleRAF = null; return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const b of _bubbles) {
      if (!b.paused) { b.x += b.vx; b.y += b.vy; }
      // Clamp every frame — even while paused/hovered — so shrinking the window
      // can't strand a bubble outside the clipped layer.
      if (b.x <= 0) { b.x = 0; b.vx = Math.abs(b.vx); }
      else if (b.x + b.size >= vw) { b.x = vw - b.size; b.vx = -Math.abs(b.vx); }
      if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); }
      else if (b.y + b.size >= vh) { b.y = vh - b.size; b.vy = -Math.abs(b.vy); }
      b.wrap.style.transform = `translate(${b.x}px, ${b.y}px)`;
    }
    _bubbleRAF = requestAnimationFrame(stepBubbles);
  }

  function removeBubbles() {
    if (_bubbleRAF) { cancelAnimationFrame(_bubbleRAF); _bubbleRAF = null; }
    if (_bubbleRetry) { clearTimeout(_bubbleRetry); _bubbleRetry = null; }
    for (const b of _bubbles) {
      if (b._popTimer) { clearTimeout(b._popTimer); b._popTimer = null; }
    }
    if (_bubbleLayer) { _bubbleLayer.remove(); _bubbleLayer = null; }
    _bubbles = [];
    _bubbleRetryCount = 0;
  }

  // ---------- First-activation cinematic (§9) ----------
  // Plays once per browser (gated by localStorage). A black radial fade reveals
  // the reskinned page while a heart burst flies from center and a giant
  // "I ♥ CHAEWON" flashes once. Skipped under reduced motion; interruptible
  // (deactivate calls endCinematic). All elements/timers are tracked for cleanup.
  let _cineEls = [];
  let _cineTimer = null;

  function playCinematic() {
    if (_reduceMotion) return;
    endCinematic(); // guard against overlap

    const fade = document.createElement('div');
    fade.className = 'chaewon-cine-fade';
    fade.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fade);
    _cineEls.push(fade);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const n = 22;
    for (let i = 0; i < n; i++) {
      const heart = document.createElement('span');
      heart.className = 'chaewon-cine-burst';
      heart.textContent = '♥';
      const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.4;
      const dist = 160 + Math.random() * 280;
      heart.style.left = `${cx}px`;
      heart.style.top = `${cy}px`;
      heart.style.fontSize = `${20 + Math.random() * 26}px`;
      heart.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      heart.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      heart.style.setProperty('--r', `${(Math.random() - 0.5) * 140}deg`);
      heart.style.animationDelay = `${0.45 + Math.random() * 0.25}s`;
      document.body.appendChild(heart);
      _cineEls.push(heart);
    }

    const flash = document.createElement('div');
    flash.className = 'chaewon-cine-flash';
    flash.textContent = 'I ♥ CHAEWON';
    flash.setAttribute('aria-hidden', 'true');
    document.body.appendChild(flash);
    _cineEls.push(flash);

    _cineTimer = setTimeout(endCinematic, 2400);
  }

  function endCinematic() {
    if (_cineTimer) { clearTimeout(_cineTimer); _cineTimer = null; }
    _cineEls.forEach(el => el.remove());
    _cineEls = [];
  }

  // ---------- Per-page stan content injection ----------
  // Safe to run on every page: each injector no-ops where its anchors are absent
  // (the course matcher only fires on a known course code; the writing intro only
  // fires when the "Featured Post" heading exists).
  function injectStanContent() {
    injectAcademicComments();
    injectWritingIntro();
  }

  function injectAcademicComments() {
    document.querySelectorAll('main li').forEach(li => {
      if (li.querySelector('.chaewon-stan-comment')) return; // idempotent
      const colon = li.textContent.indexOf(':');
      if (colon < 0) return;
      const code = li.textContent.slice(0, colon).replace(/^\*/, '').trim();
      const comment = COURSE_COMMENTS[code];
      if (!comment) return;
      const span = document.createElement('span');
      span.className = 'chaewon-stan-comment';
      span.textContent = comment;
      li.appendChild(span);
    });
  }

  function injectWritingIntro() {
    const main = document.querySelector('main');
    if (!main || main.querySelector('.chaewon-stan-intro')) return;
    const hasFeatured = [...main.querySelectorAll('h1, h2, h3')]
      .some(h => /featured post/i.test(h.textContent));
    if (!hasFeatured) return;
    // NOT a .chaewon-card — it styles itself like one. Using the card class would
    // make removeCardClassMarkers() unwrap it on deactivate and orphan its text.
    const card = document.createElement('div');
    card.className = 'chaewon-stan-intro';
    card.textContent = WRITING_INTRO;
    main.insertBefore(card, main.firstChild);
  }

  function removeStanContent() {
    document.querySelectorAll('.chaewon-stan-comment, .chaewon-stan-intro').forEach(el => el.remove());
  }

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
    if (!state.active) return;
    // Add a body class for CSS-only eggs (CRAZY, EASY, ANTIFRAGILE)
    const cls = `chaewon-egg-${name}`;
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), 3000);
    // Some eggs also spawn DOM particles
    if (name === 'fearless') spawnPetals();
    else if (name === 'perfectnight') spawnStars();
    else if (name === 'antifragile') spawnLasers();
  }

  function spawnPetals() {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const petal = document.createElement('span');
      petal.className = 'chaewon-petal';
      const glyphs = ['🌸', '🌷', '❀', '✿', '🌺'];
      petal.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      petal.style.left = `${Math.random() * 100}vw`;
      petal.style.fontSize = `${14 + Math.random() * 22}px`;
      if (Math.random() < 0.3) petal.style.filter = 'blur(1.5px)'; // depth-of-field
      const duration = 2.8 + Math.random() * 2.2; // 2.8s to 5s
      const delay = Math.random() * 1.5;
      const swayDir = Math.random() < 0.5 ? 1 : -1;
      const swayAmount = 30 + Math.random() * 60; // 30-90 px
      petal.style.setProperty('--sway', `${swayDir * swayAmount}px`);
      petal.style.setProperty('--rot', `${(Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540)}deg`);
      petal.style.animation = `chaewon-petal-drift ${duration}s linear ${delay}s forwards`;
      document.body.appendChild(petal);
      setTimeout(() => petal.remove(), (duration + delay) * 1000 + 200);
    }
  }

  function spawnStars() {
    const count = 60;
    const tints = ['#ffffff', '#cfe3ff', '#ffd9ec', '#fff4c2']; // white / blue / pink / warm
    for (let i = 0; i < count; i++) {
      const star = document.createElement('span');
      star.className = 'chaewon-star';
      star.textContent = Math.random() < 0.5 ? '✦' : '✧';
      star.style.left = `${Math.random() * 100}vw`;
      star.style.top = `${Math.random() * 100}vh`;
      star.style.fontSize = `${8 + Math.random() * 20}px`;
      star.style.color = tints[Math.floor(Math.random() * tints.length)];
      const duration = 0.8 + Math.random() * 1.8; // 0.8s to 2.6s per twinkle
      const delay = Math.random() * 1.8;
      star.style.animation = `chaewon-star-twinkle ${duration}s ease-in-out ${delay}s forwards`;
      document.body.appendChild(star);
      setTimeout(() => star.remove(), (duration + delay) * 1000 + 200);
    }
    // A few shooting stars streaking diagonally across the field.
    for (let i = 0; i < 4; i++) {
      const shoot = document.createElement('div');
      shoot.className = 'chaewon-shooting-star';
      shoot.style.left = `${Math.random() * 55}vw`;
      shoot.style.top = `${Math.random() * 45}vh`;
      const dur = 0.7 + Math.random() * 0.6;
      const delay = 0.3 + Math.random() * 2.4;
      shoot.style.animation = `chaewon-shoot ${dur}s ease-in ${delay}s forwards`;
      document.body.appendChild(shoot);
      setTimeout(() => shoot.remove(), (dur + delay) * 1000 + 200);
    }
  }

  function spawnLasers() {
    // Concert laser show. Three projectors (two corners + center) each emit a fan
    // of thin, multi-colored beams. Every beam gets its own sweep range, duration,
    // delay, width, and color, so they scissor and cross instead of moving as one
    // rigid fan — that independence is what reads as "real" rather than canned.
    const palette = [
      '255 0 153',   // magenta-pink
      '255 70 90',   // red
      '150 90 255',  // violet
      '60 200 255',  // cyan
      '255 255 255', // white
    ];
    const projectors = [
      { x: '12vw', base: 30 },
      { x: '50vw', base: 0 },
      { x: '88vw', base: -30 },
    ];
    const beamsPer = 5;
    const spread = 17;

    const stage = document.createElement('div');
    stage.className = 'chaewon-laser-stage';
    let maxEnd = 0;

    projectors.forEach((proj) => {
      for (let b = 0; b < beamsPer; b++) {
        const beam = document.createElement('div');
        beam.className = 'chaewon-laser-beam';
        beam.style.left = proj.x;
        const fanOffset = (b - (beamsPer - 1) / 2) * spread + (Math.random() - 0.5) * 6;
        const dur = 2.0 + Math.random() * 1.5;
        const delay = Math.random() * 0.5;
        beam.style.setProperty('--base-angle', `${proj.base + fanOffset}deg`);
        beam.style.setProperty('--sweep', `${14 + Math.random() * 16}deg`);
        beam.style.setProperty('--c', palette[Math.floor(Math.random() * palette.length)]);
        beam.style.setProperty('--beam-w', `${8 + Math.random() * 10}vw`);
        beam.style.animation = `chaewon-laser-sweep ${dur}s ease-in-out ${delay}s forwards`;
        stage.appendChild(beam);
        maxEnd = Math.max(maxEnd, dur + delay);
      }
      const origin = document.createElement('div');
      origin.className = 'chaewon-laser-origin';
      origin.style.left = proj.x;
      stage.appendChild(origin);
    });

    // Run the projector blooms and the page-dim for the full length of the show.
    stage.querySelectorAll('.chaewon-laser-origin').forEach(o => {
      o.style.setProperty('--dur', `${maxEnd}s`);
    });
    const dim = document.createElement('div');
    dim.className = 'chaewon-laser-dim';
    dim.style.animationDuration = `${maxEnd}s`;
    document.body.appendChild(dim);
    document.body.appendChild(stage);
    setTimeout(() => {
      stage.remove();
      dim.remove();
    }, (maxEnd + 0.4) * 1000);
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

    // Pass 1: wrap any leading direct children of main (those before the first
    // direct child that is OR contains a heading) in a "lead" card.
    // This handles index.html's bio-flex (no preceding heading).
    const directChildren = Array.from(main.children);
    let firstHeadingChildIdx = -1;
    for (let i = 0; i < directChildren.length; i++) {
      const child = directChildren[i];
      if (/^H[1-6]$/.test(child.tagName) || child.querySelector('h1, h2, h3, h4, h5, h6')) {
        firstHeadingChildIdx = i;
        break;
      }
    }
    const leadEnd = firstHeadingChildIdx >= 0 ? directChildren[firstHeadingChildIdx] : null;
    const leadChildren = firstHeadingChildIdx >= 0
      ? directChildren.slice(0, firstHeadingChildIdx)
      : directChildren.slice();
    if (leadChildren.length > 0 && !leadChildren[0].closest('.chaewon-card')) {
      const leadWrap = document.createElement('div');
      leadWrap.className = 'chaewon-card';
      main.insertBefore(leadWrap, leadEnd);  // leadEnd is a direct child of main, or null (= append)
      for (const el of leadChildren) leadWrap.appendChild(el);
    }

    // Pass 2: wrap each heading-led block (h2/h3/h4) in a card.
    // parent.insertBefore is safe here because h.parentNode is by definition
    // the correct parent for h.
    document.querySelectorAll('main h2, main h3, main h4').forEach(h => {
      if (h.closest('.chaewon-card')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'chaewon-card';
      const parent = h.parentNode;
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
    // Each row's text — repeat the phrase to widen each row so corners stay covered
    // even at low scale (rotation alone leaves narrow rows short of the corners).
    const rowText = 'I LOVE CHAEWON I LOVE CHAEWON';
    const rows = 12; // dense vertical fill
    const stagger = 0.06; // seconds between adjacent letters
    for (let row = 0; row < rows; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'chaewon-bg-row';
      [...rowText].forEach((ch, i) => {
        const span = document.createElement('span');
        span.textContent = ch;
        // NEGATIVE delay: animation is already mid-cycle at t=0, so every letter
        // is colored from the very first frame. Stagger preserves the wave effect.
        const delay = -((row * rowText.length + i) * stagger);
        span.style.animationDelay = `${delay}s`;
        rowEl.appendChild(span);
      });
      bg.appendChild(rowEl);
    }
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

  // ---------- Cursor trail (Phase 5.1) ----------
  let _cursorTrailLastTime = 0;
  function spawnTrailHeart(x, y) {
    const heart = document.createElement('span');
    heart.className = 'chaewon-trail-heart';
    heart.textContent = '♡';
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 700);
  }
  function handleMouseMove(e) {
    if (!state.active || _reduceMotion) return;
    const now = performance.now();
    if (now - _cursorTrailLastTime < 50) return;
    _cursorTrailLastTime = now;
    spawnTrailHeart(e.clientX, e.clientY);
  }

  function spawnClickBurst(x, y) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span');
      heart.className = 'chaewon-burst-heart';
      heart.textContent = '♡';
      heart.style.left = `${x}px`;
      heart.style.top = `${y}px`;
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 40 + Math.random() * 30;
      heart.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      heart.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 800);
    }
  }
  function handleClickBurst(e) {
    if (!state.active) return;
    // Avoid bursting on exit button (already has its own feedback)
    if (e.target.closest('.chaewon-exit')) return;
    spawnClickBurst(e.clientX, e.clientY);
  }

  // ---------- Card tilt (Phase 5.3) ----------
  function attachCardTilt(card) {
    card.addEventListener('mousemove', e => {
      if (!state.active) return;
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      const rotY = dx * 6;
      const rotX = -dy * 6;
      card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  }
  function attachAllCardTilts() {
    document.querySelectorAll('.chaewon-card').forEach(attachCardTilt);
  }

  // ---------- Idle attention-grab popup (Phase 5.4) ----------
  // Placeholder lines — see spec §10 for tone framing
  const IDLE_LINES = [
    'WHERE U GOING?? GO STREAM UNFORGIVEN ♡',
    'KKURA MISSES YOU ♡',
    'STREAM CRAZY!!! ♡',
    'PERFECT NIGHT IS RIGHT THERE ♡♡♡',
  ];

  // ---------- Heading hover stan-translations (Phase 5.5) ----------
  // Keys must exactly match a heading's text (lowercased) to fire on hover.
  // index.html headings: Research / Publications / Contact.
  // academic.html: the two "Highlighted ... Coursework" h4s.
  // writing.html: Featured Post. (photography.html has no main headings.)
  const HEADING_TRANSLATIONS = {
    'research': 'PROVING THEOREMS BETWEEN UNFORGIVEN STREAMS ♡',
    'publications': 'WHAT I DO BETWEEN EASY CRAZY HOT REPLAYS ♡',
    'contact': 'DM ME UR CHAEWON FANCAMS ♡',
    'highlighted mathematics coursework': 'MATH I GRIND BETWEEN CRAZY STREAMS ♡',
    'highlighted computer science & ece coursework': 'CS I STUDY TO EDIT BETTER FANCAMS ♡',
    'featured post': 'WROTE THIS BETWEEN PERFECT NIGHT REPLAYS ♡',
  };

  // Per-page stan content. Tone rule (spec §10): celebrate Chaewon, frame
  // Ethan's work as something he does between/while stanning — never praise
  // Ethan. Placeholders in his voice; edit freely.
  // Keyed by course code exactly as it appears before the ":" in academic.html.
  const COURSE_COMMENTS = {
    'MATH 8803 RIE': "girl HELP i opened her fancam mid-lecture 😭",
    'MATH 6221': "wasn't listening she was trending",
    'MATH 7339': "my notes literally just say 'kkura' 💀",
    'MATH 6579': "ran on ANTIFRAGILE and delulu all semester",
    'MATH 6121': "studying the wrong group ✋ it's le sserafim",
    'ECE 6756': "should be doing the pset. rewatching her lives instead",
    'ECE 6254': "i'm SO normal about her fancams btw 😭",
    'CS 4650': "zoned out so hard i missed the whole lecture, kkura's fault",
    'CSE 8803 IUQ': "0% uncertainty she's that girl",
    'CS 8803 DTA': "she's already optimal idk what to tell u",
    'ECE 8803 GDL': "no ai out here generating enough kkura content fr 😭",
  };
  const WRITING_INTRO = "he writes here between fancam edits ✋ delulu but literate 😭";

  function lookupTranslation(text) {
    if (!text) return null;
    return HEADING_TRANSLATIONS[text.trim().toLowerCase()] || null;
  }
  function attachHeadingTranslations() {
    document.querySelectorAll('h1, h2, h3, h4').forEach(h => {
      // Find the first non-whitespace text node child. We swap ONLY that node
      // so any child elements (e.g. the SMC re-open button inside index.html's
      // h1 "Ethan Chen") survive the text swap intact.
      let textNode = null;
      for (const node of h.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          textNode = node;
          break;
        }
      }
      if (!textNode) return;
      const original = textNode.textContent;
      const translated = lookupTranslation(original);
      if (!translated) return;
      h.dataset.chaewonOriginal = original;
      h.dataset.chaewonTranslated = translated;
      h.addEventListener('mouseenter', () => {
        if (state.active) textNode.textContent = translated;
      });
      h.addEventListener('mouseleave', () => {
        if (state.active) textNode.textContent = original;
      });
    });
  }

  let _idleTimer = null;
  let _idleFired = false;
  function resetIdleTimer() {
    if (sessionStorage.getItem('chaewonIdleFired') === '1') {
      _idleFired = true;
    }
    if (_idleFired || !state.active) return;
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(fireIdlePopup, 30000);
  }
  async function fireIdlePopup() {
    _idleFired = true;
    sessionStorage.setItem('chaewonIdleFired', '1');
    const manifest = await loadManifest();
    const photo = manifest.bubbles.length ? pickRandom(manifest.bubbles, 1)[0] : null;
    const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    const el = document.createElement('div');
    el.className = 'chaewon-idle-popup';
    el.innerHTML = `
      ${photo ? `<img src="${assetUrl(photo.file)}" alt="${photo.alt || 'chaewon'}">` : ''}
      <div class="chaewon-idle-text">${line}</div>
    `;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('chaewon-idle-leaving'), 4000);
    setTimeout(() => el.remove(), 4600);
  }
  function handleAnyActivity() {
    resetIdleTimer();
  }

  // ---------- Mobile 5-heart treasure hunt (§4.2) ----------
  // Touch-only activation path: five subtle hearts revealed one at a time; tapping
  // the 5th turns on Chaewon Mode. Desktop (pointer: fine) never sees them.
  // Progress persists in sessionStorage so the hunt survives page navigation.
  const HUNT_TOTAL = 5;
  const _isTouch = !!(window.matchMedia &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  let _huntEls = [];

  function huntAnchors() {
    const main = document.querySelector('main');
    if (!main) return [];
    const blocks = [...main.querySelectorAll('p, h2, h3, li')];
    if (!blocks.length) return [];
    const at = f => blocks[Math.min(blocks.length - 1, Math.floor(blocks.length * f))];
    return [at(0.05), at(0.25), at(0.45), at(0.7), at(0.92)];
  }

  function initHunt(force) {
    if ((!_isTouch && !force) || state.active) return;
    showHuntHeart();
  }

  function showHuntHeart() {
    removeHuntHearts();
    const progress = getHuntProgress();
    if (progress >= HUNT_TOTAL) return;
    const anchor = huntAnchors()[progress];
    if (!anchor) return; // no suitable spot on this page
    const heart = document.createElement('span');
    heart.className = 'chaewon-easter-heart';
    heart.textContent = '♡';
    heart.setAttribute('role', 'button');
    heart.setAttribute('tabindex', '0');
    heart.setAttribute('aria-label', 'hidden heart');
    heart.addEventListener('click', onHuntTap);
    anchor.appendChild(heart);
    _huntEls.push(heart);
  }

  function onHuntTap(e) {
    e.stopPropagation();
    const next = getHuntProgress() + 1;
    setHuntProgress(next);
    removeHuntHearts();
    if (next >= HUNT_TOTAL) {
      activate();          // 5th heart -> Chaewon Mode (cinematic on first-ever)
    } else {
      showHuntHeart();
    }
  }

  function removeHuntHearts() {
    _huntEls.forEach(h => h.remove());
    _huntEls = [];
  }

  window.ChaewonMode._initHunt = initHunt; // exposed for tests

  // ---------- Init ----------
  function init() {
    if (isStoredActive()) {
      activate({ skipCinematic: true });
    }
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClickBurst);
    document.addEventListener('mousemove', handleAnyActivity);
    document.addEventListener('keydown', handleAnyActivity);
    document.addEventListener('scroll', handleAnyActivity);
    document.addEventListener('touchstart', handleAnyActivity);
    attachHeadingTranslations();
    initHunt();   // touch-only; no-op on desktop or once active
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
