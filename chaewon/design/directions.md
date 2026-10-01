# Visual directions

Status: decided 2026-09-30. Ethan chose the in-scene concert from the fluid and Chaewon brainstorm (`docs/notes/2026-09-30-fluid-and-chaewon-brainstorm.md`), closest to direction C below. The options stay here for reference.

## Current experience

The source creates nine floating photo bubbles, hover enlargement, click-to-pop heart bursts, four perimeter marquees, animated rainbow text wallpaper, a first-activation reveal, cursor hearts, content-card tilt, heading jokes, and an idle popup. Typed song names trigger short effects: CRAZY uses red and black flashes plus shaking, FEARLESS spawns petals, ANTIFRAGILE spawns concert beams, EASY adds photo glow, and PERFECTNIGHT spawns stars.

The homepage now loads a luminous fluid scene. Content pages support Scene and Paper appearances. A shared setting for photos, hearts, lighting, and song effects could connect the mode's independent decorative layers.

Ethan likes Gargantua's ethereal light and flowing rings, cyberpunk imagery, glass materials, animation, and playful surprises. Recent feedback on the separate fluid experiment: click vortices look too large and dragging leaves a band that looks too uniform. These observations do not authorize changes to the shared renderer here.

## A. Orbital concert

A pearl-white ring tilts around a dark center. Pink and violet light travels along the rim. Three or four glass photocards orbit at different depths and sometimes pass behind the ring. Hearts briefly join the orbit before dispersing. One perimeter ticker keeps the fan atmosphere.

Tap a card to bring it forward, then flip it for a joke or song hint. Provide keyboard controls for the same actions. The mobile version needs generous, stable targets; bringing a card forward should stop its movement while the visitor interacts.

Song triggers change this shared space: PERFECTNIGHT brings blue starlight, ANTIFRAGILE introduces crossing beams, EASY warms the ring to champagne, and CRAZY sends a short magenta chase around it. FEARLESS could add a soft petal halo. These mappings are suggestions.

This direction connects Ethan's ring and light preferences to the existing photo and heart interactions. A separate Chaewon scene could leave the fluid renderer untouched. Convincing depth and glass cost more than flat overlays. Start with reflective edges, translucent frames, and restrained glow; assess actual refraction after a visual preview. Do not imply physical lensing unless the renderer supports it.

## B. Neon backstage

A cyberpunk dressing room uses smoked glass, cyan and pink edge lighting, a mirrored floor, and an illuminated CHAEWON sign. Photocards rest on a shallow shelf. Tap to flip a card; discover a hidden heart to unlock a playful backstage pass.

Song triggers alter the room's signage and lighting, making discoveries feel like alternate concert sets. Stable cards suit mobile interaction. This direction needs more environmental art and careful reflections so the photos remain the focus. Approximate reflections could reduce rendering cost.

## C. Photocard dream

A few translucent cards drift through the luminous homepage scene with tiny heart constellations and soft halos. Tap a card to gather nearby hearts into a frame, then release them. Song triggers change card accents and surrounding decorative light.

This direction most closely continues the homepage. A small number of cards could keep the extra rendering cost low. Actual current-following motion requires coordination with the fluid work. Independent curved paths can suggest drift but do not follow the simulation. Card interaction must take priority over canvas dragging at the same location.

## Shared behavior

- Entrance scene: full visual experience, with a visible exit and usable navigation.
- Content in Scene: stable text, restrained edge lighting, and an optional tucked-away photocard. Avoid moving decorations over text or gallery controls.
- Content in Paper: preserve its reading appearance; use small static fan accents if desired.
- Reduced motion: static composition, tappable cards, immediate mood changes, no orbit, shake, or strobe. Hidden triggers remain usable.
- Background tabs and open photo viewers: suspend decorative animation.
- Mobile: none. Chaewon Mode is desktop-only as of 2026-09-30.
- Sound: no automatic playback. Audio would need a separate design decision.

## Choice

Ethan chose the in-scene concert on 2026-09-30. [concert.md](concert.md) describes the integrated version.
