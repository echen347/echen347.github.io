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
    attachAllCardTilts();
    resetIdleTimer();
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
    if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
    // Subsequent phases: cleanup listeners, restore SMC rendering, etc.
  }

  // ---------- Keyboard buffer trigger ----------
  const TRIGGERS = ['chaewon', 'crazy', 'fearless', 'antifragile', 'easy', 'perfectnight'];
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
    if (!state.active) return; // sub-eggs only fire while in Chaewon mode
    const cls = `chaewon-egg-${name}`;
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), 3000);
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
    if (!state.active) return;
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
    'WHERE U GOING?? KEEP STANNING ♡',
    'CHAEWON MISSES YOU ♡',
    'STREAM CRAZY!!! ♡',
    'COME BACK!! ♡♡♡',
  ];

  // ---------- Heading hover stan-translations (Phase 5.5) ----------
  const HEADING_TRANSLATIONS = {
    'publications': 'WHAT I DO WHEN NOT STANNING CHAEWON ♡',
    'research': 'BETWEEN STREAMING CRAZY ON REPEAT ♡',
    'contact': 'DM ME UR CHAEWON FANCAMS ♡',
    'coursework': 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡',
    'in progress': 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡',
    'mathematics': 'MATH WHILE STREAMING CRAZY ♡',
    'cs/ece': 'CODING WITH CHAEWON ON LOOP ♡',
  };
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
