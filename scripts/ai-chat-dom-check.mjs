// DOM-level check for the native travel assistant screen.
//
// Headless-browser screenshots are not reliable in this environment (a running
// Edge instance swallows headless launches), so the module is exercised against
// a minimal DOM shim instead: the panel structure, the SSE render path, HTML
// escaping and the hand-off to the route studio are all asserted.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SOURCE = new URL('../modules/ai/ai-chat.js', import.meta.url);
const code = await readFile(SOURCE, 'utf8');

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parent = null;
    this.className = '';
    this.id = '';
    this.textContent = '';
    this._html = '';
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.hidden = false;
    this.type = '';
    this.value = '';
    this.maxLength = 0;
    this.placeholder = '';
    this.rows = 1;
  }
  set innerHTML(value) {
    this._html = String(value);
    // Tiny parser for the static chrome the module builds with innerHTML:
    // <span>text</span><button data-x>text</button>. Enough to answer the
    // attribute and descendant selectors the module queries.
    this.children = [];
    const pattern = /<([a-z]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*(?:\/>|>([\s\S]*?)<\/\1>)/gi;
    let match;
    while ((match = pattern.exec(String(value)))) {
      const node = new Element(match[1]);
      const attrs = match[2] || '';
      const attrPattern = /([a-z-]+)(?:="([^"]*)")?/gi;
      let attr;
      while ((attr = attrPattern.exec(attrs))) {
        node.setAttribute(attr[1], attr[2] === undefined ? '' : attr[2]);
        if (attr[1] === 'class') node.className = attr[2] || '';
        if (attr[1] === 'id') node.id = attr[2] || '';
      }
      node.textContent = (match[3] || '').replace(/<[^>]+>/g, '');
      node._html = match[3] || '';
      this.appendChild(node);
    }
  }
  get innerHTML() { return this._html; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); return this; }
  appendChild(node) {
    if (!node) return node;
    node.parent = this;
    this.children.push(node);
    return node;
  }
  prepend(node) {
    node.parent = this;
    this.children.unshift(node);
    return node;
  }
  replaceWith(node) {
    const at = this.parent ? this.parent.children.indexOf(this) : -1;
    if (at >= 0) { this.parent.children[at] = node; node.parent = this.parent; }
  }
  remove() {
    const at = this.parent ? this.parent.children.indexOf(this) : -1;
    if (at >= 0) this.parent.children.splice(at, 1);
  }
  addEventListener(name, handler) { (this.listeners[name] = this.listeners[name] || []).push(handler); }
  dispatch(name, event = {}) {
    (this.listeners[name] || []).forEach(handler => handler(event));
    if (name === 'submit' && this.onsubmit) this.onsubmit(event);
  }
  querySelectorAll(selector) { return query(this, selector); }
  querySelector(selector) { return query(this, selector)[0] || null; }
  closest() { return null; }
  scrollIntoView() {}
  focus() {}
  get scrollHeight() { return 0; }
  set scrollTop(_) {}
  get scrollTop() { return 0; }
}

