import assert from 'node:assert/strict';
import express from 'express';
import { installAiAssistant } from './ai-assistant.mjs';

// Deterministic upstream stub: the real assistant streams from an OpenAI-compatible
// endpoint, but the contract under test is the parser, cache, quota and fallback.
const app = express();
app.use(express.json());
const seen = [];
app.post('/openai', (req, res) => {
  seen.push(req.body);
  const chunks = [
    { choices: [{ index: 0, delta: { role: 'assistant', content: '' } }] },
    { choices: [{ index: 0, delta: { reasoning: 'thinking' } }] },
    { choices: [{ index: 0, delta: { content: '衣：' } }] },
    { choices: [{ index: 0, delta: { content: '带薄外套；' } }] },
    { choices: [{ index: 0, delta: { content: '食：锦市场。' } }] },
    { choices: [{ index: 0, delta: {} }], finish_reason: 'stop' }
  ];
  res.type('text/event-stream').end(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n');
});
const server = app.listen(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const noUser = (_req, _res, next) => next();
const loggedIn = (req, _res, next) => { req.user = { id: '11111111-1111-4111-8111-111111111111' }; next(); };
const install = optionalUser => {
  const scoped = express();
  scoped.use(express.json());
  installAiAssistant(scoped, { optionalUser, aiBaseUrl: base, aiModel: 'test-model' });
  const srv = scoped.listen(0);
  return { srv, url: `http://127.0.0.1:${srv.address().port}/api/ai/assistant` };
};

// 1. Streaming relays answer text and drops the reasoning channel.
{
  const { srv, url } = install(noUser);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ message: '京都秋天怎么穿', language: 'zh' })
  });
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-transform');
  const raw = await response.text();
  assert.match(raw, /event: meta/);
  assert.match(raw, /"text":"衣："/);
  assert.match(raw, /"text":"带薄外套；"/);
  assert.doesNotMatch(raw, /thinking/, 'reasoning deltas must never reach the client');
  const done = raw.match(/event: done\ndata: (.*)\n\n/);
  assert.ok(done, 'a done frame must terminate the stream');
  assert.equal(JSON.parse(done[1]).answer, '衣：带薄外套；食：锦市场。');
  srv.close();
}

// 2. Identical questions are served from cache without touching the upstream.
{
  const { srv, url } = install(noUser);
  const body = JSON.stringify({ message: '京都秋天怎么穿', language: 'zh' });
  await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body });
  const before = seen.length;
  const second = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body });
  const payload = await second.json();
  assert.equal(payload.cached, true);
  assert.equal(seen.length, before, 'cache hit must not call the upstream');
  srv.close();
}

// 3. An upstream failure degrades to a grounded answer instead of an error wall.
{
  // Port 9 (discard) refuses the connection, which is exactly the failure the
  // fallback has to survive: unreachable upstream, model timeout, 5xx upstream.
  const scoped = express();
  scoped.use(express.json());
  installAiAssistant(scoped, { optionalUser: noUser, aiBaseUrl: 'http://127.0.0.1:9/unused', aiModel: 'test-model' });
  const srv = scoped.listen(0);
  const url = `http://127.0.0.1:${srv.address().port}/api/ai/assistant`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ message: '京都秋天怎么穿', language: 'zh' })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.degraded, true);
  assert.equal(payload.isAI, false);
  assert.ok(payload.answer.length > 0, 'a degraded answer must still be readable');
  assert.match(payload.disclaimer, /AI/);
  srv.close();
}

// 4. Input validation rejects empty and oversized questions.
{
  const { srv, url } = install(noUser);
  const empty = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '  ' }) });
  assert.equal(empty.status, 400);
  const long = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '字'.repeat(2001) }) });
  assert.equal(long.status, 400);
  srv.close();
}

// 5. Rate limit: anonymous callers get a small window, signed-in members a larger one.
{
  const anon = install(noUser);
  let last = null;
  for (let i = 0; i < 10; i += 1) {
    last = await fetch(anon.url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ message: `问题${i}` }) });
  }
  assert.equal(last.status, 429, 'anonymous quota should cap before ten questions');
  assert.match(await last.text(), /匿名试用有次数限制/);
  anon.srv.close();

  const member = install(loggedIn);
  let status = 200;
  for (let i = 0; i < 10; i += 1) {
    const response = await fetch(member.url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ message: `问题${i}` }) });
    status = response.status;
  }
  assert.equal(status, 200, 'members must not hit the anonymous ceiling');
  member.srv.close();
}

server.close();
console.log('AI assistant passed: SSE relay without reasoning leakage, cache reuse, degraded fallback, validation, anonymous and member quotas.');
