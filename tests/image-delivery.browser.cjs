// Run against a local preview with Playwright available to Node.
// SITE_URL and BROWSER_EXECUTABLE optionally select the server and browser.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const site = process.env.SITE_URL || 'http://127.0.0.1:18765';
const portfolioOrder = [
  'osaka-lion-shrine.jpg', 'oculus-nyc.jpg', 'parking-exit.jpg',
  'uji-station-arches.jpg', 'pine-branch-sunset.jpg', 'sunset-coda.jpg',
  'umeda-sky-circle.jpg', 'rider-by-sea.jpg', 'tokyo-tower-framed.jpg',
  'japan-lantern-restaurant.jpg', 'hong-kong-harbour-night.jpg',
].map(filename => '/photography/' + filename);
const browserOptions = { headless: true };
if (process.env.BROWSER_EXECUTABLE) browserOptions.executablePath = process.env.BROWSER_EXECUTABLE;

async function main() {
  const browser = await chromium.launch(browserOptions);
  try {
    for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 800 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
      await context.addInitScript(() => {
        // A previously saved choice must not affect automatic image delivery.
        localStorage.setItem('siteDataPreference', 'low');
        sessionStorage.setItem('introShown', 'true');
      });
      const page = await context.newPage();
      const requests = [];
      const errors = [];
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(site + '/photography.html');
      await page.locator('.photo-tile img').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByRole('combobox').count(), 0);
      const originals = portfolioOrder;
      const layout = await page.evaluate(() => {
        const grid = document.querySelector('.photo-grid');
        return {
          width: grid.getBoundingClientRect().width,
          tiles: [...grid.querySelectorAll('.photo-tile')].map(tile => {
            const box = tile.getBoundingClientRect();
            return { src: '/' + tile.getAttribute('href'), x: box.x, y: box.y,
              width: box.width, height: box.height, ratio: Number(tile.dataset.ratio) };
          }),
        };
      });
      assert.deepEqual(layout.tiles.map(t => t.src), originals, 'Reading and keyboard order must follow portfolio priority');
      for (const tile of layout.tiles) {
        assert.ok(Math.abs(tile.width / tile.height - tile.ratio) < 0.01, 'Preserve each photograph without cropping');
      }
      if (viewport.width >= 600) {
        assert.ok(layout.tiles.some(t => t.width > layout.width * 0.95), 'Some landscapes should span the gallery');
        assert.ok(layout.tiles.some((tile, index) => index && Math.abs(tile.y - layout.tiles[index - 1].y) < 1),
          'Other photographs should share a row');
        assert.ok(layout.tiles.every(t => t.height <= 641), 'Desktop photographs should fit a comfortable viewing height');
        for (let i = 1; i < layout.tiles.length; i++) {
          const a = layout.tiles[i - 1], b = layout.tiles[i];
          if (Math.abs(a.y - b.y) < 1) {
            assert.ok(a.ratio <= 1.1 && b.ratio <= 1.1,
              'Pair portraits and squares; give horizontal photographs their own space');
          }
        }
      } else {
        assert.ok(layout.tiles.every(t => Math.abs(t.width - layout.width) < 1),
          'Every photograph should fill the single column on phones');
      }
      await page.locator('.photo-tile').first().click();
      await page.waitForFunction(() => {
        const image = document.getElementById('lb-img');
        return image.complete && image.naturalWidth > 0;
      });
      assert.ok(!requests.some(url => originals.includes(url)), 'Opening the viewer must not request an original');
      assert.equal(await page.locator('#lb-original').getAttribute('href'), originals[0].slice(1));
      for (let index = 0; index < originals.length; index++) {
        await page.locator('#lb-next').click();
        assert.equal(await page.locator('#lb-original').getAttribute('href'),
          originals[(index + 1) % originals.length].slice(1), 'Viewer must follow portfolio order and wrap');
        await page.waitForFunction(() => {
          const image = document.getElementById('lb-img');
          const file = document.getElementById('lb-original').getAttribute('href').split('/').pop().replace(/\.[^.]+$/, '');
          return image.complete && image.naturalWidth > 0 && image.currentSrc.includes('/' + file + '-');
        });
      }
      assert.ok(!requests.some(url => originals.includes(url)), 'Viewer navigation must not request originals');
      const selected = await page.evaluate(() => {
        const image = document.getElementById('lb-img');
        const photos = window.photoData.sections.flatMap(s => s.photos);
        return photos.flatMap(p => [...p.sources.jpeg, ...p.sources.webp])
          .find(s => image.currentSrc.endsWith('/' + s.src));
      });
      assert.ok(selected, 'Viewer must use a generated source');
      assert.ok(Math.max(selected.width, selected.height) <= 2400);
      await page.locator('#lb-original').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'lb-close');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'), 'true');
      if (viewport.width >= 600) {
        const focusedPhoto = await page.locator('.photo-tile').first().getAttribute('href');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => {
          const images = [...document.querySelectorAll('.photo-tile')];
          return images.every(tile => Math.abs(tile.getBoundingClientRect().x - images[0].getBoundingClientRect().x) < 1);
        });
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), focusedPhoto,
          'Resizing must preserve the focused photograph');
        assert.equal(await page.locator('.photo-tile').count(), originals.length);
        await page.setViewportSize(viewport);
        await page.waitForFunction(() => {
          const grid = document.querySelector('.photo-grid');
          return [...grid.querySelectorAll('.photo-tile')].some(tile => tile.getBoundingClientRect().width < grid.clientWidth * 0.75);
        });
      }
      // A longer lazy-loaded gallery needs each row to enter the viewport.
      for (const tile of await page.locator('.photo-tile').all()) await tile.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('.photo-tile img')].every(i => i.complete && i.naturalWidth > 0));
      assert.ok(!requests.some(url => originals.includes(url)), 'Scrolling must use generated images');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.CHECK_HOMEPAGE === '1') {
        await page.goto(site + '/#profile');
        await page.waitForFunction(() => {
          const image = document.querySelector('.bio-flex img');
          return image.complete && image.naturalWidth > 0;
        });
        assert.ok(!requests.includes('/headshot-cur-cruise.JPG'), 'Homepage must not download the full headshot');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ viewport, requestedImages: requests.filter(p => /\.(jpg|jpeg|webp)$/i.test(p)).length, viewerSource: selected.src }));
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
