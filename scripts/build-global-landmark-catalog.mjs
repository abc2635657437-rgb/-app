import assert from 'node:assert/strict';
import { readFile, rename, writeFile } from 'node:fs/promises';

const catalogUrl = new URL('../modules/data/map-place-catalog.json', import.meta.url);
const supplementalUrl = new URL('../modules/data/wikidata-landmark-supplement.json', import.meta.url);
const outputUrl = new URL('../modules/data/global-landmark-guide-catalog.json', import.meta.url);
const reportUrl = new URL('../modules/data/global-landmark-guide-report.json', import.meta.url);
let entityValidation = { places: {} };
try { entityValidation = JSON.parse(await readFile(new URL('../modules/data/global-guide-entity-validation.json', import.meta.url), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const wikidataEndpoint = 'https://qlever.dev/api/wikidata';
const wikidataUserAgent = 'TravelWorld-GuideCatalog/1.0 (open landmark catalog build)';

// 193 UN member states plus the two UN observer states. Taiwan remains within the China allocation.
const countryCodes = `
AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ
CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI
FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM
JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG
MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK
PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD
TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW PS
`.trim().split(/\s+/);

const southeastAsiaQuota = { ID: 58, MY: 48, VN: 48, TH: 48, PH: 48, SG: 22, KH: 20, LA: 2, MM: 2, BN: 2, TL: 2 };
const fixedQuota = { ...southeastAsiaQuota, CN: 100, US: 100, JP: 50 };
const totalTarget = 1000;
const extraOtherCountrySlots = 88;
const eligibleAudialaCategories = new Set([
  'attraction', 'monument', 'archaeological-site', 'castle', 'palace', 'museum', 'park', 'temple', 'fortification',
  'cathedral', 'church', 'mosque', 'statue', 'bridge', 'tower', 'garden', 'zoo', 'opera-house', 'theatre',
  'botanical-garden', 'synagogue', 'monastery', 'lighthouse', 'island', 'lake', 'cave', 'mountain',
  'beach', 'waterfall', 'religious-site', 'amusement-park', 'square', 'memorial', 'market', 'fountain',
  'shinto-shrine', 'city-gate'
]);
const excludedName = /\b(?:bombings?|battles?|massacres?|incidents?|aircraft|planes?|concorde|accidents?|crashes?|murders?|assassinations?|memorial services?|festivals?|marathons?|affair|riots?|uprisings?|sieges?|invasions?|earthquakes?|cyclones?|hurricanes?|elections?|district|olympic games)\b|great chicago fire/i;
const knownBadEntityIds = new Set(['Q85', 'Q41180', 'Q112197', 'Q191643', 'Q654476', 'Q63724', 'Q47925', 'Q2047427']); // Palace Museum shares the Forbidden City site (Q80290).
const excludedClassIds = [
  'Q570116', 'Q839954', 'Q33506', 'Q22698', 'Q173387', 'Q23413', 'Q16970', 'Q44539', 'Q24398318',
  'Q4989906', 'Q8502', 'Q23397', 'Q12280', 'Q16560', 'Q23442', 'Q2977', 'Q34038', 'Q40080',
  'Q179049', 'Q167346', 'Q46169', 'Q43501', 'Q39715', 'Q12518'
];
const isoNameEn = new Intl.DisplayNames(['en'], { type: 'region' });
const isoNameZh = new Intl.DisplayNames(['zh-CN'], { type: 'region' });

assert.equal(countryCodes.length, 195, 'Expected the 195-state allocation base');
assert.equal(new Set(countryCodes).size, countryCodes.length, 'Country code list must not contain duplicates');
assert.equal(Object.values(southeastAsiaQuota).reduce((sum, value) => sum + value, 0), 300);
assert.equal(Object.values(fixedQuota).reduce((sum, value) => sum + value, 0), 550);
assert.equal(countryCodes.filter(code => !(code in fixedQuota)).length, 181);
assert.equal(countryCodes.filter(code => !(code in fixedQuota)).length * 2 + extraOtherCountrySlots, 450);

const countryNames = Object.fromEntries(countryCodes.map(code => [code, {
  en: isoNameEn.of(code),
  zh: isoNameZh.of(code)
}]));
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const coordinateOkay = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
const likelyCountryItself = (place, code) => {
  const label = normalize(place.name_en || place.name);
  const names = [countryNames[code]?.en, countryNames[code]?.zh].map(normalize).filter(Boolean);
  return names.includes(label) || (code === 'TL' && ['timor', 'timor leste'].includes(label));
};
const cleanCandidate = place => {
  const code = place.countryCode;
  if (!countryNames[code] || !/^Q\d+$/.test(place.id || '')) return false;
  if (knownBadEntityIds.has(place.id)) return false;
  if (code === 'BN' && place.id === 'Q36117') return false; // Prefer places in Brunei rather than the entire multinational island of Borneo.
  if (entityValidation.places[place.id]?.valid === false) return false;
  if (!coordinateOkay(Number(place.latitude), Number(place.longitude))) return false;
  if (!String(place.name_en || place.name || '').trim() || excludedName.test(`${place.name_en || ''} ${place.name || ''}`)) return false;
  if (likelyCountryItself(place, code)) return false;
  if (place.source === 'audiala' && !eligibleAudialaCategories.has(place.category)) return false;
  return Number(place.rank) >= 2;
};
const dedupePlaces = places => {
  const byId = new Map();
  for (const place of places) {
    if (!cleanCandidate(place)) continue;
    const prior = byId.get(place.id);
    if (!prior || Number(place.rank) > Number(prior.rank)) byId.set(place.id, place);
  }
  const byCountryName = new Map();
  const result = [];
  for (const place of [...byId.values()].sort((a, b) => Number(b.rank) - Number(a.rank) || a.id.localeCompare(b.id))) {
    const key = `${place.countryCode}:${normalize(place.name_en || place.name)}`;
    const duplicates = byCountryName.get(key) || [];
    if (duplicates.some(item => Math.abs(item.latitude - place.latitude) < 0.035 && Math.abs(item.longitude - place.longitude) < 0.035)) continue;
    duplicates.push(place);
    byCountryName.set(key, duplicates);
    result.push(place);
  }
  return result;
};

async function loadJson(url, fallback) {
  try { return JSON.parse(await readFile(url, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function atomicJson(url, value) {
  const temp = new URL(url.href + '.tmp');
  await writeFile(temp, JSON.stringify(value));
  await rename(temp, url);
}

function wikidataQuery(code) {
  const kinds = excludedClassIds.map(id => `wd:${id}`).join(' ');
  return `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
  PREFIX wd: <http://www.wikidata.org/entity/>
  PREFIX wikibase: <http://wikiba.se/ontology#>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX schema: <http://schema.org/>
  SELECT DISTINCT ?item ?nameEn ?nameZh ?coord ?rank ?descriptionEn WHERE {
    { SELECT ?country ?item ?rank WHERE {
        ?country wdt:P297 "${code}"; wdt:P31/wdt:P279* wd:Q3624078.
        ?item wdt:P17 ?country; wikibase:sitelinks ?rank.
      }
      ORDER BY DESC(?rank)
      LIMIT 1200
    }
    ?item wdt:P625 ?coord; wdt:P31/wdt:P279* ?kind; rdfs:label ?nameEn.
    FILTER(LANG(?nameEn) = "en")
    FILTER(?rank >= 2)
    VALUES ?kind { ${kinds} }
    OPTIONAL { ?item rdfs:label ?nameZh. FILTER(LANG(?nameZh) = "zh") }
    OPTIONAL { ?item schema:description ?descriptionEn. FILTER(LANG(?descriptionEn) = "en") }
    FILTER(?item != ?country)
  }
  ORDER BY DESC(?rank)
  LIMIT 80`;
}

function parseWikidata(payload, code) {
  return (payload.results?.bindings || []).map(row => {
    const match = /^Point\((-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)$/i.exec(row.coord?.value || '');
    if (!match) return null;
    return {
      id: row.item.value.split('/').at(-1),
      name: row.nameZh?.value || row.nameEn.value,
      name_en: row.nameEn.value,
      description_en: row.descriptionEn?.value || '',
      countryCode: code,
      country: countryNames[code].zh,
      country_en: countryNames[code].en,
      city: '',
      latitude: Number(match[2]),
      longitude: Number(match[1]),
      category: 'landmark',
      rank: Number(row.rank.value),
      source: 'wikidata',
      sourceUrl: `https://www.wikidata.org/entity/${row.item.value.split('/').at(-1)}`,
      sourceLicense: 'CC0 1.0'
    };
  }).filter(Boolean);
}

async function fetchWikidataCountry(code) {
  const query = wikidataQuery(code);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(wikidataEndpoint, {
        method: 'POST',
        headers: {
          'User-Agent': wikidataUserAgent,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ query, format: 'json' }),
        signal: AbortSignal.timeout(60000)
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after'));
        if (response.status === 429 && attempt < 2) {
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30000 * (attempt + 1);
          console.log(`${code}: Wikidata rate limited; waiting ${Math.ceil(waitMs / 1000)} seconds before retry.`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        throw new Error(`Wikidata returned HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload.status === 'ERROR') throw new Error(payload.exception || 'QLever query failed');
      return parseWikidata(payload, code);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 4000 * (attempt + 1)));
    }
  }
  throw new Error(`${code}: ${lastError?.message || 'query failed'}`);
}

async function mapLimit(items, limit, callback) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await callback(items[index], index);
    }
  });
  await Promise.all(workers);
}

const baseCatalog = await loadJson(catalogUrl, null);
assert.ok(baseCatalog?.places?.length >= 20000, 'The audited CC BY source catalogue is missing');
const basePlaces = baseCatalog.places.map(place => ({
  ...place,
  country: countryNames[place.countryCode]?.zh || place.countryCode,
  country_en: countryNames[place.countryCode]?.en || place.countryCode,
  source: 'audiala',
  sourceUrl: 'https://github.com/audiala/open-data',
  wikidataEntityUrl: `https://www.wikidata.org/entity/${place.id}`,
  sourceLicense: 'CC BY 4.0',
  sourceAttribution: baseCatalog.attribution
}));
const baseClean = dedupePlaces(basePlaces);
const supplemental = await loadJson(supplementalUrl, { source: 'Wikidata via QLever', license: 'CC0 1.0', fetchedAt: null, countries: {} });
const allBasePerCountry = new Map(countryCodes.map(code => [code, baseClean.filter(place => place.countryCode === code)]));
const fetchCodes = countryCodes.filter(code => {
  const minimum = fixedQuota[code] || 3;
  const cached = dedupePlaces(supplemental.countries?.[code] || []);
  return ((allBasePerCountry.get(code)?.length || 0) + cached.length) < minimum;
});

if (fetchCodes.length) {
  console.log(`Fetching Wikidata candidates for ${fetchCodes.length} country codes through QLever (resumable cache).`);
  await mapLimit(fetchCodes, 2, async (code, index) => {
    const places = await fetchWikidataCountry(code);
    const priorIds = new Set((supplemental.countries[code] || []).map(place => place.id));
    supplemental.countries[code] = [...(supplemental.countries[code] || []), ...places.filter(place => !priorIds.has(place.id))];
    supplemental.fetchedAt = new Date().toISOString();
    await atomicJson(supplementalUrl, supplemental);
    if ((index + 1) % 12 === 0 || index + 1 === fetchCodes.length) console.log(`Supplemented ${index + 1}/${fetchCodes.length} country codes.`);
    await new Promise(resolve => setTimeout(resolve, 300));
  });
}

const supplementalPlaces = Object.values(supplemental.countries || {}).flat();
const candidates = dedupePlaces([...baseClean, ...supplementalPlaces]);
const byCountry = new Map(countryCodes.map(code => [code, candidates.filter(place => place.countryCode === code)]));
const quotas = Object.fromEntries(countryCodes.map(code => [code, fixedQuota[code] || 2]));
const remainingCodes = countryCodes.filter(code => !(code in fixedQuota));
const thirdPlaceOrder = remainingCodes
  .filter(code => (byCountry.get(code)?.length || 0) >= 3)
  .sort((a, b) => Number(byCountry.get(b)[2].rank) - Number(byCountry.get(a)[2].rank) || a.localeCompare(b));
assert.ok(thirdPlaceOrder.length >= extraOtherCountrySlots, `Only ${thirdPlaceOrder.length} other countries have a verified third candidate; ${extraOtherCountrySlots} needed`);
for (const code of thirdPlaceOrder.slice(0, extraOtherCountrySlots)) quotas[code]++;

const shortCountries = countryCodes
  .map(code => ({ code, wanted: quotas[code], found: byCountry.get(code)?.length || 0 }))
  .filter(({ wanted, found }) => found < wanted);
assert.deepEqual(shortCountries, [], `Country quotas have shortages: ${JSON.stringify(shortCountries)}`);

const selected = countryCodes.flatMap(code => byCountry.get(code).slice(0, quotas[code]).map((place, index) => ({
  ...place,
  countryName: countryNames[code].zh,
  countryNameEn: countryNames[code].en,
  quota: quotas[code],
  countryRank: index + 1,
  rankingBasis: 'cross-language Wikidata/Audiala sitelinks proxy; not visitor counts',
  guideTemplate: 'west-lake-interactive-v1',
  imageQuery: [place.name_en || place.name, place.city, countryNames[code].en].filter(Boolean).join(' '),
  imageLicensePolicy: 'Openverse CC BY, CC BY-SA, or CC0; exclude Wikipedia/Wikimedia; verify location match and retain attribution'
})));

assert.equal(selected.length, totalTarget, `Expected ${totalTarget} selected landmarks, got ${selected.length}`);
assert.equal(new Set(selected.map(place => place.id)).size, selected.length, 'Selected item IDs must be unique');
assert.ok(selected.every(place => countryNames[place.countryCode] && coordinateOkay(place.latitude, place.longitude)));
assert.equal(selected.filter(place => ['ID', 'MY', 'VN', 'TH', 'PH', 'SG', 'KH', 'LA', 'MM', 'BN', 'TL'].includes(place.countryCode)).length, 300);
assert.equal(selected.filter(place => place.countryCode === 'CN').length, 100);
assert.equal(selected.filter(place => place.countryCode === 'US').length, 100);
assert.equal(selected.filter(place => place.countryCode === 'JP').length, 50);
assert.equal(countryCodes.filter(code => selected.some(place => place.countryCode === code)).length, 195);

const catalog = {
  version: '2026-10-global-guide-v2-verified',
  total: selected.length,
  countryCount: 195,
  ranking: 'The source catalogues use cross-language Wikidata sitelinks as a popularity proxy; this is not visitor traffic or booking data.',
  sourcePolicy: 'Audiala place metadata is CC BY 4.0; Wikidata metadata is CC0 1.0. Images are resolved on demand from location-matched Openverse results under CC BY, CC BY-SA, or CC0, excluding Wikipedia/Wikimedia providers, with attribution.',
  imageProvider: 'Openverse API; do not bulk scrape; retain title, creator, license, source link, and match review.',
  quotas,
  places: selected
};
const byCountryReport = countryCodes.map(code => ({
  code,
  name: countryNames[code].en,
  quota: quotas[code],
  selected: selected.filter(place => place.countryCode === code).length,
  audiala: selected.filter(place => place.countryCode === code && place.source === 'audiala').length,
  wikidata: selected.filter(place => place.countryCode === code && place.source === 'wikidata').length
}));
const report = {
  builtAt: new Date().toISOString(),
  total: selected.length,
  countryCount: byCountryReport.filter(row => row.selected > 0).length,
  rankingBasis: catalog.ranking,
  imagePolicy: catalog.imageProvider,
  sourceCounts: { audiala: selected.filter(place => place.source === 'audiala').length, wikidata: selected.filter(place => place.source === 'wikidata').length },
  countries: byCountryReport
};
await atomicJson(outputUrl, catalog);
await atomicJson(reportUrl, report);
console.log(JSON.stringify({ total: selected.length, countryCount: report.countryCount, sources: report.sourceCounts, quotas: { southeastAsia: 300, china: 100, unitedStates: 100, japan: 50, other: 450 }, missingCountries: [], output: outputUrl.pathname, report: reportUrl.pathname }));
