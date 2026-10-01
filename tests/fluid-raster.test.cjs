const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'studies', 'fluid-prototype.js'), 'utf8');

function emitter(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); }
  });
}

// Record the renderer's GL allocations and pass connections, using the same
// boundary as fluid-tuning.test.cjs without replacing renderer functions.
function fixture({ width, height, dpr }) {
  const draws = [], allocations = [];
  let program, target, textureUnit = 0;
  const textures = new Map();
  const gl = { MAX_TEXTURE_SIZE: 4096, FRAMEBUFFER_COMPLETE: 1, TEXTURE0: 100 };
  for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'DEPTH_TEST', 'BLEND',
    'TEXTURE_2D', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'LINEAR',
    'CLAMP_TO_EDGE', 'RGBA16F', 'RGBA', 'HALF_FLOAT', 'FRAMEBUFFER', 'COLOR_ATTACHMENT0', 'TRIANGLES', 'COLOR_BUFFER_BIT']) gl[name] = name;
  for (const type of ['Shader', 'Program', 'Texture', 'Framebuffer', 'VertexArray']) {
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
  gl.texImage2D = (type, level, format, allocatedWidth, allocatedHeight) => {
    const texture = textures.get(textureUnit);
    Object.assign(texture, { width: allocatedWidth, height: allocatedHeight });
    allocations.push(texture);
  };
  gl.drawArrays = () => draws.push({
    uniforms: structuredClone(program.uniforms), inputs: new Map(textures), output: target?.texture || null
  });
  for (const name of ['shaderSource', 'attachShader', 'compileShader', 'linkProgram', 'bindVertexArray',
    'disable', 'texParameteri', 'viewport', 'clearColor', 'clear']) gl[name] = () => {};

  class Canvas {}
  const canvas = emitter(Object.assign(new Canvas(), {
    width, height, clientWidth: width, clientHeight: height, style: {}, dataset: {},
    getContext: () => gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    hasAttribute: () => true
  }));
  const media = emitter({ matches: false });
  const window = emitter({ devicePixelRatio: dpr });
  const document = emitter({ hidden: false });
  vm.runInNewContext(source, {
    window, document, HTMLCanvasElement: Canvas, matchMedia: () => media,
    performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    Math, structuredClone
  });
  const scene = window.FluidPrototype.create(canvas, { paused: true, randomized: true, seed: 812736 });
  return { scene, canvas, draws, allocations };
}

const dimensions = texture => [texture.width, texture.height];
const cases = [
  { name: 'desktop', width: 1600, height: 900, dpr: 1,
    raster: [1600, 900], solver: [341, 192], dye: [1365, 768] },
  { name: 'portrait high-density display', width: 390, height: 844, dpr: 2,
    raster: [585, 1266], solver: [144, 311], dye: [504, 1090] },
  // The 1.6-million-pixel display cap binds here: without it the raster would be 2205x1434.
  { name: 'laptop high-density display at the display pixel cap', width: 1470, height: 956, dpr: 2,
    raster: [1568, 1020], solver: [295, 192], dye: [1180, 768] }
];

for (const configuration of cases) {
  test(configuration.name + ': light resolves at display resolution without enlarging simulation grids', t => {
    const app = fixture(configuration);
    t.after(() => app.scene.dispose());
    const lighting = app.draws.filter(draw => draw.uniforms.field === 0).at(-1);
    const velocitySeed = app.draws.find(draw => draw.uniforms.field === 1);
    const display = app.draws.filter(draw => draw.output === null).at(-1);
    assert.ok(lighting && velocitySeed && display, 'The renderer executes light, velocity, and display passes');
    assert.deepEqual([app.canvas.width, app.canvas.height], configuration.raster, 'Keep the existing display pixel budget');
    assert.ok(app.canvas.width * app.canvas.height <= 1600000, 'The display raster stays within 1.6 million pixels');
    assert.deepEqual(dimensions(velocitySeed.output), configuration.solver, 'Keep the velocity solver resolution');
    const pressure = app.draws.filter(draw => draw.uniforms.pressure !== undefined && draw.uniforms.divergence !== undefined);
    assert.ok(pressure.length > 0, 'The pressure solver executes');
    for (const pass of pressure) assert.deepEqual(dimensions(pass.output), configuration.solver, 'Keep the pressure solver resolution');
    assert.deepEqual(dimensions(lighting.inputs.get(lighting.uniforms.source)), configuration.dye,
      'Keep the dye history at its existing lower resolution');
    assert.equal(display.inputs.get(display.uniforms.dye), lighting.output, 'Display consumes the actual light target');
    assert.ok(app.allocations.includes(lighting.output), 'The light target has a real texture allocation');
    assert.deepEqual(dimensions(lighting.output), configuration.raster,
      'Sample procedural light on the final display grid, not the dye grid');
    const bloom = app.draws.find(draw => draw.output && draw.uniforms.dye !== undefined);
    assert.ok(bloom, 'The renderer computes bloom from the light target');
    const compositionTexel = [1 / configuration.raster[0], 1 / configuration.raster[1]];
    assert.deepEqual(bloom.uniforms.texel, compositionTexel, 'Bloom samples use the light texture pixel size');
    assert.deepEqual(display.uniforms.texel, compositionTexel, 'Display samples use the light texture pixel size');
  });
}
