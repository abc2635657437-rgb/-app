import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const base = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 8787}`;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const users = [
  { email: `tw-smoke-a-${stamp}@example.com`, password: `Tw!${stamp}aA`, name: 'Smoke A' },
  { email: `tw-smoke-b-${stamp}@example.com`, password: `Tw!${stamp}bB`, name: 'Smoke B' }
];
const created = [], storagePaths = [];
async function api(path, token, options = {}) {
  const headers = { ...(options.headers || {}) }; if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'; if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + path, { ...options, headers }); const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${body?.error || ''}`); return body;
}
try {
  for (const user of users) { const result = await admin.auth.admin.createUser({ email: user.email, password: user.password, email_confirm: true, user_metadata: { display_name: user.name } }); if (result.error) throw result.error; created.push(result.data.user.id); }
  const loginA = await api('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: users[0].email, password: users[0].password }) });
  const loginB = await api('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: users[1].email, password: users[1].password }) });
  const a = loginA.session.access_token, b = loginB.session.access_token;
  await api('/api/users/me', a, { method: 'PATCH', body: JSON.stringify({ display_name: '旅行测试 A', bio: '自动测试账号' }) });
  const avatarForm = new FormData(); avatarForm.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'avatar.png');
  const avatar = await api('/api/users/me/avatar', a, { method: 'POST', body: avatarForm }); storagePaths.push(avatar.storage_path);
  const clientRequestId = crypto.randomUUID();
  const postPayload = { title: '测试旅行内容', content: '真实数据链路测试', location_name: '杭州, 中国', city: '杭州', country: '中国', type: 'photo', clientRequestId };
  const post = await api('/api/community/posts', a, { method: 'POST', headers: { 'Idempotency-Key': clientRequestId }, body: JSON.stringify(postPayload) });
  const repeatedPost = await api('/api/community/posts', a, { method: 'POST', headers: { 'Idempotency-Key': clientRequestId }, body: JSON.stringify(postPayload) });
  if (repeatedPost.id !== post.id || !repeatedPost.idempotent) throw new Error('发布幂等保护失败');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'); const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
  const media = await api(`/api/community/posts/${post.id}/media`, a, { method: 'POST', body: form }); storagePaths.push(media.storage_path);
  await api(`/api/community/posts/${post.id}/like`, b, { method: 'POST' }); const comment = await api(`/api/community/posts/${post.id}/comments`, b, { method: 'POST', body: JSON.stringify({ content: '测试评论' }) }); await api(`/api/community/posts/${post.id}/favorite`, b, { method: 'POST' }); await api(`/api/community/users/${created[0]}/follow`, b, { method: 'POST' });
  await api(`/api/community/posts/${post.id}`, a, { method: 'PATCH', body: JSON.stringify({ title: '已编辑的旅行内容' }) });
  const stats = await api('/api/users/me/stats', a); if (stats.posts !== 1 || stats.followers !== 1 || stats.likes !== 1) throw new Error('个人统计不正确');
  const publicProfile = await api(`/api/community/users/${created[0]}`, b); if (publicProfile.profile?.id !== created[0] || publicProfile.posts?.[0]?.id !== post.id || !publicProfile.isFollowing) throw new Error('公开用户主页不正确');
  const [myPosts, favorites, following, followers, interactions] = await Promise.all([api('/api/community/me/posts', a), api('/api/community/favorites', b), api('/api/community/following', b), api('/api/community/followers', a), api('/api/community/interactions', a)]);
  if (myPosts[0]?.id !== post.id || favorites[0]?.id !== post.id || following[0]?.id !== created[0] || followers[0]?.id !== created[1]) throw new Error('个人社区列表不正确');
  if (!interactions.some(item => item.type === 'like') || !interactions.some(item => item.type === 'follow')) throw new Error('互动明细不正确');
  const trip = await api('/api/trips', a, { method: 'POST', body: JSON.stringify({ title: '杭州测试旅行', destination: '杭州', startDate: '2026-10-03', endDate: '2026-10-05', description: '测试同行流程' }) });
  await api(`/api/trips/${trip.id}`, a, { method: 'PATCH', body: JSON.stringify({ description: '已编辑的同行计划' }) });
  const application = await api(`/api/trips/${trip.id}/applications`, b, { method: 'POST', body: JSON.stringify({ message: '希望一起旅行' }) });
  const accepted = await api(`/api/buddy/applications/${application.id}`, a, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) });
  if (!accepted.chatId) throw new Error('同行申请通过后未创建聊天室');
  await api(`/api/chats/${accepted.chatId}/messages`, b, { method: 'POST', body: JSON.stringify({ content: '集合地点见' }) });
  const messages = await api(`/api/chats/${accepted.chatId}/messages`, a); if (!messages.some(item => item.content === '集合地点见')) throw new Error('聊天消息未持久化');
  const feed = await api('/api/community/feed'); if (!feed.some(item => item.id === post.id)) throw new Error('帖子未进入公共信息流');
  const notifications = await api('/api/notifications', a); if (notifications.length < 3) throw new Error('互动通知未生成');
  const settings = await api('/api/users/me/settings', a); if (!settings.notifications) throw new Error('设置读取失败');
  const savedSettings = await api('/api/users/me/settings', a, { method: 'PATCH', body: JSON.stringify({ general: { autoplayVideo: true, saveData: false } }) }); if (!savedSettings.general?.autoplayVideo) throw new Error('设置保存失败');
  const routeInsert = await admin.from('routes').insert({ owner_id: created[0], title: '公开测试路线', destination: '杭州', is_public: false }).select().single(); if (routeInsert.error) throw routeInsert.error;
  const routeId = routeInsert.data.id; await api(`/api/routes/${routeId}`, a, { method: 'PATCH', body: JSON.stringify({ is_public: true }) }); await api(`/api/routes/${routeId}/like`, b, { method: 'POST' }); await api(`/api/routes/${routeId}/favorite`, b, { method: 'POST' }); await api(`/api/routes/${routeId}/comments`, b, { method: 'POST', body: JSON.stringify({ content: '路线很好' }) });
  const publicRoutes = await api('/api/routes'); if (!publicRoutes.some(item => item.id === routeId && item.route_likes.length === 1 && item.route_comments.length === 1)) throw new Error('公开路线互动失败');
  await api(`/api/community/comments/${comment.id}`, a, { method: 'DELETE' });
  await api(`/api/users/me/blocked/${created[1]}`, a, { method: 'POST' }); const blocked = await api('/api/users/me/blocked', a); if (!blocked.some(item => item.id === created[1])) throw new Error('黑名单保存失败'); await api(`/api/users/me/blocked/${created[1]}`, a, { method: 'DELETE' });
  const routes = await api('/api/community/me/routes', a); if (!Array.isArray(routes)) throw new Error('路线列表不正确');
  console.log(JSON.stringify({ ok: true, checks: ['auth', 'profile', 'public-profile', 'avatar', 'stats', 'post', 'post-idempotency', 'post-edit', 'media', 'like', 'comment', 'comment-delete', 'favorite', 'follow', 'block', 'unblock', 'my-posts', 'favorites-list', 'following-list', 'followers-list', 'interactions', 'settings', 'routes-list', 'route-publish', 'route-like', 'route-comment', 'route-favorite', 'trip', 'trip-edit', 'application', 'relation', 'chat', 'notifications'] }));
} finally {
  if (storagePaths.length) await admin.storage.from('media').remove(storagePaths);
  for (const id of created) await admin.auth.admin.deleteUser(id);
}