// Supports the selectors the module actually uses: tag, .class, #id, [attr],
// [attr="value"], tag[attr] compounds, and "ancestor descendant" chains.
function matchPart(node, part) {
  const tagMatch = part.match(/^([a-z][a-z0-9]*)/i);
  if (tagMatch && node.tagName !== tagMatch[1].toUpperCase()) return false;
  const classes = [...part.matchAll(/\.([a-z0-9_-]+)/gi)].map(m => m[1]);
  if (classes.some(name => !node.className.split(/\s+/).includes(name))) return false;
  const idMatch = part.match(/#([a-z0-9_-]+)/i);
  if (idMatch && node.id !== idMatch[1]) return false;
  const attrs = [...part.matchAll(/\[([a-z-]+)(?:="([^"]*)")?\]/g)];
  for (const [, name, value] of attrs) {
    // Boolean attributes are stored as an empty string, so presence must be
    // tested on the attribute map, not on truthiness.
    const has = Object.prototype.hasOwnProperty.call(node.attributes, name);
    const actual = has ? node.attributes[name] : node[name];
    if (value === undefined) {
      if (!has && (actual === undefined || actual === '' || actual === false)) return false;
    } else if (actual !== value) return false;
  }
  return true;
}

function query(root, selector) {
  const collect = node => node.children.reduce((all, child) => all.concat(child, collect(child)), []);
  const parts = String(selector).trim().split(/\s+/);
  let nodes = [root];
  for (const part of parts) {
    const next = [];
    for (const node of nodes) for (const candidate of collect(node)) if (matchPart(candidate, part)) next.push(candidate);
    nodes = next;
  }
  return nodes;
}

function makeDocument() {
  const head = new Element('head');
  const body = new Element('body');
  const main = new Element('main');
  main.className = 'app';
  const section = new Element('section');
  section.id = 'ai';
  section.className = 'screen';
  // Mirrors index.html: the static intro the module must not overwrite.
  const eyebrow = new Element('div');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'TRAVEL WORLD AI';
  const title = new Element('div');
  title.className = 'title';
  title.textContent = '问一句，把衣·食·住·行·玩理清楚。';
  const sub = new Element('div');
  sub.className = 'sub';
  sub.textContent = '旅行助手按你自己的目的地、天数和预算给出可执行的建议。';
  section.append(eyebrow, title, sub);
  main.appendChild(section);
  body.appendChild(main);
  const registry = { head, body, main, ai: section };
  const collect = node => node.children.reduce((all, child) => all.concat(child, collect(child)), []);
  return {
    readyState: 'complete',
    head,
    body,
    documentElement: new Element('html'),
    createElement: tag => new Element(tag),
    createTextNode: text => { const node = new Element('#text'); node.textContent = String(text); return node; },
    getElementById: id => collect(body).find(node => node.id === id) || (head.id === id ? head : null),
    querySelector: selector => (selector === '.app' ? main : query(body, selector)[0] || null),
    querySelectorAll: selector => query(body, selector),
    addEventListener() {}
  };
}

function makeWindow() {
  const store = new Map();
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    requestAnimationFrame: fn => setTimeout(fn, 0),
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key)
    },
    location: { search: '', protocol: 'https:', hostname: 'travel-world-mwdw.onrender.com' },
    navigator: {},
    AbortSignal: { timeout: () => ({ aborted: false }) },
    TextDecoder,
    addEventListener() {},
    dispatchEvent() {}
  };
  return { sandbox, store };
}

async function run({ fetchImpl, auth, auto = false }) {
  const document = makeDocument();
  const { sandbox, store } = makeWindow();
  sandbox.document = document;
  sandbox.window = sandbox;
  sandbox.fetch = fetchImpl;
  sandbox.TravelWorldAuth = auth;
  sandbox.TravelWorldI18n = { language: () => 'zh' };
  sandbox.openStudio = (routeId, draft) => { sandbox.__studio = { routeId, draft }; };
  if (auto) sandbox.location.search = '?auto=1';

  // The module is an IIFE that reads these names as globals; passing them as
  // parameters of the same name binds every reference to the shims above.
  const names = ['window', 'document', 'localStorage', 'location', 'navigator', 'fetch',
    'AbortSignal', 'TextDecoder', 'setTimeout', 'clearTimeout', 'setInterval',
    'requestAnimationFrame', 'console', 'addEventListener', 'dispatchEvent'];
  const factory = new Function(...names, '"use strict";\n' + code);
  factory(
    sandbox, document, sandbox.localStorage, sandbox.location, sandbox.navigator, sandbox.fetch,
    sandbox.AbortSignal, sandbox.TextDecoder, sandbox.setTimeout, sandbox.clearTimeout,
    sandbox.setInterval, sandbox.requestAnimationFrame, sandbox.console,
    sandbox.addEventListener, sandbox.dispatchEvent
  );
  await new Promise(resolve => setTimeout(resolve, 60));
  return { document, sandbox, store };
}

