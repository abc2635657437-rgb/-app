// Assemble the app shell: the real Travel World screens (home, publish,
// friends, ai, profile) plus the live West Lake explore screen, in one page.
//
//   node scripts/build-shell.mjs
//
// The screens, the inline boot script and the twenty modules are lifted from
// index.html verbatim, so the feed, chat, buddies and profile keep running
// their own code. The explore chrome comes from explore3d.html. Only the
// navigation and the screen wiring below are new.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// keep the scoped copy in step with the source stylesheet
execFileSync(process.execPath, ['scripts/scope-explore-css.mjs'], { stdio: 'inherit' });

const app = readFileSync('index.html', 'utf8');
const explore = readFileSync('scripts/explore-scene.html', 'utf8');

const pick = (text, re, label) => {
  const match = text.match(re);
  if (!match) throw new Error('missing ' + label);
  return match[0];
};

// --- from the existing app shell ------------------------------------------
const headContent = pick(app, /<meta charset="utf-8">[\s\S]*?(?=<link rel="stylesheet")/, 'head content');
const stylesheetLinks = pick(app, /<link rel="stylesheet"[^>]*>/, 'stylesheet link');
const inlineStyle = pick(app, /<style>[\s\S]*?<\/style>/, 'inline style');
const mainBlock = pick(app, /<main class="app">[\s\S]*?<\/main>/, 'main block');
const modules = [...app.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map(m => m[0]);
const inlineBoot = pick(app, /<script>\s*const rates=[\s\S]*?<\/script>/, 'inline boot script');

// The old explore screen lives inside <main>; the new one is a full-bleed sibling.
let mainWithoutMap = mainBlock.replace(/<section id="map"[\s\S]*?<\/section>/, '');
mainWithoutMap = mainWithoutMap.replace(
  /(<button class="publish-button"[^>]*>[\s\S]*?<\/button>)/,
  '$1<a class="home-avatar" href="/explore3d.html?screen=profile" aria-label="我的">我</a>'
);
if (!mainWithoutMap.includes('id="home"')) throw new Error('home section missing');

// --- from the explore page ------------------------------------------------
// the SVG icon sprite sits before <div id="app"> in the standalone page
const spriteMatch = explore.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/);
const sprite = spriteMatch ? spriteMatch[0] : '';
if (!sprite) throw new Error('icon sprite missing');

const appOpen = explore.indexOf('<div id="app">');
const appClose = explore.indexOf('<script src="/modules/auth/auth-web.js');
if (appOpen < 0 || appClose < 0) throw new Error('explore chrome not found');
let chrome = explore.slice(appOpen + '<div id="app">'.length, appClose);
chrome = chrome.slice(0, chrome.lastIndexOf('</div>'));

// The app shell owns the bottom navigation, the status line and the toast.
chrome = chrome.replace(/<nav class="bottom-nav"[\s\S]*?<\/nav>/, '');
chrome = chrome.replace(/<div id="status"[^>]*><\/div>/, '');
chrome = chrome.replace(/<div id="toast"[^>]*><\/div>/, '');

if (!chrome.includes('id="stage"')) throw new Error('explore stage missing');

// --- the new navigation ---------------------------------------------------
const nav = `<nav class="nav" id="appNav">
  <button data-id="home" onclick="go('home')"><span class="nav-icon">⌂</span><br>首页</button>
  <button data-id="map" onclick="go('map')"><span class="nav-icon">◉</span><br>探索</button>
  <button class="nav-publish" data-id="publish" onclick="(window.openPublisher||function(){go('publish')})()"><span class="nav-publish__mark">＋</span><span class="nav-publish__label">发布</span></button>
  <button data-id="friends" onclick="go('friends')"><span class="nav-icon">◍</span><br>旅友</button>
</nav>`;

