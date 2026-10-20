// Live-browser probe for the AI assistant.
// Attaches to an already-running headless Chrome over CDP (port 9222) and
// reports everything the HTTP layer cannot show: console errors, uncaught
// exceptions, failed requests, and the resulting DOM state of the AI screen.
//
// Usage: node scripts/ai-live-probe.mjs [url] [--send "message"]
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = ROOT + 'outputs/';
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const URL_ARG = args.find(a => !a.startsWith('--')) || 'https://travel-world-mwdw.onrender.com/';
const SEND_AT = args.indexOf('--send');
const SEND = SEND_AT >= 0 ? args[SEND_AT + 1] : '';

const CDP = 'http://127.0.0.1:9222';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newTarget(url) {
  const res = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`new target failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    const listeners = [];
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const msgId = ++id;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return new Promise((res, rej) => {
          pending.set(msgId, { res, rej });
          setTimeout(() => {
            if (pending.has(msgId)) { pending.delete(msgId); rej(new Error(`timeout ${method}`)); }
          }, 30000);
        });
      },
      on(fn) { listeners.push(fn); },
      close() { try { ws.close(); } catch {} }
    }));
    ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
        else res(msg.result);
        return;
      }
      for (const fn of listeners) fn(msg);
    });
    ws.addEventListener('error', e => reject(new Error('ws error: ' + (e.message || 'unknown'))));
  });
}

const logs = [];
const exceptions = [];
const failedRequests = [];
const responses = [];
let currentPhase = 'boot';

function record(kind, text, extra) {
  const line = { phase: currentPhase, kind, text, ...extra };
  logs.push(line);
  const tag = kind === 'exception' ? '!!' : kind === 'console-error' ? 'ERR' : kind === 'net-fail' ? 'NET' : '   ';
  console.log(`${tag} [${currentPhase}] ${text}${extra && extra.detail ? '\n      ' + String(extra.detail).slice(0, 400) : ''}`);
}

const target = await newTarget('about:blank');
console.log('target:', target.id, target.webSocketDebuggerUrl);
const cdp = await connect(target.webSocketDebuggerUrl);

cdp.on(msg => {
  const { method, params } = msg;
  if (method === 'Runtime.consoleAPICalled') {
    const text = (params.args || []).map(a => {
      if (a.value !== undefined) return String(a.value);
      if (a.description) return a.description;
      if (a.preview) return JSON.stringify(a.preview.properties?.map(p => `${p.name}:${p.value}`) || a.preview);
      return a.type;
    }).join(' ');
    if (params.type === 'error') record('console-error', text, { detail: (params.stackTrace?.callFrames || []).slice(0, 3).map(f => `${f.functionName || '(anon)'} @ ${f.url}:${f.lineNumber}`).join('\n') });
    else record(`console-${params.type}`, text);
  } else if (method === 'Runtime.exceptionThrown') {
    const d = params.exceptionDetails;
    const text = d.exception?.description || d.text || 'unknown exception';
    exceptions.push(text);
    record('exception', text.split('\n')[0], { detail: text, url: d.url, line: d.lineNumber });
  } else if (method === 'Log.entryAdded') {
    const e = params.entry;
    if (e.level === 'error' || e.level === 'warning') record(`log-${e.level}`, `${e.source}: ${e.text}`, { detail: e.url ? `${e.url}:${e.lineNumber || 0}` : undefined });
  } else if (method === 'Network.loadingFailed') {
    if (params.errorText === 'net::ERR_ABORTED') return; // usually benign
    failedRequests.push({ requestId: params.requestId, error: params.errorText, type: params.type });
    record('net-fail', `${params.type} ${params.errorText}`, { detail: params.requestId });
  } else if (method === 'Network.responseReceived') {
    const r = params.response;
    responses.push({ url: r.url, status: r.status, type: params.type, mime: r.mimeType });
    if (r.status >= 400) record('http-error', `${r.status} ${r.url}`);
  }
});

await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Network.enable');
await cdp.send('Page.enable');
await cdp.send('Page.setLifecycleEventsEnabled', { enabled: true });

// Emulate a phone: the user's complaint is about the shipped mobile experience.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

currentPhase = 'navigate';
console.log(`\n=== navigating to ${URL_ARG} ===`);
await cdp.send('Page.navigate', { url: URL_ARG });

// Wait for the load event, then give deferred modules time to boot.
await new Promise(resolve => {
  const t = setTimeout(resolve, 25000);
  cdp.on(m => { if (m.method === 'Page.loadEventFired') { clearTimeout(t); resolve(); } });
});
await sleep(4000);

async function evaluate(expression, label) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    record('exception', `evaluate(${label}) failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return null;
  }
  return r.result?.value;
}

