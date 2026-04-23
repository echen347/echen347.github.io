# Chaewon Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Chaewon Mode as specified in `docs/superpowers/specs/2026-04-22-chaewon-mode-design.md` — a hidden, site-wide, stan-coded reskin of `echen347.github.io` activated by typing `chaewon` (desktop) or finding 5 hidden hearts (mobile).

**Architecture:** A single CSS file (`chaewon/chaewon.css`) and a single JS module (`chaewon/chaewon.js`) layer onto the existing static HTML. All chrome/behavior is gated by `body.chaewon-mode`; without that class, the site renders identically to today. Persistence via `sessionStorage`. Asset loading via `images/chaewon/manifest.json`. Per-page extension content via JSON sidecars in `content/chaewon/`.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step, matches existing site). `node --test` (built into Node) for lightweight unit tests on pure logic. Python 3 for local preview server (existing).

**Testing approach:** Pure logic (trigger buffer, persistence, manifest parsing) gets unit tests in `tests/chaewon/` runnable via `node --test`. DOM-touching code and CSS are verified via manual checklists in each task. The site has no CI today; tests are run locally before each commit.

**Commit conventions for this repo:** Per `CLAUDE.md`, omit the `Co-Authored-By: Claude ...` trailer from all commit messages. Plan commit examples follow this rule.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `chaewon/chaewon.css` | All Chaewon-mode styles, scoped under `body.chaewon-mode`. Theme, marquees, background, headshot, cards, dynamic-layer effects, sub-egg flourishes, cinematic. |
| `chaewon/chaewon.js` | Single entry-point module. Trigger detection, persistence, asset loading, body-class toggle, mobile heart hunt, dynamic layer, per-page extension injection, cinematic, exit. |
| `chaewon/README.md` | Bookkeeping: how to add assets, where content sidecars live, how to extend with new sub-eggs. |
| `images/chaewon/manifest.json` | Index of bubble photos, GIFs, mascots, stickers. |
| `images/chaewon/bubbles/*.{jpg,png,gif}` | Photo assets (curated by user). |
| `images/chaewon/gifs/*.gif` | Animated assets. |
| `images/chaewon/mascots/*.png` | Cute mascot avatars. |
| `images/chaewon/stickers/*.png` | Heart stickers, decorative bits. |
| `content/chaewon/academic.json` | Course-code → stan-comment mapping. |
| `content/chaewon/photography.json` | Photo-filename → stan-narration mapping. |
| `content/chaewon/writing.json` | Static writing-page intro card content. |
| `tests/chaewon/buffer.test.js` | Unit tests for keyboard buffer trigger detection. |
| `tests/chaewon/persistence.test.js` | Unit tests for sessionStorage / localStorage helpers. |
| `tests/chaewon/manifest.test.js` | Unit tests for manifest parsing. |
| `tests/chaewon/translations.test.js` | Unit tests for hover stan-translation mappings. |

### Modified files

| Path | Changes |
|---|---|
| `index.html` | Add `<link>` and `<script>` tags for Chaewon files; add empty container divs for bubble layer / marquee bars / background / cinematic overlay; modify `Particle.draw` and `Target.draw` in inline script to branch on `body.chaewon-mode`. |
| `academic.html` | Add `<link>`, `<script>`, container divs. |
| `photography.html` | Add `<link>`, `<script>`, container divs. Modify photo metadata renderer to use Chaewon narrations when in mode. |
| `writing.html` | Add `<link>`, `<script>`, container divs. |
| `CLAUDE.md` | Document Chaewon Mode under Architecture section. |
| `.gitignore` | Add `node_modules/` (defensive, in case we add packages later). |

### Files NOT modified

- `style.css`, `latex.vercel.app/style.css` (remote): unchanged.
- `generate_metadata.py`, `photography/`, existing `pdfs/`: unchanged.
- Existing `mot/`, `dhmproposal/`, `host/`, `notes/` redirect shims: unchanged.

---

## Phase 1: Foundation & Activation

Goal: get `body.chaewon-mode` toggling on/off via `chaewon` typed on the desktop. No styles yet; verify the plumbing works.

### Task 1.1: Scaffold `chaewon/` directory and stub files

**Files:**
- Create: `chaewon/chaewon.js`
- Create: `chaewon/chaewon.css`
- Create: `chaewon/README.md`

- [ ] **Step 1: Create `chaewon/chaewon.js` with module skeleton**

```javascript
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
```

- [ ] **Step 2: Create `chaewon/chaewon.css` with stub**

```css
/* chaewon/chaewon.css */
/* All styles below are scoped under body.chaewon-mode so they are inert
   when the mode is off. See docs/superpowers/specs/2026-04-22-chaewon-mode-design.md */

body.chaewon-mode {
  /* Stub — actual styles added in Phase 3 */
}
```

- [ ] **Step 3: Create `chaewon/README.md` with bookkeeping notes**

```markdown
# chaewon/

Chaewon Mode — site-wide stan-coded easter egg.

- **Spec:** `docs/superpowers/specs/2026-04-22-chaewon-mode-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-22-chaewon-mode.md`
- **Activate (desktop):** type `chaewon` anywhere on the site.
- **Activate (mobile):** find 5 hearts hidden across pages and tap them in order.
- **Exit:** click the small `× exit ♡` button (top-right) or type `chaewon` again.

## Adding assets

Drop image/GIF files into `images/chaewon/{bubbles,gifs,mascots,stickers}/` and add an
entry to `images/chaewon/manifest.json`. The asset loader picks them up on next activation.

## Adding stan-comments per course / photo

Edit `content/chaewon/academic.json` (course code → string) or
`content/chaewon/photography.json` (photo filename → string). New entries appear automatically.

## Adding sub-eggs (typed song names)

Edit the `SUB_EGGS` array in `chaewon/chaewon.js` and add a CSS class hook in `chaewon/chaewon.css`.
```

- [ ] **Step 4: Verify files exist**

Run: `ls -la chaewon/`
Expected: `chaewon.css`, `chaewon.js`, `README.md` listed.

- [ ] **Step 5: Commit**

```bash
git add chaewon/
git commit -m "feat(chaewon): scaffold Chaewon Mode module skeleton"
```

### Task 1.2: Wire CSS + JS into `index.html`

**Files:**
- Modify: `index.html` (add `<link>` and `<script>` tags in `<head>`)

- [ ] **Step 1: Inspect current `<head>` of `index.html`**

Run: `grep -n '</head>' index.html`
Note the line number so the new tags go just before it.

- [ ] **Step 2: Add the link + script tags**

Locate the existing LaTeX.css `<link>` line in `index.html`'s `<head>`. After it, insert:

```html
  <link rel="stylesheet" href="/chaewon/chaewon.css">
  <script src="/chaewon/chaewon.js" defer></script>
```

- [ ] **Step 3: Manual verification — site still loads**

Run from repo root: `python3 -m http.server 8000`
Open `http://localhost:8000/` in browser.
Expected: Site loads identically to before. No console errors.

- [ ] **Step 4: Manual verification — module exists**

In browser DevTools console, run: `typeof window.ChaewonMode`
Expected: `"object"`.
Run: `window.ChaewonMode.isActive()`
Expected: `false`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(chaewon): wire stub module into index.html"
```

### Task 1.3: Wire CSS + JS into `academic.html`, `photography.html`, `writing.html`

**Files:**
- Modify: `academic.html`
- Modify: `photography.html`
- Modify: `writing.html`

- [ ] **Step 1: Add tags to `academic.html`**

In `academic.html`'s `<head>`, after the LaTeX.css link:

```html
  <link rel="stylesheet" href="/chaewon/chaewon.css">
  <script src="/chaewon/chaewon.js" defer></script>
```

- [ ] **Step 2: Add tags to `photography.html`**

Same insertion into `photography.html`.

- [ ] **Step 3: Add tags to `writing.html`**

Same insertion into `writing.html`.

- [ ] **Step 4: Manual verification — all 4 pages load with module**

Start `python3 -m http.server 8000` if not running.
For each of `/`, `/academic.html`, `/photography.html`, `/writing.html`:
1. Load the page.
2. Open console.
3. Run `window.ChaewonMode.isActive()` → expect `false`.
4. Confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add academic.html photography.html writing.html
git commit -m "feat(chaewon): wire stub module into all 4 pages"
```

### Task 1.4: Implement keyboard-buffer desktop trigger

**Files:**
- Modify: `chaewon/chaewon.js`
- Create: `tests/chaewon/buffer.test.js`

- [ ] **Step 1: Write the failing test for buffer matching**

Create `tests/chaewon/buffer.test.js`:

```javascript
// tests/chaewon/buffer.test.js
const test = require('node:test');
const assert = require('node:assert');

// Pure-logic helper extracted for testability.
// Mirrors the buffer logic in chaewon.js. We re-implement here to avoid
// the JS module's DOM globals; the impl in chaewon.js MUST match.
function processKey(buffer, key, triggers, maxLen = 16) {
  // Accept only printable single-character keys
  if (typeof key !== 'string' || key.length !== 1) return { buffer, matched: null };
  const normalized = key.toLowerCase();
  if (!/^[a-z0-9]$/.test(normalized)) return { buffer, matched: null };
  const newBuffer = (buffer + normalized).slice(-maxLen);
  // Check longest triggers first to avoid shadowing
  const sorted = [...triggers].sort((a, b) => b.length - a.length);
  for (const t of sorted) {
    if (newBuffer.endsWith(t)) {
      return { buffer: newBuffer, matched: t };
    }
  }
  return { buffer: newBuffer, matched: null };
}

test('buffer accumulates printable lowercase characters', () => {
  let buf = '';
  for (const c of 'abc') buf = processKey(buf, c, ['xyz']).buffer;
  assert.strictEqual(buf, 'abc');
});

test('buffer normalizes uppercase to lowercase', () => {
  const r = processKey('', 'C', ['c']);
  assert.strictEqual(r.matched, 'c');
});

test('buffer ignores non-printable / multi-char keys', () => {
  const r = processKey('abc', 'Shift', ['xyz']);
  assert.strictEqual(r.buffer, 'abc');
  assert.strictEqual(r.matched, null);
});

test('buffer matches "chaewon" trigger', () => {
  let buf = '';
  let matched = null;
  for (const c of 'chaewon') {
    const r = processKey(buf, c, ['chaewon']);
    buf = r.buffer;
    matched = r.matched;
  }
  assert.strictEqual(matched, 'chaewon');
});

test('buffer trims to maxLen', () => {
  let buf = '';
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    buf = processKey(buf, c, [], 16).buffer;
  }
  assert.strictEqual(buf.length, 16);
  assert.strictEqual(buf, 'klmnopqrstuvwxyz');
});

test('buffer matches longest trigger first when overlapping', () => {
  // 'chaewon' ends with 'on'; longest match should win if both registered
  let buf = '';
  let matched = null;
  for (const c of 'chaewon') {
    const r = processKey(buf, c, ['on', 'chaewon']);
    buf = r.buffer;
    matched = r.matched;
  }
  assert.strictEqual(matched, 'chaewon');
});

test('buffer matches sub-egg "fearless" (longer than chaewon)', () => {
  let buf = '';
  let matched = null;
  for (const c of 'fearless') {
    const r = processKey(buf, c, ['chaewon', 'fearless']);
    buf = r.buffer;
    matched = r.matched;
  }
  assert.strictEqual(matched, 'fearless');
});

module.exports = { processKey };
```

