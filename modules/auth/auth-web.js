(function () {
  const base = location.protocol === 'file:' ? 'http://localhost:8787' : '';
  const key = 'tw-auth-session';
  const returnScreenKey = 'tw-oauth-return-screen';
  let session = null; try { session = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { localStorage.removeItem(key); }
  function toast(message) { let node = document.getElementById('twToast'); if (!node) { node = document.createElement('div'); node.id = 'twToast'; node.style.cssText = 'position:fixed;z-index:30;left:50%;bottom:88px;transform:translateX(-50%);background:#173f4f;color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;box-shadow:0 8px 22px #173f4f33'; document.body.appendChild(node); } node.textContent = message; node.hidden = false; clearTimeout(node._timer); node._timer = setTimeout(() => { node.hidden = true; }, 2200); }
  const english = () => (window.TravelWorldI18n?.language?.() || (() => { try { return JSON.parse(localStorage.getItem('tw-state') || '{}').lang; } catch (_) { return 'zh'; } })()) === 'en';
  const phrase = (zh, en) => english() ? en : zh;
  function rememberReturnScreen() { const screen = document.querySelector('.screen.active')?.id; if (screen) localStorage.setItem(returnScreenKey, screen); }
  function restoreReturnScreen() { const screen = localStorage.getItem(returnScreenKey); localStorage.removeItem(returnScreenKey); if (screen && document.getElementById(screen)) window.go?.(screen); }
  function cleanOAuthUrl() { const url = new URL(location.href); ['code','state','type','provider','error','error_description','oauth','oauth_error'].forEach(key => url.searchParams.delete(key)); url.hash = ''; history.replaceState({}, '', url.pathname + url.search); }
  let oauthClientPromise;
  async function oauthClient() {
    if (!oauthClientPromise) oauthClientPromise = (async () => {
      if (!window.supabase?.createClient) await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/modules/vendor/supabase.js?v=1'; script.onload = resolve; script.onerror = () => reject(new Error(phrase('第三方登录组件未加载，请刷新页面重试', 'Sign-in service did not load. Refresh and try again.'))); document.head.appendChild(script); });
      if (!window.supabase?.createClient) throw new Error(phrase('第三方登录组件未加载，请刷新页面重试', 'Sign-in service did not load. Refresh and try again.'));
      const response = await fetch(base + '/api/config'), config = await response.json().catch(() => ({}));
      if (!response.ok || !config.supabaseUrl || !config.anonKey) throw new Error(phrase('认证服务暂不可用', 'Authentication service is unavailable.'));
      return window.supabase.createClient(config.supabaseUrl, config.anonKey, { auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: true, persistSession: true } });
    })();
    return oauthClientPromise;
  }
  async function startGoogle(button) {
    button.disabled = true; button.querySelector('[data-provider-label]').textContent = phrase('正在连接 Google…', 'Connecting to Google…');
    try {
      rememberReturnScreen();
      const client = await oauthClient(), redirectTo = new URL(location.href); redirectTo.hash = '';
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo.href } });
      if (error) throw error;
    } catch (error) { localStorage.removeItem(returnScreenKey); button.disabled = false; button.querySelector('[data-provider-label]').textContent = phrase('使用 Google 继续', 'Continue with Google'); document.getElementById('authError').textContent = /provider|not enabled|unsupported/i.test(error.message || '') ? phrase('Google 登录尚未配置，请联系管理员', 'Google sign-in is not configured yet. Contact the administrator.') : (error.message || phrase('Google 登录失败，请重试', 'Google sign-in failed. Try again.')); }
  }
  async function startQQ(button) {
    button.disabled = true; button.querySelector('[data-provider-label]').textContent = phrase('正在连接 QQ…', 'Connecting to QQ…');
    try {
      rememberReturnScreen();
      const response = await fetch(base + '/api/auth/qq/start'), body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizeUrl) throw new Error(body.error || phrase('QQ 登录服务暂时无法连接', 'Unable to reach QQ sign-in service.'));
      location.assign(body.authorizeUrl);
    } catch (error) { localStorage.removeItem(returnScreenKey); button.disabled = false; button.querySelector('[data-provider-label]').textContent = phrase('使用 QQ 继续', 'Continue with QQ'); document.getElementById('authError').textContent = error.message; }
  }
  function saveSession(value) { session = value || null; try { if (session) localStorage.setItem(key, JSON.stringify(session)); else localStorage.removeItem(key); } catch (_) {} }
  let refreshing = null;
  async function refreshSession() { if (!session?.refresh_token) return false; if (!refreshing) refreshing = fetch(base + '/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refresh_token }) }).then(async response => { const body = await response.json().catch(() => ({})); if (!response.ok || !body.session) return false; saveSession(body.session); return true; }).catch(() => false).finally(() => { refreshing = null; }); return refreshing; }
  async function request(path, options = {}, retried = false) { const headers = { ...(options.headers || {}) }; if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'; if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token; const owner = session?.user?.id; const signal = options.signal || (AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined); const response = await fetch(base + path, { ...options, headers, signal }); if (owner !== session?.user?.id) throw new Error('账号已切换，请重试'); if (response.status === 401 && session && !retried && await refreshSession()) return request(path, options, true); const body = response.status === 204 ? null : await response.json().catch(() => ({})); if (response.status === 401 && session) { saveSession(null); render(); window.dispatchEvent(new Event('tw-auth-change')); } if (!response.ok) throw new Error(body?.error || '请求失败'); return body; }
  function getDialog() { let node = document.getElementById('authDialog'); if (!node) { node = document.createElement('dialog'); node.id = 'authDialog'; node.style.cssText = 'border:0;border-radius:12px;padding:20px;width:min(390px,calc(100% - 32px));box-shadow:0 20px 60px #173f4f33'; document.body.appendChild(node); } return node; }
  function show(mode = 'login') {
    const node = getDialog(), registering = mode === 'register';
    if (!document.getElementById('tw-auth-style')) { const style = document.createElement('style'); style.id = 'tw-auth-style'; style.textContent = '.tw-auth-social{display:grid;gap:9px;margin:4px 0 16px}.tw-oauth-btn{width:100%;min-height:46px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid #d5d8d2;border-radius:8px;background:#fff;color:#24343a;font:inherit;font-size:14px;font-weight:600;cursor:pointer}.tw-oauth-btn:hover{background:#f7f7f4}.tw-oauth-btn:disabled{opacity:.58;cursor:wait}.tw-oauth-icon{width:24px;font-weight:800;font-size:17px}.tw-oauth-icon.google{font-family:Arial,sans-serif;color:#4285f4}.tw-oauth-icon.qq{font-size:12px;color:#fff;background:#3296e0;border-radius:12px;padding:3px}.tw-auth-divider{display:flex;align-items:center;gap:12px;margin:14px 0;color:#8a928e;font-size:11px;letter-spacing:1px}.tw-auth-divider:before,.tw-auth-divider:after{content:"";height:1px;background:#e4e2da;flex:1}#authDialog .tw-auth-email{display:grid;gap:5px}#authDialog .tw-auth-email .input{margin:2px 0 8px}#authDialog .tw-auth-error{min-height:20px}'; document.head.appendChild(style); }
    node.innerHTML = '<form id="authForm"><div class="head" style="margin:0 0 16px"><h2>' + (registering ? '注册 Travel World' : '登录 Travel World') + '</h2><button type="button" class="post-map" id="authClose">关闭</button></div><div class="tw-auth-social"><button type="button" class="tw-oauth-btn" id="googleAuth"><span class="tw-oauth-icon google" aria-hidden="true">G</span><span data-provider-label>使用 Google 继续</span></button><button type="button" class="tw-oauth-btn" id="qqAuth"><span class="tw-oauth-icon qq" aria-hidden="true">QQ</span><span data-provider-label>使用 QQ 继续</span></button></div><div class="tw-auth-divider">或</div><div class="tw-auth-email">' + (registering ? '<input class="input" name="displayName" placeholder="昵称" required>' : '') + '<input class="input" name="email" type="email" placeholder="邮箱" required><input class="input" name="password" type="password" minlength="8" placeholder="密码（至少 8 位）" required></div><button class="btn" type="submit">' + (registering ? '创建账号' : '登录') + '</button> <button class="btn alt" type="button" id="authSwitch">' + (registering ? '已有账号' : '注册账号') + '</button><div id="authError" class="muted tw-auth-error" style="margin-top:10px" role="status" aria-live="polite"></div></form>';
    node.showModal(); node.querySelector('#authClose').onclick = () => node.close(); node.querySelector('#authSwitch').onclick = () => show(registering ? 'login' : 'register');
    node.querySelector('#googleAuth').onclick = event => startGoogle(event.currentTarget); node.querySelector('#qqAuth').onclick = event => startQQ(event.currentTarget);
    node.querySelector('#authForm').onsubmit = async event => { event.preventDefault(); const form=event.currentTarget, submit=form.querySelector('[type="submit"]'), output = node.querySelector('#authError'); submit.disabled=true; output.textContent = phrase('正在连接…', 'Connecting…'); try { const result = await request('/api/auth/' + mode, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); if (!result.session) { output.textContent = phrase('注册成功！请打开邮箱，点击验证链接完成邮箱验证，再返回登录。', 'Account created. Check your email and follow the verification link, then return to sign in.'); toast(phrase('邮箱验证邮件已发送', 'Verification email sent')); return; } saveSession(result.session); node.close(); render(); window.dispatchEvent(new Event('tw-auth-change')); toast(phrase('登录成功', 'Signed in')); } catch (error) { output.textContent = error.name === 'TimeoutError' ? phrase('网络连接较慢，请重试', 'Network is slow. Please try again.') : error.message; } finally { submit.disabled=false; } };
  }
  async function logout() { const hadGoogle = session?.user?.app_metadata?.provider === 'google' || session?.user?.identities?.some(identity => identity.provider === 'google'); let failed = false; try { if (session) await request('/api/auth/logout', { method: 'POST' }); } catch (_) { failed = true; } const cleanup = oauthClientPromise || (hadGoogle ? oauthClient() : null); if (cleanup) cleanup.then(client => client.auth.signOut({ scope: 'local' })).catch(() => {}); saveSession(null); render(); window.dispatchEvent(new Event('tw-auth-change')); toast(failed ? phrase('已退出此设备；服务端退出未确认', 'Signed out on this device; server sign-out was not confirmed') : phrase('退出成功', 'Signed out')); }
  function render() { const top = document.querySelector('.community-top'); if (!top) return; let button = document.getElementById('authEntry'); if (session) { button?.remove(); return; } if (!button) { button = document.createElement('button'); button.id = 'authEntry'; button.className = 'post-map'; top.insertBefore(button, top.lastElementChild); } button.textContent = phrase('登录', 'Sign in'); button.onclick = () => show('login'); }
  window.TravelWorldAuth = { request, session: () => session, requireLogin: () => session ? true : (show('login'), false), showLogin: () => show('login'), logout, toast }; render();
  async function finishOAuthCallback() {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    const oauth = query.get('oauth'), oauthError = query.get('oauth_error') || query.get('error_description') || query.get('error') || hash.get('error_description');
    if (oauth || oauthError) {
      cleanOAuthUrl();
      if (oauth === 'qq-linked') { restoreReturnScreen(); toast(phrase('QQ 账号绑定成功', 'QQ account linked')); window.dispatchEvent(new Event('tw-auth-change')); }
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
