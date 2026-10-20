// Metadata is a conservative candidate filter, not proof of the visible subject.
// Keep descriptions out: an industrial scene mentioning a nearby cafe is not a cafe photo.
export const photoWords = value => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/<[^>]*>/g, ' ').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

export const hasPhotoPhrase = (value, phrase) => {
  const needle = photoWords(phrase);
  return Boolean(needle) && ` ${photoWords(value)} `.includes(` ${needle} `);
};

export function photoLocationText(photo) {
  const description = String(photo.description || '').replace(/<[^>]*>/g,' ').trim();
  // Narrative comparisons and incidental city mentions are not a photo geotag.
  const directCaption = description.length <= 240 && !/\b(?:except|unlike|instead|not|compared|inspired|rather than)\b/i.test(description) ? description : '';
  return [photo.title, ...(photo.tags || []).map(tag => typeof tag === 'string' ? tag : tag.name), directCaption].filter(Boolean).join(' ');
}

const subjects = {
  eat: /\b(?:foods?|cuisines?|dishes|dish|meals?|dining|restaurants?|breakfast|dinner|lunch|noodles?|seafood|rice|curry|pizza|tacos?|bread|soup|grill|burgers?|sushi|steak|eggs?|dumplings?|pastries|pastry|pancakes?|sandwiches|sandwich|omelette)\b|餐厅|餐馆|美食|菜肴|面条|料理/u,
  drink: /\b(?:cafes?|coffee|espresso|cappuccino|latte|tea houses?|teahouses?|tea shops?|teashops?|beverages?|juice|drinks?|cocktails?)\b|咖啡|茶馆|茶楼|饮品|饮料/u,
  play: /\b(?:landmarks?|attractions?|monuments?|temples?|palaces?|castles?|mountains?|waterfalls?|beaches|beach|parks?|lakes?|bridges?|gardens?|museums?|towers?|historic|heritage|viewpoints?|islands?|walls?|ruins?|forts?|cathedrals?|mosques?|abbeys?|basilicas?|pagodas?)\b|景区|遗址|寺|庙|宫|长城|博物馆|山|湖|桥|园/u,
  joy: /\b(?:theatres?|theaters?|performances?|performing|concerts?|music|festivals?|dance|dancing|opera|nightlife|entertainment|orchestras?|jazz|carnivals?)\b|演出|剧院|音乐|节庆|舞蹈/u,
  stay: /\b(?:hotels?|hostels?|resorts?|guest houses?|guesthouses?|guest rooms?|accommodation|bedrooms?|lodges?|suites?|motels?)\b|酒店|旅馆|民宿|客房/u,
  go: /\b(?:transit|transport|transportation|rail|railway|railroads?|trains?|buses|bus|metro|subway|trams?|taxis?|stations?|ferries|ferry|cycling|bicycles?)\b|公交|地铁|有轨电车|出租车|列车|渡轮/u
};
const unsuitable = /\b(?:mascots?|souvenirs?|figurines?|toys?|selfies?|portraits?|t shirts?|posters?|logos?|stickers?|paintings?|engravings?|drawings?|postcards?|maps?|insect hotels?|cctv|surveillance|security cameras?|destination boards?|direction boards?)\b/u;
const reviewedRejections = new Map([
  ['https://www.flickr.com/photos/21203533@N00/129041673', 'visual-review: tourist group portrait, not a destination view'],
  ['https://www.flickr.com/photos/76722295@N00/4198492342', 'visual-review: Carrara in Italy, not Marble Mountains in Vietnam']
]);

export function photoSubjectRejection(photo, kind, place = {}) {
  const source = photo.sourceUrl || photo.foreign_landing_url || '';
  if (reviewedRejections.has(source)) return reviewedRejections.get(source);
  const title = photoWords(photo.title);
  if (unsuitable.test(title)) return 'unsuitable-photo-subject';
  if (/\b(?:18\d{2}|19[0-5]\d)\b/u.test(title)) return 'archive-photo-needs-current-view';
  if (kind === 'hero') return null;
  // A proper landmark name is subject evidence even without an English noun such as "mountain".
  if (kind === 'play' && [place.name_en,place.name].filter(Boolean).some(name => hasPhotoPhrase(title,name))) return null;
  const subject = photoWords([photo.title, ...(photo.tags || []).map(tag => typeof tag === 'string' ? tag : tag.name)].join(' '));
  if (kind === 'drink' && place.countryCode !== 'CN' && /\b(?:tea houses?|teahouses?|tea shops?|teashops?)\b|茶馆|茶楼/u.test(subject)) return 'non-china-teahouse';
  const primary = title.split(/\b(?:at|near|outside|in front of|behind)\b/u)[0];
  if (!subjects[kind]?.test(primary) && Object.values(subjects).some(pattern => pattern.test(primary))) return 'title-identifies-another-category';
  return subjects[kind]?.test(subject) ? null : 'category-not-supported-by-title-or-tags';
}

export function matchesDestinationPhoto(photo, place, aliases = []) {
  const identity = photoLocationText(photo);
  const city = place.city_en || place.city;
  const countries = [place.countryNameEn,place.country_en,place.countryName,place.country].filter(Boolean);
  return [place.name_en,place.name,...aliases].filter(Boolean).some(name => hasPhotoPhrase(identity,name))
    && (city ? hasPhotoPhrase(identity,city) : countries.some(name => hasPhotoPhrase(identity,name)));
}