- [ ] **Step 2: Run the test, verify it passes**

Run: `node --test tests/chaewon/buffer.test.js`
Expected: All 7 tests pass. (The helper is defined inline so the tests are self-contained; the chaewon.js module mirrors this logic in Step 3.)

- [ ] **Step 3: Add buffer + trigger handling to `chaewon/chaewon.js`**

In the `state` object, add `keyBuffer: ''`. After `state` declaration, add:

```javascript
  const TRIGGERS = ['chaewon']; // sub-eggs added in Phase 5
  const BUFFER_MAX = 16;

  function handleKeydown(e) {
    const key = e.key;
    if (typeof key !== 'string' || key.length !== 1) return;
    const normalized = key.toLowerCase();
    if (!/^[a-z0-9]$/.test(normalized)) return;
    state.keyBuffer = (state.keyBuffer + normalized).slice(-BUFFER_MAX);
    // Check longest triggers first
    const sorted = [...TRIGGERS].sort((a, b) => b.length - a.length);
    for (const t of sorted) {
      if (state.keyBuffer.endsWith(t)) {
        if (t === 'chaewon') {
          if (state.active) deactivate();
          else activate();
        } else {
          handleSubEgg(t); // implemented in Phase 5
        }
        return;
      }
    }
  }

  function handleSubEgg(name) {
    // stub for Phase 5
  }
```

In `init()`, after the sessionStorage check, add:

```javascript
    document.addEventListener('keydown', handleKeydown);
```

- [ ] **Step 4: Manual verification — typing chaewon toggles class**

Reload the page (any of the 4). In console:
1. `document.body.classList.contains('chaewon-mode')` → `false`
2. Click the page (give it focus), type `c-h-a-e-w-o-n` slowly.
3. `document.body.classList.contains('chaewon-mode')` → `true`
4. `window.ChaewonMode.isActive()` → `true`
5. Type `chaewon` again.
6. `window.ChaewonMode.isActive()` → `false`

- [ ] **Step 5: Commit**

```bash
git add chaewon/chaewon.js tests/chaewon/buffer.test.js
git commit -m "feat(chaewon): keyboard-buffer desktop trigger"
```

### Task 1.5: Implement exit button

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add exit button creation to `chaewon.js`**

Add after `handleSubEgg`:

```javascript
  let exitBtn = null;

  function ensureExitButton() {
    if (exitBtn) return;
    exitBtn = document.createElement('button');
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
```

In `activate()`, after the sessionStorage line, add:

```javascript
    ensureExitButton();
```

In `deactivate()`, after the sessionStorage line, add:

```javascript
    removeExitButton();
```

- [ ] **Step 2: Add exit button styles to `chaewon.css`**

Replace the stub `body.chaewon-mode { }` block with:

```css
body.chaewon-mode {
  /* Phase 3 will add the rest */
}

.chaewon-exit {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 9999;
  background: rgba(20, 20, 20, 0.85);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  transition: background 0.2s, transform 0.2s;
}

.chaewon-exit:hover {
  background: rgba(40, 40, 40, 0.95);
  transform: scale(1.05);
}
```

- [ ] **Step 3: Manual verification**

Reload page. Type `chaewon`. Expected: small `× exit ♡` button appears in top-right.
Click it. Expected: button disappears, body class removed.
Type `chaewon` again. Expected: button reappears.
Type `chaewon` again. Expected: button disappears (toggled off via keyboard).

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): exit button with hover state"
```

### Task 1.6: Persistence helpers + tests

**Files:**
- Modify: `chaewon/chaewon.js`
- Create: `tests/chaewon/persistence.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/chaewon/persistence.test.js`:

```javascript
// tests/chaewon/persistence.test.js
const test = require('node:test');
const assert = require('node:assert');

// Mock minimal storage interface
function createMockStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _data: data,
  };
}

// Helpers extracted from chaewon.js for testability. The module's
// implementation MUST match the behavior verified here.
function setActive(storage) { storage.setItem('chaewonMode', '1'); }
function clearActive(storage) { storage.removeItem('chaewonMode'); }
function isStoredActive(storage) { return storage.getItem('chaewonMode') === '1'; }
function markFirstSeen(storage) { storage.setItem('chaewonModeFirstSeen', '1'); }
function hasFirstSeen(storage) { return storage.getItem('chaewonModeFirstSeen') === '1'; }
function setHuntProgress(storage, n) { storage.setItem('chaewonHuntProgress', String(n)); }
function getHuntProgress(storage) {
  const v = storage.getItem('chaewonHuntProgress');
  return v == null ? 0 : Math.max(0, Math.min(5, parseInt(v, 10) || 0));
}

test('setActive stores "1" under chaewonMode', () => {
  const s = createMockStorage();
  setActive(s);
  assert.strictEqual(s.getItem('chaewonMode'), '1');
});

test('clearActive removes the key', () => {
  const s = createMockStorage();
  setActive(s);
  clearActive(s);
  assert.strictEqual(s.getItem('chaewonMode'), null);
});

test('isStoredActive reflects current state', () => {
  const s = createMockStorage();
  assert.strictEqual(isStoredActive(s), false);
  setActive(s);
  assert.strictEqual(isStoredActive(s), true);
});

test('hasFirstSeen defaults to false', () => {
  const s = createMockStorage();
  assert.strictEqual(hasFirstSeen(s), false);
});

test('hasFirstSeen returns true after markFirstSeen', () => {
  const s = createMockStorage();
  markFirstSeen(s);
  assert.strictEqual(hasFirstSeen(s), true);
});

test('hunt progress starts at 0', () => {
  const s = createMockStorage();
  assert.strictEqual(getHuntProgress(s), 0);
});

test('hunt progress can be incremented and read back', () => {
  const s = createMockStorage();
  setHuntProgress(s, 3);
  assert.strictEqual(getHuntProgress(s), 3);
});

test('hunt progress clamps to 0..5', () => {
  const s = createMockStorage();
  setHuntProgress(s, -10);
  assert.strictEqual(getHuntProgress(s), 0);
  setHuntProgress(s, 100);
  assert.strictEqual(getHuntProgress(s), 5);
});

module.exports = {
  setActive, clearActive, isStoredActive,
  markFirstSeen, hasFirstSeen,
  setHuntProgress, getHuntProgress,
};
```

- [ ] **Step 2: Run tests, verify pass**

Run: `node --test tests/chaewon/persistence.test.js`
Expected: 8 tests pass.

- [ ] **Step 3: Add matching helpers to `chaewon/chaewon.js`**

After the `TRIGGERS` constant, add:

```javascript
  // Persistence helpers — mirror tests/chaewon/persistence.test.js
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
```

Replace the existing `sessionStorage` calls in `activate()` and `deactivate()`:

```javascript
  function activate(opts = {}) {
    const { skipCinematic = false } = opts;
    document.body.classList.add('chaewon-mode');
    setStoredActive();
    state.active = true;
    ensureExitButton();
  }

  function deactivate() {
    document.body.classList.remove('chaewon-mode');
    clearStoredActive();
    state.active = false;
    removeExitButton();
  }
```

In `init()`, replace the `sessionStorage.getItem` check:

```javascript
  function init() {
    if (isStoredActive()) {
      activate({ skipCinematic: true });
    }
    document.addEventListener('keydown', handleKeydown);
  }
```

- [ ] **Step 4: Manual verification — sessionStorage round-trip**

Reload page. Type `chaewon`. Expected: mode active.
In console: `sessionStorage.getItem('chaewonMode')` → `"1"`.
Reload page. Expected: mode is still active (button visible, body class present).
Close tab, reopen. Expected: mode is off (sessionStorage cleared).
Navigate from `/` to `/academic.html` while active. Expected: mode persists.

- [ ] **Step 5: Commit**

```bash
git add chaewon/chaewon.js tests/chaewon/persistence.test.js
git commit -m "feat(chaewon): persistence helpers + cross-page session"
```

---

## Phase 2: Asset Pipeline

Goal: a manifest-driven asset loader so adding new photos = "drop file + add JSON line."

### Task 2.1: Create asset folder + initial manifest

**Files:**
- Create: `images/chaewon/manifest.json`
- Create: `images/chaewon/bubbles/.gitkeep`
- Create: `images/chaewon/gifs/.gitkeep`
- Create: `images/chaewon/mascots/.gitkeep`
- Create: `images/chaewon/stickers/.gitkeep`

- [ ] **Step 1: Create directory structure**

Run from repo root:
```bash
mkdir -p images/chaewon/{bubbles,gifs,mascots,stickers}
touch images/chaewon/bubbles/.gitkeep
touch images/chaewon/gifs/.gitkeep
touch images/chaewon/mascots/.gitkeep
touch images/chaewon/stickers/.gitkeep
```

- [ ] **Step 2: Create initial manifest**

Create `images/chaewon/manifest.json`:

```json
{
  "$schema_comment": "categories: bubbles (circular-friendly photos), gifs (animated), mascots (cartoon avatars), stickers (decorative). Add new files to the appropriate folder and append an entry here. The loader picks them up on next activation.",
  "bubbles": [],
  "gifs": [],
  "mascots": [],
  "stickers": []
}
```

- [ ] **Step 3: Verify**

Run: `ls images/chaewon/ && cat images/chaewon/manifest.json`
Expected: 4 subdirectories, manifest.json with empty arrays.

- [ ] **Step 4: Commit**

```bash
git add images/chaewon/
git commit -m "feat(chaewon): asset folder structure + empty manifest"
```

### Task 2.2: Implement manifest loader with cache

**Files:**
- Modify: `chaewon/chaewon.js`
- Create: `tests/chaewon/manifest.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/chaewon/manifest.test.js`:

```javascript
// tests/chaewon/manifest.test.js
const test = require('node:test');
const assert = require('node:assert');

