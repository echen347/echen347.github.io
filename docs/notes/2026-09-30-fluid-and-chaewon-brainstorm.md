# Fluid and Chaewon brainstorm

Saved September 30, 2026 (Hong Kong time).

Status: working ideas from this chat, not an approved implementation plan. The smaller-vortex and revised-drag proposals have not been implemented. Saving this note does not authorize website edits or publishing.

## Direction and constraints

Ethan likes Gargantua's ethereal light, flowing rings, glass-like materials, cyberpunk imagery, and mathematical forms. Research references should remain subtle. Photography can contribute to the artwork, but the supplied Hong Kong image is not a required background.

The scene should feel good both untouched and during interaction. Preserve continuous strands, avoid aliasing and faint square light artifacts, and let disturbed material evolve without snapping back to its starting shape. Keep the interface sparse. Content pages retain passive backgrounds and a separate Paper appearance.

## Implemented local baseline

- Mouse hover does not stir. Holding the primary button and dragging does.
- A click or tap creates a vortex. Touch dragging and keyboard arrows remain available.
- The entrance has Reset, without visible instructions or Pause. Reduced motion and automatic background suspension remain supported.
- Brightness travels along the white strands without animating their underlying geometric phase.
- Profile, Academic, Photography, and Writing backgrounds remain non-interactive.

These changes are local. This chat has not pushed them.

## Fluid feedback and diagnosis

Ethan's latest feedback: the click vortex is too large, and dragging produces an overly uniform ribbon with repeated soft lobes. Earlier feedback also asked for more depth and luminosity.

The current drag brush deposits a constant-width band of dye and applies a fixed force magnitude along each segment. Mouse force is 110, touch force is 130, and the base brush radius parameter is 0.00028. This uniform input helps explain the ribbon. The screenshot alone does not establish a solver defect.

The white strands already respond through a transported deformation map. Dragging can therefore bend the existing light without adding a thick layer of colored dye. A faint tracer can still make a gesture visible over empty background.

## Proposed fluid interaction changes

1. **Smaller click vortices.** Try half the current radius coefficient, from 0.12 to 0.06, and reduce spin from 0.9 to about 0.45-0.55. These are starting values for comparison, not approved defaults. Shrinking radius alone preserves peak tangential speed in the current formula and increases local shear.
2. **Stir more, paint less.** Make deformation of the existing luminous material the main response. Add less dye, with a narrower tracer. Separate the force radius from the dye radius so a gentle wake need not paint a thick band.
3. **Gesture-sensitive wakes.** Let filtered speed and curvature affect bounded force and width. Explore thin trails for quick sweeps and small curls around slower turns. Preserve continuous segment integration rather than adding random jitter or discrete dots.

Compare slow and fast gestures, straight and curved paths, sparse and dense input events, clicks near edges, and untouched playback. Tests should preserve sampling-rate independence without requiring all gesture speeds to produce the same force. Check touch, release/cancel, Reset, reduced motion, and passive content pages too.

## Fluid lighting ideas

- **Liquid light:** luminous threads stretch around vortices, pass behind darker folds, and reappear as concentrated highlights. Keep some areas nearly transparent.
- **Depth and reflections:** distinguish front and rear folds, with dimmer light behind and sharper reflective edges in front.
- **Glass membranes:** let some threads gather into a thin translucent sheet, somewhere between smoke, silk, and molten glass. Judge this with a visual comparison before committing to it.

The current renderer uses a 2D fluid simulation with procedural light and glass-like shading. A full 3D fluid or ray-traced volume would be a separate, larger investigation, not a prerequisite for these visual experiments.

## Chaewon mode ideas

The current mode adds floating photo bubbles, hearts, marquees, and song-name triggers. Its photo bubbles move independently of the fluid. The proposed direction is an alternate atmosphere within the same scene.

- **Secret concert lighting:** activation sends a pearl-and-neon color front through the existing flow. Explore black, pearl, electric pink, and blue stage-like lighting.
- **Photocards in the current:** replace or supplement the bouncing circles with two or three glass-edged photocards that drift with the flow and catch its lighting. Clicking reveals a crisp image; keep faces recognizable.
- **Song-triggered moods:** candidate treatments include violet ribbons for Perfect Night, tangled neon for Crazy, dark chrome or temporary mirrored facets for Antifragile, and slow pearlescent flow for Easy. These are visual suggestions, not claims about the songs or approved presets.

Keep the playful fan character. Avoid autoplay audio and preserve readable content pages. Resolve competing input layers: current bubbles intercept clicks above the canvas, while hover hearts follow a different convention from hold-to-stir.

Preferred discussion sequence: settle the fluid interaction, then explore concert lighting, followed by current-driven photocards. No final visual direction has been selected.

## Continuation pointers

- Fluid implementation: [fluid-prototype.js](../../studies/fluid-prototype.js).
- Site controller: [homepage-preview.js](../../studies/homepage-preview.js).
- Existing mode: [chaewon.js](../../chaewon/chaewon.js) and [chaewon.css](../../chaewon/chaewon.css).
- Earlier Chaewon design: [April 22 spec](../superpowers/specs/2026-04-22-chaewon-mode-design.md).
- Separate Chaewon brainstorming chat created from this discussion: `01a0f11d-9eb9-7683-880a-0ffe9fd3e009`. It received read-only instructions. This note does not incorporate any later discussion in that chat.

No implementation, commit, or push accompanies this note.
