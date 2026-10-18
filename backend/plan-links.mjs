// Booking, ticket and ride links for a planned stop.
//
// The desk never invents a merchant page: every link is a search or deep link on
// a real provider, prefilled with the place (or the city for hotels). Choice of
// provider follows the region: 大众点评 / 滴滴 inside China, Tabelog in Japan,
// Klook in the rest of Asia, OpenTable / GetYourGuide elsewhere, and Uber with
// Grab as the second option in South-East Asia.

const SEA = new Set(['TH', 'SG', 'MY', 'ID', 'VN', 'PH', 'KH', 'MM', 'LA']);
const ASIA = new Set(['CN', 'JP', 'KR', 'TW', 'HK', 'TH', 'SG', 'MY', 'ID', 'VN', 'PH', 'KH', 'MM', 'LA', 'IN']);

// A small, honest gazetteer: enough to place the destinations the desk is asked
// about most often, with a global fallback when the city is unknown.
const CITIES = [
  ['京都', 'JP'], ['东京', 'JP'], ['大阪', 'JP'], ['奈良', 'JP'], ['北海道', 'JP'], ['札幌', 'JP'], ['冲绳', 'JP'],
  ['首尔', 'KR'], ['釜山', 'KR'], ['台北', 'TW'], ['香港', 'HK'], ['澳门', 'HK'],
  ['曼谷', 'TH'], ['清迈', 'TH'], ['普吉', 'TH'], ['苏梅', 'TH'], ['新加坡', 'SG'], ['吉隆坡', 'MY'], ['槟城', 'MY'],
  ['巴厘岛', 'ID'], ['雅加达', 'ID'], ['河内', 'VN'], ['胡志明', 'VN'], ['岘港', 'VN'], ['马尼拉', 'PH'],
  ['北京', 'CN'], ['上海', 'CN'], ['广州', 'CN'], ['深圳', 'CN'], ['成都', 'CN'], ['重庆', 'CN'], ['西安', 'CN'],
  ['杭州', 'CN'], ['苏州', 'CN'], ['南京', 'CN'], ['厦门', 'CN'], ['青岛', 'CN'], ['大连', 'CN'], ['长沙', 'CN'],
  ['武汉', 'CN'], ['昆明', 'CN'], ['大理', 'CN'], ['丽江', 'CN'], ['香格里拉', 'CN'], ['桂林', 'CN'], ['阳朔', 'CN'],
  ['张家界', 'CN'], ['三亚', 'CN'], ['拉萨', 'CN'], ['乌鲁木齐', 'CN'], ['哈尔滨', 'CN'],
  ['巴黎', 'FR'], ['尼斯', 'FR'], ['罗马', 'IT'], ['米兰', 'IT'], ['威尼斯', 'IT'], ['佛罗伦萨', 'IT'],
  ['伦敦', 'GB'], ['爱丁堡', 'GB'], ['巴塞罗那', 'ES'], ['马德里', 'ES'], ['里斯本', 'PT'], ['阿姆斯特丹', 'NL'],
  ['柏林', 'DE'], ['慕尼黑', 'DE'], ['苏黎世', 'CH'], ['维也纳', 'AT'], ['布拉格', 'CZ'], ['雅典', 'GR'],
  ['伊斯坦布尔', 'TR'], ['莫斯科', 'RU'], ['圣彼得堡', 'RU'],
  ['纽约', 'US'], ['旧金山', 'US'], ['洛杉矶', 'US'], ['西雅图', 'US'], ['芝加哥', 'US'], ['波士顿', 'US'],
  ['温哥华', 'CA'], ['多伦多', 'CA'], ['墨西哥城', 'MX'],
  ['悉尼', 'AU'], ['墨尔本', 'AU'], ['布里斯班', 'AU'], ['奥克兰', 'NZ'],
  ['开罗', 'EG'], ['开普敦', 'ZA'], ['内罗毕', 'KE'], ['马拉喀什', 'MA'],
  ['迪拜', 'AE'], ['多哈', 'QA'], ['特拉维夫', 'IL']
].sort((a, b) => b[0].length - a[0].length);

// Rough, honest list: a 地铁 option only appears where one actually runs.
const METRO = new Set([
  '京都', '东京', '大阪', '札幌', '福冈', '名古屋', '首尔', '釜山', '台北', '高雄', '香港', '澳门',
  '新加坡', '吉隆坡', '曼谷', '雅加达', '马尼拉', '河内', '胡志明',
  '北京', '上海', '广州', '深圳', '成都', '重庆', '西安', '杭州', '苏州', '南京', '武汉', '长沙',
  '昆明', '青岛', '大连', '天津', '郑州', '沈阳', '哈尔滨', '乌鲁木齐',
  '巴黎', '伦敦', '罗马', '米兰', '巴塞罗那', '马德里', '里斯本', '阿姆斯特丹', '柏林', '慕尼黑',
  '维也纳', '布拉格', '雅典', '伊斯坦布尔', '莫斯科', '圣彼得堡', '迪拜', '开罗',
  '纽约', '旧金山', '洛杉矶', '芝加哥', '波士顿', '西雅图', '多伦多', '温哥华',
  '悉尼', '墨尔本', '布里斯班', '奥克兰', '墨西哥城', '开普敦'
]);

