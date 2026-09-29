const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'studies', 'fluid-prototype.js'), 'utf8');
const defaults = {
  trailWidth: 1, dyeBrightness: 1.2, glowStrength: 1,
  curlStrength: 1, cursorForce: 1, fadeTime: 4
};

function emitter(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn({ preventDefault() {}, ...event }); }
  });
}

function fixture(options = {}) {
  const draws = [], allocations = [], clears = [], calls = { uniforms: 0 };
  let program, frame, target, textureUnit = 0;
  const boundTextures = new Map();
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
  gl.uniform1i = gl.uniform1f = (location, value) => { calls.uniforms++; location.target.uniforms[location.name] = value; };
  gl.uniform2f = (location, x, y) => { calls.uniforms++; location.target.uniforms[location.name] = [x, y]; };
  gl.uniform3f = (location, x, y, z) => { calls.uniforms++; location.target.uniforms[location.name] = [x, y, z]; };
  gl.useProgram = value => { program = value; };
  gl.drawArrays = () => {
    const shader = program.shaders.find(item => item.source?.includes('uniform vec2 point;'));
    const kind = shader ? 'splat' : program.shaders.some(item => item.source?.includes('uniform int field;')) ? 'seed' :
      program.shaders.some(item => item.source?.includes('uniform sampler2D forwardDye;')) ? 'correction' :
      program.shaders.some(item => item.source?.includes('vec2 materialStep') ||
        item.source?.includes('uniform float relaxation;')) ? 'deformation' :
      program.shaders.some(item => item.source?.includes('uniform float dissipation;')) ? 'advection' :
      program.shaders.some(item => item.source?.includes('uniform sampler2D wideBloom;')) ? 'display' :
      program.shaders.some(item => item.source?.includes('uniform sampler2D curl;')) ? 'vorticity' :
      program.shaders.some(item => item.source?.includes('uniform vec2 sourceFootprint;')) ? 'downsample' :
      program.shaders.some(item => item.source?.includes('uniform vec2 footprint;')) ? 'surface' :
      program.shaders.some(item => item.source?.includes('uniform vec2 offset;')) ? 'blur' :
      program.shaders.some(item => item.source?.includes('uniform sampler2D dye;')) ? 'bloom' : 'other';
    const uniforms = structuredClone(program.uniforms);
    const inputs = new Map(boundTextures);
    draws.push({ kind, uniforms, target, output: target?.texture || null, inputs,
      source: inputs.get(uniforms.source), dye: inputs.get(uniforms.dye) });
  };
  gl.checkFramebufferStatus = () => gl.FRAMEBUFFER_COMPLETE;
  gl.texImage2D = (...args) => {
    allocations.push(args.slice(0, 5));
    Object.assign(boundTextures.get(textureUnit), { width: args[3], height: args[4] });
  };
  for (const name of ['bindVertexArray', 'disable', 'compileShader', 'linkProgram', 'texParameteri',
    'viewport', 'clearColor']) gl[name] = () => {};
  gl.clear = () => { clears.push(target?.texture || null); };
  gl.activeTexture = value => { textureUnit = value - gl.TEXTURE0; };
  gl.bindTexture = (type, texture) => { boundTextures.set(textureUnit, texture); };
  gl.bindFramebuffer = (type, framebuffer) => { target = framebuffer; };
  gl.framebufferTexture2D = (type, attachment, textureType, texture) => { target.texture = texture; };
  class Canvas {}
  const canvas = emitter(Object.assign(new Canvas(), {
    width: 1000, height: 500, clientWidth: 1000, clientHeight: 500, style: {}, dataset: {},
    getContext: () => gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
    hasAttribute: () => true,
    setPointerCapture() {}
  }));
  const media = emitter({ matches: true });
  const window = emitter({ devicePixelRatio: 1 });
  const document = emitter({ hidden: false });
  vm.runInNewContext(source, {
    window, document, HTMLCanvasElement: Canvas, matchMedia: () => media,
    performance: { now: () => 0 }, requestAnimationFrame: callback => { frame = callback; return 1; },
    cancelAnimationFrame() { frame = null; }, Math, structuredClone
  });
  const scene = window.FluidPrototype.create(canvas, { paused: true, ambient: false, ...options });
  const move = (x, y = 250) => canvas.emit('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y });
  return { scene, schema: window.FluidPrototype.tuningSchema, canvas, draws, allocations, clears, calls, move,
    step(now = 16) { if (!frame) throw new Error('No animation frame scheduled'); const callback = frame; frame = null; callback(now); } };
}

function last(app, kind) { return app.draws.filter(draw => draw.kind === kind).at(-1)?.uniforms; }
function lightDraws(draws) { return draws.filter(draw => draw.kind === 'seed' && draw.uniforms.field === 0); }
function velocitySeedDraws(draws) { return draws.filter(draw => draw.kind === 'seed' && draw.uniforms.field === 1); }
function deformationDraws(draws) { return draws.filter(draw => draw.kind === 'deformation'); }

test('tuning schema exposes bounded controls and default values', () => {
  const app = fixture();
  assert.ok(Array.isArray(app.schema));
  assert.deepEqual(Array.from(app.schema, item => item.key).sort(), Object.keys(defaults).sort());
  for (const item of app.schema) {
    assert.equal(typeof item.label, 'string');
    assert.ok(item.label.length > 0);
    assert.equal(typeof item.unit, 'string');
    assert.ok(Number.isFinite(item.step) && item.step > 0);
    assert.equal(item.defaultValue, defaults[item.key]);
  }
  assert.deepEqual(Object.fromEntries(Array.from(app.schema, item => [item.key, [item.min, item.max]])), {
    trailWidth: [.4, 2.5], dyeBrightness: [0, 3], glowStrength: [0, 2],
    curlStrength: [0, 2], cursorForce: [0, 3], fadeTime: [1, 12]
  });
  assert.deepEqual({ ...app.scene.getTuning() }, defaults);
});

test('partial initial tuning applies and getTuning returns independent copies', () => {
  const app = fixture({ tuning: { trailWidth: 1.8, fadeTime: 8 } });
  assert.deepEqual({ ...app.scene.getTuning() }, { ...defaults, trailWidth: 1.8, fadeTime: 8 });
  const copy = app.scene.getTuning();
  copy.trailWidth = 2.5;
  assert.equal(app.scene.getTuning().trailWidth, 1.8);
});

test('setTuning clamps known finite values without reallocating or reseeding', () => {
  const app = fixture();
  const allocations = app.allocations.length, seedDraws = velocitySeedDraws(app.draws).length;
  app.scene.setTuning({ trailWidth: 20, dyeBrightness: -1, fadeTime: 20 });
  assert.deepEqual({ ...app.scene.getTuning() }, { ...defaults, trailWidth: 2.5, dyeBrightness: 0, fadeTime: 12 });
  assert.equal(app.allocations.length, allocations);
  assert.equal(velocitySeedDraws(app.draws).length, seedDraws);
});

test('setTuning rejects invalid patches atomically', () => {
  const app = fixture();
  for (const patch of [
    { trailWidth: 1.7, cursorForce: NaN },
    { glowStrength: Infinity },
    { curlStrength: -Infinity },
    { trailWidth: 1.7, unknownControl: 2 }
  ]) {
    assert.throws(() => app.scene.setTuning(patch));
    assert.deepEqual({ ...app.scene.getTuning() }, defaults);
  }
});

test('tuning changes the next pointer stroke without recreating the scene', () => {
  const baseline = fixture({ paused: false });
  baseline.move(100);baseline.move(200);
  const app = fixture({ paused: false });
  app.scene.setTuning({ trailWidth: 2, dyeBrightness: 2.4, cursorForce: 2 });
  app.move(100);app.move(200);
  const splats=app.draws.filter(draw => draw.kind === 'splat').slice(-2);
  const base=baseline.draws.filter(draw => draw.kind === 'splat').slice(-2);
  assert.equal(splats.length, 2);
  assert.ok(Math.abs(splats[0].uniforms.color[0] - 220) < 1e-9);
  assert.ok(Math.abs(splats[0].uniforms.radius - .00112) < 1e-12);
  assert.ok(Math.abs(splats[1].uniforms.radius - .00112) < 1e-12);
  for(let channel=0;channel<3;channel++)
    assert.ok(Math.abs(splats[1].uniforms.color[channel] - base[1].uniforms.color[channel]*2) < 1e-6);
});

test('glow strength updates display without allocating or reseeding while paused', () => {
  const app=fixture();
  const allocations=app.allocations.length, seedDraws=velocitySeedDraws(app.draws).length;
  app.scene.setTuning({glowStrength:1.4});
  assert.equal(last(app,'display').glowStrength,1.4);
  assert.equal(app.allocations.length,allocations);
  assert.equal(velocitySeedDraws(app.draws).length,seedDraws);
});

test('light composition feeds bloom and display before each paused render', () => {
  const app = fixture();
  for (let render = 0; render < 2; render++) {
    const start = app.draws.length;
    app.scene.render();
    const frame = app.draws.slice(start);
    const light = lightDraws(frame);
    const bloom = frame.find(draw => draw.kind === 'bloom');
    const display = frame.find(draw => draw.kind === 'display');
    assert.equal(light.length, 1, 'one fresh light composition per render');
    assert.ok(light[0].output, 'light is rendered to an offscreen texture');
    assert.ok(bloom && display, 'composition reaches both output passes');
    assert.ok(frame.indexOf(light[0]) < frame.indexOf(bloom));
    assert.ok(frame.indexOf(bloom) < frame.indexOf(display));
    assert.equal(bloom.dye, light[0].output);
    assert.equal(bloom.uniforms.glass, display.uniforms.glass, 'bloom uses the displayed material');
    assert.equal(display.dye, light[0].output);
    assert.notEqual(light[0].source, light[0].output, 'composition cannot sample its own target');
  }
});

test('material switches change only the composed Glass emission', () => {
  const app = fixture();
  const dye = app.draws.filter(draw => draw.kind === 'advection').at(-1).output;
  const allocations = app.allocations.length;
  for (const [material, glass] of [['ink', 0], ['glass', 1]]) {
    const start = app.draws.length;
    app.scene.setMaterial(material);
    const frame = app.draws.slice(start);
    const light = lightDraws(frame);
    assert.equal(light.length, 1);
    assert.equal(light[0].uniforms.glass, glass);
    assert.equal(light[0].uniforms.amount, 1.5);
    assert.equal(light[0].source, dye, 'material switch reads unmodified dye history');
    assert.ok(frame.every(draw => ['seed', 'surface', 'downsample', 'blur', 'bloom', 'display'].includes(draw.kind)),
      'material switch runs composition only, not simulation or splats');
    assert.equal(velocitySeedDraws(frame).length, 0);
    assert.equal(app.allocations.length, allocations);
  }
});

test('wide bloom prefilters its footprint before blurring on the reduced grid', () => {
  const app = fixture();
  const start = app.draws.length;
  app.scene.render();
  const frame = app.draws.slice(start);
  const reduce = frame.find(draw => draw.kind === 'downsample');
  assert.ok(reduce, 'wide bloom needs a two-axis low-pass before reduction');
  const narrow = frame[frame.indexOf(reduce) - 1];
  const [horizontal, vertical] = frame.slice(frame.indexOf(reduce) + 1, frame.indexOf(reduce) + 3);
  assert.equal(reduce.source, narrow.output);
  assert.deepEqual(reduce.uniforms.sourceFootprint, [1 / reduce.output.width, 1 / reduce.output.height]);
  assert.ok(reduce.source.width > reduce.output.width && reduce.source.height > reduce.output.height);
  assert.equal(horizontal.source, reduce.output);
  assert.notEqual(horizontal.source, horizontal.output);
  assert.deepEqual(horizontal.uniforms.offset, [1 / reduce.output.width, 0]);
  assert.equal(vertical.source, horizontal.output);
  assert.equal(vertical.output, reduce.output);
  assert.deepEqual(vertical.uniforms.offset, [0, 1 / reduce.output.height]);
  const display = frame.find(draw => draw.kind === 'display');
  assert.equal(display.inputs.get(display.uniforms.wideBloom), vertical.output);
});

test('Glass display samples footprint-filtered composition without feeding simulation', () => {
  const app = fixture();
  const start = app.draws.length;
  app.scene.render();
  const frame = app.draws.slice(start);
  const seedIndex = frame.findIndex(draw => draw.kind === 'seed' && draw.uniforms.field === 0);
  const bloomIndex = frame.findIndex(draw => draw.kind === 'bloom');
  assert.ok(seedIndex >= 0 && bloomIndex > seedIndex);
  const surfacePasses = frame.slice(seedIndex + 1, bloomIndex);
  assert.deepEqual(surfacePasses.map(draw => draw.kind), ['surface', 'blur', 'blur']);
  const [downsample, horizontal, vertical] = surfacePasses;
  const composition = frame[seedIndex].output;
  const display = frame.find(draw => draw.kind === 'display');
  assert.equal(downsample.source, composition);
  assert.equal(horizontal.source, downsample.output);
  assert.equal(vertical.source, horizontal.output);
  assert.notEqual(downsample.source, downsample.output);
  assert.notEqual(horizontal.source, horizontal.output);
  assert.notEqual(vertical.source, vertical.output);
  assert.equal(vertical.output, downsample.output, 'surface target is reused after horizontal blur');
  assert.deepEqual(downsample.uniforms.footprint,
    [1 / downsample.output.width, 1 / downsample.output.height]);
  assert.equal(display.inputs.get(display.uniforms.surface), vertical.output);
  assert.deepEqual(display.uniforms.surfaceTexel, [1 / vertical.output.width, 1 / vertical.output.height]);
  assert.notEqual(vertical.output, frame[seedIndex].source, 'surface is not raw dye');
  const opticalFlow = frame.slice(0, seedIndex).filter(draw => draw.kind === 'blur').at(-1).output;
  assert.notEqual(vertical.output, opticalFlow, 'surface is not deformation flow');

  const next = app.draws.length;
  app.scene.setPaused(false);
  app.step(16);
  const simulation = app.draws.slice(next).filter(draw => ['advection', 'deformation', 'splat'].includes(draw.kind));
  assert.ok(simulation.length > 0);
  assert.ok(simulation.every(draw => draw.source !== vertical.output &&
    draw.inputs.get(draw.uniforms.velocity) !== vertical.output), 'surface never feeds the solver');
});

test('Ink skips surface filtering and paused Glass rerenders reuse the same targets', () => {
  const app = fixture();
  const allocations = app.allocations.length;
  const renderFor = material => {
    const start = app.draws.length;
    app.scene.setMaterial(material);
    return app.draws.slice(start);
  };
  const ink = renderFor('ink');
  const inkSeed = ink.findIndex(draw => draw.kind === 'seed' && draw.uniforms.field === 0);
  const inkBloom = ink.findIndex(draw => draw.kind === 'bloom');
  assert.ok(inkSeed >= 0 && inkBloom > inkSeed);
  assert.equal(ink.slice(inkSeed + 1, inkBloom).filter(draw => ['surface', 'blur'].includes(draw.kind)).length, 0);

  const glass = renderFor('glass');
  const secondStart = app.draws.length;
  app.scene.render();
  const rerender = app.draws.slice(secondStart);
  const surfaceTrace = frame => {
    const seed = frame.findIndex(draw => draw.kind === 'seed' && draw.uniforms.field === 0);
    const bloom = frame.findIndex(draw => draw.kind === 'bloom');
    return { passes: frame.slice(seed + 1, bloom).filter(draw => ['surface', 'blur'].includes(draw.kind)),
      display: frame.find(draw => draw.kind === 'display') };
  };
  const first = surfaceTrace(glass), second = surfaceTrace(rerender);
  assert.deepEqual(first.passes.map(draw => draw.kind), ['surface', 'blur', 'blur']);
  assert.deepEqual(second.passes.map(draw => draw.kind), ['surface', 'blur', 'blur']);
  assert.equal(first.passes[0].output, second.passes[0].output);
  assert.equal(first.passes[1].output, second.passes[1].output);
  assert.equal(first.passes[2].output, second.passes[2].output);
  assert.deepEqual(first.display.uniforms, second.display.uniforms);
  assert.equal(first.display.inputs.get(first.display.uniforms.surface),
    second.display.inputs.get(second.display.uniforms.surface));
  assert.equal(deformationDraws(glass).length + deformationDraws(rerender).length, 0);
  assert.equal(app.allocations.length, allocations);
});

test('ambient light never enters the advected dye or feeds later light passes', () => {
  const app = fixture({ ambient: true });
  app.scene.setPaused(false);
  for (let i = 1; i <= 40; i++) app.step(i * 16);
  const lights = lightDraws(app.draws);
  const advectedSources = new Set(app.draws.filter(draw => draw.kind === 'advection').map(draw => draw.source));
  assert.ok(lights.length > 2, 'sample both the initial and later ambient light');
  for (const light of lights) {
    assert.ok(light.output);
    assert.ok(!advectedSources.has(light.output), 'light texture must not become an advection source');
    assert.notEqual(light.source, light.output, 'light cannot read its own render target');
  }
  for (let i = 0; i < lights.length; i++)
    for (let j = i + 1; j < lights.length; j++)
      assert.notEqual(lights[j].source, lights[i].output, 'later light cannot recompose earlier light');
});

test('repeated paused renders keep light uniforms stable without allocating or reseeding', () => {
  const app = fixture();
  const allocations = app.allocations.length;
  const velocitySeeds = velocitySeedDraws(app.draws).length;
  const renderLight = () => {
    const start = app.draws.length;
    app.scene.render();
    return lightDraws(app.draws.slice(start));
  };
  const first = renderLight();
  const second = renderLight();
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.deepEqual(second[0].uniforms, first[0].uniforms);
  assert.equal(second[0].output, first[0].output);
  assert.equal(app.allocations.length, allocations);
  assert.equal(velocitySeedDraws(app.draws).length, velocitySeeds);
});

test('each light pass filters persistent deformation instead of raw solver velocity', () => {
  const app = fixture();
  const lastDyeAdvection = app.draws.filter(draw => draw.kind === 'advection').at(-1);
  const liveVelocity = lastDyeAdvection.inputs.get(lastDyeAdvection.uniforms.velocity);
  const latestDeformation = deformationDraws(app.draws).at(-1)?.output;
  const allocations = app.allocations.length;
  assert.ok(latestDeformation?.width && latestDeformation?.height);
  assert.notEqual(latestDeformation, liveVelocity);
  for (let render = 0; render < 2; render++) {
    const start = app.draws.length;
    app.scene.render();
    const frame = app.draws.slice(start);
    const lightIndex = frame.findIndex(draw => draw.kind === 'seed' && draw.uniforms.field === 0);
    assert.ok(lightIndex >= 0);
    const flowBlurs = frame.slice(0, lightIndex).filter(draw => draw.kind === 'blur');
    assert.equal(flowBlurs.length, 2, 'horizontal and vertical flow filters precede light');
    const [horizontal, vertical] = flowBlurs;
    assert.equal(horizontal.source, latestDeformation, 'filter reads persistent deformation');
    assert.equal(vertical.source, horizontal.output, 'vertical filter reads horizontal result');
    assert.notEqual(horizontal.output, vertical.output, 'filter passes cannot read and write one texture');
    assert.equal(horizontal.output.width, latestDeformation.width);
    assert.equal(horizontal.output.height, latestDeformation.height);
    assert.equal(vertical.output.width, latestDeformation.width);
    assert.equal(vertical.output.height, latestDeformation.height);
    assert.deepEqual(horizontal.uniforms.offset, [1 / latestDeformation.width, 0]);
    assert.deepEqual(vertical.uniforms.offset, [0, 1 / latestDeformation.height]);
    assert.equal(frame[lightIndex].inputs.get(frame[lightIndex].uniforms.deformation), vertical.output);
    assert.notEqual(vertical.output, liveVelocity, 'light does not sample the raw velocity grid');
    assert.equal(app.allocations.length, allocations, 'paused render reuses optical-flow targets');
  }
});

test('simulation and deformation update sample raw velocity, while optical filtering samples deformation', () => {
  const app = fixture();
  const start = app.draws.length;
  app.scene.setPaused(false);
  app.step();
  const frame = app.draws.slice(start);
  const dyeAdvection = frame.filter(draw => draw.kind === 'advection').at(-1);
  const lightIndex = frame.findIndex(draw => draw.kind === 'seed' && draw.uniforms.field === 0);
  assert.ok(lightIndex >= 0);
  const flowBlurs = frame.slice(0, lightIndex).filter(draw => draw.kind === 'blur');
  const light = frame[lightIndex];
  assert.equal(flowBlurs.length, 2, 'only optical blurs precede composition');
  const deformation = deformationDraws(frame).at(-1);
  assert.ok(deformation);
  const rawVelocity = deformation.inputs.get(deformation.uniforms.velocity);
  assert.equal(dyeAdvection.inputs.get(dyeAdvection.uniforms.velocity), rawVelocity);
  assert.equal(flowBlurs[0].source, deformation.output);
  assert.equal(light.inputs.get(light.uniforms.deformation), flowBlurs[1].output);
  assert.notEqual(dyeAdvection.inputs.get(dyeAdvection.uniforms.velocity), light.inputs.get(light.uniforms.deformation));
});

test('deformation ping-pongs over simulation steps without entering color history', () => {
  const app = fixture();
  app.scene.setPaused(false);
  const start = app.draws.length;
  app.step(16);
  app.step(32);
  const frame = app.draws.slice(start);
  const updates = deformationDraws(frame);
  assert.equal(updates.length, 2, 'deformation advances once per simulation step');
  const [first, second] = updates;
  assert.ok(first.source && first.output);
  assert.notEqual(first.source, first.output);
  assert.equal(second.source, first.output, 'the next step reads the previous deformation');
  assert.equal(second.output, first.source, 'the two deformation targets alternate');
  const colorTextures = new Set(app.draws.filter(draw => draw.kind === 'advection' && draw.uniforms.dissipation !== .18)
    .flatMap(draw => [draw.source, draw.output]));
  for (const update of updates) {
    assert.ok(!colorTextures.has(update.source));
    assert.ok(!colorTextures.has(update.output));
    assert.notEqual(update.inputs.get(update.uniforms.velocity), update.output);
  }
});

test('the original light phase stays fixed while ambient flow evolves', () => {
  const app = fixture({ ambient: true });
  const original = lightDraws(app.draws).at(-1)?.uniforms.phase;
  assert.ok(Number.isFinite(original));
  const seedCount = velocitySeedDraws(app.draws).length;
  const start = app.draws.length;
  app.scene.setPaused(false);
  for (let i = 1; i <= 40; i++) app.step(i * 16);
  const lights = lightDraws(app.draws.slice(start));
  assert.equal(lights.length, 40);
  assert.ok(lights.every(draw => draw.uniforms.phase === original),
    'flow changes coordinates without shifting the original light pattern');
  assert.equal(velocitySeedDraws(app.draws).length, seedCount);
});

test('persistent material transport has no relaxation or speed-limit uniforms', () => {
  const app = fixture();
  const updates = deformationDraws(app.draws);
  assert.ok(updates.length > 0);
  for (const draw of updates) {
    assert.ok(draw.uniforms.dt > 0);
    assert.ok(draw.source && draw.output);
    assert.equal(Object.hasOwn(draw.uniforms, 'relaxation'), false);
    assert.equal(Object.hasOwn(draw.uniforms, 'speedLimit'), false);
  }
});

test('paused renders do not advance deformation', () => {
  const app = fixture();
  const before = deformationDraws(app.draws).length;
  const latest = deformationDraws(app.draws).at(-1)?.output;
  assert.ok(latest);
  for (let i = 0; i < 2; i++) {
    const start = app.draws.length;
    app.scene.render();
    const frame = app.draws.slice(start);
    assert.equal(deformationDraws(frame).length, 0);
    assert.equal(frame.find(draw => draw.kind === 'blur').source, latest);
  }
  assert.equal(deformationDraws(app.draws).length, before);
});

test('reset clears both persistent deformation targets without reallocating', () => {
  const app = fixture();
  const latest = deformationDraws(app.draws).at(-1);
  assert.ok(latest?.source && latest.output);
  const allocations = app.allocations.length;
  const clearStart = app.clears.length;
  const drawStart = app.draws.length;
  app.scene.reset();
  const cleared = new Set(app.clears.slice(clearStart));
  assert.ok(cleared.has(latest.source));
  assert.ok(cleared.has(latest.output));
  assert.equal(app.allocations.length, allocations);
  assert.ok(deformationDraws(app.draws.slice(drawStart)).length > 0, 'reset reinitializes the deformation field');
});

test('initial display receives the full glow before any tuning input', () => {
  const app = fixture();
  assert.equal(last(app, 'display').glowStrength, 1);
});

test('curl strength changes the next vorticity pass', () => {
  const app=fixture();
  app.scene.setTuning({curlStrength:1.5});
  app.scene.setPaused(false);app.step();
  assert.equal(last(app,'vorticity').strength,18);
});

test('trail width scales keyboard stroke radius', () => {
  const app = fixture({ paused: false });
  app.scene.setTuning({ trailWidth: 2 });
  app.canvas.emit('keydown', { key: 'ArrowRight' });
  assert.ok(Math.abs(last(app, 'splat').radius - .0032) < 1e-12);
});

test('fade time changes the next dye advection decay', () => {
  const app = fixture();
  app.scene.setTuning({ fadeTime: 8 });
  app.scene.setPaused(false);app.step();
  assert.ok(Math.abs(last(app, 'advection').dissipation - Math.LN2 / (8 * .45)) < 1e-9);
});

test('one simulation step advects velocity and dye once each', () => {
  const app=fixture();
  const before=app.draws.length;
  app.scene.setPaused(false);app.step();
  const step=app.draws.slice(before);
  assert.equal(step.filter(draw=>draw.kind==='advection').length,2);
  assert.equal(step.filter(draw=>draw.kind==='correction').length,0);
});

test('setTuning after disposal makes no graphics calls', () => {
  const app = fixture();
  app.scene.dispose();
  const draws=app.draws.length, allocations=app.allocations.length, uniforms=app.calls.uniforms;
  app.scene.setTuning({ trailWidth: 2 });
  assert.equal(app.draws.length, draws);
  assert.equal(app.allocations.length, allocations);
  assert.equal(app.calls.uniforms, uniforms);
});

test('context loss stops input, reset, and tuning graphics work', () => {
  const errors=[];
  const app=fixture({onError:error=>errors.push(error)});
  app.canvas.emit('webglcontextlost');
  assert.equal(app.canvas.dataset.state,'error');
  assert.equal(errors.length,1);
  const draws=app.draws.length, allocations=app.allocations.length, uniforms=app.calls.uniforms;
  app.move(100);app.move(200);
  app.canvas.emit('keydown',{key:'ArrowRight'});
  app.scene.reset();
  app.scene.setTuning({glowStrength:1.3});
  assert.equal(app.draws.length,draws);
  assert.equal(app.allocations.length,allocations);
  assert.equal(app.calls.uniforms,uniforms);
  assert.equal(app.canvas.dataset.state,'error');
  assert.equal(errors.length,1);
});
