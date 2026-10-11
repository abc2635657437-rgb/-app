(function () {
  const base = location.protocol === 'file:' ? 'http://localhost:8787' : '';
  const key = 'tw-auth-session';
  const returnScreenKey = 'tw-oauth-return-screen';
  let session = null; try { session = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { localStorage.removeItem(key); }
  const signedInKey = 'tw-auth-signed-in-at', rememberMs = 60 * 24 * 60 * 60 * 1000;
  let renewalTimer;
  if (session) {
    const signedInAt = Number(localStorage.getItem(signedInKey) || Date.now());
    if (!Number.isFinite(signedInAt) || Date.now() - signedInAt >= rememberMs) { session = null; localStorage.removeItem(key); localStorage.removeItem(signedInKey); }
    else localStorage.setItem(signedInKey, String(signedInAt));
  }
  function toast(message) { let node = document.getElementById('twToast'); if (!node) { node = document.createElement('div'); node.id = 'twToast'; node.style.cssText = 'position:fixed;z-index:30;left:50%;bottom:88px;transform:translateX(-50%);background:#173f4f;color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;box-shadow:0 8px 22px #173f4f33'; document.body.appendChild(node); } node.textContent = message; node.hidden = false; clearTimeout(node._timer); node._timer = setTimeout(() => { node.hidden = true; }, 2200); }
  const english = () => (window.TravelWorldI18n?.language?.() || (() => { try { return JSON.parse(localStorage.getItem('tw-state') || '{}').lang; } catch (_) { return 'zh'; } })()) === 'en';
  const phrase = (zh, en) => english() ? en : zh;
  function rememberReturnScreen() { const screen = document.querySelector('.screen.active')?.id; if (screen) localStorage.setItem(returnScreenKey, screen); }
  function restoreReturnScreen() { const screen = localStorage.getItem(returnScreenKey); localStorage.removeItem(returnScreenKey); if (screen && document.getElementById(screen)) window.go?.(screen); }
  function cleanOAuthUrl() { const url = new URL(location.href); ['code','state','type','provider','error','error_code','error_description','oauth','oauth_error'].forEach(key => url.searchParams.delete(key)); url.hash = ''; history.replaceState({}, '', url.pathname + url.search); }
  let oauthClientPromise;
  async function oauthClient() {
    if (!oauthClientPromise) oauthClientPromise = (async () => {
      if (!window.supabase?.createClient) await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/modules/vendor/supabase.js?v=1'; script.onload = resolve; script.onerror = () => reject(new Error(phrase('第三方登录组件未加载，请刷新页面重试', 'Sign-in service did not load. Refresh and try again.'))); document.head.appendChild(script); });
      if (!window.supabase?.createClient) throw new Error(phrase('第三方登录组件未加载，请刷新页面重试', 'Sign-in service did not load. Refresh and try again.'));
      const response = await fetch(base + '/api/config'), config = await response.json().catch(() => ({}));
      if (!response.ok || !config.supabaseUrl || !config.anonKey) throw new Error(phrase('认证服务暂不可用', 'Authentication service is unavailable.'));
      return window.supabase.createClient(config.supabaseUrl, config.anonKey, { auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: true, persistSession: true } });
    })();
    try { return await oauthClientPromise; } catch (error) { oauthClientPromise = null; throw error; }
  }
  async function startGoogle(button) {
    button.disabled = true; button.querySelector('[data-provider-label]').textContent = phrase('正在连接 Google…', 'Connecting to Google…');
    try {
      rememberReturnScreen();
      const client = await oauthClient(), redirectTo = new URL(location.origin + '/');
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo.href } });
      if (error) throw error;
    } catch (error) { localStorage.removeItem(returnScreenKey); button.disabled = false; button.querySelector('[data-provider-label]').textContent = phrase('使用 Google 继续', 'Continue with Google'); document.getElementById('authError').textContent = /provider|not enabled|unsupported/i.test(error.message || '') ? phrase('Google 登录尚未配置，请联系管理员', 'Google sign-in is not configured yet. Contact the administrator.') : (error.message || phrase('Google 登录失败，请重试', 'Google sign-in failed. Try again.')); }
  }
  async function startQQ(button) {
    button.disabled = true; button.querySelector('[data-provider-label]').textContent = phrase('正在连接 QQ…', 'Connecting to QQ…');
    try {
      rememberReturnScreen();
      const response = await fetch(base + '/api/auth/qq/start', { signal: AbortSignal.timeout(15000) }), body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizeUrl) throw new Error(body.error || phrase('QQ 登录服务暂时无法连接', 'Unable to reach QQ sign-in service.'));
      location.assign(body.authorizeUrl);
    } catch (error) { localStorage.removeItem(returnScreenKey); button.disabled = false; button.querySelector('[data-provider-label]').textContent = phrase('使用 QQ 继续', 'Continue with QQ'); document.getElementById('authError').textContent = error.message; }
  }
  function saveSession(value, renewal = false) { session = value || null; try { if (session) { localStorage.setItem(key, JSON.stringify(session)); if (!renewal) localStorage.setItem(signedInKey, String(Date.now())); } else { localStorage.removeItem(key); localStorage.removeItem(signedInKey); } } catch (_) {} scheduleRenewal(); }
  function scheduleRenewal() {
    clearTimeout(renewalTimer);
    if (!session?.refresh_token) return;
    const remaining = Number(localStorage.getItem(signedInKey)) + rememberMs - Date.now();
    if (remaining <= 0) { saveSession(null); render(); window.dispatchEvent(new Event('tw-auth-change')); return; }
    const untilExpiry = (Number(session.expires_at) * 1000 || Date.now()) - Date.now() - 60000;
    renewalTimer = setTimeout(async () => { await refreshSession(); scheduleRenewal(); }, Math.min(remaining, Math.max(30000, Math.min(untilExpiry, 1800000))));
  }
  let refreshing = null;
  async function refreshSession() { if (!session?.refresh_token) return false; const ownerToken = session.refresh_token; if (!refreshing) refreshing = fetch(base + '/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: ownerToken }), signal: AbortSignal.timeout(15000) }).then(async response => { const body = await response.json().catch(() => ({})); if (session?.refresh_token !== ownerToken) return false; if (!response.ok || !body.session) { if (response.status === 401) { saveSession(null); render(); window.dispatchEvent(new Event('tw-auth-change')); } return false; } saveSession(body.session, true); return true; }).catch(() => false).finally(() => { refreshing = null; }); return refreshing; }
  async function request(path, options = {}, retried = false) { const headers = { ...(options.headers || {}) }; if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'; if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token; const owner = session?.user?.id; const signal = options.signal || (AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined); const response = await fetch(base + path, { ...options, headers, signal }); if (owner !== session?.user?.id) throw new Error('账号已切换，请重试'); if (response.status === 401 && session && !retried) { if (await refreshSession()) return request(path, options, true); if (session) throw new Error(phrase('暂时无法续期登录状态，请检查网络后重试', 'Unable to renew your session. Check your connection and retry.')); } const body = response.status === 204 ? null : await response.json().catch(() => ({})); if (response.status === 401 && session) { saveSession(null); render(); window.dispatchEvent(new Event('tw-auth-change')); } if (!response.ok) throw new Error(body?.error || '请求失败'); return body; }
  function getDialog() { let node = document.getElementById('authDialog'); if (!node) { node = document.createElement('dialog'); node.id = 'authDialog'; node.style.cssText = 'border:0;border-radius:12px;padding:20px;width:min(390px,calc(100% - 32px));box-shadow:0 20px 60px #173f4f33'; document.body.appendChild(node); } return node; }
  let emailSendAfter = 0, emailOtpBusy = false;
  function showEmailOtp(provider) {
    const node = getDialog();
    const mailbox = provider === 'qq' ? 'QQ' : 'Gmail';
    node.innerHTML = `<form id="emailOtpForm"><div class="head"><h2>${phrase(mailbox + ' 邮箱验证码登录', mailbox + ' email code sign-in')}</h2><button type="button" class="post-map" id="otpClose">${phrase('关闭', 'Close')}</button></div><p class="muted">${phrase('首次验证自动注册；已有账号直接登录。', 'Your first verification creates an account; returning users sign in directly.')}</p><label>${phrase('邮箱', 'Email')}<input class="input" style="width:100%;font-size:16px" name="email" type="email" autocomplete="email" placeholder="${provider === 'qq' ? '123456@qq.com' : 'you@gmail.com'}" required></label><button class="btn alt" type="button" id="otpSend">${phrase('发送验证码', 'Send code')}</button><label style="display:block;margin-top:14px">${phrase('邮箱验证码', 'Email verification code')}<input class="input" style="width:100%;font-size:16px" name="token" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required></label><p class="muted">${phrase('登录后在此设备记住 60 天，主动退出后需重新验证。', 'Stay signed in on this device for up to 60 days unless you sign out.')}</p><button class="btn" type="submit">${phrase('验证并登录', 'Verify and sign in')}</button> <button class="btn alt" id="otpBack" type="button">${phrase('其他登录方式', 'Other sign-in options')}</button><div id="authError" role="status" aria-live="polite" style="margin-top:12px"></div><p style="font-size:12px"><a href="/privacy.html" target="_blank" rel="noopener">${phrase('隐私政策', 'Privacy policy')}</a> · <a href="/terms.html" target="_blank" rel="noopener">${phrase('服务说明', 'Terms')}</a></p></form>`;
    if (!node.open) node.showModal();
    node.querySelector('#otpClose').onclick = () => node.close();
    node.querySelector('#otpBack').onclick = () => show('login');
    const form = node.querySelector('form'), send = node.querySelector('#otpSend'), submit = form.querySelector('[type="submit"]'), output = node.querySelector('#authError');
    const message = code => ({ invalid_email: phrase('请输入有效邮箱', 'Enter a valid email address.'), invalid_otp: phrase('请输入邮件中的数字验证码', 'Enter the numeric code from your email.'), otp_rate_limit: phrase('请求较频繁，请稍后重试', 'Too many requests. Please try later.'), otp_delivery_failed: phrase('验证码邮件发送失败，请稍后重试或使用密码登录', 'Code delivery failed. Try later or sign in with your password.'), otp_invalid_or_expired: phrase('验证码错误或已过期，请重新发送', 'The code is incorrect or expired. Request a new one.'), auth_unavailable: phrase('认证服务暂不可用，请稍后重试', 'Sign-in is unavailable. Please try later.') })[code] || phrase('网络连接失败，请重试', 'Connection failed. Please retry.');
    async function call(action, payload) {
      const response = await fetch(base + '/api/auth/email/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(message(data.code)); return data;
    }
    send.onclick = async () => {
      if (emailOtpBusy) return;
      const email = form.elements.email;
      if (!email.reportValidity()) return;
      if (Date.now() < emailSendAfter) { output.textContent = phrase('请稍后再发送验证码', 'Please wait before requesting another code.'); return; }
      emailOtpBusy = true; send.disabled = submit.disabled = true; output.textContent = phrase('正在发送…', 'Sending…');
      try { await call('send', { email: email.value.trim() }); emailSendAfter = Date.now() + 60000; output.textContent = phrase('验证码已发送，请检查收件箱及垃圾邮件，60 秒后可重发。', 'Code sent. Check your inbox and spam folder. You can resend after 60 seconds.'); }
      catch (error) { output.textContent = error.message; }
      finally { emailOtpBusy = false; send.disabled = submit.disabled = false; }
    };
    form.onsubmit = async event => {
      event.preventDefault(); if (emailOtpBusy) return;
      emailOtpBusy = true; send.disabled = submit.disabled = true; output.textContent = phrase('正在验证…', 'Verifying…');
      try { const data = await call('verify', { email: form.elements.email.value.trim(), token: form.elements.token.value.trim() }); if (!data.session?.access_token) throw new Error(message('auth_unavailable')); saveSession(data.session); node.close(); render(); window.dispatchEvent(new Event('tw-auth-change')); toast(phrase('登录成功', 'Signed in')); }
      catch (error) { output.textContent = error.message; }
      finally { emailOtpBusy = false; send.disabled = submit.disabled = false; }
    };
  }
  function show(mode = 'login') {
    const node = getDialog(), registering = mode === 'register';
    if (!document.getElementById('tw-auth-style')) { const style = document.createElement('style'); style.id = 'tw-auth-style'; style.textContent = '.tw-auth-social{display:grid;gap:9px;margin:4px 0 16px}.tw-oauth-btn{width:100%;min-height:46px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid #d5d8d2;border-radius:8px;background:#fff;color:#24343a;font:inherit;font-size:14px;font-weight:600;cursor:pointer}.tw-oauth-btn:hover{background:#f7f7f4}.tw-oauth-btn:disabled{opacity:.58;cursor:wait}.tw-oauth-icon{width:24px;font-weight:800;font-size:17px}.tw-oauth-icon.google{font-family:Arial,sans-serif;color:#4285f4}.tw-oauth-icon.qq{font-size:12px;color:#fff;background:#3296e0;border-radius:12px;padding:3px}.tw-auth-divider{display:flex;align-items:center;gap:12px;margin:14px 0;color:#8a928e;font-size:11px;letter-spacing:1px}.tw-auth-divider:before,.tw-auth-divider:after{content:"";height:1px;background:#e4e2da;flex:1}#authDialog .tw-auth-email{display:grid;gap:5px}#authDialog .tw-auth-email .input{margin:2px 0 8px}#authDialog .tw-auth-error{min-height:20px}'; document.head.appendChild(style); }
    node.innerHTML = '<form id="authForm"><div class="head" style="margin:0 0 16px"><h2>' + (registering ? '注册 Travel World' : '登录 Travel World') + '</h2><button type="button" class="post-map" id="authClose">关闭</button></div><div class="tw-auth-social"><button type="button" class="tw-oauth-btn" id="googleAuth"><span class="tw-oauth-icon google" aria-hidden="true">G</span><span data-provider-label>使用 Google 继续</span></button><button type="button" class="tw-oauth-btn" id="qqAuth"><span class="tw-oauth-icon qq" aria-hidden="true">QQ</span><span data-provider-label>使用 QQ 继续</span></button></div><div class="tw-auth-divider">或</div><div class="tw-auth-email">' + (registering ? '<input class="input" name="displayName" placeholder="昵称" required>' : '') + '<input class="input" name="email" type="email" placeholder="邮箱" required><input class="input" name="password" type="password" minlength="8" placeholder="密码（至少 8 位）" required></div><button class="btn" type="submit">' + (registering ? '创建账号' : '登录') + '</button> <button class="btn alt" type="button" id="authSwitch">' + (registering ? '已有账号' : '注册账号') + '</button><div id="authError" class="muted tw-auth-error" style="margin-top:10px" role="status" aria-live="polite"></div><p style="font-size:12px;margin:14px 0 0"><a href="/privacy.html" target="_blank" rel="noopener">隐私政策 / Privacy</a> · <a href="/terms.html" target="_blank" rel="noopener">服务说明 / Terms</a></p></form>';
    if (!node.open) node.showModal(); node.querySelector('#authClose').onclick = () => node.close(); node.querySelector('#authSwitch').onclick = () => show(registering ? 'login' : 'register');
    node.querySelector('#googleAuth [data-provider-label]').textContent = phrase('Gmail 邮箱验证码登录', 'Sign in with a Gmail email code');
    node.querySelector('#qqAuth [data-provider-label]').textContent = phrase('QQ 邮箱验证码登录', 'Sign in with a QQ email code');
    node.querySelector('#googleAuth').onclick = () => showEmailOtp('gmail'); node.querySelector('#qqAuth').onclick = () => showEmailOtp('qq');
    node.querySelector('#authForm').onsubmit = async event => { event.preventDefault(); const form=event.currentTarget, submit=form.querySelector('[type="submit"]'), output = node.querySelector('#authError'); submit.disabled=true; output.textContent = phrase('正在连接…', 'Connecting…'); try { const result = await request('/api/auth/' + mode, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); if (!result.session) { output.textContent = phrase('注册成功！请打开邮箱，点击验证链接完成邮箱验证，再返回登录。', 'Account created. Check your email and follow the verification link, then return to sign in.'); toast(phrase('邮箱验证邮件已发送', 'Verification email sent')); return; } saveSession(result.session); node.close(); render(); window.dispatchEvent(new Event('tw-auth-change')); toast(phrase('登录成功', 'Signed in')); } catch (error) { output.textContent = error.name === 'TimeoutError' ? phrase('网络连接较慢，请重试', 'Network is slow. Please try again.') : error.message; } finally { submit.disabled=false; } };
  }
  async function logout() { const hadGoogle = session?.user?.app_metadata?.provider === 'google' || session?.user?.identities?.some(identity => identity.provider === 'google'); let failed = false; try { if (session) await request('/api/auth/logout', { method: 'POST' }); } catch (_) { failed = true; } const cleanup = oauthClientPromise || (hadGoogle ? oauthClient() : null); if (cleanup) cleanup.then(client => client.auth.signOut({ scope: 'local' })).catch(() => {}); saveSession(null); render(); window.dispatchEvent(new Event('tw-auth-change')); toast(failed ? phrase('已退出此设备；服务端退出未确认', 'Signed out on this device; server sign-out was not confirmed') : phrase('退出成功', 'Signed out')); }
  function render() { const top = document.querySelector('.community-top'); if (!top) return; let button = document.getElementById('authEntry'); if (session) { button?.remove(); return; } if (!button) { button = document.createElement('button'); button.id = 'authEntry'; button.className = 'post-map'; top.insertBefore(button, top.lastElementChild); } button.textContent = phrase('登录', 'Sign in'); button.onclick = () => show('login'); }
  window.TravelWorldAuth = { request, session: () => session, requireLogin: () => session ? true : (show('login'), false), showLogin: () => show('login'), logout, toast }; render();
  scheduleRenewal();
  window.addEventListener?.('online', () => { if (session?.refresh_token) refreshSession(); });
  window.addEventListener?.('storage', event => {
    if (event.key !== key) return;
    try { session = JSON.parse(event.newValue || 'null'); } catch (_) { session = null; }
    scheduleRenewal(); render(); window.dispatchEvent(new Event('tw-auth-change'));
  });
  const home = document.getElementById('home');
  if (home) { const footer = document.createElement('footer'); footer.style.cssText = 'padding:24px 0;font-size:12px;color:#78817d'; footer.innerHTML = '<a href="/privacy.html">隐私政策 / Privacy Policy</a> · <a href="/terms.html">服务说明 / Terms</a>'; home.appendChild(footer); }
  async function finishOAuthCallback() {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    const oauth = query.get('oauth'), oauthError = query.get('oauth_error') || query.get('error_code') || query.get('error_description') || query.get('error') || hash.get('error_code') || hash.get('error_description');
    if (oauth || oauthError) {
      cleanOAuthUrl();
      if (oauthError === 'bad_oauth_state') { restoreReturnScreen(); show('login'); document.getElementById('authError').textContent = phrase('授权链接已失效，请点击 Google 重新登录，不要返回旧授权页面。', 'The authorization link is no longer valid. Click Google to sign in again; do not reuse the old authorization page.'); return; }
      if (oauth === 'qq-linked' || oauth === 'qq-signed-in') { restoreReturnScreen(); toast(oauth === 'qq-linked' ? phrase('QQ 账号绑定成功', 'QQ account linked') : phrase('登录成功', 'Signed in')); window.dispatchEvent(new Event('tw-auth-change')); }
      else if (oauthError) { const message = oauthError === 'qq_cancelled' || query.get('error') === 'access_denied' ? phrase('已取消授权', 'Authorization was cancelled') : oauthError === 'qq_already_linked' ? phrase('此 QQ 已绑定到另一个 Travel World 账号', 'This QQ account is linked to another Travel World account') : /provider|not enabled|unsupported/i.test(oauthError) ? phrase('Google 登录尚未配置，请联系管理员', 'Google sign-in is not configured yet. Contact the administrator.') : phrase('第三方登录失败，请重试', 'Social sign-in failed. Please try again.'); restoreReturnScreen(); if (session) toast(message); else { show('login'); document.getElementById('authError').textContent = message; } }
      return;
    }
    if (!query.has('code') && !hash.has('access_token') && !hash.has('error_description')) return;
    try {
      const client = await oauthClient(), { data, error } = await client.auth.getSession();
      if (error || !data.session) throw error || new Error('No session returned');
      saveSession(data.session); cleanOAuthUrl();
      render(); window.dispatchEvent(new Event('tw-auth-change')); restoreReturnScreen(); toast(phrase('登录成功', 'Signed in'));
    } catch (error) {
      cleanOAuthUrl(); show('login'); document.getElementById('authError').textContent = error.message || phrase('授权失败或已取消，请重试', 'Authorization failed or was cancelled. Try again.');
    }
  }
  const verified=new URLSearchParams(location.search).get('verified');if(verified){history.replaceState({},'',location.pathname);toast(phrase('邮箱验证成功，请登录','Email verified. Please sign in.'));setTimeout(()=>show('login'),450)}
  else if (location.hash.includes('access_token=') && new URLSearchParams(location.hash.slice(1)).get('type') === 'signup' || new URLSearchParams(location.search).get('type') === 'signup') location.replace('/auth-confirm.html'+location.search+location.hash);
  else finishOAuthCallback();
}());
