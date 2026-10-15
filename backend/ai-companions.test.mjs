import assert from 'node:assert/strict';
import {companionInput,companionRegions} from './ai-companions.mjs';
assert.equal(Object.keys(companionRegions).length,6);
assert.throws(()=>companionInput({region:'fake',message:'hi'}));
assert.throws(()=>companionInput({region:'asia',message:''}));
assert.throws(()=>companionInput({region:'asia',message:'x'.repeat(2001)}));
const r=companionInput({region:'oceania',language:'en',message:' Sydney food ',history:[{role:'system',content:'bad'},{role:'assistant',content:'hello'}]});
assert.equal(r.message,'Sydney food');assert.equal(r.language,'en');assert.deepEqual(r.history,[{role:'assistant',content:'hello'}]);
console.log('Regional AI checks passed: six regions, validation, language, bounded history and role filtering.');
