# Release verification, 2026-10-01

Status: integrated into the main checkout and re-verified there; a follow-up pass fixed the documented issues; nothing staged, committed, or pushed. Plan: [website release handoff](../superpowers/plans/2026-10-01-website-release-handoff.md).

## What changed

- The Chaewon concert runs on the homepage's fluid scene through the shared renderer. `chaewon.js` owns the typed trigger and shows either the concert (entrance scene) or the classic decorations (Paper view and content pages), never both. Details: [concert design](../../chaewon/design/concert.md).
- Chaewon Mode is desktop-only: a device whose primary pointer is coarse never starts it, a change to a coarse pointer ends it, and a page that starts coarse still accepts the trigger after a change to a fine pointer. The mobile heart hunt is archived in [mobile-hunt.md](../../chaewon/archive/mobile-hunt.md).
- The shared renderer gained the lighting, frame-hook, and probe API. With no look set, stock output is unchanged: a comparison against the previous renderer over 60 frames found 2444 identical draws.
- The entrance footer keeps only Reset before, during, and after the concert.
- Browser fixtures that sent hover-only strokes now press, move, and release; the prototype fixture's blanket texture cap became role-aware display, solver, and dye checks.
- READMEs drop the removed Pause control and describe the concert, the desktop-only rule, and the local-only tunnel archive.

## Preview

Serve the checkout and open the entrance:

```bash
python3 -m http.server 8879 --bind 127.0.0.1 --directory /Users/ethan/Documents/echen347.github.io
# http://127.0.0.1:8879/?seed=1949011526#scene  (type chaewon)
# http://127.0.0.1:8879/tests/chaewon-concert.browser.html
```

## Results

Node and Python suites:

```bash
node --test tests/*.test.cjs tests/chaewon/*.test.js    # 350 pass, 0 fail
python3 -m unittest discover -s tests -p 'test_*.py'    # 5 pass
```

In this checkout the Node glob also matches the ten local experiment test files listed under Excluded, which hold 132 of the 350. The shipped test files hold 218: 213 in committed and Required files, 5 in the Recommended `tests/fluid-streaming.test.cjs`.

Browser fixtures, headless Chrome with Metal on an M4 Air:

| Fixture | Result |
| --- | --- |
| `site-scene` | 148 of 148 |
| `chaewon-concert` (new) | 37 of 37 |
| `homepage-preview` | 31 of 31 |
| `fluid-click` | 19 of 19 |
| `fluid-prototype` | pass at 1x and 2x density |
| `fluid-motion` | 12 of 12 at 1x and 2x density |
| `scene-first-paint` (own server) | 113 of 113 at 1x and 2x density |
| `image-delivery` with `CHECK_HOMEPAGE=1` | pass at 320, 390, 768, and 1280 px |
| `fluid-coupling` (now with a click-only control scene) | pass; the held stroke changes 35.7% of pixels against 9.5% for the press alone |
| 24 other fluid fixtures (antialias, bloom, bloom-look, deformation, drag, emission, fade-look, glass, glass-look, idle, lighting-comparison, luminous-fade-look, optical-sampling, reflection-look, seed, seed-continuity, startup, strand-continuity, strand-field, strand-raster, streaming, stroke, transport, velocity-sampling) | pass; eight of them were repaired in the fix pass |
| `fluid-display` | 6 of 6; the highlight bound rose from 32 to 80 by Ethan's decision (see the fix pass) |

These counts come from the fix pass, run on the worktree that produced its patch. The first pass's results also ran on the main checkout after its patch.

Device checks with Playwright on the integrated entrance: a change to a coarse pointer ends the concert and clears the stored flag; typing cannot restart it until the pointer is fine again; `?start` and `?cue` do nothing; reduced motion shows still cards with no animation frames; without WebGL the page falls back to Paper, navigation works, and the classic mode still runs there; all five song cues announce; leaving during a cue and rapid re-entry leave one concert layer and no stray cards. No page errors occurred.