// Pure helpers extracted from chaewon.js
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

function pickRandom(arr, n) {
  // Reservoir-style; for tests just sort by stable hash so output is deterministic per seed
  if (n >= arr.length) return [...arr];
  const copy = [...arr];
  // Fisher-Yates partial shuffle
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

test('parseManifest accepts valid manifest', () => {
  const m = parseManifest({
    bubbles: [{ file: 'bubbles/01.jpg', alt: 'a' }],
    gifs: [{ file: 'gifs/x.gif' }],
    mascots: [],
    stickers: [],
  });
  assert.strictEqual(m.bubbles.length, 1);
  assert.strictEqual(m.bubbles[0].file, 'bubbles/01.jpg');
  assert.strictEqual(m.gifs.length, 1);
});

test('parseManifest skips entries without "file"', () => {
  const m = parseManifest({ bubbles: [{ file: 'ok.jpg' }, { alt: 'no file' }, null] });
  assert.strictEqual(m.bubbles.length, 1);
});

test('parseManifest defaults missing categories to []', () => {
  const m = parseManifest({ bubbles: [{ file: 'a.jpg' }] });
  assert.deepStrictEqual(m.gifs, []);
  assert.deepStrictEqual(m.mascots, []);
});

test('parseManifest accepts JSON string input', () => {
  const m = parseManifest('{"bubbles":[{"file":"a.jpg"}]}');
  assert.strictEqual(m.bubbles.length, 1);
});

test('pickRandom returns full array when n >= length', () => {
  const r = pickRandom([1, 2, 3], 5);
  assert.strictEqual(r.length, 3);
});

test('pickRandom returns n elements when n < length', () => {
  const r = pickRandom([1, 2, 3, 4, 5], 2);
  assert.strictEqual(r.length, 2);
});

module.exports = { parseManifest, pickRandom };
```

- [ ] **Step 2: Run tests, verify pass**

Run: `node --test tests/chaewon/manifest.test.js`
Expected: 6 tests pass.

- [ ] **Step 3: Add loader to `chaewon/chaewon.js`**

Add after persistence helpers, before `handleKeydown`:

```javascript
  // Asset loading — cached for the session
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
```

- [ ] **Step 4: Manual verification**

Reload page. In console:
```js
window.ChaewonMode.loadManifest().then(m => console.log(m));
```
Expected: object with 4 empty arrays. No errors.

- [ ] **Step 5: Commit**

```bash
git add chaewon/chaewon.js tests/chaewon/manifest.test.js
git commit -m "feat(chaewon): manifest loader with graceful fallback"
```

### Task 2.3: Acquire pre-curated GIF assets

**Files:**
- Create: `images/chaewon/gifs/heart-wave.gif`
- Create: `images/chaewon/gifs/side-eye.gif`
- Create: `images/chaewon/gifs/dance.gif`
- Modify: `images/chaewon/manifest.json`

- [ ] **Step 1: Download the 3 user-provided Tenor GIFs**

Run from repo root:

```bash
# heart-wave
curl -L --max-filesize 5000000 -o images/chaewon/gifs/heart-wave.gif \
  "https://media.tenor.com/$(curl -sL 'https://tenor.com/view/chaewon-kim-chaewon-heart-wave-le-sserafim-gif-1186965009290811417' | grep -oE 'media\.tenor\.com/[A-Za-z0-9_-]+/[^"]+\.gif' | head -1 | sed 's|media.tenor.com/||')"
```

NOTE: Tenor's HTML structure changes; if the curl approach fails, manually download each GIF from the page's "Download" button and save to the path. URLs:
- https://tenor.com/view/chaewon-kim-chaewon-heart-wave-le-sserafim-gif-1186965009290811417 → `images/chaewon/gifs/heart-wave.gif`
- https://tenor.com/view/chaewon-le-sserafim-kpop-lesserafim-k-pop-gif-6551985258795658856 → `images/chaewon/gifs/dance.gif`
- https://tenor.com/view/chaewon-side-eye-eyebrow-le-sserafim-freaknot-gif-9060728444830763120 → `images/chaewon/gifs/side-eye.gif`

If the user has not added these manually before reaching this task, **stop and ask** — do not block on auto-scraping Tenor.

- [ ] **Step 2: Verify file sizes are reasonable**

Run: `ls -lh images/chaewon/gifs/`
Expected: 3 .gif files, each < 5 MB.

- [ ] **Step 3: Update manifest**

Edit `images/chaewon/manifest.json`:

```json
{
  "$schema_comment": "categories: bubbles (circular-friendly photos), gifs (animated), mascots (cartoon avatars), stickers (decorative). Add new files to the appropriate folder and append an entry here. The loader picks them up on next activation.",
  "bubbles": [],
  "gifs": [
    { "file": "gifs/heart-wave.gif", "alt": "Chaewon heart wave" },
    { "file": "gifs/side-eye.gif", "alt": "Chaewon side eye" },
    { "file": "gifs/dance.gif", "alt": "Chaewon dance" }
  ],
  "mascots": [],
  "stickers": []
}
```

- [ ] **Step 4: Verify manifest loads with entries**

Reload page. In console:
```js
window.ChaewonMode.loadManifest().then(m => console.log(m.gifs));
```
Expected: array of 3 entries.

- [ ] **Step 5: Commit**

```bash
git add images/chaewon/gifs/ images/chaewon/manifest.json
git commit -m "feat(chaewon): seed GIF assets (heart-wave, side-eye, dance)"
```

---

## Phase 3: Shared Visual Chrome

Goal: activating Chaewon Mode produces a visible reskin on every page.

### Task 3.1: Apply dark theme to body

**Files:**
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add base theme styles**

Append to `chaewon/chaewon.css` (replace the empty `body.chaewon-mode {}` block):

```css
body.chaewon-mode {
  background: #000 !important;
  color: #e8e8e8 !important;
  /* The marquee bars + background text + bubbles will overlay; content gets cards via Task 3.2 */
}

