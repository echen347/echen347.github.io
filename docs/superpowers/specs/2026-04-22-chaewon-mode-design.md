# Chaewon Mode — Design Spec

**Date**: 2026-04-22
**Project**: echen347.github.io
**Status**: Design (pending implementation plan via `superpowers:writing-plans`)
**Author**: Ethan Chen (with Claude)

## 1. Overview

**Chaewon Mode** is a hidden, site-wide visual + interactive reskin of `echen347.github.io`. Activated via a typed keyword (desktop) or a tap-treasure-hunt (mobile), it transforms every page from the LaTeX.css academic baseline into a Le-Sserafim-stan-coded interface — dark theme, scrolling marquees, "I LOVE CHAEWON" flashing background text, falling/clickable physics-bubble photos, heart sticker on the headshot, and per-page extensions where a "stan voice" narrates Ethan's content.

It is the first of a planned series of easter eggs for the site. The architecture is intentionally extensible — Chaewon Mode is built on patterns (body-class theme toggle, sessionStorage flag, asset-folder loader, page-life-cycle hook) that future eggs can reuse.

The design deliberately captures the **full ambition** in one document. Implementation can be phased; the design should not be.

### 1.1 Why this exists

Personal sites traditionally optimize for one register (professional, academic, casual). Chaewon Mode lets `echen347.github.io` carry a second register without sacrificing the first — recruiters and academic peers see the LaTeX-styled site; insiders who know the trigger see the stan version. Both are sincere.

The bit lands because of **bathos**: serious content (ICLR publications, course lists, EXIF-indexed photography) framed by maximal stan-culture chrome. Both halves remain real — the math doesn't get watered down, the chaos isn't half-committed.

## 2. User Experience Flow

### Desktop visitor, first activation

1. Visitor lands on `index.html`. LaTeX.css normal site.
2. Visitor types `c-h-a-e-w-o-n` anywhere on the page (any input or no input).
3. **First-activation cinematic plays** (~2–3s): screen briefly fades, marquee scrolls in from the edges, bubbles burst out from the center, "I LOVE CHAEWON" flashes giant once, then settles into normal Chaewon Mode steady-state.
4. Site is now fully reskinned. Navigating to Academic / Photography / Writing carries the mode (sessionStorage flag).
5. To exit: type `chaewon` again, OR click the small `× exit ♡` button in the top-right.

### Mobile visitor, first activation

1. Visitor sees normal site. Five hearts hidden at thematic spots; only the first is visible.
2. Tap heart 1 → it disappears; heart 2 fades in elsewhere (e.g. next to a publication title).
3. Repeat through hearts 3, 4, 5.
4. On 5th tap → first-activation cinematic + Chaewon Mode (same as desktop).

### Returning visitor (within session)

- sessionStorage carries `chaewonMode = "1"`. Page loads directly into Chaewon Mode (no cinematic — only first-time-ever in browser).
- Closing the tab clears `sessionStorage`. Reopening = back to LaTeX baseline.

### Returning visitor (later browser session)

- `localStorage.chaewonModeFirstSeen = "1"` persists across sessions, suppressing the cinematic on subsequent first-of-session activations.
- The mode itself does NOT auto-activate; visitor must re-trigger.

## 3. Architecture

Chaewon Mode is implemented as a **layer on top of the existing site**, not a fork of it. The existing HTML and academic content remain authoritative; Chaewon Mode adds CSS that activates only when `body.chaewon-mode` is present, plus a JS module that handles trigger detection, persistence, asset loading, and dynamic behaviors.

### 3.1 New files

```
chaewon/
├── chaewon.css                     # all Chaewon-mode styling, scoped under body.chaewon-mode
├── chaewon.js                      # trigger, persistence, asset loader, dynamic behaviors
└── README.md                       # bookkeeping note for adding assets

images/chaewon/
├── manifest.json                   # listing of all assets with categories
├── bubbles/                        # circular-friendly photos
│   ├── 01.jpg
│   └── ...
├── gifs/                           # animated GIFs
│   ├── heart-wave.gif
│   ├── side-eye.gif
│   └── ...
├── mascots/                        # cute cartoon avatars
│   └── ...
└── stickers/                       # heart stickers, decorative bits
    └── ...

content/chaewon/                    # per-page content sidecars (stan-voice strings)
├── academic.json                   # course → comment mapping
├── photography.json                # photo filename → narration
└── writing.json                    # static intro card content
```

