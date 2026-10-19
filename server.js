'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* ما كاينش .env */ }

const NICHES = require('./niches.js');
const { getProducts } = require('./providers.js');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const cache = new Map();
const TTL = 30 * 60 * 1000;

function list(dir) {
  try { return fs.readdirSync(dir).join(', '); } catch (e) { return '(ما كايناش)'; }
}
function findIndex() {
  const options = [path.join(PUB, 'index.html'), path.join(ROOT, 'index.html')];
  for (const f of options) if (fs.existsSync(f)) return f;
  return null;
}
console.log('root:', list(ROOT));
console.log('public:', list(PUB));

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  try {
    if (u.pathname === '/api/niches') {
      return json(res, 200, NICHES.map((n) => ({ id: n.id, ar: n.ar })));
    }
    if (u.pathname === '/api/products') {
      const niche = NICHES.find((n) => n.id === u.searchParams.get('niche'));
      if (!niche) return json(res, 400, { error: 'نيش غير معروف' });
      const limit = Math.min(Math.max(parseInt(u.searchParams.get('limit'), 10) || 10, 1), 50);
      const key = niche.id + ':' + limit;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.t < TTL) return json(res, 200, hit.v);
      const out = await getProducts(niche, limit);
      if (out.source !== 'demo') cache.set(key, { t: Date.now(), v: out });
      return json(res, 200, out);
    }
    if (u.pathname === '/' || u.pathname === '/index.html') {
      const f = findIndex();
      if (!f) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('index.html ما تلقاش.\nroot: ' + list(ROOT) + '\npublic: ' + list(PUB));
      }
      return sendFile(res, f);
    }
    const file = path.normalize(path.join(PUB, u.pathname));
    if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    sendFile(res, file);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log('البرنامج خدام على البورت ' + PORT);
});
