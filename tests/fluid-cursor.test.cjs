const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'studies', 'fluid-prototype.js'), 'utf8');

function emitter(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn({ preventDefault() {}, ...event }); }
  });
}

function fixture(options = {}) {
  const splats = [], vortices = [], lights = [], fields = [], captures = [], calls = { draws: 0, clears: 0 };
  let program, frame;
  const gl = { MAX_TEXTURE_SIZE: 4096, FRAMEBUFFER_COMPLETE: 1, TEXTURE0: 100 };
  for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'DEPTH_TEST', 'BLEND',
    'TEXTURE_2D', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'LINEAR',
    'CLAMP_TO_EDGE', 'RGBA16F', 'RGBA', 'HALF_FLOAT', 'FRAMEBUFFER', 'COLOR_ATTACHMENT0', 'TRIANGLES', 'COLOR_BUFFER_BIT']) gl[name] = name;
  for (const type of ['Shader', 'Program', 'Texture', 'Framebuffer', 'VertexArray']) gl['create' + type] = () => ({ shaders: [], uniforms: {} });
  for (const type of ['Shader', 'Program', 'Texture', 'Framebuffer', 'VertexArray']) gl['delete' + type] = () => {};
  gl.getExtension = () => ({});
  gl.getParameter = () => 4096;
  gl.shaderSource = (shader, text) => { shader.source = text; };
  gl.attachShader = (target, shader) => { target.shaders.push(shader); };
  gl.getShaderParameter = gl.getProgramParameter = () => true;
  gl.getUniformLocation = (target, name) => ({ target, name });
  gl.uniform1i = gl.uniform1f = (location, value) => { location.target.uniforms[location.name] = value; };
  gl.uniform2f = (location, x, y) => { location.target.uniforms[location.name] = [x, y]; };
  gl.uniform3f = (location, x, y, z) => { location.target.uniforms[location.name] = [x, y, z]; };
  gl.useProgram = value => { program = value; };
  gl.drawArrays = () => {
    calls.draws++;
    if (program.shaders.some(shader => shader.source?.includes('uniform vec2 point;')))
      splats.push(structuredClone(program.uniforms));
    if (program.shaders.some(shader => shader.source?.includes('uniform float spin;')))
      vortices.push(structuredClone(program.uniforms));
    if (program.shaders.some(shader => shader.source?.includes('uniform int field;')) && program.uniforms.field === 0)
      lights.push(structuredClone(program.uniforms));
    if (program.shaders.some(shader => shader.source?.includes('uniform int field;')) && program.uniforms.field === 1)
      fields.push(structuredClone(program.uniforms));
  };
  gl.checkFramebufferStatus = () => gl.FRAMEBUFFER_COMPLETE;
  for (const name of ['bindVertexArray', 'disable', 'compileShader', 'linkProgram', 'bindTexture', 'texParameteri',
    'texImage2D', 'bindFramebuffer', 'framebufferTexture2D', 'activeTexture', 'viewport', 'clearColor', 'clear']) gl[name] = () => {};
  gl.clear = () => { calls.clears++; };
  class Canvas {}
  const canvas = emitter(Object.assign(new Canvas(), {
    width: 1000, height: 500, clientWidth: 1000, clientHeight: 500, style: {}, dataset: {},
    getContext: () => gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
    hasAttribute: () => false,
    setPointerCapture(id) { captures.push(id); }
  }));
  const media = emitter({ matches: true });
  const window = emitter({ devicePixelRatio: 1 });
  const document = emitter({ hidden: false });
  vm.runInNewContext(source, {
    window, document, HTMLCanvasElement: Canvas, matchMedia: () => media,
    performance: { now: () => 0 },
    requestAnimationFrame: callback => { frame = callback; return 1; },
    cancelAnimationFrame() { frame = null; },
    Math, structuredClone
  });
  const scene = window.FluidPrototype.create(canvas, { paused: false, ambient: false, ...options });
  const down = (x, y = 250, pointerId = 1, pointerType = 'mouse', button = 0) =>
    canvas.emit('pointerdown', { pointerId, pointerType, clientX: x, clientY: y, button, buttons: button === 0 ? 1 : 2 });
  const move = (x, y = 250, pointerId = 1, pointerType = 'mouse', buttons = 1) =>
    canvas.emit('pointermove', { pointerId, pointerType, clientX: x, clientY: y, buttons });
  return { canvas, window, document, scene, splats, vortices, captures, lights, fields, calls, move, down,
    step(now = 16) {
      if (!frame) return false;
      const callback = frame; frame = null; callback(now); return true;
    } };
}

