'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* ما كاينش .env */ }

const NICHES = require('./niches.js');
const { getProducts } = require('./providers.js');
const ads = require('./ads.js');
const adsEngine = require('./adsengine.js');
const tiktok = require('./tiktok.js');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const cache = new Map();
const TTL = 30 * 60 * 1000;

/* ---------- كلمة السر ---------- */
const PASS = process.env.APP_PASSWORD || '';
const COOKIE = 'wp_auth';
const MAX_AGE = 30 * 24 * 3600; // 30 يوم
const TOKEN = PASS ? crypto.createHmac('sha256', PASS).update('winning-product-session').digest('hex') : '';
const attempts = new Map(); // ip -> { n, t }

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}
function isAuthed(req) {
  if (!PASS) return true;
  const c = getCookie(req, COOKIE);
  return !!c && safeEqual(c, TOKEN);
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}
function tooMany(ip) {
  const a = attempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.t > 10 * 60 * 1000) { attempts.delete(ip); return false; }
  return a.n >= 8;
}
function fail(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.t > 10 * 60 * 1000) attempts.set(ip, { n: 1, t: Date.now() });
  else a.n++;
}
function loginPage(msg) {
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>دخول</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EEF1F0;font-family:Tahoma,Arial,sans-serif;color:#12211D}' +
    'form{background:#fff;border:1px solid #D5DDDA;border-radius:14px;padding:22px;width:min(320px,88vw);display:grid;gap:12px}' +
    'h1{font-size:1.2rem;margin:0}input,button{font:inherit;padding:11px 12px;border-radius:10px;border:1px solid #D5DDDA}' +
    'button{background:#0F5C8C;color:#fff;border-color:#0F5C8C;font-weight:700;cursor:pointer}p{margin:0;color:#B8322F;font-size:.9rem}</style></head><body>' +
    '<form method="post" action="/login"><h1>صائد المنتجات الرابحة</h1>' +
    (msg ? '<p>' + msg + '</p>' : '') +
    '<input type="password" name="password" placeholder="كلمة السر" autocomplete="current-password" autofocus required>' +
    '<button type="submit">دخول</button></form></body></html>';
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > max) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

function findIndex() {
  for (const f of [path.join(PUB, 'index.html'), path.join(ROOT, 'index.html')]) {
    if (fs.existsSync(f)) return f;
  }
  return null;
}
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
    /* تسجيل الدخول */
    if (u.pathname === '/login') {
      if (!PASS) { res.writeHead(302, { location: '/' }); return res.end(); }
      if (req.method === 'POST') {
        const ip = clientIp(req);
        if (tooMany(ip)) {
          res.writeHead(429, { 'content-type': 'text/html; charset=utf-8' });
          return res.end(loginPage('محاولات كثيرة. عاود من بعد 10 دقايق.'));
        }
        const body = await readBody(req, 2048);
        const given = new URLSearchParams(body).get('password') || '';
        if (safeEqual(crypto.createHash('sha256').update(given).digest('hex'), crypto.createHash('sha256').update(PASS).digest('hex'))) {
          attempts.delete(ip);
          res.writeHead(302, {
            location: '/',
            'set-cookie': COOKIE + '=' + TOKEN + '; Path=/; Max-Age=' + MAX_AGE + '; HttpOnly; Secure; SameSite=Lax'
          });
          return res.end();
        }
        fail(ip);
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(loginPage('كلمة السر غالطة'));
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(loginPage(''));
    }

    /* كل شي ما عدا /login خاصو دخول */
    if (!isAuthed(req)) {
      if (u.pathname.startsWith('/api/')) return json(res, 401, { error: 'خاصك تسجل الدخول' });
      res.writeHead(302, { location: '/login' });
      return res.end();
    }

    if (u.pathname === '/api/usage') {
      const t = process.env.APIFY_TOKEN;
      if (!t) return json(res, 200, { error: 'APIFY_TOKEN ناقص' });
      const r = await fetch('https://api.apify.com/v2/users/me/limits', { headers: { authorization: 'Bearer ' + t }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) return json(res, 200, { error: 'Apify HTTP ' + r.status });
      const d = (await r.json()).data || {};
      const used = d.current && d.current.monthlyUsageUsd;
      const max = d.limits && d.limits.maxMonthlyUsageUsd;
      return json(res, 200, { used: used, max: max, cycleEnd: d.monthlyUsageCycle && d.monthlyUsageCycle.endAt });
    }
    if (u.pathname === '/api/tiktok-test') {
      const q = (u.searchParams.get('q') || '').slice(0, 60);
      const region = (u.searchParams.get('region') || 'MA').toUpperCase().slice(0, 2);
      const key = 'tt:' + region + ':' + q;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.t < TTL) return json(res, 200, hit.v);
      const items = await tiktok.fetchTikTok(q, region, 30);
      const v = { query: q, region, count: items.length, rawKeys: items[0] ? Object.keys(items[0]) : [], sample: items.slice(0, 6).map(tiktok.pick) };
      cache.set(key, { t: Date.now(), v });
      return json(res, 200, v);
    }
    if (u.pathname === '/api/niches') {
      return json(res, 200, NICHES.map((n) => ({ id: n.id, ar: n.ar })));
    }
    if (u.pathname === '/api/ads-test') {
      const q = (u.searchParams.get('q') || '').slice(0, 80);
      if (!q) return json(res, 400, { error: 'استعمل /api/ads-test?q=كلمة' });
      const key = 'ads:' + q;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.t < TTL) return json(res, 200, hit.v);
      const items = await ads.fetchAds(q, 30);
      const v = { query: q, count: items.length, advertisers: ads.summarize(items).slice(0, 15), sample: items.slice(0, 5).map(ads.pick), rawKeys: items[0] ? Object.keys(items[0]) : [] };
      cache.set(key, { t: Date.now(), v });
      return json(res, 200, v);
    }
    if (u.pathname === '/api/ads-products') {
      const niche = NICHES.find((n) => n.id === u.searchParams.get('niche'));
      if (!niche) return json(res, 400, { error: 'نيش غير معروف' });
      const limit = Math.min(Math.max(parseInt(u.searchParams.get('limit'), 10) || 10, 1), 30);
      const key = 'adsp:' + niche.id + ':' + limit;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.t < TTL) return json(res, 200, hit.v);
      const v = await adsEngine.adsProducts(niche.id, limit);
      cache.set(key, { t: Date.now(), v });
      return json(res, 200, v);
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
      if (!f) { res.writeHead(404); return res.end('index.html not found'); }
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
  console.log('خدام على البورت ' + PORT + (PASS ? ' (بكلمة سر)' : ' (بلا كلمة سر: حط APP_PASSWORD)'));
});
