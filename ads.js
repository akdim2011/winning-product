'use strict';
/* المرحلة 3 (تجربة): إعلانات Facebook Ad Library للمغرب عبر Apify */
const ACTOR = process.env.ADS_ACTOR || 'fetch_cat~facebook-ads-library-scraper';

async function fetchAds(query, maxItems) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN ناقص');
  const url = 'https://api.apify.com/v2/acts/' + ACTOR + '/run-sync-get-dataset-items?format=json&clean=true&timeout=110';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ query, country: 'MA', activeStatus: 'active', adType: 'all', mediaType: 'all', maxItems, enrichLandingPages: false, validateMediaUrls: false }),
    signal: AbortSignal.timeout(120000)
  });
  if (!r.ok) throw new Error('Apify HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

function daysSince(s) {
  const t = Date.parse(s);
  return isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 86400000)) : null;
}

/* ملخص بسيط: كل معلن شحال عندو إعلانات وأقدم إعلان */
function summarize(items) {
  const by = {};
  items.forEach((a) => {
    const k = a.advertiserName || (a.pageMetadata && a.pageMetadata.name) || '?';
    const d = daysSince(a.startedAt);
    const o = by[k] || (by[k] = { advertiser: k, ads: 0, oldestDays: null });
    o.ads++;
    if (d != null && (o.oldestDays == null || d > o.oldestDays)) o.oldestDays = d;
  });
  return Object.values(by).sort((a, b) => (b.oldestDays || 0) - (a.oldestDays || 0));
}

function pick(a) {
  return {
    advertiser: a.advertiserName, started: a.startedAt, days: daysSince(a.startedAt), status: a.adStatus,
    text: String(a.adText || a.adTitle || '').slice(0, 160), type: a.creativeType, platforms: a.platforms,
    landing: a.landingUrl, image: (a.imageUrls && a.imageUrls[0]) || '', snapshot: a.snapshotUrl
  };
}

module.exports = { fetchAds, summarize, pick };
