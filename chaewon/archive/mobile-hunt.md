# Mobile heart hunt (archived)

Archived 2026-09-30. Ethan decided that Chaewon Mode is desktop-only: on devices whose primary input is touch, the mode never starts. `chaewon.js` now checks `(pointer: coarse)` live: at startup, in `activate()`, when the primary pointer changes, and when a page returns from the back-forward cache. It clears a stale session flag. Hover is not consulted, because Samsung Internet reports hover on touch-only Galaxy phones. Nothing on this page is loaded by the site.

## What it did

Touch devices had no keyboard trigger, so the mode offered a treasure hunt instead. Five small pulsing hearts appeared one at a time inside the page's `main` element, at about 5%, 25%, 45%, 70%, and 92% of its paragraphs, headings, and list items. Tapping the fifth heart turned the mode on and played the first-activation cinematic. Progress lived in `sessionStorage` under `chaewonHuntProgress`, so the hunt continued across page loads in one tab.

On the fluid homepage the hunt could not start: the scene view hides `main`, so the first heart had no visible anchor.

## Code at the time of archiving

Storage helpers, next to the other persistence helpers in `chaewon.js`:

```js
  const HUNT_KEY = 'chaewonHuntProgress';
  function getHuntProgress() {
    const v = sessionStorage.getItem(HUNT_KEY);
    if (v == null) return 0;
    return Math.max(0, Math.min(5, parseInt(v, 10) || 0));
  }
  function setHuntProgress(n) { sessionStorage.setItem(HUNT_KEY, String(n)); }
```

The hunt itself, placed before `init()`:

```js
  // ---------- Mobile 5-heart treasure hunt (§4.2) ----------
  // Touch-only activation path: five subtle hearts revealed one at a time; tapping
  // the 5th turns on Chaewon Mode. Desktop (pointer: fine) never sees them.
  // sessionStorage retains hunt progress during page navigation.
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
```

Hooks elsewhere in `chaewon.js`:

- `state` held `huntProgress: 0`.
- `activate()` called `removeHuntHearts();` right after `state.active = true;`.
- `init()` ended with `initHunt();`.

Styles from `chaewon.css`. They were not scoped under `body.chaewon-mode`, because the hearts appeared on the normal site:

```css
/* Mobile treasure-hunt hearts. Rendered on the NORMAL site (touch devices only),
   so this is deliberately NOT scoped under body.chaewon-mode. Kept subtle. */
.chaewon-easter-heart {
  cursor: pointer;
  color: #ff6aa3;
  margin-left: 3px;
  font-size: 0.9em;
  -webkit-tap-highlight-color: transparent;
  animation: chaewon-easter-heart-pulse 1.8s ease-in-out infinite;
}
@keyframes chaewon-easter-heart-pulse {
  0%, 100% { opacity: 0.45; }
  50%      { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .chaewon-easter-heart { animation: none; opacity: 0.7; }
}
```

`tests/chaewon/persistence.test.js` also checked a copy of the progress helpers: start at 0, read back a stored value, and clamp to 0 through 5.

## Restoring it

1. Remove the touch-first guard from `chaewon.js`: `touchQuery`, `isTouchFirst()`, and its check in `activate()`; in `init()`, the `clearStoredActive()` branch (keep the stored-session `activate()`) and the `change` and `pageshow` listeners. Also remove the `coarse.matches` check in `activate()` and its `coarse` query in `concert-mode.js`, or the homepage concert still refuses a touch device.
2. Put back the helpers, the hunt block, and the three hooks. `chaewon.js` has split its state since the archive: `state.mode` means the mode is on, and `state.active` means the classic decorations are shown and is set in `showLegacy()`. Put `removeHuntHearts();` in `activate()` after `state.mode = true;`, and change the hunt's `state.active` checks to `state.mode`; while the concert presents the mode, `state.active` stays false.
3. Put back the styles.
4. Put back the three hunt-progress tests in `tests/chaewon/persistence.test.js`, and remove the tests that assert the mode never starts on touch devices: the touch-first tests in `tests/chaewon-images.test.cjs`, the coarse-startup tests in `tests/chaewon/persistence.test.js`, and the coarse case of "a coarse primary pointer or a disabled controller refuses activation" in `tests/chaewon/concert-controller.test.js`.
5. Update the places that record the desktop-only decision: `chaewon/README.md`, `chaewon/design/README.md`, `chaewon/design/concert.md`, `chaewon/design/directions.md`, `README.md`, and the desktop-only comment in `chaewon.js`.
6. Give the fluid homepage a visible anchor for the first heart, since the scene view hides `main`.
