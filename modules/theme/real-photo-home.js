(function () {
  if(new URLSearchParams(location.search).get('preview')==='journal')return;
  const photo = (id, width = 1400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
  const destinations = [
    {
      name: '长城', nameEn: 'The Great Wall', place: '北京 · 中国', placeEn: 'Beijing · China',
      note: '山脊上的历史遗迹', noteEn: 'A historic wall across the ridgelines',
      by: 'Andrew Scarborough', href: 'https://unsplash.com/photos/great-wall-of-china-ykBrcEgXYQc',
      image: photo('photo-1509376159-27f57325a3b6'), alt: '长城蜿蜒穿过山脊的实景摄影'
    },
    {
      name: '洱海', nameEn: 'Erhai Lake', place: '大理 · 云南', placeEn: 'Dali · Yunnan',
      note: '湖岸与苍山', noteEn: 'Lakeshore and Cangshan',
      by: 'Bruce Hong', href: 'https://unsplash.com/photos/body-of-water-near-hills-under-white-clouds-and-blue-sky-during-daytime-hO5U9bpsPsA',
      image: photo('photo-1566138096103-457d9805929f', 800), alt: '洱海与远处山脉的真实风景照片'
    },
    {
      name: '梅里雪山', nameEn: 'Meili Snow Mountain', place: '德钦 · 云南', placeEn: 'Deqin · Yunnan',
      note: '日照金山与雪峰', noteEn: 'Snow peaks at first light',
      by: 'Ryan Wu', href: 'https://unsplash.com/photos/a-snowy-mountain-with-a-blue-sky-XQoqTbmUgfw',
      image: photo('photo-1669967420852-85c16aa2f92f', 800), alt: '梅里雪山卡瓦格博峰的真实摄影'
    }
  ];
  const copy = {
    zh: { overline: '真实目的地 · 实景摄影', title: '去看真实的山海', intro: '从长城到洱海，再到梅里雪山。下一段旅程，从真实的风景开始。', explore: '探索目的地', more: '更多目的地', credits: '实景照片 · Unsplash' },
    en: { overline: 'REAL PLACES · PHOTOGRAPHY', title: 'The world, as it is', intro: 'From the Great Wall to Erhai Lake and Meili Snow Mountain. Let the real places lead your next journey.', explore: 'Explore places', more: 'Discover more', credits: 'Location photos · Unsplash' }
  };
  const safe = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const language = () => document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'zh';
  const openMap = () => { window.go?.('map'); window.loadMap?.(); };

  function render() {
    const hero = document.querySelector('.uk-hero');
    if (!hero) return false;
    const text = copy[language()];
    hero.classList.add('real-photo-hero');
    hero.innerHTML = `
      <header class="real-photo-heading">
        <span class="real-photo-overline">${text.overline}</span>
        <h1>${text.title}</h1>
        <p>${text.intro}</p>
      </header>
      <button class="real-photo-feature" type="button" aria-label="${safe(destinations[0].name)} · ${text.explore}">
        <img src="${destinations[0].image}" srcset="${destinations[0].image.replace('w=1400', 'w=800')} 800w, ${destinations[0].image} 1400w" sizes="(max-width: 600px) calc(100vw - 56px), 520px" alt="${safe(destinations[0].alt)}" fetchpriority="high" decoding="async">
        <span class="real-photo-feature-label">01 / ${safe(destinations[0].place)}</span>
        <span class="real-photo-feature-copy"><b>${language() === 'en' ? destinations[0].nameEn : destinations[0].name}</b><small>${language() === 'en' ? destinations[0].noteEn : destinations[0].note}</small></span>
        <span class="real-photo-arrow" aria-hidden="true">↗</span>
      </button>
      <div class="real-photo-pair">${destinations.slice(1).map((item, index) => `
        <button class="real-photo-tile" type="button" aria-label="${safe(language() === 'en' ? item.nameEn : item.name)} · ${text.explore}">
          <img src="${item.image}" srcset="${item.image.replace('w=800', 'w=500')} 500w, ${item.image} 800w" sizes="(max-width: 600px) 50vw, 260px" alt="${safe(item.alt)}" loading="lazy" decoding="async">
          <span class="real-photo-tile-copy"><small>0${index + 2} / ${safe(language() === 'en' ? item.placeEn : item.place)}</small><b>${safe(language() === 'en' ? item.nameEn : item.name)}</b></span>
        </button>`).join('')}
      </div>
      <footer class="real-photo-footer"><span>${text.credits} · ${destinations.map(item => `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${safe(item.by)}</a>`).join(' · ')}</span><button type="button">${text.more} <i aria-hidden="true">↗</i></button></footer>`;
    hero.querySelectorAll('.real-photo-feature,.real-photo-tile,.real-photo-footer button').forEach(button => button.addEventListener('click', openMap));
    hero.querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
      image.closest('button')?.classList.add('real-photo-unavailable');
      image.remove();
    }, { once: true }));
    return true;
  }

  function start() {
    const stylesheet = document.querySelector('link[href*="real-photo-home.css"]');
    if (stylesheet && stylesheet.parentElement !== document.head) document.head.appendChild(stylesheet);
    if (!render()) {
      const observer = new MutationObserver(() => { if (render()) observer.disconnect(); });
      observer.observe(document.querySelector('.community-top')?.parentElement || document.body, { childList: true, subtree: true });
    }
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
