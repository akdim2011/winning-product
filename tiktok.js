'use strict';
/* TikTok Creative Center (Top Ads) عبر Apify: تجربة */
const ACTOR = process.env.TIKTOK_ACTOR || 'fetch_cat~tiktok-ads-library-scraper';

async function fetchTikTok(keyword, region, maxItems) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN ناقص');
  const url = 'https://api.apify.com/v2/acts/' + ACTOR + '/run-sync-get-dataset-items?format=json&clean=true&timeout=110';
  const body = { keywords: keyword ? [keyword] : [], regions: [region || 'MA'], period: '30', sortBy: 'for_you', maxItems: maxItems || 30 };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });
  if (!r.ok) throw new Error('Apify HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

function pick(a) {
  return {
    text: String(a.adText || a.adTitle || '').slice(0, 140), brand: a.brandName || a.advertiserName || '',
    likes: a.likes, ctr: a.ctr, cost: a.costIndex, country: a.countryCode, language: a.language,
    cover: a.coverImageUrl || a.coverUrl || '', video: a.videoUrl || '', landing: a.landingPageUrl || '', detail: a.detailUrl || ''
  };
}
module.exports = { fetchTikTok, pick };
