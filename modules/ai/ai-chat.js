// Travel desk — the native travel consultant screen.
//
// The assistant is positioned as a desk editor, not a chatbot: it asks for the
// few facts that change an answer (where, how long, with whom, what budget),
// then answers across the five planning axes the product is built around —
// 衣 · 食 · 住 · 行 · 玩 — and hands the result to the route studio.
//
// Rendering notes: answers are laid out as an editorial column (headings, lists,
// numbered steps, tables, pull quotes) rather than a chat bubble, so long
// practical answers stay readable on a 390px phone. Everything from the model is
// escaped before a small block parser turns it into markup.
(function () {
  var STORE = 'tw-ai-chat-v1';
  var VERSION = '18-photo-plan';
  var MAX_TURNS = 30;
  var MAX_HISTORY = 8;
  // Injected like map-web.js injects photo-places.css, so the stylesheet travels
  // with the module and stays versioned by the script tag.
  if (!document.getElementById('aiChatStyles')) {
    var styles = document.createElement('link');
    styles.id = 'aiChatStyles';
    styles.rel = 'stylesheet';
    styles.href = 'modules/ai/ai-chat.css?v=' + VERSION;
    document.head.append(styles);
  }

  var PROMPTS = [
    { id: 'outfit', icon: '衣', zh: '怎么穿', en: 'Wear' },
    { id: 'food', icon: '食', zh: '吃什么', en: 'Eat' },
    { id: 'stay', icon: '住', zh: '住哪里', en: 'Stay' },
    { id: 'move', icon: '行', zh: '怎么走', en: 'Move' },
    { id: 'play', icon: '玩', zh: '玩什么', en: 'See' },
    { id: 'plan', icon: '✈', zh: '排行程', en: 'Plan' }
  ];

  var REFS = ['①', '②', '③', '④', '⑤'];

  var COPY = {
    zh: {
      title: '同路人 · 旅途顾问',
      kicker: '衣 · 食 · 住 · 行 · 玩',
      author: '旅途顾问',
      you: '你',
      note: '回答由 AI 撰写，出发前请核对价格、营业时间与安全信息。',
      greeting: '「好的旅程，多半从一个具体的问题开始。」',
      brief: '把目的地、天数、预算，还有同行的人和在意的事说给我，我理成一张能照着走的单子。',
      exampleLabel: '试着这样问',
      example: '十一月去京都五天，两个人，预算一万',
      placeholder: '例如：十一月去京都五天，两个人',
      send: '发送',
      sendHint: '回车发送 · Shift 回车换行',
      voiceAsk: '语音提问',
      voiceToggle: '朗读',
      voiceHeard: '正在听…',
      voiceUnsupported: '这个浏览器不支持语音输入，可以继续打字。',
      voiceDenied: '麦克风没有授权，在浏览器里允许后再试一次。',
      voiceRetry: '没听清，再说一次。',
      voiceNetwork: '浏览器的语音服务连不上（Chrome / Edge 要访问 Google），先打字吧。',
      voiceBusy: '语音正在启动，稍等一下再点。',
      voiceReading: '朗读中 · 点按停止',
      stop: '停止',
      stopped: '已停止。',
      thinking: '正在翻资料',
      sources: '参考资料',
      planning: '正在排行程',
      planTitle: '这几天的安排',
      planMeta: '{days} 天 · {places} 个地方',
      planAll: '全部',
      planEat: '吃',
      planDrink: '喝',
      planPlay: '玩',
      planFun: '乐',
      planStay: '住',
      planMove: '行',
      planCoverage: '这一天的六件事',
      planStars: '星级',
      planStarAll: '全部',
      planStarHint: '星级看的是这个地方被多少语言的百科收录，不是点评分。',
      waysTitle: '怎么去 · {place}',
      waysMetro: '地铁路线',
      waysBus: '找公交站',
      waysUber: 'Uber 叫车',
      waysDidi: '滴滴叫车',
      waysGrab: 'Grab 叫车',
      close: '关闭',
      placeLoading: '正在取这个地方的资料…',
      placePhotos: '更多照片',
      placePhotoCredit: '照片来自 Wikimedia Commons，文字来自维基百科（CC BY-SA）。',
      planPartial: '先给你这一版，想更细可以说一声。',
      planDays: ' 天',
      planPlaces: ' 个地点',
      planPhotos: ' 张照片',
      planDay: '第 {n} 天',
      planCredit: '照片来自 Wikidata / Wikimedia Commons，时间与门票请在出发前确认。',
      planIntro: '按你的时间排好了，慢慢走。',
      makeRoute: '整理成路线',
      login: '登录后不限量',
      anon: '未登录每天 8 次。',
      clear: '清空',
      retry: '重试',
      error: '顾问暂时不在线，请稍后再问。',
      offline: '网络似乎断开了，检查连接后再试。',
      quota: '问得有点急，稍等片刻再聊。',
      empty: '先说说要去哪里，我们从这一步开始。',
      noAnswer: '刚才没接上，再说一次试试。',
      retrying: '再试一次',
    },
    en: {
      title: 'Travel Desk',
      kicker: 'wear · eat · stay · move · see',
      author: 'Travel desk',
      you: 'You',
      note: 'Written by AI. Check prices, hours and safety before you travel.',
      greeting: '“A good trip usually starts with a precise question.”',
      brief: 'Tell me where, how long, what budget — and who is coming. I will turn it into a plan you can follow.',
      exampleLabel: 'Try asking',
      example: 'Five days in Kyoto in November, two of us, ¥10,000',
      placeholder: 'e.g. Five days in Kyoto in November',
      send: 'Send',
      sendHint: 'Enter to send · Shift+Enter for a new line',
      voiceAsk: 'Ask by voice',
      voiceToggle: 'Read aloud',
      voiceHeard: 'Listening…',
      voiceUnsupported: 'This browser cannot take voice input; typing still works.',
      voiceDenied: 'Microphone access is blocked. Allow it in the browser and retry.',
      voiceRetry: 'I did not catch that. Try again.',
      voiceNetwork: 'The browser speech service is unreachable here; typing still works.',
      voiceBusy: 'Voice is starting — give it a second.',
      voiceReading: 'Reading aloud · tap to stop',
      stop: 'Stop',
      stopped: 'Stopped.',
      thinking: 'Checking the notes',
      sources: 'Sources',
      planning: 'Laying out the days',
      planTitle: 'These days',
      planMeta: '{days} days · {places} places',
      planAll: 'All',
      planEat: 'Eat',
      planDrink: 'Drink',
      planPlay: 'Play',
      planFun: 'Fun',
      planStay: 'Stay',
      planMove: 'Move',
      planCoverage: 'All six, today',
      planStars: 'Stars',
      planStarAll: 'All',
      planStarHint: 'Stars reflect how widely a place is documented, not review scores.',
      waysTitle: 'Getting to {place}',
      waysMetro: 'Metro route',
      waysBus: 'Nearest bus stop',
      waysUber: 'Call an Uber',
      waysDidi: 'Call a DiDi',
      waysGrab: 'Call a Grab',
      close: 'Close',
      placeLoading: 'Fetching this place…',
      placePhotos: 'More photographs',
      placePhotoCredit: 'Photographs from Wikimedia Commons, text from Wikipedia (CC BY-SA).',
      planPartial: 'A first pass — ask again for more detail.',
      planDays: ' days',
      planPlaces: ' places',
      planPhotos: ' photographs',
      planDay: 'Day {n}',
      planCredit: 'Photographs: Wikidata / Wikimedia Commons. Check times and tickets before you go.',
      planIntro: 'Laid out for the days you have. Take it slowly.',
      makeRoute: 'Turn into a route',
      login: 'Unlimited with an account',
      anon: 'Anonymous: 8 questions a day.',
      clear: 'Clear',
      retry: 'Retry',
      error: 'The desk is offline. Please try again shortly.',
      offline: 'You appear to be offline. Check the connection and retry.',
      quota: 'That was quick. Give it a moment and ask again.',
      empty: 'Start with where you are going and we will take it from there.',
      noAnswer: 'That did not come through. Ask once more.',
      retrying: 'One more try',
    }
  };

  // Reads the language from the i18n module when it is up, and from the stored
  // preference otherwise: the shell can boot this module before i18n finishes.
  function language() {
    var i18n = window.TravelWorldI18n;
    if (i18n && typeof i18n.language === 'function') {
      try { return i18n.language() === 'en' ? 'en' : 'zh'; } catch (_) { /* fall through */ }
    }
    try { return JSON.parse(localStorage.getItem('tw-state') || '{}').lang === 'en' ? 'en' : 'zh'; } catch (_) { return 'zh'; }
  }
  function t() { return language() === 'en' ? COPY.en : COPY.zh; }
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
  var composeBar = null;
  var toolsLeft = null;
  var hintEl = null;
  var signinEl = null;
  var noteEl = null;
  var sendButton = null;
  var stopButton = null;
  var micButton = null;
  var speakButton = null;
  var voiceTurn = false;
  var voiceState = 'idle';
  var planCache = { at: 0, data: null };

  function isPlanRequest(text) {
    const value = String(text || '');
    if (/(?:规划|安排|行程|路线|日程|几天|几日|第\s*[一二三四五六七1-7]\s*天|itinerary|day[- ]by[- ]day|plan\b)/i.test(value)) return true;
    // "大理五天", "去京都3天" — a destination and a length is a plan request, even
    // without the word 安排.
    return /[\u4e00-\u9fa5]{2,8}\s*[一二三四五六七八九十\d]{1,2}\s*天/.test(value);
  }

  function dayLabel(number) {
    return t().planDay.replace('{n}', number);
  }

  // The itinerary table is rendered as cards, so it must not appear twice.
  function withoutPlanSection(text) {
    var lines = String(text || '').split('\n');
    var out = [];
    var skipping = false;
    for (var i = 0; i < lines.length; i += 1) {
      var trimmed = lines[i].trim();
      var heading = /^(#{1,6})\s*(.+)$/.exec(trimmed);
      if (heading && /日程|itinerary|the days/i.test(heading[2])) { skipping = true; continue; }
      if (skipping && heading) skipping = false;
      if (skipping) continue;
      // Every table goes: the itinerary is a card, and a strict grid reads like
      // an exam answer rather than a page from a travel journal.
      if (/^\|.*\|$/.test(trimmed)) continue;
      out.push(lines[i]);
    }
    return out.join('\n').trim();
  }

  // Twelve kinds of model wording collapse into the five things a traveller
  // actually looks for: 吃 · 喝 · 玩 · 乐 · 住.
  function categoryOf(kind) {
    var value = String(kind || '');
    if (/食|吃|餐|面|饭|market|food|eat/i.test(value)) return 'eat';
    if (/喝|饮|咖啡|茶|酒|bar|cafe|drink/i.test(value)) return 'drink';
    if (/住|宿|酒店|hotel|stay|lodg/i.test(value)) return 'stay';
    if (/行|交通|移动|地铁|公交|打车|move|transport|transit/i.test(value)) return 'move';
    if (/乐|购物|演出|夜|酒吧|shop|show|night/i.test(value)) return 'fun';
    return 'play';
  }

  function placeLinks(item, container) {
    (item.links || []).forEach(function (link) {
      if (!link) return;
      if (Array.isArray(link.modes) && link.modes.length) {
        var ways = document.createElement('button');
        ways.type = 'button';
        ways.className = 'ai-chat-place-action';
        ways.textContent = link.label || '怎么去';
        ways.onclick = function (event) { if (event && event.stopPropagation) event.stopPropagation(); openWays(item.place, link.modes); };
        container.append(ways);
        return;
      }
      if (!link.url) return;
      var action = document.createElement('a');
      action.className = 'ai-chat-place-action';
      action.setAttribute('href', link.url);
      action.setAttribute('target', '_blank');
      action.setAttribute('rel', 'noopener noreferrer');
      action.textContent = link.label || link.provider || '·';
      container.append(action);
    });
  }

  // Tapping a stop opens the place itself: a bigger photograph, more of them,
  // a short encyclopaedic note and the same actions as the card.
  function openPlace(item) {
    if (!item) return;
    var overlay = document.createElement('div');
    overlay.className = 'ai-chat-place';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var panel = document.createElement('div');
    panel.className = 'ai-chat-place-panel';

    var hero = document.createElement('div');
    hero.className = 'ai-chat-place-hero';
    if (item.photo && item.photo.url) {
      var heroImage = document.createElement('img');
      heroImage.src = item.photo.url;
      heroImage.alt = item.place;
      heroImage.referrerPolicy = 'no-referrer';
      hero.append(heroImage);
    }
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ai-chat-place-close';
    close.setAttribute('aria-label', t().close);
    close.textContent = '×';
    close.onclick = function () { overlay.remove(); };

    var head = document.createElement('div');
    head.className = 'ai-chat-place-head';
    var title = document.createElement('b');
    title.textContent = item.place;
    var meta = document.createElement('span');
    if (item.stars) meta.append(starsEl(item.stars));
    var metaText = document.createElement('span');
    metaText.textContent = [item.kind, item.time, item.note].filter(Boolean).join(' · ');
    meta.append(metaText);
    head.append(title, meta);

    var body = document.createElement('div');
    body.className = 'ai-chat-place-body';
    var summary = document.createElement('p');
    summary.className = 'ai-chat-place-summary';
    summary.textContent = t().placeLoading;
    var gallery = document.createElement('div');
    gallery.className = 'ai-chat-place-gallery';
    var actions = document.createElement('div');
    actions.className = 'ai-chat-place-actions';
    placeLinks(item, actions);
    var credit = document.createElement('p');
    credit.className = 'ai-chat-place-credit';
    body.append(summary, gallery, actions);

    panel.append(hero, close, head, body);
    overlay.append(panel);
    overlay.onclick = function (event) { if (event.target === overlay) overlay.remove(); };
    document.body.append(overlay);

    var lang = language() === 'en' ? 'en' : 'zh';
    fetch('/api/ai/place?name=' + encodeURIComponent(item.place) + '&lang=' + lang)
      .then(function (response) { return response && response.ok && response.json ? response.json() : null; })
      .then(function (info) {
        if (!info) return;
        if (info.summary && info.summary.text) summary.textContent = info.summary.text;
        else if (info.description) summary.textContent = info.description;
        else summary.textContent = '';
        var photos = (info.photos || []).filter(function (photo) { return photo && photo.url && (!item.photo || photo.url !== item.photo.url); });
        photos.slice(0, 4).forEach(function (photo) {
          var image = document.createElement('img');
          image.src = photo.url;
          image.alt = info.name || item.place;
          image.loading = 'lazy';
          image.referrerPolicy = 'no-referrer';
          image.onerror = (function (element) {
            return function () { if (element.parentNode) element.parentNode.removeChild(element); };
          }(image));
          gallery.append(image);
        });
        gallery.hidden = !gallery.children.length;
        if (info.summary || info.photos && info.photos.length) body.append(credit);
        credit.textContent = t().placePhotoCredit;
      })
      .catch(function () { summary.textContent = ''; });
    return overlay;
  }

  function openWays(place, modes) {
    var overlay = document.createElement('div');
    overlay.className = 'ai-chat-modes';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var panel = document.createElement('div');
    panel.className = 'ai-chat-modes-panel';

    var head = document.createElement('header');
    var title = document.createElement('b');
    title.textContent = t().waysTitle.replace('{place}', place);
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ai-chat-modes-close';
    close.setAttribute('aria-label', t().close);
    close.textContent = '×';
    close.onclick = function () { overlay.remove(); };
    head.append(title, close);

    var list = document.createElement('div');
    list.className = 'ai-chat-modes-list';
    modes.forEach(function (mode) {
      var row = document.createElement('a');
      row.className = 'ai-chat-mode';
      row.setAttribute('href', mode.url);
      row.setAttribute('target', '_blank');
      row.setAttribute('rel', 'noopener noreferrer');
      var name = document.createElement('b');
      name.textContent = mode.label;
      var hint = document.createElement('small');
      hint.textContent = mode.mode === 'metro' ? t().waysMetro
        : mode.mode === 'bus' ? t().waysBus
        : mode.mode === 'didi' ? t().waysDidi
        : mode.mode === 'grab' ? t().waysGrab : t().waysUber;
      row.append(name, hint);
      list.append(row);
    });

    panel.append(head, list);
    overlay.append(panel);
    overlay.onclick = function (event) { if (event.target === overlay) overlay.remove(); };
    document.body.append(overlay);
    return overlay;
  }

  function starsEl(count) {
    var wrap = document.createElement('span');
    wrap.className = 'ai-chat-stars';
    for (var i = 1; i <= 5; i += 1) {
      var star = document.createElement('i');
      star.className = 'ai-star' + (i <= count ? ' is-on' : '');
      wrap.append(star);
    }
    return wrap;
  }

  function applyPlanFilters(card) {
    var kind = card.getAttribute('data-filter') || 'all';
    var min = Number(card.getAttribute('data-stars') || 0);
    Array.prototype.forEach.call(card.querySelectorAll('.ai-chat-plan-day'), function (block) {
      var visible = 0;
      Array.prototype.forEach.call(block.querySelectorAll('.ai-chat-plan-item'), function (stop) {
        var kindOk = kind === 'all' || stop.getAttribute('data-kind') === kind;
        var starsOk = !min || Number(stop.getAttribute('data-stars') || 0) >= min;
        stop.hidden = !(kindOk && starsOk);
        if (!stop.hidden) visible += 1;
      });
      block.hidden = visible === 0;
    });
  }

  function planCard(plan) {
    var card = document.createElement('section');
    card.className = 'ai-chat-plan';
    card.setAttribute('data-filter', 'all');

    var coverPhoto = null;
    var reversed = plan.days.slice().reverse();
    reversed.forEach(function (day) {
      if (coverPhoto) return;
      day.items.forEach(function (item) { if (!coverPhoto && item.photo && item.photo.url) coverPhoto = item.photo; });
    });
    if (coverPhoto) {
      var cover = document.createElement('header');
      cover.className = 'ai-chat-plan-cover';
      var coverImage = document.createElement('img');
      coverImage.src = coverPhoto.url;
      coverImage.alt = '';
      coverImage.loading = 'lazy';
      coverImage.referrerPolicy = 'no-referrer';
      coverImage.onerror = function () {
        coverImage.style.display = 'none';
        cover.className = 'ai-chat-plan-cover is-empty';
      };
      var coverText = document.createElement('div');
      coverText.className = 'ai-chat-plan-covertext';
      var coverTitle = document.createElement('b');
      coverTitle.textContent = t().planTitle;
      var coverMeta = document.createElement('span');
      coverMeta.textContent = t().planMeta.replace('{days}', plan.days.length).replace('{places}', plan.places);
      coverText.append(coverTitle, coverMeta);
      cover.append(coverImage, coverText);
      card.append(cover);
    } else {
      var head = document.createElement('header');
      head.className = 'ai-chat-plan-head';
      var title = document.createElement('b');
      title.textContent = t().planTitle;
      var meta = document.createElement('span');
      meta.textContent = t().planMeta.replace('{days}', plan.days.length).replace('{places}', plan.places);
      head.append(title, meta);
      card.append(head);
    }

    // Category index with live counts, so one tap narrows the whole plan.
    var counts = { all: 0, eat: 0, drink: 0, play: 0, fun: 0, stay: 0, move: 0 };
    plan.days.forEach(function (day) {
      day.items.forEach(function (item) {
        counts.all += 1;
        counts[categoryOf(item.kind)] += 1;
      });
    });
    var filters = document.createElement('nav');
    filters.className = 'ai-chat-plan-filters';
    filters.setAttribute('aria-label', t().planTitle);
    [['all', t().planAll], ['eat', t().planEat], ['drink', t().planDrink], ['play', t().planPlay], ['fun', t().planFun], ['stay', t().planStay], ['move', t().planMove]]
      .forEach(function (pair) {
        if (pair[0] !== 'all' && !counts[pair[0]]) return;
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ai-chat-plan-filter' + (pair[0] === 'all' ? ' is-on' : '');
        chip.setAttribute('data-kind', pair[0]);
        chip.textContent = pair[0] === 'all' ? pair[1] : pair[1] + ' ' + counts[pair[0]];
        chip.onclick = function () {
          card.setAttribute('data-filter', pair[0]);
          Array.prototype.forEach.call(filters.children, function (node) {
            node.className = 'ai-chat-plan-filter' + (node === chip ? ' is-on' : '');
          });
          applyPlanFilters(card);
        };
        filters.append(chip);
      });
    card.append(filters);

    var starBar = document.createElement('div');
    starBar.className = 'ai-chat-plan-stars';
    var starLabel = document.createElement('span');
    starLabel.className = 'ai-chat-plan-stars-label';
    starLabel.textContent = t().planStars;
    starBar.append(starLabel);
    [['0', t().planStarAll], ['3', '3★+'], ['4', '4★+'], ['5', '5★']].forEach(function (pair) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-chat-plan-star' + (pair[0] === '0' ? ' is-on' : '');
      button.setAttribute('data-min', pair[0]);
      button.setAttribute('title', t().planStarHint);
      button.textContent = pair[1];
      button.onclick = function () {
        card.setAttribute('data-stars', pair[0]);
        Array.prototype.forEach.call(starBar.children, function (node) {
          if (node.className.indexOf('ai-chat-plan-star') === 0) node.className = node === button ? 'ai-chat-plan-star is-on' : 'ai-chat-plan-star';
        });
        applyPlanFilters(card);
      };
      starBar.append(button);
    });
    card.append(starBar);

    plan.days.forEach(function (day) {
      var block = document.createElement('div');
      block.className = 'ai-chat-plan-day';
      var dayHead = document.createElement('div');
      dayHead.className = 'ai-chat-plan-dayhead';
      var number = document.createElement('b');
      number.textContent = dayLabel(day.day);
      var dots = document.createElement('span');
      dots.className = 'ai-chat-plan-dots';
      dots.setAttribute('aria-label', t().planCoverage);
      var present = {};
      day.items.forEach(function (item) { present[categoryOf(item.kind)] = true; });
      [['eat', t().planEat], ['drink', t().planDrink], ['play', t().planPlay], ['fun', t().planFun], ['stay', t().planStay], ['move', t().planMove]]
        .forEach(function (pair) {
          var dot = document.createElement('i');
          dot.className = 'ai-chat-plan-dot' + (present[pair[0]] ? ' is-on' : '');
          dot.setAttribute('title', pair[1]);
          dot.textContent = pair[1];
          dots.append(dot);
        });
      var count = document.createElement('span');
      count.textContent = day.items.length + t().planPlaces;
      dayHead.append(number, dots, count);
      block.append(dayHead);

      var strip = document.createElement('div');
      var galleryEl = strip;
      strip.className = 'ai-chat-plan-strip';
      day.items.forEach(function (item) {
        var stop = document.createElement('article');
        stop.className = 'ai-chat-plan-item';
        stop.setAttribute('data-kind', categoryOf(item.kind));
        if (item.stars) stop.setAttribute('data-stars', item.stars);
        stop.onclick = (function (current) {
          return function () { openPlace(current); };
        }(item));
        if (item.photo && item.photo.url) {
          var img = document.createElement('img');
          img.className = 'ai-chat-plan-photo';
          img.src = item.photo.url;
          img.alt = item.place;
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          img.onerror = (function (element) {
            return function () {
              var fallback = document.createElement('span');
              fallback.className = 'ai-chat-plan-photo is-blank';
              fallback.textContent = element.getAttribute('alt') || '·';
              if (element.parentNode) element.parentNode.replaceChild(fallback, element);
            };
          }(img));
          stop.append(img);
        } else {
          var kind = document.createElement('span');
          kind.className = 'ai-chat-plan-photo is-blank';
          kind.textContent = item.kind || '·';
          stop.append(kind);
        }
        var body = document.createElement('div');
        body.className = 'ai-chat-plan-body';
        var time = document.createElement('span');
        time.className = 'ai-chat-plan-time';
        time.textContent = String(item.time || '').replace(/\s*[-–—~]\s*/g, '–');
        var name = document.createElement('b');
        name.textContent = item.place;
        body.append(time, name);
        if (item.stars) {
          var badge = starsEl(item.stars);
          badge.className = 'ai-chat-stars ai-chat-plan-stars-badge';
          stop.append(badge);
        }
        if (item.price) {
          var price = document.createElement('span');
          price.className = 'ai-chat-plan-price';
          price.textContent = item.price + ' / 晚';
          body.append(price);
        }
        if (item.note) {
          var note = document.createElement('small');
          note.textContent = item.note;
          body.append(note);
        }
        if (Array.isArray(item.links) && item.links.length) {
          var links = document.createElement('span');
          links.className = 'ai-chat-plan-links';
          item.links.slice(0, 2).forEach(function (link) {
            if (!link) return;
            if (Array.isArray(link.modes) && link.modes.length) {
              var ways = document.createElement('button');
              ways.type = 'button';
              ways.className = 'ai-chat-plan-way';
              ways.textContent = link.label || '怎么去';
              ways.onclick = function (event) {
                if (event && event.stopPropagation) event.stopPropagation();
                if (event && event.preventDefault) event.preventDefault();
                openWays(item.place, link.modes);
              };
              links.append(ways);
              return;
            }
            if (!link.url) return;
            var action = document.createElement('a');
            action.setAttribute('href', link.url);
            action.setAttribute('target', '_blank');
            action.setAttribute('rel', 'noopener noreferrer');
            action.textContent = link.label || link.provider || '·';
            action.onclick = function (event) { if (event && event.stopPropagation) event.stopPropagation(); };
            links.append(action);
          });
          if (links.children.length) body.append(links);
        }
        stop.append(body);
        strip.append(stop);
      });
      block.append(strip);
      card.append(block);
    });

    if (plan.partial) {
      var partial = document.createElement('p');
      partial.className = 'ai-chat-plan-partial';
      partial.textContent = t().planPartial;
      card.append(partial);
    }
    if (plan.photos) {
      var credit = document.createElement('footer');
      credit.className = 'ai-chat-plan-credit';
      credit.textContent = t().planCredit;
      card.append(credit);
    }
    return card;
  }

  function voice() { return window.TravelWorldVoice; }
  function voiceLang() { return language() === 'en' ? 'en-US' : 'zh-CN'; }
  function autoSpeak() { try { return localStorage.getItem('tw-ai-voice') === 'on'; } catch (_) { return false; } }
  function setAutoSpeak(on) { try { localStorage.setItem('tw-ai-voice', on ? 'on' : 'off'); } catch (_) {} }

  // Speech state is mirrored on the two buttons instead of a separate banner, so
  // a glance at the composer tells you whether the desk is listening or reading.
  function setVoiceState(next) {
    voiceState = next;
    if (micButton) {
      micButton.className = 'ai-chat-mic' + (next === 'listening' ? ' is-listening' : '');
      micButton.setAttribute('aria-pressed', next === 'listening' ? 'true' : 'false');
      micButton.disabled = next === 'listening' ? false : Boolean(streaming);
    }
    if (speakButton) {
      speakButton.className = 'ai-chat-speak' + (next === 'speaking' ? ' is-speaking' : '');
    }
  }

  function stopSpeech() {
    var V = voice();
    if (V && V.ttsSupported()) V.stopSpeaking();
    if (voiceState === 'speaking') { setVoiceState('idle'); setStatus(''); }
  }

  function speakAnswer(text) {
    var V = voice();
    if (!V || !V.ttsSupported() || !text) return;
    if (!V.speak(text, voiceLang())) return;
    setVoiceState('speaking');
    setStatus(t().voiceReading);
    if (typeof setInterval !== 'function') return;
    var timer = setInterval(function () {
      if (voice() && voice().speaking()) return;
      clearInterval(timer);
      if (voiceState === 'speaking') { setVoiceState('idle'); setStatus(''); }
    }, 500);
  }

  function startVoice() {
    var V = voice();
    if (streaming) return;
    if (!V || !V.sttSupported()) { setStatus(t().voiceUnsupported); return; }
    if (voiceState === 'speaking') stopSpeech();
    V.stopListening();
    setVoiceState('listening');
    setStatus(t().voiceHeard);
    V.listen({
      lang: voiceLang(),
      onInterim: function (text) {
        if (!input) return;
        input.value = text;
        autoGrow();
      },
      onError: function (code) {
        setVoiceState('idle');
        var blocked = code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture';
        var offline = code === 'network' || code === 'language-not-supported';
        setStatus(code === 'unsupported' ? t().voiceUnsupported
          : blocked ? t().voiceDenied
          : offline ? t().voiceNetwork
          : t().voiceRetry);
      },
      onStart: function () { setStatus(t().voiceHeard); },
      onEnd: function (text) {
        if (voiceState === 'listening') setVoiceState('idle');
        if (!text) {
          if (status && status.textContent === t().voiceHeard) setStatus('');
          return;
        }
        voiceTurn = true;
        if (input) input.value = text;
        send();
      }
    });
  }

  // ---------------------------------------------------------- travel plans --
  // Everything the traveller has saved: itineraries (routes.days carry the
  // 衣·食·住·行·玩 plan) and their open trip posts. The desk reads this so "我的
  // 行程" questions are answered from real data rather than invention.
  function textList(value, limit) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, limit).map(function (item) {
      if (typeof item === 'string') return item.slice(0, 80);
      if (!item) return '';
      return String(item.name || item.title || item.text || item.label || '').slice(0, 80);
    }).filter(Boolean);
  }

  function compactPlans(routes, trips, ownerId) {
    var out = { routes: [], trips: [] };
    (Array.isArray(routes) ? routes : []).slice(0, 8).forEach(function (route) {
      if (!route) return;
      var days = (Array.isArray(route.days) ? route.days : []).slice(0, 10).map(function (day, index) {
        if (!day) return null;
        var entry = { day: Number(day.day) || index + 1 };
        var places = textList(day.places, 8);
        if (places.length) entry.places = places;
        ['outfit', 'food', 'stay', 'move', 'play'].forEach(function (key) {
          var items = textList(day[key], 6);
          if (items.length) entry[key] = items;
        });
        return entry;
      }).filter(Boolean);
      out.routes.push({
        title: String(route.title || '').slice(0, 80),
        destination: String(route.destination || '').slice(0, 60),
        days: days
      });
    });
    (Array.isArray(trips) ? trips : []).forEach(function (trip) {
      if (!trip || !ownerId || trip.owner_id !== ownerId) return;
      out.trips.push({
        title: String(trip.title || '').slice(0, 80),
        destination: String(trip.destination || '').slice(0, 60),
        from: trip.start_date || null,
        to: trip.end_date || null
      });
    });
    out.trips = out.trips.slice(0, 5);
    // Hard ceiling: a very detailed itinerary must not turn into a 2 MB request.
    while (out.routes.length && JSON.stringify(out).length > 12000) out.routes.pop();
    while (out.trips.length && JSON.stringify(out).length > 12000) out.trips.pop();
    return out.routes.length || out.trips.length ? out : null;
  }

  function loadPlans() {
    var A = auth();
    var session = A && A.session && A.session();
    if (!session || !session.access_token) return Promise.resolve(null);
    if (planCache.data && Date.now() - planCache.at < 5 * 60 * 1000) return Promise.resolve(planCache.data);
    var headers = { Authorization: 'Bearer ' + session.access_token };
    var mine = fetch('/api/community/me/routes', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
    var trips = fetch('/api/trips')
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
    return Promise.all([mine, trips]).then(function (results) {
      var data = compactPlans(results[0], results[1], session.user && session.user.id);
      planCache = { at: Date.now(), data: data };
      return data;
    });
  }

  // Never hold the question hostage to a slow plan lookup.
  function plansWithin(ms) {
    return Promise.race([
      loadPlans().catch(function () { return null; }),
      new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); })
    ]);
  }

  function load() {
    try { var saved = JSON.parse(localStorage.getItem(STORE) || '[]'); turns = Array.isArray(saved) ? saved.slice(-MAX_TURNS) : []; }
    catch (_) { turns = []; }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(turns.slice(-MAX_TURNS))); } catch (_) {} }

  // ---------------------------------------------------------------- markdown
  // Escapes first, then recognises the small subset the model is asked to use.
  function inline(text) {
    return text
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }

  // Turns the answer into block-level markup. A plain newline becomes a line
  // break inside the current paragraph; blank lines, headings, lists, quotes and
  // pipe tables start a new block. Never emits model-supplied tags.
  function format(text) {
    var source = esc(text == null ? '' : text).replace(/\r\n?/g, '\n');
    if (!source.trim()) return '<p></p>';

    var lines = source.split('\n');
    var html = [];
    var para = [];
    var quote = [];
    var listKind = null;
    var lastOrdered = false;
    var table = [];

    function push(block) { html.push(block); }
    function closeList() { if (listKind) { push('</' + listKind + '>'); listKind = null; } }
    function flushQuote() { if (quote.length) { push('<blockquote><p>' + quote.join('<br>') + '</p></blockquote>'); quote = []; } }
    function flushPara() { if (para.length) { push('<p>' + para.join('<br>') + '</p>'); para = []; } }
    function flushTable() {
      if (!table.length) return;
      var head = table[0];
      var rows = table.slice(1);
      var out = '<table><thead><tr>';
      head.forEach(function (cell) { out += '<th>' + cell + '</th>'; });
      out += '</tr></thead>';
      if (rows.length) {
        out += '<tbody>';
        rows.forEach(function (row) {
          out += '<tr>';
          row.forEach(function (cell) { out += '<td>' + cell + '</td>'; });
          out += '</tr>';
        });
        out += '</tbody>';
      }
      push(out + '</table>');
      table = [];
    }
    function flushAll() { flushPara(); flushQuote(); closeList(); flushTable(); }

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      if (!line) { flushAll(); continue; }
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) { flushAll(); push('<hr>'); continue; }

      if (/^\|.*\|$/.test(line)) {
        // The |---|---| separator only says "the row above is a header".
        if (/^\|[\s:|-]+\|$/.test(line)) continue;
        flushPara(); flushQuote(); closeList();
        table.push(line.slice(1, -1).split('|').map(function (cell) { return inline(cell.trim()); }));
        continue;
      }
      if (table.length) flushTable();

      var heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushAll();
        var content = inline(heading[2]);
        push(heading[1].length <= 2 ? '<h3>' + content + '</h3>' : '<h4>' + content + '</h4>');
        continue;
      }
      if (/^&gt;\s?/.test(line)) {
        flushPara(); closeList(); flushTable();
        quote.push(inline(line.replace(/^&gt;\s?/, '')));
        continue;
      }
      if (quote.length) flushQuote();

      var bullet = line.match(/^[-*•]\s+(.+)$/);
      var ordered = line.match(/^\d+[.)、]\s+(.+)$/);
      // Models often write a numbered pick followed by a bulleted detail line.
      // Read that as one entry: the bullet becomes a detail line inside the
      // numbered item, so the picks keep counting 01, 02, 03 instead of
      // restarting at 01 for every detail.
      if (bullet && listKind === 'ol' && lastOrdered) {
        var at = html.length - 1;
        html[at] = html[at].replace(/<\/li>$/, '<span class="ai-chat-detail">' + inline(bullet[1]) + '</span></li>');
        continue;
      }
      if (bullet || ordered) {
        flushPara(); flushQuote(); flushTable();
        var kind = bullet ? 'ul' : 'ol';
        if (listKind !== kind) { closeList(); push('<' + kind + '>'); listKind = kind; }
        push('<li>' + inline(bullet ? bullet[1] : ordered[1]) + '</li>');
        lastOrdered = Boolean(ordered);
        continue;
      }
      lastOrdered = false;
      if (listKind) closeList();
      para.push(inline(line));
    }
    flushAll();
    return html.join('');
  }

  // ------------------------------------------------------------------ bubbles
  function linkReference(url, index) {
    var link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = url;
    var ref = document.createElement('span');
    ref.className = 'ai-chat-ref';
    ref.textContent = REFS[index] || '·';
    link.append(ref, document.createTextNode(String(url).replace(/^https?:\/\//, '').split('/')[0]));
    return link;
  }

  function bubble(role, text, options) {
    options = options || {};
    var el = document.createElement('div');
    // Stored turns use "assistant"; live bubbles use "ai". Both are the desk.
    var isUser = role === 'user' || role === 'me';
    el.className = 'bubble ' + (isUser ? 'me' : 'ai');
    if (isUser) { el.textContent = text; return el; }

    var author = document.createElement('div');
    author.className = 'ai-chat-author';
    var dot = document.createElement('span');
    dot.className = 'ai-chat-dot';
    author.append(dot, document.createTextNode(t().author));

    var body = document.createElement('div');
    body.className = 'ai-chat-body';
    var galleryEl = null;
    if (Array.isArray(options.gallery) && options.gallery.length && !options.plan) {
      var strip = document.createElement('div');
      strip.className = 'ai-chat-gallery';
      options.gallery.forEach(function (photo) {
        if (!photo || !photo.url) return;
        var card = document.createElement('figure');
        var image = document.createElement('img');
        image.src = photo.url;
        image.alt = photo.name || '';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        image.onerror = function (event) {
          var node = event && event.target;
          if (node && node.parentNode && node.parentNode.parentNode) node.parentNode.parentNode.removeChild(node.parentNode);
        };
        var caption = document.createElement('figcaption');
        caption.textContent = photo.name || '';
        if (photo.stars) caption.appendChild(starsEl(photo.stars));
        card.append(image, caption);
        strip.append(card);
      });
    }
    if (options.plan) {
      text = withoutPlanSection(text);
      if (!text) text = t().planIntro;
    }
    if (options.typing) {
      body.innerHTML = '<span class="ai-chat-typing"><i></i><i></i><i></i></span>';
    } else {
      body.innerHTML = format(text);
      if (galleryEl) body.append(galleryEl);
      // A one-sentence opening reads as the lede of a page, not as body copy.
      var first = body.children && body.children[0];
      if (first && String(first.tagName || '').toUpperCase() === 'P') first.className = 'ai-chat-lede';
    }
    el.append(author, body);
    if (options.plan) el.append(planCard(options.plan));

    if (options.sources && options.sources.length) {
      var box = document.createElement('div');
      box.className = 'ai-chat-sources';
      var label = document.createElement('b');
      label.textContent = t().sources;
      box.append(label);
      options.sources.slice(0, 4).forEach(function (url, index) { box.append(linkReference(url, index)); });
      el.append(box);
    }
    return el;
  }

  // Every turn gets a small byline, so the transcript reads like a page with
  // two authors rather than a stack of anonymous bubbles.
  function byline(text, side) {
    var el = document.createElement('div');
    el.className = 'ai-chat-turn-meta' + (side === 'me' ? ' is-me' : '');
    el.textContent = text;
    return el;
  }

  function userTurn(text) {
    var wrap = document.createElement('div');
    wrap.className = 'ai-chat-turn is-me';
    wrap.append(byline(t().you, 'me'), bubble('user', text));
    return wrap;
  }

  function scrollToEnd() {
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }

  function setStatus(text) { if (status) status.textContent = text || ''; }

  // --------------------------------------------------------------------- ask
  async function ask(question, bubbleEl) {
    var A = auth();
    var headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
    if (A && A.session() && A.session().access_token) headers.Authorization = 'Bearer ' + A.session().access_token;
    var history = turns.slice(-MAX_HISTORY).map(function (turn) { return { role: turn.role, content: turn.content }; });
    var plans = await plansWithin(1500);
    var planMode = isPlanRequest(question);
    streaming = { aborted: false, text: '', body: bubbleEl.querySelector('.ai-chat-body') };
    if (composeBar) composeBar.className = 'ai-chat-compose is-busy';

    var answer = '';
    var sources = [];
    var plan = null;
    var gallery = [];
    var frame = 0;
    function paint() {
      frame = 0;
      if (!streaming || !streaming.body) return;
      streaming.body.innerHTML = format(streaming.text || answer);
      scrollToEnd();
    }
    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(paint);
    }

    try {
      var response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: headers,
        signal: AbortSignal.timeout ? AbortSignal.timeout(90000) : undefined,
        body: JSON.stringify({ message: question, history: history, language: language(), plans: plans, mode: planMode ? 'plan' : 'chat', stream: true })
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
          var raw = buffer.slice(0, split).trim();
          buffer = buffer.slice(split + 2);
          split = buffer.indexOf('\n\n');
          var event = 'message', data = '';
          raw.split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) event = line.slice(6).trim();
            if (line.indexOf('data:') === 0) data += line.slice(5).trim();
          });
          if (!data) continue;
          var payload = {};
          try { payload = JSON.parse(data); } catch (_) { continue; }
          if (event === 'meta') sources = payload.sources || [];
          if (event === 'delta' && payload.text) {
            answer += payload.text;
            if (streaming) { streaming.text = answer; schedule(); }
          }
          if (event === 'done') {
            if (payload.answer) answer = payload.answer;
            if (payload.plan) plan = payload.plan;
            if (Array.isArray(payload.gallery)) gallery = payload.gallery;
            if (Array.isArray(payload.gallery)) gallery = payload.gallery;
          }
        }
      }

      if (!answer.trim()) {
        if (streaming && streaming.aborted) {
          if (streaming.body) streaming.body.innerHTML = '<p class="muted">' + esc(t().stopped) + '</p>';
          return;
        }
        // The stream can come back empty on a flaky upstream; one plain request
        // costs little and usually returns the same answer.
        try {
          if (streaming && streaming.body) streaming.body.innerHTML = '<p class="muted">' + esc(t().retrying) + '…</p>';
          const again = await fetch('/api/ai/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ message: question, history: history, language: language(), plans: plans, mode: planMode ? 'plan' : 'chat', stream: false })
          });
          if (again && again.ok && again.json) {
            const data = await again.json();
            if (data && data.answer) {
              answer = data.answer;
              if (data.plan) plan = data.plan;
            }
          }
        } catch (_) { /* fall through to the honest message */ }
        if (!answer.trim()) throw new Error(t().noAnswer);
      }
    } catch (error) {
      var text = error && error.name === 'AbortError' ? t().offline : (error && error.message ? error.message : t().error);
      if (streaming && streaming.body) streaming.body.innerHTML = '<div class="ai-chat-error">' + esc(text) + '</div>';
      setStatus('');
      turns.push({ role: 'assistant', content: text });
      save();
      if (stopButton) stopButton.hidden = true;
      return;
    } finally {
      streaming = null;
      if (composeBar) composeBar.className = 'ai-chat-compose';
    }

    // Swap the live bubble for the final one so it carries sources, the route
    // action and the editorial spacing of a finished answer.
    var finalEl = bubble('ai', answer, { sources: sources, plan: plan, gallery: gallery });
    bubbleEl.replaceWith(finalEl);
    turns.push({ role: 'assistant', content: answer, plan: plan });
    save();
    setStatus('');
    if (stopButton) stopButton.hidden = true;
    scrollToEnd();
    if (voiceTurn || autoSpeak()) speakAnswer(answer);
    voiceTurn = false;
  }

  // ------------------------------------------------------------------ render
  function exampleCard() {
    var copy = t();
    var hello = document.createElement('div');
    hello.className = 'ai-chat-hello';
    var quote = document.createElement('p');
    quote.className = 'ai-chat-quote';
    quote.textContent = copy.greeting;
    var brief = document.createElement('p');
    brief.className = 'ai-chat-brief';
    brief.textContent = copy.brief;
    var example = document.createElement('button');
    example.type = 'button';
    example.className = 'ai-chat-example';
    var tag = document.createElement('span');
    tag.textContent = copy.exampleLabel;
    var ask = document.createElement('b');
    ask.textContent = copy.example;
    example.append(tag, ask);
    example.onclick = function () {
      if (!input) return;
      input.value = copy.example;
      autoGrow();
      input.focus();
    };
    hello.append(quote, brief, example);
    return hello;
  }

  function signedIn() {
    var A = auth();
    return Boolean(A && A.session && A.session());
  }

  // Anonymous visitors get a quiet invitation in the composer instead of a
  // banner above the conversation.
  function syncSignin() {
    if (!toolsLeft) return;
    if (signedIn()) {
      if (signinEl) { signinEl.remove(); signinEl = null; }
      if (hintEl) hintEl.hidden = false;
      return;
    }
    if (hintEl) hintEl.hidden = true;
    if (signinEl) return;
    signinEl = document.createElement('div');
    signinEl.className = 'ai-chat-signin';
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = t().login;
    button.setAttribute('title', t().anon);
    button.onclick = function () { var a = auth(); if (a && a.showLogin) a.showLogin(); };
    signinEl.append(button);
    toolsLeft.append(signinEl);
  }

  function noteText() {
    var copy = t();
    return signedIn() ? copy.note : copy.note + ' · ' + copy.anon;
  }

  // The editorial intro belongs to the first visit; once the conversation has
  // started the desk takes the screen and the composer stays reachable.
  function setChatting(on) {
    if (!root) return;
    if (root.classList && root.classList.toggle) { root.classList.toggle('is-chatting', on); return; }
    var parts = String(root.className || '').split(/\s+/).filter(Boolean);
    var at = parts.indexOf('is-chatting');
    if (on && at < 0) parts.push('is-chatting');
    if (!on && at >= 0) parts.splice(at, 1);
    root.className = parts.join(' ');
  }

  function render() {
    if (!list) return;
    setChatting(turns.length > 0);
    list.innerHTML = '';
    if (!turns.length) list.append(exampleCard());
    turns.forEach(function (turn) {
      if (turn.role === 'user') list.append(userTurn(turn.content));
      else list.append(bubble(turn.role, turn.content, { makeRoute: true }));
    });
    scrollToEnd();
  }

  function renderPrompts() {
    var rail = document.getElementById('aiChatPrompts');
    if (!rail) return;
    rail.innerHTML = '';
    var copy = t();
    PROMPTS.forEach(function (prompt) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-chat-prompt';
      var glyph = document.createElement('b');
      glyph.textContent = prompt.icon;
      var label = document.createElement('span');
      label.textContent = copy === COPY.en ? prompt.en : prompt.zh;
      chip.append(glyph, label);
      chip.onclick = function () {
        if (!input) return;
        input.value = (copy === COPY.en ? prompt.en : prompt.zh);
        autoGrow();
        input.focus();
      };
      rail.append(chip);
    });
  }

  function autoGrow() {
    if (!input) return;
    input.style.height = 'auto';
    var height = input.scrollHeight;
    if (!height) return;
    input.style.height = Math.min(height, 140) + 'px';
  }

  function send() {
    var question = input ? input.value.trim() : '';
    if (!question || streaming) return;
    stopSpeech();
    input.value = '';
    autoGrow();
    turns.push({ role: 'user', content: question });
    save();
    // Drop the first-visit card without rebuilding the transcript, so earlier
    // answers keep their sources and route buttons.
    var card = list.querySelector('.ai-chat-hello');
    if (card) card.remove();
    setChatting(true);
    list.append(userTurn(question));
    var pending = bubble('ai', '', { typing: true });
    list.append(pending);
    setStatus(isPlanRequest(question) ? t().planning : t().thinking);
    if (stopButton) stopButton.hidden = false;
    if (micButton) micButton.disabled = true;
    if (voiceState === 'listening') setVoiceState('idle');
    scrollToEnd();
    ask(question, pending);
  }

  function stop() {
    if (streaming) { streaming.aborted = true; setStatus(''); }
  }

  function clearChat() {
    if (streaming) return;
    stopSpeech();
    var V = voice();
    if (V) V.stopListening();
    turns = [];
    save();
    render();
  }

  // ------------------------------------------------------------------- build
  function build() {
    var section = document.getElementById('ai');
    if (!section) return;
    // Keep the static intro (title/sub copy) that index.html ships for SEO and
    // no-JS visitors; the chat panel is appended underneath it.
    section.className = 'screen ai-chat-screen';
    if (document.getElementById('aiChatPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'aiChatPanel';
    panel.className = 'ai-chat-panel';

    var masthead = document.createElement('div');
    masthead.className = 'ai-chat-masthead';
    var seal = document.createElement('div');
    seal.className = 'ai-chat-seal';
    seal.setAttribute('aria-hidden', 'true');
    seal.textContent = '路';
    var identity = document.createElement('div');
    identity.className = 'ai-chat-identity';
    var label = document.createElement('b');
    label.className = 'ai-chat-label';
    label.textContent = t().title;
    var kicker = document.createElement('small');
    kicker.className = 'ai-chat-kicker';
    kicker.textContent = t().kicker;
    identity.append(label, kicker);
    speakButton = document.createElement('button');
    speakButton.type = 'button';
    speakButton.className = 'ai-chat-speak';
    speakButton.textContent = t().voiceToggle;
    speakButton.setAttribute('aria-pressed', autoSpeak() ? 'true' : 'false');
    speakButton.onclick = function () {
      if (voiceState === 'speaking') { stopSpeech(); return; }
      var on = speakButton.getAttribute('aria-pressed') !== 'true';
      setAutoSpeak(on);
      speakButton.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (!on) stopSpeech();
    };
    var clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'ai-chat-clear';
    clearButton.textContent = t().clear;
    clearButton.onclick = clearChat;
    masthead.append(seal, identity, speakButton, clearButton);

    list = document.createElement('div');
    list.className = 'ai-chat-list';
    list.setAttribute('aria-live', 'polite');

    var prompts = document.createElement('div');
    prompts.id = 'aiChatPrompts';
    prompts.className = 'ai-chat-prompts';
    prompts.setAttribute('role', 'group');

    noteEl = document.createElement('p');
    noteEl.className = 'ai-chat-note';
    noteEl.textContent = noteText();

    var bar = document.createElement('form');
    bar.className = 'ai-chat-compose';
    input = document.createElement('textarea');
    input.className = 'ai-chat-input';
    input.rows = 1;
    input.maxLength = 2000;
    input.placeholder = t().placeholder;
    input.setAttribute('aria-label', t().placeholder);

    var tools = document.createElement('div');
    tools.className = 'ai-chat-tools';
    toolsLeft = document.createElement('div');
    toolsLeft.className = 'ai-chat-tools-left';
    hintEl = document.createElement('small');
    hintEl.className = 'ai-chat-hint';
    hintEl.textContent = t().sendHint;
    toolsLeft.append(hintEl);
    status = document.createElement('small');
    status.className = 'ai-chat-status';
    status.setAttribute('role', 'status');
    var buttons = document.createElement('div');
    buttons.className = 'ai-chat-buttons';
    stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.className = 'ai-chat-stop';
    stopButton.textContent = t().stop;
    stopButton.hidden = true;
    stopButton.onclick = function (event) { event.preventDefault(); stop(); };
    sendButton = document.createElement('button');
    sendButton.type = 'submit';
    sendButton.className = 'ai-chat-send';
    sendButton.textContent = '→';
    sendButton.setAttribute('aria-label', t().send);
    micButton = document.createElement('button');
    micButton.type = 'button';
    micButton.className = 'ai-chat-mic';
    micButton.setAttribute('aria-label', t().voiceAsk);
    micButton.setAttribute('aria-pressed', 'false');
    micButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>';
    micButton.onclick = function (event) {
      event.preventDefault();
      if (voiceState === 'listening') {
        var V = voice();
        if (V) V.stopListening();
        setVoiceState('idle');
        setStatus('');
        return;
      }
      startVoice();
    };
    buttons.append(micButton, stopButton, sendButton);
    tools.append(toolsLeft, status, buttons);
    bar.append(input, tools);
    bar.onsubmit = function (event) { event.preventDefault(); send(); };
    composeBar = bar;

    input.addEventListener('input', function () {
      autoGrow();
      if (stopButton) stopButton.hidden = !streaming;
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
    });

    var capabilities = voice();
    if (!capabilities || !capabilities.sttSupported()) micButton.hidden = true;
    if (!capabilities || !capabilities.ttsSupported()) speakButton.hidden = true;

    panel.append(masthead, list, prompts, noteEl, bar);
    section.append(panel);
    root = section;

    renderPrompts();
    syncSignin();
    render();
  }

  // Only the chat chrome follows language and auth changes; the intro copy is
  // translated by the app's own i18n pass.
  function refreshText() {
    if (!root) return;
    renderPrompts();
    syncSignin();
    if (noteEl) noteEl.textContent = noteText();
    var label = document.querySelector('.ai-chat-label');
    if (label) label.textContent = t().title;
    var kicker = document.querySelector('.ai-chat-kicker');
    if (kicker) kicker.textContent = t().kicker;
    var clearButton = document.querySelector('.ai-chat-clear');
    if (clearButton) clearButton.textContent = t().clear;
    var send = document.querySelector('.ai-chat-send');
    if (send) send.setAttribute('aria-label', t().send);
    if (micButton) micButton.setAttribute('aria-label', t().voiceAsk);
    if (speakButton) {
      speakButton.textContent = t().voiceToggle;
      speakButton.setAttribute('aria-pressed', autoSpeak() ? 'true' : 'false');
    }
    if (stopButton) stopButton.textContent = t().stop;
    if (input) input.placeholder = t().placeholder;
    render();
  }

  // The desk is a full destination: while it is open the floating entry would
  // sit on top of the composer, so it steps aside until the visitor leaves.
  function watchScreen() {
    function mark(id) {
      var body = document.body;
      if (!body || !body.classList) return;
      body.classList.toggle('ai-desk-open', id === 'ai');
    }
    var baseGo = window.go;
    if (typeof baseGo === 'function' && !baseGo.__aiDeskWrapped) {
      var wrapped = function (id) {
        var result = baseGo.apply(this, arguments);
        mark(id);
        return result;
      };
      wrapped.__aiDeskWrapped = true;
      window.go = wrapped;
    }
    var active = document.querySelector('.screen.active');
    mark(active ? active.id : '');
  }

  function start() {
    if (window.aiChatBuilt) return;
    if (!window.TravelWorldAuth) { setTimeout(start, 120); return; }
    load();
    build();
    watchScreen();
    window.aiChatBuilt = true;
    window.addEventListener('tw-i18n-change', refreshText);
    window.addEventListener('tw-auth-change', refreshText);
    window.addEventListener('load', refreshText);
    setTimeout(refreshText, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