function dyeSplats(app) {
  return app.splats.filter(splat => splat.color[2] !== 0);
}

function velocitySplats(app) {
  return app.splats.filter(splat => splat.color[2] === 0);
}

test('vortex dye remains finite inside and outside its crescent on GLSL implementations', () => {
  const shader = source.match(/vortex: `([\s\S]*?)`,/)[1];
  const expressions = shader.match(/float (?:edge|crescent)=[^;]+;/g).join('\n').replace(/\bfloat\b/g, 'let');
  const profile = new Function('r2', 'sqrt', 'exp', 'pow', expressions + '\nreturn crescent;');
  // GLSL does not define pow for a negative base, even with an integer exponent.
  const glslPow = (base, exponent) => base < 0 ? NaN : Math.pow(base, exponent);
  for (const radius of [0, .01, .25, .51, .52, .7, 1, 2]) {
    const density = profile(radius * radius, Math.sqrt, Math.exp, glslPow);
    assert.ok(Number.isFinite(density) && density >= 0 && density <= 1, 'Radius ' + radius);
  }
});

test('mouse hover and a held button that started outside the canvas do not stir', () => {
  const app = fixture();
  const before = { ...app.calls };
  app.move(100, 250, 1, 'mouse', 0);
  app.move(700, 250, 1, 'mouse', 0);
  app.move(800);
  assert.deepEqual(app.calls, before);
  assert.equal(app.canvas.dataset.interactions, '0');
});

test('a primary click adds one localized vortex and visible dye without a drag', () => {
  const app = fixture();
  app.down(400, 150);
  assert.equal(app.canvas.dataset.interactions, '1');
  assert.equal(app.vortices.length, 2, 'One velocity pass and one dye pass');
  const [velocity, dye] = app.vortices;
  assert.deepEqual(velocity.center, [.4, .7]);
  assert.equal(velocity.velocityPass, 1);
  assert.ok(velocity.spin > 0 && velocity.spin <= .55, 'A click adds a gentle impulse');
  const radiusPixels = velocity.radius * app.canvas.height;
  assert.ok(radiusPixels >= 20 && radiusPixels <= 35,
    'A click stays within a 20–35px radius on a 500px-short-edge canvas');
  assert.equal(dye.velocityPass, 0);
  assert.ok(dye.color.some(value => value > 0));
  assert.deepEqual(app.captures, [1]);
  app.canvas.emit('pointerup', { pointerId: 1 });
  app.move(800, 250, 1, 'mouse', 0);
  assert.equal(app.canvas.dataset.interactions, '1');
  assert.equal(app.splats.length, 0);
});

test('secondary clicks and unheld movement cannot start or continue a stroke', () => {
  const app = fixture();
  app.down(100, 250, 1, 'mouse', 2);
  app.move(200, 250, 1, 'mouse', 2);
  assert.equal(app.canvas.dataset.interactions, '0');
  app.down(300);
  app.move(400, 250, 1, 'mouse', 0);
  app.move(500);
  assert.equal(app.canvas.dataset.interactions, '1');
  assert.equal(app.splats.length, 0);
});

test('cancel, capture loss, window blur, and visibility changes discard held strokes', () => {
  for (const end of ['pointercancel', 'lostpointercapture', 'blur', 'visibilitychange']) {
    const app = fixture();
    app.down(100);
    app.move(200);
    if (end === 'blur') app.window.emit(end);
    else if (end === 'visibilitychange') {
      app.document.hidden = true;
      app.document.emit(end);
      app.document.hidden = false;
      app.document.emit(end);
    } else app.canvas.emit(end, { pointerId: 1 });
    app.move(800);
    assert.equal(app.canvas.dataset.interactions, '2', end);
    assert.equal(dyeSplats(app).length, 1, end);
  }
});

test('homepage Space does not pause, while arrow keys still stir', () => {
  const app = fixture({ pauseOnSpace: false });
  app.canvas.emit('keydown', { code: 'Space' });
  assert.equal(app.canvas.dataset.paused, 'false');
  app.canvas.emit('keydown', { key: 'ArrowRight' });
  assert.equal(app.canvas.dataset.interactions, '1');
});

test('one sparse pointer move submits a stroke from the old point to the new point', () => {
  const app = fixture();
  app.down(100);
  app.move(700);
  const splats = dyeSplats(app);
  assert.equal(splats.length, 1);
  assert.deepEqual(splats[0].start, [0.1, 0.5]);
  assert.deepEqual(splats[0].point, [0.7, 0.5]);
});

