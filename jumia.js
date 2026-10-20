'use strict';
/* مزود Jumia المغرب عبر Apify (APIFY_TOKEN). الأثمنة بالدرهم كنحولوها لدولار (÷ MAD_PER_USD) حيت الواجهة كتضرب فـ fx */
const ACTOR = process.env.JUMIA_ACTOR || 'crawloop~jumia-scraper';
const MARKET = (process.env.JUMIA_MARKET || 'MA').toUpperCase();
const MAD_PER_USD = parseFloat(process.env.MAD_PER_USD) || 10; // نفس fx ديال المغرب فالواجهة

// كلمات البحث بالفرنسية (هي اللي كيستعملو المغاربة فـ jumia.ma)
const QUERIES = {
  beauty: 'appareil beauté visage cheveux',
  home: 'ustensiles cuisine gadget maison',
  tech: 'accessoires téléphone écouteurs sans fil',
  health: 'massage santé sport fitness',
  baby: 'bébé accessoires puériculture',
  car: 'accessoires voiture auto',
  fashion: 'sac montre lunettes accessoires mode',
  pets: 'accessoires chien chat animaux',
  outdoor: 'camping voyage randonnée',
  tools: 'outils bricolage perceuse',
  gifts: 'décoration lampe cadeau'
};

function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s) return 0;
  // "1,299.00" أو "1.299,00" أو "1299,5"
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  let t = s;
  if (lastDot > -1 && lastComma > -1) t = lastDot > lastComma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (lastComma > -1) t = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

function mapItem(it, i) {
  const price = num(it.priceAmount != null ? it.priceAmount : (it.price != null ? it.price : it.priceLabel));
  return {
    rank: i + 1,
    title: String(it.title || '').trim(),
    image: it.imageUrl || it.image || '',
    link: it.productUrl || it.url || '',
    price: price / MAD_PER_USD,
    priceMAD: price,
    rating: num(it.rating),
    reviews: num(it.reviewCount != null ? it.reviewCount : it.ratingCount),
    discount: num(it.discountPercent),
    brand: it.brand || ''
  };
}

async function jumia(niche, limit) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  const q = QUERIES[niche.id] || niche.ar;
  const url = 'https://api.apify.com/v2/acts/' + ACTOR + '/run-sync-get-dataset-items?format=json&clean=true&timeout=100';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ query: q, country: MARKET, maxPages: 1, maxItems: limit }),
    signal: AbortSignal.timeout(110000)
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 200);
    throw new Error('Apify HTTP ' + r.status + ' ' + t);
  }
  const data = await r.json();
  const list = (Array.isArray(data) ? data : [])
    .map(mapItem)
    .filter((p) => p.title && p.price > 0)
    .slice(0, limit)
    .map((p, i) => Object.assign(p, { rank: i + 1 }));
  if (!list.length) throw new Error('Jumia رجع نتيجة فارغة (تأكد من JUMIA_MARKET)');
  return { source: 'jumia', items: list };
}

module.exports = { jumia, mapItem, num };