function sseResponse(chunks) {
  const body = chunks.map(chunk => `event: ${chunk.event}\ndata: ${JSON.stringify(chunk.data)}\n\n`).join('');
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        const encoder = new TextEncoder();
        let sent = false;
        return {
          async read() {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: encoder.encode(body) };
          }
        };
      }
    }
  };
}

const anonymousAuth = { request: async () => [], session: () => null, requireLogin: () => true, showLogin: () => {}, toast: () => {} };

// 1. The panel builds without touching the static intro copy, and the composer
//    plus prompt chips are present.
{
  const { document } = await run({ fetchImpl: async () => sseResponse([]), auth: anonymousAuth });
  const section = document.getElementById('ai');
  assert.ok(section.children.some(node => node.className.includes('sub')), 'the SEO intro copy must survive');
  const panel = section.children.find(node => node.id === 'aiChatPanel');
  assert.ok(panel, 'the chat panel must be appended');
  assert.ok(panel.querySelector('.ai-chat-compose textarea'), 'a composer textarea must exist');
  assert.ok(panel.querySelector('.ai-chat-compose button[type="submit"]'), 'a submit button must exist');
  assert.equal(panel.querySelectorAll('.ai-chat-prompt').length, 6, 'all five planning axes plus a plan chip');
  assert.ok(panel.querySelector('.ai-chat-signin'), 'anonymous visitors see the sign-in hint');
  assert.ok(section.querySelector('.ai-chat-note'), 'the AI disclosure note must be present');
  console.log('AI chat structure passed: intro preserved, panel, composer, six prompts, disclosure.');
}

// 2. A streamed answer renders incrementally and lands in the turn history.
{
  const calls = [];
  const { document, store } = await run({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return sseResponse([
        { event: 'meta', data: { sources: ['https://www.wikidata.org/wiki/Q1202239'], grounded: 2, disclaimer: 'AI 生成' } },
        { event: 'delta', data: { text: '**衣**：带薄外套。\n' } },
        { event: 'delta', data: { text: '**食**：锦市场。' } },
        { event: 'done', data: { answer: '**衣**：带薄外套。\n**食**：锦市场。', isAI: true } }
      ]);
    },
    auth: anonymousAuth
  });
  const panel = document.getElementById('ai').children.find(node => node.id === 'aiChatPanel');
  const form = panel.querySelector('.ai-chat-compose');
  const textarea = panel.querySelector('.ai-chat-compose textarea');
  textarea.value = '京都两天怎么安排';
  form.dispatch('submit', { preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 120));

  assert.equal(calls.length, 1, 'exactly one assistant request per question');
  assert.equal(calls[0].url, '/api/ai/assistant');
  assert.match(calls[0].init.headers.Accept, /text\/event-stream/, 'the client must ask for a stream');
  const bubbles = panel.querySelectorAll('.bubble');
  assert.equal(bubbles.length, 2, 'one user bubble and one assistant bubble');
  assert.equal(bubbles[0].className, 'bubble me');
  assert.equal(bubbles[1].className, 'bubble ai');
  const body = bubbles[1].querySelector('.ai-chat-body');
  assert.match(body.innerHTML, /<b>衣<\/b>/, 'bold markers become real bold');
  assert.match(body.innerHTML, /锦市场/, 'the streamed text is rendered');
  assert.ok(bubbles[1].querySelector('.ai-chat-sources'), 'sources are attached to the answer');
  assert.ok(bubbles[1].querySelector('.ai-chat-actions button'), 'the make-a-route action is offered');
  const saved = JSON.parse(store.get('tw-ai-chat-v1'));
  assert.equal(saved.length, 2);
  assert.equal(saved[1].role, 'assistant');
  assert.match(saved[1].content, /锦市场/);
  console.log('AI chat streaming passed: SSE request, incremental render, sources, history.');
}