test('color at a traveled distance does not depend on the number of pointer events', () => {
  const sparse = fixture();
  sparse.down(100);
  sparse.move(700);
  const dense = fixture();
  dense.down(100);
  for (const x of [200, 300, 400, 500, 600, 700]) dense.move(x);
  const a = dyeSplats(sparse).at(-1).color;
  const b = dyeSplats(dense).at(-1).color;
  for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(a[channel] - b[channel]) < 1e-6);
});

test('stroke momentum follows traveled distance rather than pointer event count', () => {
  const sparse=fixture();
  sparse.down(100);sparse.move(700);
  const dense=fixture();
  dense.down(100);
  for(const x of [200,300,400,500,600,700]) dense.move(x);
  const a=velocitySplats(sparse), b=velocitySplats(dense);
  assert.equal(a.length,1);
  assert.equal(b.length,6);
  for(const splat of [...a,...b]) assert.ok(Math.abs(splat.color[0]-110)<1e-9);
  const momentum=splats=>splats.reduce((sum,splat)=>sum+
    splat.color[0]*Math.hypot((splat.point[0]-splat.start[0])*2,splat.point[1]-splat.start[1]),0);
  assert.ok(Math.abs(momentum(a)-132)<1e-9);
  assert.ok(Math.abs(momentum(b)-132)<1e-9);
});

test('cursor force has isotropic physical strength and touch uses its own scale', () => {
  const mouse=fixture();
  mouse.down(100,250);mouse.move(200,350);
  const m=velocitySplats(mouse).at(-1).color;
  assert.ok(Math.abs(Math.hypot(m[0],m[1])-110)<1e-9);
  const touch=fixture();
  touch.down(100,250,5,'touch');
  touch.move(200,350,5,'touch');
  const t=velocitySplats(touch).at(-1).color;
  assert.ok(Math.abs(Math.hypot(t[0],t[1])-130)<1e-9);
});

test('leaving and reentering starts a new stroke without a connecting segment', () => {
  const app = fixture();
  app.down(100);
  app.move(200);
  app.canvas.emit('pointerleave', { pointerId: 1, pointerType: 'mouse' });
  app.move(800);
  assert.equal(dyeSplats(app).length, 1);
  app.down(800);
  app.move(900);
  assert.deepEqual(dyeSplats(app).at(-1).start, [0.8, 0.5]);
});

test('touch motion paints a segment and keyboard input paints a point', () => {
  const app = fixture();
  app.down(100,250,5,'touch');
  app.move(300, 250, 5, 'touch');
  assert.deepEqual(dyeSplats(app).at(-1).start, [0.1, 0.5]);
  app.canvas.emit('keydown', { key: 'ArrowRight' });
  const keySplat = dyeSplats(app).at(-1);
  assert.deepEqual(keySplat.start, keySplat.point);
});

test('paused mouse, touch, pen, and arrow input make no graphics changes', () => {
  const app = fixture({ paused: true });
  const before = { ...app.calls };
  for (const [pointerId, pointerType] of [[1, 'mouse'], [2, 'touch'], [3, 'pen']]) {
    app.down(100,250,pointerId,pointerType);
    app.move(700, 250, pointerId, pointerType);
  }
  app.canvas.emit('keydown', { key: 'ArrowRight' });
  assert.deepEqual(app.calls, before);
  assert.equal(app.canvas.dataset.interactions, '0');
  assert.equal(app.splats.length, 0);
});

test('pause and resume discard pointer history instead of joining across the pause', () => {
  const app = fixture();
  app.down(100); app.move(200);
  app.scene.setPaused(true);
  app.move(800);
  app.canvas.emit('keydown', { code: 'Space' });
  assert.equal(app.canvas.dataset.paused, 'false');
  app.move(850);
  assert.equal(dyeSplats(app).length, 1);
  app.down(850);
  app.move(900);
  assert.deepEqual(dyeSplats(app).at(-1).start, [.85, .5]);
});

test('reset clears pointer history and counters while preserving the paused state', () => {
  const app = fixture();
  app.down(100); app.move(200);
  assert.equal(app.canvas.dataset.interactions, '2');
  app.scene.setPaused(true);
  const clears = app.calls.clears;
  app.scene.reset(47);
  assert.equal(app.canvas.dataset.paused, 'true');
  assert.equal(app.canvas.dataset.interactions, '0');
  assert.ok(app.calls.clears > clears);
  app.scene.setPaused(false);
  app.move(800);
  assert.equal(dyeSplats(app).length, 1);
});