body.chaewon-mode a { color: #ff89b8; }
body.chaewon-mode a:hover { color: #ffb3d1; }
body.chaewon-mode header,
body.chaewon-mode nav,
body.chaewon-mode footer {
  background: transparent !important;
}
body.chaewon-mode hr {
  border-color: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 2: Manual verification**

Reload `/`. Type `chaewon`. Expected: black background, off-white text, pink links. Nav and footer visually transparent.

- [ ] **Step 3: Commit**

```bash
git add chaewon/chaewon.css
git commit -m "feat(chaewon): base dark theme"
```

### Task 3.2: Wrap content blocks as dark cards

**Files:**
- Modify: `chaewon/chaewon.css`
- Modify: `chaewon/chaewon.js`

The site's content blocks are not currently `<article>` or `<section>`-tagged consistently. Approach: at activate-time, JS finds the main content blocks and adds `chaewon-card` class.

- [ ] **Step 1: Add card-finding logic to `chaewon.js`**

Add a new function before `init()`:

```javascript
  // Mark major content blocks as cards. Heuristic: direct children of <main>,
  // plus key article-like containers. Idempotent.
  function applyCardClassMarkers() {
    const candidates = document.querySelectorAll(
      'main > p, main > div, main > section, main > article, main > ul, main > h2, main > h3'
    );
    // Group consecutive sibling content under a synthetic card wrapper.
    // Simpler approach for v1: just tag heading-led blocks directly.
    document.querySelectorAll('main h2, main h3').forEach(h => {
      // Wrap from this heading up to (but not including) the next sibling heading
      let wrapper = document.createElement('div');
      wrapper.className = 'chaewon-card';
      const parent = h.parentNode;
      const startIdx = Array.from(parent.children).indexOf(h);
      // Collect siblings until next h2/h3 of same or higher level
      const collected = [h];
      let next = h.nextElementSibling;
      while (next && !/^H[123]$/.test(next.tagName)) {
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
```

In `activate()`, after `ensureExitButton()`:
```javascript
    applyCardClassMarkers();
```

In `deactivate()`, after `removeExitButton()`:
```javascript
    removeCardClassMarkers();
```

- [ ] **Step 2: Add card styles to `chaewon.css`**

Append:

```css
body.chaewon-mode .chaewon-card {
  background: #0a0a0a;
  border: 1px solid #1c1c1c;
  border-radius: 14px;
  padding: 18px 22px;
  margin: 16px 0;
  font-family: 'Latin Modern Roman', 'Computer Modern', Georgia, serif;
}

body.chaewon-mode .chaewon-card h2,
body.chaewon-mode .chaewon-card h3 {
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 700;
}
```

- [ ] **Step 3: Manual verification**

Reload `/`. Type `chaewon`. Expected: bio, Research, Publications, Contact each appear in their own dark rounded card. Type `chaewon` again. Expected: cards collapse back to the original layout (no visible difference from baseline).

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): wrap content blocks as dark cards on activate"
```

### Task 3.3: 360° marquee — top and bottom horizontal bars

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add marquee phrase constant + builder function to `chaewon.js`**

After the `TRIGGERS` constant:

```javascript
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
```

After `applyCardClassMarkers`, add:

```javascript
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
```

In `activate()`, after `applyCardClassMarkers()`:
```javascript
    ensureMarquees();
```

In `deactivate()`, after `removeCardClassMarkers()`:
```javascript
    removeMarquees();
```

- [ ] **Step 2: Add horizontal marquee CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-marquee {
  position: fixed;
  z-index: 50;
  background: #000;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #fff;
  pointer-events: none;
}

body.chaewon-mode .chaewon-marquee-inner {
  display: inline-block;
  white-space: nowrap;
  padding: 6px 0;
}

body.chaewon-mode .chaewon-marquee-top {
  top: 0; left: 0; right: 0;
  height: 30px;
  border-bottom: 1px solid #1a1a1a;
}
body.chaewon-mode .chaewon-marquee-top .chaewon-marquee-inner {
  animation: chaewon-marquee-x 26s linear infinite;
}

body.chaewon-mode .chaewon-marquee-bottom {
  bottom: 0; left: 0; right: 0;
  height: 30px;
  border-top: 1px solid #1a1a1a;
}
body.chaewon-mode .chaewon-marquee-bottom .chaewon-marquee-inner {
  animation: chaewon-marquee-x-reverse 26s linear infinite;
}

@keyframes chaewon-marquee-x {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes chaewon-marquee-x-reverse {
  from { transform: translateX(-50%); }
  to   { transform: translateX(0); }
}

/* Padding-top / bottom on body so content doesn't sit under the bars */
body.chaewon-mode {
  padding-top: 30px !important;
  padding-bottom: 30px !important;
}
```

- [ ] **Step 3: Manual verification — top + bottom bars**

Reload `/`. Type `chaewon`. Expected: scrolling marquee at top (right→left) and bottom (left→right). Content shifted down 30px.

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): top + bottom marquees"
```

### Task 3.4: 360° marquee — left and right vertical bars

**Files:**
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add vertical marquee CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-marquee-left,
body.chaewon-mode .chaewon-marquee-right {
  top: 30px; bottom: 30px;
  width: 30px;
}

body.chaewon-mode .chaewon-marquee-left {
  left: 0;
  border-right: 1px solid #1a1a1a;
}
body.chaewon-mode .chaewon-marquee-right {
  right: 0;
  border-left: 1px solid #1a1a1a;
}

body.chaewon-mode .chaewon-marquee-left .chaewon-marquee-inner,
body.chaewon-mode .chaewon-marquee-right .chaewon-marquee-inner {
  writing-mode: vertical-rl;
  display: block;
  height: 200%;
  text-orientation: mixed;
}

body.chaewon-mode .chaewon-marquee-left .chaewon-marquee-inner {
  animation: chaewon-marquee-y-reverse 26s linear infinite;
}
body.chaewon-mode .chaewon-marquee-right .chaewon-marquee-inner {
  animation: chaewon-marquee-y 26s linear infinite;
}

@keyframes chaewon-marquee-y {
  from { transform: translateY(0); }
  to   { transform: translateY(-50%); }
}
@keyframes chaewon-marquee-y-reverse {
  from { transform: translateY(-50%); }
  to   { transform: translateY(0); }
}

/* Side padding for vertical bars */
body.chaewon-mode {
  padding-left: 30px !important;
  padding-right: 30px !important;
}
```

- [ ] **Step 2: Manual verification**

Reload `/`. Type `chaewon`. Expected: 4 marquee bars on every viewport edge, scrolling continuously, forming a frame around the page. Content shifted by 30px on all sides.

- [ ] **Step 3: Commit**

```bash
git add chaewon/chaewon.css
git commit -m "feat(chaewon): left + right vertical marquees (full 360 wrap)"
```

### Task 3.5: "I LOVE CHAEWON" flashing background

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add background builder to `chaewon.js`**

After `removeMarquees`:

```javascript
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
        span.textContent = ch === ' ' ? ' ' : ch;
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
```

In `activate()`, after `ensureMarquees()`:
```javascript
    ensureBackground();
```

In `deactivate()`, after `removeMarquees()`:
```javascript
    removeBackground();
```

- [ ] **Step 2: Add background CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-bg {
  position: fixed;
  top: 30px; left: 30px; right: 30px; bottom: 30px;
  z-index: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  opacity: 0.18;
  user-select: none;
  transform: rotate(-10deg) scale(1.4);
  transform-origin: center;
}

body.chaewon-mode .chaewon-bg-row {
  white-space: nowrap;
  font-size: 110px;
  font-weight: 900;
  letter-spacing: 12px;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  line-height: 1.1;
}

body.chaewon-mode .chaewon-bg-row span {
  display: inline-block;
  animation: chaewon-letter-flash 3s linear infinite;
}

@keyframes chaewon-letter-flash {
  0%   { color: #ff0066; }
  20%  { color: #00ffe5; }
  40%  { color: #ffee00; }
  60%  { color: #b300ff; }
  80%  { color: #ff6a00; }
  100% { color: #ff0066; }
}

/* Ensure cards + content sit above the background */
body.chaewon-mode .chaewon-card,
body.chaewon-mode main,
body.chaewon-mode header,
body.chaewon-mode footer {
  position: relative;
  z-index: 5;
}
```

- [ ] **Step 3: Manual verification**

Reload `/`. Type `chaewon`. Expected: large rotated "I LOVE CHAEWON" text fills the background; each letter cycles through colors (chasing rainbow). Faded enough that content is readable.

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): flashing 'I LOVE CHAEWON' background"
```

### Task 3.6: Headshot heart sticker + breathing animation

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add headshot decoration logic**

After `removeBackground`:

```javascript
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
```

In `activate()`, after `ensureBackground()`:
```javascript
    decorateHeadshot();
```

In `deactivate()`, after `removeBackground()`:
```javascript
    undecorateHeadshot();
```

- [ ] **Step 2: Add headshot CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-headshot-wrap {
  position: relative;
  display: inline-block;
}

body.chaewon-mode img.chaewon-headshot {
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
  animation: chaewon-breath 6s ease-in-out infinite;
}

@keyframes chaewon-breath {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.02); }
}

body.chaewon-mode .chaewon-headshot-sticker {
  position: absolute;
  top: 35%;
  right: 12%;
  font-size: 36px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  animation: chaewon-heart-pulse 1.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes chaewon-heart-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}
```

- [ ] **Step 3: Manual verification**

Reload `/`. Type `chaewon`. Expected: headshot is now circular with white border + soft breathing animation; a red heart pulses on the cheek.

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): headshot heart sticker + breathing"
```

### Task 3.7: Smoke-test all 4 pages

**Files:** none (verification only)

- [ ] **Step 1: Visit each page in Chaewon mode**

Run `python3 -m http.server 8000`. For each of `/`, `/academic.html`, `/photography.html`, `/writing.html`:
1. Load the page.
2. Type `chaewon`.
3. Verify: dark background ✓, 4 marquee bars ✓, flashing background ✓, content cards ✓, exit button ✓.
4. Headshot sticker only on `/` (only page with headshot).
5. Click exit button. Verify: site reverts cleanly.
6. Type `chaewon`. Reload page. Verify: mode persists (sessionStorage).

- [ ] **Step 2: Commit a checkpoint marker (no file changes)**

If any issues arose in Step 1, fix them as part of the relevant prior task and re-commit. Otherwise:

```bash
git commit --allow-empty -m "chore(chaewon): Phase 3 chrome verified across all 4 pages"
```

---

## Phase 4: Mobile Trigger (5-Heart Treasure Hunt)

Goal: mobile-friendly activation via a sequential heart hunt.

### Task 4.1: Identify and place 5 heart anchor points

**Files:**
- Modify: `index.html` (anchors 1, 2, 5)
- Modify: `academic.html` (anchor 3)
- Modify: `photography.html` (anchor 4)

- [ ] **Step 1: Add anchor 1 to bio sentence on `index.html`**

In `index.html`, find the bio paragraph (the `<p>` directly after the headshot `<img>`). At the end of the last sentence, insert (before the closing `</p>`):

```html
<span class="chaewon-easter-heart" data-heart-index="1">♡</span>
```

- [ ] **Step 2: Add anchor 2 next to a publication title on `index.html`**

In `index.html`, in the Publications `<ul>`, append to the first `<li>`:

```html
<span class="chaewon-easter-heart" data-heart-index="2">♡</span>
```

- [ ] **Step 3: Add anchor 3 in In-Progress section on `academic.html`**

In `academic.html`, find the "In Progress" `<h3>` heading. Append to the heading text (before `</h3>`):

```html
<span class="chaewon-easter-heart" data-heart-index="3">♡</span>
```

- [ ] **Step 4: Add anchor 4 in `photography.html`**

In `photography.html`, find the page footer (or the gallery's final `<p>`). Append:

```html
<span class="chaewon-easter-heart" data-heart-index="4">♡</span>
```

- [ ] **Step 5: Add anchor 5 in contact section on `index.html`**

In `index.html`, find the Contact `<h2>` heading. Append:

```html
<span class="chaewon-easter-heart" data-heart-index="5">♡</span>
```

- [ ] **Step 6: Add base hidden style for hearts**

Append to `chaewon/chaewon.css` (these styles are NOT scoped to `body.chaewon-mode` — hearts must show even in normal mode):

```css
.chaewon-easter-heart {
  display: none;          /* JS reveals when appropriate */
  cursor: pointer;
  color: #ff66a3;
  font-size: inherit;
  margin-left: 4px;
  transition: transform 0.2s, opacity 0.4s;
  user-select: none;
}
.chaewon-easter-heart.visible {
  display: inline;
  animation: chaewon-heart-fade-in 0.6s ease-out;
}
@keyframes chaewon-heart-fade-in {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}
.chaewon-easter-heart:active { transform: scale(1.4); }
```

- [ ] **Step 7: Manual verification**

Reload all 4 pages. Expected: hearts are NOT visible (CSS hides them by default). View source (DevTools): the 5 spans exist with correct `data-heart-index`.

- [ ] **Step 8: Commit**

```bash
git add index.html academic.html photography.html chaewon/chaewon.css
git commit -m "feat(chaewon): place 5 mobile-trigger heart anchors"
```

### Task 4.2: Implement heart-hunt state machine

**Files:**
- Modify: `chaewon/chaewon.js`

- [ ] **Step 1: Add hunt logic**

After `decorateHeadshot` and `undecorateHeadshot`:

```javascript
  function refreshHeartVisibility() {
    if (state.active) {
      // Hide all hearts when mode is active
      document.querySelectorAll('.chaewon-easter-heart').forEach(h => {
        h.classList.remove('visible');
      });
      return;
    }
    const progress = getHuntProgress();
    const nextIdx = progress + 1;
    document.querySelectorAll('.chaewon-easter-heart').forEach(h => {
      const idx = parseInt(h.dataset.heartIndex, 10);
      if (idx === nextIdx) h.classList.add('visible');
      else h.classList.remove('visible');
    });
  }

  function handleHeartClick(e) {
    const heart = e.target.closest('.chaewon-easter-heart');
    if (!heart) return;
    const idx = parseInt(heart.dataset.heartIndex, 10);
    const expected = getHuntProgress() + 1;
    if (idx !== expected) return; // wrong heart
    setHuntProgress(idx);
    heart.classList.remove('visible');
    if (idx >= 5) {
      // Reset progress for future visits + activate
      setHuntProgress(0);
      activate();
    } else {
      // Reveal the next heart on whichever page it lives
      refreshHeartVisibility();
    }
  }
```

In `init()`, after the existing `addEventListener('keydown', handleKeydown)` line, add:

```javascript
    document.addEventListener('click', handleHeartClick);
    refreshHeartVisibility();
```

In `activate()`, after `decorateHeadshot()`:
```javascript
    refreshHeartVisibility();
```

In `deactivate()`, after `undecorateHeadshot()`:
```javascript
    refreshHeartVisibility();
```

- [ ] **Step 2: Manual verification — desktop simulating mobile**

Open `/` in browser. DevTools → Toggle device toolbar (Cmd+Shift+M) → iPhone preset.
1. Reload. Heart 1 should be visible at the end of bio.
2. Tap it. Heart 1 disappears. Heart 2 appears next to a publication.
3. Tap heart 2. Navigate to `/academic.html`. Heart 3 visible at "In Progress" heading.
4. Tap heart 3. Navigate to `/photography.html`. Heart 4 visible.
5. Tap heart 4. Navigate back to `/`. Heart 5 visible at Contact heading.
6. Tap heart 5. Chaewon mode activates.

If any heart doesn't appear, verify `sessionStorage.getItem('chaewonHuntProgress')` matches expectations.

- [ ] **Step 3: Commit**

```bash
git add chaewon/chaewon.js
git commit -m "feat(chaewon): mobile heart-hunt state machine across pages"
```

---

## Phase 5: Dynamic Layer

Goal: ambient and reactive motion across all pages.

### Task 5.1: Heart cursor trail

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add cursor trail logic**

After `handleHeartClick`:

```javascript
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
```

In `init()`:
```javascript
    document.addEventListener('mousemove', handleMouseMove);
```

(Listener stays attached even when mode is off; the early-return guard handles that.)

- [ ] **Step 2: Add trail CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-trail-heart {
  position: fixed;
  pointer-events: none;
  z-index: 100;
  font-size: 14px;
  color: #ff66a3;
  transform: translate(-50%, -50%);
  animation: chaewon-trail-fade 0.7s ease-out forwards;
}
@keyframes chaewon-trail-fade {
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -180%) scale(0.6); }
}
```

- [ ] **Step 3: Manual verification**

Reload `/`. Activate. Move cursor across the page. Expected: trail of small ♡s following the cursor, fading upward.

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): heart cursor trail"
```

### Task 5.2: Click-anywhere heart burst

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add click burst logic**

After `handleMouseMove`:

```javascript
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
```

In `init()`:
```javascript
    document.addEventListener('click', handleClickBurst);
```

- [ ] **Step 2: Add burst CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-burst-heart {
  position: fixed;
  pointer-events: none;
  z-index: 99;
  font-size: 18px;
  color: #ff3388;
  transform: translate(-50%, -50%);
  animation: chaewon-burst-fly 0.8s ease-out forwards;
}
@keyframes chaewon-burst-fly {
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.6); }
  60%  { opacity: 0.9; }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.2); }
}
```

- [ ] **Step 3: Manual verification**

Activate mode. Click anywhere. Expected: ~7 hearts burst outward and fade.

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): click-anywhere heart burst"
```