The same kind of checklist, 42 items, passed on the main checkout after the patch: typing chaewon shows three upright 55:85 photocards with no classic decorations beside them; a card comes forward, turns over to its theorem back, and returns; Escape returns a forward card without leaving the scene; Reset keeps the concert and places fresh cards; cards stay inside the window after resizes down to 700x420; Paper mid-concert shows the classic mode, and the scene brings the cards back; exit, re-entry, and rapid re-entry leave one layer; the page holds one WebGL renderer throughout; a phone gets nothing from typing; and the profile, academic, photography, and writing pages run the classic mode without loading concert assets.

Frame intervals, 240 frames each, same browser and viewport:

| Viewport | Stock idle | Stock drag | Concert idle | Concert drag |
| --- | --- | --- | --- | --- |
| 1280x800 at 1x | 16.7 / 18.1 ms | 16.7 / 18.3 ms | 16.7 / 18.3 ms | 16.7 / 18.3 ms |
| 1440x900 at 2x | 16.7 / 18.3 ms | 16.7 / 18.4 ms | 16.7 / 18.5 ms | 16.6 / 18.5 ms |

Values are median / 95th percentile; no frame exceeded 20 ms. The machine was under load (load average about 18). This is a desktop measurement, not a phone test.

## Final review

A 60-agent fresh-context review checked the change against the plan's review focus. Its confirmed important findings were fixed, each with a test that failed first:

- `ambientDirection` rotated the wrong way, so cards drifted 20 to 67 degrees across the strands. It now matches the shader's tangent within half a degree.
- A concert that started while the renderer was paused (for example, typing the trigger on Paper, then switching to the scene) never got its frame hook; cards froze and hearts stuck in a corner. The hook now installs at activation.
- The mood lines used `pow` on a negative base and a reversed `smoothstep`, both undefined in GLSL; a GPU that returns NaN there would have blanked the stock scene. They now use defined forms with identical values.
- Test gaps: the 1.6-million-pixel cap now has a binding case in `fluid-raster.test.cjs`; the coupling fixture has a click-only control; the concert controller tests cover a stock light that changes on Reset, resize under reduced motion, short windows, returning cards, and clamping; the renderer tests cover probe unit conversion, hook timing, and the light ahead of a front during a resize.

## Fix pass

A follow-up pass fixed the minor findings that the final review deferred and the main-checkout check found, each with a test that failed first:

- Reset during the exit sweep now ends on the new seed's stock light instead of the previous seed's tints.
- Turning on reduced motion during the exit sweep settles the exit at once instead of leaving concert light in place.
- Leaving the entrance mid-concert without the back-forward cache no longer mounts the classic decorations or requests their manifest.
- Switching from the classic mode to the concert ends running song effects (petals, stars, lasers, and the CRAZY and EASY classes) and an idle popup, and restores a hovered heading.
- Start points take one probe column per card, so a short window cannot stack two cards; a card that has not surfaced, or one still fading from an earlier concert, takes no clicks.
- Each card back restarts LaTeX.css's theorem and definition counters, and turning a card announces its back through the live region.
- Switching to the scene from a scrolled Paper view places the cards below the header: the homepage attaches the concert disabled and enables it after scrolling the scene to the top.
- Test nits: the controller's fake renderer keeps a list of frame hooks, tests assert the concert layer's visibility and hook counts, and test names match their assertions.
- Documentation nits: the song recipe names `concert-core.js`'s `TRIGGERS`, Required docs no longer link Recommended-tier files, the archive's restore steps match the current dispatcher, the asset instructions point to the concert's `PHOTOS` list, and the Node counts above separate shipped tests from local experiments.

The same pass repaired eight stale fluid fixtures without changing a renderer line or a look threshold:

