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
  const post = await api('/api/community/posts', a, { method: 'POST', body: JSON.stringify({ title: '测试旅行内容', content: '真实数据链路测试', location_name: '杭州, 中国', city: '杭州', country: '中国', type: 'photo' }) });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'); const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
  const media = await api(`/api/community/posts/${post.id}/media`, a, { method: 'POST', body: form }); storagePaths.push(media.storage_path);
  await api(`/api/community/posts/${post.id}/like`, b, { method: 'POST' }); await api(`/api/community/posts/${post.id}/comments`, b, { method: 'POST', body: JSON.stringify({ content: '测试评论' }) }); await api(`/api/community/posts/${post.id}/favorite`, b, { method: 'POST' }); await api(`/api/community/users/${created[0]}/follow`, b, { method: 'POST' });
  const stats = await api('/api/users/me/stats', a); if (stats.posts !== 1 || stats.followers !== 1 || stats.likes !== 1) throw new Error('个人统计不正确');
  const trip = await api('/api/trips', a, { method: 'POST', body: JSON.stringify({ title: '杭州测试旅行', destination: '杭州', startDate: '2026-10-03', endDate: '2026-10-05', description: '测试同行流程' }) });
  const application = await api(`/api/trips/${trip.id}/applications`, b, { method: 'POST', body: JSON.stringify({ message: '希望一起旅行' }) });
  const accepted = await api(`/api/buddy/applications/${application.id}`, a, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) });
  if (!accepted.chatId) throw new Error('同行申请通过后未创建聊天室');
  await api(`/api/chats/${accepted.chatId}/messages`, b, { method: 'POST', body: JSON.stringify({ content: '集合地点见' }) });
  const messages = await api(`/api/chats/${accepted.chatId}/messages`, a); if (!messages.some(item => item.content === '集合地点见')) throw new Error('聊天消息未持久化');
  const feed = await api('/api/community/feed'); if (!feed.some(item => item.id === post.id)) throw new Error('帖子未进入公共信息流');
  const notifications = await api('/api/notifications', a); if (notifications.length < 3) throw new Error('互动通知未生成');
  console.log(JSON.stringify({ ok: true, checks: ['auth', 'profile', 'avatar', 'stats', 'post', 'media', 'like', 'comment', 'favorite', 'follow', 'trip', 'application', 'relation', 'chat', 'notifications'] }));
} finally {
  if (storagePaths.length) await admin.storage.from('media').remove(storagePaths);
  for (const id of created) await admin.auth.admin.deleteUser(id);
}