const enc = value => encodeURIComponent(String(value || '').trim());

export function detectRegion(text) {
  const value = String(text || '');
  for (const [city, country] of CITIES) {
    if (value.includes(city)) return { city, country };
  }
  return null;
}

function foodLink(name, country, language) {
  if (country === 'CN') {
    return { kind: 'book', label: language === 'en' ? 'Book' : '订座', provider: 'dianping', url: 'https://www.dianping.com/search/keyword/0_0_' + enc(name) };
  }
  if (country === 'JP') {
    return { kind: 'book', label: language === 'en' ? 'Book' : '订座', provider: 'tabelog', url: 'https://tabelog.com/rstLst/?sw=' + enc(name) };
  }
  return { kind: 'book', label: language === 'en' ? 'Book' : '订座', provider: 'opentable', url: 'https://www.opentable.com/s?term=' + enc(name) };
}

function ticketLink(name, country, language) {
  const label = language === 'en' ? 'Tickets' : '门票';
  if (ASIA.has(country)) {
    return { kind: 'ticket', label, provider: 'klook', url: 'https://www.klook.com/search/result/?query=' + enc(name) };
  }
  return { kind: 'ticket', label, provider: 'getyourguide', url: 'https://www.getyourguide.com/s/?q=' + enc(name) };
}

function stayLink(city, language) {
  return {
    kind: 'stay',
    label: language === 'en' ? 'Stays' : '住宿',
    provider: 'booking',
    url: 'https://www.booking.com/searchresults.html?ss=' + enc(city || 'Kyoto')
  };
}

function mapsDir(name, language) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + enc(name)
    + '&travelmode=transit&hl=' + (language === 'en' ? 'en' : 'zh-CN');
}

function mapsStop(name, language) {
  return 'https://www.google.com/maps/search/?api=1&query='
    + enc(name) + (language === 'en' ? '+bus+stop' : '+公交站');
}

// 地铁 / 公交 / 打车, in the order a traveller decides between them.
function waysFor(name, region, language) {
  const country = region?.country || '';
  const city = region?.city || '';
  const modes = [];
  if (METRO.has(city)) {
    modes.push({
      mode: 'metro',
      label: language === 'en' ? 'Metro' : '地铁',
      provider: country === 'CN' ? 'amap' : 'google',
      url: country === 'CN'
        ? 'https://uri.amap.com/search?keyword=' + enc(name) + '&city=' + enc(city)
        : mapsDir(name, language)
    });
  }
  modes.push({
    mode: 'bus',
    label: language === 'en' ? 'Bus' : '公交',
    provider: country === 'CN' ? 'amap' : 'google',
    url: country === 'CN'
      ? 'https://uri.amap.com/search?keyword=' + enc(name + ' 公交站') + '&city=' + enc(city)
      : mapsStop(name, language)
  });
  if (country === 'CN') {
    modes.push({ mode: 'didi', label: '滴滴', provider: 'didi', url: 'https://common.diditaxi.com.cn/general/webEntry' });
  } else {
    modes.push({
      mode: 'uber',
      label: 'Uber',
      provider: 'uber',
      url: 'https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=' + enc(name)
    });
    if (SEA.has(country)) modes.push({ mode: 'grab', label: 'Grab', provider: 'grab', url: 'https://www.grab.com/' });
  }
  return modes;
}

// One primary action per category plus a way to get there.
export function linksFor(item, region, language) {
  const country = region?.country || '';
  const city = region?.city || '';
  const name = String(item?.place || '');
  const kind = String(item?.kind || '');
  const links = [];
  if (/吃|食|餐|饭|market|food|eat/i.test(kind)) links.push(foodLink(name, country, language));
  else if (/喝|饮|咖啡|茶|酒|bar|cafe|drink/i.test(kind)) links.push(foodLink(name, country, language));
  else if (/住|宿|酒店|hotel|stay|lodg/i.test(kind)) links.push(stayLink(city || name, language));
  else if (/乐|购物|演出|夜|shop|show|night/i.test(kind)) links.push(ticketLink(name, country, language));
  else links.push(ticketLink(name, country, language));
  links.push({
    kind: 'ways',
    label: language === 'en' ? 'Getting there' : '怎么去',
    modes: waysFor(name, region, language)
  });
  links.push({
    kind: 'reviews',
    label: language === 'en' ? 'Reviews' : '游客评价',
    provider: 'google',
    url: 'https://www.google.com/maps/search/?api=1&query=' + enc([name, city].filter(Boolean).join(' '))
  });
  return links;
}
