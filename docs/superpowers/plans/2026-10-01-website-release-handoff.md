# Website release fixes and Chaewon integration: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the reviewed concert defects, integrate it without losing the current fluid and image work, and return a tested local preview to Ethan. Do not stage, commit, or push.

**Architecture:** Keep one shared fluid renderer and let the homepage controller own its lifetime. Port the concert's additive lighting and sampling APIs into the current renderer; mount cards as a separate controller that consumes that instance. Keep the existing paper pages and passive content-page backgrounds.

**Tech Stack:** Static HTML, vanilla JavaScript, WebGL2, CSS, LaTeX.css, Node's test runner, Python unittest, and existing browser fixtures. No framework migration or new package manager.

**Spec:** Read the concert [preview README](../../../.claude/worktrees/chaewon-concert-preview/chaewon/previews/concert/README.md), the worktree's `chaewon/design/` decisions, and the retained requirements in this plan. The main checkout's older [visual directions](../../../chaewon/design/directions.md) are historical proposals, not the current implementation specification.

Prepared on 2026-10-01 after a pre-push review. Ethan asked for local instructions so Claude Code can implement the next steps. This document changes no runtime behavior.

**Latest instruction, 02:44 HKT:** The production entrance should return to a Reset-only footer. Remove the preview invitation, including "Preview: type chaewon to start the concert." Preserve the hidden typed trigger. The preview's footer is review scaffolding, not the production UI. Ethan requested continued local instructions for Claude Code, not runtime changes or a push from this review.

## Global Constraints

- No staging, commits, pushes, deployments, or PRs without separate approval. The plan skill's default commit steps do not apply.
- Preserve unrelated edits and untracked experiments. Do not run broad staging, reset, checkout, clean, or worktree-removal operations.
- Preserve current biography, research wording, photographs, gallery order, image-delivery changes, and paper typography.
- The concert is desktop-only, determined by `(pointer: coarse)`. Do not substitute a width breakpoint or a hover query. A narrow desktop window with a mouse remains eligible.
- No automatic audio, new camera orbit, HUD, Pause control, or visible stirring directions. Entrance controls retain Reset.
- Production footer: Reset only, with concert both inactive and active. Do not ship the preview invitation, visible cue/status text, or separate Leave the concert button. Keep the existing navigation and Scene/Paper switch; they are not part of this footer restriction. Content pages still have no Reset control.
- Use `apply_patch` for edits. Run `/Users/ethan/Documents/College/Research/spr26/prose_lint.py` on changed prose files and fix its findings. Markdown underscores and the OpenReview length cap are exempt.
- Read the repository instructions, but verify their architectural descriptions against source. `CLAUDE.md` still describes an older SMC entrance.

## Review Focus

- Resize during entry, song change, or exit must preserve the intended lighting target and complete its callback once (Task 1).
- Forward, flipped, returning, paused, and reduced-motion cards must remain reachable after width or height changes (Task 2).
- Re-entry, Scene/Paper changes, browser restoration, and graphics failure must not duplicate controllers or strand a lighting override (Task 3).
- Coarse-pointer changes, stored mode state, and review URL parameters must not bypass the desktop-only guard (Task 3).
- Held-pointer tests and density-aware allocation checks must exercise the actual interaction and rendering budgets (Task 4).

## Checkouts and source ownership

All `SITE/` and `CONCERT/` paths in this plan expand to these exact roots:

| Alias | Absolute path | Role |
| --- | --- | --- |
| SITE | `/Users/ethan/Documents/echen347.github.io` | Release destination; current fluid, navigation, and image work |
| CONCERT | `/Users/ethan/Documents/echen347.github.io/.claude/worktrees/chaewon-concert-preview` | Isolated concert preview and desktop-only mode changes |

At review, SITE was on `main` at `3f7c92d44f6ff883fec149cd92f392347dfc1068`, with many uncommitted changes. CONCERT was on `worktree-chaewon-concert-preview`, based on the same older commit. Recheck both before editing. The worktree is locked; do not remove, unlock, or replace it.