// 3. Model output can never inject markup.
{
  const { document } = await run({
    fetchImpl: async () => sseResponse([
      { event: 'delta', data: { text: '<img src=x onerror="alert(1)"><script>alert(2)</script>[正常](https://example.com)' } },
      { event: 'done', data: { answer: '<img src=x onerror="alert(1)"><script>alert(2)</script>[正常](https://example.com)' } }
    ]),
    auth: anonymousAuth
  });
  const panel = document.getElementById('ai').children.find(node => node.id === 'aiChatPanel');
  const textarea = panel.querySelector('.ai-chat-compose textarea');
  textarea.value = '测试';
  panel.querySelector('.ai-chat-compose').dispatch('submit', { preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 120));
  const html = panel.querySelectorAll('.bubble')[1].querySelector('.ai-chat-body').innerHTML;
  assert.ok(!/<img\b/i.test(html), 'raw img tags must never be emitted');
  assert.ok(!/<script/i.test(html), 'raw script tags must never be emitted');
  assert.match(html, /&lt;img src=x onerror=/, 'the payload survives as inert escaped text');
  assert.match(html, /&lt;script&gt;/, 'script payloads are escaped, not executed');
  assert.match(html, /<a href="https:\/\/example\.com"/, 'explicit links are still clickable');
  console.log('AI chat escaping passed: model markup is escaped, links stay clickable.');
}

// 4. An upstream failure degrades to a readable message instead of hanging.
{
  const { document } = await run({
    fetchImpl: async () => ({ ok: false, status: 502, body: null, json: async () => ({ error: 'AI unavailable' }) }),
    auth: anonymousAuth
  });
  const panel = document.getElementById('ai').children.find(node => node.id === 'aiChatPanel');
  const textarea = panel.querySelector('.ai-chat-compose textarea');
  textarea.value = '测试';
  panel.querySelector('.ai-chat-compose').dispatch('submit', { preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 120));
  const bubble = panel.querySelectorAll('.bubble')[1];
  assert.match(bubble.querySelector('.ai-chat-body').innerHTML, /AI unavailable|连接不上|unreachable/, 'the failure reason must be shown');
  console.log('AI chat failure passed: upstream errors surface as readable text.');
}

// 5. The make-a-route action hands a usable draft to the studio.
{
  const { document, sandbox } = await run({
    fetchImpl: async () => sseResponse([
      { event: 'delta', data: { text: '京都 2 天路线：清水寺、锦市场、岚山。' } },
      { event: 'done', data: { answer: '京都 2 天路线：清水寺、锦市场、岚山。' } }
    ]),
    auth: { ...anonymousAuth, session: () => ({ access_token: 'token' }) }
  });
  const panel = document.getElementById('ai').children.find(node => node.id === 'aiChatPanel');
  const textarea = panel.querySelector('.ai-chat-compose textarea');
  textarea.value = '京都 2 天怎么玩';
  panel.querySelector('.ai-chat-compose').dispatch('submit', { preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 120));
  const button = panel.querySelectorAll('.bubble')[1].querySelector('.ai-chat-actions button');
  button.onclick();
  assert.ok(sandbox.__studio, 'openStudio must be called');
  assert.equal(sandbox.__studio.routeId, null, 'a draft always creates a new route');
  assert.equal(sandbox.__studio.draft.dest, '京都', 'the destination is extracted from the question');
  assert.match(sandbox.__studio.draft.tips, /锦市场/, 'the answer is carried over as editable tips');
  assert.ok(sandbox.__studio.draft.title.length > 0, 'a title is proposed');
  console.log('AI chat hand-off passed: draft carries destination, title and tips.');
}

console.log('All AI chat checks passed.');
