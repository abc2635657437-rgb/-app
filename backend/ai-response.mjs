export function parseAiResponse(content) {
  const text=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0||end<start)throw new Error('AI 未返回有效 JSON');
  const value=JSON.parse(text.slice(start,end+1));
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('AI 未返回有效对象');
  return value;
}