**Do not copy `CONCERT/studies/fluid-prototype.js` over SITE.** It predates the current click vortex and light-streaming work. The generated concert renderer contains additions built against the newer SITE source.

The preview builder writes `fluid-concert.js`; running it is not a read-only check. Before integration, rebuild deliberately from CONCERT with the explicit source:

```bash
cd /Users/ethan/Documents/echen347.github.io/.claude/worktrees/chaewon-concert-preview
node chaewon/previews/concert/build-renderer.cjs /Users/ethan/Documents/echen347.github.io/studies/fluid-prototype.js
```

Its default source is the older worktree renderer and currently fails an anchor check. Do not weaken those checks to force a build.

### File map

| Path | Responsibility / planned work |
| --- | --- |
| `SITE/studies/fluid-prototype.js` | Preserve current fluid; add corrected concert look, frame hook, and async probe APIs |
| `SITE/studies/homepage-preview.js` | Own the renderer and concert lifecycle, Scene/Paper state, reset, failure, and navigation |
| `SITE/index.html` | Load integrated concert dependencies in order; preserve early dark paint and image markup |
| `SITE/studies/homepage-preview.css` | Only layout adjustments required for the integrated concert |
| `SITE/chaewon/chaewon.js` and `.css` | Reconcile legacy activation with concert dispatch; port desktop-only guard without losing picture-aware headshot changes |
| `SITE/chaewon/concert-core.js` | New: promote the preview's pure trigger, cue, and card helpers |
| `SITE/chaewon/concert-mode.js` | New: adapt the preview controller to consume the homepage-owned renderer |
| `SITE/chaewon/concert.css` | New: scoped concert cards, hearts, and accessible status; no preview footer or global header/body takeover |
| `CONCERT/chaewon/previews/concert/build-renderer.cjs` | Fix transition preservation before porting the additions |
| `CONCERT/chaewon/previews/concert/concert.js` | Fix resize positioning before adapting the controller |
| `SITE/tests/fluid-concert.test.cjs` | New: renderer look transitions, resize/reset, callback, probe, and disposal checks |
| `SITE/tests/chaewon/concert-controller.test.js` | New: controller lifecycle, input guards, focus, and resize checks |
| `SITE/tests/chaewon/concert-core.test.js` | New: promote existing pure tests, changing their import to the production module |
| `SITE/tests/chaewon-concert.browser.html` | New: browser regression fixture for integrated cards and lifecycle |
| `SITE/tests/fluid-prototype.browser.html` and `fluid-motion.browser.html` | Correct stale hover gestures and the blanket texture limit |
| `SITE/tests/fluid-raster.test.cjs` | Keep display, dye, and solver budget coverage |
| `SITE/tests/homepage-preview-controller.test.cjs` and `site-scene.browser.html` | Extend homepage ownership, Reset-only footer, and navigation coverage |
| `SITE/tests/chaewon/persistence.test.js` | Extend coarse-startup and later pointer-change coverage |
| `SITE/images/headshot/` | Include the six existing referenced images in the proposed release manifest |
| `SITE/README.md`, `chaewon/README.md`, `chaewon/design/README.md` | Reconcile runtime documentation and record verification |

## Task 1: Preserve lighting transitions during resize

**Files:** CONCERT builder and generated renderer; new `SITE/tests/fluid-concert.test.cjs`; eventually SITE shared renderer.

The builder's `chooseComposition` patch currently calls `applyLook(look.override)` or replaces `look.base` and `look.target` with stock light. Allocation on resize invokes this path. During a transition, that overwrites the destination while the front continues moving. Completed looks already remain intact.

- [ ] Capture both checkout statuses and diffs before changing either. Preserve current generated output before rebuilding if it contains changes that do not come from the builder.
- [ ] Add renderer regression cases using the VM/WebGL fixture pattern in `tests/fluid-raster.test.cjs` and `tests/fluid-tuning.test.cjs`. Exercise the renderer, not a detached replacement state machine. Record uploaded mood uniforms, dispatch resize, advance frames, and inspect the final look and callback count.

