'use strict';
/* محرك "الإعلانات أولا": كيجمع إعلانات Facebook المغربية وكيحولها لمنتجات مرتبة */
const { fetchAds } = require('./ads.js');

// كلمات COD بالعربية/الدارجة/الفرنسية + كلمة النيش
const COD = ['الدفع عند الاستلام', 'paiement à la livraison', 'اطلب الآن الثمن'];
const NICHE_WORDS = {
  beauty: ['العناية بالبشرة والشعر', 'beauté cheveux'],
  home: ['المطبخ والمنزل', 'cuisine maison'],
  tech: ['اكسسوارات الهاتف', 'accessoires téléphone'],
  health: ['الصحة والمساج', 'massage santé'],
  baby: ['الأطفال والرضع', 'bébé enfant'],
  car: ['السيارة', 'voiture auto'],
  fashion: ['الموضة والساعات', 'mode montre sac'],
  pets: ['الحيوانات الأليفة', 'chien chat'],
  outdoor: ['التخييم والسفر', 'camping voyage'],
  tools: ['الأدوات والبريكولاج', 'outil bricolage'],
  gifts: ['الديكور والهدايا', 'décoration cadeau']
};
const BLOCK = /play\.google|apps\.apple|glovo|jumia|facebook\.com|instagram\.com|wa\.me|whatsapp|tiktok\.com|youtube|youtu\.be|bit\.ly|linktr/i;

function queriesFor(nicheId) {
  const w = NICHE_WORDS[nicheId] || [''];
  return [COD[0] + ' ' + w[0], COD[1] + ' ' + (w[1] || ''), COD[2] + ' ' + w[0]].map((s) => s.trim());
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

async function adsProducts(nicheId, limit) {
  const qs = queriesFor(nicheId);
  const results = await Promise.allSettled(qs.map((q) => fetchAds(q, 30)));
  const all = [], warnings = [];
  results.forEach((r, i) => { if (r.status === 'fulfilled') all.push.apply(all, r.value); else warnings.push(qs[i] + ': ' + r.reason.message); });
  if (!all.length) throw new Error(warnings[0] || 'ما لقينا إعلانات');
  return { source: 'ads', total: all.length, items: build(all, limit), warnings };
}

module.exports = { adsProducts, build, queriesFor };
