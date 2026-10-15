import { readFile } from 'node:fs/promises';
import {mapCatalog} from './map-places.mjs';

const dataDir = new URL('../modules/data/', import.meta.url);
let catalog;
async function loadCatalog() {
  if (!catalog) catalog = Promise.all([...['route-guides.json', 'routes.json', 'landmarks.json'].map(async file => JSON.parse(await readFile(new URL(file, dataDir), 'utf8'))),mapCatalog()]).then(([guides, routes, landmarks,places]) => [
    ...guides.guides.map(item => ({ type: 'sourced-guide', ...item })),
    ...routes.routes.map(item => ({ type: 'editorial-route', id: item.id, title: item.title, en: item.en, destination: item.destination, daysPlan: item.daysPlan, budget: item.budget, verification: 'Editorial reference; prices and photos are not independently verified by this catalog.' })),
    ...landmarks.landmarks.map(item => ({ type: 'landmark', ...item })),
    ...places.places.map(item=>({type:'mapped-place',...item,title:{zh:item.name,en:item.name_en},sourceUrl:'https://www.wikidata.org/wiki/'+item.id,sourceGeneratedAt:places.sourceGeneratedAt,attribution:places.attribution,license:places.license,verification:'Third-party directory only; coordinates, city labels, access, accommodation and prices require verification.'}))
  ]).catch(error => { catalog = null; throw error; });
  return catalog;
}

export async function searchTravelKnowledge(query, limit = 4) {
  const terms = String(query || '').slice(0, 2000).toLocaleLowerCase().split(/[\s,，。;；：:!?？!]+/).filter(term => term.length >= 2);
  if (!terms.length) return [];
  return (await loadCatalog()).map(item => {
    const labels = JSON.stringify([item.id, item.title, item.name, item.name_en, item.destination, item.city, item.country, item.en?.title, item.keywords]).toLocaleLowerCase();
    // Match short catalog labels inside natural-language questions as well as word queries.
    const aliases = [item.id, item.destination, item.name, item.name_en, ...(item.keywords || [])].filter(value => typeof value === 'string' && value.length >= 2);
    const text = terms.join(' ');
    const score = terms.reduce((sum, term) => sum + (labels.includes(term) ? 1 : 0), 0) + aliases.reduce((sum, alias) => sum + (text.includes(alias.toLocaleLowerCase()) ? 2 : 0), 0);
    return { item, score };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || Number(b.item.type === 'sourced-guide') - Number(a.item.type === 'sourced-guide')).slice(0, Math.max(1, Math.min(6, limit))).map(result => result.item);
}

export function knowledgeForPrompt(records) {
  // Keep citations and qualification with every price; do not ship the whole global catalog per request.
  const compact = records.map(item => item.type === 'sourced-guide' ? {
    type: item.type, id: item.id, title: item.title, checkedAt: item.checkedAt, currency: item.currency,
    distanceKm: item.distanceKm, walkingHours: item.walkingHours, sourceUrl: item.sourceUrl,
    journey: item.journey, waypoints: item.waypoints,
    stops: item.stops.map(({ id, name, category, description, image, imageSourceUrl, credit, license, sourceUrl, price }) => ({ id, name, category, description, image, imageSourceUrl, credit, license, sourceUrl, price })),
    costs: item.costs, excluded: item.excluded, notice: item.notice
  } : { type: item.type, id: item.id, title: item.title || item.name, name_en: item.name_en, destination: item.destination || item.city, description: item.description, description_en: item.description_en, budget: item.budget,latitude:item.latitude,longitude:item.longitude,sourceUrl:item.sourceUrl,sourceGeneratedAt:item.sourceGeneratedAt,attribution:item.attribution,license:item.license,verification: item.verification || 'Catalog entry, not live conditions or prices.' });
  // Keep whole records; never truncate JSON or detach a price from its source.
  while (JSON.stringify(compact).length > 12000 && compact.length) compact.pop();
  return compact;
}
