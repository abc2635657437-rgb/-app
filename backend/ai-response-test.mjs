import assert from 'node:assert/strict';
import {parseAiResponse} from './ai-response.mjs';
assert.deepEqual(parseAiResponse('```json\n{"intent":"answer","answer":"你好"}\n```'),{intent:'answer',answer:'你好'});
assert.deepEqual(parseAiResponse('说明：{"intent":"plan","daysPlan":[]}'),{intent:'plan',daysPlan:[]});
assert.throws(()=>parseAiResponse('没有结构化结果'));
console.log(JSON.stringify({ok:true,checks:['json-fence','json-wrapper','invalid-response']}));
