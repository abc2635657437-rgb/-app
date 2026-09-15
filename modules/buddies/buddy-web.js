(function () {
  const auth = () => window.TravelWorldAuth;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const statusText = { pending: '待处理', accepted: '已同意', rejected: '已拒绝', cancelled: '已取消' };
  let trips = [], incoming = [], outgoing = [], chats = [];
  function empty(text) { return '<div class="card muted">' + text + '</div>'; }
  function appCard(item, received) {
    const actions = received && item.status === 'pending' ? '<button class="btn small" onclick="decideBuddy(\'' + item.id + '\',\'accepted\')">同意</button> <button class="btn alt small" onclick="decideBuddy(\'' + item.id + '\',\'rejected\')">拒绝</button>' : (!received && item.status === 'pending' ? '<button class="btn alt small" onclick="decideBuddy(\'' + item.id + '\',\'cancelled\')">取消申请</button>' : '');
    const applicant = item.applicant || {};
    const profile = received ? '<div class="buddy-applicant"><img src="' + safe(applicant.avatar_url || '/assets/avatar-default.svg') + '" alt=""><div><b>' + safe(applicant.display_name || '旅行者') + '</b><div class="muted">' + safe(applicant.bio || '这位旅行者还没有填写简介') + '</div></div></div>' : '';
    return '<div class="card"><div class="row"><b>' + safe(item.trip?.title || '旅行申请') + '</b><span class="pill">' + safe(statusText[item.status] || item.status) + '</span></div>' + profile + '<div class="muted">' + (received ? '申请人资料如上' : safe(item.trip?.destination || '')) + '</div><div class="muted" style="margin:7px 0">' + safe(item.message || '未填写申请说明') + '</div>' + actions + '</div>';
  }
  function render() {
    const section = document.getElementById('friends'); if (!section) return;
    const userId = auth()?.session?.()?.user?.id;
    section.innerHTML = '<div class="eyebrow">TRAVEL BUDDIES</div><div class="title" style="font-size:48px">一起出发，<br>让旅途多一个故事。</div><div class="card"><b>发布旅行计划</b><input id="tripTitle" class="input" placeholder="例如 杭州旅行 · 10月3日"><input id="tripDestination" class="input" placeholder="目的地"><div class="grid"><input id="tripStartDate" class="input" type="date"><input id="tripEndDate" class="input" type="date"></div><textarea id="tripNote" class="input" placeholder="分享行程、预算和同行偏好"></textarea><button class="btn" onclick="publishBuddyPlan()">发布计划</button></div><div class="head"><h2>可申请同行</h2><span class="muted">申请会绑定到具体旅行</span></div><div id="buddyPlans">' + (trips.length ? trips.map(plan => '<div class="card"><div class="row"><div><b>' + safe(plan.title) + '</b><div class="muted">' + safe(plan.destination) + ' · ' + safe(plan.start_date || '日期待定') + '</div></div><span class="pill">' + safe(plan.owner?.display_name || '旅行者') + '</span></div><div class="muted" style="margin:9px 0">' + safe(plan.description) + '</div>' + (userId && plan.owner_id !== userId ? '<button class="btn alt small" onclick="applyBuddy(\'' + plan.id + '\')">申请同行</button>' : '') + '</div>').join('') : empty('暂时没有公开招募的旅行。')) + '</div><div class="head"><h2>我收到的申请</h2></div><div id="incomingApplications">' + (!userId ? empty('登录后查看申请。') : incoming.length ? incoming.map(item => appCard(item, true)).join('') : empty('暂时没有收到的申请。')) + '</div><div class="head"><h2>我发出的申请</h2></div><div id="outgoingApplications">' + (!userId ? empty('登录后查看申请。') : outgoing.length ? outgoing.map(item => appCard(item, false)).join('') : empty('暂时没有发出的申请。')) + '</div><div class="head"><h2>同行聊天</h2></div><div id="buddyChats">' + (!userId ? empty('登录后查看同行聊天。') : chats.length ? chats.map(item => '<div class="card"><div class="row"><b>' + safe(item.trip?.title || '旅行聊天') + '</b><button class="btn alt small" onclick="openBuddyChat(\'' + item.id + '\',\'' + encodeURIComponent(item.trip?.title || '旅行聊天') + '\')">打开聊天</button></div><div class="muted">' + safe(item.trip?.destination || '') + '</div></div>').join('') : empty('同意同行后，这里会开启对应旅行的聊天。')) + '</div>';
  }
  async function load() {
    try { trips = await auth().request('/api/trips'); } catch (_) { trips = []; }
    if (auth()?.session?.()) {
      try { [incoming, outgoing, chats] = await Promise.all([auth().request('/api/buddy/applications?direction=received'), auth().request('/api/buddy/applications?direction=sent'), auth().request('/api/chats')]); } catch (_) { incoming = []; outgoing = []; chats = []; }
    } else { incoming = []; outgoing = []; chats = []; }
    render();
  }
  window.publishBuddyPlan = async () => {
    if (!auth().requireLogin()) return;
    const body = { title: document.getElementById('tripTitle').value.trim(), destination: document.getElementById('tripDestination').value.trim(), startDate: document.getElementById('tripStartDate').value || null, endDate: document.getElementById('tripEndDate').value || null, description: document.getElementById('tripNote').value.trim() };
    try { await auth().request('/api/trips', { method: 'POST', body: JSON.stringify(body) }); await load(); } catch (error) { alert(error.message); }
  };
  window.applyBuddy = async tripId => { if (!auth().requireLogin()) return; const message = prompt('简单介绍同行原因或旅行偏好：') ?? ''; try { await auth().request('/api/trips/' + tripId + '/applications', { method: 'POST', body: JSON.stringify({ message }) }); await load(); } catch (error) { alert(error.message); } };
  window.decideBuddy = async (id, status) => { try { await auth().request('/api/buddy/applications/' + id, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); } catch (error) { alert(error.message); } };
  window.openBuddyChat = async (id, encodedTitle) => {
    try {
      const messages = await auth().request('/api/chats/' + id + '/messages'); const modal = document.createElement('div'); modal.className = 'buddy-chat-modal';
      modal.innerHTML = '<div class="buddy-chat-window"><div class="row"><b>' + safe(decodeURIComponent(encodedTitle)) + '</b><button class="btn alt small" onclick="this.closest(\'.buddy-chat-modal\').remove()">关闭</button></div><div class="buddy-messages">' + messages.map(message => '<div class="buddy-message ' + (message.sender_id === auth().session().user.id ? 'mine' : '') + '">' + (message.media_url ? '<img src="' + safe(message.media_url) + '" alt="聊天图片">' : '') + safe(message.content) + '</div>').join('') + '</div><div class="comment-row"><input class="buddy-chat-input" placeholder="讨论集合地点、交通、住宿…"><input class="buddy-chat-file" type="file" accept="image/*"><button class="btn small" onclick="sendBuddyMessage(\'' + id + '\',this)">发送</button></div></div>'; document.body.appendChild(modal);
    } catch (error) { alert(error.message); }
  };
  window.sendBuddyMessage = async (id, button) => {
    const modal = button.closest('.buddy-chat-modal'), input = modal.querySelector('.buddy-chat-input'), file = modal.querySelector('.buddy-chat-file').files[0]; let mediaUrl = null;
    try { if (file) { const form = new FormData(); form.append('file', file); mediaUrl = (await auth().request('/api/chats/' + id + '/media', { method: 'POST', body: form })).mediaUrl; } await auth().request('/api/chats/' + id + '/messages', { method: 'POST', body: JSON.stringify({ content: input.value.trim(), mediaUrl }) }); modal.remove(); window.openBuddyChat(id, encodeURIComponent(chats.find(chat => chat.id === id)?.trip?.title || '旅行聊天')); } catch (error) { alert(error.message); }
  };
  const style = document.createElement('style'); style.textContent = '.buddy-chat-modal{position:fixed;inset:0;background:#173f4f55;z-index:40;display:flex;align-items:flex-end;justify-content:center}.buddy-chat-window{width:min(480px,100%);max-height:80vh;background:#f7f5f0;border-radius:18px 18px 0 0;padding:18px}.buddy-messages{max-height:45vh;overflow:auto;padding:14px 0}.buddy-message{background:#fff;border-radius:12px;padding:10px;margin:8px 0;max-width:80%}.buddy-message.mine{background:#173f4f;color:#fff;margin-left:auto}.buddy-message img{display:block;max-width:100%;margin-bottom:6px}.buddy-chat-file{max-width:90px;font-size:10px}.buddy-applicant{display:flex;align-items:center;gap:10px;padding:10px 0}.buddy-applicant img{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#e7eceb}'; document.head.appendChild(style);
  window.addEventListener('tw-auth-change', load); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
}());