- `fluid-bloom-look`, `fluid-fade-look`, `fluid-luminous-fade-look`, and `fluid-reflection-look` scripted hover-only strokes, which the renderer now ignores; they press, move, and release, and expect 41 interactions.
- `fluid-strand-continuity` anchors on the streaming pulse line.
- `fluid-stroke` extracts the splat shader without assuming which shader follows it.
- `fluid-deformation` uploads the default light style the seed shader needs, so its test images are no longer black.
- `fluid-idle` runs on a 640 × 360 canvas. Bloom radii are fixed in device pixels, and at 320 × 180 the dark-space floor never held, even before the approved Glass halo. The 25% floor and the luma cutoff are unchanged.

`fluid-display` capped Glass highlights over Ink at 32/255, a bound set before the slope-relative reflection approved on 2026-09-29 (3f7c92d). The published look measures 75/255 on Metal, OpenGL, and SwiftShader, and Ethan chose to raise the bound to 80. Brighter variants still fail it: a doubled thin-fold knee and a narrower coverage curve (86), studio lights at 1.5 times (91), and a doubled cool light (105). `fluid-glass` checks how the reflections fade.

A seven-reviewer check of the pass, with two skeptics per finding, confirmed five minor findings: this note was stale, the CRAZY and EASY classes could replay their strobe on a quick return to Paper, and the archive's restore steps followed the old state model. All five are fixed.

## Limits

- The preview reproduced a cached legacy dispatcher alongside the concert assets. All five site pages now version `chaewon.js` and `chaewon.css` with `v=concert-1`. Reloading the in-app preview showed three rectangular concert cards without the classic border or circles.
- The concert photos are 400x400, so a forward card upsamples at 2x density.
- Tab-hiding behavior rests on the renderer's existing visibility tests; headless Chrome could not hide the tab.
- Only Chromium was tested. Safari, Firefox, and Windows graphics drivers were not run.
- The "Last updated" footer reads 10/1/2026 on the homepage and profile; change it if publishing happens later.
- `tests/homepage-entry.test.cjs` stays local: two of its four tests read the local-only tunnel archive.

## Proposed release manifest

Required (43), because the site or its documented tests break without them:

- `README.md`
- `academic.html`
- `chaewon/README.md`
- `chaewon/archive/mobile-hunt.md`
- `chaewon/chaewon.css`
- `chaewon/chaewon.js`
- `chaewon/concert-core.js`
- `chaewon/concert-mode.js`
- `chaewon/concert.css`
- `chaewon/design/README.md`
- `chaewon/design/concert.md`
- `chaewon/design/directions.md`
- `homepage-preview.html`
- `images/headshot/.headshot-generation.json`
- `images/headshot/headshot-240.jpg`
- `images/headshot/headshot-240.webp`
- `images/headshot/headshot-480.jpg`
- `images/headshot/headshot-480.webp`
- `images/headshot/headshot-720.jpg`
- `images/headshot/headshot-720.webp`
- `index.html`
- `photography.html`
- `profile.html`
- `studies/fluid-prototype.js`
- `studies/homepage-preview.css`
- `studies/homepage-preview.js`
- `tests/chaewon-concert.browser.html`
- `tests/chaewon-images.test.cjs`
- `tests/chaewon/concert-controller.test.js`
- `tests/chaewon/concert-core.test.js`
- `tests/chaewon/dispatch.test.js`
- `tests/chaewon/harness.cjs`
- `tests/chaewon/persistence.test.js`
- `tests/fluid-concert.test.cjs`
- `tests/fluid-cursor.test.cjs`
- `tests/fluid-raster.test.cjs`
- `tests/fluid-tuning.test.cjs`
- `tests/homepage-preview-controller.test.cjs`
- `tests/image-delivery.browser.cjs`
- `tests/scene-first-paint.browser.html`
- `tests/scene-first-paint.test.cjs`
- `tests/site-scene.browser.html`
- `writing.html`