| Case | Required result |
| --- | --- |
| Enter concert, resize before the front finishes | Target stays the concert look; callback runs once |
| Change to Crazy, resize mid-front | Crazy's red target remains `[.95, .03, .22]`, not the stock tint |
| Leave Crazy, resize mid-exit | Final light equals the captured stock look; override clears |
| Resize after completion | Committed look remains unchanged |
| Reduced-motion cut | No animated front; target applies and callback runs once |
| Rapid cue replacement | No duplicate callbacks or stale cleanup changing the newer cue |

- [ ] Run the new cases against the unfixed generated renderer and confirm the mid-transition cases fail. Do not count the existing pure concert tests as coverage for this bug.
- [ ] Change the builder so reseeding geometry does not overwrite an in-flight look. The guard belongs around look reconciliation, not around allocation or the whole composition function:

```js
// After updating geometry and canvas.dataset.seed:
if (look.front !== FRONT_IDLE) {
  lightStyle = {
    ...lightStyle,
    tintA: [...look.base.a],
    tintB: [...look.base.b],
    tintMist: [...look.base.mist]
  };
  palette = look.target.palette.map(color => [...color]);
} else if (look.override) {
  applyLook(look.override);
} else {
  const stock = stockLook();
  look.base = stock;
  look.target = copyLook(stock);
}
```

Keep `base`, `target`, `override`, `front`, `speed`, `width`, `edge`, and `done` intact during the active branch. Verify the fix against actual uniforms and completion, not only source matching.

- [ ] Regenerate with the explicit SITE source command, then rerun regression cases. Do not hand-edit `fluid-concert.js`.
- [ ] Define reset behavior in tests: outside concert, Reset randomizes the scene; during concert, retain the selected mood and reinitialize cards for the new flow. Exiting must restore that new seed's stock light, not a stale pre-reset palette. Keep the stock baseline distinct from the applied mood when porting the API.

## Task 2: Reposition cards when the viewport changes

**Files:** `CONCERT/chaewon/previews/concert/concert.js`; new controller/browser tests; then `SITE/chaewon/concert-mode.js`.

The current resize listener only calls `updateBounds()`. `renderCard()` and the animation loop skip forward and returning cards. Static cards also receive no new frame under reduced motion or fallback. Their pixel transforms retain the old viewport position. In review, a selected card remained at left 340 px after narrowing the viewport to 320 px.

- [ ] Reproduce at 1280 × 800: activate, bring a card forward, resize to 600 × 800 and then 320 × 800. Repeat after flipping, with reduced motion, while paused, and with renderer fallback. Also shorten the viewport height.
- [ ] Add failing controller/browser assertions for card bounds, retained flip state, retained focus, and unchanged card count. Use `getBoundingClientRect()` for the browser assertion, not only a pure helper test:

```js
const rect = card.getBoundingClientRect();
check(rect.left >= 0 && rect.top >= 0 &&
  rect.right <= innerWidth && rect.bottom <= innerHeight,
  'Selected card stays reachable after resize');
check(card.classList.contains('is-flipped') === wasFlipped,
  'Resize preserves the selected face');
check(document.activeElement === card, 'Resize preserves card focus');
```

- [ ] Extract the forward-position calculation from `bringForward()` into a positioning-only helper. Reuse `core.forwardRect`, `cardSize`, and `toPixels`:

```js
function positionForward(card) {
  const { forwardWidth, forwardHeight } = cardSize();
  const [cx, cy] = toPixels(card.x, card.y);
  const rect = core.forwardRect(
    { cx, cy }, { width: forwardWidth, height: forwardHeight },
    { width: innerWidth, height: innerHeight }, 16
  );
  card.el.style.transform =
    `translate3d(${rect.left.toFixed(1)}px,${rect.top.toFixed(1)}px,0) rotate(0deg)`;
}
```

