import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../modules/auth/auth-web.js', import.meta.url), 'utf8');
function harness(search = '', saved = {}) {
  const storage = new Map(Object.entries(saved));
  const messages = [], navigation = [], events = [], cleanedUrls = [], errors = {};
  const toast = { style: {}, hidden: true };
  const context = {
    URL, URLSearchParams, AbortSignal, FormData,
    location: { protocol: 'https:', origin: 'https://travel-world-mwdw.onrender.com', href: 'https://travel-world-mwdw.onrender.com/?preview=old', search, hash: '' },
    history: { replaceState: (_state, _title, url) => cleanedUrls.push(url) },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { querySelector: () => null, getElementById: id => id === 'twToast' ? toast : id === 'authError' ? errors : id === 'discover' ? {} : null },
    window: { go: screen => navigation.push(screen), dispatchEvent: event => events.push(event.type) },
    Event, setTimeout: () => 1, clearTimeout() {},
    fetch: async () => { throw new Error('network unavailable'); },
  };
  Object.defineProperty(toast, 'textContent', { set: value => messages.push(value) });
  vm.createContext(context);
  vm.runInContext(source.replace("function show(mode = 'login') {", "function show(mode = 'login') { window.shownMode = mode; return;").replace(/\}\(\)\);\s*$/, 'window.testAuth = { oauthClient, startGoogle, saveSession, refreshSession }; }());'), context);
  return { context, storage, messages, navigation, events, cleanedUrls, errors };
}

test('invalid OAuth state exposes a fresh sign-in without deleting the existing account session', () => {
  const saved = JSON.stringify({ user: { id: 'existing-user' }, access_token: 'test-only' });
  const h = harness('?error_code=bad_oauth_state', { 'tw-auth-session': saved });
  assert.equal(h.context.window.shownMode, 'login');
  assert.match(h.errors.textContent, /授权链接已失效/);
  assert.equal(h.storage.get('tw-auth-session'), saved);
  assert.deepEqual(h.events, []);
});

test('remembered sessions survive reload within 60 days and expire after that', () => {
  const saved = JSON.stringify({ user: { id: 'existing-user' }, access_token: 'test-only' });
  const recent = harness('', { 'tw-auth-session': saved, 'tw-auth-signed-in-at': String(Date.now() - 30 * 86400000) });
  assert.equal(recent.context.window.TravelWorldAuth.session().user.id, 'existing-user');
  const expired = harness('', { 'tw-auth-session': saved, 'tw-auth-signed-in-at': String(Date.now() - 61 * 86400000) });
  assert.equal(expired.context.window.TravelWorldAuth.session(), null);
  assert.equal(expired.storage.has('tw-auth-session'), false);
});

test('renewal preserves remember deadline and ignores responses after an account switch', async () => {
  const at = String(Date.now() - 86400000);
  const h = harness('', { 'tw-auth-session': JSON.stringify({ refresh_token: 'old', user: { id: 'one' } }), 'tw-auth-signed-in-at': at });
  h.context.fetch = async () => ({ ok: true, json: async () => ({ session: { refresh_token: 'renewed', user: { id: 'one' } } }) });
  assert.equal(await h.context.window.testAuth.refreshSession(), true);
  assert.equal(h.storage.get('tw-auth-signed-in-at'), at);
  let finish;
  h.context.fetch = () => new Promise(resolve => { finish = resolve; });
  const refresh = h.context.window.testAuth.refreshSession();
  h.context.window.testAuth.saveSession({ refresh_token: 'other', user: { id: 'two' } });
  finish({ ok: true, json: async () => ({ session: { refresh_token: 'stale', user: { id: 'one' } } }) });
  assert.equal(await refresh, false);
  assert.equal(h.context.window.TravelWorldAuth.session().user.id, 'two');
});

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
