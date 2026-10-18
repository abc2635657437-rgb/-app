import assert from 'node:assert/strict';
import express from 'express';
import { installAiAssistant } from './ai-assistant.mjs';
import { detectRegion, linksFor } from './plan-links.mjs';

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
  scoped.use(express.json({ limit: '2mb' }));
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

// 2b. A cached answer still reaches streaming clients as SSE: the browser reader
//     cannot parse a plain JSON body, so replaying the cache must keep the frames.
{
  const { srv, url } = install(noUser);
  const body = JSON.stringify({ message: '京都秋天怎么穿', language: 'zh' });
  await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body });
  const streamed = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, body });
  assert.equal(streamed.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const raw = await streamed.text();
  assert.match(raw, /event: meta/);
  assert.match(raw, /"cached":true/);
  const done = raw.match(/event: done\ndata: (.*)\n\n/);
  assert.ok(done, 'a cached answer must still end with a done frame');
  assert.equal(JSON.parse(done[1]).answer, '衣：带薄外套；食：锦市场。');
  srv.close();
  console.log('AI assistant cache passed: replayed answers keep the SSE contract.');
}

// 2c. Plan mode turns the itinerary table into days plus real photographs.
{
  const tableAnswer = [
    '十一月的京都，五天刚好够把东山和岚山分开走。',
    '',
    '## 日程',
    '| 天 | 时间 | 地点 | 类型 | 说明 |',
    '|---|---|---|---|---|',
    '| 1 | 09:00 | 清水寺 | 玩 | 约 2 小时 |',
    '| 1 | 12:30 | 汤豆腐 | 食 | 人均 3,000 日元 |',
    '| 2 | 09:30 | 伏见稻荷大社 | 玩 | 清晨人少，约 2 小时 |'
  ].join('\n');

  const upstreamApp = express();
  upstreamApp.use(express.json());
  upstreamApp.post('/openai', (_req, res) => {
    res.type('text/event-stream').end(
      `data: ${JSON.stringify({ choices: [{ delta: { content: tableAnswer } }] })}\n\n` +
      'data: [DONE]\n\n'
    );
  });
  const upstream = upstreamApp.listen(0);

  const scoped = express();
  scoped.use(express.json({ limit: '2mb' }));
  const asked = [];
  installAiAssistant(scoped, {
    optionalUser: noUser,
    aiBaseUrl: `http://127.0.0.1:${upstream.address().port}`,
    aiModel: 'test-model',
    resolvePhotos: async names => {
      asked.push(...names);
      return new Map([['清水寺', { url: 'https://thumb.wikimedia.org/x.jpg', page: 'https://commons.wikimedia.org/wiki/File:X', credit: 'A', license: 'CC BY-SA' }]]);
    }
  });
  const server = scoped.listen(0);

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/assistant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ message: '帮我排一版京都五天行程', language: 'zh', mode: 'plan' })
  });
  const raw = await response.text();
  const done = JSON.parse(raw.match(/event: done\ndata: (.*)\n\n/)[1]);
  assert.ok(done.plan, 'plan mode returns a structured plan');
  assert.equal(done.plan.days.length, 2, 'rows are grouped by day');
  assert.equal(done.plan.days[0].items[0].place, '清水寺');
  assert.equal(done.plan.days[0].items[0].time, '09:00');
  assert.equal(done.plan.days[0].items[1].kind, '食');
  assert.match(done.plan.days[0].items[0].photo.url, /wikimedia/, 'a resolved photograph is attached');
  assert.ok(!done.plan.days[0].items[1].photo, 'places without a photograph stay clean');
  assert.equal(done.plan.photos, 1);
  assert.ok(asked.includes('伏见稻荷大社'), 'every place is offered to the photo resolver');

  // 7. Every stop carries a real provider link, chosen by region.
{
  assert.equal(detectRegion('十一月京都三天').country, 'JP');
  assert.equal(detectRegion('大理四天慢慢逛').country, 'CN');

  const kyoto = linksFor({ place: '锦市场', kind: '吃' }, { city: '京都', country: 'JP' }, 'zh');
  assert.equal(kyoto[0].provider, 'tabelog');
  const kyotoWays = kyoto.find(link => link.kind === 'ways');
  assert.deepEqual(kyotoWays.modes.map(mode => mode.mode), ['metro', 'bus', 'uber'], 'metro, bus, then Uber');
  assert.match(kyotoWays.modes[2].url, /m\.uber\.com/);

  const dali = linksFor({ place: '大理古城', kind: '吃' }, { city: '大理', country: 'CN' }, 'zh');
  assert.equal(dali[0].provider, 'dianping');
  assert.deepEqual(dali.find(link => link.kind === 'ways').modes.map(mode => mode.mode), ['bus', 'didi'], 'no metro in Dali');

  const bangkok = linksFor({ place: 'Chatuchak', kind: '玩' }, { city: '曼谷', country: 'TH' }, 'en');
  assert.equal(bangkok[0].provider, 'klook');
  assert.deepEqual(bangkok.find(link => link.kind === 'ways').modes.map(mode => mode.mode), ['metro', 'bus', 'uber', 'grab']);

  const stay = linksFor({ place: 'A hotel', kind: '住' }, { city: '京都', country: 'JP' }, 'en');
  assert.equal(stay[0].provider, 'booking');
  assert.match(stay[0].url, /booking\.com\/searchresults/);

  console.log('Plan links passed: 地铁 only where a metro runs, 公交, 滴滴/ Uber / Grab, Tabelog, Klook, Booking.');
}