Do not call `bringForward()` on resize: it calls `release()` and changes the face/focus state. Ensure CSS card sizes fit short viewports before clamping positions.

- [ ] In the resize path, update bounds, clamp resting card coordinates to the new usable band, reposition forward cards, and render static cards immediately. For a returning card, settle its return timer/class before rendering its new resting position. Preserve header/footer exclusion and do not start an animation loop for reduced motion.
- [ ] Rerun the resize matrix and the existing pure concert tests. Confirm Escape still returns the same card and restores focus.

## Task 3: Integrate the corrected concert into the current website

**Files:** SITE renderer, homepage controller/HTML/CSS, new concert modules, legacy Chaewon controller/CSS, and integration tests listed in the file map.

This is integration of the reviewed direction, not a redesign. Preserve three opaque glossy photocards, transported lighting fronts, current-driven motion, card-back jokes and song hints, at most 12 hearts, and no audio. Preserve the preview's song moods. Use its sustained mood behavior on the entrance: a cue holds until the next cue or exit.

- [ ] Add failing integration tests before wiring the modules: one renderer per homepage; one activation per `chaewon` trigger; no old marquee/wallpaper alongside concert cards; no concert on content pages; no coarse-pointer activation through typing, stored state, `?start`, or `?cue`.
- [ ] Make the production footer Reset-only. Do not copy `#hint`, the visible `#cue`, or `#leave` from `CONCERT/chaewon/previews/concert/index.html`. Remove controller assumptions that those preview elements exist. A visually hidden live region may announce cues, but must not leave empty footer space. Keep the typed `chaewon` toggle as an exit, and preserve card Escape behavior. No new visible instructions or Pause button.

Add a production browser assertion and run it with the concert inactive, active, and after leaving:

```js
const footer = document.querySelector('.scene-footer');
const visible = element => {
  const style = getComputedStyle(element);
  return element.getClientRects().length > 0 &&
    style.display !== 'none' && style.visibility !== 'hidden' &&
    !element.closest('[hidden], [inert]');
};
const actions = [...footer.querySelectorAll('button, a')].filter(visible);
check(actions.length === 1 && actions[0].id === 'scene-reset',
  'Reset is the only production footer action');
check(!/Preview:|type chaewon|Leave the concert|Lit for/i.test(footer.innerText),
  'Production footer has no preview invitation or visible cue');
```

Place any visually hidden cue region outside the footer so the visible-footer assertion does not depend on how the browser reports clipped text. Confirm Reset changes the seed without duplicating the concert controller. Verify the original top navigation and Scene/Paper switch remain usable.

- [ ] Port the corrected additive renderer API from the builder into **SITE's current renderer**. Preserve existing methods and parameters. The added interface is:

```js
setLook(look, { speed, width, edge, done }) // animated transition
setLook(look, { type: 'cut', done })       // immediate transition
clearLook()
getLook()
onFrame(hook) // hook({ frames, dt, simDt }); returns an unsubscribe function
setProbePoints(points) // array of [x, y] normalized coordinates
readProbe()
ambientDirection(x, y)
isPaused()
```

Keep the preview's pixel-pack-buffer/fence sampling approach. Do not add synchronous per-frame readback or another full-screen renderer. Release probes, hooks, and pending work on disposal. Leave the stock path's output and budgets unchanged when concert is inactive.

- [ ] Adapt the preview into `window.ChaewonConcert.create(options)`. Use this lifecycle contract so the homepage remains the owner:

```js
// New controller contract, not an existing API:
const concert = window.ChaewonConcert.create({
  fluid,                         // existing renderer, never create another
  canvas,                        // focus target
  host: scene,                   // #scene-layer, contains the owned concert UI
  header: document.getElementById('site-header'),
  footer: document.querySelector('.scene-footer')
});
// Returned methods:
// activate(): enter if enabled and primary pointer is not coarse
// leave({ immediate = false } = {}): exit and restore stock light/tuning
// setEnabled(boolean): false exits immediately and disables triggers
// reset(): reset cards and stock baseline after the owner resets the fluid
// isActive(): boolean
// dispose(): remove listeners, timers, hooks, probes, and owned UI; do not dispose fluid
```

