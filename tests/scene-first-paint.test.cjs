const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A delayed stylesheet or renderer must not postpone the URL's page theme.
function earlyTheme(file, suffix) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)[1];
  const resource = head.search(/<(?:link\b[^>]*rel=["']stylesheet|script\b[^>]*src=)/i);
  const early = resource < 0 ? head : head.slice(0, resource);
  const document = { documentElement: { dataset: {} } };
  const location = new URL(`https://echen347.github.io/${file}${suffix}`);
  for (const script of early.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    vm.runInNewContext(script[1], { document, window: { location }, URL, URLSearchParams });
  }
  return document.documentElement.dataset;
}

for (const file of ['index.html', 'homepage-preview.html']) {
  for (const suffix of ['', '?seed=123#scene', '?view=scene#scene']) {
    test(`${file}${suffix} chooses a dark first paint before external resources`, () => {
      assert.equal(earlyTheme(file, suffix).view, 'scene');
    });
  }
  for (const suffix of ['#profile', '?view=scene#profile', '#research']) {
    test(`${file}${suffix} leaves the paper appearance intact`, () => {
      assert.notEqual(earlyTheme(file, suffix).view, 'scene');
    });
  }
}

for (const file of ['profile.html', 'academic.html', 'photography.html', 'writing.html']) {
  test(`${file} chooses a dark first paint for a scene link`, () => {
    assert.equal(earlyTheme(file, '?seed=123&view=scene').view, 'scene');
  });
  for (const suffix of ['', '?seed=123', '?view=paper', '?view=scene-ish', '#scene']) {
    test(`${file}${suffix} leaves the paper appearance intact`, () => {
      assert.notEqual(earlyTheme(file, suffix).view, 'scene');
    });
  }
}
