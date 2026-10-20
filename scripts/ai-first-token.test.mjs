// Proves the first-token deadline: an upstream that accepts the request and then
// stays silent must not hold the visitor for the full plan budget.
import express from 'express';

// Must be set before the module is evaluated: the deadline is a top-level
// constant, and a static import would be hoisted above this assignment.
process.env.AI_FIRST_TOKEN_MS = '1500';
const { installAiAssistant } = await import('../backend/ai-assistant.mjs');

const upstream = express();
upstream.post('/openai', (req, res) => {
  res.type('text/event-stream');
  res.flushHeaders?.();
  // Accept, then say nothing at all — the shape of a request queued behind
  // another visitor's share of the shared upstream window.
});
const up = upstream.listen(0);

const app = express();
app.use(express.json());
installAiAssistant(app, {
  optionalUser: (_req, _res, next) => next(),
  aiBaseUrl: `http://127.0.0.1:${up.address().port}`,
  aiModel: 'silent-model'
});
const srv = app.listen(0);

const started = Date.now();
const response = await fetch(`http://127.0.0.1:${srv.address().port}/api/ai/assistant`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
  body: JSON.stringify({ message: '帮我排一下苏州两天', language: 'zh', mode: 'plan' })
});

const raw = await response.text();
const elapsed = Date.now() - started;
const events = [...raw.matchAll(/^event: (\S+)/gm)].map(m => m[1]);
const last = raw.trim().split('\n\n').pop();

console.log(`elapsed ${elapsed}ms`);
console.log('events:', events.join(', '));
console.log('final frame:', last.slice(0, 240));

const usedQuota = /提问的人有点多/.test(raw);
const quick = elapsed < 6000;
const hasDelta = events.includes('delta');

console.log(`\n${usedQuota && quick && hasDelta ? 'PASS' : 'FAIL'}: silent upstream answered in ${elapsed}ms with an honest queue message`);

up.close();
srv.close();
process.exit(usedQuota && quick && hasDelta ? 0 : 1);