server.close();
  upstream.close();
  console.log('AI assistant plan passed: table → days, times and licensed photographs.');
}

// 3. An upstream failure degrades to a grounded answer instead of an error wall.
{
  // Port 9 (discard) refuses the connection, which is exactly the failure the
  // fallback has to survive: unreachable upstream, model timeout, 5xx upstream.
  const scoped = express();
  scoped.use(express.json({ limit: '2mb' }));
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

// 6. The traveller's own saved plans are handed to the model, bounded.
{
  const { srv, url } = install(loggedIn);
  const plans = {
    routes: [{
      title: '京都红叶五日',
      destination: '京都',
      days: [{ day: 2, places: ['清水寺', '二年坂'], food: ['汤豆腐'] }]
    }],
    trips: [{ title: '京都行', destination: '京都', from: '2026-11-01', to: '2026-11-05' }]
  };
  const accepted = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ message: '第二天怎么走', language: 'zh', plans }) });
  assert.equal(accepted.status, 200, 'a normal plan payload is accepted');
  // The question travels as its own turn; the saved plans arrive as a data block.
  assert.equal(seen.at(-1).messages.at(-2).content, '第二天怎么走', 'the question is sent verbatim');
  const dataBlock = seen.at(-1).messages.at(-1).content.replace(/^[^{]*/, '');
  const sent = JSON.parse(dataBlock);
  assert.equal(sent.myPlans.routes[0].title, '京都红叶五日', 'the saved route reaches the model');
  assert.deepEqual(sent.myPlans.routes[0].days[0].places, ['清水寺', '二年坂'], 'day places survive');
  assert.equal(sent.myPlans.trips[0].title, '京都行', 'trip posts are included');

  const huge = {
    routes: Array.from({ length: 20 }, (_, r) => ({
      title: 'route-' + r,
      days: Array.from({ length: 15 }, (_, d) => ({ day: d + 1, places: Array.from({ length: 30 }, () => 'A place with a long name') }))
    }))
  };
  const bigResponse = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ message: '第二天的安排', language: 'zh', plans: huge }) });
  assert.equal(bigResponse.status, 200, 'an oversized but legal body is still answered');
  const bounded = JSON.parse(seen.at(-1).messages.at(-1).content.replace(/^[^{]*/, '')).myPlans;
  assert.ok(bounded.routes.length <= 8, 'route count is capped');
  assert.ok(bounded.routes[0].days.length <= 10, 'days per route are capped');
  assert.ok(bounded.routes[0].days[0].places.length <= 8, 'places per day are capped');
  assert.ok(JSON.stringify(bounded).length <= 7200, 'the plan payload stays bounded');
  srv.close();
  console.log('AI assistant plans passed: saved itineraries reach the model, oversized payloads are bounded.');
}

server.close();
console.log('AI assistant passed: SSE relay without reasoning leakage, cache reuse, degraded fallback, validation, anonymous and member quotas.');