test('a supplied random seed reproduces wave uniforms and cursor color after reset', () => {
  const app = fixture({ randomized: true, seed: 1247 });
  const original = app.lights.at(-1);
  assert.equal(app.canvas.dataset.seed, '1247');
  app.down(100); app.move(400);
  const originalColor = dyeSplats(app).at(-1).color;
  app.scene.reset(9876);
  app.down(200); app.move(900);
  app.scene.reset(1247);
  assert.deepEqual(app.lights.at(-1), original);
  app.down(100); app.move(400);
  assert.deepEqual(dyeSplats(app).at(-1).color, originalColor);
  assert.equal(app.canvas.dataset.seed, '1247');
});

test('random seeds change both the wave geometry and its palette without per-render randomness', () => {
  const a = fixture({ randomized: true, seed: 101 });
  const b = fixture({ randomized: true, seed: 90210 });
  const first = a.lights.at(-1), second = b.lights.at(-1);
  assert.ok(Array.isArray(first.waveA) && Array.isArray(first.waveB));
  assert.ok(Array.isArray(first.tintA) && Array.isArray(first.tintB));
  assert.notDeepEqual(first.waveA, second.waveA);
  assert.notDeepEqual(first.waveB, second.waveB);
  assert.notDeepEqual([first.tintA, first.tintB], [second.tintA, second.tintB]);
  a.scene.render(); a.scene.render();
  assert.deepEqual(a.lights.at(-1), first);
  a.down(100); a.move(400); b.down(100); b.move(400);
  assert.notDeepEqual(dyeSplats(a).at(-1).color, dyeSplats(b).at(-1).color);
});

test('legacy creation keeps the established palette and wave proportions', () => {
  const app = fixture();
  const light = app.lights.at(-1);
  assert.deepEqual(light.waveA, [-.19, 1, 1]);
  assert.deepEqual(light.waveB, [.09, 920, 1]);
  assert.deepEqual(light.tintA, [.045, .31, .56]);
  assert.deepEqual(light.tintB, [1, .43, .12]);
});

test('randomized startup chooses broad arcs and slow tangential flow without reducing cursor force', () => {
  for (const seed of [0, 1, 101, 90210, 4294967295]) {
    const app = fixture({ randomized: true, seed });
    const { waveA, flowSpeed, flowScale } = app.fields.at(-1);
    assert.ok(waveA[1] >= .28 && waveA[1] <= .58, 'Initial bends stay shallow');
    assert.ok(waveA[2] >= .42 && waveA[2] <= .68, 'Initial curves have broad wavelengths');
    assert.ok(flowSpeed > 0 && flowSpeed <= .02, 'Tangential startup is slow in material coordinates');
    assert.ok(flowScale.every(value => value > 0), 'Material drift converts to solver texels');
    app.down(100); app.move(200);
    assert.ok(Math.abs(velocitySplats(app).at(-1).color[0] - 110) < 1e-9);
  }
});

test('legacy startup still selects its original vortex field', () => {
  const app = fixture();
  assert.equal(app.fields.at(-1).flowSpeed, 0);
});

test('a passive background ignores pointer and keyboard input while preserving page touch behavior', () => {
  const app = fixture({ interactive: false });
  const before = { ...app.calls };
  for (const [pointerId, pointerType] of [[1, 'mouse'], [2, 'touch'], [3, 'pen']]) {
    app.down(100,250,pointerId,pointerType);
    app.move(700, 250, pointerId, pointerType);
  }
  app.canvas.emit('keydown', { key: 'ArrowRight' });
  app.canvas.emit('keydown', { code: 'Space' });
  assert.deepEqual(app.calls, before);
  assert.equal(app.canvas.dataset.interactions, '0');
  assert.equal(app.canvas.dataset.paused, 'false');
  assert.equal(app.canvas.tabIndex, undefined);
  assert.equal(app.canvas.style.touchAction, undefined);
});

test('a passive background still animates and supports external pause, reset, and resume', () => {
  const app = fixture({ interactive: false, randomized: true, seed: 101 });
  assert.equal(app.step(), true);
  assert.equal(app.canvas.dataset.frames, '1');
  app.scene.setPaused(true);
  assert.equal(app.step(32), false);
  assert.equal(app.canvas.dataset.frames, '1');
  const before = app.lights.at(-1);
  app.scene.reset(90210);
  assert.equal(app.canvas.dataset.paused, 'true');
  assert.equal(app.canvas.dataset.seed, '90210');
  assert.notDeepEqual(app.lights.at(-1), before);
  app.scene.setPaused(false);
  assert.equal(app.step(48), true);
  assert.equal(app.canvas.dataset.frames, '2');
  assert.equal(app.canvas.dataset.interactions, '0');
});
