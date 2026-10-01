const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'studies', 'fluid-prototype.js'), 'utf8');

function events(value = {}) {
  const handlers = new Map();
  return Object.assign(value, {
    addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); },
    removeEventListener(type, fn) { handlers.get(type)?.delete(fn); },
    emit(type, event = {}) { for (const fn of handlers.get(type) || []) fn(event); }
  });
}

function fixture(options = {}) {
  const lights = [], seeds = [];
  let activeProgram, frame, now = 0, allocations = 0;
  const gl = { MAX_TEXTURE_SIZE: 4096, FRAMEBUFFER_COMPLETE: 1, TEXTURE0: 100 };
  for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'DEPTH_TEST', 'BLEND',
    'TEXTURE_2D', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'LINEAR',
    'CLAMP_TO_EDGE', 'RGBA16F', 'RGBA', 'HALF_FLOAT', 'FRAMEBUFFER', 'COLOR_ATTACHMENT0', 'TRIANGLES', 'COLOR_BUFFER_BIT']) gl[name] = name;
  for (const type of ['Shader', 'Program', 'Texture', 'Framebuffer', 'VertexArray']) {
    gl['create' + type] = () => { if (type === 'Framebuffer') allocations++; return { shaders: [], uniforms: {} }; };
    gl['delete' + type] = () => {};
  }
  gl.getExtension = () => ({});
  gl.getParameter = () => 4096;
  gl.shaderSource = (shader, value) => { shader.source = value; };
  gl.attachShader = (program, shader) => { program.shaders.push(shader); };
  gl.getShaderParameter = gl.getProgramParameter = () => true;
  gl.getUniformLocation = (program, key) => ({ program, key });
  gl.uniform1i = gl.uniform1f = ({ program, key }, value) => { program.uniforms[key] = value; };
  gl.uniform2f = ({ program, key }, x, y) => { program.uniforms[key] = [x, y]; };
  gl.uniform3f = ({ program, key }, x, y, z) => { program.uniforms[key] = [x, y, z]; };
  gl.useProgram = value => { activeProgram = value; };
  gl.drawArrays = () => {
    if (!activeProgram.shaders.some(shader => shader.source?.includes('uniform int field;'))) return;
    const output = structuredClone(activeProgram.uniforms);
    if (output.field === 0) lights.push(output);
    if (output.field === 1) seeds.push(output);
  };
  gl.checkFramebufferStatus = () => gl.FRAMEBUFFER_COMPLETE;
  for (const name of ['bindVertexArray', 'disable', 'compileShader', 'linkProgram', 'bindTexture', 'texParameteri',
    'texImage2D', 'bindFramebuffer', 'framebufferTexture2D', 'activeTexture', 'viewport', 'clearColor', 'clear']) gl[name] = () => {};
  class Canvas {}
  const canvas = events(Object.assign(new Canvas(), {
    width: 800, height: 500, style: {}, dataset: {}, getContext: () => gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }),
    hasAttribute: () => false, setPointerCapture() {}
  }));
  const document = events({ hidden: false }), window = events({ devicePixelRatio: 1 });
  const media = events({ matches: false });
  vm.runInNewContext(source, {
    window, document, HTMLCanvasElement: Canvas, matchMedia: () => media,
    performance: { now: () => now },
    requestAnimationFrame: fn => { frame = fn; return 1; },
    cancelAnimationFrame: () => { frame = null; }, Math, structuredClone
  });
  const scene = window.FluidPrototype.create(canvas, { randomized: true, paused: false, ...options });
  return { scene, canvas, document, media, lights, seeds, allocations: () => allocations,
    step(time) { now = time; const callback = frame; frame = null; callback?.(now); return !!callback; },
    setNow(time) { now = time; }
  };
}

test('streaming advances without changing the strand geometry or reseeding fluid', () => {
  const app = fixture(), initial = app.lights.at(-1), count = app.seeds.length;
  assert.equal(initial.streamTime, 0, 'The initial light stream has no elapsed time');
  app.step(20); app.step(40);
  const light = app.lights.at(-1);
  assert.ok(Math.abs(light.streamTime - .018) < 1e-9, 'Two 20 ms frames advance the simulation clock by 18 ms');
  for (const key of ['phase', 'waveA', 'waveB']) assert.deepEqual(light[key], initial[key]);
  assert.equal(app.seeds.length, count, 'Brightness animation must not inject a fresh seed field');
});

test('manual renders and paused elapsed wall time do not advance streaming', () => {
  const app = fixture(); app.step(20); app.scene.setPaused(true);
  const time = app.lights.at(-1).streamTime;
  assert.ok(time > 0);
  app.setNow(9000); app.scene.render(); app.scene.render();
  assert.equal(app.lights.at(-1).streamTime, time);
  assert.equal(app.step(10000), false);
  app.scene.setPaused(false); app.step(10020);
  assert.ok(Math.abs(app.lights.at(-1).streamTime - time - .009) < 1e-9);
});

test('hidden tabs resume streaming without catching up the missing time', () => {
  const app = fixture(); app.step(20);
  const time = app.lights.at(-1).streamTime;
  assert.ok(time > 0);
  app.document.hidden = true; app.document.emit('visibilitychange');
  app.setNow(60000); app.document.hidden = false; app.document.emit('visibilitychange');
  app.step(60020);
  assert.ok(Math.abs(app.lights.at(-1).streamTime - time - .009) < 1e-9);
});

test('Reset restarts streaming even when reduced motion holds the scene still', () => {
  const app = fixture(); app.step(20); app.media.emit('change', { matches: true });
  assert.ok(app.lights.at(-1).streamTime > 0);
  app.scene.reset(347);
  assert.equal(app.lights.at(-1).streamTime, 0);
  assert.equal(app.canvas.dataset.paused, 'true');
  assert.equal(app.step(40), false);
});

test('streaming reuses the existing framebuffer allocation at every frame', () => {
  const app = fixture(), allocations = app.allocations();
  for (let i = 1; i <= 40; i++) app.step(i * 20);
  assert.ok(app.lights.at(-1).streamTime > .3);
  assert.equal(app.allocations(), allocations);
});
