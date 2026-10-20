// Drives the real AI chat in a real browser and reports what the user would see.
// Attaches to headless Chrome on CDP 9222.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = ROOT + 'outputs/';
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const URL_ARG = args.find(a => !a.startsWith('--')) || 'https://travel-world-mwdw.onrender.com/';
const SEND_AT = args.indexOf('--send');
const SEND = SEND_AT >= 0 ? args[SEND_AT + 1] : '你好，帮我看看去杭州三天怎么安排';
const WAIT = Number((args.find(a => a.startsWith('--wait=')) || '--wait=30').split('=')[1]);

const CDP = 'http://127.0.0.1:9222';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newTarget(url) {
  const res = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`new target failed: ${res.status}`);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = [];
    let id = 0;
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const msgId = ++id;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return new Promise((res, rej) => {
          pending.set(msgId, { res, rej });
          setTimeout(() => { if (pending.has(msgId)) { pending.delete(msgId); rej(new Error(`timeout ${method}`)); } }, 40000);
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

const events = [];
const target = await newTarget('about:blank');
const cdp = await connect(target.webSocketDebuggerUrl);
cdp.on(msg => {
  const { method, params } = msg;
  if (method === 'Runtime.exceptionThrown') {
    const t = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
    events.push({ kind: 'exception', text: String(t).split('\n')[0], detail: String(t).slice(0, 500) });
  } else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
    events.push({ kind: 'console-error', text: (params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ') });
  } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
    events.push({ kind: 'log-error', text: `${params.entry.source}: ${params.entry.text}` });
  } else if (method === 'Network.responseReceived' && params.response.status >= 400) {
    events.push({ kind: 'http-error', text: `${params.response.status} ${params.response.url}` });
  }
});

await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Network.enable');
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const evaluate = async (expression, label = 'eval') => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) {
    events.push({ kind: 'eval-error', text: `${label}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}` });
    return null;
  }
  return r.result?.value;
};

console.log(`=== load ${URL_ARG} ===`);
await cdp.send('Page.navigate', { url: URL_ARG });
await new Promise(resolve => {
  const t = setTimeout(resolve, 30000);
  cdp.on(m => { if (m.method === 'Page.loadEventFired') { clearTimeout(t); resolve(); } });
});
await sleep(5000);

console.log('\n=== boot state ===');
console.log(JSON.stringify(await evaluate(`({
  aiChatBuilt: !!window.aiChatBuilt,
  goType: typeof window.go,
  authGlobal: typeof window.TravelWorldAuth,
  panel: !!document.getElementById('aiChatPanel'),
  list: !!document.querySelector('.ai-chat-list'),
  compose: !!document.querySelector('.ai-chat-compose'),
  input: !!document.querySelector('.ai-chat-input'),
  send: !!document.querySelector('.ai-chat-send'),
  prompts: document.querySelectorAll('.ai-chat-prompts button').length,
  greeting: (document.querySelector('.ai-chat-list')?.textContent || '').trim().slice(0, 200)
})`, 'boot'), null, 2));

// Record every fetch the page makes from here on.
await evaluate(`(() => {
  if (window.__probeFetch) return 'already';
  const real = window.fetch;
  window.__probeLog = [];
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url);
    const entry = { url, at: Date.now(), status: null, error: null, chars: 0 };
    window.__probeLog.push(entry);
    return real.apply(this, arguments).then(res => {
      entry.status = res.status;
      entry.ctype = res.headers.get('content-type');
      if (res.body) {
        try {
          const [a, b] = res.body.tee();
          (async () => { const reader = b.getReader(); const dec = new TextDecoder(); let n = 0;
            try { for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; entry.chars = n; } } catch (e) { entry.streamError = String(e); }
          })();
          return new Response(a, { status: res.status, statusText: res.statusText, headers: res.headers });
        } catch (e) { entry.teeFailed = String(e); }
      }
      return res;
    }, err => { entry.error = String(err); throw err; });
  };
  window.__probeFetch = true;
  return 'installed';
})()`, 'instrument');

console.log('\n=== open AI screen via go("ai") ===');
console.log(JSON.stringify(await evaluate(`(() => {
  if (typeof window.go !== 'function') return { ok: false, reason: 'go() missing' };
  window.go('ai');
  return { ok: true, hash: location.hash, bodyClass: document.body.className };
})()`, 'go'), null, 2));
await sleep(1200);

const geom = await evaluate(`(() => {
  const box = sel => { const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), display: cs.display, vis: cs.visibility, overflowY: cs.overflowY }; };
  return {
    screen: document.getElementById('ai')?.className,
    ai: box('#ai'), panel: box('#aiChatPanel'), list: box('.ai-chat-list'),
    compose: box('.ai-chat-compose'), input: box('.ai-chat-input'), send: box('.ai-chat-send'),
    status: (document.querySelector('.ai-chat-status')?.textContent || '').trim(),
    hint: (document.querySelector('.ai-chat-hint')?.textContent || '').trim(),
    note: (document.querySelector('.ai-chat-note')?.textContent || '').trim(),
    prompts: [...document.querySelectorAll('.ai-chat-prompts button')].map(b => (b.textContent || '').trim()).slice(0, 6),
    listText: (document.querySelector('.ai-chat-list')?.textContent || '').trim().slice(0, 300),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    scrollW: document.documentElement.scrollWidth
  };
})()`, 'geom');
console.log(JSON.stringify(geom, null, 2));

console.log(`\n=== send: ${SEND} ===`);
const sent = await evaluate(`(() => {
  const input = document.querySelector('.ai-chat-input');
  const send = document.querySelector('.ai-chat-send');
  if (!input) return { ok: false, reason: 'no input' };
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(SEND)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const before = (document.querySelector('.ai-chat-list')?.textContent || '').length;
  if (send) send.click(); else input.closest('form')?.requestSubmit();
  return { ok: true, value: input.value, before, status: (document.querySelector('.ai-chat-status')?.textContent||'').trim() };
})()`, 'send');
console.log(JSON.stringify(sent, null, 2));

let last = -1;
for (let i = 1; i <= WAIT; i++) {
  await sleep(1000);
  const snap = await evaluate(`(() => {
    const list = document.querySelector('.ai-chat-list');
    const bubbles = list ? [...list.children] : [];
    const lastBubble = bubbles[bubbles.length - 1];
    return {
      bubbles: bubbles.length,
      chars: (list?.textContent || '').length,
      status: (document.querySelector('.ai-chat-status')?.textContent || '').trim(),
      stopHidden: document.querySelector('.ai-chat-stop')?.hidden,
      lastClass: lastBubble?.className || null,
      tail: (lastBubble?.textContent || '').trim().slice(-120),
      fetching: (window.__probeLog || []).map(e => ({ u: (e.url || '').replace(location.origin, ''), s: e.status, c: e.chars, err: e.error }))
    };
  })()`, 'poll');
  if (!snap) break;
  const grew = snap.chars !== last;
  console.log(`+${i}s bubbles=${snap.bubbles} chars=${snap.chars} status="${snap.status}" stopHidden=${snap.stopHidden}${grew ? '' : ' (idle)'}`);
  if (snap.tail) console.log(`     tail: ${snap.tail.replace(/\n/g, ' ⏎ ')}`);
  last = snap.chars;
  if (i > 3 && !grew && snap.bubbles >= 2 && snap.stopHidden !== false) break;
}

const finalState = await evaluate(`(() => {
  const list = document.querySelector('.ai-chat-list');
  const bubbles = list ? [...list.children] : [];
  return {
    bubbles: bubbles.length,
    classes: bubbles.map(b => b.className),
    text: bubbles.map(b => (b.textContent || '').trim().slice(0, 400)),
    html: (list?.innerHTML || '').slice(-2000),
    errorBubble: !!list?.querySelector('.ai-chat-error, [data-error], .is-error'),
    fetches: (window.__probeLog || []).map(e => ({ url: (e.url || '').replace(location.origin, ''), status: e.status, chars: e.chars, error: e.error, ctype: e.ctype }))
  };
})()`, 'final');
console.log('\n=== final ===');
console.log(JSON.stringify(finalState, null, 2));

console.log('\n=== runtime events ===');
if (!events.length) console.log('(none)');
for (const e of events.slice(0, 30)) console.log(`${e.kind}: ${e.text}${e.detail ? '\n   ' + e.detail.replace(/\n/g, '\n   ') : ''}`);

writeFileSync(OUT + 'ai-live-chat.json', JSON.stringify({ url: URL_ARG, send: SEND, geom, sent, finalState, events }, null, 2));
console.log(`\nreport -> ${OUT}ai-live-chat.json`);

await cdp.send('Page.close').catch(() => {});
cdp.close();
process.exit(0);
