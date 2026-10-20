// Tests what the AI desk shows when the backend refuses or breaks.
// Uses CDP Fetch interception so the real service is never touched.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = ROOT + 'outputs/';
mkdirSync(OUT, { recursive: true });

const URL_ARG = process.argv[2] || 'https://travel-world-mwdw.onrender.com/';
const CDP = 'http://127.0.0.1:9222';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newTarget(url) {
  const res = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map(); const listeners = []; let id = 0;
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const msgId = ++id;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return new Promise((res, rej) => {
          pending.set(msgId, { res, rej });
          setTimeout(() => { if (pending.has(msgId)) { pending.delete(msgId); rej(new Error(`timeout ${method}`)); } }, 30000);
        });
      },
      on(fn) { listeners.push(fn); },
      close() { try { ws.close(); } catch {} }
    }));
    ws.addEventListener('message', ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
        return;
      }
      for (const fn of listeners) fn(msg);
    });
    ws.addEventListener('error', () => reject(new Error('ws error')));
  });
}

const target = await newTarget('about:blank');
const cdp = await connect(target.webSocketDebuggerUrl);
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Network.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

const evaluate = async (expression, label = 'eval') => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r.result?.value;
};

await cdp.send('Page.navigate', { url: URL_ARG });
await new Promise(resolve => {
  const t = setTimeout(resolve, 30000);
  cdp.on(m => { if (m.method === 'Page.loadEventFired') { clearTimeout(t); resolve(); } });
});
await sleep(4500);

// Intercept the assistant endpoint only.
let mock = { status: 429, body: JSON.stringify({ error: '匿名试用有次数限制，登录后可畅聊' }) };
let intercepted = 0;
cdp.on(async msg => {
  if (msg.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = msg.params;
  if (!/\/api\/ai\/assistant/.test(request.url)) { await cdp.send('Fetch.continueRequest', { requestId }).catch(() => {}); return; }
  intercepted++;
  await cdp.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: mock.status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: '*' }
    ],
    body: Buffer.from(mock.body).toString('base64')
  }).catch(() => {});
});
await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/ai/assistant*', requestStage: 'Request' }] });

await evaluate(`window.go && window.go('ai')`, 'open');
await sleep(800);

async function ask(text) {
  return evaluate(`(() => {
    const input = document.querySelector('.ai-chat-input');
    const send = document.querySelector('.ai-chat-send');
    if (!input || !send) return { ok: false };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(text)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    send.click();
    return { ok: true };
  })()`, 'ask');
}

async function snapshot() {
  return evaluate(`(() => {
    const list = document.querySelector('.ai-chat-list');
    const bubbles = list ? [...list.children] : [];
    return {
      bubbles: bubbles.length,
      status: (document.querySelector('.ai-chat-status')?.textContent || '').trim(),
      stopHidden: document.querySelector('.ai-chat-stop')?.hidden,
      inputDisabled: document.querySelector('.ai-chat-input')?.disabled,
      sendDisabled: document.querySelector('.ai-chat-send')?.disabled,
      lastBubble: bubbles.length ? { cls: bubbles[bubbles.length - 1].className, text: (bubbles[bubbles.length - 1].textContent || '').trim().slice(0, 220) } : null,
      retryButton: !!list?.querySelector('button[data-retry], .ai-chat-retry, .is-retry'),
      errorClass: !!list?.querySelector('.is-error, .ai-chat-error'),
      allText: (list?.textContent || '').trim().slice(-400)
    };
  })()`, 'snapshot');
}

const results = {};

for (const scenario of [
  { name: '429 限流', status: 429, body: JSON.stringify({ error: '匿名试用有次数限制，登录后可畅聊' }) },
  { name: '500 服务异常', status: 500, body: JSON.stringify({ error: '服务器开小差了' }) },
  { name: '503 纯文本错误页', status: 503, body: '<html><body>Service Unavailable</body></html>' },
  { name: '200 但空流', status: 200, body: 'event: meta\ndata: {}\n\nevent: done\ndata: {}\n\n' }
]) {
  mock = { status: scenario.status, body: scenario.body };
  console.log(`\n########## ${scenario.name} ##########`);
  await ask(`测试${scenario.name}`);
  for (let i = 1; i <= 12; i++) {
    await sleep(1000);
    const s = await snapshot();
    console.log(`+${i}s`, JSON.stringify(s));
    if (s && s.stopHidden === true && i >= 3) break;
  }
  results[scenario.name] = await snapshot();
}

console.log('\n=== intercepted:', intercepted, '===');
console.log(JSON.stringify(results, null, 2));
writeFileSync(OUT + 'ai-error-paths.json', JSON.stringify({ results, intercepted }, null, 2));

await cdp.send('Fetch.disable').catch(() => {});
await cdp.send('Page.close').catch(() => {});
cdp.close();
process.exit(0);
