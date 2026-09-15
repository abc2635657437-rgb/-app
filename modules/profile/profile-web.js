(function () {
  let profile = null;
  let stats = { trips: 0, followers: 0, following: 0, likes: 0, posts: 0, favorites: 0 };
  const auth = () => window.TravelWorldAuth;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const state = () => JSON.parse(localStorage.getItem('tw-state') || '{}');
  const fallback = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#e8eee9"/><text x="50%" y="56%" text-anchor="middle" font-size="54" fill="#173f4f">TW</text></svg>');
  const setPage = html => { const section = document.getElementById('profile'); if (section) section.innerHTML = html; };

  function render() {
    const loggedIn = Boolean(auth()?.session?.());
    const name = profile?.display_name || profile?.username || (loggedIn ? '旅行者' : 'Travel World');
    const bio = profile?.bio || (loggedIn ? '在路上，也在分享路上的风景。' : '登录后建立你的旅行身份。');
    setPage('<div class="eyebrow">MY SPACE</div><div class="profile-hero"><img src="' + safe(profile?.avatar_url || fallback) + '" class="profile-large-avatar"><div><h1>' + safe(name) + '</h1><p>' + safe(bio) + '</p><button class="profile-text-action" onclick="' + (loggedIn ? 'editTravelProfile()' : 'TravelWorldAuth.showLogin()') + '">' + (loggedIn ? '编辑资料' : '登录 / 注册') + '</button></div></div>' +
      '<div class="profile-stats card"><button onclick="openProfilePanel(\'followers\')"><b>' + stats.followers + '</b><span>粉丝</span></button><button onclick="openProfilePanel(\'following\')"><b>' + stats.following + '</b><span>关注</span></button><button onclick="openProfilePanel(\'interactions\')"><b>' + stats.likes + '</b><span>获赞</span></button></div>' +
      '<div class="profile-links card"><button onclick="go(\'friends\')">我的旅行</button><button onclick="openProfilePanel(\'routes\')">我的路线</button><button onclick="openProfilePanel(\'favorites\')">我的收藏</button><button onclick="go(\'friends\')">我的同行</button><button onclick="go(\'friends\')">我的申请</button><button onclick="openProfilePanel(\'posts\')">我的发布</button><button onclick="openProfilePanel(\'following\')">关注</button><button onclick="openProfilePanel(\'followers\')">粉丝</button><button onclick="openProfilePanel(\'interactions\')">点赞评论</button></div>' +
      '<div class="profile-settings card"><h3>设置</h3><button onclick="editTravelProfile()">个人中心<span>›</span></button><button onclick="openSetting(\'account\')">账号与安全<span>›</span></button><button onclick="toggleProfileLanguage()">语言设置<span>' + (state().lang === 'en' ? 'English' : '简体中文') + ' ›</span></button><button onclick="openSetting(\'notifications\')">通知设置<span>›</span></button><button onclick="openSetting(\'privacy\')">隐私设置<span>›</span></button><button onclick="openSetting(\'messages\')">消息设置<span>›</span></button><button onclick="openSetting(\'content_preferences\')">内容偏好<span>›</span></button><button onclick="openSetting(\'blocked\')">黑名单<span>›</span></button><button onclick="openSetting(\'general\')">通用设置<span>›</span></button><button onclick="openSetting(\'about\')">关于我们<span>›</span></button><button onclick="openSetting(\'terms\')">用户协议<span>›</span></button><button onclick="openSetting(\'policy\')">隐私政策<span>›</span></button><button onclick="changeProfileCurrency()">默认货币<span>' + (state().currency || 'CNY') + ' ›</span></button><button onclick="clearProfileCache()">清除缓存<span>›</span></button>' + (loggedIn ? '<button class="danger" onclick="logoutProfile()">退出登录<span>›</span></button>' : '') + '</div>');
  }

  async function loadProfile() {
    if (!auth()?.session?.()) { profile = null; stats = { trips: 0, followers: 0, following: 0, likes: 0, posts: 0, favorites: 0 }; return render(); }
    try { [profile, stats] = await Promise.all([auth().request('/api/users/me'), auth().request('/api/users/me/stats')]); }
    catch (error) { if (auth()?.session?.()) alert('个人数据加载失败：' + error.message); }
    render();
  }

  const empty = text => '<div class="profile-empty">' + safe(text) + '</div>';
  const person = (item, action = '') => '<div class="profile-row"><img src="' + safe(item.avatar_url || fallback) + '"><div><b>' + safe(item.display_name || item.username || '旅行者') + '</b><small>' + safe(item.bio || '这位旅行者还没有填写简介') + '</small></div>' + action + '</div>';
  const post = (item, type) => '<div class="profile-item"><b>' + safe(item.title || '旅行分享') + '</b><p>' + safe(item.content || '') + '</p><small>' + safe(item.location_name || '未标注地点') + ' · ' + new Date(item.created_at).toLocaleDateString() + '</small><div class="profile-item-actions">' + (type === 'posts' ? '<button onclick="editProfilePost(\'' + item.id + '\',\'' + safe(item.title) + '\',\'' + safe(item.content) + '\')">编辑</button><button onclick="deleteProfilePost(\'' + item.id + '\')">删除</button>' : '<button onclick="removeProfileFavorite(\'' + item.id + '\')">取消收藏</button>') + '</div></div>';

  window.openProfilePanel = async type => {
    if (!auth().requireLogin()) return;
    const titles = { posts: '我的发布', favorites: '我的收藏', following: '我的关注', followers: '我的粉丝', interactions: '点赞与评论', routes: '我的路线' };
    const head = '<div class="profile-detail-head"><button onclick="loadTravelProfile()" aria-label="返回">‹</button><h2>' + titles[type] + '</h2></div>';
    setPage(head + empty('正在加载…'));
    try {
      const paths = { posts: '/api/community/me/posts', favorites: '/api/community/favorites', following: '/api/community/following', followers: '/api/community/followers', interactions: '/api/community/interactions', routes: '/api/community/me/routes' };
      let items = await auth().request(paths[type]);
      let favoriteRoutes = [];
      if (type === 'favorites') favoriteRoutes = await auth().request('/api/routes/favorite-items');
      let body = '';
      if (type === 'posts') body = items.map(item => post(item, type)).join('');
      if (type === 'favorites') body = items.map(item => post(item, type)).join('') + favoriteRoutes.map(item => '<div class="profile-item"><b>路线 · ' + safe(item.title) + '</b><p>' + safe(item.destination) + '</p><small>' + (item.trip_days?.length || 0) + ' 天行程</small><div class="profile-item-actions"><button onclick="removeProfileRouteFavorite(\'' + item.id + '\')">取消收藏</button></div></div>').join('');
      if (type === 'following') body = items.map(item => person(item, '<div class="profile-row-actions"><button onclick="toggleProfileFollow(\'' + item.id + '\',\'following\')">取消关注</button><button onclick="blockProfile(\'' + item.id + '\')">屏蔽</button></div>')).join('');
      if (type === 'followers') body = items.map(item => person(item, '<div class="profile-row-actions"><button onclick="toggleProfileFollow(\'' + item.id + '\',\'followers\')">关注</button><button onclick="blockProfile(\'' + item.id + '\')">屏蔽</button></div>')).join('');
      if (type === 'routes') body = items.map(item => '<div class="profile-item"><b>' + safe(item.title) + '</b><p>' + safe(item.destination) + '</p><small>' + (item.trip_days?.length || 0) + ' 天行程 · ' + (item.is_public ? '已发布' : '仅自己可见') + '</small><div class="profile-item-actions"><button onclick="editProfileRoute(\'' + item.id + '\',\'' + safe(item.title) + '\',\'' + safe(item.destination) + '\')">编辑</button><button onclick="publishProfileRoute(\'' + item.id + '\',' + (!item.is_public) + ')">' + (item.is_public ? '取消发布' : '发布路线') + '</button><button onclick="deleteProfileRoute(\'' + item.id + '\')">删除</button></div></div>').join('');
      if (type === 'interactions') body = items.map(item => person(item.actor || {}, '<small class="profile-event-time">' + new Date(item.created_at).toLocaleDateString() + '</small>') + '<div class="profile-event">' + safe(item.message || '与你互动') + (item.post?.title ? ' · ' + safe(item.post.title) : '') + '</div>').join('');
      setPage(head + '<div class="profile-detail-list">' + (body || empty('暂时没有相关数据')) + '</div>');
    } catch (error) { setPage(head + empty('加载失败：' + error.message)); }
  };

  window.toggleProfileFollow = async (userId, panel) => { try { await auth().request('/api/community/users/' + userId + '/follow', { method: 'POST' }); await loadProfile(); await openProfilePanel(panel); } catch (error) { alert(error.message); } };
  window.blockProfile = async userId => { if (!confirm('屏蔽该用户并解除双方关注关系？')) return; try { await auth().request('/api/users/me/blocked/' + userId, { method: 'POST' }); await loadProfile(); alert('已加入黑名单'); } catch (error) { alert(error.message); } };
  window.editProfilePost = async (id, oldTitle, oldContent) => { const title = prompt('标题', oldTitle); if (title === null) return; const content = prompt('正文', oldContent); if (content === null) return; try { await auth().request('/api/community/posts/' + id, { method: 'PATCH', body: JSON.stringify({ title: title.trim(), content: content.trim() }) }); await openProfilePanel('posts'); window.dispatchEvent(new Event('tw-auth-change')); } catch (error) { alert(error.message); } };
  window.deleteProfilePost = async id => { if (!confirm('删除这篇发布？删除后无法恢复。')) return; try { await auth().request('/api/community/posts/' + id, { method: 'DELETE' }); await loadProfile(); await openProfilePanel('posts'); window.dispatchEvent(new Event('tw-auth-change')); } catch (error) { alert(error.message); } };
  window.removeProfileFavorite = async id => { try { await auth().request('/api/community/posts/' + id + '/favorite', { method: 'POST' }); await loadProfile(); await openProfilePanel('favorites'); } catch (error) { alert(error.message); } };
  window.removeProfileRouteFavorite = async id => { try { await auth().request('/api/routes/' + id + '/favorite', { method: 'POST' }); await openProfilePanel('favorites'); } catch (error) { alert(error.message); } };
  window.editProfileRoute = async (id, oldTitle, oldDestination) => { const title = prompt('路线名称', oldTitle); if (title === null) return; const destination = prompt('目的地', oldDestination); if (destination === null) return; try { await auth().request('/api/routes/' + id, { method: 'PATCH', body: JSON.stringify({ title: title.trim(), destination: destination.trim() }) }); await openProfilePanel('routes'); } catch (error) { alert(error.message); } };
  window.publishProfileRoute = async (id, isPublic) => { try { await auth().request('/api/routes/' + id, { method: 'PATCH', body: JSON.stringify({ is_public: isPublic }) }); await openProfilePanel('routes'); } catch (error) { alert(error.message); } };
  window.deleteProfileRoute = async id => { if (!confirm('删除这条路线？')) return; try { await auth().request('/api/routes/' + id, { method: 'DELETE' }); await openProfilePanel('routes'); } catch (error) { alert(error.message); } };
  const settingLabels = {
    notifications: { likes: '新点赞', comments: '新评论', follows: '新关注', buddy: '同行申请与状态', chat: '同行新消息' },
    privacy: { publicProfile: '公开个人主页', showTrips: '展示旅行记录', allowFollow: '允许其他用户关注' },
    messages: { buddyMessages: '接收同行消息', communityMessages: '接收社区互动消息' },
    content_preferences: { domestic: '国内旅行', international: '海外旅行', photography: '摄影路线' },
    general: { autoplayVideo: '自动播放视频', saveData: '节省流量模式' }
  };
  const settingTitles = { notifications: '通知设置', privacy: '隐私设置', messages: '消息设置', content_preferences: '内容偏好', general: '通用设置' };
  window.openSetting = async type => {
    if (!auth().requireLogin()) return;
    const head = title => '<div class="profile-detail-head"><button onclick="loadTravelProfile()" aria-label="返回">‹</button><h2>' + title + '</h2></div>';
    if (type === 'account') return setPage(head('账号与安全') + '<div class="profile-item"><b>' + safe(auth().session()?.user?.email || '') + '</b><p>当前登录邮箱</p><button class="btn" onclick="changeProfilePassword()">修改密码</button></div>');
    if (type === 'about') return setPage(head('关于我们') + '<div class="profile-document"><h3>Travel World · 同路人</h3><p>连接旅行分享、目的地发现、路线规划、在线地图和同行交流。</p><p>当前版本：1.0</p></div>');
    if (type === 'terms') return setPage(head('用户协议') + '<div class="profile-document"><p>用户应发布真实、合法且有权分享的内容，不得骚扰他人、冒用身份或发布违法信息。旅行计划仅供参考，用户应自行核对签证、天气、交通和安全信息。</p><p>使用发布、互动和同行功能即表示同意遵守社区规范。</p></div>');
    if (type === 'policy') return setPage(head('隐私政策') + '<div class="profile-document"><p>Travel World 仅为账号、社区互动、旅行路线和同行功能处理必要数据。密码由认证服务安全处理，敏感密钥不会发送到浏览器。</p><p>定位仅在用户授权后用于地图展示；用户可以退出登录并清除本地缓存。</p></div>');
    if (type === 'blocked') {
      setPage(head('黑名单') + empty('正在加载…'));
      try { const items = await auth().request('/api/users/me/blocked'); setPage(head('黑名单') + (items.map(item => person(item, '<button onclick="unblockProfile(\'' + item.id + '\')">移出</button>')).join('') || empty('黑名单为空'))); }
      catch (error) { setPage(head('黑名单') + empty('加载失败：' + error.message)); }
      return;
    }
    setPage(head(settingTitles[type]) + empty('正在加载…'));
    try { const settings = await auth().request('/api/users/me/settings'), values = settings[type] || {}; const controls = Object.entries(settingLabels[type]).map(([key, label]) => '<label class="profile-toggle"><span>' + label + '</span><input type="checkbox" data-setting="' + key + '" ' + (values[key] ? 'checked' : '') + '></label>').join(''); setPage(head(settingTitles[type]) + '<div class="profile-setting-form" data-setting-group="' + type + '">' + controls + '<button class="btn" onclick="saveProfileSettings(\'' + type + '\')">保存设置</button></div>'); }
    catch (error) { setPage(head(settingTitles[type]) + empty('加载失败：' + error.message)); }
  };
  window.saveProfileSettings = async type => { const root = document.querySelector('[data-setting-group="' + type + '"]'); const value = {}; root?.querySelectorAll('[data-setting]').forEach(input => { value[input.dataset.setting] = input.checked; }); try { await auth().request('/api/users/me/settings', { method: 'PATCH', body: JSON.stringify({ [type]: value }) }); alert('设置已保存'); } catch (error) { alert('保存失败：' + error.message); } };
  window.changeProfilePassword = async () => { const password = prompt('请输入至少 8 位的新密码'); if (!password) return; try { await auth().request('/api/users/me/password', { method: 'PUT', body: JSON.stringify({ password }) }); alert('密码已更新，请妥善保存。'); } catch (error) { alert(error.message); } };
  window.unblockProfile = async userId => { try { await auth().request('/api/users/me/blocked/' + userId, { method: 'DELETE' }); await openSetting('blocked'); } catch (error) { alert(error.message); } };
  window.editTravelProfile = async () => { if (!auth().requireLogin()) return; const name = prompt('昵称', profile?.display_name || ''); if (name === null) return; const bio = prompt('个人简介', profile?.bio || ''); if (bio === null) return; try { profile = await auth().request('/api/users/me', { method: 'PATCH', body: JSON.stringify({ display_name: name.trim(), bio: bio.trim() }) }); const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/*'; picker.onchange = async () => { if (!picker.files[0]) return loadProfile(); const form = new FormData(); form.append('file', picker.files[0]); profile = await auth().request('/api/users/me/avatar', { method: 'POST', body: form }); render(); }; if (confirm('资料已保存。现在更换头像吗？')) picker.click(); else render(); } catch (error) { alert(error.message); } };
  window.changeProfileCurrency = () => { const next = prompt('输入货币代码：CNY / USD / EUR / JPY', 'CNY'); if (!next || !['CNY', 'USD', 'EUR', 'JPY'].includes(next.toUpperCase())) return; const value = state(); value.currency = next.toUpperCase(); localStorage.setItem('tw-state', JSON.stringify(value)); render(); };
  window.toggleProfileLanguage = async () => { const value = state(); value.lang = value.lang === 'en' ? 'zh' : 'en'; localStorage.setItem('tw-state', JSON.stringify(value)); try { if (auth()?.session?.()) await auth().request('/api/users/me/settings', { method: 'PATCH', body: JSON.stringify({ language: value.lang }) }); } catch (error) { alert('语言设置同步失败：' + error.message); } render(); };
  window.clearProfileCache = () => { ['tw-community-home', 'tw-buddy-state', 'tw-ai-context', 'tw-map-cache-v2', 'tw-plan'].forEach(key => localStorage.removeItem(key)); alert('本地缓存已清除'); render(); };
  window.logoutProfile = async () => { await auth()?.logout?.(); profile = null; render(); };
  window.loadTravelProfile = loadProfile;

  const style = document.createElement('style');
  style.textContent = '.profile-hero{display:flex;gap:16px;align-items:center;padding:8px 0 20px}.profile-large-avatar{width:78px;height:78px;border-radius:50%;object-fit:cover}.profile-hero h1{margin:0;color:#173f4f;font-size:26px}.profile-hero p{margin:6px 0;color:#718087;font-size:13px}.profile-text-action{border:0;background:transparent;color:#d17d57;padding:0}.profile-stats{display:flex;justify-content:space-around;text-align:center}.profile-stats button{border:0;background:transparent;display:flex;flex-direction:column;gap:5px}.profile-stats b{font-size:22px;color:#173f4f}.profile-stats span,.profile-row small{font-size:12px;color:#718087}.profile-links{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}.profile-links button{min-height:52px;border:1px solid #e3e9e5;border-radius:6px;background:#fff;color:#173f4f;font:inherit;padding:8px 4px}.profile-settings h3{margin:0 0 8px;color:#173f4f}.profile-settings button{width:100%;display:flex;justify-content:space-between;border:0;border-top:1px solid #edf0ec;background:transparent;text-align:left;color:#53656b;padding:14px 4px;font:inherit;font-size:14px}.profile-settings button span{color:#9aa5a5}.profile-settings .danger{color:#ba6449}.profile-detail-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}.profile-detail-head button{width:38px;height:38px;border:1px solid #dfe6e1;border-radius:50%;background:#fff;color:#173f4f;font-size:28px}.profile-detail-head h2{margin:0;color:#173f4f;font-size:22px}.profile-detail-list{display:grid;gap:10px}.profile-item,.profile-row{border-bottom:1px solid #e6ebe7;padding:13px 2px}.profile-item b,.profile-row b{color:#173f4f}.profile-item p{margin:7px 0;color:#53656b}.profile-item small{color:#899595}.profile-item-actions{display:flex;gap:8px;margin-top:10px}.profile-item-actions button{border:1px solid #dfe6e1;border-radius:14px;background:#fff;color:#53656b;padding:5px 9px}.profile-row{display:grid;grid-template-columns:46px 1fr auto;gap:10px;align-items:center}.profile-row img{width:46px;height:46px;border-radius:50%;object-fit:cover}.profile-row div{display:flex;flex-direction:column;gap:3px}.profile-row-actions{display:flex!important;flex-direction:row!important;gap:5px!important}.profile-row-actions button{border:1px solid #d17d57;border-radius:16px;background:#fff;color:#ba6449;padding:5px 8px}.profile-empty{padding:44px 10px;text-align:center;color:#899595}.profile-event{margin:-6px 0 10px 56px;color:#53656b;font-size:13px}.profile-event-time{white-space:nowrap}.profile-setting-form{display:grid;gap:0}.profile-toggle{display:flex;justify-content:space-between;align-items:center;padding:15px 2px;border-bottom:1px solid #e6ebe7;color:#53656b}.profile-toggle input{width:20px;height:20px;accent-color:#d17d57}.profile-setting-form .btn{margin-top:18px}.profile-document{color:#53656b;line-height:1.75}.profile-document h3{color:#173f4f}@media(max-width:360px){.profile-links{grid-template-columns:repeat(2,1fr)}.profile-row{grid-template-columns:40px 1fr}.profile-row-actions{grid-column:2}}';
  document.head.appendChild(style);
  window.addEventListener('tw-auth-change', loadProfile); window.addEventListener('DOMContentLoaded', loadProfile); if (document.readyState !== 'loading') loadProfile();
}());
