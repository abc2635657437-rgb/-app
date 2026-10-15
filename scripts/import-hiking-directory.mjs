// Official public directory metadata only. No photos, articles or invented itineraries.
import assert from 'node:assert/strict';
const sourceUrl='https://www.hiking.gov.hk/trail';
const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Official trail directory unavailable');
const html=await response.text();
const entries=new Map();
for(const block of html.split('trail-item').slice(1)){
  const match=block.match(/<h1\b[^>]*data-url="(https:\/\/www\.hiking\.gov\.hk\/trail\/info\/id\/[^"<>]+)"[^>]*>([^<]+)<\/h1>/);
  if(!match)continue;
  const [,url,name]=match;
  entries.set(url,{id:'hk-official-'+(block.match(/\btrail_(\d+)\b/)?.[1]||entries.size),name:{zh:name.trim()},countryCode:'CN',region:'HK',type:'hiking',sourceUrl:url,status:'directory-only',backgroundStatus:'not-created',detailsStatus:'not-verified'});
}
assert(entries.size>=50,'Source structure changed; do not import empty or partial data');
assert([...entries.values()].every(e=>e.name.zh&&!/[<>]/.test(e.name.zh)));
console.log(JSON.stringify({checkedAt:new Date().toISOString().slice(0,10),sourceUrl,notice:'Official route names and detail links only; not complete guides, verified navigation, translated content, photo permissions or generated backgrounds.',routes:[...entries.values()]},null,2));