Initialize only for the entrance, after `ensureFluid()` succeeds. Make disposal and repeated enable/disable calls safe. `setEnabled(false)` must restore state synchronously before the renderer pauses; it cannot depend on another animation frame.

- [ ] Connect `showView`, Reset, failure, pagehide/pageshow, and disposal to that contract. Reset the fluid before calling `concert.reset()`. Suspend with the existing renderer on document visibility changes; do not keep card timers advancing hidden motion. On non-restored pagehide, dispose the concert before the renderer. Do not add content-page stirring.
- [ ] Resolve activation ownership in `chaewon/chaewon.js`. Use one dispatcher or mutually exclusive controllers, not two independent listeners reacting to the same word. Port the worktree's coarse-pointer guard and mobile-hunt removal while preserving SITE's picture-aware headshot code. Retain existing paper/content behavior apart from the desktop-only decision; do not add moving photocards there.
- [ ] Fix the newly confirmed coarse-startup bug before porting the legacy guard. In `CONCERT/chaewon/chaewon.js:900-902`, `init()` returns before registering capability, `pageshow`, and keyboard listeners. A page that starts coarse cannot later respond to the typed trigger after switching to a fine pointer. In the test harness, direct activation after that switch also lacks the listener needed to exit when the pointer becomes coarse again.

Register capability/restoration listeners regardless of the initial pointer. Install keyboard dispatch once, with a live coarse-pointer check on activation. Defer decorative setup until it is eligible; do not run the former touch hunt. Extend `tests/chaewon/persistence.test.js` with these cases:

| Initial state and events | Expected result |
| --- | --- |
| Coarse, stale stored active flag, startup | Inactive; stored flag cleared |
| Coarse startup, change to fine, type `chaewon` | One activation |
| Coarse startup, change to fine, activate, change to coarse | Immediate deactivation |
| Coarse startup, change to fine, activate, restore page as coarse | Inactive on `pageshow` |
| Repeated fine/coarse changes and page restores | No duplicate keyboard or capability listeners |

Use the existing event-emitting media-query fixture to drive real listeners. Do not fix only an exported test API while leaving the typed path broken.

- [ ] Consume Escape for a forward card before the homepage's Escape handler switches to Paper. Test listener order, `defaultPrevented`, focus restoration, editable-field typing, repeated activation, and fast exit/re-entry. Old cleanup callbacks must not clear a newly entered mood.
- [ ] Load dependencies before `homepage-preview.js`. Scope concert CSS under its host/state. Keep early dark-paint code ahead of delayed external resources. The preview should use the integrated shared renderer/controller after promotion, not remain a second production fork. Retire its generated renderer dependency deliberately; do not rerun the old anchored builder after those APIs already exist in the shared source.
- [ ] Verify input capability changes while active: changing to coarse exits; returning to fine allows a later explicit activation. Reduced motion uses cut transitions and still cards. WebGL failure leaves navigation and Paper usable, with no uncaught callback failures.

## Task 4: Repair browser tests that no longer model the UI

**Files:** `SITE/tests/fluid-prototype.browser.html`, `fluid-motion.browser.html`, `fluid-raster.test.cjs`, and other fluid fixtures only if they use the same obsolete gesture.

The prototype fixture sends unheld mouse moves, but current input requires a press. The motion fixture's active performance phase has the same defect, so it can measure an idle scene while calling it interaction. Do not change runtime input to satisfy these old tests.

- [ ] Replace intended mouse strokes with a primary down/move/up sequence. Keep a separate hover test asserting zero new interactions:

```js
const pointer = (type, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
  pointerId: 1, pointerType: 'mouse', isPrimary: true,
  button: type === 'pointermove' ? -1 : 0, buttons,
  clientX: rectangle.left + x, clientY: rectangle.top + y, bubbles: true
}));
pointer('pointerdown', 180, 150, 1);
pointer('pointermove', 260, 180, 1);
pointer('pointermove', 370, 230, 1);
pointer('pointerup', 370, 230, 0);
```

