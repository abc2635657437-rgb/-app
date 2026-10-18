import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const westLake = await readFile(new URL('modules/map/west-lake-interactive-guide.js', root), 'utf8');
const globalGuide = await readFile(new URL('modules/map/global-landmark-guide.js', root), 'utf8');
const mapWeb = await readFile(new URL('modules/map/map-web.js', root), 'utf8');
const styles = await readFile(new URL('modules/map/photo-places.css', root), 'utf8');
const catalog = JSON.parse(await readFile(new URL('modules/data/global-landmark-guide-catalog.json', root), 'utf8'));
const context = vm.createContext({ window: {}, document: { createElement: () => ({ dataset: {}, setAttribute() {} }) } });
vm.runInContext(westLake, context);
const iconFunction = globalGuide.slice(globalGuide.indexOf('  function icon('), globalGuide.indexOf('  async function loadNearby('));
vm.runInContext(iconFunction + '; globalIcon = icon;', context);
const categories = ['eat', 'drink', 'play', 'joy', 'stay', 'go'];
assert.equal(catalog.places.length, 1000);
assert.match(globalGuide, /button\.append\(icon\(id\)\)/, 'Global destination guide does not render a category icon');
assert.match(mapWeb, /photo-places\.css\?v=30-global-category-icons/, 'Global guide stylesheet cache key is stale');
assert.ok(styles.includes('.place-westlake-guide-v2 .wl-category-icon svg,.place-westlake-guide-v2 .wl-way-icon svg'), 'The category icon SVG styling is missing');
assert.doesNotMatch(styles, /\.place-westlake-guide-v2 \.wl-category::before\{content:"·"/, 'Category navigation still renders dot placeholders');
for (const place of catalog.places) for (const category of categories) {
  const expected = context.window.TravelGuideIcon(category === 'joy' ? 'leisure' : category, 'wl-category-icon');
  const actual = context.globalIcon(category);
  assert.equal(actual.innerHTML, expected.innerHTML, `${place.id}/${category}: different icon`);
  assert.equal(actual.className, expected.className);
  assert.equal(actual.dataset.categoryIcon, category);
  assert.match(actual.innerHTML, /<svg/);
}
assert.ok(!/\.global-landmark-guide \.wl-category-icon(?:\s|\[)/.test(styles), 'Global styling overrides the approved West Lake icons');
console.log('PASS: 1000 destinations × 6 exact West Lake SVG icons; shared styling, no global overrides.');
