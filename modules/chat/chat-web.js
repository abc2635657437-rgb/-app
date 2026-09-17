(function () {
  const auth = () => window.TravelWorldAuth;
  const uid = () => auth()?.session()?.user?.id || '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const avatar = user => user?.avatar_url ? '<img class="dm-avatar" src="' + esc(user.avatar_url) + '" alt="">' : '<span class="dm-avatar dm-initial">' + esc((user?.display_name || user?.username || '旅').slice(0,1)) + '</span>';
  const name = user => user?.display_name || user?.username || '旅行者';
  const time = value => value ? new Date(value).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  let epoch = 0, account = uid(), list = [], active = null, pending = new Map(), listBusy = false, messageBusy = false, requestNumber = 0;
  const section = document.createElement('section');
  section.id = 'messages'; section.className = 'screen';
  section.innerHTML = '<div class="dm-page-head"><div><div class="eyebrow">PRIVATE MESSAGES</div><div class="title">消息</div><p class="muted">和旅途中遇见的人，继续交换沿途见闻。</p></div><span class="dm-private-mark" title="会话仅双方可见"><span aria-hidden="true">◌</span> 私密</span></div><div id="dmList" aria-live="polite"></div>';
  document.getElementById('friends').before(section);
  const nav = document.createElement('button'); nav.dataset.id = 'messages';
  nav.innerHTML = '<span class="nav-icon">✉</span><span id="dmBadge" hidden></span><br>聊天';
  nav.onclick = () => { window.go('messages'); refreshList(); };
  document.querySelector('.nav [data-id="map"]').after(nav);
  const style = document.createElement('style');
  style.textContent = '.nav [data-id="messages"]{position:relative}#dmBadge,.dm-count{background:#c45e48;color:white;border-radius:12px;min-width:18px;padding:2px 5px;font-size:10px}#dmBadge{position:absolute;top:-4px;right:0}#dmBadge[hidden]{display:none}.dm-row{display:flex;width:100%;gap:12px;align-items:center;border:0;background:white;padding:16px;text-align:left;border-radius:14px;margin:8px 0;color:inherit;cursor:pointer}.dm-avatar{width:44px;height:44px;flex-shrink:0;border-radius:50%;object-fit:cover}.dm-initial{display:grid;place-items:center;background:#dfeae4;color:#173f4f;font-weight:700}.dm-summary{flex:1;min-width:0}.dm-summary b{font-size:15px}.dm-summary time{font-size:10px;color:#718087;white-space:nowrap}.dm-preview{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;margin-top:6px;color:#718087}.dm-empty{text-align:center;padding:36px 12px}.dm-overlay{position:fixed;inset:0;z-index:45;background:#173f4f66;display:flex;justify-content:center;backdrop-filter:blur(8px)}.dm-window{background:#f7f5f0;width:min(480px,100%);height:100dvh;display:flex;flex-direction:column;padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom)}.dm-header{display:flex;align-items:center;gap:10px;padding:14px 0;border-bottom:1px solid #dfe6df}.dm-header b{flex:1}.dm-header button{border:0;background:transparent;color:#173f4f;min-height:40px;cursor:pointer}.dm-status{font-size:12px;color:#a64a37;min-height:22px;padding-top:4px}.dm-history{overflow:auto;flex:1;min-height:0;padding:8px 0;overscroll-behavior:contain}.dm-message{max-width:84%;width:fit-content;margin:10px 0;padding:11px 14px;background:white;border-radius:15px;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.5}.dm-message.mine{margin-left:auto;background:#173f4f;color:white}.dm-message small{display:block;font-size:10px;opacity:.7;margin-top:5px}.dm-message.failed{background:#fde9e4;color:#963b28}.dm-message button{border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer}.dm-compose{display:flex;align-items:flex-end;gap:8px;padding:10px 0 14px}.dm-compose textarea{resize:none;flex:1;min-width:0;font:inherit;border:1px solid #dce5df;border-radius:14px;padding:12px;background:white;max-height:130px}.dm-compose button{min-height:44px}.dm-older{display:block;margin:0 auto;border:0;background:transparent;color:#718087;cursor:pointer}.dm-profile{background:#f7f5f0;padding:22px;border-radius:24px 24px 0 0;width:min(480px,100%);margin:auto auto 0;max-height:86dvh;overflow:auto;box-shadow:0 -20px 60px #173f4f22}.dm-profile-hero{display:flex;gap:14px;align-items:center;margin:18px 0}.dm-profile .dm-avatar{width:72px;height:72px}.dm-profile h2{margin:0;color:#173f4f}.dm-profile-stats{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;padding:14px 0;border-block:1px solid #dfe6df}.dm-profile-stats b{display:block;font-size:20px;color:#173f4f}.dm-profile-stats small{color:#718087}.dm-profile-actions{display:flex;gap:8px;margin:16px 0}.dm-profile-post{padding:13px 0;border-top:1px solid #e4e9e5}.dm-profile-post b{color:#173f4f}.dm-profile-post p{color:#53656b;margin:6px 0;line-height:1.5}';
  document.head.appendChild(style);
  function status(text) { const node = document.getElementById('dmStatus'); if (node) node.textContent = text; }
  function badge() { const count = list.reduce((n,c)=>n+Number(c.unread_count || 0),0); const node = document.getElementById('dmBadge'); node.hidden = !count; node.textContent = count > 99 ? '99+' : count; nav.setAttribute('aria-label','聊天，'+count+' 条未读'); }
  function renderList() {
    const target = document.getElementById('dmList');
    if (!uid()) { target.innerHTML = '<div class="card dm-empty"><span class="dm-empty-icon" aria-hidden="true">信</span><b>你的旅途来信在这里</b><span class="muted">登录后查看私聊消息，只有会话双方可以读取。</span><button class="btn" id="dmLogin">登录查看</button></div>'; target.querySelector('button').onclick = () => auth().showLogin(); return; }
    target.innerHTML = list.length ? list.map(c=>'<button class="dm-row" data-chat="'+esc(c.id)+'">'+avatar(c.user)+'<div class="dm-summary"><div class="row"><b>'+esc(name(c.user))+'</b><time>'+time(c.last_message?.created_at)+'</time></div><div class="dm-preview">'+esc(c.last_message?.content || '发一句问候，开始聊天')+'</div></div>'+(c.unread_count?'<span class="dm-count">'+c.unread_count+'</span>':'')+'</button>').join('') : '<div class="card dm-empty"><span class="dm-empty-icon" aria-hidden="true">信</span><b>还没有来信</b><span class="muted">从旅友或旅行者主页发起私聊。</span></div>';
    target.querySelectorAll('[data-chat]').forEach(button=>button.onclick=()=>openChat(list.find(c=>c.id===button.dataset.chat)));
  }
  async function refreshList() {
    if (!uid()) { list=[]; badge(); renderList(); return; }
    if (listBusy) return;
    listBusy=true; const version=epoch;
    try { const rows=await auth().request('/api/dm'); if(version!==epoch)return; list=rows; badge(); renderList(); }
    catch(error) { if(version!==epoch)return; const target=document.getElementById('dmList'); if(!list.length) { target.innerHTML='<div class="card dm-empty">聊天加载失败：'+esc(error.message)+'<br><button class="btn small">重试</button></div>'; target.querySelector('button').onclick=refreshList; } else if(section.classList.contains('active')) auth().toast('消息同步失败，正在重试'); }
    finally { if(version===epoch)listBusy=false; }
  }
  function messageHTML(m) { const mine=m.sender_id===uid(); return '<div class="dm-message '+(mine?'mine ':'')+(m.failed?'failed':'')+'"><span>'+esc(m.content)+'</span><small>'+ (m.failed?'发送失败':m.sending?'发送中…':time(m.created_at)+(mine?(m.seq<=active.peerRead?' · 已读':' · 已发送'):''))+'</small>'+(m.failed?'<button data-retry="'+esc(m.client_id)+'">重试</button>':'')+'</div>'; }
  function renderMessages(force=false) {
    const box=document.getElementById('dmHistory'); if(!box||!active)return;
    const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<100, previousHeight=box.scrollHeight, previousTop=box.scrollTop;
    const rows=[...active.messages.values()].sort((a,b)=>a.seq-b.seq);
    const optimistic=[...pending.values()].filter(m=>m.chat_id===active.id);
    box.innerHTML=(active.hasMore?'<button class="dm-older">加载更早消息</button>':'')+(rows.map(messageHTML).join('')+optimistic.map(messageHTML).join('') || '<div class="dm-empty muted">还没有消息，打个招呼吧。</div>');
    box.querySelectorAll('[data-retry]').forEach(button=>button.onclick=()=>sendPending(pending.get(button.dataset.retry)));
    const older=box.querySelector('.dm-older'); if(older)older.onclick=()=>refreshMessages(true);
    if(force||nearBottom)box.scrollTop=box.scrollHeight; else box.scrollTop=previousTop+(active.prepending?box.scrollHeight-previousHeight:0);
    active.prepending=false;
  }
  async function refreshMessages(older=false) {
    if(!active||messageBusy||document.hidden)return;
    const chat=active, version=epoch, serial=requestNumber; messageBusy=true;
    try {
      const before=older?Math.min(...chat.messages.keys()):null;
      const data=await auth().request('/api/dm/'+chat.id+'/messages'+(before?'?before='+before:''));
      if(version!==epoch||active!==chat||serial!==requestNumber)return;
      for(const m of data.messages) { chat.messages.set(m.seq,m); pending.delete(m.client_id); }
      chat.peerRead=data.peerRead;
      if(older||!chat.loaded)chat.hasMore=data.hasMore;
      chat.prepending=older; renderMessages(!chat.loaded); chat.loaded=true; status('');
      const through=Math.max(0,...chat.messages.keys());
      if(!document.hidden&&through>chat.readThrough) {
        await auth().request('/api/dm/'+chat.id+'/read',{method:'PATCH',body:JSON.stringify({through})});
        if(version!==epoch||active!==chat)return;
        chat.readThrough=through; await refreshList();
      }
    } catch(error) { if(version===epoch&&active===chat)status('同步失败：'+error.message+'，将自动重试'); }
    finally { if(version===epoch&&serial===requestNumber)messageBusy=false; }
  }
  function closeChat() { active=null; requestNumber++; messageBusy=false; document.getElementById('dmOverlay')?.remove(); refreshList(); }
  function openChat(chat) {
    closeChat(); window.go('messages');
    active={...chat,messages:new Map(),peerRead:0,readThrough:0,hasMore:false,loaded:false};
    const overlay=document.createElement('div'); overlay.id='dmOverlay'; overlay.className='dm-overlay';
    overlay.innerHTML='<div class="dm-window" role="dialog" aria-label="与 '+esc(name(chat.user))+' 的私聊"><div class="dm-header"><button id="dmBack" aria-label="返回消息列表">‹ 返回</button>'+avatar(chat.user)+'<div class="dm-person"><b>'+esc(name(chat.user))+'</b><small>私密会话</small></div><button id="dmDelete">删除</button></div><div class="dm-status" id="dmStatus" role="status">正在加载消息…</div><div class="dm-history" id="dmHistory" aria-live="polite"></div><form class="dm-compose"><textarea rows="1" maxlength="4000" aria-label="消息" placeholder="写下沿途见闻…"></textarea><button class="btn" type="submit">发送</button></form></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#dmBack').onclick=closeChat;
    overlay.querySelector('#dmDelete').onclick=async()=>{
      if(!confirm('删除自己这边的聊天记录？对方的记录不受影响，新消息仍可收到。'))return;
      const version=epoch, id=active.id;
      try { await auth().request('/api/dm/'+id,{method:'DELETE'}); if(version!==epoch)return; for(const [key,m] of pending)if(m.chat_id===id)pending.delete(key); closeChat(); auth().toast('聊天已删除'); }
      catch(error) { if(version===epoch)status('删除失败：'+error.message); }
    };
    const input=overlay.querySelector('textarea'), form=overlay.querySelector('form');
    form.onsubmit=event=>{event.preventDefault(); const content=input.value.trim(); if(!content)return; const submit=form.querySelector('button'); submit.disabled=true; const m={chat_id:active.id,sender_id:uid(),client_id:crypto.randomUUID(),content,sending:true}; pending.set(m.client_id,m); input.value=''; input.style.height=''; renderMessages(true); sendPending(m).finally(()=>{if(document.body.contains(submit))submit.disabled=false;});};
    input.oninput=()=>{input.style.height='';input.style.height=Math.min(input.scrollHeight,130)+'px';};
    input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}};
    refreshMessages();
  }
  async function sendPending(m) {
    if(!m||m.inFlight||m.sender_id!==uid())return;
    m.inFlight=true;m.sending=true;m.failed=false;const version=epoch;renderMessages();
    try {
      const saved=await auth().request('/api/dm/'+m.chat_id+'/messages',{method:'POST',body:JSON.stringify({content:m.content,clientId:m.client_id})});
      if(version!==epoch)return; pending.delete(m.client_id);
      if(active?.id===m.chat_id){active.messages.set(saved.seq,saved);renderMessages(true);status('');}
      refreshList();
    } catch(error){if(version!==epoch)return;m.failed=true;m.sending=false;if(active?.id===m.chat_id){renderMessages();status(error.message);}}
    finally {m.inFlight=false;}
  }
  window.openDirectChat=async userId=>{
    if(!auth().requireLogin())return;
    const version=epoch;auth().toast('正在打开私聊…');
    try {const user=await auth().request('/api/dm/users/'+encodeURIComponent(userId));const result=await auth().request('/api/dm/users/'+encodeURIComponent(userId),{method:'POST'});if(version!==epoch)return;document.getElementById('dmUser')?.remove();openChat({id:result.chatId,user});refreshList();}
    catch(error){if(version===epoch)auth().toast('私聊打开失败：'+error.message);}
  };
  window.openTravelUser=async userId=>{
    const version=epoch;
    try {
      const result=await auth().request('/api/community/users/'+encodeURIComponent(userId));if(version!==epoch)return;
      const user=result.profile,stats=result.stats||{},posts=result.posts||[];document.getElementById('dmUser')?.remove();
      const node=document.createElement('div');node.id='dmUser';node.className='dm-overlay';
      node.innerHTML='<div class="dm-profile" role="dialog" aria-label="'+esc(name(user))+' 的公开主页"><button class="btn alt small" id="dmProfileBack">返回</button><div class="dm-profile-hero">'+avatar(user)+'<div><h2>'+esc(name(user))+'</h2><p class="muted">'+esc(user.bio||'这位旅行者还没有填写简介。')+'</p></div></div><div class="dm-profile-stats"><span><b>'+Number(stats.posts||0)+'</b><small>发布</small></span><span><b>'+Number(stats.followers||0)+'</b><small>粉丝</small></span><span><b>'+Number(stats.likes||0)+'</b><small>获赞</small></span></div><div class="dm-profile-actions">'+(result.isSelf?'<button class="btn" id="dmOwnProfile">编辑我的主页</button>':'<button class="btn alt" id="dmFollow">'+(result.isFollowing?'已关注':'关注')+'</button><button class="btn" id="dmStart">私聊</button>')+'</div><h3>最近发布</h3>'+(posts.length?posts.slice(0,8).map(post=>'<article class="dm-profile-post"><b>'+esc(post.title||'旅行分享')+'</b><p>'+esc(post.content||'')+'</p><small class="muted">'+esc(post.location_name||'未标注地点')+'</small></article>').join(''):'<p class="muted">还没有公开发布。</p>')+'</div>';
      document.body.appendChild(node);node.onclick=event=>{if(event.target===node)node.remove();};node.querySelector('#dmProfileBack').onclick=()=>node.remove();
      if(node.querySelector('#dmOwnProfile'))node.querySelector('#dmOwnProfile').onclick=()=>{node.remove();window.go('profile');window.loadTravelProfile?.();};
      if(node.querySelector('#dmStart'))node.querySelector('#dmStart').onclick=()=>window.openDirectChat(user.id);
      if(node.querySelector('#dmFollow'))node.querySelector('#dmFollow').onclick=async event=>{if(!auth().requireLogin())return;event.currentTarget.disabled=true;try{const value=await auth().request('/api/community/users/'+encodeURIComponent(user.id)+'/follow',{method:'POST'});event.currentTarget.textContent=value.following?'已关注':'关注';}catch(error){auth().toast('关注失败：'+error.message);}finally{event.currentTarget.disabled=false;}};
    } catch(error){if(version===epoch)auth().toast('主页加载失败：'+error.message);}
  };
  window.loadChats=refreshList;
  function reset() { if(account===uid())return; account=uid();epoch++;active=null;list=[];pending.clear();listBusy=false;messageBusy=false;requestNumber++;document.getElementById('dmOverlay')?.remove();document.getElementById('dmUser')?.remove();window.closeBuddyChat?.();badge();renderList();refreshList(); }
  window.addEventListener('tw-auth-change',reset);
  window.addEventListener('online',()=>{refreshList();refreshMessages();});
  window.addEventListener('offline',()=>status('网络已断开，消息发送失败后可点击重试'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshList();refreshMessages();}});
  setInterval(()=>{if(uid()&&!document.hidden){refreshList();refreshMessages();}},2000);
  renderList();refreshList();
}());
