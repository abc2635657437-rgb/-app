(function () {
  if (!document.querySelector('link[href*="ukiyoe.css"]')) {
    const theme = document.createElement('link'); theme.rel = 'stylesheet'; theme.href = '/modules/theme/ukiyoe.css?v=4'; document.head.appendChild(theme);
  }
  const hero = document.createElement('div');
  hero.className = 'uk-hero';
  hero.innerHTML = '<div class="uk-editorial"><div><span class="uk-kicker">旅途手帖</span><h1>山海之间</h1></div><span class="uk-edition">TRAVEL JOURNAL</span></div><figure class="uk-art" style="margin:0"><img src="/assets/ukiyoe-journey.svg" width="960" height="600" fetchpriority="high" alt="浮世绘风格的海浪、远山与朱红落日"><span class="uk-seal" aria-hidden="true">旅</span><figcaption>山 · 海 · 日</figcaption></figure><div class="uk-caption"><span><i aria-hidden="true"></i> 沿途风景，日常记录。</span><button type="button" class="uk-explore">探索目的地 <span aria-hidden="true">↗</span></button></div>';
  document.querySelector('.community-top').after(hero);
  hero.querySelector('.uk-explore').onclick = () => window.go('discover');
  const icons = {
    home:'<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
    discover:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
    map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
    messages:'<path d="M20 16a2 2 0 0 1-2 2H8l-5 3V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2zM7 9h9M7 13h6"/>',
    friends:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
  };
  document.querySelectorAll('.nav button').forEach(button => {
    const node = button.querySelector('.nav-icon');
    if(node && icons[button.dataset.id])node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[button.dataset.id]+'</svg>';
  });
}());
