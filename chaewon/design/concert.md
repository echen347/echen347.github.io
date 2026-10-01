# Chaewon concert

Status: integrated on the homepage entrance on 2026-10-01. Ethan chose this in-scene direction on 2026-09-30.

## Behavior

Typing `chaewon` on the homepage's fluid scene starts the concert on a desktop. A pearl-and-neon front sweeps along the strands; it uses the fluid's transported coordinates, so it bends around any vortex a visitor has made. Three photocards then surface roughly as the front reaches them and ride the current. Typing `chaewon` again sweeps the stock light back and removes the cards.

Song names retune the light while the concert runs, and each mood holds until the next song or the exit:

| Type | Light |
| --- | --- |
| `perfectnight` | violet and blue |
| `crazy` | crimson and magenta, fast front |
| `easy` | champagne, slow front |
| `antifragile` | steel and cyan, sharp front |
| `fearless` | petal pink |

Click or tap a photocard to bring it forward, again to turn it over, and a third time to return it; Escape also returns it. Turning a card releases a few hearts that ride the current and fade.

The footer keeps only Reset. The lighting cue and the text of each turned card reach screen readers through a visually hidden live region. The homepage's Paper view and the content pages show the classic Chaewon decorations instead; `chaewon.js` owns the typed trigger and chooses one presentation at a time. Reduced motion applies each look at once, settles an exit already under way, and keeps the cards still. A device whose primary pointer is coarse never starts the concert.

## Design

| Token | Hex | Role |
| --- | --- | --- |
| Stage | `#071015` | the scene's existing backdrop |
| Pearl | `#ffedf9` | strand cores under concert light |
| Lightstick pink | `#ff1480` | warm stage light, focus rings, hearts |
| Stage blue | `#1a29f2` | cool stage light |
| Lilac mist | `#ccc7eb` | haze between strands |

Type comes from LaTeX.css's Latin Modern. The card backs use its `.theorem`, `.lemma`, `.definition`, and `.proof` environments, so fan devotion arrives typeset as mathematics: "Theorem 1. Kim Chaewon leads LE SSERAFIM. Proof. Watch any stage." Each back restarts LaTeX.css's page-wide theorem and definition counters, so its number never depends on the page or on earlier turns. Three backs carry song hints, and a test checks that every hinted song is a real trigger.

Principles:

- Light over stickers: color changes happen inside the renderer, and the DOM holds only cards, hearts, and the hidden announcement.
- Photos are the hero objects: opaque 55:85 photocards with a pearl edge whose rim takes the color of the light behind them. Frosted glass was rejected as a generic look that also dropped frames on phones.
- One orchestrated moment on entry; afterwards the only idle motion is the current carrying the cards.
- Cards stay between the header and the footer, fade before a screen edge cuts them, and stay reachable when the window changes size.

## Files

| File | Purpose |
| --- | --- |
| `chaewon/concert-core.js` | cues, looks, card backs, card motion, and placement helpers; no DOM |
| `chaewon/concert-mode.js` | `ChaewonConcert.create`, the controller the homepage owns |
| `chaewon/concert.css` | card, heart, and hidden-announcement styles, scoped to the concert layer |
| `chaewon/chaewon.js` | the typed trigger and the choice between concert and classic decorations |
| `studies/fluid-prototype.js` | the shared renderer, including the lighting and probe additions below |
| `studies/homepage-preview.js` | creates, enables, resets, and disposes the concert with the renderer |

## Renderer additions

The shared renderer gained these methods. With no look set, the stock light path is unchanged: every concert uniform is neutral at zero, the original compose and display calls keep their text, and composition alpha carries the mood mask only while a front runs.

- `setLook(look, { speed, width, edge, done })` sweeps a look along the strands; `setLook(look, { type: 'cut', done })` applies it at once. A finished look persists through reset and resize, and a resize during a sweep keeps its target. A reset during a sweep back to the stock light retargets the sweep to the new seed's stock light. `clearLook()`, `getLook()`, and `getStockLook()` complete the set; `getStockLook()` returns the current seed's light without a mood.
- `onFrame(hook)` runs after each simulated frame with `{ frames, dt, simDt }` and returns an unsubscribe function, so decorations stop whenever the fluid pauses.
- `setProbePoints(points)` and `readProbe()` read velocity and bloom light at a few points through a pixel-pack buffer and a fence, with no synchronous readback.
- `ambientDirection(x, y)` returns the strand direction for the cards' idle drift, and `isPaused()` reports the playback state.

The controller contract is `ChaewonConcert.create({ fluid, canvas, host, header, footer })`, returning `activate()`, `leave({ immediate })`, `setEnabled(value)`, `reset()`, `applyCue(name)`, `isActive()`, `isEnabled()`, and `dispose()`. Disabling exits at once, before the renderer pauses. Disposal removes the controller's listeners, hooks, probes, timers, and elements and leaves the renderer to its owner. The homepage attaches the controller disabled and enables it once the scene is shown, scrolled to the top, and running, so `activate()` measures the scene's header and starts the light on a moving fluid. An unloading page disposes the controller without detaching it, so no classic decorations mount on the way out.

## Checks

```bash
node --test tests/fluid-concert.test.cjs tests/chaewon/*.test.js tests/homepage-preview-controller.test.cjs
```

Serve the repository root and open `tests/chaewon-concert.browser.html` for the integrated lifecycle in a browser. The release verification note records the full suite, browser, and performance results.

## Limits

- The photos are 400×400. A forward card at 2× density upsamples them; crisp cards need larger portrait sources.
- Pointer dye made during a mood keeps its color until it fades; leaving shortens the fade to one second during the exit sweep.
- A mood holds until the next song or the exit, while the classic song effects last about three seconds.
- Content pages keep the classic decorations; the concert appears only on the entrance scene.
