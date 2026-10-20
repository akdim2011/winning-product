'use strict';
/* محرك "الإعلانات أولا": كيجمع إعلانات Facebook المغربية وكيحولها لمنتجات مرتبة */
const { fetchAds } = require('./ads.js');

// كلمات بحث قصيرة (Facebook كيبحث على العبارة كاملة): COD + كلمات المنتجات ديال كل نيش
const NICHE_QUERIES = {
  beauty: ['سيروم', 'العناية بالشعر', 'soin visage', 'cheveux livraison', 'الدفع عند الاستلام بشرة'],
  home: ['ادوات المطبخ', 'ustensiles cuisine', 'gadget maison', 'مكنسة', 'الدفع عند الاستلام منزل'],
  tech: ['سماعات', 'montre connectée', 'accessoires téléphone', 'chargeur', 'الدفع عند الاستلام هاتف'],
  health: ['مساج', 'massage', 'تصحيح القوام', 'complément alimentaire', 'الدفع عند الاستلام صحة'],
  baby: ['bébé', 'ألعاب الأطفال', 'jouet enfant', 'مستلزمات الرضع', 'livraison bébé'],
  car: ['accessoires voiture', 'اكسسوارات السيارة', 'dashcam', 'aspirateur voiture', 'livraison voiture'],
  fashion: ['montre homme', 'sac femme', 'lunettes', 'ساعة', 'livraison mode'],
  pets: ['chien', 'chat', 'accessoires animaux', 'القطط', 'livraison animaux'],
  outdoor: ['camping', 'تخييم', 'voyage', 'lampe camping', 'livraison camping'],
  tools: ['outil bricolage', 'perceuse', 'أدوات', 'visseuse', 'livraison outil'],
  gifts: ['décoration', 'lampe LED', 'ديكور', 'cadeau', 'livraison décoration']
};
const BLOCK = /play\.google|apps\.apple|glovo|jumia|facebook\.com|instagram\.com|wa\.me|whatsapp|tiktok\.com|youtube|youtu\.be|bit\.ly|linktr/i;

function queriesFor(nicheId) {
  return NICHE_QUERIES[nicheId] || ['livraison gratuite'];
}
function days(s) { const t = Date.parse(s); return isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 86400000)) : null; }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function cleanTitle(t) {
  return String(t || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 90);
}
function keyOf(a) {
  const u = a.landingUrl || '';
  if (u && !BLOCK.test(u)) {
    try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, ''); } catch (e) { /* تابع */ }
  }
  return (a.advertiserName || '?') + '|' + cleanTitle(a.adText).slice(0, 40).toLowerCase();
}

function score(g) {
  const longevity = Math.min(g.days, 120) / 120 * 35;      // الإعلان بقا خدام مدة طويلة
  const volume = Math.min(g.ads, 8) / 8 * 25;              // بزاف ديال الإعلانات/الفيديوهات
  const sellers = Math.min(g.advertisers.length, 4) / 4 * 20; // بزاف ديال المعلنين لنفس المنتج
  const fresh = g.newestDays <= 14 ? 20 : g.newestDays <= 45 ? 10 : 0; // باقي كيتجدد
  return Math.round(longevity + volume + sellers + fresh);
}

function build(ads, limit) {
  const groups = new Map();
  const seen = new Set();
  ads.forEach((a) => {
    const id = a.libraryId || (a.advertiserName + a.startedAt + (a.adText || '').slice(0, 20));
    if (seen.has(id)) return; seen.add(id);
    if (a.landingUrl && BLOCK.test(a.landingUrl)) return;
    const d = days(a.startedAt);
    if (d == null || d > 400) return; // إعلانات قديمة بزاف ماشي منتج جديد
    const k = keyOf(a);
    let g = groups.get(k);
    if (!g) {
      g = { key: k, title: cleanTitle(a.adTitle || a.adText), image: '', link: '', snapshot: '', ads: 0, advertisers: [], days: 0, newestDays: 9999, text: cleanTitle(a.adText) };
      groups.set(k, g);
    }
    g.ads++;
    const adv = a.advertiserName || '?';
    if (g.advertisers.indexOf(adv) < 0) g.advertisers.push(adv);
    if (d > g.days) g.days = d;
    if (d < g.newestDays) g.newestDays = d;
    if (!g.image && a.imageUrls && a.imageUrls[0]) g.image = a.imageUrls[0];
    if (!g.link && a.landingUrl && !BLOCK.test(a.landingUrl)) g.link = a.landingUrl;
    if (!g.snapshot) g.snapshot = a.snapshotUrl || '';
  });
  return Array.from(groups.values())
    .map((g) => Object.assign(g, { score: score(g), host: host(g.link) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchRetry(q) {
  try { return await fetchAds(q, 25); }
  catch (e) {
    if (/402|concurrent/i.test(e.message)) { await sleep(8000); return fetchAds(q, 25); }
    throw e;
  }
}
/* 3 تشغيلات فنفس الوقت كحد أقصى (الخطة المجانية = 5) */
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = { ok: true, v: await fn(items[k]) }; } catch (e) { out[k] = { ok: false, e }; }
    }
  }));
  return out;
}

async function adsProducts(nicheId, limit) {
  const qs = queriesFor(nicheId);
  const results = await pool(qs, 3, fetchRetry);
  const all = [], warnings = [];
  results.forEach((r, i) => { if (r.ok) all.push.apply(all, r.v); else warnings.push(qs[i] + ': ' + r.e.message.slice(0, 120)); });
  if (!all.length) throw new Error(warnings[0] || 'ما لقينا إعلانات');
  return { source: 'ads', total: all.length, items: build(all, limit), warnings };
}

module.exports = { adsProducts, build, queriesFor };