### Task 5.3: 3D card tilt on hover

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add tilt logic**

After `handleClickBurst`:

```javascript
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
```

In `activate()`, after `applyCardClassMarkers()`:
```javascript
    attachAllCardTilts();
```

(No detach needed — when cards are removed in `deactivate`, the listeners go with them.)

- [ ] **Step 2: Add transition CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-card {
  transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
  will-change: transform;
}
body.chaewon-mode .chaewon-card:hover {
  box-shadow: 0 12px 32px rgba(255, 100, 140, 0.18);
}
```

- [ ] **Step 3: Manual verification**

Activate mode. Hover over a content card. Expected: card tilts toward cursor in 3D, soft pink glow on shadow. Mouseout: snaps back flat.

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): 3D card tilt on hover"
```

### Task 5.4: Idle attention-grab

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add idle popup logic**

After `attachAllCardTilts`:

```javascript
  // Placeholder lines — see spec §10 for tone framing
  const IDLE_LINES = [
    'WHERE U GOING?? KEEP STANNING ♡',
    'CHAEWON MISSES YOU ♡',
    'STREAM CRAZY!!! ♡',
    'COME BACK!! ♡♡♡',
  ];

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
```

In `init()`:
```javascript
    document.addEventListener('mousemove', handleAnyActivity);
    document.addEventListener('keydown', handleAnyActivity);
    document.addEventListener('scroll', handleAnyActivity);
    document.addEventListener('touchstart', handleAnyActivity);
```

In `activate()`, after `attachAllCardTilts()`:
```javascript
    resetIdleTimer();
```

(The `resetIdleTimer` function reads the `chaewonIdleFired` flag internally, so no extra setup line needed.)

In `deactivate()`, after `undecorateHeadshot()`:
```javascript
    if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
```

- [ ] **Step 2: Add idle popup CSS**

Append:

```css
body.chaewon-mode .chaewon-idle-popup {
  position: fixed;
  bottom: 60px;
  right: 60px;
  z-index: 200;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 16px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 320px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
  animation: chaewon-idle-slide-in 0.4s ease-out;
}
body.chaewon-mode .chaewon-idle-popup img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid white;
}
body.chaewon-mode .chaewon-idle-text {
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
body.chaewon-mode .chaewon-idle-popup.chaewon-idle-leaving {
  animation: chaewon-idle-slide-out 0.5s ease-in forwards;
}
@keyframes chaewon-idle-slide-in {
  from { opacity: 0; transform: translateX(120%); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes chaewon-idle-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(120%); }
}
```

- [ ] **Step 3: Manual verification**

Activate mode. Stop touching the page for 30 seconds. Expected: popup slides in from the right with a Chaewon photo (or none if manifest empty) + a stan line. Auto-dismisses after 4s. Doesn't fire again in this session.

To re-test: in console run `sessionStorage.removeItem('chaewonIdleFired')` then reload.

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): idle attention-grab popup"
```

### Task 5.5: Hover stan-translations on headings

**Files:**
- Modify: `chaewon/chaewon.js`
- Create: `tests/chaewon/translations.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/chaewon/translations.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');

// Mirrors the lookup in chaewon.js
const TRANSLATIONS = {
  'publications': 'WHAT I DO WHEN NOT STANNING CHAEWON ♡',
  'research': 'BETWEEN STREAMING CRAZY ON REPEAT ♡',
  'contact': 'DM ME UR CHAEWON FANCAMS ♡',
  'coursework': 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡',
  'in progress': 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡',
  'mathematics': 'MATH WHILE STREAMING CRAZY ♡',
  'cs/ece': 'CODING WITH CHAEWON ON LOOP ♡',
};

function lookup(text) {
  if (!text) return null;
  const k = text.trim().toLowerCase();
  return TRANSLATIONS[k] || null;
}

test('lookup matches known heading', () => {
  assert.strictEqual(lookup('Publications'), 'WHAT I DO WHEN NOT STANNING CHAEWON ♡');
});

test('lookup is case-insensitive', () => {
  assert.strictEqual(lookup('PUBLICATIONS'), 'WHAT I DO WHEN NOT STANNING CHAEWON ♡');
});

test('lookup ignores leading/trailing whitespace', () => {
  assert.strictEqual(lookup('  Research  '), 'BETWEEN STREAMING CRAZY ON REPEAT ♡');
});

test('lookup returns null for unknown heading', () => {
  assert.strictEqual(lookup('Unknown Section'), null);
});

test('lookup handles "In Progress" multi-word', () => {
  assert.strictEqual(lookup('In Progress'), 'STUDYING WHILE LISTENING TO ANTIFRAGILE ♡');
});

module.exports = { TRANSLATIONS, lookup };
```

- [ ] **Step 2: Run tests, verify pass**

Run: `node --test tests/chaewon/translations.test.js`
Expected: 5 tests pass.

- [ ] **Step 3: Add translations to `chaewon.js`**

After `IDLE_LINES`:

```javascript
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
    document.querySelectorAll('h1, h2, h3').forEach(h => {
      const original = h.textContent;
      const translated = lookupTranslation(original);
      if (!translated) return;
      h.dataset.chaewonOriginal = original;
      h.dataset.chaewonTranslated = translated;
      h.addEventListener('mouseenter', () => { if (state.active) h.textContent = translated; });
      h.addEventListener('mouseleave', () => { if (state.active) h.textContent = original; });
    });
  }
```

In `init()` (NOT activate — wire once on page load, gated by `state.active` inside the listeners):

```javascript
    attachHeadingTranslations();
```

- [ ] **Step 4: Manual verification**

Activate mode on `/`. Hover over "Publications" heading. Expected: text swaps to "WHAT I DO WHEN NOT STANNING CHAEWON ♡". Mouseout: reverts.
Visit `/academic.html`. Hover "In Progress". Expected: swap.
Deactivate mode. Hover headings. Expected: NO swap (gated by `state.active`).

- [ ] **Step 5: Commit**

```bash
git add chaewon/chaewon.js tests/chaewon/translations.test.js
git commit -m "feat(chaewon): hover stan-translations on headings"
```

### Task 5.6: Sub-eggs (typed song names)

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add sub-egg triggers and dispatch**

Modify `TRIGGERS` constant:

```javascript
  const TRIGGERS = ['chaewon', 'crazy', 'fearless', 'antifragile', 'easy', 'perfectnight'];
```

Replace the `handleSubEgg` stub with:

```javascript
  function handleSubEgg(name) {
    if (!state.active) return; // sub-eggs only fire while in Chaewon mode
    const cls = `chaewon-egg-${name}`;
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), 3000);
  }
