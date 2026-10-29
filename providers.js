'use strict';
const { jumia } = require('./public/jumia.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function decode(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function num(s) { const n = parseFloat(String(s || '').replace(/,/g, '')); return isFinite(n) ? n : 0; }

/* Amazon Best Sellers: قراءة صفحة Amazon Best Sellers مباشرة: مجاني ولكن Amazon كيحجب بزاف */
async function amazon(niche, limit) {
  const r = await fetch('https://www.amazon.com/zgbs/' + niche.slug, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error('Amazon HTTP ' + r.status);
  const html = await r.text();
  const chunks = html.split('id="gridItemRoot"').slice(1);
  if (!chunks.length) throw new Error('Amazon حجب الطلب أو تبدلات الصفحة');
  const items = [];
  chunks.forEach((c, i) => {
    const asin = (c.match(/\/dp\/([A-Z0-9]{10})/) || [])[1];
    const img = (c.match(/<img[^>]+>/) || [''])[0];
    const image = (img.match(/src="(https:[^"]+)"/) || [])[1] || '';
    const title = decode((img.match(/alt="([^"]*)"/) || [])[1]);
    if (!asin || !title) return;
    items.push({
      rank: parseInt((c.match(/#(\d{1,3})\b/) || [])[1], 10) || i + 1,
      title,
      image,
      link: 'https://www.amazon.com/dp/' + asin,
      price: num((c.match(/\$\s?([\d,]+(?:\.\d+)?)/) || [])[1]),
      rating: num((c.match(/([\d.]+) out of 5 stars/) || [])[1]),
      reviews: num((c.match(/a-size-small[^>]*>\s*([\d,]{1,9})\s*</) || [])[1])
    });
  });
  if (!items.length) throw new Error('ما قدرناش نقراو المنتجات من Amazon');
  return { source: 'amazon', items: items.slice(0, limit) };
}

/* 3) نسخة تجريبية: كتخدم دايما، الأرقام والصور مجرد نموذج */
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function placeholder(title, hue) {
  const t = title.split(' ').slice(0, 2).join(' ').replace(/[<>&"]/g, '');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="hsl(' + hue + ',45%,88%)"/><circle cx="100" cy="86" r="38" fill="hsl(' + hue + ',50%,62%)"/><text x="100" y="168" font-family="sans-serif" font-size="15" text-anchor="middle" fill="hsl(' + hue + ',40%,28%)">' + t + '</text></svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function demo(niche, limit) {
  const items = niche.demo.slice(0, limit).map((title, i) => {
    const h = hash(niche.id + title);
    return {
      rank: i + 1,
      title,
      image: placeholder(title, h % 360),
      link: 'https://www.amazon.com/s?k=' + encodeURIComponent(title),
      price: 9 + (h % 3200) / 100,
      rating: 4.1 + (h % 7) / 10,
      reviews: Math.round(40000 / (i + 1.5) + (h % 3000))
    };
  });
  return { source: 'demo', items };
}

async function getProducts(niche, limit, source) {
  const warnings = [];
  if (process.env.FORCE_DEMO !== '1') {
    const order = source === 'amazon' ? [amazon] : source === 'jumia' ? [jumia] : [jumia, amazon];
    for (const fn of order) {
      try {
        const out = await fn(niche, limit);
        if (out) return Object.assign(out, { warnings });
      } catch (e) {
        warnings.push(fn.name + ': ' + e.message);
      }
    }
  }
  const d = demo(niche, limit);
  d.warnings = warnings;
  return d;
}

module.exports = { getProducts };