Keep the renderer unpaused during input. Account for the down event's vortex when counting interactions. Compare held drag with a click-only control so a changed pixel assertion does not pass from the click alone. In the performance phase, hold for the active interval, release for idle, and verify accepted stroke activity before reporting timing.

- [ ] Replace the prototype fixture's blanket `max(textureSizes) <= 600000` assertion with role-aware checks. Follow the existing allocation/pass inspection in `fluid-raster.test.cjs`:

| Viewport / density | Display and light | Solver | Dye |
| --- | --- | --- | --- |
| 1600 × 900 / 1 | 1600 × 900 | 341 × 192 | 1365 × 768 |
| 390 × 844 / 2, capped at 1.5 | 585 × 1266 | 144 × 311 | 504 × 1090 |

The portrait light texture has 740,610 pixels; the dye target has 549,360. That is intentional display-resolution lighting, not an enlarged simulation grid. Do not raise budgets or blur the display to turn the test green. Check the existing 1.6-million display cap and density cap alongside solver/dye limits.

- [ ] Run both corrected browser pages and the Node raster/input suites. Audit other fluid fixture `pointermove` calls and distinguish intended hover tests from obsolete drag tests. Report remaining failures rather than removing assertions.

## Task 5: Assemble an explicit release inventory

**Files:** SITE homepage image references/assets, README files, and a new `docs/notes/2026-10-01-release-verification.md` report.

The main HTML already references six headshot variants that exist locally but are untracked:

```text
images/headshot/headshot-240.jpg
images/headshot/headshot-480.jpg
images/headshot/headshot-720.jpg
images/headshot/headshot-240.webp
images/headshot/headshot-480.webp
images/headshot/headshot-720.webp
```

- [ ] Verify the `<picture>` and `srcset` references in both `index.html` and `profile.html` against these files. Preserve the existing JPEG fallback and picture-aware decoration. Do not regenerate the photographs.
- [ ] Include all six in the proposed release manifest. `.headshot-generation.json` also exists in that directory; identify it as generation metadata, not a browser dependency. Inspect it before deciding whether it belongs in the manifest.
- [ ] List every new concert source, style, asset dependency, and regression test by exact path. Check that no production URL depends on `.claude/worktrees/`, an untracked preview-only file, or localhost. Do not copy all untracked studies, `gargantua/`, or `world/` into the release.
- [ ] Remove stale README claims about Pause. Update current concert status and source pointers without rewriting historical brainstorms. A README link to the archived tunnel also needs its dependency set or an explicit local-only label; do not bundle unrelated experiments to satisfy a documentation link.
- [ ] Check the manually maintained Last updated date against the actual intended release day. Do not rewrite profile content as part of this task.
- [ ] Record the proposed path list, test results, remaining limits, and preview URLs in the release verification note. Leave the index unstaged for Ethan's review.

## Task 6: Verify the integrated result and stop before publishing

- [ ] From SITE, run the existing Node and Python suites, including the new tests placed under their globbed directories:

```bash
node --test --test-reporter=spec tests/*.test.cjs tests/chaewon/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
```

- [ ] Serve SITE, not CONCERT, for final integration checks. Reuse a server only after verifying its root. The review used SITE on port 8879 and CONCERT on 8880; those are separate products. A new SITE server can run with:

```bash
python3 -m http.server 8879 --bind 127.0.0.1 --directory /Users/ethan/Documents/echen347.github.io
```

- [ ] Run `tests/site-scene.browser.html`, `tests/fluid-click.browser.html`, the corrected prototype/motion fixtures, and the new `tests/chaewon-concert.browser.html`. Inspect console errors and failed asset requests. Inspect the rendered scene, not just pass counts.
- [ ] Run the delayed-resource first-paint fixture on its dedicated server, not the generic static server:

