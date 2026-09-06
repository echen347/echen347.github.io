# Personal Academic Website

Source code for my personal academic website, available at [echen347.github.io](https://echen347.github.io).

## Overview

This site is built with **plain HTML** and **Vanilla JavaScript**, styled with [LaTeX.css](https://latex.vercel.app/) for a clean, academic aesthetic.

### Features

-   **Interactive SMC Visualization**: A background simulation of a **Sequential Monte Carlo** algorithm tracking a moving multimodal distribution.
-   **Research**: Highlights my work on the mathematical foundations of machine learning.
-   **Photography**: A photography gallery (`photography.html`) with paired images and full-width landscapes.
-   **Writing**: My Substack posts (`writing.html`).

## Development

The site is lightweight with no build step.

-   **Math Rendering**: Uses [MathJax](https://www.mathjax.org/).
-   **Photography Metadata**: Run `python3 generate_metadata.py` to update photo data from EXIF tags.


The gallery follows the portfolio priority in `photos.meta.json` (`order`, lower values appear earlier). It pairs adjacent upright photographs at a shared height, gives landscapes their own rows, and preserves each aspect ratio. Phones show one column. Keyboard navigation and the viewer follow the same sequence.

Run `python3 generate_metadata.py` after editing the selection or metadata. Commit `photos.js`, `photos.meta.json`, the selected originals, and the generated files in `photography/thumbs/` and `photography/variants/`. JPEG and WebP variants load at a suitable display size; **View original** opens the full-resolution source.

Photography checks:

```bash
python3 -m unittest discover -s tests -p 'test_image_variants.py'
node tests/image-delivery.browser.cjs
```

The browser check requires Playwright and a local preview. Set `SITE_URL` to its address (default `http://127.0.0.1:18765`) and, if needed, `BROWSER_EXECUTABLE` to a browser executable.

## Deployment

Automatically deployed via **GitHub Pages** on push to `main`.
