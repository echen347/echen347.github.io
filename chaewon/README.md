# chaewon/

Chaewon Mode — site-wide stan-coded easter egg.

- **Spec:** `docs/superpowers/specs/2026-04-22-chaewon-mode-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-22-chaewon-mode.md`
- **Activate (desktop):** type `chaewon` anywhere on the site.
- **Activate (mobile):** find 5 hearts hidden across pages and tap them in order.
- **Exit:** click the `× exit ♡` button (injected by `chaewon.js` into the top-right when mode is active) or type `chaewon` again.

## Adding assets

Drop image/GIF files into `images/chaewon/{bubbles,gifs,mascots,stickers}/` and add an
entry to `images/chaewon/manifest.json`. The asset loader picks them up on next activation.

## Adding stan-comments per course / photo

Edit `content/chaewon/academic.json` (course code → string) or
`content/chaewon/photography.json` (photo filename → string). New entries appear automatically.

## Adding sub-eggs (typed song names)

Edit the `TRIGGERS` array in `chaewon/chaewon.js` and add a CSS class hook in `chaewon/chaewon.css`.
