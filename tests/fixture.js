'use strict';
/* HTML نموذجي على شكل صفحات بحث Jumia (article.prd). كيتبدل إلا بدلات Jumia الشكل. */
function card(i, o) {
  o = o || {};
  const title = o.title || ('Produit ' + o.q + ' ' + i);
  const price = o.price || (49 + i * 10);
  return '<article class="prd _fb col c-prd"><a class="core" href="/' + (o.slug || ('produit-' + o.q + '-' + i)) + '.html" data-gtm-name="' + title + '" data-gtm-price="' + price + '" data-gtm-brand="Marque' + i + '">' +
    '<div class="img-c"><img class="img" alt="' + title + '" data-src="https://ma.jumia.is/unsafe/fit-in/300x300/product/' + i + '.jpg" src="data:image/gif;base64,R0lGOD"></div>' +
    '<div class="info"><h3 class="name">' + title.replace('&', '&amp;') + '</h3>' +
    '<div class="prc">' + (price >= 1000 ? '1,299.00' : price + '.00') + ' Dhs</div>' +
    '<div class="s-prc-w"><div class="old">' + (price + 40) + '.00 Dhs</div><div class="bdg _dsct _sm">-' + (10 + i) + '%</div></div>' +
    (o.noRating ? '' : '<div class="rev"><div class="stars _s">4.' + (i % 10) + ' out of 5<div class="in" style="width:86%"></div></div>(' + (100 - i) + ')</div>') +
    '</div></a></article>';
}
function page(q, n, o) {
  let s = '<html><body><div class="-paxs row _no-g _4cl-3cm-shs">';
  for (let i = 1; i <= n; i++) s += card(i, Object.assign({ q }, o || {}));
  return s + '</div></body></html>';
}
module.exports = { card, page };
