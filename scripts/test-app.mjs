// End-to-end interaction check for the unified shell.
//   node scripts/test-app.mjs [url]
//
// Walks every destination, exercises the explore screen inside its frame, and
// fails loudly instead of printing a screenshot and hoping.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync);
const PORT = 9471;
const URL = process.argv[2] || 'http://127.0.0.1:8787/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws;
let id = 0;
const pending = new Map();
const errors = [];
const results = [];

const child = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(process.cwd(), 'outputs', 'test-' + Date.now())}`,
  '--no-first-run',
  '--hide-scrollbars',
  '--window-size=430,900',
  '--force-device-scale-factor=1',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  URL,
], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        ws.onmessage = ev => {
          const msg = JSON.parse(ev.data);
          if (msg.method === 'Runtime.exceptionThrown') {
            errors.push(String(msg.params?.exceptionDetails?.exception?.description || '').slice(0, 200));
          }
          if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
            errors.push((msg.params.args || []).map(a => a.value || a.description).join(' ').slice(0, 160));
          }
          if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        };
        return;
      }
    } catch (_) {}
    await sleep(400);
  }
  throw new Error('no attach');
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, msg => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return 'THREW: ' + (r.exceptionDetails.exception?.description || '').slice(0, 160);
  return r.result?.value;
};
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  · ' + detail : ''));
};

const screenNow = async () => evaluate("document.querySelector('.screen.active')?.id || 'none'");

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await sleep(3000);

  check('landing shows 首页', (await screenNow()) === 'home');
  const feed = await evaluate("document.getElementById('communityFeed')?.childElementCount || 0");
  check('home feed rendered', feed > 0, feed + ' nodes');

  const bar = await evaluate("[...document.querySelectorAll('#appNav button')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(b => b.dataset.id || 'publish').join('>')");
  check('nav has five destinations, chat after publish', bar === 'home>map>publish>messages>friends', bar);

  // --- explore -------------------------------------------------------------
  await evaluate("go('map')");
  // a cold production instance can take several seconds to build the scene, so
  // wait for readiness instead of assuming a fixed delay
  let waited = 0;
  while (waited < 25000) {
    const ready = await evaluate("(() => { const d = document.getElementById('exploreFrame')?.contentDocument; return !!(d && d.defaultView.__explore3dReady); })()");
    if (ready === true) break;
    await sleep(500);
    waited += 500;
  }
  await sleep(600);
  check('探索 screen active', (await screenNow()) === 'map');
  const frame = await evaluate(`(() => {
    const f = document.getElementById('exploreFrame');
    const d = f && f.contentDocument;
    if (!d) return JSON.stringify({ ok: false, why: 'no document' });
    const canvas = d.getElementById('scene');
    return JSON.stringify({
      ok: true,
      ready: !!d.defaultView.__explore3dReady,
      canvas: canvas ? canvas.width + 'x' + canvas.height : 'none',
      chips: d.querySelectorAll('.chip').length,
      cards: d.querySelectorAll('.place-card').length,
      controls: d.querySelectorAll('.map-btn').length,
      overview: !!d.querySelector('.overview'),
    });
  })()`);
  const frameState = JSON.parse(frame);
  check('explore frame loaded', frameState.ok);
  check('explore scene ready', frameState.ready === true);
  check('canvas has size', frameState.canvas !== 'none' && frameState.canvas !== '0x0', frameState.canvas);
  check('chips / cards / controls present', frameState.chips === 7 && frameState.cards >= 4 && frameState.controls === 5 && frameState.overview === true,
    `${frameState.chips} chips, ${frameState.cards} cards, ${frameState.controls} controls + overview`);

  // tap the water inside the frame
  const ripple = await evaluate(`(() => {
    const d = document.getElementById('exploreFrame').contentDocument;
    const stage = d.getElementById('stage');
    const r = stage.getBoundingClientRect();
    const opts = { clientX: r.width * 0.42, clientY: r.height * 0.55, bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', button: 0 };
    stage.dispatchEvent(new PointerEvent('pointerdown', opts));
    stage.dispatchEvent(new PointerEvent('pointerup', opts));
    return d.getElementById('status')?.textContent || '';
  })()`);
  check('tapping the lake answers', String(ripple).includes('湖面'), String(ripple).slice(0, 30));

  // open a place card inside the frame
  const place = await evaluate(`(() => {
    const d = document.getElementById('exploreFrame').contentDocument;
    const card = d.querySelector('.place-card');
    if (!card) return 'no card';
    card.click();
    return 'clicked';
  })()`);
  let cardWaited = 0;
  let cardShown = '';
  while (cardWaited < 12000) {
    cardShown = await evaluate("document.getElementById('exploreFrame').contentDocument.getElementById('placeCard')?.className || ''");
    if (String(cardShown).includes('is-visible')) break;
    await sleep(400);
    cardWaited += 400;
  }
  check('place card opens after the flight', String(cardShown).includes('is-visible'), String(cardShown).slice(0, 40));

  // --- the other screens ---------------------------------------------------
  for (const [id, name] of [['publish', '发布'], ['messages', '聊天'], ['friends', '旅友'], ['profile', '我的']]) {
    await evaluate(`go(${JSON.stringify(id)})`);
    await sleep(700);
    check(`${name} screen active`, (await screenNow()) === id);
  }

  await evaluate("go('home')");
  await sleep(500);
  check('back to 首页', (await screenNow()) === 'home');
  check('frames survive navigation', await evaluate("!!document.getElementById('exploreFrame')"));
  check('map canvas kept alive after leaving', await evaluate(
    "(() => { const d = document.getElementById('exploreFrame').contentDocument; const c = d.getElementById('scene'); return !!c && c.width > 0; })()"
  ));

  // the avatar is the only route to 我的, and it must work without a reload
  await evaluate("go('map')");
  await sleep(600);
  const before = await evaluate("performance.getEntriesByType('navigation').length + ':' + (document.getElementById('exploreFrame') ? 'frame' : 'none')");
  await evaluate("document.querySelector('.topbar-profile')?.click()");
  await sleep(700);
  check('map avatar opens 我的 in place', (await screenNow()) === 'profile');
  const after = await evaluate("performance.getEntriesByType('navigation').length + ':' + (document.getElementById('exploreFrame') ? 'frame' : 'none')");
  check('avatar did not reload the page', before === after, before + ' -> ' + after);

  await evaluate("go('home')");
  await sleep(400);
  await evaluate("document.querySelector('.home-avatar')?.click()");
  await sleep(600);
  check('home avatar opens 我的', (await screenNow()) === 'profile');

  // a tab tap inside the embedded explore page must switch screens, not reload
  await evaluate("go('map')");
  await sleep(800);
  await evaluate("document.getElementById('exploreFrame').contentDocument.querySelector('a[href*=\"screen=home\"]')?.click()");
  await sleep(800);
  check('explore tab returns to 首页 in place', (await screenNow()) === 'home');
  check('frame still alive after tab tap', await evaluate("!!document.getElementById('exploreFrame')"));

  // a broken GLSL compiles to a black surface and never throws; the scene
  // records those failures itself
  const shaderErrors = await evaluate("(() => { const d = document.getElementById('exploreFrame')?.contentDocument; return d && d.defaultView.__shaderErrors ? d.defaultView.__shaderErrors.length : -1; })()");
  check('no shader compile errors', shaderErrors === 0, String(shaderErrors));

  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (error) {
  console.log('HARNESS_ERROR', error.message);
  results.push({ ok: false });
} finally {
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  child.kill();
  ws?.close();
  process.exitCode = failed ? 1 : 0;
}
