import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchTravelKnowledge,knowledgeForPrompt} from './travel-knowledge.mjs';
import {costSubtotal} from '../modules/discover/sourced-guide.js';

const zh=await searchTravelKnowledge('帮我规划朝圣之路的吃住费用');
const en=await searchTravelKnowledge('Where can I stay in Portomarin?');
assert(zh.some(item=>item.id==='camino-sarria-portomarin'));
assert(en.some(item=>item.id==='camino-sarria-portomarin'));
assert.deepEqual(await searchTravelKnowledge(''),[]);
assert.deepEqual(await searchTravelKnowledge('zz-no-such-place-123'),[]);
assert((await searchTravelKnowledge('北京')).some(item=>item.id==='cn-beijing-culture'));
const guide=zh.find(item=>item.id==='camino-sarria-portomarin');
assert.equal(costSubtotal(guide),31.5);
for(const stop of guide.stops){
  assert(stop.name.zh && stop.name.en && stop.description.zh && stop.description.en);
  assert(stop.image && stop.imageSourceUrl && stop.credit && stop.sourceUrl);
  if(stop.image.startsWith('/assets/'))assert((await readFile(new URL('..'+stop.image,import.meta.url))).length>1000);
  if(stop.imageStatus==='licensed')assert(stop.licenseUrl);
}
const prompt=knowledgeForPrompt(zh);
assert(JSON.stringify(prompt).length<=12000);
assert(prompt.some(item=>item.costs?.[0].sourceUrl&&item.checkedAt));
console.log('Travel knowledge checks passed: bilingual retrieval, prices, sources, licensed assets, prompt budget.');
