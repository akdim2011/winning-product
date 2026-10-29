(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WP_NICHES = factory();
})(typeof self !== 'undefined' ? self : this, function () {
// slug = Amazon Best Sellers category (https://www.amazon.com/zgbs/<slug>)
// demo = أسماء المنتجات فالنسخة التجريبية (كتخدم بلا انترنت ولا مفتاح)
var NICHES = [
  { id: 'beauty', ar: 'الجمال والعناية', slug: 'beauty', demo: ['Face roller massager','Hair straightener brush','Blackhead remover vacuum','Electric eyebrow trimmer','Heatless hair curler','LED face mask','Nail drill kit','Teeth whitening kit','Scalp massager','Ice facial globes'] },
  { id: 'home', ar: 'المنزل والمطبخ', slug: 'kitchen', demo: ['Vegetable chopper','Electric spin scrubber','Silicone food covers','Mini handheld blender','Magnetic spice rack','Vacuum storage bags','Garlic press rocker','Foldable dish rack','Air fryer liners','Oil sprayer bottle'] },
  { id: 'tech', ar: 'الإلكترونيات والإكسسوارات', slug: 'electronics', demo: ['Magnetic phone holder','Wireless earbuds','LED strip lights','Mini projector','Smart watch fitness','Portable charger 20000mAh','Ring light with tripod','Bluetooth speaker','Laptop stand','Cable organizer'] },
  { id: 'health', ar: 'الصحة والرياضة', slug: 'hpc', demo: ['Posture corrector','Massage gun mini','Foot massager','Knee support brace','Neck stretcher','Resistance bands set','Sleep eye mask','Heating pad','Compression socks','Jump rope digital'] },
  { id: 'baby', ar: 'الأطفال والرضع', slug: 'baby-products', demo: ['Baby nasal aspirator','Silicone feeding set','Night light projector','Baby bath seat','Teething toys','Portable bottle warmer','Kids water bottle','Baby carrier wrap','Stroller fan','Kids drawing tablet'] },
  { id: 'car', ar: 'السيارة', slug: 'automotive', demo: ['Car phone mount','Portable car vacuum','Car seat gap filler','Tire inflator','Car trunk organizer','Windshield sun shade','Dash cam','Car air freshener','Jump starter','Seat cover cushion'] },
  { id: 'fashion', ar: 'الموضة والأحذية', slug: 'fashion', demo: ['Crossbody sling bag','Polarized sunglasses','Slip-on sneakers','Minimalist watch','Leather wallet slim','Silk scarf','Bucket hat','Layered necklace set','Belt bag','Thermal leggings'] },
  { id: 'pets', ar: 'الحيوانات الأليفة', slug: 'pet-supplies', demo: ['Pet hair remover roller','Automatic water fountain','Dog harness no-pull','Cat laser toy','Pet grooming glove','Slow feeder bowl','Cat scratching pad','Dog poop bag holder','Pet nail grinder','Cooling pet mat'] },
  { id: 'outdoor', ar: 'السفر والتخييم', slug: 'sporting-goods', demo: ['Camping lantern','Portable neck fan','Insulated water bottle','Cooling towel','Packing cubes','Travel pillow','Hammock','Folding camp chair','Headlamp rechargeable','Dry bag waterproof'] },
  { id: 'tools', ar: 'الأدوات والبريكولاج', slug: 'hi', demo: ['Electric screwdriver','Laser level','Multi-tool pliers','Tool organizer','Cordless glue gun','Stud finder','Tape measure digital','Wire stripper','Cable tester','Magnetic wristband'] },
  { id: 'gifts', ar: 'الهدايا والديكور', slug: 'home-garden', demo: ['Galaxy projector lamp','LED neon sign','Scented candle set','Photo frame digital','Artificial plants set','Wall clock modern','Table lamp touch','Incense burner','Fairy string lights','Decorative tray'] }
];
return NICHES;
});
