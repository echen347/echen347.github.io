'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.SCENE_TEST_PORT || 8883);
const delay = 1500;
let mode = 'delay';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2'
};

http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/__scene-test-mode') {
      const next = url.searchParams.get('mode');
      if (!['delay', 'missing'].includes(next)) {
        response.writeHead(400).end('Unknown test mode');
        return;
      }
      mode = next;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ mode, delay }));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const filename = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!filename.startsWith(root + path.sep)) {
      response.writeHead(403).end('Outside fixture root');
      return;
    }
    const script = ['/studies/fluid-prototype.js', '/studies/homepage-preview.js'].includes(pathname);
    const requestMode = mode;
    if (script) await new Promise(resolve => setTimeout(resolve, delay));
    if (requestMode === 'missing' && pathname === '/studies/fluid-prototype.js') {
      response.writeHead(503, { 'Content-Type': 'text/plain' }).end('Renderer unavailable for the fallback check');
      return;
    }
    const data = await fs.readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream' });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(error.code === 'ENOENT' ? 'Not found' : 'Fixture server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log('Scene first-paint checks: http://127.0.0.1:' + port + '/tests/scene-first-paint.browser.html');
});