### 3.2 HTML changes (each existing page)

Each of `index.html`, `academic.html`, `photography.html`, `writing.html` gets:

- `<link rel="stylesheet" href="/chaewon/chaewon.css">` (in `<head>`, after the existing LaTeX.css `<link>`)
- `<script src="/chaewon/chaewon.js" defer></script>` (in `<head>` or end of `<body>`)
- A small set of empty `<div>` containers (e.g. `<div id="chaewon-bubble-layer"></div>`, `<div id="chaewon-marquee-top"></div>`, etc.) which `chaewon.js` populates on activation. When inactive these are empty / `display: none` and have no visual effect.

The existing nav, content, and SMC overlay HTML are untouched.

### 3.3 Activation flow

```
chaewon.js entry point (on page load):
  1. Read sessionStorage.chaewonMode
     - if "1" → call activate(skipCinematic=true)
     - else   → install triggers + bail
  2. Install desktop trigger (rolling 7-char keyboard buffer matching "chaewon")
  3. Install mobile trigger (5-heart treasure hunt, only if no pointer-fine media query)
  4. Install exit handlers (the "× exit ♡" button + chaewon-typed-while-active)

activate(skipCinematic):
  1. document.body.classList.add('chaewon-mode')
  2. sessionStorage.chaewonMode = "1"
  3. Load asset manifest, populate bubble/marquee/background layers
  4. Wire up dynamic behaviors (cursor trail, click bursts, hover handlers, idle timer)
  5. If page === index, replace SMC Particle.draw / Target.draw with heart/photo variants
  6. If page has a content sidecar (academic/photography/writing), inject stan-voice strings
  7. If !skipCinematic && !localStorage.chaewonModeFirstSeen → play cinematic
  8. localStorage.chaewonModeFirstSeen = "1"

deactivate():
  1. document.body.classList.remove('chaewon-mode')
  2. sessionStorage.removeItem('chaewonMode')
  3. Remove dynamic behavior listeners (cleanup)
  4. Restore SMC default rendering
```

### 3.4 CSS strategy

All Chaewon-mode styles are nested under `body.chaewon-mode { ... }`. When the class is absent, the site renders identically to today. This means:

- No flicker on regular page load.
- No risk of Chaewon styles accidentally affecting the academic site.
- The "exit" really restores the original look without page reload.

## 4. Trigger & Lifecycle

### 4.1 Desktop trigger

Rolling lowercase buffer of recent `keydown` events, length = `max(all trigger strings)`. Currently the longest trigger is `perfectnight` (12 chars), so buffer length = 16 (a small safety margin). On any keydown:

```
buffer = (buffer + key).toLowerCase().slice(-16)
for trigger in TRIGGERS:
    if buffer.endsWith(trigger):
        handle(trigger)   // 'chaewon' → toggle mode; sub-eggs → §6.7
        break
```

`TRIGGERS` is a constant array including `'chaewon'` plus all sub-egg song names (§6.7). The order of checking ensures a longer trigger that ends with a shorter one wouldn't be falsely shadowed.

Notes:
- Listener attached to `document` (works regardless of focus, including in input fields — typing chaewon in the search bar of a future feature still triggers).
- Special keys (Shift, Arrow, etc.) are ignored — only printable characters extend the buffer.
- The same buffer drives both the chaewon trigger and all sub-eggs (§6.7); no separate listeners.

### 4.2 Mobile trigger

5 heart placements at thematic spots (final exact spots TBD during implementation; suggested anchors below):

| # | Spot |
|---|------|
| 1 | End of bio sentence on `index.html` (looks like punctuation) |
| 2 | Next to a publication title in the Publications list |
| 3 | Inside the Coursework In-Progress section on `academic.html` |
| 4 | In the photography page's "Last updated" footer |
| 5 | In the contact section of `index.html` |

