// Native travel assistant screen.
//
// This replaces the third-party hosted agent that used to be embedded as an
// iframe. The iframe cost ~2.8 s of shell load before the app's own requests
// even started, and every reply took another cross-border round trip. Streaming
// from our own origin means the first words appear after one API hop, and the
// conversation can hand straight off to the route studio.
(function () {
  var STORE = 'tw-ai-chat-v1';
  var MAX_TURNS = 30;
  var MAX_HISTORY = 8;
  // Injected like map-web.js injects photo-places.css, so the stylesheet travels
  // with the module and stays versioned by the script tag.
  if (!document.getElementById('aiChatStyles')) {
    var styles = document.createElement('link');
    styles.id = 'aiChatStyles';
    styles.rel = 'stylesheet';
    styles.href = 'modules/ai/ai-chat.css?v=14';
    document.head.append(styles);
  }

  var PROMPTS = [
    { id: 'outfit', icon: '衣', zh: '穿衣与打包', en: 'What to wear & pack' },
    { id: 'food', icon: '食', zh: '吃什么', en: 'What to eat' },
    { id: 'stay', icon: '住', zh: '住哪里', en: 'Where to stay' },
    { id: 'move', icon: '行', zh: '怎么走', en: 'How to get around' },
    { id: 'play', icon: '玩', zh: '玩什么', en: 'What to do' },
    { id: 'plan', icon: '✈', zh: '帮我规划一次旅行', en: 'Plan a trip for me' }
  ];

  var COPY = {
    zh: {
      title: '旅行助手',
      note: 'AI 生成，非真人。价格、营业时间与安全信息请以当地最新公告为准。',
      greeting: '告诉我目的地、天数和预算，我帮你把衣、食、住、行、玩一次理清。',
      placeholder: '想去哪里？有什么顾虑？',
      send: '发送',
      stop: '停止',
      thinking: '正在思考…',
      sources: '参考来源',
      makeRoute: '生成路线',
      login: '登录后可畅聊',
      anon: '匿名试用每天有限次，登录后不限量。',
      clear: '清空对话',
      retry: '重试',
      error: '助手暂时连接不上，请重试。',
      offline: '网络似乎断开了，检查连接后重试。',
      quota: '提问太频繁了，请稍后再试。',
      empty: '先说说你的目的地，我来帮你规划。'
    },
    en: {
      title: 'Travel assistant',
      note: 'AI-generated, not a human. Verify prices, opening hours and safety locally.',
      greeting: 'Tell me the destination, trip length and budget; I will sort out what to wear, eat, where to stay, how to move and what to see.',
      placeholder: 'Where to? Any concerns?',
      send: 'Send',
      stop: 'Stop',
      thinking: 'Thinking…',
      sources: 'Sources',
      makeRoute: 'Make a route',
      login: 'Sign in to keep chatting',
      anon: 'Anonymous use is limited; sign in for unlimited questions.',
      clear: 'Clear chat',
      retry: 'Retry',
      error: 'The assistant is unreachable. Please retry.',
      offline: 'You appear to be offline. Check your connection and retry.',
      quota: 'Too many questions. Please wait a moment.',
      empty: 'Start with a destination and I will plan it with you.'
    }
  };

  function t() { return (window.TravelWorldI18n && window.TravelWorldI18n.language && window.TravelWorldI18n.language() === 'en') ? COPY.en : COPY.zh; }
  function auth() { return window.TravelWorldAuth; }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  var turns = [];
  var streaming = null;
  var root = null;
  var list = null;
  var input = null;
  var status = null;

  function load() {
    try { var saved = JSON.parse(localStorage.getItem(STORE) || '[]'); turns = Array.isArray(saved) ? saved.slice(-MAX_TURNS) : []; }
    catch (_) { turns = []; }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(turns.slice(-MAX_TURNS))); } catch (_) {} }

  // Renders light markdown-ish structure so the five-axis answers stay readable
  // on a phone: headings, lists, bold and tables survive, scripts do not.
  function format(text) {
    var html = esc(text);
    html = html.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(\d+)[.)]\s+(.+)$/gm, '<li>$2</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/\n{2,}/g, '</p><p>');
    return '<p>' + html + '</p>';
  }

  function bubble(role, text, options) {
    options = options || {};
    var el = document.createElement('div');
    el.className = 'bubble ' + (role === 'user' ? 'me' : 'ai');
    if (role === 'ai') {
      var body = document.createElement('div');
      body.className = 'ai-chat-body';
      body.innerHTML = format(text || t().thinking);
      el.append(body);
      if (options.sources && options.sources.length) {
        var box = document.createElement('div');
        box.className = 'ai-chat-sources';
        box.append(document.createTextNode(t().sources + '：'));
        options.sources.slice(0, 4).forEach(function (url) {
          var link = document.createElement('a');
          link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.textContent = url.replace(/^https?:\/\//, '').slice(0, 42);
          box.append(link);
        });
        el.append(box);
      }
      if (options.makeRoute && text) {
        var actions = document.createElement('div');
        actions.className = 'ai-chat-actions';
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn alt small';
        button.textContent = t().makeRoute;
        button.onclick = function () { toRoute(text); };
        actions.append(button);
        el.append(actions);
      }
    } else {
      el.textContent = text;
    }
    return el;
  }

  function scrollToEnd() { if (list) list.scrollTop = list.scrollHeight; }

  // Pull a usable destination and a title out of the conversation so the studio
  // opens with something the traveller can actually edit.
  function toRoute(answer) {
    var A = auth();
    if (!A || !A.requireLogin()) return;
    var destination = '';
    var asked = '';
    for (var i = turns.length - 1; i >= 0; i -= 1) {
      if (turns[i].role === 'user' && !asked) asked = turns[i].content;
      if (asked) break;
    }
    var match = String(asked).match(/[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z ]{1,18}/);
    if (match) destination = match[0].trim();
    var heading = String(answer).split('\n').filter(function (line) { return line.trim(); })[0] || '';
    var title = (destination ? destination + ' ' : '') + '旅行路线';
    window.openStudio(null, {
      title: String(heading).replace(/^[#*\s]+/, '').slice(0, 90) || title,
      dest: destination,
      tips: String(answer).slice(0, 1200)
    });
  }

  function setStatus(text) { if (status) status.textContent = text || ''; }

  async function ask(question, bubbleEl) {
    var A = auth();
    var headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
    if (A && A.session() && A.session().access_token) headers.Authorization = 'Bearer ' + A.session().access_token;
    var history = turns.slice(-MAX_HISTORY).map(function (turn) { return { role: turn.role, content: turn.content }; });
    streaming = { aborted: false, body: bubbleEl.querySelector('.ai-chat-body') };

    var answer = '';
    var sources = [];
    try {
      var response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: headers,
        signal: AbortSignal.timeout ? AbortSignal.timeout(90000) : undefined,
        body: JSON.stringify({ message: question, history: history, language: t() === COPY.en ? 'en' : 'zh', stream: true })
      });

      if (!response.ok || !response.body) {
        var problem = null;
        try { problem = await response.json(); } catch (_) {}
        var message = (problem && problem.error) || t().error;
        if (response.status === 429) message = t().quota;
        throw new Error(message);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done || (streaming && streaming.aborted)) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        var split = buffer.indexOf('\n\n');
        while (split >= 0) {
          var frame = buffer.slice(0, split).trim();
          buffer = buffer.slice(split + 2);
          split = buffer.indexOf('\n\n');
          var event = 'message', data = '';
          frame.split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) event = line.slice(6).trim();
            if (line.indexOf('data:') === 0) data += line.slice(5).trim();
          });
          if (!data) continue;
          var payload = {};
          try { payload = JSON.parse(data); } catch (_) { continue; }
          if (event === 'meta') sources = payload.sources || [];
          if (event === 'delta' && payload.text) {
            answer += payload.text;
            if (streaming && streaming.body) { streaming.body.innerHTML = format(answer); scrollToEnd(); }
          }
          if (event === 'done') { if (payload.answer) answer = payload.answer; }
        }
      }
      if (!answer.trim()) throw new Error(t().empty);
    } catch (error) {
      var text = error && error.name === 'AbortError' ? t().offline : (error && error.message ? error.message : t().error);
      if (streaming && streaming.body) streaming.body.innerHTML = '<p>' + esc(text) + '</p>';
      setStatus(text);
      turns.push({ role: 'assistant', content: text });
      save();
      return;
    } finally {
      streaming = null;
    }

    if (streaming && streaming.body) { streaming.body.innerHTML = format(answer); }
    // Swap the live bubble for the final one so it carries sources and the route action.
    var finalEl = bubble('ai', answer, { sources: sources, makeRoute: true });
    bubbleEl.replaceWith(finalEl);
    turns.push({ role: 'assistant', content: answer });
    save();
    setStatus('');
    scrollToEnd();
  }

  function render() {
    if (!list) return;
    list.innerHTML = '';
    if (!turns.length) {
      var hello = document.createElement('div');
      hello.className = 'ai-chat-hello';
      var glyph = document.createElement('div');
      glyph.className = 'ai-chat-hero';
      glyph.textContent = 'AI';
      var title = document.createElement('b');
      title.textContent = t().title;
      var note = document.createElement('p');
      note.className = 'muted';
      note.textContent = t().greeting;
      hello.append(glyph, title, note);
      list.append(hello);
    }
    turns.forEach(function (turn) {
      list.append(bubble(turn.role, turn.content, turn.role === 'ai' ? { makeRoute: true } : null));
    });
    scrollToEnd();
  }

  function renderPrompts() {
    var row = document.getElementById('aiChatPrompts');
    if (!row) return;
    row.innerHTML = '';
    PROMPTS.forEach(function (prompt) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pill ai-chat-prompt';
      chip.innerHTML = '<b>' + esc(prompt.icon) + '</b> ' + esc(t() === COPY.en ? prompt.en : prompt.zh);
      chip.onclick = function () {
        if (!input) return;
        input.value = t() === COPY.en ? prompt.en : prompt.zh;
        input.focus();
      };
      row.append(chip);
    });
  }

  function send() {
    var question = input ? input.value.trim() : '';
    if (!question || streaming) return;
    input.value = '';
    turns.push({ role: 'user', content: question });
    save();
    list.append(bubble('user', question));
    var pending = bubble('ai', '');
    list.append(pending);
    setStatus(t().thinking);
    scrollToEnd();
    ask(question, pending);
  }

  function stop() {
    if (streaming) { streaming.aborted = true; setStatus(''); }
  }

  function clearChat() {
    if (streaming) return;
    turns = [];
    save();
    render();
  }

  function build() {
    var section = document.getElementById('ai');
    if (!section) return;
    // Keep the static intro (title/sub copy) that index.html ships for SEO and
    // no-JS visitors; the chat panel is appended underneath it.
    section.className = 'screen ai-chat-screen';
    if (document.getElementById('aiChatPanel')) return;

    var prompts = document.createElement('div');
    prompts.id = 'aiChatPrompts';
    prompts.className = 'ai-chat-prompts';

    list = document.createElement('div');
    list.className = 'ai-chat-list';
    list.setAttribute('aria-live', 'polite');

    var note = document.createElement('p');
    note.className = 'ai-chat-note muted';
    note.textContent = t().note;

    var bar = document.createElement('form');
    bar.className = 'ai-chat-compose';
    input = document.createElement('textarea');
    input.className = 'input';
    input.rows = 1;
    input.maxLength = 2000;
    input.placeholder = t().placeholder;
    input.setAttribute('aria-label', t().placeholder);
    var actions = document.createElement('div');
    actions.className = 'row';
    status = document.createElement('small');
    status.className = 'muted ai-chat-status';
    status.setAttribute('role', 'status');
    var buttons = document.createElement('div');
    buttons.className = 'row';
    var stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.className = 'btn alt small';
    stopButton.textContent = t().stop;
    stopButton.hidden = true;
    stopButton.onclick = function (event) { event.preventDefault(); stop(); };
    var sendButton = document.createElement('button');
    sendButton.type = 'submit';
    sendButton.className = 'btn small';
    sendButton.textContent = t().send;
    buttons.append(stopButton, sendButton);
    actions.append(status, buttons);
    bar.append(input, actions);
    bar.onsubmit = function (event) { event.preventDefault(); send(); };

    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 132) + 'px';
      stopButton.hidden = !streaming;
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
    });

    var panel = document.createElement('div');
    panel.id = 'aiChatPanel';
    panel.className = 'ai-chat-panel';
    var chrome = document.createElement('div');
    chrome.className = 'ai-chat-chrome row';
    var label = document.createElement('b');
    label.className = 'ai-chat-label';
    label.textContent = t().title;
    var clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'post-map';
    clearButton.textContent = t().clear;
    clearButton.onclick = clearChat;
    chrome.append(label, clearButton);
    panel.append(chrome, prompts, list, note, bar);
    section.append(panel);
    root = section;

    renderPrompts();
    render();
    if (!auth() || !auth().session()) {
      var hint = document.createElement('div');
      hint.className = 'ai-chat-signin';
      hint.innerHTML = '<span>' + esc(t().anon) + '</span><button type="button" class="btn alt small" data-login>' + esc(t().login) + '</button>';
      hint.querySelector('[data-login]').onclick = function () { var A = auth(); if (A && A.showLogin) A.showLogin(); };
      list.prepend(hint);
    }
  }

  // Only the chat chrome follows language and auth changes; the intro copy is
  // translated by the app's own i18n pass.
  function refreshText() {
    if (!root) return;
    renderPrompts();
    render();
    var note = document.querySelector('.ai-chat-note');
    if (note) note.textContent = t().note;
    if (input) input.placeholder = t().placeholder;
    var label = document.querySelector('.ai-chat-label');
    if (label) label.textContent = t().title;
    var clearButton = document.querySelector('.ai-chat-chrome button');
    if (clearButton) clearButton.textContent = t().clear;
    var signin = document.querySelector('.ai-chat-signin');
    if (signin && auth() && auth().session()) signin.remove();
    if (!signin && (!auth() || !auth().session())) render();
  }

  function start() {
    if (window.aiChatBuilt) return;
    if (!window.TravelWorldAuth) { setTimeout(start, 120); return; }
    build();
    window.aiChatBuilt = true;
    window.addEventListener('tw-i18n-change', refreshText);
    window.addEventListener('tw-auth-change', refreshText);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
