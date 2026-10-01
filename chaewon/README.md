# chaewon/

Chaewon Mode: site-wide stan-coded easter egg.

- **Activate:** type `chaewon` anywhere on the site. The mode lasts for the browser session.
- **Two presentations:** on the homepage's fluid scene the mode is a concert: the light sweeps to stage colors and three photocards ride the current. Elsewhere, and in the homepage's Paper view, it shows the classic decorations. [`chaewon.js`](chaewon.js) owns the typed trigger and picks the presentation, so the two never overlap.
- **Exit:** type `chaewon` again. The classic decorations also offer the `× exit ♡` button.
- **Mobile:** off. Chaewon Mode never starts on a device whose primary pointer is coarse. The former heart hunt is archived in [archive/mobile-hunt.md](archive/mobile-hunt.md).
- **Concert design and renderer API:** [design/concert.md](design/concert.md). Code: [`concert-core.js`](concert-core.js), [`concert-mode.js`](concert-mode.js), [`concert.css`](concert.css).
- **Upgrade brainstorm:** [design/README.md](design/README.md)
- **Historical spec:** `docs/superpowers/specs/2026-04-22-chaewon-mode-design.md`
- **Historical plan:** `docs/superpowers/plans/2026-04-22-chaewon-mode.md`

## Adding assets

Drop image/GIF files into `images/chaewon/{bubbles,gifs,mascots,stickers}/` and add an
entry to `images/chaewon/manifest.json`. The asset loader picks them up on next activation.
The manifest feeds the classic decorations only. The homepage concert's three photocards
come from the `PHOTOS` list in `chaewon/concert-mode.js`, which loads files from
`images/chaewon/bubbles/`; edit that list to change them.

## Adding stan comments per course

Edit `COURSE_COMMENTS` in `chaewon/chaewon.js` (course code to string). The April spec also planned per-photo comments and `content/chaewon/*.json` files; neither was built.

## Adding sub-eggs (typed song names)

Edit the `TRIGGERS` array in `chaewon/chaewon.js` and add a CSS class hook in `chaewon/chaewon.css`. On the homepage concert, the same names retune the light: in `chaewon/concert-core.js`, add the name to its `TRIGGERS` list and a matching entry to `PRESETS` and `CUES`.
