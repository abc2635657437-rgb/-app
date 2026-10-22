(function () {
  const auth = () => window.TravelWorldAuth;
  const safe = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const qualityRules = import('./post-quality.js');
  let posts = [], selectedFiles = [], selectedRoute = null, favoriteIds = new Set(), followingIds = new Set(), currentFeed = 'recommend', publishing = false, publishRequestId = '';
  const pendingLikes = new Set(), pendingFavorites = new Set(), pendingComments = new Set(), pendingCommentDeletes = new Set();
  function render() {
    const target = document.getElementById('communityFeed'); if (!target) return;
    target.classList.add('home-feed-masonry'); target.classList.toggle('has-posts', posts.length > 0);
    target.innerHTML = posts.length ? posts.map(post => TravelPostUI.card(post,{favoriteIds,followingIds,showFollow:true,homeFeed:true,pendingLike:pendingLikes.has(String(post.id))})).join('') : '<div class="feed-state" role="status"><b>这里留给真实的旅途分享</b><p>目前还没有符合发布标准的内容。你可以先发现目的地，或分享一段带照片、地点和正文的旅行经历。</p><button type="button" class="btn alt small" onclick="go(\'map\');loadMap()">先去发现目的地</button></div>';
  }
  function postRecords(id) {
    return [...new Set([...posts.filter(post => String(post.id) === String(id)), window.TravelPostUI?.get?.(id), window.TravelPostUI?.getActiveDetail?.(id)].filter(Boolean))];
  }
  function refreshPost(id, options) { window.TravelPostUI?.refreshDetail?.(id, options); }
  function setLike(post, userId, liked, count) {
    const rows = post.post_likes || [], rest = rows.filter(item => item.user_id !== userId);
    post.post_likes = liked ? [{ user_id: userId }, ...rest] : rest;
    const previousCount = post.like_count != null ? Number(post.like_count) : rows.length;
    post.like_count = Number.isFinite(Number(count)) ? Number(count) : Math.max(0, previousCount + (liked ? 1 : -1));
  }
  window.getCommunityFavoriteIds = () => new Set(favoriteIds);
  window.isCommunityLikePending = id => pendingLikes.has(String(id));
  window.isCommunityFavoritePending = id => pendingFavorites.has(String(id));
  window.isCommunityCommentPending = id => pendingComments.has(String(id));
  async function load() {
    const target = document.getElementById('communityFeed');
    if (target) { target.classList.add('home-feed-masonry'); target.classList.remove('has-posts'); target.innerHTML = '<div class="feed-state" role="status">正在载入旅行分享…</div>'; }
    try {
      const [items, quality] = await Promise.all([auth().request(currentFeed === 'following' ? '/api/community/feed/following' : '/api/community/feed'), qualityRules]);
      posts = quality.cleanPublicPosts(items, 30); favoriteIds = new Set(); followingIds = new Set();
      if (auth().session?.()) { const [favorites, following] = await Promise.all([auth().request('/api/community/favorites'), auth().request('/api/community/following')]); favoriteIds = new Set(favorites.map(post => post.id)); followingIds = new Set(following.map(user => user.id)); }
      render();
    } catch (_) {
      if (target) target.innerHTML = '<div class="feed-state" role="status"><b>旅行分享暂时无法载入</b><p>网络恢复后可以重试；你的收藏和行程不受影响。</p><button type="button" class="btn alt small" onclick="reloadCommunityFeed()">重试</button></div>';
    }
  }
  window.reloadCommunityFeed = load;
  window.setFeed = async feed => { if (feed === 'following' && !auth().requireLogin()) return; currentFeed = feed; document.getElementById('recommendTab')?.classList.toggle('active', feed === 'recommend'); document.getElementById('followingTab')?.classList.toggle('active', feed === 'following'); await load(); };
  window.openPublisher = async () => { if (!auth().requireLogin()) return; go('publish'); renderMediaList(); await loadPublishRoutes(); };
  window.toggleComposer = window.openPublisher;
  async function loadPublishRoutes(){const root=document.getElementById('publishRouteChoices');if(!root)return;root.innerHTML='<span class="muted">正在加载我的路线…</span>';try{const routes=await auth().request('/api/community/me/routes');root.innerHTML='<button class="publish-route-add" onclick="openRouteEditor(null,{returnToPublisher:true})">＋ 新建路线</button>'+routes.map(route=>'<button class="publish-route-choice '+(selectedRoute?.id===route.id?'active':'')+'" onclick="selectPublishRouteById(\''+route.id+'\')" data-route="'+route.id+'"><b>'+safe(route.title)+'</b><small>'+safe(route.destination||'旅行路线')+'</small></button>').join('');root._routes=routes;}catch(error){root.innerHTML='<button class="publish-route-add" onclick="openRouteEditor(null,{returnToPublisher:true})">＋ 新建路线</button><span class="muted">路线加载失败</span>';}}
  window.selectPublishRouteById=id=>{const root=document.getElementById('publishRouteChoices');window.selectPublishRoute(root?._routes?.find(route=>route.id===id));};
  window.selectPublishRoute=route=>{selectedRoute=route||null;const root=document.getElementById('selectedPublishRoute');if(root)root.innerHTML=selectedRoute?TravelPostUI.routeCard(selectedRoute)+'<button class="publish-route-clear" onclick="selectPublishRoute(null)">移除路线</button>':'';document.querySelectorAll('.publish-route-choice').forEach(button=>button.classList.toggle('active',button.dataset.route===selectedRoute?.id));};
  function renderMediaList() { const target = document.getElementById('composeMediaList'); const hint = document.getElementById('composeMediaHint'); if (!target || !hint) return; hint.textContent = selectedFiles.length ? '已选择 ' + selectedFiles.length + ' 个文件，可继续添加或删除' : '可选择照片、视频或实况照片'; target.innerHTML = selectedFiles.map((file, index) => '<div class="compose-preview">'+(file.type.startsWith('video/')?'<video src="'+URL.createObjectURL(file)+'"></video>':'<img src="'+URL.createObjectURL(file)+'" alt="">')+'<button type="button" onclick="removeCommunityMedia(' + index + ')">×</button><small>'+safe(file.name)+'</small></div>').join(''); }
  window.selectCommunityMedia = event => { selectedFiles = selectedFiles.concat(Array.from(event.target.files || [])).slice(0, 8); event.target.value = ''; renderMediaList(); };
  window.removeCommunityMedia = index => { selectedFiles.splice(index, 1); renderMediaList(); };
  window.publishPost = async () => {
    if (publishing||!auth().requireLogin()) return;
    const title = document.getElementById('composeTitle').value.trim(), content = document.getElementById('composeText').value.trim(), location_name = document.getElementById('composeLocation').value.trim(), button = document.getElementById('publishPostButton');
    const quality = await qualityRules, issues = quality.draftIssues({ title, content, location_name, city: location_name.split(',')[0], files: selectedFiles, posts });
    if (issues.length) return auth().toast?.(issues[0]);
    publishing=true;publishRequestId||=crypto.randomUUID();button.disabled = true; button.setAttribute('aria-busy','true');button.textContent = '正在发布…';
    try {
      const type = selectedFiles.some(file => file.type.startsWith('video/')) ? 'video' : 'photo';
      const post = await auth().request('/api/community/posts', { method: 'POST',headers:{'Idempotency-Key':publishRequestId}, body: JSON.stringify({ title, content, location_name, city: location_name.split(',')[0], type,route_id:selectedRoute?.id||null,clientRequestId:publishRequestId }) });
      for (let index = 0; index < selectedFiles.length; index += 1) { button.textContent = '正在上传 ' + (index + 1) + '/' + selectedFiles.length + '…'; const form = new FormData(); form.append('file', selectedFiles[index]);form.append('sort_order',String(index)); await auth().request('/api/community/posts/' + post.id + '/media', { method: 'POST', body: form }); }
      ['composeTitle','composeText','composeLocation'].forEach(id => document.getElementById(id).value = ''); selectedFiles = [];selectedRoute=null;publishRequestId=''; renderMediaList();window.selectPublishRoute(null); await load();go('home'); auth().toast?.('发布成功');
    } catch (e) { auth().toast?.('发布失败：' + e.message); }
    finally { publishing=false;button.disabled = false;button.removeAttribute('aria-busy'); button.textContent = '发布'; }
  };
  async function setPostLiked(id, desired) {
    if (pendingLikes.has(String(id)) || !auth().requireLogin()) return;
    const uid = auth().session()?.user?.id, records = postRecords(id), post = records[0];
    if (!uid || !post) return;
    const currentlyLiked = (post.post_likes || []).some(item => String(item.user_id) === String(uid));
    if (currentlyLiked === desired) return;
    const snapshots = records.map(record => ({ record, likes: record.post_likes || [], count: record.like_count }));
    pendingLikes.add(String(id));
    records.forEach(record => setLike(record, uid, desired));
    render(); refreshPost(id, { focusAction: 'like' });
    try {
      const result = await auth().request('/api/community/posts/' + encodeURIComponent(id) + '/like', { method: 'POST' });
      records.forEach(record => setLike(record, uid, Boolean(result.liked), result.count));
    } catch (_) {
      snapshots.forEach(({ record, likes, count }) => { record.post_likes = likes; record.like_count = count; });
      auth().toast?.('点赞暂时未同步，请重试。');
    } finally {
      pendingLikes.delete(String(id)); render(); refreshPost(id, { focusAction: 'like' });
    }
  }
  window.toggleCommunityLike = async id => {
    if (!auth().requireLogin()) return;
    const uid = auth().session()?.user?.id, post = postRecords(id)[0];
    if (!uid || !post) return;
    await setPostLiked(id, !(post.post_likes || []).some(item => String(item.user_id) === String(uid)));
  };
  window.likeCommunityPost = id => setPostLiked(id, true);
  window.toggleCommunityFavorite = async id => {
    if (pendingFavorites.has(String(id)) || !auth().requireLogin()) return;
    const key = String(id), before = favoriteIds.has(key);
    pendingFavorites.add(key); before ? favoriteIds.delete(key) : favoriteIds.add(key); render(); refreshPost(id, { focusAction: 'favorite' });
    try {
      const result = await auth().request('/api/community/posts/' + encodeURIComponent(id) + '/favorite', { method: 'POST' });
      result.favorited ? favoriteIds.add(key) : favoriteIds.delete(key);
    } catch (_) {
      before ? favoriteIds.add(key) : favoriteIds.delete(key);
      auth().toast?.('收藏暂时未同步，请重试。');
    } finally {
      pendingFavorites.delete(key); render(); refreshPost(id, { focusAction: 'favorite' });
    }
  };
  window.addCommunityComment = async id => {
    const key = String(id), input = [...document.querySelectorAll('[data-comment-input]')].find(node => node.dataset.commentInput === key), content = input?.value.trim();
    if (!content || pendingComments.has(key) || !auth().requireLogin()) return;
    const session = auth().session(), uid = session?.user?.id, records = postRecords(id);
    if (!uid || !records.length) return;
    const optimistic = { id: 'pending-' + crypto.randomUUID(), author_id: uid, content, profiles: { display_name: session.user.user_metadata?.display_name || session.user.user_metadata?.name || '我' } };
    const snapshots = records.map(record => ({ record, comments: record.comments || [] }));
    pendingComments.add(key); records.forEach(record => { record.comments = [...(record.comments || []), optimistic]; });
    render(); refreshPost(id, { commentValue: content });
    let savedSuccessfully = false;
    try {
      const saved = await auth().request('/api/community/posts/' + encodeURIComponent(id) + '/comments', { method: 'POST', body: JSON.stringify({ content }) });
      records.forEach(record => { record.comments = (record.comments || []).map(item => item.id === optimistic.id ? saved : item); });
      savedSuccessfully = true;
      auth().toast?.('评论已发布');
    } catch (_) {
      snapshots.forEach(({ record, comments }) => { record.comments = comments; });
      auth().toast?.('评论暂时未发布，草稿已保留。');
    } finally {
      pendingComments.delete(key); render(); refreshPost(id, { commentValue: savedSuccessfully ? '' : input?.value || content, focusAction: 'comment' });
    }
  };
  function commentDeleteDialog() {
    let dialog = document.getElementById('communityCommentDeleteDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog'); dialog.id = 'communityCommentDeleteDialog'; dialog.setAttribute('aria-labelledby', 'communityCommentDeleteTitle');
    dialog.innerHTML = '<form method="dialog"><h2 id="communityCommentDeleteTitle">删除这条评论？</h2><p>删除后无法恢复。</p><div><button value="cancel" class="comment-delete-cancel">取消</button><button value="delete" class="comment-delete-confirm">删除</button></div></form>';
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('cancel'); });
    dialog.addEventListener('close', () => { const id = dialog.dataset.commentId; dialog.dataset.commentId = ''; if (dialog.returnValue === 'delete' && id) removeCommunityComment(id); });
    document.body.append(dialog); return dialog;
  }
  window.deleteCommunityComment = id => {
    if (!auth().requireLogin() || pendingCommentDeletes.has(String(id))) return;
    const dialog = commentDeleteDialog(); dialog.dataset.commentId = String(id);
    if (dialog.open) return;
    dialog.returnValue = 'cancel'; dialog.showModal();
  };
  async function removeCommunityComment(id) {
    const key = String(id), records = postRecordsForComment(id);
    if (pendingCommentDeletes.has(key)) return;
    const snapshots = records.map(record => ({ record, comments: record.comments || [] }));
    pendingCommentDeletes.add(key); records.forEach(record => { record.comments = (record.comments || []).filter(item => String(item.id) !== key); });
    render(); records.forEach(record => refreshPost(record.id));
    try {
      await auth().request('/api/community/comments/' + encodeURIComponent(id), { method: 'DELETE' });
      auth().toast?.('评论已删除');
    } catch (_) {
      snapshots.forEach(({ record, comments }) => { record.comments = comments; });
      auth().toast?.('评论未删除，请重试。');
    } finally { pendingCommentDeletes.delete(key); render(); records.forEach(record => refreshPost(record.id)); }
  }
  function postRecordsForComment(commentId) {
    const records = [...posts, ...(window.TravelPostUI?.all?.() || []), ...posts.map(post => window.TravelPostUI?.getActiveDetail?.(post.id)).filter(Boolean)];
    return [...new Set(records.filter(post => (post.comments || []).some(item => String(item.id) === String(commentId))))];
  }
  window.toggleCommunityFollow = async id => { if (!auth().requireLogin()) return; const before = followingIds.has(id); before ? followingIds.delete(id) : followingIds.add(id); render(); try { const result = await auth().request('/api/community/users/' + id + '/follow', { method: 'POST' }); result.following ? followingIds.add(id) : followingIds.delete(id); render(); } catch (_) { before ? followingIds.add(id) : followingIds.delete(id); render(); auth().toast?.('操作失败，请重试'); } };
  window.openCommunityLocation = city => { go('map'); loadMap(); setTimeout(() => window.searchTravelMap?.(city), 400); };
  const style = document.createElement('style'); style.textContent = '.post-author-identity{display:flex;align-items:center;gap:9px;min-width:0}.post-author-identity img,.post-avatar-fallback{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:0 0 auto}.post-avatar-fallback{display:grid;place-items:center;background:#e8eee9;color:#173f4f;font-size:11px;font-weight:800}.post-author{align-items:center}.post-actions{align-items:center;flex-wrap:wrap;gap:12px}.post-comments{font-size:12px;color:#718087;margin-top:10px;display:grid;gap:6px}.post-comments button{border:0;background:transparent;color:#ba6449;margin-left:6px;padding:0}'; document.head.appendChild(style);
  window.addEventListener('tw-auth-change', load); load();
}());