currentPhase = 'inspect';
const state = await evaluate(`(() => {
  const q = s => document.querySelector(s);
  const txt = el => el ? (el.textContent || '').trim().slice(0, 200) : null;
  return {
    href: location.href,
    title: document.title,
    viewport: { w: innerWidth, h: innerHeight },
    swControlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    hasAiNav: !!q('[data-nav="ai"], [data-tab="ai"], a[href="#ai"]'),
    aiScreenPresent: !!q('#ai'),
    aiScreenClass: q('#ai') ? q('#ai').className : null,
    aiScreenDisplay: q('#ai') ? getComputedStyle(q('#ai')).display : null,
    chatPanel: !!q('#aiChatPanel'),
    chatPanelClass: q('#aiChatPanel') ? q('#aiChatPanel').className : null,
    chatLogChildren: q('#aiChatLog') ? q('#aiChatLog').children.length : -1,
    composer: !!q('#aiChatInput, #aiInput, textarea[data-ai-input]'),
    sendBtn: !!q('#aiChatSend, #aiSend, [data-ai-send]'),
    quickChips: document.querySelectorAll('[data-ai-quick], .ai-quick-chip, .ai-chip').length,
    floatingAi: !!q('#floatingAi, .floating-ai'),
    scriptsLoaded: [...document.scripts].filter(s => s.src).map(s => s.src.split('/').pop()),
    globals: {
      TravelAiChat: typeof window.TravelAiChat,
      TravelMapProviders: typeof window.TravelMapProviders,
      TravelI18n: typeof window.TravelI18n
    },
    bodyScrollWidth: document.body.scrollWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1
  };
})()`, 'state');
console.log('\n=== page state ===');
console.log(JSON.stringify(state, null, 2));

// Try to open the AI screen the way a user would.
currentPhase = 'open-ai';
const opened = await evaluate(`(() => {
  const candidates = ['[data-nav="ai"]', '[data-tab="ai"]', 'a[href="#ai"]', '[data-go="ai"]'];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) { el.click(); return { clicked: sel, tag: el.tagName, label: (el.textContent||'').trim().slice(0,40) }; }
  }
  // fall back to hash navigation
  location.hash = '#ai';
  return { clicked: 'hash', tag: null };
})()`, 'open-ai');
console.log('\n=== open ai ===');
console.log(JSON.stringify(opened, null, 2));
await sleep(2500);

const afterOpen = await evaluate(`(() => {
  const q = s => document.querySelector(s);
  const vis = el => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { w: Math.round(r.width), h: Math.round(r.height), display: cs.display, visibility: cs.visibility, opacity: cs.opacity }; };
  return {
    hash: location.hash,
    aiScreenClass: q('#ai') ? q('#ai').className : null,
    aiScreenBox: vis(q('#ai')),
    chatPanelBox: vis(q('#aiChatPanel')),
    chatLogChildren: q('#aiChatLog') ? q('#aiChatLog').children.length : -1,
    chatLogHtml: q('#aiChatLog') ? q('#aiChatLog').innerHTML.slice(0, 600) : null,
    composerBox: vis(q('#aiChatInput, #aiInput, textarea[data-ai-input]')),
    firstMessageText: q('#aiChatLog') ? (q('#aiChatLog').textContent || '').trim().slice(0, 300) : null
  };
})()`, 'after-open');
console.log(JSON.stringify(afterOpen, null, 2));

if (SEND) {
  currentPhase = 'send';
  console.log(`\n=== sending: ${SEND} ===`);
  const sent = await evaluate(`(() => {
    const input = document.querySelector('#aiChatInput, #aiInput, textarea[data-ai-input]');
    if (!input) return { ok: false, reason: 'no composer' };
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, ${JSON.stringify(SEND)}); else input.value = ${JSON.stringify(SEND)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const btn = document.querySelector('#aiChatSend, #aiSend, [data-ai-send]');
    const form = input.closest('form');
    if (btn) { btn.click(); return { ok: true, via: 'button', value: input.value }; }
    if (form) { form.requestSubmit ? form.requestSubmit() : form.submit(); return { ok: true, via: 'form' }; }
    const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
    input.dispatchEvent(ev);
    return { ok: true, via: 'enter', value: input.value };
  })()`, 'send');
  console.log(JSON.stringify(sent, null, 2));

  // Watch the reply grow.
  for (let i = 0; i < 14; i++) {
    await sleep(2000);
    const snap = await evaluate(`(() => {
      const log = document.querySelector('#aiChatLog');
      if (!log) return { t: Date.now(), chars: -1 };
      const last = log.lastElementChild;
      return { children: log.children.length, chars: (log.textContent||'').length, lastClass: last ? last.className : null, tail: (log.textContent||'').slice(-160) };
    })()`, 'watch');
    console.log(`  +${(i + 1) * 2}s`, JSON.stringify(snap));
    if (snap && snap.chars > 400 && i > 4) break;
  }

  currentPhase = 'after-send';
  const finalState = await evaluate(`(() => {
    const log = document.querySelector('#aiChatLog');
    return {
      children: log ? log.children.length : -1,
      text: log ? (log.textContent||'').trim().slice(0, 1200) : null,
      html: log ? log.innerHTML.slice(-1500) : null,
      hasErrorBubble: !!(log && log.querySelector('.ai-error, [data-error]'))
    };
  })()`, 'final');
  console.log('\n=== final chat state ===');
  console.log(JSON.stringify(finalState, null, 2));
}

currentPhase = 'done';
const report = { url: URL_ARG, sent: SEND || null, state, afterOpen, exceptions, failedRequests, logs, responses: responses.filter(r => r.status >= 400 || /api\/ai/.test(r.url)) };
writeFileSync(OUT + 'ai-live-probe.json', JSON.stringify(report, null, 2));
console.log(`\n=== summary ===`);
console.log(`exceptions: ${exceptions.length}, failed requests: ${failedRequests.length}, http errors: ${responses.filter(r => r.status >= 400).length}`);
console.log(`report -> ${OUT}ai-live-probe.json`);

await cdp.send('Page.close').catch(() => {});
cdp.close();
process.exit(0);
