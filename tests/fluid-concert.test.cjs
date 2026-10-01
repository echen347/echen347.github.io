'use strict';
// Concert lighting API on the real renderer: look transitions across resize,
// reset, reduced-motion cuts, and cue replacement. The fake WebGL boundary
// records every uniform upload, as in fluid-raster.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RENDERER = process.env.FLUID_RENDERER || path.join('studies', 'fluid-prototype.js');
const source = fs.readFileSync(path.join(__dirname, '..', RENDERER), 'utf8');

function emitter(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
    emit(name, event = {}) { for (const handler of [...(listeners.get(name) || [])]) handler({ type: name, ...event }); },
    listenerCount(name) { return listeners.get(name)?.size || 0; }
  });
}

function fixture({ paused = false, seed = 812736, width = 1280, height = 800 } = {}) {
  const composes = [], displays = [];
  let program, target, textureUnit = 0, frame = null, now = 0;
  const textures = new Map();
  const size = { width, height };
  const gl = { MAX_TEXTURE_SIZE: 4096, FRAMEBUFFER_COMPLETE: 1, TEXTURE0: 100 };
  for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'DEPTH_TEST', 'BLEND',
    'TEXTURE_2D', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'LINEAR',
    'CLAMP_TO_EDGE', 'RGBA16F', 'RGBA', 'HALF_FLOAT', 'FRAMEBUFFER', 'COLOR_ATTACHMENT0', 'TRIANGLES', 'COLOR_BUFFER_BIT',
    'PIXEL_PACK_BUFFER', 'STREAM_READ', 'FLOAT', 'SYNC_GPU_COMMANDS_COMPLETE', 'ALREADY_SIGNALED', 'CONDITION_SATISFIED']) gl[name] = name;
  for (const type of ['Shader', 'Program', 'Texture', 'Framebuffer', 'VertexArray', 'Buffer']) {
    gl['create' + type] = () => ({ uniforms: {} });
    gl['delete' + type] = () => {};
  }
  gl.getExtension = () => ({});
  gl.getParameter = () => 4096;
  gl.getShaderParameter = gl.getProgramParameter = () => true;
  gl.checkFramebufferStatus = () => gl.FRAMEBUFFER_COMPLETE;
  gl.getUniformLocation = (value, name) => ({ value, name });
  gl.uniform1i = gl.uniform1f = (location, value) => { location.value.uniforms[location.name] = value; };
  gl.uniform2f = (location, x, y) => { location.value.uniforms[location.name] = [x, y]; };
  gl.uniform3f = (location, x, y, z) => { location.value.uniforms[location.name] = [x, y, z]; };
  gl.useProgram = value => { program = value; };
  gl.activeTexture = value => { textureUnit = value - gl.TEXTURE0; };
  gl.bindTexture = (type, value) => { textures.set(textureUnit, value); };
  gl.bindFramebuffer = (type, value) => { target = value; };
  gl.framebufferTexture2D = (type, attachment, textureType, texture) => { target.texture = texture; };
  gl.texImage2D = (type, level, format, w, h) => { Object.assign(textures.get(textureUnit), { width: w, height: h }); };
  gl.drawArrays = () => {
    const uniforms = structuredClone(program.uniforms);
    if (uniforms.field === 0 && 'tintA' in uniforms) composes.push(uniforms);
    if ('glowStrength' in uniforms) displays.push(uniforms);
  };
  gl.fenceSync = () => ({});
  gl.clientWaitSync = () => gl.ALREADY_SIGNALED;
  gl.getBufferSubData = (target, offset, out) => {
    for (let i = 0; i < out.length / 8; i++) {
      out[i * 8] = 10 * (i + 1); out[i * 8 + 1] = -5;
      out[i * 8 + 4] = .2; out[i * 8 + 5] = .4; out[i * 8 + 6] = .6;
    }
  };
  for (const name of ['shaderSource', 'attachShader', 'compileShader', 'linkProgram', 'bindVertexArray', 'disable',
    'texParameteri', 'viewport', 'clearColor', 'clear', 'bindBuffer', 'bufferData', 'readPixels', 'deleteSync', 'flush']) gl[name] = () => {};

  class Canvas {}
  const canvas = emitter(Object.assign(new Canvas(), {
    width: 0, height: 0, style: {}, dataset: {},
    get clientWidth() { return size.width; }, get clientHeight() { return size.height; },
    getContext: () => gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: size.width, height: size.height }),
    hasAttribute: () => true
  }));
  const media = emitter({ matches: paused });
  const window = emitter({ devicePixelRatio: 1 });
  const document = emitter({ hidden: false });
  vm.runInNewContext(source, {
    window, document, HTMLCanvasElement: Canvas, matchMedia: () => media,
    performance: { now: () => now },
    requestAnimationFrame: callback => { frame = callback; return 1; }, cancelAnimationFrame() { frame = null; },
    Math, structuredClone, Float32Array, console
  });
  const api = window.FluidConcert || window.FluidPrototype;
  const scene = api.create(canvas, { paused, randomized: true, seed, interactive: false });
  return {
    scene, canvas, window, composes, displays,
    step(frames = 1) {
      for (let i = 0; i < frames && frame; i++) { now += 1000 / 60; const run = frame; frame = null; run(now); }
    },
    resize(width, height) { size.width = width; size.height = height; window.emit('resize'); },
    lastCompose: () => composes.at(-1),
  };
}

