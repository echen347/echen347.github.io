// Pure concert logic, from the production module chaewon/concert-core.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../chaewon/concert-core.js');

test('every cue has an announced label, a finite look, and a front speed', () => {
  for (const [name, cue] of Object.entries(core.CUES)) {
    assert.ok(core.TRIGGERS.includes(name), name + ' is typeable');
    assert.match(cue.label, /^Lit for /, name + ' announcement says what changed');
    const look = core.lookFor(name);
    for (const key of ['a', 'b', 'mist', 'core', 'edge', 'cool', 'warm']) {
      assert.equal(look[key].length, 3, name + '.' + key);
      for (const v of look[key]) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1.6, name + '.' + key + ' in range');
    }
    assert.equal(look.palette.length, 4);
    assert.ok(cue.speed > 0 && cue.speed <= 1.2, name + ' speed');
  }
});

test('every song hint on a card back names a real trigger', () => {
  const triggers = new Set(core.TRIGGERS);
  for (const back of core.BACKS) {
    assert.ok(['theorem', 'lemma', 'definition'].includes(back.kind));
    assert.ok(back.statement.length <= 72, 'Statement fits a card: ' + back.statement);
    for (const [, word] of back.statement.matchAll(/Typing ([a-z]+)/g)) assert.ok(triggers.has(word), word);
    for (const [, first, last] of back.statement.matchAll(/, ([a-z]+),? or ([a-z]+)/g)) {
      assert.ok(triggers.has(first), first);
      assert.ok(triggers.has(last), last);
    }
  }
});

test('a riding card follows probed flow plus ambient drift', () => {
  const card = { x: .5, y: .5, opacity: 1 };
  const next = core.stepCard(card, { velocity: [.02, .01] }, [1, 0], 1, core.DEFAULT_BOUNDS, .02);
  assert.ok(Math.abs(next.x - (.5 + .02 + .02)) < 1e-9);
  assert.ok(Math.abs(next.y - (.5 + .01)) < 1e-9);
  const still = core.stepCard(card, null, [0, 0], 1, core.DEFAULT_BOUNDS, .02);
  assert.deepEqual([still.x, still.y], [.5, .5], 'No probe yet means no jump');
});

test('cards stay inside the stage band and fade at the edges instead of popping', () => {
  const bounds = { top: .72, bottom: .16, half: .044 };
  const high = core.stepCard({ x: .5, y: .70, opacity: 1 }, { velocity: [0, .2] }, [0, 0], 1, bounds, 0);
  assert.equal(high.y, .72, 'Clamped below the title and nav');
  const low = core.stepCard({ x: .5, y: .2, opacity: 1 }, { velocity: [0, -.2] }, [0, 0], 1, bounds, 0);
  assert.equal(low.y, .16, 'Clamped above the footer line');
  assert.ok(core.edgeOpacity(.5) === 1);
  assert.ok(core.edgeOpacity(1.0) < .5 && core.edgeOpacity(1.0) > 0);
  const wrapped = core.stepCard({ x: 1.1, y: .5, opacity: 0 }, { velocity: [.05, 0] }, [0, 0], 1, bounds, 0);
  assert.ok(wrapped.x < 0, 'A card that has faded out re-enters from the other side');
  assert.equal(core.edgeOpacity(wrapped.x), 0, 'and re-enters invisible');
  // Phone cards are wider relative to the screen, so their fade starts earlier.
  assert.ok(core.edgeOpacity(.9, .1) < core.edgeOpacity(.9, .044));
  assert.ok(core.edgeOpacity(1 - .044, .044) < .5, 'Half faded by the time the card touches the edge');
});

test('start points pick the brightest separated spots on the band', () => {
  const samples = [
    { point: [.1, .5], light: [.9, .9, .9] },
    { point: [.12, .5], light: [.95, .9, .9] },
    { point: [.5, .45], light: [.6, .6, .6] },
    { point: [.8, .55], light: [.5, .5, .5] },
    { point: [.5, .9], light: [.0, .0, .0] },
  ];
  const picked = core.pickStartPoints(samples, 3, .2);
  assert.equal(picked.length, 3);
  assert.deepEqual(picked[0], [.12, .5]);
  assert.ok(!picked.some(p => p[0] === .1 && p[1] === .5), 'A point too close to a brighter pick is skipped');
  assert.ok(!picked.some(p => p[1] === .9), 'Dark space is last resort');
});

test('the forward card stays fully on screen', () => {
  const view = { width: 1280, height: 800 };
  const r = core.forwardRect({ cx: 1270, cy: 10 }, { width: 190, height: 294 }, view, 16);
  assert.ok(r.left >= 16 && r.top >= 16 && r.left + 190 <= 1264 && r.top + 294 <= 784);
});

test('start points never share a column, so a short window cannot stack two cards', () => {
  // The controller's probe grid at 1280x800, with a bright strand down the middle column.
  const samples = [];
  for (const y of [.298, .425, .552]) for (let col = 0; col < 5; col++) {
    samples.push({ point: [.14 + col * .18, y], light: col === 2 ? [.9, .9, .9] : [.2, .2, .2] });
  }
  const picked = core.pickStartPoints(samples, 3, .22);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map(p => p[0])).size, 3, 'one card per column: ' + JSON.stringify(picked));
  // A short band leaves no separated spots, so the second pass picks; it must keep columns apart too.
  const short = [];
  for (const y of [.34, .365, .39]) for (let col = 0; col < 5; col++) {
    short.push({ point: [.14 + col * .18, y], light: col === 1 || col === 3 ? [.9, .9, .9] : [.2, .2, .2] });
  }
  const tight = core.pickStartPoints(short, 3, .22);
  assert.equal(new Set(tight.map(p => p[0])).size, 3, 'second pass keeps one card per column: ' + JSON.stringify(tight));
});