Recommended (34), tests, fixtures, and notes for shipped code:

- `docs/notes/2026-09-30-fluid-and-chaewon-brainstorm.md`
- `docs/notes/2026-10-01-release-verification.md`
- `docs/superpowers/plans/2026-10-01-website-release-handoff.md`
- `tests/fluid-antialias.browser.html`
- `tests/fluid-bloom-look.browser.html`
- `tests/fluid-bloom.browser.html`
- `tests/fluid-click.browser.html`
- `tests/fluid-coupling.browser.html`
- `tests/fluid-deformation.browser.html`
- `tests/fluid-display.browser.html`
- `tests/fluid-drag.browser.html`
- `tests/fluid-emission.browser.html`
- `tests/fluid-fade-look.browser.html`
- `tests/fluid-glass-look.browser.html`
- `tests/fluid-glass.browser.html`
- `tests/fluid-idle.browser.html`
- `tests/fluid-lighting-comparison.browser.html`
- `tests/fluid-luminous-fade-look.browser.html`
- `tests/fluid-motion.browser.html`
- `tests/fluid-optical-sampling.browser.html`
- `tests/fluid-prototype.browser.html`
- `tests/fluid-reflection-look.browser.html`
- `tests/fluid-seed-continuity.browser.html`
- `tests/fluid-seed.browser.html`
- `tests/fluid-startup.browser.html`
- `tests/fluid-strand-continuity.browser.html`
- `tests/fluid-strand-field.browser.html`
- `tests/fluid-strand-raster.browser.html`
- `tests/fluid-streaming.browser.html`
- `tests/fluid-streaming.test.cjs`
- `tests/fluid-stroke.browser.html`
- `tests/fluid-transport.browser.html`
- `tests/fluid-velocity-sampling.browser.html`
- `tests/homepage-preview.browser.html`

Excluded (46), unrelated experiments that stay local (`gargantua/` is also excluded):

- `docs/superpowers/specs/2026-06-19-photography-gallery-redesign-design.md`
- `studies/archive/tunnel-home.html`
- `studies/filament-knot.html`
- `studies/filament-post.js`
- `studies/filament-runtime.js`
- `studies/filament-shaders.js`
- `studies/fluid-debug.css`
- `studies/fluid-debug.js`
- `studies/fluid-prototype.html`
- `studies/glass-knot.html`
- `studies/glass-runtime.js`
- `studies/glass-shaders.js`
- `studies/lens-knot.html`
- `studies/lens-shaders.js`
- `studies/life-history.js`
- `studies/life-tunnel-shaders.js`
- `studies/life-tunnel.html`
- `studies/life-tunnel.js`
- `studies/mobius-knot.html`
- `studies/mobius-shaders.js`
- `studies/shape-shaders.js`
- `tests/filament-optics.browser.html`
- `tests/filament-optics.browser.js`
- `tests/filament-runtime.test.cjs`
- `tests/fluid-debug.browser.html`
- `tests/glass-optics.browser.html`
- `tests/glass-optics.browser.js`
- `tests/glass-runtime.test.cjs`
- `tests/homepage-entry.test.cjs`
- `tests/lens-optics.browser.html`
- `tests/lens-optics.browser.js`
- `tests/lens-page.test.cjs`
- `tests/lens-performance.local.html`
- `tests/life-history.test.cjs`
- `tests/life-tunnel-page.test.cjs`
- `tests/life-tunnel.browser.html`
- `tests/life-tunnel.browser.js`
- `tests/life-tunnel.test.cjs`
- `tests/mobius-optics.browser.html`
- `tests/mobius-optics.browser.js`
- `tests/shape-optics.native.c`
- `tests/shape-optics.native.cjs`
- `tests/shape-shaders.test.cjs`
- `tests/world-controller.test.cjs`
- `tests/world-renderer.test.cjs`
- `world/fractal-world.js`

The index is untouched: no file is staged.
