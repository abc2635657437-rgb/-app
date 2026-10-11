// Supabase owns code generation, expiry, delivery and identity matching.
export function installEmailOtp(app, authClient, publicAppUrl) {
  const attempts = new Map();
  function logAuthFailure(error) {
    const message = String(error?.message || '').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]').slice(0, 240);
    console.error(JSON.stringify({ event: 'email_otp_auth_failure', status: error?.status, code: error?.code, name: error?.name, message }));
  }
  function limit(key, maximum, windowMs, res) {
    const now = Date.now();
    for (const [entry, value] of attempts) if (value.until <= now) attempts.delete(entry);
    const value = attempts.get(key) || { count: 0, until: now + windowMs };
    if (value.count >= maximum || attempts.size >= 10000) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((value.until - now) / 1000)));
      res.status(429).json({ code: 'otp_rate_limit' }); return false;
    }
    value.count++; attempts.set(key, value); return true;
  }
  for (const action of ['send', 'verify']) app.post(`/api/auth/email/${action}`, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ code: 'invalid_email' });
    const token = String(req.body?.token || '').trim();
    if (action === 'verify' && !/^\d{6}$/.test(token)) return res.status(400).json({ code: 'invalid_otp' });
    if (!limit(`${action}:ip:${req.ip}`, 60, 600000, res) || !limit(`${action}:email:${email}`, action === 'send' ? 1 : 10, action === 'send' ? 60000 : 600000, res)) return;
    try {
      const result = action === 'send'
        ? await authClient.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: new URL('/', publicAppUrl).href } })
        : await authClient.auth.verifyOtp({ email, token, type: 'email' });
      if (result.error) {
        logAuthFailure(result.error);
        return res.status(result.error.status === 429 ? 429 : 400).json({ code: action === 'send' ? 'otp_delivery_failed' : 'otp_invalid_or_expired' });
      }
      if (action === 'send') return res.json({ sent: true, retryAfter: 60 });
      if (!result.data?.session) return res.status(401).json({ code: 'otp_invalid_or_expired' });
      res.json({ user: result.data.user, session: result.data.session });
    } catch (error) { logAuthFailure(error); res.status(503).json({ code: 'auth_unavailable' }); }
  });
}