Hearts are tiny `<span class="chaewon-easter-heart">♡</span>`. Heart 1 is visible by default; hearts 2–5 are `display: none` until the previous one is clicked, then animate in with a fade. Click on the 5th triggers `activate()`.

The heart-hunt state (which hearts have been clicked) persists in `sessionStorage.chaewonHuntProgress = N` so the visitor can navigate between pages without losing progress.

### 4.3 Persistence

| Storage | Key | Purpose |
|---|---|---|
| `sessionStorage` | `chaewonMode` | "1" while mode is active. Cleared on tab close. |
| `sessionStorage` | `chaewonHuntProgress` | Integer 0–5 tracking mobile treasure-hunt state. |
| `localStorage` | `chaewonModeFirstSeen` | "1" if cinematic has played at least once in this browser. Persists forever. |

### 4.4 Exit

Two paths, both call `deactivate()`:

1. **Exit button** — `<button class="chaewon-exit">× exit ♡</button>` in top-right of the viewport, only rendered when `body.chaewon-mode` is present. Subtle (semi-transparent, small), placed near the existing SMC re-open arrow.
2. **Typed `chaewon` again** — same buffer mechanism, toggles off if currently on.

Pressing `Esc` is reserved (would conflict with the SMC overlay's existing behavior); not used here.

## 5. Shared Visual Chrome (every page)

### 5.1 Theme

- `background: #000` on `body`.
- Default text color `#e8e8e8`.
- Existing content blocks wrapped in dark cards: `background: #0a0a0a`, `border: 1px solid #1c1c1c`, `border-radius: 14px`.
- Inside cards, content keeps the LaTeX.css serif typography (`font-family: 'Latin Modern Roman', Georgia, serif;`) so the substance reads scholarly.

### 5.2 360° wrapping marquee

Four edge-bars: top, right, bottom, left. Each scrolls a continuous string in its appropriate direction:

- Top: scrolls right-to-left
- Bottom: scrolls left-to-right
- Left: scrolls bottom-to-top (vertical text via `writing-mode: vertical-rl`)
- Right: scrolls top-to-bottom

The four bars share a content rotation. **Placeholder set** — all phrases stan Chaewon, none stan Ethan (see §10.0):
```
♡♡♡ STAN CHAEWON ♡♡♡ STREAM CRAZY ♡♡♡ KIM CHAEWON IS PEAK PERFORMANCE ♡♡♡ LE SSERAFIM FOREVER ♡♡♡ CHAEWON WORLD DOMINATION ♡♡♡
```
(Final phrase rotation: see §10.)

Bars are `position: fixed`, `z-index: 50` (below the exit button, above content). Width/height ~28px each. Hearts colored `#e63946`, body text white.

### 5.3 "I LOVE CHAEWON" flashing background

Massive text positioned `absolute` behind all content (`z-index: 0`, below cards). Implemented as a single `<div>` containing the phrase wrapped letter-by-letter in `<span>`s. Each `<span>` has its own `animation-delay` cycling through a color palette:

```
@keyframes letterFlash {
  0%   { color: #ff0066; }
  20%  { color: #00ffe5; }
  40%  { color: #ffee00; }
  60%  { color: #b300ff; }
  80%  { color: #ff6a00; }
  100% { color: #ff0066; }
}
```

Animation duration ~3s per letter, with delays staggered by ~0.15s per letter to create a chasing-rainbow effect. Text size ~120px on desktop, scaled by viewport on mobile. Opacity ~0.25 so it doesn't blow out the foreground.

### 5.4 Headshot heart sticker

The headshot `<img>` on `index.html` (currently `headshot-cur-cruise.JPG`) gets a sibling `<img>` overlay positioned absolutely at the cheek coordinates. Sticker is `images/chaewon/stickers/cheek-heart.png` (or rendered as a styled `❤` glyph). Pulses gently (`@keyframes heartPulse` — slight scale).

The headshot itself gets a slow breathing animation (scale 1.0 ↔ 1.02, 6s ease-in-out infinite).

### 5.5 Content cards

Existing content sections (bio, Research, Publications, Contact, etc.) get wrapped or styled into the dark-card aesthetic. Card hover: subtle 3D tilt (`transform: perspective(800px) rotateX(...) rotateY(...)`) tracking the cursor's position relative to the card center. Implementation: a small JS handler on `mousemove` over each card.

## 6. Dynamic Layer (motion + interaction)

### 6.1 Heart cursor trail

`mousemove` listener on `document`. Every N pixels of movement, spawn a small `♡` element at the cursor's position with a 600ms fade + slight upward drift, then remove. Throttled to ~50ms to avoid spam. Mobile: skipped (no cursor).

### 6.2 Click-anywhere heart burst

`click` listener on `document`. Each click spawns 5–8 small ♡ elements that radiate outward from the click point with random angles, then fade over 800ms. Distinct from bubble pops (which spawn larger bursts).

### 6.3 3D card tilt on hover

See §5.5. Listener on each `.chaewon-card` element; on `mousemove` compute cursor offset from card center, apply `transform: perspective(800px) rotateX(...) rotateY(...)` proportional to offset (max ~8°). Reset on `mouseleave`.

### 6.4 Idle attention-grab

Idle timer: 30 seconds with no mousemove, keypress, or scroll. On idle:
1. Pick a random photo from `manifest.json`'s `bubbles` category.
2. Slide a circular thumbnail in from a random screen edge.
3. Display alongside a randomly-picked stan-coded line from a small bank (e.g. `"WHERE U GOING?? KEEP STANNING ♡"`, `"CHAEWON MISSES YOU ♡"`).
4. Stays for ~4 seconds, then slides out.
5. Fires at most once per session (set `sessionStorage.chaewonIdleFired = "1"` after firing).

### 6.5 Headshot breathing + heart pulse

See §5.4. Pure CSS keyframes, no JS.

### 6.6 Hover stan-translations on headings

Each `<h1>`, `<h2>`, `<h3>` on the page (within Chaewon Mode) is wired via JS to swap text on hover. **Placeholder mappings** — they reframe Ethan's sections under the lens of stanning Chaewon (see §10.0):

```
"Publications" ↔ "WHAT I DO WHEN NOT STANNING CHAEWON ♡"
"Research"     ↔ "BETWEEN STREAMING CRAZY ON REPEAT ♡"
"Contact"      ↔ "DM ME UR CHAEWON FANCAMS ♡"
"Coursework"   ↔ "STUDYING WHILE LISTENING TO ANTIFRAGILE ♡"
```

Mapping lives in `chaewon.js` as a constant. On `mouseenter`, swap text + add a class for slight color animation. On `mouseleave`, restore original. Original text is preserved in a `data-original` attribute set on first wire-up.

### 6.7 Sub-eggs (typed song names)

Same keyboard buffer as the chaewon trigger; matched against additional song names with their own visual flourishes:

| Trigger | Effect (~3s) |
|---|---|
| `crazy` | Brief screen flash sequence in red/black (matching the song's MV palette) |
| `fearless` | Petals/flowers fall from top of viewport, then fade |
| `antifragile` | Brief diagonal laser-line sweeps across screen |
| `easy` | Quick glow/sparkle effect across all photos |
| `perfectnight` | Brief starfield twinkle behind everything |

Each is a one-shot CSS animation triggered by adding/removing a class on `<body>`. No persistent state; can be re-triggered freely.

## 7. Page-Specific Behaviors

### 7.1 Index (`index.html`)

In addition to all shared chrome:

#### 7.1.1 Physics bubbles

Bubble photos as **physics objects**. Each bubble is an `<img>` (circular-cropped via CSS `border-radius: 50%`) with associated state `{ x, y, vx, vy, radius, photoSrc }`. A `requestAnimationFrame` loop integrates simple Verlet/Euler dynamics:

- **Gravity**: `vy += 0.15` per frame
- **Walls**: bounce off viewport edges with damping (`vx *= -0.85` etc.)
- **Floor**: bubbles settle at the bottom with friction
- **Top respawn**: bubbles that pop respawn from the top after a delay
- Optional: pairwise collision (gentle elastic) — start without, add only if it looks empty

**Hover**: sets `paused = true` on that bubble, scales it 1.8×, brings to top z-index. Mouseout resumes.

**Click**: triggers pop animation:
1. Bubble scales down to 0 over 200ms
2. ~12 small ♡s burst outward from the bubble's center, fade over 600ms
3. Bubble removed from physics set
4. After 1500ms, a new bubble respawns at the top with a different photo

Bubble count: ~15 at any time. Photo selection: random sample from `manifest.json#bubbles`.

#### 7.1.2 SMC overlay reskin

The existing SMC overlay (`Particle` and `Target` classes in `index.html`'s inline script) gets a conditional render path:

```js
Particle.prototype.draw = function(ctx) {
  if (document.body.classList.contains('chaewon-mode')) {
    // Render this particle as a small ♡ glyph
    ctx.font = `${this.radius * 4}px sans-serif`;
    ctx.fillStyle = '#ff66a3';
    ctx.fillText('♡', this.x - this.radius * 2, this.y + this.radius * 2);
  } else {
    // existing ctx.arc rendering, untouched
  }
};

Target.prototype.draw = function(ctx) {
  if (document.body.classList.contains('chaewon-mode')) {
    // Draw a small Chaewon photo at this.x, this.y
    // Photo is preloaded; pick from manifest.json#bubbles
    ctx.drawImage(this.chaewonPhoto, this.x - 20, this.y - 20, 40, 40);
  } else {
    // existing rendering
  }
};
```

**The math (Langevin drift, weight kernel, MCMC, resampling) is untouched.** Only `draw()` branches. This is the lowest-cost intervention with the highest visual payoff.

Target photo assignment: each `Target` instance gets a `chaewonPhoto` reference assigned at **target-creation time** (Target constructor, when in Chaewon mode), not at mode-activation. This handles the SMC overlay's existing "click to add a new target" feature cleanly — newly added targets get their photo on creation. On mode deactivation, the photo references are cleared (helps GC).

Photos are preloaded into an `Image` cache when Chaewon Mode activates, so `ctx.drawImage` calls don't trigger network fetches mid-render.

### 7.2 Academic (`academic.html`)

Each course in the existing course lists (In-Progress, Mathematics, CS/ECE) gets a small italic stan-comment underneath, populated from `content/chaewon/academic.json`. **Placeholder examples** — comments treat each course as the backdrop for stanning Chaewon, not as a thing to praise Ethan for taking (see §10.0):

```json
{
  "MATH 4032": "doing complex analysis homework while CRAZY plays in the background ♡",
  "CS 7641": "studying ML so i can analyze chaewon fancams more rigorously ♡",
  ...
}
```

The mapping key is the course code. JS reads each course's existing `<li>`, finds a matching key, appends a `<span class="chaewon-stan-comment">` with the comment. Courses without a comment get nothing (no fallback text).

Comments are added only when `body.chaewon-mode` is present. Authoring is incremental — ship with maybe 8–10 comments on the most important courses, add more later.

### 7.3 Photography (`photography.html`)

The masonry gallery's current hover/click behavior shows EXIF metadata. In Chaewon Mode, the metadata is replaced (or augmented) by stan-narration from `content/chaewon/photography.json`. **Placeholder examples** — narrations are about Chaewon (or about how the photo connects to her), not about Ethan looking good in them (see §10.0):

```json
{
  "headshot-cur-cruise.JPG": "this cruise had no chaewon merch in the gift shop. devastating ♡",
  "venice-canal.jpg": "Chaewon would love it here ♡ wish she was in this photo",
  ...
}
```

Mapping key = photo filename. JS replaces the existing tooltip/caption renderer when in Chaewon mode. Photos without a stan-caption fall back to "♡♡♡" (no original EXIF, to commit to the bit).

This integrates with the existing `photoSources` JS array in `photography.html` — adding a `chaewonNarration` field to each entry might be cleanest. Implementation will determine.

### 7.4 Writing (`writing.html`)

Currently very sparse (just a Substack embed). Chaewon Mode adds a stan-coded intro card above the embed. **Placeholder** — the framing is "this is what Ethan writes between stanning sessions," not "praise Ethan for writing" (see §10.0):

```
<div class="chaewon-stan-intro">
  <p>READ THIS WHILE STREAMING CRAZY ON REPEAT ♡♡♡ ETHAN WROTE IT BETWEEN FANCAM EDITS ♡</p>
</div>
```

Content lives in `content/chaewon/writing.json`. No per-item content needed.

## 8. Asset Pipeline

### 8.1 Folder structure

```
images/chaewon/
├── manifest.json
├── bubbles/        # square/circular-friendly Chaewon photos
├── gifs/           # animated GIFs (heart wave, side-eye, etc.)
├── mascots/        # cute cartoon avatars
└── stickers/       # heart stickers, decorative bits
```

### 8.2 manifest.json schema

```json
{
  "bubbles": [
    { "file": "bubbles/01.jpg", "alt": "chaewon photoshoot" },
    { "file": "bubbles/02.jpg", "alt": "chaewon backstage" }
  ],
  "gifs": [
    { "file": "gifs/heart-wave.gif", "alt": "chaewon heart wave" }
  ],
  "mascots": [...],
  "stickers": [...]
}
```

### 8.3 Loader

`chaewon.js` fetches `manifest.json` on activation, picks N random bubbles for the bubble layer, picks K random photos for SMC targets, picks one for the idle attention-grab.

### 8.4 Pre-curated assets to acquire

Saved here as bookkeeping; implementation will download and add to `manifest.json`:

- https://tenor.com/view/chaewon-kim-chaewon-heart-wave-le-sserafim-gif-1186965009290811417 (heart wave GIF)
- https://tenor.com/view/chaewon-le-sserafim-kpop-lesserafim-k-pop-gif-6551985258795658856
- https://tenor.com/view/chaewon-side-eye-eyebrow-le-sserafim-freaknot-gif-9060728444830763120 (side-eye GIF)

User will continue adding URLs/files. Implementation plan should account for "drop more files later" workflow.

### 8.5 Manifest regeneration

A small script (similar to existing `generate_metadata.py` for photography) can regenerate `manifest.json` by scanning the folder. Optional polish — initial implementation can hand-maintain the manifest since asset count is small.

## 9. First-Activation Cinematic

Plays once per browser, gated by `localStorage.chaewonModeFirstSeen`. ~2.5s total.

**Sequence**:

1. **0.0s** — `body.chaewon-mode` is added but all dynamic elements are initially hidden via a `body.chaewon-cinematic` class.
2. **0.0–0.3s** — Screen fades to black via a full-viewport overlay div.
3. **0.3–0.8s** — The 4 marquee bars slide in from their respective edges (top from top, etc.).
4. **0.8–1.5s** — A burst of ~20 bubbles fly out from the center of the viewport in random directions. **Cinematic burst is purely decorative** — these bubbles fly across the screen and fade out, independent of the homepage physics simulation. (On the homepage, the steady-state physics bubbles begin populating after the cinematic ends. On other pages, the burst still plays as a one-time visual flourish even though no ongoing bubble layer exists.)
5. **1.5–2.0s** — "I LOVE CHAEWON" flashes giant once at full opacity, then fades back to its steady-state low opacity.
6. **2.0–2.5s** — `body.chaewon-cinematic` is removed; all dynamic behaviors take over their normal steady state.

Implementation: a sequence of `setTimeout`s + CSS class toggles. Cinematic is interruptible (user clicking exit during cinematic still works).

If `localStorage.chaewonModeFirstSeen === "1"`, skip steps 1–5, just apply Chaewon Mode in steady state.

## 10. Content Authoring (Out of Initial Build Scope)

### 10.0 Tone framing — read this before writing any string

**The bit is "Ethan secretly stans Chaewon." It is NOT "a stan voice praises Ethan."**

The first is funny because it reframes Ethan's serious academic life as a side hustle to his real passion (stanning). It celebrates Chaewon. The second is Ethan praising himself in a funny voice, which reads as self-aggrandizing and weird.

Voice rule: **the stan voice celebrates Chaewon and frames Ethan's content as something he does between/while stanning.** Examples of the right register:

- ✅ "doing complex analysis problems while listening to CRAZY on repeat ♡" (Ethan's life, but Chaewon is the main subject)
- ✅ "Chaewon would love it here ♡" (about Chaewon, photo is incidental)
- ❌ "ETHAN ATE WITH THIS PAPER ♡" (praises Ethan — out)
- ❌ "this lighting is GIVING, ETHAN looking like a main character" (praises Ethan — out)

All example strings throughout this spec are **placeholder** and should be rewritten by Ethan in his own voice. The examples in this section are illustrative-only.

### 10.1 Content inventory

The following content is needed for the system to be visually populated, but each is a separate authoring workstream and **does not block the initial implementation**:

| Content | Where | Initial volume | Long-tail |
|---|---|---|---|
| Bubble photos | `images/chaewon/bubbles/` | ~10 | grow over time |
| GIFs | `images/chaewon/gifs/` | ~3–5 | grow |
| Mascot/sticker assets | `images/chaewon/mascots/`, `stickers/` | ~2 | grow |
| Marquee phrase rotation | `chaewon.js` (constant) | ~6 phrases | extendable |
| Idle-popup hype lines | `chaewon.js` (constant) | ~5 lines | extendable |
| Hover stan-translations (headings) | `chaewon.js` (constant) | ~6 mappings | extendable |
| Course stan-comments | `content/chaewon/academic.json` | ~8–10 | extendable |
| Photo stan-narrations | `content/chaewon/photography.json` | ~10 | extendable |
| Writing intro card | `content/chaewon/writing.json` | 1 | static |

The system must gracefully degrade when content is missing — empty bubble layer if no photos, no comments next to courses without a sidecar entry, etc.

## 11. Out-of-Scope for v1

- Audio (no music snippets, no sound effects). Risk of bad UX with audio defaults.
- A full per-page hover-translation system on body text (only headings get the swap; full-text rewrites are too much).
- Server-side anything (this site is static; no backend dependencies are added).
- Animated mascots that walk around the page (cute, but adds complexity beyond the core dynamic layer).
- Konami/sub-eggs beyond the 5 listed (extensible later).

## 12. Open Questions

These are noted explicitly so the implementation plan and review can flag them:

1. **Mobile heart placement** — exact DOM coordinates for the 5 hearts need final selection during implementation. The thematic anchors in §4.2 are indicative.
2. **Bubble physics tuning** — gravity coefficient, wall damping, collision-on-or-off — needs visual tuning, expect ~30 minutes of iteration after initial implementation.
3. **First-activation cinematic timing** — 2.5s total may be too long or too short; tune to feel during build.
4. **Idle popup line bank** — initial wording can be drafted by Claude with user review; set to ~5 lines for launch.
5. **3D card tilt mobile behavior** — disabled on touch devices by default (no hover); confirm during implementation.
6. **Asset hosting** — all GIFs/photos are committed to the GitHub Pages repo. If file size becomes a concern, consider a separate host. Initial assumption: stay in-repo.

## 13. Success Criteria

The feature ships when:

1. Typing `chaewon` on desktop activates Chaewon Mode on every page; refreshing or navigating between pages preserves the mode within the session.
2. The 5-heart mobile treasure hunt activates the mode equivalently on touch devices.
3. The exit button + re-typing `chaewon` both deactivate cleanly.
4. All 4 pages render correctly in both modes; switching between modes does not require a page reload and does not visually flicker.
5. The first-activation cinematic plays exactly once per browser.
6. Physics bubbles fall, hover-pause-expand, and click-pop on the homepage.
7. SMC overlay renders as hearts swarming Chaewon photos when in Chaewon mode.
8. Per-page extensions (academic comments, photography narrations, writing intro) display when their content sidecars have entries.
9. All 7 dynamic enhancements (cursor trail, click bursts, card tilt, idle, breathing, hover translations, sub-eggs) function on every page where applicable.
10. With Chaewon Mode off, the site is byte-for-byte indistinguishable in user experience from today.

## 14. Next Step

After user review of this spec, invoke `superpowers:writing-plans` to produce a phased, checkpointed implementation plan. The plan should sequence: (a) shared infrastructure first (trigger, persistence, theme toggle, asset loader), (b) shared visual chrome (theme, marquee, background, headshot), (c) homepage-specific (bubbles, SMC reskin), (d) dynamic layer (cursor, click bursts, etc.), (e) per-page extensions, (f) first-activation cinematic, (g) content-authoring stubs.
