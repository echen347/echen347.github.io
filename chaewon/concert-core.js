// Chaewon concert: pure logic shared by concert-mode.js and node tests. No DOM, no WebGL.
// chaewon.js owns typed triggers; TRIGGERS here lists the cue names and validates the card-back song hints.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ConcertCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TRIGGERS = ['chaewon', 'perfectnight', 'crazy', 'easy', 'antifragile', 'fearless'];

  // Stage light presets. a/b: strand tints along the band; mist: haze between
  // strands; core: strand highlight; edge: the front's leading glow; cool/warm:
  // the two studio reflections on the glass surface.
  const PRESETS = {
    chaewon: { a: [.10, .16, .95], b: [1, .08, .50], mist: [.80, .78, .92], core: [1, .93, .98],
      edge: [1.1, .30, .85], cool: [.55, .65, 1.25], warm: [1.3, .35, .85] },
    perfectnight: { a: [.20, .12, .90], b: [.55, .22, 1], mist: [.70, .76, 1], core: [.86, .90, 1.08],
      edge: [.50, .60, 1.3], cool: [.60, .72, 1.3], warm: [.85, .50, 1.2] },
    crazy: { a: [.95, .03, .22], b: [1, .05, .62], mist: [.45, .03, .16], core: [1, .84, .90],
      edge: [1.4, .10, .50], cool: [1, .20, .60], warm: [1.4, .20, .40] },
    easy: { a: [.85, .66, .44], b: [1, .80, .62], mist: [.95, .90, .86], core: [1, .96, .90],
      edge: [1, .85, .60], cool: [1, .95, .90], warm: [1.2, .90, .60] },
    antifragile: { a: [.32, .36, .42], b: [.08, .72, .95], mist: [.60, .66, .72], core: [.95, 1, 1.06],
      edge: [.40, .90, 1.2], cool: [.70, .92, 1.25], warm: [.90, .92, 1] },
    fearless: { a: [.95, .55, .70], b: [1, .78, .86], mist: [.96, .90, .94], core: [1, .97, .98],
      edge: [1.2, .60, .80], cool: [1, .85, .95], warm: [1.25, .70, .80] },
  };

  // Front speed is in strand-axis units per second; the band spans about 2.1.
  const CUES = {
    chaewon: { label: 'Lit for Chaewon', speed: .45, width: .10 },
    perfectnight: { label: 'Lit for Perfect Night', speed: .40, width: .12 },
    crazy: { label: 'Lit for Crazy', speed: 1.1, width: .06 },
    easy: { label: 'Lit for Easy', speed: .22, width: .18 },
    antifragile: { label: 'Lit for Antifragile', speed: .70, width: .05 },
    fearless: { label: 'Lit for Fearless', speed: .35, width: .14 },
  };

  function lookFor(name) {
    const p = PRESETS[name];
    if (!p) throw new Error('Unknown cue: ' + name);
    const copy = v => [...v];
    // Pointer and vortex dye take the same colors, derived like the renderer's own palette.
    const palette = [p.a.map(v => v * 1.4), p.a.map((v, i) => v * .55 + p.b[i] * .45), p.b.map(v => v * 1.14), copy(p.mist)];
    return { a: copy(p.a), b: copy(p.b), mist: copy(p.mist), core: copy(p.core), edge: copy(p.edge),
      cool: copy(p.cool), warm: copy(p.warm), palette };
  }

  // Card backs use the site's own LaTeX.css environments.
  const BACKS = [
    { kind: 'theorem', statement: 'Kim Chaewon leads LE SSERAFIM.', proof: 'Watch any stage.' },
    { kind: 'lemma', statement: 'Typing perfectnight turns the stage violet.', proof: 'Type it.' },
    { kind: 'definition', statement: 'A FEARNOT is anyone still here for the encore.' },
    { kind: 'lemma', statement: 'Typing crazy turns every strand magenta.', proof: 'Left to the reader.' },
    { kind: 'theorem', statement: 'Typing easy, antifragile, or fearless relights the stage.', proof: 'Three cases, each by hand.' },
  ];

  // Uv coordinates with y up, matching the renderer. Top and bottom keep cards
  // between the header and the footer line; half is the card's half-width in uv.
  const DEFAULT_BOUNDS = { top: .72, bottom: .16, half: .044 };

  // A card finishes fading just as its far edge leaves the screen, so it is
  // never visibly cut off at full opacity. Narrow screens get a wider ramp.
  function edgeOpacity(x, half = DEFAULT_BOUNDS.half) {
    const gone = half * .2, solid = half + .06;
    const ramp = t => Math.max(0, Math.min(1, t));
    return Math.min(ramp((x + gone) / (solid + gone)), ramp((1 + gone - x) / (solid + gone)));
  }

  function stepCard(card, sample, ambient, dt, bounds, drift) {
    const v = sample ? sample.velocity : [0, 0];
    const half = bounds.half ?? DEFAULT_BOUNDS.half, wrap = half * .2 + .01;
    let x = card.x + (v[0] + ambient[0] * drift) * dt;
    let y = card.y + (v[1] + ambient[1] * drift) * dt;
    y = Math.max(bounds.bottom, Math.min(bounds.top, y));
    // Leave through a fade, then re-enter invisible from the far side.
    if (x > 1 + wrap) x = -wrap;
    else if (x < -wrap) x = 1 + wrap;
    return { ...card, x, y, opacity: edgeOpacity(x, half) };
  }

  const luminance = ([r, g, b]) => .2126 * r + .7152 * g + .0722 * b;

  // One card per column: two cards that share an x would land on one spot
  // whenever a short window clamps them to the same height.
  function pickStartPoints(samples, count, minDistance) {
    const ranked = [...samples].sort((p, q) => luminance(q.light) - luminance(p.light));
    const picked = [];
    const freeColumn = s => picked.every(p => p[0] !== s.point[0]);
    for (const s of ranked) {
      if (picked.length === count) break;
      if (freeColumn(s) && picked.every(p => Math.hypot(p[0] - s.point[0], p[1] - s.point[1]) >= minDistance)) picked.push([...s.point]);
    }
    for (const s of ranked) {
      if (picked.length === count) break;
      if (freeColumn(s)) picked.push([...s.point]);
    }
    return picked;
  }

  function forwardRect(center, size, view, margin) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    return {
      left: clamp(center.cx - size.width / 2, margin, view.width - margin - size.width),
      top: clamp(center.cy - size.height / 2, margin, view.height - margin - size.height),
    };
  }

  return { TRIGGERS, PRESETS, CUES, lookFor, BACKS, DEFAULT_BOUNDS, edgeOpacity, stepCard,
    pickStartPoints, forwardRect };
});