```

- [ ] **Step 2: Add sub-egg CSS effects**

Append to `chaewon/chaewon.css`:

```css
/* CRAZY: red/black flash sequence */
@keyframes chaewon-egg-crazy-flash {
  0%, 100% { background-color: #000; }
  10%, 30%, 50% { background-color: #ff0033; }
  20%, 40%, 60% { background-color: #000; }
}
body.chaewon-mode.chaewon-egg-crazy {
  animation: chaewon-egg-crazy-flash 1.5s ease-in-out 1;
}

/* FEARLESS: petals fall from top */
body.chaewon-mode.chaewon-egg-fearless::before {
  content: '🌸 🌸 🌸 🌸 🌸 🌸 🌸 🌸 🌸 🌸 🌸 🌸';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  font-size: 32px;
  letter-spacing: 80px;
  white-space: pre;
  animation: chaewon-petal-fall 3s linear forwards;
}
@keyframes chaewon-petal-fall {
  0%   { transform: translateY(-100vh); opacity: 1; }
  100% { transform: translateY(120vh); opacity: 0; }
}

/* ANTIFRAGILE: laser sweep */
body.chaewon-mode.chaewon-egg-antifragile::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  background: repeating-linear-gradient(110deg,
    transparent 0px,
    transparent 80px,
    rgba(255, 0, 153, 0.6) 80px,
    rgba(255, 0, 153, 0.6) 84px);
  animation: chaewon-laser-sweep 1.2s ease-out forwards;
}
@keyframes chaewon-laser-sweep {
  0%   { opacity: 0; transform: translateX(-100%); }
  30%  { opacity: 1; }
  100% { opacity: 0; transform: translateX(100%); }
}

/* EASY: glow on photos */
body.chaewon-mode.chaewon-egg-easy img {
  animation: chaewon-easy-glow 1.5s ease-in-out;
}
@keyframes chaewon-easy-glow {
  0%, 100% { filter: none; }
  50%      { filter: brightness(1.3) drop-shadow(0 0 10px #ffe0a3); }
}

/* PERFECTNIGHT: starfield twinkle */
body.chaewon-mode.chaewon-egg-perfectnight::before {
  content: '✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  color: #fff;
  font-size: 28px;
  letter-spacing: 100px;
  white-space: pre-wrap;
  text-align: center;
  line-height: 60px;
  padding: 50px;
  animation: chaewon-twinkle 2.5s ease-in-out;
}
@keyframes chaewon-twinkle {
  0%, 100% { opacity: 0; }
  20%, 80% { opacity: 1; }
}
```

- [ ] **Step 3: Manual verification**

Activate mode. Type each sub-egg in turn:
- `crazy` → red/black flash
- `fearless` → petals fall
- `antifragile` → diagonal laser stripes sweep
- `easy` → all images glow
- `perfectnight` → stars twinkle briefly

Verify: typing a sub-egg while NOT in Chaewon mode does nothing.
Verify: typing `chaewon` still toggles mode (the longest-match logic in Phase 1 handles this).

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): sub-eggs (crazy, fearless, antifragile, easy, perfectnight)"
```

---

## Phase 6: Homepage-Specific (Bubbles + SMC Reskin)

### Task 6.1: Physics bubble layer scaffolding

**Files:**
- Modify: `index.html`
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add bubble container to `index.html`**

In `index.html`, just inside `<body>`, add:

```html
<div id="chaewon-bubble-layer" aria-hidden="true"></div>
```

(Placement at start of body so it's behind content; CSS will pin it to viewport.)

- [ ] **Step 2: Add bubble layer CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode #chaewon-bubble-layer {
  position: fixed;
  top: 30px; left: 30px; right: 30px; bottom: 30px;
  pointer-events: none;
  z-index: 3;
  overflow: hidden;
}

body.chaewon-mode .chaewon-bubble {
  position: absolute;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  cursor: pointer;
  background-size: cover;
  background-position: center;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  will-change: transform, top, left;
}

body.chaewon-mode .chaewon-bubble:hover {
  transform: scale(1.8);
  z-index: 20;
  box-shadow: 0 10px 28px rgba(255, 100, 140, 0.5);
}
```

- [ ] **Step 3: Add bubble manager skeleton to `chaewon.js`**

After `handleSubEgg`:

```javascript
  // Bubble physics — homepage only
  const BUBBLE_COUNT = 12;
  const BUBBLE_GRAVITY = 0.15;
  const BUBBLE_FRICTION = 0.985;
  const BUBBLE_BOUNCE = 0.65;

  let bubbles = [];
  let bubbleAnimId = null;

  function isHomepage() {
    return /\/(index\.html)?$/.test(window.location.pathname);
  }

  function bubbleLayerEl() {
    return document.getElementById('chaewon-bubble-layer');
  }
```

- [ ] **Step 4: Manual verification**

Reload `/`. Activate. Inspect DOM: `#chaewon-bubble-layer` exists. No bubbles yet (Task 6.2 adds them).

- [ ] **Step 5: Commit**

```bash
git add index.html chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): bubble layer container + manager skeleton"
```

### Task 6.2: Spawn bubbles + physics simulation

**Files:**
- Modify: `chaewon/chaewon.js`

- [ ] **Step 1: Implement spawn + simulate**

Append to the bubble section:

```javascript
  async function spawnBubble() {
    const layer = bubbleLayerEl();
    if (!layer) return null;
    const manifest = await loadManifest();
    const pool = manifest.bubbles.length ? manifest.bubbles : [{ file: null }];
    const photo = pool[Math.floor(Math.random() * pool.length)];
    const radius = 24 + Math.random() * 24; // 24..48
    const el = document.createElement('div');
    el.className = 'chaewon-bubble';
    el.style.width = `${radius * 2}px`;
    el.style.height = `${radius * 2}px`;
    if (photo.file) {
      el.style.backgroundImage = `url('${assetUrl(photo.file)}')`;
    } else {
      // Fallback gradient if no photos available
      el.style.background = `linear-gradient(135deg, hsl(${Math.random()*360}, 70%, 60%), hsl(${Math.random()*360}, 70%, 40%))`;
    }
    layer.appendChild(el);
    const layerRect = layer.getBoundingClientRect();
    const b = {
      el,
      x: Math.random() * (layerRect.width - radius * 2),
      y: -radius * 2,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      r: radius,
      paused: false,
    };
    el.addEventListener('mouseenter', () => { b.paused = true; });
    el.addEventListener('mouseleave', () => { b.paused = false; });
    el.addEventListener('click', e => { e.stopPropagation(); popBubble(b); });
    bubbles.push(b);
    return b;
  }

  function popBubble(b) {
    // Pop animation
    b.el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
    b.el.style.transform = 'scale(0)';
    b.el.style.opacity = '0';
    spawnClickBurst(b.x + b.r, b.y + b.r); // reuse click-burst hearts
    setTimeout(() => {
      b.el.remove();
      bubbles = bubbles.filter(x => x !== b);
      // Respawn replacement after a short delay
      setTimeout(() => { if (state.active) spawnBubble(); }, 800);
    }, 250);
  }

  function stepBubbles() {
    const layer = bubbleLayerEl();
    if (!layer) return;
    const r = layer.getBoundingClientRect();
    const W = r.width, H = r.height;
    for (const b of bubbles) {
      if (b.paused) {
        b.el.style.left = `${b.x}px`;
        b.el.style.top = `${b.y}px`;
        continue;
      }
      b.vy += BUBBLE_GRAVITY;
      b.vx *= BUBBLE_FRICTION;
      b.x += b.vx;
      b.y += b.vy;
      // Walls
      if (b.x < 0)               { b.x = 0;             b.vx = -b.vx * BUBBLE_BOUNCE; }
      if (b.x > W - b.r * 2)     { b.x = W - b.r * 2;   b.vx = -b.vx * BUBBLE_BOUNCE; }
      if (b.y > H - b.r * 2)     { b.y = H - b.r * 2;   b.vy = -b.vy * BUBBLE_BOUNCE; if (Math.abs(b.vy) < 1) b.vy = 0; }
      b.el.style.left = `${b.x}px`;
      b.el.style.top = `${b.y}px`;
    }
    bubbleAnimId = requestAnimationFrame(stepBubbles);
  }

  async function startBubbles() {
    if (!isHomepage()) return;
    bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      await spawnBubble();
    }
    if (!bubbleAnimId) bubbleAnimId = requestAnimationFrame(stepBubbles);
  }

  function stopBubbles() {
    if (bubbleAnimId) { cancelAnimationFrame(bubbleAnimId); bubbleAnimId = null; }
    bubbles.forEach(b => b.el.remove());
    bubbles = [];
  }
```

In `activate()`, after `resetIdleTimer()`:
```javascript
    startBubbles();
```

In `deactivate()`, after the `_idleTimer` cleanup:
```javascript
    stopBubbles();
```

- [ ] **Step 2: Manual verification**

Reload `/`. Activate. Expected: 12 circular bubbles fall from the top, bounce on the bottom, drift slightly. Hover any bubble: pauses + scales 1.8×. Click: pops with heart burst, replacement spawns ~800ms later. If `images/chaewon/manifest.json` has no bubble entries yet, bubbles render as gradient circles (still visible).

- [ ] **Step 3: Verify bubble physics doesn't run on other pages**

Visit `/academic.html` while in mode. Expected: NO bubbles (function early-returns on non-homepage).

- [ ] **Step 4: Commit**

```bash
git add chaewon/chaewon.js
git commit -m "feat(chaewon): physics bubbles with hover-pause and click-pop"
```

### Task 6.3: SMC overlay reskin — Particle.draw

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Locate Particle.draw in `index.html` inline script**

Run: `grep -n 'Particle.prototype.draw\|class Particle' index.html`
Open the file at the matched lines.

- [ ] **Step 2: Add the conditional draw branch**

Find the existing `Particle.draw` method (or `draw` inside `class Particle`). Wrap its body in a mode check:

```javascript
draw(ctx) {
  if (document.body.classList.contains('chaewon-mode')) {
    // Render as ♡
    ctx.font = `${this.radius * 4}px sans-serif`;
    ctx.fillStyle = '#ff66a3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♡', this.x, this.y);
    return;
  }
  // Existing rendering (preserve verbatim)
  // <existing ctx.arc / ctx.fill / etc. lines>
}
```

(Only the `if (document.body.classList.contains(...))` block is added — the existing rendering goes after the `return`.)

- [ ] **Step 3: Manual verification**

Reload `/`. Wait for SMC overlay to show particles (or click "Return to Interactive Mode"). Activate Chaewon mode. Expected: particles render as pink ♡ glyphs instead of circles. Same motion / count.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(chaewon): SMC particles render as hearts in chaewon mode"
```

### Task 6.4: SMC overlay reskin — Target.draw with photo preload

**Files:**
- Modify: `index.html`
- Modify: `chaewon/chaewon.js`

- [ ] **Step 1: Add photo cache to `chaewon.js`**

After `assetUrl`:

```javascript
  // Image preload cache — Target.draw consumes this
  const _imageCache = new Map();
  function preloadImage(url) {
    if (_imageCache.has(url)) return _imageCache.get(url);
    const img = new Image();
    img.src = url;
    _imageCache.set(url, img);
    return img;
  }
  async function preloadBubbles(n) {
    const m = await loadManifest();
    const pool = m.bubbles.slice(0, n);
    return pool.map(p => preloadImage(assetUrl(p.file)));
  }
  window.ChaewonMode.preloadImage = preloadImage;
  window.ChaewonMode.preloadBubbles = preloadBubbles;
```

- [ ] **Step 2: Modify Target constructor + draw in `index.html`**

In the `Target` class definition in `index.html`, add to constructor:

```javascript
constructor(x, y, /* existing args */) {
  // existing assignments
  this.chaewonPhoto = null;
  if (document.body.classList.contains('chaewon-mode')) {
    // Pick a random preloaded image; ChaewonMode.preloadBubbles is called on activate
    const cache = window.ChaewonMode && window.ChaewonMode._imageCache;
    if (cache) {
      const imgs = Array.from(cache.values());
      if (imgs.length) this.chaewonPhoto = imgs[Math.floor(Math.random() * imgs.length)];
    }
  }
}
```

NOTE: If `_imageCache` is not exposed, expose it from `chaewon.js`:

```javascript
  window.ChaewonMode._imageCache = _imageCache;
```

In Target's `draw` method, prepend:

```javascript
draw(ctx) {
  if (document.body.classList.contains('chaewon-mode') && this.chaewonPhoto && this.chaewonPhoto.complete) {
    const size = 40;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.chaewonPhoto, this.x - size / 2, this.y - size / 2, size, size);
    ctx.restore();
    return;
  }
  // Existing rendering
}
```

- [ ] **Step 3: Trigger preload on activation**

In `chaewon.js` `activate()`, after `startBubbles()`:

```javascript
    if (isHomepage()) preloadBubbles(8);
```

- [ ] **Step 4: Manual verification**

Reload `/`. Activate Chaewon mode. Wait for SMC particles + targets. Expected: targets render as small circular Chaewon photos (instead of whatever default). If manifest has no bubbles, targets fall back to existing rendering.

- [ ] **Step 5: Commit**

```bash
git add index.html chaewon/chaewon.js
git commit -m "feat(chaewon): SMC targets render as Chaewon photos"
```

---

## Phase 7: First-Activation Cinematic

### Task 7.1: Cinematic sequence implementation

**Files:**
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Add cinematic logic**

After `stopBubbles`:

```javascript
  function playCinematic() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'chaewon-cinematic-overlay';
      const big = document.createElement('div');
      big.className = 'chaewon-cinematic-big';
      big.textContent = 'I LOVE CHAEWON';
      overlay.appendChild(big);
      document.body.appendChild(overlay);

      // Spawn cinematic burst bubbles (decorative, independent of physics)
      for (let i = 0; i < 20; i++) {
        const burst = document.createElement('div');
        burst.className = 'chaewon-cinematic-bubble';
        const angle = (Math.PI * 2 * i) / 20;
        const dist = 300 + Math.random() * 200;
        burst.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        burst.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
        burst.style.background = `linear-gradient(135deg, hsl(${Math.random()*60+330}, 70%, 60%), hsl(${Math.random()*60+330}, 70%, 40%))`;
        overlay.appendChild(burst);
      }

      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 2500);
    });
  }
