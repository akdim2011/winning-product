/* UMD: كيخدم فـ Node (السيرفر والاختبارات) وفالتطبيق (WebView ديال أندرويد) بنفس الكود */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JumiaScraper = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
/* سكريبت Jumia المغرب المجاني: كيقرا صفحات البحث (مرتبة بالشعبية) مباشرة، بلا Apify ولا API مدفوع.
   خاصو يخدم من كومبيوترك (IP مغربي ديال الدار). السيرفرات ديال الكلاود (Render...) ممكن Jumia تحجبها. */

const ENV = (typeof process !== 'undefined' && process.env) || {};
const BASE = (ENV.JUMIA_BASE || 'https://www.jumia.ma').replace(/\/$/, '');
const MAD_PER_USD = parseFloat(ENV.MAD_PER_USD) || 10; // نفس fx ديال المغرب فالواجهة
const DELAY_MS = parseInt(ENV.JUMIA_DELAY_MS, 10) >= 0 ? parseInt(ENV.JUMIA_DELAY_MS, 10) : 1200;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// كلمات بحث قصيرة بالفرنسية (هي اللي كيستعملو المغاربة فـ jumia.ma). كل نيش فيه شي كلمات باش تكون نتائج متنوعة.
const QUERIES = {
  beauty: ['lisseur cheveux', 'appareil beauté visage', 'épilateur', 'massage visage'],
  home: ['robot cuisine', 'hachoir légumes', 'rangement cuisine', 'nettoyage maison'],
  tech: ['écouteurs sans fil', 'montre connectée', 'chargeur portable', 'support téléphone'],
  health: ['pistolet massage', 'correcteur posture', 'fitness élastique', 'masseur pieds'],
  baby: ['accessoires bébé', 'veilleuse bébé', 'biberon', 'jouet éducatif'],
  car: ['accessoires voiture', 'aspirateur voiture', 'support téléphone voiture', 'caméra voiture'],
  fashion: ['sac à main femme', 'montre homme', 'lunettes de soleil', 'portefeuille'],
  pets: ['accessoires chien', 'accessoires chat', 'brosse animaux', 'gamelle'],
  outdoor: ['camping', 'lampe frontale', 'gourde', 'sac à dos voyage'],
  tools: ['perceuse', 'visseuse', 'outils bricolage', 'niveau laser'],
  gifts: ['lampe décorative', 'bougie parfumée', 'guirlande lumineuse', 'cadre photo']
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
    .replace(/\s+/g, ' ').trim();
}
function stripTags(s) { return decode(String(s || '').replace(/<[^>]*>/g, ' ')); }

/* "1,299.00 Dhs" | "1 299,00 Dhs" | "99.00" */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s) return 0;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  let t = s;
  if (lastDot > -1 && lastComma > -1) t = lastDot > lastComma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (lastComma > -1) t = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}
/* أول ثمن فنص فيه مجال ("99.00 Dhs - 150.00 Dhs") */
function firstPrice(s) {
  const m = String(s || '').match(/\d[\d\s.,]*/);
  return m ? num(m[0]) : 0;
}

function attr(tag, name) {
  const m = String(tag || '').match(new RegExp('\\s' + name + '\\s*=\\s*"([^"]*)"', 'i'));
  return m ? decode(m[1]) : '';
}
function firstTag(html, name) {
  const m = html.match(new RegExp('<' + name + '\\b[^>]*>', 'i'));
  return m ? m[0] : '';
}
/* محتوى أول عنصر عندو class معين (كيحسب العناصر المتداخلة من نفس النوع) */
function byClass(html, cls) {
  const open = html.match(new RegExp('<(\\w+)[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>', 'i'));
  if (!open) return '';
  const tag = open[1].toLowerCase();
  const start = open.index + open[0].length;
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
  re.lastIndex = start;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  return html.slice(start);
}

