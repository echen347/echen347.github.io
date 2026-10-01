# Personal Academic Website

Source code for my personal academic website, available at [echen347.github.io](https://echen347.github.io).

## Overview

This site is built with **plain HTML** and **Vanilla JavaScript**, styled with [LaTeX.css](https://latex.vercel.app/) for a clean, academic aesthetic.

### Features

-   **Fluid Scene and Paper Pages**: An interactive fluid scene with randomized colors and waves. At the entrance, a click creates a small vortex and a held drag stirs the fluid. Profile, Academic, Photography, and Writing retain the scene or paper appearance of the link used to open them. The book control switches to Paper, and Reset starts a fresh composition.
-   **Research**: Highlights my work on the mathematical foundations of machine learning.
-   **Photography**: A photography gallery (`photography.html`) with paired images and full-width landscapes.
-   **Writing**: My Substack posts (`writing.html`).

## Development

The site is lightweight with no build step.

Serve this directory locally and open `/` for the fluid scene or `/#profile` for the paper profile. The renderer lives in `studies/fluid-prototype.js`; it pauses in Paper mode. The profile remains available without WebGL or JavaScript. An earlier tunnel experiment exists only as local, uncommitted files under `studies/archive/` and `world/`; it is not part of the published site.

The section pages use plain URLs for Paper and `?view=scene&seed=<number>` for Scene. Navigation carries the seed so the colors and starting waves stay consistent between pages. Section Home links return to `profile.html`; the scene profile also offers a return to the fluid-only entrance. Stirring and Reset are available only at the fluid-only entrance; reading pages retain the animation without playback controls. Writing remains linked from the biography, not the top navigation.

-   **Math Rendering**: Uses [MathJax](https://www.mathjax.org/).
-   **Chaewon Mode**: A typed, desktop-only easter egg. See [chaewon/README.md](chaewon/README.md).
-   **Photography Metadata**: Run `python3 generate_metadata.py` to update photo data from EXIF tags.

The image generator also creates JPEG and WebP copies in `photography/variants/`, compatible thumbnails in `photography/thumbs/`, and homepage images in `images/headshot/`. It preserves orientation and embedded color profiles. Commit these outputs with `photos.js` and the page changes. Gallery filenames include a source/settings signature so regenerated images get new cache URLs.

The gallery follows the portfolio priority in `photos.meta.json` (`order`, lower values appear earlier), pairs adjacent upright photographs at a shared height, and displays landscapes on their own. It preserves each photograph's aspect ratio and switches to a single column on phones. The gallery loads images sized for their display area and opens generated copies in its viewer. **View original** opens the full-resolution source.

Checks:

```bash
node --test tests/*.test.cjs tests/chaewon/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
```

Browser fixtures live in `tests/*.browser.html`; serve the repository root and open one, for example `tests/site-scene.browser.html` or `tests/chaewon-concert.browser.html`. The first-paint fixture needs its own server: `node tests/scene-first-paint.server.cjs`.

Image checks:

```bash
python3 -m unittest discover -s tests -p 'test_image_variants.py'
node --test tests/chaewon-images.test.cjs tests/chaewon/*.test.js
```

With Playwright installed, run `node tests/image-delivery.browser.cjs` against a local preview. Set `SITE_URL` to its address (default `http://127.0.0.1:18765`) and, if needed, `BROWSER_EXECUTABLE` to a browser executable. Set `CHECK_HOMEPAGE=1` to include homepage image checks.

## Deployment

Automatically deployed via **GitHub Pages** on push to `main`.