```bash
node tests/scene-first-paint.server.cjs
# Open http://127.0.0.1:8883/tests/scene-first-paint.browser.html
```

- [ ] With the existing Playwright environment available, run image delivery checks including the homepage. Do not install a package manager or add dependencies to the site just for this test:

```bash
CHECK_HOMEPAGE=1 SITE_URL=http://127.0.0.1:8879 node tests/image-delivery.browser.cjs
```

- [ ] Exercise the retained UX requirements manually and in the relevant fixtures:
  - Entrance navigation remains Profile / Academic / Photography; Writing stays out of the top navigation.
  - Profile opens biography text in the current appearance. Academic remains coursework, with Home returning to the text profile. Back to scene returns to the fluid-only entrance.
  - Scene links preserve seed and dark appearance without a white flash. Paper navigation stays paper. Scene/Paper controls remain at the top in document flow.
  - Profile, Academic, and Photography show no Reset/Pause controls and accept no stirring input.
  - The production entrance footer shows only Reset before, during, and after concert mode. It has no Preview label, typed-start invitation, visible cue, Leave the concert button, Pause, or visible stirring directions. The hidden typed trigger and typed exit still work.
  - Hover does not stir. A primary click creates the current small vortex; held drag creates a continuous stroke. Do not undo radius `.06 * shortSide * tuning.trailWidth` and spin `.5 * tuning.cursorForce` without a new visual comparison.
  - White light streams along the strands, not across them. Preserve idle continuity, bright fading, and aliasing protections. Let the scene idle and inspect after interaction as well as at startup.
  - All five song cues work; cards raise, flip, return, and stay within bounds after resize. No duplicate legacy decorations appear.
  - Reset during concert, exit during a cue, rapid re-entry, Escape, Scene/Paper, tab hiding, reduced motion, and coarse-pointer changes leave no orphan cards, probes, listeners, or tuning overrides.
- [ ] Measure idle and held-drag frame intervals before/after concert on the same browser, viewport, density, and device. Record median, p95, and long frames. Do not reuse older performance claims as fresh results or describe emulation as a physical-phone test.
- [ ] Check the final diff and prose:

```bash
git diff --check
python3 /Users/ethan/Documents/College/Research/spr26/prose_lint.py README.md chaewon/README.md chaewon/design/README.md docs/notes/2026-10-01-release-verification.md
git status --short
git diff --cached --name-status
```

Add any other changed prose files to the linter command. The staged-file check must match the initial state; do not unstage someone else's work if it changed concurrently.

- [ ] Return a local SITE preview link, screenshots of stock and concert states, the exact proposed release manifest, test results, and any unresolved issues. Stop. Ethan will decide whether to authorize staging, committing, and pushing.

## Review baseline, not a substitute for rerunning

During the Oct 1 pre-push review, SITE's Node suite passed 277 checks and Python passed 5. The worktree's concert/core, legacy mode, and image checks passed 44 combined. Browser checks passed 148 for site navigation, 19 for click interaction, and 113 for delayed first paint. The older prototype browser fixture passed 15 and failed 2 under the reviewed high-density configuration: obsolete hover input and the blanket texture cap.

Those passes did not cover the two concert resize defects. The concert was still isolated in CONCERT, and the six headshot images were still untracked. Physical-phone performance did not receive a new verification pass. Treat counts and local ports as review-time observations, not guaranteed current state.

### Follow-up review, 02:39-02:44 HKT

Fresh reruns again passed 277 SITE Node tests, 44 combined worktree Node tests, and 5 SITE Python tests. Source inspection confirmed that the integration and asset issues remained. A browser check reproduced the forward-card defect: after resizing from 1280 to 320 pixels wide, the selected card retained a left coordinate of 966 pixels. The preview produced no captured warning/error logs at the initial inspected state; this was not a full performance run.

The focused desktop-only patch review found the additional coarse-startup listener defect documented in Task 3. Existing tests passed because they did not cover that initial-state transition. Input-transition reproductions used the test harness, not a physical hybrid device. These findings still block a claim that the combined release is ready.
