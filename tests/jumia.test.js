'use strict';
process.env.JUMIA_DELAY_MS = '0';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { page, card } = require('./fixture.js');

let mode = 'ok';
const hits = [];
const mock = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  hits.push(req.url);
  if (mode === 'blocked') { res.writeHead(403); return res.end('<html>Access Denied</html>'); }
  if (mode === 'empty') { res.writeHead(200); return res.end('<html><body>rien</body></html>'); }
  const q = u.searchParams.get('q') || '';
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(page(q.replace(/\s+/g, '-'), 12));
});

let jumiaMod;
test.before(async () => {
  await new Promise((r) => mock.listen(0, r));
  process.env.JUMIA_BASE = 'http://127.0.0.1:' + mock.address().port;
  jumiaMod = require('../public/jumia.js');
});
test.after(() => mock.close());

test('parseCards: كيقرا كل الحقول', () => {
  const items = jumiaMod.parseCards(page('x', 3));
  assert.strictEqual(items.length, 3);
  const a = items[0];
  assert.strictEqual(a.title, 'Produit x 1');
  assert.strictEqual(a.priceMAD, 59);
  assert.strictEqual(a.oldPriceMAD, 99);
  assert.strictEqual(a.discount, 11);
  assert.strictEqual(a.rating, 4.1);
  assert.strictEqual(a.reviews, 99);
  assert.strictEqual(a.brand, 'Marque1');
  assert.match(a.image, /^https:\/\/ma\.jumia\.is\/.*1\.jpg$/); // data-src ماشي placeholder
  assert.match(a.link, /\/produit-x-1\.html$/);
});

test('parseCards: العنوان فيه & ، الثمن بألف، وبلا تقييم', () => {
  const html = card(1, { q: 'a', title: 'Chaise & Table', price: 1500, noRating: true });
  const [it] = jumiaMod.parseCards(html);
  assert.strictEqual(it.title, 'Chaise & Table');
  assert.strictEqual(it.priceMAD, 1299);
  assert.strictEqual(it.rating, 0);
  assert.strictEqual(it.reviews, 0);
});

test('num: صيغ الأثمنة', () => {
  assert.strictEqual(jumiaMod.num('1,299.00 Dhs'), 1299);
  assert.strictEqual(jumiaMod.num('1 299,00'), 1299);
  assert.strictEqual(jumiaMod.num('99.00'), 99);
  assert.strictEqual(jumiaMod.num(''), 0);
});

test('interleave: تناوب + حذف المكرر', () => {
  const A = [{ link: '/a1' }, { link: '/a2' }, { link: '/dup' }];
  const B = [{ link: '/dup' }, { link: '/b2' }];
  const out = jumiaMod.interleave([A, B], 10).map((x) => x.link);
  assert.deepStrictEqual(out, ['/a1', '/dup', '/a2', '/b2']);
});

test('jumia(): كيجمع كلمات البحث، يحترم limit، ويرتب', async () => {
  mode = 'ok'; hits.length = 0;
  const out = await jumiaMod.jumia({ id: 'beauty', ar: 'x' }, 10);
  assert.strictEqual(out.source, 'jumia');
  assert.strictEqual(out.items.length, 10);
  assert.deepStrictEqual(out.items.map((i) => i.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.strictEqual(hits.length, jumiaMod.QUERIES.beauty.length);
  assert.ok(hits.every((h) => h.includes('sort=popularity')));
  assert.ok(out.items.every((i) => i.price === i.priceMAD / 10 && i.priceMAD > 0));
  const links = out.items.map((i) => i.link);
  assert.strictEqual(new Set(links).size, links.length);
});

test('jumia(): إلا تحجبنا كيوقف من أول طلب برسالة واضحة', async () => {
  mode = 'blocked'; hits.length = 0;
  await assert.rejects(() => jumiaMod.jumia({ id: 'beauty', ar: 'x' }, 10), /حجب/);
  assert.strictEqual(hits.length, 1);
});

test('jumia(): صفحة فارغة كتعطي خطأ', async () => {
  mode = 'empty';
  await assert.rejects(() => jumiaMod.jumia({ id: 'home', ar: 'x' }, 5), /فارغة/);
});

test('API: /api/products كيرجع Jumia، ويطيح للديمو إلا تحجبنا', async () => {
  const { spawn } = require('node:child_process');
  mode = 'ok';
  const port = 3999;
  const srv = spawn(process.execPath, ['server.js'], { cwd: require('path').join(__dirname, '..'), env: Object.assign({}, process.env, { PORT: String(port), APP_PASSWORD: '' }) });
  try {
    await new Promise((r) => setTimeout(r, 700));
    let j = await (await fetch('http://127.0.0.1:' + port + '/api/products?niche=tech&limit=8&source=jumia')).json();
    assert.strictEqual(j.source, 'jumia');
    assert.strictEqual(j.items.length, 8);
    mode = 'blocked';
    j = await (await fetch('http://127.0.0.1:' + port + '/api/products?niche=home&limit=5&source=jumia')).json();
    assert.strictEqual(j.source, 'demo');
    assert.ok(j.warnings.join(' ').includes('حجب'));
    const bad = await fetch('http://127.0.0.1:' + port + '/api/ads-test?q=x');
    assert.notStrictEqual(bad.status, 200);
  } finally { srv.kill(); }
});