```

Modify `activate` to await cinematic when not skipping:

```javascript
  async function activate(opts = {}) {
    const { skipCinematic = false } = opts;
    document.body.classList.add('chaewon-mode');
    setStoredActive();
    state.active = true;
    ensureExitButton();
    applyCardClassMarkers();
    attachAllCardTilts();
    ensureMarquees();
    ensureBackground();
    decorateHeadshot();
    refreshHeartVisibility();
    resetIdleTimer();
    if (isHomepage()) {
      preloadBubbles(8);
      // Start bubbles AFTER cinematic so they don't compete visually
    }
    if (!skipCinematic && !hasFirstSeen()) {
      await playCinematic();
      markFirstSeen();
    }
    if (isHomepage()) startBubbles();
  }
```

- [ ] **Step 2: Add cinematic CSS**

Append to `chaewon/chaewon.css`:

```css
.chaewon-cinematic-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  animation: chaewon-cinematic-fade 2.5s ease-out forwards;
}

@keyframes chaewon-cinematic-fade {
  0%   { opacity: 0; }
  10%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; }
}

.chaewon-cinematic-big {
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-weight: 900;
  font-size: clamp(48px, 14vw, 220px);
  color: #ff0066;
  text-shadow: 0 0 24px rgba(255, 0, 102, 0.6);
  animation: chaewon-cinematic-zoom 2.5s ease-out;
  letter-spacing: -2px;
}