/* كيقرا بطاقات المنتجات من HTML ديال صفحة بحث Jumia */
function parseCards(html) {
  const chunks = String(html).split(/<article\b[^>]*class="[^"]*\bprd\b[^"]*"[^>]*>/i).slice(1);
  const items = [];
  for (const raw of chunks) {
    const c = raw.split(/<\/article>/i)[0];
    const a = firstTag(c, 'a');
    const href = attr(a, 'href');
    if (!href) continue;
    const imgTag = firstTag(c, 'img');
    let image = attr(imgTag, 'data-src') || attr(imgTag, 'src');
    if (/^data:/i.test(image)) image = attr(imgTag, 'data-src');
    const title = stripTags(byClass(c, 'name')) || attr(a, 'data-gtm-name') || attr(a, 'data-ga4-item_name') || attr(imgTag, 'alt');
    const prcText = stripTags(byClass(c, 'prc'));
    const price = firstPrice(prcText) || num(attr(a, 'data-gtm-price')) || num(attr(a, 'data-ga4-price'));
    const old = firstPrice(stripTags(byClass(c, 'old')));
    const dsct = num(stripTags(byClass(c, '_dsct')));
    const rev = stripTags(byClass(c, 'rev'));
    const rating = num((rev.match(/([\d.,]+)\s*(?:out of|\/|sur)\s*5/i) || [])[1]);
    const reviews = num((rev.match(/\(\s*(\d[\d\s.,]*)\s*\)/) || [])[1]);
    if (!title || !(price > 0)) continue;
    items.push({
      title,
      image,
      link: /^https?:/i.test(href) ? href : BASE + (href.startsWith('/') ? '' : '/') + href,
      priceMAD: price,
      oldPriceMAD: old || 0,
      discount: dsct || (old > price ? Math.round((1 - price / old) * 100) : 0),
      rating,
      reviews,
      brand: attr(a, 'data-gtm-brand') || attr(a, 'data-ga4-item_brand') || ''
    });
  }
  return items;
}

function looksBlocked(status, html) {
  if (status === 403 || status === 429 || status === 503) return true;
  return /captcha|access denied|are you a robot|cf-chl|just a moment/i.test(String(html).slice(0, 4000)) && !/<article[^>]+class="[^"]*\bprd\b/i.test(html);
}

async function fetchPage(query, page) {
  const url = BASE + '/catalog/?q=' + encodeURIComponent(query) + '&sort=popularity' + (page > 1 ? '&page=' + page : '');
  const r = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'fr-MA,fr;q=0.9,ar;q=0.6,en;q=0.5'
    },
    redirect: 'follow',
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
  });
  const html = await r.text();
  if (looksBlocked(r.status, html)) {
    throw new Error('Jumia حجب الطلب (HTTP ' + r.status + '). عاود من بعد شوية، ولا بدل الشبكة (Wi-Fi / 4G).');
  }
  if (!r.ok) throw new Error('Jumia HTTP ' + r.status);
  return parseCards(html);
}

/* كيجمع نتائج كل الكلمات بالتناوب (باش يكون التنوع)، وكيحذف المكرر */
function interleave(lists, limit) {
  const seen = new Set(), out = [];
  for (let i = 0; out.length < limit; i++) {
    let any = false;
    for (const l of lists) {
      if (i >= l.length) continue;
      any = true;
      const it = l[i];
      const key = it.link.split('?')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
      if (out.length >= limit) break;
    }
    if (!any) break;
  }
  return out;
}

async function jumia(niche, limit) {
  const queries = QUERIES[niche.id] || [niche.ar];
  const lists = [], errors = [];
  for (let i = 0; i < queries.length; i++) {
    if (i) await sleep(DELAY_MS);
    try {
      const items = await fetchPage(queries[i], 1);
      if (items.length) lists.push(items);
    } catch (e) {
      errors.push(e.message);
      if (/حجب/.test(e.message)) break; // إلا تحجبنا، ما كنعاودوش نضغطو
    }
  }
  const merged = interleave(lists, limit).map((p, i) => ({
    rank: i + 1,
    title: p.title,
    image: p.image,
    link: p.link,
    price: p.priceMAD / MAD_PER_USD,
    priceMAD: p.priceMAD,
    rating: p.rating,
    reviews: p.reviews,
    discount: p.discount,
    brand: p.brand
  }));
  if (!merged.length) throw new Error(errors[0] || 'Jumia رجع نتيجة فارغة (يمكن تبدلات الصفحة).');
  return { source: 'jumia', items: merged };
}

return { jumia, parseCards, interleave, num, QUERIES };
});