const extraStyle = `<style>
  /* The explore screen is full-bleed and sits above the app column. */
  body .screen--explore {
    position: fixed;
    inset: 0;
    z-index: 20;
    padding: 0;
    display: none;
    background: #dfeae6;
    overflow: hidden;
    --nav-h: 72px;
  }
  body .screen--explore.active { display: block; }
  body .screen--explore > * { --nav-h: 72px; }
  body .nav { z-index: 40; display: grid; grid-template-columns: repeat(5, 1fr); }
  body .nav .nav-publish { position: relative; margin-top: -22px; display: grid; justify-items: center; gap: 2px; border: 0; background: transparent; }
  body .nav .nav-publish__mark {
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(160deg, #1c8f68, #0b5f46);
    color: #fff; font-size: 26px; line-height: 46px; text-align: center;
    box-shadow: 0 10px 22px rgba(12, 92, 68, 0.38), 0 0 0 4px #f8f6f0;
    display: block;
  }
  body .nav .nav-publish__label { font-size: 10px; color: #4c6a61; }
  body .nav .nav-icon { font-size: 18px; }
  body .nav button { border: 0; background: transparent; }
  body .topbar-profile {
    position: fixed; top: calc(12px + env(safe-area-inset-top)); right: 16px; z-index: 45;
    width: 40px; height: 40px; border-radius: 50%; background: #fff;
    box-shadow: 0 4px 14px rgba(12, 42, 37, .18); display: none; place-items: center;
    color: #16483c; font-size: 15px; text-decoration: none;
  }
  body[data-screen="map"] .topbar-profile { display: grid; }
  body .home-avatar {
    width: 38px; height: 38px; border-radius: 50%; margin-left: 8px;
    display: inline-grid; place-items: center; text-decoration: none;
    background: #fff; color: #16483c; font-size: 14px;
    box-shadow: 0 2px 8px rgba(12, 42, 37, 0.18);
  }
  /* the explore screen is its own full-bleed surface: the app column must not
     bleed through above or below it */
  body[data-screen="map"] .app { visibility: hidden; }
  body[data-screen="map"] .ai-float,
  body[data-screen="map"] .global-back { display: none !important; }
  /* the embedded explore document brings its own five-item bar */
  body[data-screen="map"] .nav { display: none; }
  body[data-screen="map"] .nav button { color: #4c6a61; }
  body[data-screen="map"] .nav .nav-icon { color: #4c6a61; }
  body[data-screen="map"] .nav button[data-id="map"] { color: #0f7a5a; font-weight: 700; }
</style>`;

const shell = `<!doctype html>
<html lang="zh-CN">
<head>
${headContent}
${stylesheetLinks}
${inlineStyle}
<link rel="stylesheet" href="/modules/explore3d/explore3d.scoped.css?v=1">
${extraStyle}
</head>
<body>
${mainWithoutMap}
${sprite}
<section id="map" class="screen screen--explore" style="position:fixed;inset:0;left:0;top:0;width:100%;height:100%;padding:0;margin:0;z-index:20;overflow:hidden;background:#dfeae6">
<iframe id="exploreFrame" title="西湖探索" src="/explore3d-explore.html" loading="lazy" style="display:block;width:100%;height:100%;border:0;background:#dfeae6"></iframe>
</section>
<span class="currency-label" hidden></span>
${nav}
<a class="topbar-profile" href="/index.html?screen=profile" aria-label="我的">我</a>
<div id="status" role="status"></div>
<div id="toast" role="alert"></div>
${inlineBoot}
${modules.join('\n')}
<script>
  // Screen bookkeeping: other modules also assign window.go, so the current
  // screen is derived from the DOM rather than from a wrapped function.
  (function () {
    var last = null;
    function sync() {
      var active = document.querySelector('.screen.active');
      var id = active ? active.id : 'home';
      if (id === last) return;
      last = id;
      document.body.dataset.screen = id;
      window.dispatchEvent(new CustomEvent('tw:screen', { detail: id }));
    }
    setInterval(sync, 250);
    addEventListener('load', function () {
      var wanted = new URLSearchParams(location.search).get('screen');
      if (wanted && document.getElementById(wanted)) {
        if (typeof window.go === 'function') window.go(wanted);
        else document.querySelectorAll('.screen').forEach(function (node) { node.classList.toggle('active', node.id === wanted); });
      }
      sync();

      // chat-web injects its tab after 探索; the design wants it after 发布,
      // and the injection lands after load, so watch the bar.
      var nav = document.getElementById('appNav');
      var placeChat = function () {
        var chat = nav.querySelector('[data-id="messages"]');
        var publish = nav.querySelector('.nav-publish');
        if (chat && publish && chat.previousElementSibling !== publish) publish.after(chat);
      };
      new MutationObserver(placeChat).observe(nav, { childList: true });
      placeChat();
    });
  })();
</script>
</body>
</html>
`;

writeFileSync('explore3d.html', shell);
console.log('wrote explore3d.html', shell.length, 'bytes');

// --- the embedded explore document ----------------------------------------
// The standalone scene page, with links that point at the shell and openings
// that leave the frame, so a tab tap really changes the app's screen.
let embedded = readFileSync('scripts/explore-scene.html', 'utf8');
embedded = embedded.split('/index.html?screen=').join('/explore3d.html?screen=');
embedded = embedded.split('href="/index.html"').join('href="/explore3d.html?screen=profile"');
embedded = embedded.split('<a ').join('<a target="_top" ');
embedded = embedded.split('/modules/explore3d/explore3d.js?v=3').join('/modules/explore3d/explore3d.js?v=5');
embedded = embedded.split('/modules/explore3d/explore3d.css?v=4').join('/modules/explore3d/explore3d.css?v=5');
writeFileSync('explore3d-explore.html', embedded);
console.log('wrote explore3d-explore.html', embedded.length, 'bytes');

console.log('modules:', modules.length, '| chrome:', chrome.length, '| style:', inlineStyle.length);
