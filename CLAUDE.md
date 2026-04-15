# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal academic website for Ethan Chen, deployed at https://echen347.github.io via GitHub Pages (auto-deploy on push to `main`). No build step, no package manager, no framework — plain HTML + vanilla JS styled with the remote [LaTeX.css](https://latex.vercel.app/) stylesheet. Math on the home page renders via MathJax CDN.

## Commands

- **Preview locally**: `python3 -m http.server` from the repo root, then visit `http://localhost:8000/`. A static server is fine because the site has no runtime data dependencies; you could also open any `.html` file directly as `file://`.
- **Regenerate photo metadata**: `python3 generate_metadata.py` reads EXIF from files in `photography/` (paths listed in `PHOTO_CONFIG`) and prints a JSON array to stdout. The output must be **manually pasted** into the `photoSources` variable inside `photography.html`. Requires `Pillow` and `exifread`.
- **Deploy**: `git push origin main`. GitHub Pages picks up from the root of `main`.

## Architecture

The site is a flat collection of standalone HTML pages. Each page is fully self-contained (inline `<style>` and `<script>` blocks) — no shared JS bundle. Cross-page consistency comes from all pages linking the same `latex.vercel.app/style.css` and repeating the same `<header><nav>` block (`Home / Academic / Photography`).

Pages:

- `index.html` — bio + Research (with Publications) + Contact. Hosts the landing-overlay SMC viz.
- `academic.html` — coursework lists (In Progress, Mathematics, CS/ECE). Was originally a section on `index.html`.
- `photography.html` — masonry gallery. See Photography pipeline below.
- `writing.html` — Substack post embed. Reachable only by direct URL; intentionally not in the top nav.
- `mot/index.html`, `dhmproposal/index.html` — meta-refresh redirect shims that forward to PDFs under `pdfs/`, giving clean shareable URLs like `/mot`.
- `trading.html` — distinct redirect: meta-refreshes to an IP-hosted TGT QR trading dashboard. Third-party, not part of the PDF shim family.

Pieces that span multiple files:

- **Landing-overlay SMC simulation (`index.html`)**. A full-viewport overlay runs a Sequential Monte Carlo simulation on a `<canvas>` before revealing the bio. Two classes — `Target` (moving multimodal modes of the hidden distribution) and `Particle` (samples evolving via Langevin drift + diffusion toward the nearest target) — drive an animation loop that alternates `MCMC` and `RESAMPLING` phases on a frame counter. `performResampling()` implements systematic resampling with per-mode density caps so the particle count stays bounded when users click to add modes. A `sessionStorage` flag (`introShown`) skips the overlay on return visits; the circular-arrow button in the header re-opens it. Tuning constants that matter most: `Target.speed`, the drift coefficient in `Particle.updateMCMC` (`0.001`), the weight-kernel `sigma`, and `MAX_PER_TARGET` / `MAX_PARTICLES` in `performResampling`.
- **Photography pipeline**. `photography/` holds the source JPEGs; `generate_metadata.py` is the single source of truth for which photos appear, their alt text, and their display order (`preference` field). The script's output is embedded as a JS literal in `photography.html` — it is **not** loaded at runtime, so regenerating metadata without pasting into the HTML has no effect.

## Conventions

- **Adding publications**: update the `<h3>Publications</h3>` list in `index.html`. If the paper has a hosted PDF, add a redirect shim directory mirroring `mot/` and link `/<slug>` from the list.
- **Nav updates**: changes to `<nav>` must land in all four pages (`index.html`, `academic.html`, `photography.html`, `writing.html`) — they duplicate the same block and get out of sync silently.
- **Last updated** date in `index.html`'s footer is maintained manually.
- Images referenced from HTML use root-relative paths (`/pdfs/...`, `photography/...`) — preserve this when moving files, and update both `generate_metadata.py`'s `PHOTO_CONFIG` and the embedded array in `photography.html` together.

## Explored but not shipped

- **Music-taste SMC viz.** A data-driven retargeting of the landing MCMC overlay using Spotify top-artist data. Fully designed and prototyped, then reverted as too heavy. Notes preserved in `music-viz-notes.md` — revisit if the motivation comes back.
