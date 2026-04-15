# Music-taste visualization — design notes (explored, not shipped)

In April 2026 I (Ethan) designed and prototyped a data-driven version of the landing-page SMC visualization that would have pulled my Spotify listening data and used it as the target distribution the particles sample. I reverted the implementation before shipping — "too hard" — but want to keep the design on file because the idea still feels interesting. This document is that archive.

## Motivation

Two problems I was trying to solve at once:

1. **Music on the site without a loud footprint.** I wanted "listening to music" to show up as an interest, but I didn't want a dedicated `/music` page that competes with research for attention. Reading is already handled as a plain link to Goodreads; I wanted a similarly quiet treatment for music but with more substance than a link.
2. **Landing MCMC viz felt decorative.** The existing `index.html` overlay runs a Sequential Monte Carlo simulation against a synthetic moving multimodal distribution. It looks cool but doesn't *visualize anything* — it's pure demo. I'd been calling this "a little silly".

The insight: retarget the overlay so the modes come from my actual listening data. The viz becomes a visualization of something specific, which simultaneously earns its place on the landing AND makes "music on the site" live inside an element that already exists. No new page, no new nav item, no visible link. Music is represented by *the shape of the particle cloud*.

## Final approved design

- **Nav / structure** — Home / Academic / Photography. Coursework moved out of the home page to its own `academic.html`. `/writing` page kept but dropped from the nav. Bio gained "listening to music" as plain text with no hyperlink. **(These were shipped and are not reverted.)**
- **Landing overlay retargeted:**
  - 3–5 cluster modes computed from my Spotify top-artist genre tags
  - Modes positioned via MDS (on pairwise cosine distance over binary genre vectors) → k-means (k chosen by silhouette)
  - Particles sample the density via the existing Langevin + systematic resampling loop (unchanged)
  - Particle density in a region = how concentrated my listening is there
  - Targets drift slowly (`Target.speed = 0.22 * scale`, from `0.3`)
  - Click spawns a transient mode that decays after ~10 s — "what if I discovered this direction"
  - Per-mode label = top genre of the cluster (e.g. "art pop", "ambient"), rendered as small italic teal text below each blob
  - Info modal updated with new copy + a "Methodology: see refresh_taste.py" link for auditability
- **Data pipeline:**
  - `scripts/refresh_taste.py` — OAuth refresh-token exchange → `/me/top/artists?time_range=long_term&limit=50` → genre vocabulary → cosine distance matrix → MDS → k-means → normalized cluster centroids → `data/taste.json`
  - `.github/workflows/spotify-refresh.yml` — monthly cron + manual dispatch; commits and pushes updated JSON via `github-actions[bot]`
  - `data/taste.json` — served statically, fetched by the landing page at load time; empty `modes` array triggers fallback to 5 random targets
- **Abstraction principles:**
  - No track names, no artist names anywhere in the UI
  - Axes are *abstract* (MDS coords) — no "valence × energy" or "popularity × year" labels
  - The only concrete labels are the cluster genres (e.g. "ambient") — one level above track/artist

## Why I reverted

"I don't like it for some reason, I think it's too hard." The ongoing-maintenance cost plus the one-time Spotify OAuth setup plus the conceptual overhead of explaining what the viz means to visitors added up to more than the upside. The static site was simpler and fine.

## Ideas worth remembering

Things that were *good* about the design and worth keeping in mind if I ever come back to this:

- **GitHub Action + static JSON pattern.** For any static site that wants personal data to refresh periodically without a backend: one-time OAuth to stash a refresh token in GitHub secrets, then a scheduled Action that pulls data, writes JSON to the repo, and commits. Works for any auth'd data source (GitHub itself, Goodreads, Strava, etc.).
- **"Fallback on empty" design.** The landing always runs with random-target fallback when `data/taste.json` has an empty `modes` array. This means the page never looks broken while the pipeline is being set up or if the API is temporarily down. Good UX pattern.
- **Credibility through labels + methodology link.** Once I saw the abstract data-driven version, I realized *unlabeled* modes are indistinguishable from decorative random modes from the viewer's perspective. The fix: cluster-level genre labels (anonymous enough to protect privacy, specific enough to prove it's real data) + a link to the pipeline script from the info modal (proves the methodology isn't hand-waved).
- **Transient click-spawned modes.** Clicking adds a temporary mode that decays after 10 s. Reinterprets the existing click-to-add-target interaction as "what if I discovered this direction" without permanently editing the user's real taste data. Nice semantic move.
- **Three abstraction levels considered:** tracks (too on-the-nose), artists (still too concrete), clusters / taste regions (the chosen level). Good meta-question to ask for any "show my data" viz.

## Paths explored that weren't used

- **Audio features (valence × energy).** The original plan was to plot top tracks in the 2D plane defined by Spotify's `valence` and `energy` fields. Scratched because Spotify deprecated the `audio-features` and `audio-analysis` endpoints for new apps (post Nov 27, 2024). Still available to apps that had quota extensions before that date, so not all forever — but the cleaner path is to avoid them.
- **PCA vs. UMAP over all 8 audio features.** Same deprecation blocked this.
- **Popularity × release-year scatter.** Fully viable (both fields still exposed for new apps), less mathy-looking than genre-MDS. Good backup if the genre route stops working.
- **Every-Noise-at-Once genre coordinates.** glenmcdonald's pre-computed 2D layout of ~6000 Spotify genres. Lovely pre-computed data but creates an external dependency; I preferred to compute MDS locally from my own top-artists set.
- **Editorial page ("5 albums I return to").** A manually curated static page, no API. The "writing page is dead" risk applied strongly — I'd probably stop updating it, and then music-on-the-site would look abandoned.
- **Just a profile link in the bio.** Zero-effort version. Rejected because the API-data angle was the interesting part.

## Files involved (all reverted/deleted)

- `index.html` — JS retarget (fetch call, data-driven `initTargets`, transient modes, label rendering, info modal copy)
- `scripts/refresh_taste.py` — Spotify → MDS → k-means → JSON
- `scripts/requirements.txt` — `requests`, `numpy`, `scikit-learn`
- `.github/workflows/spotify-refresh.yml` — monthly cron + manual dispatch
- `data/taste.json` — static data feed with `modes[].{x_norm, y_norm, weight, label}` + `generated_at`

## Non-obvious gotchas from the implementation

- **Click-spawned targets must be unlabeled.** The landing code checks `if (this.label)` before rendering — both random-fallback targets and click-spawned transient targets naturally have no label, so they visually signal "not real data." That asymmetry is intentional; preserve it if you resurrect.
- **`nearestTargetIndex` on particles becomes stale** when a transient mode expires and gets filtered out. `animate()` resets these indices to `-1` after any mode removal; `updateMCMC` refreshes them on the next frame. Don't skip that reset.
- **`k-means` `k` can jitter** between 3 / 4 / 5 month-to-month if chosen by silhouette. If the refresh cadence feels visually unstable, hard-code `k`.
- **Spotify refresh tokens don't expire under normal use** but can be revoked if the user changes their password or explicitly revokes access. The Action will start failing silently if that happens — worth wiring a failure notification before relying on it.

## One-line epitaph

*Prototype was good. Wasn't sure it carried its weight.*
