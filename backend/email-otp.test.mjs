import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installEmailOtp } from './email-otp.mjs';

test('email OTP delegates verification to Supabase, rate limits sends and never returns a code', async t => {
  const calls = [], session = { access_token: 'unit-test-token', user: { id: 'unit-test-user' } };
  const app = express(); app.use(express.json());
  installEmailOtp(app, { auth: {
    signInWithOtp: async value => { calls.push(value); return { data: {}, error: value.email === 'delivery@example.com' ? { status: 400 } : null }; },
    verifyOtp: async value => { calls.push(value); return value.token === '123456' ? { data: { session, user: session.user } } : { error: { status: 400 } }; }
  } }, 'https://travel-world-mwdw.onrender.com');
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const post = async (action, value) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/email/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await post('send', { email: 'bad-email' })).status, 400);
  assert.deepEqual(await post('send', { email: ' Person@QQ.com ' }), { status: 200, body: { sent: true, retryAfter: 60 } });
  assert.equal(calls[0].email, 'person@qq.com');
  assert.equal(calls[0].options.shouldCreateUser, true);
  assert.equal((await post('send', { email: 'person@qq.com' })).status, 429);
  assert.equal((await post('verify', { email: 'person@qq.com', token: 'wrong' })).status, 400);
  assert.equal((await post('verify', { email: 'person@qq.com', token: '000000' })).body.code, 'otp_invalid_or_expired');
  assert.deepEqual((await post('verify', { email: 'person@qq.com', token: '123456' })).body.session, session);
  assert.equal(calls.at(-1).type, 'email');
  assert.equal((await post('send', { email: 'delivery@example.com' })).body.code, 'otp_delivery_failed');
  for (let i = 0; i < 8; i++) await post('verify', { email: 'person@qq.com', token: '000000' });
  assert.equal((await post('verify', { email: 'person@qq.com', token: '123456' })).status, 429);
});