@keyframes chaewon-cinematic-zoom {
  0%   { transform: scale(0.3); opacity: 0; }
  30%  { transform: scale(1); opacity: 1; }
  70%  { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}

.chaewon-cinematic-bubble {
  position: absolute;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid white;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: chaewon-cinematic-burst 2.2s ease-out forwards;
}

@keyframes chaewon-cinematic-burst {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.8); }
}
```

- [ ] **Step 3: Manual verification — first activation**

In console: `localStorage.removeItem('chaewonModeFirstSeen'); sessionStorage.clear();`
Reload `/`. Type `chaewon`. Expected:
- Black overlay snaps in
- "I LOVE CHAEWON" zooms in big in pink
- 20 bubbles burst outward
- Overlay fades out after ~2.5s
- Site is now in Chaewon mode in steady state

- [ ] **Step 4: Manual verification — subsequent activations skip cinematic**

Type `chaewon` to deactivate. Type `chaewon` again. Expected: NO cinematic this time (only on the very first time per browser).
In console: `localStorage.getItem('chaewonModeFirstSeen')` → `"1"`.

- [ ] **Step 5: Commit**

```bash
git add chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): first-activation cinematic sequence"
```

---

## Phase 8: Per-Page Extensions

### Task 8.1: Academic page — course stan-comments

**Files:**
- Create: `content/chaewon/academic.json`
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Create `content/chaewon/academic.json`**

```bash
mkdir -p content/chaewon
```

Create `content/chaewon/academic.json` with placeholder mappings (keys must match course codes as they appear in `academic.html`):

```json
{
  "$tone_note": "Voice: stan voice talking about Chaewon. Each course is the backdrop, not the subject. See spec §10.0.",
  "MATH 4032": "doing complex analysis homework while CRAZY plays in the background ♡",
  "CS 7641": "studying ML so i can analyze chaewon fancams more rigorously ♡",
  "MATH 4225": "topology while listening to ANTIFRAGILE on repeat ♡",
  "CS 4641": "ML class but really just streaming chaewon ♡",
  "MATH 4347": "PDEs are easier with chaewon vocals ♡",
  "ECE 6254": "stat ML between fancam edits ♡",
  "MATH 6122": "abstract algebra >>> normal life only because of chaewon ♡",
  "CS 6601": "AI homework while waiting for new chaewon content ♡"
}
```

NOTE: course codes here are placeholders — Implementation MUST cross-reference with the actual courses in `academic.html` and update keys accordingly. If the implementer doesn't know which courses are present, run: `grep -E '[A-Z]+ [0-9]+' academic.html` and use real codes.

- [ ] **Step 2: Add comment-injection logic to `chaewon.js`**

After `attachHeadingTranslations`:

```javascript
  let _academicCommentsCache = null;
  async function loadAcademicComments() {
    if (_academicCommentsCache) return _academicCommentsCache;
    try {
      const res = await fetch('/content/chaewon/academic.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('academic.json HTTP ' + res.status);
      _academicCommentsCache = await res.json();
    } catch (err) {
      console.warn('[chaewon] academic comments load failed:', err);
      _academicCommentsCache = {};
    }
    return _academicCommentsCache;
  }

  async function injectAcademicComments() {
    if (!/academic\.html/.test(window.location.pathname)) return;
    const comments = await loadAcademicComments();
    document.querySelectorAll('main li').forEach(li => {
      const text = li.textContent;
      for (const [code, comment] of Object.entries(comments)) {
        if (code.startsWith('$')) continue;
        if (text.includes(code) && !li.querySelector('.chaewon-stan-comment')) {
          const span = document.createElement('span');
          span.className = 'chaewon-stan-comment';
          span.textContent = comment;
          li.appendChild(span);
        }
      }
    });
  }

  function removeAcademicComments() {
    document.querySelectorAll('.chaewon-stan-comment').forEach(el => el.remove());
  }
```

In `activate()`, after `startBubbles()` (or wherever activate ends; placement is after bubble start):

```javascript
    injectAcademicComments();
```

In `deactivate()`, after `stopBubbles()`:
```javascript
    removeAcademicComments();
```

- [ ] **Step 3: Add comment styles**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-stan-comment {
  display: block;
  margin-top: 4px;
  padding-left: 12px;
  font-style: italic;
  font-size: 0.9em;
  color: #ff89b8;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}
body.chaewon-mode .chaewon-stan-comment::before {
  content: '— ';
}
```

- [ ] **Step 4: Manual verification**

Visit `/academic.html`. Activate Chaewon mode. Expected: each course in the lists with a matching code in `academic.json` shows a small italic pink comment underneath. Courses without entries: no comment, no error.

- [ ] **Step 5: Commit**

```bash
git add content/chaewon/academic.json chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): per-course stan comments on academic page"
```

### Task 8.2: Photography page — stan narrations

**Files:**
- Create: `content/chaewon/photography.json`
- Modify: `chaewon/chaewon.js`

- [ ] **Step 1: Create `content/chaewon/photography.json`**

```json
{
  "$tone_note": "Voice: stan voice talking about Chaewon. Each photo is incidental; Chaewon is the subject. See spec §10.0.",
  "headshot-cur-cruise.JPG": "this cruise had no chaewon merch in the gift shop. devastating ♡",
  "headshot-old-hudsonyards.jpg": "Chaewon would slay in this lighting ♡♡♡"
}
```

NOTE: Add more entries by inspecting `photography/` and the `photoSources` array in `photography.html`. Implementer should populate keys for all photos to avoid the fallback.

- [ ] **Step 2: Add narration injection logic**

After `removeAcademicComments`:

```javascript
  let _photoNarrationsCache = null;
  async function loadPhotoNarrations() {
    if (_photoNarrationsCache) return _photoNarrationsCache;
    try {
      const res = await fetch('/content/chaewon/photography.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('photography.json HTTP ' + res.status);
      _photoNarrationsCache = await res.json();
    } catch (err) {
      console.warn('[chaewon] photo narrations load failed:', err);
      _photoNarrationsCache = {};
    }
    return _photoNarrationsCache;
  }

  async function injectPhotoNarrations() {
    if (!/photography\.html/.test(window.location.pathname)) return;
    const narrations = await loadPhotoNarrations();
    document.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      const file = src.split('/').pop();
      const narration = narrations[file];
      if (narration) {
        img.title = narration;        // tooltip on hover
        img.dataset.chaewonNarration = narration;
      } else {
        img.title = '♡♡♡';            // fallback per spec §7.3
      }
    });
  }

  function removePhotoNarrations() {
    if (!/photography\.html/.test(window.location.pathname)) return;
    document.querySelectorAll('img[data-chaewon-narration]').forEach(img => {
      img.removeAttribute('title');
      delete img.dataset.chaewonNarration;
    });
  }
```

In `activate()`, after `injectAcademicComments()`:
```javascript
    injectPhotoNarrations();
```

In `deactivate()`, after `removeAcademicComments()`:
```javascript
    removePhotoNarrations();
```

- [ ] **Step 3: Manual verification**

Visit `/photography.html`. Activate. Hover over a photo whose filename is in `photography.json`. Expected: browser tooltip shows the stan narration (`title` attribute). Photos without entries: tooltip is `♡♡♡`.

- [ ] **Step 4: Commit**

```bash
git add content/chaewon/photography.json chaewon/chaewon.js
git commit -m "feat(chaewon): per-photo stan narrations as image tooltips"
```

### Task 8.3: Writing page — intro card

**Files:**
- Create: `content/chaewon/writing.json`
- Modify: `chaewon/chaewon.js`
- Modify: `chaewon/chaewon.css`

- [ ] **Step 1: Create `content/chaewon/writing.json`**

```json
{
  "$tone_note": "Voice: stan voice. Writing is what Ethan does between stanning, not the main event. See spec §10.0.",
  "intro": "READ THIS WHILE STREAMING CRAZY ON REPEAT ♡♡♡ ETHAN WROTE IT BETWEEN FANCAM EDITS ♡"
}
```

- [ ] **Step 2: Add intro card injection**

After `removePhotoNarrations`:

```javascript
  let _writingIntroCache = null;
  async function loadWritingIntro() {
    if (_writingIntroCache) return _writingIntroCache;
    try {
      const res = await fetch('/content/chaewon/writing.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('writing.json HTTP ' + res.status);
      _writingIntroCache = await res.json();
    } catch (err) {
      console.warn('[chaewon] writing intro load failed:', err);
      _writingIntroCache = { intro: '' };
    }
    return _writingIntroCache;
  }

  async function injectWritingIntro() {
    if (!/writing\.html/.test(window.location.pathname)) return;
    if (document.querySelector('.chaewon-writing-intro')) return;
    const data = await loadWritingIntro();
    if (!data.intro) return;
    const div = document.createElement('div');
    div.className = 'chaewon-writing-intro chaewon-card';
    div.innerHTML = `<p>${data.intro}</p>`;
    const main = document.querySelector('main') || document.body;
    main.insertBefore(div, main.firstChild);
  }

  function removeWritingIntro() {
    document.querySelectorAll('.chaewon-writing-intro').forEach(el => el.remove());
  }
```

In `activate()`, after `injectPhotoNarrations()`:
```javascript
    injectWritingIntro();
```

In `deactivate()`, after `removePhotoNarrations()`:
```javascript
    removeWritingIntro();
```

- [ ] **Step 3: Add intro CSS**

Append to `chaewon/chaewon.css`:

```css
body.chaewon-mode .chaewon-writing-intro {
  text-align: center;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #fff;
  background: linear-gradient(135deg, #1a0a14, #0a1a14);
  border-color: #ff66a3;
}
```

- [ ] **Step 4: Manual verification**

Visit `/writing.html`. Activate. Expected: a stan-coded intro card appears above the Substack embed. Deactivate: intro disappears.

- [ ] **Step 5: Commit**

```bash
git add content/chaewon/writing.json chaewon/chaewon.js chaewon/chaewon.css
git commit -m "feat(chaewon): writing-page stan intro card"
```

---

## Phase 9: Polish & Verification

### Task 9.1: Cross-page navigation regression test

**Files:** none (verification only)

- [ ] **Step 1: Full activation tour**

Run `python3 -m http.server 8000`. In a fresh browser (incognito to clear localStorage):
1. Open `/`. Type `chaewon`. Verify cinematic plays + steady state.
2. Click each nav link in turn (Home, Academic, Photography). Verify mode persists, chrome stays consistent, no flicker.
3. Visit `/writing.html` directly (not in nav). Verify intro card appears, mode persists.
4. Click exit button. Verify clean exit.
5. Reload page. Verify mode stays off.

- [ ] **Step 2: Mobile heart hunt — full path**

Open in DevTools mobile emulator (fresh session — clear sessionStorage):
1. Heart 1 visible on `/`. Tap.
2. Heart 2 visible on `/`. Tap.
3. Navigate to `/academic.html`. Heart 3 visible. Tap.
4. Navigate to `/photography.html`. Heart 4 visible. Tap.
5. Navigate to `/`. Heart 5 visible. Tap.
6. Cinematic plays. Mode active.

- [ ] **Step 3: Sub-egg tour**

While in mode, type each: `crazy`, `fearless`, `antifragile`, `easy`, `perfectnight`. Verify each effect plays.

- [ ] **Step 4: Commit checkpoint**

```bash
git commit --allow-empty -m "chore(chaewon): Phase 9 cross-page regression complete"
```

### Task 9.2: Off-mode regression test

**Files:** none

- [ ] **Step 1: Verify zero impact when mode is off**

For each of `/`, `/academic.html`, `/photography.html`, `/writing.html`:
1. Load page (sessionStorage clear, no `chaewon-mode` body class).
2. Visually compare to a screenshot of the page from before this work (use git stash + checkout to compare if needed).
3. Confirm: layout, fonts, colors, spacing all identical to baseline LaTeX.css.
4. Open DevTools console. Confirm: no errors. `window.ChaewonMode.isActive()` → `false`. No Chaewon-related styles applied.

- [ ] **Step 2: Verify SMC overlay regression on `/`**

Reload `/`. Default SMC overlay should appear. Confirm: particles render as circles (not hearts), targets use original rendering. Click to add target works as before.

- [ ] **Step 3: Verify resume shim still works**

Visit `/resume`. Expected: redirect to `/pdfs/Ethan_Chen_Resume.pdf`. (Sanity check that we haven't broken the existing redirect-shim pattern.)

- [ ] **Step 4: Run all unit tests one more time**

Run: `node --test tests/chaewon/`
Expected: all tests pass (buffer, persistence, manifest, translations).

- [ ] **Step 5: Commit checkpoint**

```bash
git commit --allow-empty -m "chore(chaewon): Phase 9 off-mode regression verified"
```

### Task 9.3: Document Chaewon Mode in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Chaewon Mode section to Architecture**

In `CLAUDE.md`, after the existing "Pieces that span multiple files" subsection (under `## Architecture`), add:

```markdown
- **Chaewon Mode** (`chaewon/chaewon.js`, `chaewon/chaewon.css`). A site-wide easter-egg reskin activated by typing `chaewon` (desktop) or finding 5 hidden ♡s (mobile). All four pages load `chaewon.css` + `chaewon.js`; the JS toggles `body.chaewon-mode` and the CSS, scoped under that class, stays inert when the mode is off. Persistence in `sessionStorage` (`chaewonMode`, `chaewonHuntProgress`) and `localStorage` (`chaewonModeFirstSeen`). Assets in `images/chaewon/` (manifest-driven). Per-page content in `content/chaewon/{academic,photography,writing}.json`. Spec: `docs/superpowers/specs/2026-04-22-chaewon-mode-design.md`. Plan: `docs/superpowers/plans/2026-04-22-chaewon-mode.md`. To extend with a new sub-egg, append a song name to the `TRIGGERS` array in `chaewon.js` and add a CSS class hook.
```

- [ ] **Step 2: Add Chaewon Mode to Conventions**

After the existing conventions list, append:

```markdown
- **Adding Chaewon Mode assets**: drop image into `images/chaewon/{bubbles,gifs,mascots,stickers}/`, append entry to `images/chaewon/manifest.json`. Loader picks it up on next activation; no JS changes needed.
- **Adding Chaewon course comments**: append `"COURSE_CODE": "stan comment"` to `content/chaewon/academic.json`. Course codes must match `academic.html` exactly.
- **Adding Chaewon photo narrations**: append `"filename.jpg": "stan narration"` to `content/chaewon/photography.json`. Filenames must match `images/...` exactly (case-sensitive on GitHub Pages).
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(chaewon): document Chaewon Mode in CLAUDE.md"
```

---

## Self-Review Checklist (run before claiming complete)

Run after Phase 9. If any check fails, fix before declaring done.

- [ ] All `node --test tests/chaewon/*.test.js` files pass.
- [ ] Off-mode visual diff: `/`, `/academic.html`, `/photography.html`, `/writing.html` look identical to pre-Chaewon-Mode baseline.
- [ ] On-mode: cinematic plays exactly once per browser; subsequent activations skip it.
- [ ] On-mode: 4 marquee bars on every page; "I LOVE CHAEWON" background flashes; cards present; headshot heart sticker on `/`.
- [ ] On-mode + homepage: physics bubbles fall, hover-pause-expand, click-pop with heart burst.
- [ ] On-mode + homepage: SMC particles render as ♡; SMC targets render as circular Chaewon photos.
- [ ] On-mode: cursor heart trail, click heart bursts, 3D card tilt all work on every page.
- [ ] On-mode: idle popup fires after 30s, only once per session.
- [ ] On-mode: hover stan-translations work on headings.
- [ ] On-mode: typing each sub-egg (`crazy`, `fearless`, `antifragile`, `easy`, `perfectnight`) plays its effect; only fires while in mode.
- [ ] Mobile heart hunt: 5-step path activates mode.
- [ ] Exit button + re-typing `chaewon` both deactivate cleanly.
- [ ] `sessionStorage` persists mode within session; closing tab clears it.
- [ ] `CLAUDE.md` updated with Chaewon Mode architecture and conventions.
- [ ] Every commit message in this plan was created without the `Co-Authored-By: Claude ...` trailer (per repo convention).

---

## Open Questions Carried From Spec (To Address During Implementation)

1. **Mobile heart placement** — Task 4.1's anchors are indicative. Implementer may relocate based on visual testing. Update spec §4.2 if final positions differ materially.
2. **Bubble physics tuning** — `BUBBLE_GRAVITY`, `BUBBLE_FRICTION`, `BUBBLE_BOUNCE` constants in Task 6.2 are first-pass; tune to feel.
3. **Cinematic timing** — 2.5s in Task 7.1; tune if too short / too long.
4. **Idle popup line bank** — 4 placeholder lines in Task 5.4; user may rewrite. Per spec, all examples are placeholders pending user authoring.
5. **3D card tilt mobile behavior** — currently no media-query guard. If tilt feels janky on touch devices, add `@media (hover: hover)` guard around the hover styles in Task 5.3.
6. **Course codes in `academic.json`** — Task 8.1 placeholders may not match `academic.html`. Implementer must cross-reference and update keys.

---

## Execution Choice

After this plan is reviewed, two options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks. Best for a long plan like this where context across tasks would otherwise bloat. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`. Batch with checkpoints.
