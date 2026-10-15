import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {difficultyMarkup} from '../modules/discover/hiking-difficulty.js';
for (let stars=1;stars<=5;stars++) {
  const html=difficultyMarkup({stars},'en');
  assert.ok(html.includes(`${stars}/5`));
  assert.ok(html.includes('★'.repeat(stars)+'☆'.repeat(5-stars)));
  assert.ok(!/[\u3400-\u9fff]/u.test(html));
}
for (const stars of [0,6,-1,1.5,'2',NaN,undefined]) assert.ok(difficultyMarkup({stars},'en').includes('not yet reviewed'));
const guide=JSON.parse(await readFile(new URL('../modules/data/route-guides.json',import.meta.url),'utf8')).guides[0];
assert.ok(difficultyMarkup(guide.difficulty,'en').includes('Provisional editorial'));
assert.ok(difficultyMarkup(guide.difficulty,'en').includes('not the entire French Way'));
assert.ok(!/[\u3400-\u9fff]/u.test(difficultyMarkup(guide.difficulty,'en')));
assert.ok(!difficultyMarkup({stars:2,basis:{en:'<script>alert(1)</script>'}},'en').includes('<script>'));
console.log('Difficulty checks passed: five grades, invalid values, bilingual output, stage scope and escaping.');
