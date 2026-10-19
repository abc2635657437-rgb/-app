// Runtime evidence: which URLs the running app actually requests.
//
// Static analysis guesses; this asks the browser. Load the shell, walk every
// screen, and dump the resource timeline — that is the ground truth for what
// ships versus what is dead weight.
//
//   node scripts/audit-runtime.mjs [url]

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync);
const PORT = 9481;
const URL = process.argv[2] || 'http://127.0.0.1:8787/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let id = 0;
const pending = new Map();

const child = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(process.cwd(), 'outputs', 'runtime-' + Date.now())}`,
  '--no-first-run',
  '--hide-scrollbars',
  '--window-size=430,900',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  URL,
], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
          ws.onopen = res;
          ws.onerror = rej;
        });
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
          }
        };
        return;
      }
    } catch {
      /* keep trying */
    }
    await sleep(400);
  }
  throw new Error('no attach');
}

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return 'THREW ' + (r.exceptionDetails.exception?.description || '').slice(0, 160);
  return r.result?.value;
};

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await sleep(2500);

  // walk every destination so lazily loaded code has a chance to run
  for (const screen of ['map', 'home', 'friends', 'publish', 'messages', 'profile']) {
    await evaluate(`go('${screen}')`);
    await sleep(screen === 'map' ? 4500 : 500);
  }

  const urls = await evaluate(`(() => {
    const seen = new Set();
    const add = (list) => list.forEach((entry) => seen.add(entry.name));
    add(performance.getEntriesByType('resource'));
    try {
      const frame = document.getElementById('exploreFrame');
      const win = frame && frame.contentWindow;
      if (win && win.performance) add(win.performance.getEntriesByType('resource'));
    } catch (e) { /* cross-origin is not expected here */ }
    return JSON.stringify([...seen].sort());
  })()`);

  const paths = JSON.parse(urls);
  writeFileSync('outputs/runtime-assets.json', JSON.stringify(paths, null, 2));
  console.log('requested paths:', paths.length);
  console.log('written to outputs/runtime-assets.json');
  const same = paths.filter((p) => p.startsWith('http://127.0.0.1:8787') || p.startsWith('/'));
  console.log('same-origin paths:', same.length, '| external:', paths.length - same.length);
  const explore = paths.filter((p) => p.includes('explore3d'));
  console.log('\nexplore assets actually fetched:');
  for (const p of explore) console.log('   ' + p);
} finally {
  child.kill();
  ws?.close();
}
