import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('modules/data/map-place-catalog.json',root),'utf8'));
const registry=JSON.parse(await readFile(new URL('modules/data/place-backgrounds.json',root),'utf8')).backgrounds;
// Exclude identifiable directory misclassifications, lost structures and duplicate complexes.
const excluded=new Set(['Q85','Q41180','Q655','Q5690','Q43244','Q93195','Q174165','Q128910','Q1865480','Q6505','Q23725','Q16117','Q228002','Q13217298','Q12508','Q179591','Q488278','Q146038','Q715286','Q214874','Q19483']);
const selected=[...catalog.places].filter(p=>!excluded.has(p.id)).sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id)).slice(0,100);
assert.equal(selected.length,100);assert.equal(new Set(selected.map(p=>p.id)).size,100);
const entries=selected.map((p,index)=>({...p,priority:index+1,sourceUrl:'https://www.wikidata.org/wiki/'+p.id,art:registry[p.id]||null,status:registry[p.id]?'generated-and-registered':'pending-source-and-generation'}));
const result={title:'Travel World — 100 existing-map landmarks, familiarity-first production queue',method:'Existing Audiala/Wikidata sitelink coverage, descending, after explicit invalid-entry exclusions. A production priority proxy, not global visitor counts or live popularity ranking.',catalogSource:catalog.sourceUrl,sourceLicense:catalog.license,count:100,generated:entries.filter(p=>p.art).length,entries};
await writeFile(new URL('modules/data/background-priority-100.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify({count:100,generated:result.generated,pending:100-result.generated,first15:entries.slice(0,15).map(p=>p.name_en)}));
