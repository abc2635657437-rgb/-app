const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const local = (value, lang) => value?.[lang] ?? value?.zh ?? value ?? '';
import {difficultyMarkup} from './hiking-difficulty.js';
let pending;
export function loadGuides() {
  if (!pending) pending = fetch('/modules/data/route-guides.json?v=20261013-beds', {cache:'no-cache'}).then(response => {
    if (!response.ok) throw new Error('Guide data unavailable');
    return response.json();
  }).then(data => data.guides).catch(error => { pending = null; throw error; });
  return pending;
}
export function costSubtotal(guide) {
  return guide.costs.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
}
export async function mountSourcedGuide(root, routeId, lang = 'zh') {
  const t = (zh, en) => lang === 'en' ? en : zh;
  root.textContent = t('正在加载实拍与来源资料…', 'Loading photographs and source information…');
  root.setAttribute('aria-busy', 'true');
  try {
    const guides = (await loadGuides()).filter(guide => guide.routeId === routeId);
    if (!root.isConnected) return;
    if (!guides.length) { root.remove(); return; }
    if (!document.getElementById('sourcedGuideStyle')) {
      const style = document.createElement('style'); style.id = 'sourcedGuideStyle';
      style.textContent = '.sourced-guide{padding:24px;color:#173f4f;font-size:16px;line-height:1.65}.sourced-guide h3{font-size:24px}.sourced-guide h4{margin:8px 0;font-size:19px}.guide-stops{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:28px}.guide-stops figure{margin:0}.guide-photo{background:#ebe6dc;min-height:180px;display:grid;align-content:center}.guide-photo img{width:100%;height:230px;object-fit:contain;display:block}.guide-stops figcaption{font-size:12px;line-height:1.5;margin:8px 0}.sourced-guide a{color:inherit;text-decoration:underline;text-underline-offset:3px}.sourced-guide a:focus-visible,.sourced-guide button:focus-visible{outline:3px solid #b34f38;outline-offset:4px}.sourced-guide p{margin:10px 0}.guide-price{font-weight:700;color:#a44938}.guide-costs{width:100%;border-collapse:collapse;margin-top:24px}.guide-costs th,.guide-costs td{text-align:left;padding:12px 8px;border-bottom:1px solid #d9d5ca}.guide-costs td:last-child{white-space:nowrap}.guide-note{font-size:14px;color:#535f5b}.guide-photo-status{padding:20px}.guide-photo-status[hidden]{display:none}@media(max-width:500px){.sourced-guide{padding:20px 16px}.guide-stops{gap:24px}}';
      document.head.append(style);
    }
    const link = (url, label) => '<a target="_blank" rel="noopener noreferrer" href="'+safe(url)+'">'+safe(label)+'</a>';
    const money = value => new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'zh-CN', {style:'currency',currency:'EUR'}).format(value);
    root.innerHTML = guides.map(guide => '<section class="sourced-guide"><h3>'+safe(local(guide.title,lang))+'</h3><p class="guide-note">'+t('来源核对：','Sources checked: ')+safe(guide.checkedAt)+' · '+guide.distanceKm+' km · '+t('约 5 小时步行','About 5 hours on foot')+'</p><p class="guide-note">'+safe(local(guide.notice,lang))+'</p><div class="guide-stops">'+guide.stops.map(stop => '<article><figure><div class="guide-photo"><img src="'+safe(stop.image)+'" alt="'+safe(local(stop.name,lang))+'" loading="lazy" decoding="async" width="480" height="320"><span class="guide-photo-status" hidden>'+t('图片暂不可用，请查看原始来源。','Photo unavailable. Open the original source below.')+'</span></div><figcaption>'+link(stop.imageSourceUrl,t('原始照片','Original photo'))+' · '+safe(stop.credit)+(stop.licenseUrl?' · '+link(stop.licenseUrl,stop.license):' · '+t('商家官网照片 · 本地预览','Official business photo · local preview'))+(stop.photoDate?' · '+safe(stop.photoDate):'')+'</figcaption></figure><h4>'+safe(local(stop.name,lang))+'</h4><p>'+safe(local(stop.description,lang))+'</p>'+(stop.price?'<p class="guide-price">'+money(stop.price.amount)+' · '+safe(local(stop.price.unit,lang))+'</p>':'')+link(stop.sourceUrl,t('核对介绍与费用','Check information and prices'))+'</article>').join('')+'</div><table class="guide-costs"><caption>'+t('所列可选项目费用（每人）','Listed optional costs (per person)')+'</caption><thead><tr><th>'+t('项目与来源','Item and source')+'</th><th>'+t('参考费用','Reference price')+'</th></tr></thead><tbody>'+guide.costs.map(cost=>'<tr><td>'+link(cost.sourceUrl,local(cost.name,lang))+'</td><td>'+money(cost.amount)+'</td></tr>').join('')+'</tbody><tfoot><tr><th>'+t('仅上述项目小计','Subtotal of listed items only')+'</th><td>'+money(costSubtotal(guide))+'</td></tr></tfoot></table><p class="guide-note">'+safe(local(guide.excluded,lang))+'</p></section>').join('');
    root.querySelectorAll('.sourced-guide').forEach((section,index) => {
      section.querySelector('h3').insertAdjacentHTML('afterend', difficultyMarkup(guides[index].difficulty,lang));
    });
    root.querySelectorAll('img').forEach(img => {
      const failed = () => { img.hidden = true; img.style.display = 'none'; img.nextElementSibling.hidden = false; };
      img.addEventListener('error', failed, {once:true});
      if (img.complete && !img.naturalWidth) failed();
    });
  } catch (_) {
    root.textContent = t('来源资料加载失败。','Source information could not be loaded.');
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = t('重试','Retry');
    retry.onclick = () => mountSourcedGuide(root, routeId, lang); root.append(retry);
  } finally { root.setAttribute('aria-busy', 'false'); }
}
