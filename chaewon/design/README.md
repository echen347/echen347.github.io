# Chaewon visual upgrade

Updated: 2026-10-01.

Status: the in-scene concert is integrated on the homepage entrance and documented in [concert.md](concert.md). The brainstorm below predates it and remains historical.

## Implementation handoff

The plan `docs/superpowers/plans/2026-10-01-website-release-handoff.md` (Website release fixes and Chaewon integration) contains the Oct 1 review findings, exact checkout paths, retained requirements, implementation tasks, and verification checklist for Claude Code. It covers both resize defects, release assets, and integration with the current fluid renderer. No staging, commits, or pushes without Ethan's separate approval.

Latest production UI decision (Oct 1, 02:44 HKT): the entrance footer contains only Reset. Remove the preview invitation and preview-only controls; keep Chaewon as a hidden typed trigger. The handoff also includes the follow-up review's coarse-startup listener defect and regression cases.

The isolated preview that preceded integration has been retired; its design notes now live in [concert.md](concert.md).

## Ideas

[Visual directions](directions.md) contains three options, visitor interactions, and tradeoffs.

The current runtime lives in [../chaewon.js](../chaewon.js) and [../chaewon.css](../chaewon.css). The April [design spec](../../docs/superpowers/specs/2026-04-22-chaewon-mode-design.md) and [implementation plan](../../docs/superpowers/plans/2026-04-22-chaewon-mode.md) provide historical context; inspect current source before relying on them.

Keep new design decisions in this folder. The three directions remain historical alternatives. Use [concert.md](concert.md) for the current design; do not restart direction selection from this brainstorm.

## Decisions

- 2026-09-30: Ethan chose the in-scene concert direction; [concert.md](concert.md) describes the integrated version.
- 2026-09-30: Chaewon Mode is desktop-only. It never starts on devices whose primary pointer is coarse, and the mobile heart hunt is archived in [../archive/mobile-hunt.md](../archive/mobile-hunt.md).
- Preserve hearts, photos, hidden song triggers, and playful fan humor.
- Keep reading pages usable and respect reduced motion.
- Preserve the current shared fluid interaction work when porting the concert's additive APIs.
- Do not publish, push, or commit without Ethan's explicit authorization.

## Working boundaries

The repository contains unrelated local changes, including existing edits to `chaewon.js`. Inspect current changes before editing and preserve unrelated work. Keep runtime files and assets in their existing locations.

The homepage integration lives in `index.html`, `studies/homepage-preview.js`, and `studies/homepage-preview.css`. The shared renderer is `studies/fluid-prototype.js`. Decorative assets use `images/chaewon/manifest.json`; existing mode checks live in `tests/chaewon/`.

The concert lives in `chaewon/concert-core.js`, `chaewon/concert-mode.js`, and `chaewon/concert.css`; `chaewon.js` dispatches the typed trigger to it.
