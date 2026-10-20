// Compares how the free reasoning model spends its token budget on the real
// plan prompt, with and without a reasoning-effort hint.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(ROOT + 'backend/ai-assistant.mjs', 'utf8');

function constant(name) {
  const at = source.indexOf(`const ${name} = `);
  if (at < 0) throw new Error('missing ' + name);
  const start = source.indexOf("'", at);
  let end = start + 1;
  while (end < source.length) {
    if (source[end] === '\\') { end += 2; continue; }
    if (source[end] === "'") break;
    end++;
  }
  // eslint-disable-next-line no-new-func
  return Function('return ' + source.slice(start, end + 1))();
}

const PLAN_SYSTEM_ZH = constant('PLAN_SYSTEM_ZH');
console.log('system prompt chars:', PLAN_SYSTEM_ZH.length);

async function run(label, extra, question) {
  const body = JSON.stringify({
    model: 'openai-fast',
    temperature: 0.3,
    max_tokens: 6000,
    stream: true,
    messages: [{ role: 'user', content: PLAN_SYSTEM_ZH + '\n\n' + question }],
    ...extra
  });
  const started = Date.now();
  let content = 0, reasoning = 0, frames = 0, finish = '', firstContentAt = null, sample = '';
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  if (!res.ok) {
    console.log(`${label}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const line = frame.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const choice = json.choices?.[0] || {};
        frames++;
        if (choice.finish_reason) finish = choice.finish_reason;
        if (choice.delta?.reasoning) reasoning += choice.delta.reasoning.length;
        if (choice.delta?.content) {
          if (firstContentAt === null) firstContentAt = Date.now() - started;
          content += choice.delta.content.length;
          if (sample.length < 120) sample += choice.delta.content;
        }
        if (json.error) console.log('  upstream error:', JSON.stringify(json.error).slice(0, 160));
      } catch (_) { /* partial frame */ }
    }
  }
  console.log(`${label}: ${Date.now() - started}ms frames=${frames} content=${content} reasoning=${reasoning} finish=${finish || '(none)'} firstContent=${firstContentAt}ms`);
  if (sample) console.log('  sample:', sample.replace(/\n/g, ' | ').slice(0, 160));
}

const question = '帮我排一下苏州两天';
await run('baseline          ', {}, question);
await new Promise(r => setTimeout(r, 31_000));
await run('reasoning_effort=low', { reasoning_effort: 'low' }, question);