const palette = look => [look.a.map(v => v * 1.4), look.a.map((v, i) => v * .55 + look.b[i] * .45), look.b.map(v => v * 1.14), look.mist];
const withPalette = look => ({ ...look, palette: palette(look) });
const CONCERT = withPalette({ a: [.10, .16, .95], b: [1, .08, .50], mist: [.80, .78, .92], core: [1, .93, .98],
  edge: [1.1, .30, .85], cool: [.55, .65, 1.25], warm: [1.3, .35, .85] });
const CRAZY = withPalette({ a: [.95, .03, .22], b: [1, .05, .62], mist: [.45, .03, .16], core: [1, .84, .90],
  edge: [1.4, .10, .50], cool: [1, .20, .60], warm: [1.4, .20, .40] });
const FRONT_IDLE = -9;
const close = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${label}: ${actual} vs ${expected}`));
};
const animated = (look, done) => ({ speed: .45, width: .1, edge: look.edge, done });
const finish = app => app.step(420);

test('entering the concert survives a resize mid-front and completes once', () => {
  const app = fixture();
  app.step(5);
  let calls = 0;
  const stockTint = app.lastCompose().tintA;
  app.scene.setLook(CONCERT, animated(CONCERT, () => calls++));
  app.step(60);
  const frontBefore = app.lastCompose().moodFront;
  app.resize(1000, 800);
  close(app.lastCompose().moodA, CONCERT.a, 'target after resize');
  close(app.lastCompose().tintA, stockTint, 'light ahead of the front is still stock');
  app.step(1);
  assert.ok(app.lastCompose().moodFront > frontBefore, 'the front continues instead of restarting');
  finish(app);
  assert.equal(calls, 1);
  close(app.lastCompose().tintA, CONCERT.a, 'committed tint');
  assert.equal(app.lastCompose().moodFront, FRONT_IDLE);
});

test('a song change keeps its own target through a resize mid-front', () => {
  const app = fixture();
  app.scene.setLook(CONCERT, { type: 'cut' });
  let calls = 0;
  app.scene.setLook(CRAZY, animated(CRAZY, () => calls++));
  app.step(30);
  const frontBefore = app.lastCompose().moodFront;
  app.resize(900, 900);
  close(app.lastCompose().moodA, [.95, .03, .22], 'Crazy target after resize');
  close(app.lastCompose().tintA, CONCERT.a, 'light ahead of the front is still the concert look');
  app.step(1);
  assert.ok(app.lastCompose().moodFront > frontBefore, 'the front continues instead of restarting');
  finish(app);
  assert.equal(calls, 1);
  close(app.lastCompose().tintA, CRAZY.a, 'Crazy committed');
});

test('leaving mid-exit through a resize restores the captured stock look and clears the override', () => {
  const app = fixture();
  const stock = app.scene.getLook();
  app.scene.setLook(CRAZY, { type: 'cut' });
  let calls = 0;
  app.scene.setLook(stock, animated(stock, () => { calls++; app.scene.clearLook(); }));
  app.step(30);
  app.resize(1100, 700);
  close(app.lastCompose().moodA, stock.a, 'stock target after resize');
  close(app.lastCompose().tintA, CRAZY.a, 'light ahead of the exit front is still Crazy');
  finish(app);
  assert.equal(calls, 1);
  close(app.lastCompose().tintA, stock.a, 'stock restored');
  app.scene.reset(424242);
  const fresh = fixture({ seed: 424242 }).scene.getLook();
  close(app.lastCompose().tintA, fresh.a, 'no override survives: a reset shows the new stock light');
});

test('a resize after completion leaves the committed look unchanged', () => {
  const app = fixture();
  app.scene.setLook(CONCERT, animated(CONCERT));
  finish(app);
  app.resize(800, 1000);
  close(app.lastCompose().tintA, CONCERT.a, 'after resize');
  assert.equal(app.lastCompose().moodFront, FRONT_IDLE);
});

test('a reduced-motion cut applies at once, with no front, and calls back once', () => {
  const app = fixture({ paused: true });
  let calls = 0;
  app.scene.setLook(CONCERT, { type: 'cut', done: () => calls++ });
  assert.equal(calls, 1);
  close(app.lastCompose().tintA, CONCERT.a, 'cut applied');
  assert.equal(app.lastCompose().moodFront, FRONT_IDLE);
  app.step(10);
  assert.equal(calls, 1);
});

test('rapid cue replacement calls each callback once and stale cleanup cannot clear the newer cue', () => {
  const app = fixture();
  const stock = app.scene.getLook();
  let first = 0, second = 0;
  app.scene.setLook(CONCERT, animated(CONCERT, () => first++));
  app.step(10);
  app.scene.setLook(CRAZY, animated(CRAZY, () => second++));
  assert.equal(first, 1, 'the replaced cue settles once');
  finish(app);
  assert.equal(first, 1);
  assert.equal(second, 1);
  close(app.lastCompose().tintA, CRAZY.a, 'newer cue wins');
  // Exit, then re-enter before the exit front finishes: the exit's cleanup runs
  // once, at replacement, and must not clear the re-entered concert.
  app.scene.setLook(stock, animated(stock, () => app.scene.clearLook()));
  app.step(10);
  app.scene.setLook(CONCERT, animated(CONCERT));
  finish(app);
  app.resize(1280, 720);
  close(app.lastCompose().tintA, CONCERT.a, 're-entered concert persists through a resize');
});

test('reset during the concert keeps the mood, and the stock baseline follows the new seed', () => {
  const app = fixture();
  const before = app.scene.getStockLook();
  app.scene.setLook(CONCERT, { type: 'cut' });
  app.scene.reset(424242);
  close(app.lastCompose().tintA, CONCERT.a, 'mood kept through reset');
  const expected = fixture({ seed: 424242 }).scene.getStockLook();
  const after = app.scene.getStockLook();
  close(after.a, expected.a, 'stock baseline is the new seed');
  assert.notDeepEqual(after.a, before.a, 'the seeds differ in stock light');
  app.scene.setLook(after, { type: 'cut', done: () => app.scene.clearLook() });
  close(app.lastCompose().tintA, expected.a, 'exit restores the new stock light');
});

test('reset during the exit front ends on the new seed stock light', () => {
  const app = fixture();
  const old = app.scene.getStockLook();
  app.scene.setLook(CRAZY, { type: 'cut' });
  let calls = 0;
  app.scene.setLook(app.scene.getStockLook(), animated(old, () => { calls++; app.scene.clearLook(); }));
  app.step(30);
  app.scene.reset(424242);
  const plain = value => JSON.parse(JSON.stringify(value));
  const fresh = plain(fixture({ seed: 424242 }).scene.getStockLook());
  assert.notDeepEqual(fresh.a, plain(old.a), 'the seeds differ in stock light');
  close(app.lastCompose().moodA, fresh.a, 'the exit front now heads for the new stock light');
  close(app.lastCompose().tintA, CRAZY.a, 'light ahead of the exit front is still Crazy');
  assert.notEqual(app.lastCompose().moodFront, FRONT_IDLE, 'the front continues');
  finish(app);
  assert.equal(calls, 1);
  const compose = app.lastCompose();
  close(compose.tintA, fresh.a, 'strand tint A');
  close(compose.tintB, fresh.b, 'strand tint B');
  close(compose.tintMist, fresh.mist, 'mist tint');
  assert.deepEqual(plain(app.scene.getLook()), fresh, 'committed look, cursor palette included, is the new stock');
});

test('with the concert inactive the stock light path is unchanged', () => {
  const app = fixture();
  app.step(20);
  const compose = app.lastCompose(), display = app.displays.at(-1);
  // Every concert uniform is neutral at zero: no front, no color shifts.
  assert.equal(compose.moodOn, 0);
  assert.equal(compose.moodFront, FRONT_IDLE);
  close(compose.moodEdge, [0, 0, 0], 'no front glow');
  close(compose.coreShift, [0, 0, 0], 'stock strand core');
  close(compose.moodA, compose.tintA, 'mood target equals stock');
  assert.equal(display.moodOn, 0);
  close(display.coolShift, [0, 0, 0], 'stock cool reflection');
  close(display.warmShift, [0, 0, 0], 'stock warm reflection');
});

test('a committed look shifts the shader stock colors by exactly its difference', () => {
  const app = fixture({ paused: true });
  app.scene.setLook(CONCERT, { type: 'cut' });
  const diff = (look, stock) => look.map((v, i) => v - stock[i]);
  close(app.lastCompose().coreShift, diff(CONCERT.core, [.92, .91, .85]), 'strand core shift');
  close(app.displays.at(-1).coolShift, diff(CONCERT.cool, [.82, .95, 1.08]), 'cool reflection shift');
  close(app.displays.at(-1).warmShift, diff(CONCERT.warm, [1.1, .64, .36]), 'warm reflection shift');
  assert.equal(app.lastCompose().moodOn, 0, 'a committed look needs no front');
});

test('ambientDirection matches the strand tangent the seed shader draws', () => {
  // Reference: the shader's GLSL, where mat2(c,-s,s,c)*p is column-major, so
  // q.x = c*p.x + s*p.y, and the centerline tangent maps back through mat2(c,s,-s,c).
  const app = fixture({ seed: 2024 });
  app.step(2);
  const { waveA, phase, aspect } = app.lastCompose();
  const m = Math.min(aspect, 1), angle = waveA[0] + .10 * Math.sin(phase);
  const c = Math.cos(angle), s = Math.sin(angle), f = waveA[2];
  for (const [x, y] of [[.2, .5], [.5, .5], [.8, .45], [.35, .62], [.65, .38]]) {
    const px = (x - .5) * aspect / m, py = (y - .5) / m;
    const qx = c * px + s * py;
    const slope = waveA[1] * f * (.52 * Math.cos(qx * 4 * f + .85 + phase * .3) + .525 * Math.cos(qx * 7 * f - 1) - .175 * Math.cos(qx * 5 * f + phase + 1));
    const reference = [(c - s * slope) * m / aspect, (s + c * slope) * m];
    const actual = app.scene.ambientDirection(x, y);
    const angleOf = v => Math.atan2(v[1], v[0]);
    let error = Math.abs(angleOf(actual) - angleOf(reference)) * 180 / Math.PI;
    error = Math.min(error, 360 - error);
    assert.ok(error < .5, `direction at ${x},${y} is ${error.toFixed(2)} degrees off the strands`);
  }
});

test('the mood lines stay finite where GLSL leaves pow and reversed smoothstep undefined', () => {
  // GLSL ES 3.00 defines neither pow(x,y) for x<0 nor smoothstep with edge0>=edge1;
  // some GPUs return NaN, and NaN*0 would blank the stock scene even with moodOn=0.
  const shader = source.match(/seed: `([\s\S]*?)`,\n/)[1];
  const lines = shader.match(/float (?:mood|frontDistance|edgeGlow)=[^;]+;/g);
  assert.ok(lines.length >= 2 && lines.some(l => l.startsWith('float mood=')) && lines.some(l => l.startsWith('float edgeGlow=')));
  const glsl = lines.join('\n').replace(/\bfloat\b/g, 'let').replace(/(\d)\.(?!\d)/g, '$1.0');
  const pow = (x, y) => x < 0 ? NaN : Math.pow(x, y);
  const smoothstep = (a, b, x) => {
    if (a >= b) return NaN;
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const evaluate = new Function('moodOn', 'moodFront', 'moodWidth', 'frontCoord', 'pow', 'smoothstep', 'exp', 'max',
    glsl + '\nreturn [mood, edgeGlow];');
  for (const moodOn of [0, 1]) for (const front of [-9, -1.05, 0, .6]) for (const coord of [-1.4, -.3, 0, .2, 1.1]) {
    const [mood, glow] = evaluate(moodOn, front, .1, coord, pow, smoothstep, Math.exp, Math.max);
    assert.ok(Number.isFinite(mood) && Number.isFinite(glow), `moodOn ${moodOn}, front ${front}, coord ${coord}`);
  }
});

test('probe samples convert to uv per real second and read light from the bloom texel', () => {
  const app = fixture();
  app.scene.setProbePoints([[.25, .5], [.75, .5]]);
  app.step(1);
  app.step(1);
  const probe = app.scene.readProbe();
  assert.equal(probe.samples.length, 2);
  // 1280x800 gives a 307x192 solver grid; the tick runs simulation time at .45x real time.
  close(probe.samples[0].velocity, [10 / 307 * .45, -5 / 192 * .45], 'velocity of point 0');
  close(probe.samples[1].velocity, [20 / 307 * .45, -5 / 192 * .45], 'velocity of point 1');
  close(probe.samples[1].light, [.2, .4, .6], 'bloom light');
  close(probe.samples[1].point, [.75, .5], 'sample keeps its point');
});

test('frame hooks run once per frame, after render, with the real time step', () => {
  const app = fixture();
  const seen = [];
  app.scene.onFrame(({ frames, dt, simDt }) => seen.push({ frames, dt, simDt, composes: app.composes.length }));
  const before = app.composes.length;
  app.step(3);
  assert.equal(seen.length, 3);
  assert.ok(seen[0].composes > before, 'the hook runs after that frame rendered');
  for (const call of seen) {
    assert.ok(Math.abs(call.dt - 1 / 60) < 1e-6, 'dt is real seconds: ' + call.dt);
    assert.ok(Math.abs(call.simDt - .45 / 60) < 1e-6, 'simDt is simulated seconds: ' + call.simDt);
  }
  assert.deepEqual(seen.map(call => call.frames), [1, 2, 3]);
});

test('dispose releases frame hooks, probe points, and a pending look callback', () => {
  const app = fixture();
  let hooks = 0, done = 0;
  app.scene.onFrame(() => hooks++);
  app.scene.setProbePoints([[.5, .5]]);
  app.scene.setLook(CONCERT, animated(CONCERT, () => done++));
  app.step(3);
  const seen = hooks;
  app.scene.dispose();
  app.step(30);
  assert.equal(hooks, seen, 'no hook runs after dispose');
  assert.equal(app.scene.readProbe(), null, 'probe released');
  assert.equal(done, 0, 'a disposed transition never calls back');
});
