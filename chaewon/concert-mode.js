// Chaewon concert on the homepage entrance. Typing "chaewon" (dispatched by
// chaewon.js) relights the existing fluid with a front that travels along the
// strands, then three photocards ride the current. The homepage controller owns
// the renderer; this controller only adds light, cards, hearts, and a hidden
// announcement region. It never creates or disposes a renderer.
(function () {
  'use strict';
  const core = self.ConcertCore;

  const PHOTO_ROOT = '/images/chaewon/bubbles/';
  const PHOTOS = [
    { file: 'chaewon-00.jpg', alt: 'Kim Chaewon throwing a finger heart' },
    { file: 'chaewon-04.jpg', alt: 'Kim Chaewon waving in a white beret' },
    { file: 'chaewon-02.jpg', alt: 'Kim Chaewon in close-up' },
  ];
  const HEART_SLOTS = 12;
  const HEART_LIFE = 2.8;       // seconds
  const DRIFT = .042;           // ambient drift, uv per second along the strands
  const FLOW_GAIN = 1.5;        // a card spans many probe texels; exaggerate the local flow a little
  const EXIT_FADE = 900;        // ms for cards to fade out on an animated exit

  function create({ fluid, canvas, host, header, footer }) {
    if (!core || !fluid || !host) throw new Error('ChaewonConcert needs ConcertCore, a renderer, and a host');
    const coarse = matchMedia('(pointer: coarse)');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const layer = document.createElement('div');
    layer.className = 'chaewon-concert';
    layer.hidden = true;
    host.appendChild(layer);
    const status = document.createElement('p');
    status.className = 'chaewon-concert-status';
    status.setAttribute('aria-live', 'polite');
    host.appendChild(status);

    const grid = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) grid.push([.14 + col * .18, .5]);
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    const cancel = id => { clearTimeout(id); timers.delete(id); };
    let enabled = true, disposed = false;
    const state = { on: false, cue: null, cards: [], hearts: [], forward: null, backIndex: 0,
      placing: false, placeFrame: 0, unhook: null, bounds: core.DEFAULT_BOUNDS, exit: null };

    // ---------- geometry ----------
    function cardSize() {
      const style = getComputedStyle(layer);
      const read = (name, fallback) => parseFloat(style.getPropertyValue(name)) || fallback;
      return { width: read('--card-w', 112), height: read('--card-h', 173),
        forwardWidth: read('--forward-w', 196), forwardHeight: read('--forward-h', 303) };
    }
    function updateBounds() {
      const { width, height } = cardSize();
      const top = (header ? header.getBoundingClientRect().bottom : 0) + height / 2 + 14;
      const bottom = innerHeight - (footer ? footer.getBoundingClientRect().top : innerHeight) + height / 2 + 14;
      const half = width / 2 / innerWidth;
      state.bounds = { top: Math.min(.9, 1 - top / innerHeight), bottom: Math.max(.1, bottom / innerHeight), half };
      if (state.bounds.bottom > state.bounds.top) state.bounds = { top: .5, bottom: .5, half };
      grid.forEach((point, i) => {
        point[1] = state.bounds.bottom + (state.bounds.top - state.bounds.bottom) * (.2 + Math.floor(i / 5) * .3);
      });
    }
    const toPixels = (x, y) => [x * innerWidth, (1 - y) * innerHeight];
    const toUv = (px, py) => [px / innerWidth, 1 - py / innerHeight];
    const live = () => !fluid.isPaused() && !document.hidden;

    // ---------- cues ----------
    function applyCue(name) {
      if (disposed || !state.on || !core.CUES[name]) return;
      const cue = core.CUES[name];
      const look = core.lookFor(name);
      state.cue = name;
      status.textContent = cue.label;
      fluid.setLook(look, reduce.matches ? { type: 'cut' } : { speed: cue.speed, width: cue.width, edge: look.edge });
    }

    // ---------- cards ----------
    const span = className => { const el = document.createElement('span'); el.className = className; return el; };
    const clear = el => { for (const child of [...el.children]) child.remove(); };
    function makeCard(photo, index, x, y) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'card';
      const inner = span('card-inner');
      const front = span('card-face card-front');
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = PHOTO_ROOT + photo.file;
      front.appendChild(img);
      const back = span('card-face card-back');
      back.setAttribute('aria-hidden', 'true');
      inner.appendChild(front);
      inner.appendChild(back);
      el.appendChild(inner);
      const card = { el, front, back, photo, index, x, y, opacity: core.edgeOpacity(x, state.bounds.half), tilt: 0,
        flipped: false, shown: false, timer: 0, returnTimer: 0, backText: '' };
      el.addEventListener('click', () => handleCard(card));
      label(card);
      layer.appendChild(el);
      return card;
    }
    function label(card) {
      const name = 'Photocard of ' + card.photo.alt + '. ';
      if (card.flipped) card.el.setAttribute('aria-label', card.backText + ' Return the card to the stage.');
      else if (state.forward === card) card.el.setAttribute('aria-label', name + 'Turn it over.');
      else card.el.setAttribute('aria-label', name + 'Bring it forward.');
    }
    function writeBack(card) {
      const back = core.BACKS[state.backIndex++ % core.BACKS.length];
      clear(card.back);
      const statement = span(back.kind);
      statement.textContent = back.statement;
      card.back.appendChild(statement);
      card.backText = back.kind[0].toUpperCase() + back.kind.slice(1) + '. ' + back.statement;
      if (back.proof) {
        const proof = span('proof');
        proof.textContent = back.proof;
        card.back.appendChild(proof);
        card.backText += ' Proof. ' + back.proof;
      }
    }
    function place(points) {
      points.forEach(([x, y], i) => {
        const card = makeCard(PHOTOS[i], i, x, y);
        state.cards.push(card);
        renderCard(card, null);
        // Cards surface in stage order, roughly as the front reaches them.
        card.timer = later(() => { card.shown = true; card.el.classList.add('is-shown'); renderCard(card, null); },
          reduce.matches || !live() ? 0 : 500 + x * 1800);
      });
    }
    function fallbackPoints() {
      const { top, bottom } = state.bounds, mid = (top + bottom) / 2, span = (top - bottom) / 2;
      return [[.24, mid + span * .35], [.52, mid - span * .25], [.78, mid + span * .15]];
    }
    function renderCard(card, sample) {
      if (state.forward === card || card.el.classList.contains('is-returning')) return;
      const { width, height } = cardSize();
      const [px, py] = toPixels(card.x, card.y);
      card.el.style.transform = `translate3d(${(px - width / 2).toFixed(1)}px,${(py - height / 2).toFixed(1)}px,0) rotate(${card.tilt.toFixed(2)}deg)`;
      card.el.style.opacity = card.shown ? String(card.opacity) : '0';
      // Hidden until it surfaces, so an unseen card takes no clicks or focus.
      card.el.style.visibility = !card.shown || card.opacity < .02 ? 'hidden' : '';
      card.el.style.setProperty('--sheen', (96 + card.x * 40).toFixed(1) + 'deg');
      if (sample) {
        // The rim takes the color of the light behind the card.
        const [r, g, b] = sample.light.map(v => Math.min(255, Math.round(255 * (1 - Math.exp(-Math.max(0, v) * 2.2)))));
        card.el.style.setProperty('--rim', `rgba(${r},${g},${b},.55)`);
      }
    }
    // The forward size shrinks to fit short or narrow viewports, keeping 55:85.
    function forwardSize() {
      const { forwardWidth, forwardHeight } = cardSize();
      const scale = Math.min(1, (innerWidth - 32) / forwardWidth, (innerHeight - 32) / forwardHeight);
      return { width: forwardWidth * scale, height: forwardHeight * scale };
    }
    // Positioning only: never changes the face, focus, or which card is forward.
    function positionForward(card) {
      const size = forwardSize();
      const [cx, cy] = toPixels(card.x, card.y);
      const rect = core.forwardRect({ cx, cy }, size, { width: innerWidth, height: innerHeight }, 16);
      card.el.style.width = size.width.toFixed(1) + 'px';
      card.el.style.height = size.height.toFixed(1) + 'px';
      card.el.style.transform = `translate3d(${rect.left.toFixed(1)}px,${rect.top.toFixed(1)}px,0) rotate(0deg)`;
    }
    function bringForward(card) {
      release();
      state.forward = card;
      card.el.classList.add('is-forward');
      card.el.style.opacity = '1';
      card.el.style.visibility = '';
      positionForward(card);
      label(card);
    }
    function flip(card) {
      writeBack(card);
      card.flipped = true;
      card.el.classList.add('is-flipped');
      card.front.setAttribute('aria-hidden', 'true');
      label(card);
      // A focused button's new name is not reliably spoken; the live region is.
      status.textContent = card.backText;
      releaseHearts(card);
    }
    function release() {
      const card = state.forward;
      if (!card) return;
      state.forward = null;
      card.flipped = false;
      card.el.classList.remove('is-flipped', 'is-forward');
      card.el.style.width = '';
      card.el.style.height = '';
      card.front.removeAttribute('aria-hidden');
      card.el.classList.add('is-returning');
      const { width, height } = cardSize();
      const [px, py] = toPixels(card.x, card.y);
      card.el.style.transform = `translate3d(${(px - width / 2).toFixed(1)}px,${(py - height / 2).toFixed(1)}px,0) rotate(0deg)`;
      cancel(card.returnTimer);
      card.returnTimer = later(() => card.el.classList.remove('is-returning'), reduce.matches ? 0 : 560);
      label(card);
    }
    function handleCard(card) {
      // A card still fading from an earlier concert belongs to no stage.
      if (!state.on || !state.cards.includes(card)) return;
      if (state.forward !== card) bringForward(card);
      else if (!card.flipped) flip(card);
      else release();
    }
    function removeCards() {
      for (const card of state.cards) { cancel(card.timer); cancel(card.returnTimer); card.el.remove(); }
      state.cards = [];
      state.forward = null;
      for (const heart of state.hearts) heart.el.remove();
      state.hearts = [];
    }

    // ---------- hearts ----------
    function releaseHearts(card) {
      if (reduce.matches || !live()) return;
      const rect = card.el.getBoundingClientRect();
      const free = HEART_SLOTS - state.hearts.length;
      for (let i = 0; i < Math.min(7, free); i++) {
        const angle = (i / 7) * Math.PI * 2 + .4;
        const [x, y] = toUv(rect.left + rect.width / 2 + Math.cos(angle) * rect.width * .56,
          rect.top + rect.height / 2 + Math.sin(angle) * rect.height * .52);
        const el = span('heart');
        el.textContent = '♥';
        el.setAttribute('aria-hidden', 'true');
        layer.appendChild(el);
        state.hearts.push({ el, x, y, age: 0, push: [Math.cos(angle) * .05, -Math.sin(angle) * .05] });
      }
    }
    function stepHearts(samples, dt) {
      state.hearts = state.hearts.filter((heart, i) => {
        heart.age += dt;
        if (heart.age >= HEART_LIFE) { heart.el.remove(); return false; }
        const s = samples[3 + i];
        const v = s ? s.velocity : [0, 0];
        const decay = Math.exp(-heart.age * 2.2);
        heart.x += (v[0] * 2.2 + heart.push[0] * decay) * dt;
        heart.y += (v[1] * 2.2 + heart.push[1] * decay) * dt;
        const [px, py] = toPixels(heart.x, heart.y);
        const life = heart.age / HEART_LIFE;
        heart.el.style.opacity = String(Math.min(1, heart.age * 6) * (1 - life * life));
        heart.el.style.transform = `translate3d(${(px - 6).toFixed(1)}px,${(py - 8).toFixed(1)}px,0) scale(${(1 + life * .5).toFixed(2)})`;
        return true;
      });
    }

    // ---------- frame loop (runs inside the renderer's tick) ----------
    function probeSlots() {
      const points = state.cards.map(card => [card.x, card.y]);
      while (points.length < 3) points.push([.5, .5]);
      for (let i = 0; i < HEART_SLOTS; i++) {
        const heart = state.hearts[i];
        points.push(heart ? [heart.x, heart.y] : [.5, .5]);
      }
      return points;
    }
    // The frame hook is always installed: a concert that starts while the fluid is
    // paused (a hidden tab, or activation before the scene unpauses) must ride the
    // current once frames run. Hooks never fire while the fluid is paused.
    function startPlacing() {
      if (!state.unhook) state.unhook = fluid.onFrame(frame);
      if (live()) {
        state.placing = true;
        state.placeFrame = 0;
        fluid.setProbePoints(grid);
      } else {
        state.placing = false;
        place(fallbackPoints());
        fluid.setProbePoints(probeSlots());
      }
    }
    function frame({ frames, dt }) {
      if (!state.on) return;
      const probe = fluid.readProbe();
      if (state.placing) {
        if (!state.placeFrame) state.placeFrame = frames;
        if (!probe || probe.frame < state.placeFrame || probe.samples.length !== grid.length) return;
        state.placing = false;
        place(core.pickStartPoints(probe.samples, 3, .22));
        fluid.setProbePoints(probeSlots());
        return;
      }
      const samples = probe && probe.samples.length === 3 + HEART_SLOTS ? probe.samples : [];
      for (const card of state.cards) {
        // A card held forward or animating back stays put, so it lands where it left.
        if (state.forward === card || card.el.classList.contains('is-returning')) continue;
        const sample = samples[card.index];
        const flow = sample ? { velocity: sample.velocity.map(v => v * FLOW_GAIN) } : null;
        const next = core.stepCard(card, flow, fluid.ambientDirection(card.x, card.y), dt, state.bounds, DRIFT);
        const wrapped = Math.abs(next.x - card.x) > .5;
        Object.assign(card, next);
        // Tilt with the vertical flow, eased, so cards bank into the current.
        const target = Math.max(-9, Math.min(9, -(flow ? flow.velocity[1] : 0) * 140));
        card.tilt = wrapped ? target : card.tilt + (target - card.tilt) * Math.min(1, dt * 3);
        renderCard(card, sample);
      }
      stepHearts(samples, dt);
      fluid.setProbePoints(probeSlots());
    }

    // ---------- lifecycle ----------
    function activate() {
      if (disposed || !enabled || state.on || coarse.matches) return;
      state.on = true;
      layer.hidden = false;
      updateBounds();
      applyCue('chaewon');
      startPlacing();
    }
    function leave({ immediate = false } = {}) {
      if (!state.on) return;
      const hadFocus = layer.contains(document.activeElement);
      release();
      state.on = false;
      state.placing = false;
      state.cue = null;
      status.textContent = '';
      if (state.unhook) { state.unhook(); state.unhook = null; }
      fluid.setProbePoints([]);
      const quick = immediate || reduce.matches || !live();
      if (quick) {
        removeCards();
        layer.hidden = true;
      } else {
        const leaving = state.cards;
        state.cards = [];
        for (const heart of state.hearts) heart.el.remove();
        state.hearts = [];
        for (const card of leaving) { cancel(card.timer); cancel(card.returnTimer); card.el.inert = true; card.el.style.opacity = '0'; }
        later(() => { for (const card of leaving) card.el.remove(); if (!state.on) layer.hidden = true; }, EXIT_FADE);
      }
      // Concert-colored dye would outlive the light; fade it quickly while the stock light returns.
      const fadeTime = fluid.getTuning().fadeTime;
      fluid.setTuning({ fadeTime: 1 });
      const done = () => { if (state.exit === done) state.exit = null; fluid.clearLook(); fluid.setTuning({ fadeTime }); };
      state.exit = done;
      fluid.setLook(fluid.getStockLook(), quick ? { type: 'cut', done } : { speed: .6, width: .1, edge: [.30, .33, .38], done });
      if (hadFocus && canvas) canvas.focus({ preventScroll: true });
    }
    function setEnabled(value) {
      value = !!value;
      if (disposed || value === enabled) return;
      enabled = value;
      if (!enabled) leave({ immediate: true });
    }
    function reset() {
      if (disposed || !state.on) return;
      // The owner has already reset the fluid; the renderer keeps the mood.
      removeCards();
      updateBounds();
      startPlacing();
    }

    // ---------- input ----------
    function onKeydown(event) {
      if (event.key !== 'Escape' || !state.forward) return;
      // Capture phase: return the card before the homepage treats Escape as "show Paper".
      event.preventDefault();
      const card = state.forward;
      release();
      card.el.focus();
    }
    function onPointerDown(event) {
      if (state.forward && !state.forward.el.contains(event.target)) release();
    }
    // A viewport change keeps every card reachable: resting cards clamp into the
    // new band and redraw now (static modes get no further frames), a returning
    // card settles first, and the forward card keeps its face and focus.
    function onResize() {
      if (!state.on) return;
      updateBounds();
      for (const card of state.cards) {
        card.y = Math.max(state.bounds.bottom, Math.min(state.bounds.top, card.y));
        card.opacity = core.edgeOpacity(card.x, state.bounds.half);
        if (card.el.classList.contains('is-returning')) {
          cancel(card.returnTimer);
          card.el.classList.remove('is-returning');
        }
        if (state.forward === card) positionForward(card);
        else renderCard(card, null);
      }
    }
    function onMotionChange() {
      // Reduced motion keeps the renderer paused, which would stop an exit sweep partway; settle it as a cut.
      if (state.exit) fluid.setLook(fluid.getStockLook(), { type: 'cut', done: state.exit });
      if (!state.on) return;
      // Restart under the new motion rules, keeping the current cue.
      const cue = state.cue;
      leave({ immediate: true });
      activate();
      if (cue && cue !== 'chaewon') applyCue(cue);
    }
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    addEventListener('resize', onResize);
    reduce.addEventListener('change', onMotionChange);

    function dispose() {
      if (disposed) return;
      leave({ immediate: true });
      disposed = true;
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      removeEventListener('resize', onResize);
      reduce.removeEventListener('change', onMotionChange);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      removeCards();
      layer.remove();
      status.remove();
    }

    return {
      activate, leave, setEnabled, reset, dispose, applyCue,
      isActive: () => state.on,
      isEnabled: () => enabled && !disposed,
    };
  }

  self.ChaewonConcert = { create };
})();
