const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function installDirectChat(app, admin, requireUser) {
  app.use('/api/dm', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const route = handler => [requireUser, async (req, res) => {
    try { await handler(req, res); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : '聊天服务暂时不可用，请重试' }); }
  }];
  function bad(message, status = 400) { throw Object.assign(new Error(message), { status }); }
  function id(value) { if (!uuid.test(value || '')) bad('无效的用户或会话'); return value; }
  async function action(req, name, args = {}) {
    const { data, error } = await admin.rpc('tw_dm_action', { p_actor: req.user.id, p_action: name, ...args });
    if (error) {
      if (error.code === '42501') bad('你不是该会话成员', 403);
      if (error.code === 'P0001') bad(error.message);
      throw error;
    }
    return data;
  }
  app.get('/api/dm/users/:id', ...route(async (req, res) => {
    const { data, error } = await admin.from('profiles').select('id,display_name,username,avatar_url,bio').eq('id', id(req.params.id)).maybeSingle();
    if (error) throw error;
    if (!data) bad('用户不存在', 404);
    res.json(data);
  }));
  app.get('/api/dm', ...route(async (req, res) => res.json(await action(req, 'list'))));
  app.post('/api/dm/users/:id', ...route(async (req, res) => res.json(await action(req, 'open', { p_peer: id(req.params.id) }))));
  app.get('/api/dm/:id/messages', ...route(async (req, res) => {
    const { data: chat, error } = await admin.from('dm_conversations').select('*').eq('id', id(req.params.id)).maybeSingle();
    if (error) throw error;
    if (!chat || ![chat.user_a, chat.user_b].includes(req.user.id)) bad('你不是该会话成员', 403);
    const cleared = chat.user_a === req.user.id ? chat.clear_a : chat.clear_b;
    let query = admin.from('dm_messages').select('*').eq('chat_id', chat.id).gt('seq', cleared).order('seq', { ascending: false }).limit(100);
    if (req.query.before) {
      const before = Number(req.query.before);
      if (!Number.isSafeInteger(before) || before < 1) bad('无效的消息位置');
      query = query.lt('seq', before);
    }
    const { data, error: messageError } = await query;
    if (messageError) throw messageError;
    res.json({ messages: data.reverse(), hasMore: data.length === 100, peerRead: chat.user_a === req.user.id ? chat.read_b : chat.read_a });
  }));
  app.post('/api/dm/:id/messages', ...route(async (req, res) => {
    if (typeof req.body?.content !== 'string' || !req.body.content.trim() || req.body.content.trim().length > 4000) bad('消息需为 1 至 4000 字');
    res.status(201).json(await action(req, 'send', { p_chat: id(req.params.id), p_content: req.body.content, p_client: id(req.body.clientId) }));
  }));
  app.patch('/api/dm/:id/read', ...route(async (req, res) => {
    if (!Number.isSafeInteger(req.body?.through) || req.body.through < 0) bad('无效的已读位置');
    res.json(await action(req, 'read', { p_chat: id(req.params.id), p_through: req.body.through }));
  }));
  app.delete('/api/dm/:id', ...route(async (req, res) => res.json(await action(req, 'delete', { p_chat: id(req.params.id) }))));
}
