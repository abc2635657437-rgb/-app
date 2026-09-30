import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../modules/auth/auth-web.js', import.meta.url), 'utf8');
function harness(search = '', saved = {}) {
  const storage = new Map(Object.entries(saved));
  const messages = [], navigation = [], events = [];
  const toast = { style: {}, hidden: true };
  const context = {
    URL, URLSearchParams, AbortSignal, FormData,
    location: { protocol: 'https:', origin: 'https://travel-world-mwdw.onrender.com', href: 'https://travel-world-mwdw.onrender.com/?preview=old', search, hash: '' },
    history: { replaceState() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { querySelector: () => null, getElementById: id => id === 'twToast' ? toast : id === 'discover' ? {} : null },
    window: { go: screen => navigation.push(screen), dispatchEvent: event => events.push(event.type) },
    Event, setTimeout: () => 1, clearTimeout() {},
    fetch: async () => { throw new Error('network unavailable'); },
  };
  Object.defineProperty(toast, 'textContent', { set: value => messages.push(value) });
  vm.createContext(context);
  vm.runInContext(source.replace(/\}\(\)\);\s*$/, 'window.testAuth = { oauthClient, startGoogle }; }());'), context);
  return { context, storage, messages, navigation, events };
}

test('QQ callback restores the intended screen and broadcasts sign-in', () => {
  const h = harness('?oauth=qq-signed-in', { 'tw-oauth-return-screen': 'discover' });
  assert.deepEqual(h.navigation, ['discover']);
  assert.equal(h.storage.has('tw-oauth-return-screen'), false);
  assert.deepEqual(h.events, ['tw-auth-change']);
  assert.deepEqual(h.messages, ['登录成功']);
});

test('QQ callback feedback follows the persisted English preference', () => {
  const h = harness('?oauth=qq-signed-in', { 'tw-state': '{"lang":"en"}' });
  assert.deepEqual(h.messages, ['Signed in']);
});

test('failed OAuth initialization can be retried and Google uses the clean production return URL', async () => {
  const h = harness();
  let requests = 0, options;
  h.context.window.supabase = { createClient: () => ({ auth: { signInWithOAuth: async value => { options = value; return {}; } } }) };
  h.context.fetch = async () => {
    requests++;
    if (requests === 1) throw new Error('temporary network failure');
    return { ok: true, json: async () => ({ supabaseUrl: 'https://project.supabase.co', anonKey: 'public-test-key' }) };
  };
  await assert.rejects(h.context.window.testAuth.oauthClient(), /temporary network failure/);
  await h.context.window.testAuth.oauthClient();
  const label = {};
  await h.context.window.testAuth.startGoogle({ querySelector: () => label });
  assert.equal(requests, 2);
  assert.equal(options.provider, 'google');
  assert.equal(options.options.redirectTo, 'https://travel-world-mwdw.onrender.com/');
});
