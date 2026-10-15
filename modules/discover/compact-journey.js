import {difficultyMarkup} from './hiking-difficulty.js';
import {journeyPhotos,waypointPhotos} from './journey-photos.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function compactJourney(root,guide,lang) {
  if (!document.getElementById('compactJourneyStyle')) {
    const style=document.createElement('link');style.id='compactJourneyStyle';style.rel='stylesheet';style.href='/modules/discover/compact-journey.css?v=20261013-fullpage';document.head.append(style);
  }
  const t=(zh,en)=>lang==='en'?en:zh;
  const local=value=>value?.[lang]||'';
  root.classList.add('compact-journey');
  const art=guide.backgroundArt?.image;
  if(art&&/^\/assets\/route-photos\/[a-z0-9-]+\.(png|jpg|webp)$/.test(art))document.body.style.setProperty('--journey-background','url("'+art+'")');
  const hero=root.querySelector('.journey-hero');
  hero.querySelector('p').remove();
  const facts=document.createElement('div');facts.className='compact-facts';
  facts.innerHTML='<span><b>22.2 km</b>'+t('本段距离','Stage distance')+'</span><span><b>~5 h</b>'+t('步行 · 不含休息','Walking · no breaks')+'</span><span><b>2 / 5</b>'+t('暂定难度','Provisional grade')+'</span><span><b>€31.50</b>'+t('已列吃住小计 · 非全天预算','Listed food/stay subtotal · not daily budget')+'</span>';
  hero.append(facts);
  const day=root.querySelector('.journey-day');
  day.querySelector('h2').textContent=t('本段 · 萨里亚 → 波尔托马林','Stage · Sarria → Portomarín');
  day.querySelector('.journey-facts').remove();
  const map=root.querySelector('.journey-map');
  const photo=root.querySelector('.journey-photo');
  photo.remove(); // The rural wall photograph is not the pilgrimage's main visual.
  const timeline=root.querySelector('.journey-timeline');
  const source=root.querySelector('#sourceGuide');
  const sourced=source.querySelector('.sourced-guide');
  const photos=sourced.querySelector('.guide-stops');
  const costs=sourced.querySelector('.guide-costs');
  const note=sourced.querySelector('p.guide-note');
  const originalCards=[...photos.children];
  const dashboard=document.createElement('div');dashboard.className='compact-dashboard';
  const content=document.createElement('section');content.className='compact-content';
  const shots=document.createElement('div');shots.className='compact-shots';
  const lead=document.createElement('div');lead.className='compact-lead';
  const grid=document.createElement('div');grid.className='compact-photo-grid';
  originalCards.slice(1).forEach((card,index)=>{
    const figure=card.querySelector('figure');
    const heading=card.querySelector('h4');
    const description=card.querySelector('p');
    const detail=document.createElement('details');detail.className='compact-card-detail';
    const summary=document.createElement('summary');summary.textContent=[t('教堂实拍','Church'),t('牛肉汉堡','Beef burger'),t('青旅床位','Hostel beds')][index];
    detail.append(summary);
    // Long copy and photo licensing remain available, not stacked in the main view.
    detail.append(heading,description,figure.querySelector('figcaption'));
    const sourceLink=card.lastElementChild;
    if(sourceLink?.tagName==='A')detail.append(sourceLink);
    const price=card.querySelector('.guide-price');
    card.replaceChildren(figure,detail);if(price)card.append(price);
    const photoButton=document.createElement('button');photoButton.type='button';photoButton.className='photo-detail-button';photoButton.setAttribute('aria-label',t('查看图片与详情：','View photo and details: ')+heading.textContent);figure.before(photoButton);photoButton.append(figure);photoButton.onclick=()=>{detail.open=!detail.open;photoButton.setAttribute('aria-expanded',String(detail.open));};
    grid.append(card);
  });
  lead.append(grid);shots.append(lead);content.append(shots);
  const stops=document.createElement('section');stops.className='compact-stops';
  const stopTitle=document.createElement('h3');stopTitle.textContent=t('沿途定位','Along the way');stops.append(stopTitle);
  [...timeline.children].forEach(item=>{
    const heading=item.querySelector('h3'),button=item.querySelector('button'),description=item.querySelector('p');
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('路段提示','Stage notes');details.append(summary,description);
    item.replaceChildren(heading,button,details);
  });
  stops.append(timeline);content.append(stops);
  const bottom=document.createElement('div');bottom.className='compact-bottom';
  const pricePanel=document.createElement('section');pricePanel.className='compact-price';pricePanel.append(costs);
  const excluded=document.createElement('details'),excludedSummary=document.createElement('summary');excludedSummary.textContent=t('费用不含哪些项目？','What is excluded?');excluded.append(excludedSummary,sourced.lastElementChild);pricePanel.append(excluded);
  const sourcePanel=document.createElement('details');sourcePanel.className='compact-source';
  const sourceSummary=document.createElement('summary');sourceSummary.textContent=t('难度、实拍来源与使用说明','Difficulty, photo sources and notes');sourcePanel.append(sourceSummary);
  sourcePanel.insertAdjacentHTML('beforeend',difficultyMarkup(guide.difficulty,lang));
  const sourceText=document.createElement('p');sourceText.textContent=local(guide.notice);sourcePanel.append(sourceText);
  const credit=document.createElement('p');credit.textContent=t('实拍：Sharon Mollerus · CC BY 4.0；Diego Delso · CC BY-SA 4.0；餐食与旅舍：商家官网照片。','Photos: Sharon Mollerus · CC BY 4.0; Diego Delso · CC BY-SA 4.0. Food and hostel: official business photos.');sourcePanel.append(credit);
  const credits=document.createElement('ul');
  [...journeyPhotos,...waypointPhotos].forEach(p=>{const li=document.createElement('li');li.innerHTML='<a href="'+safe(p.imageSourceUrl)+'" target="_blank" rel="noopener">'+safe(p.credit)+'</a> · <a href="'+safe(p.licenseUrl)+'" target="_blank" rel="noopener">'+safe(p.license)+'</a>';credits.append(li);});sourcePanel.append(credits);
  const artNote=document.createElement('p');artNote.textContent=t('背景为基于圣地亚哥教堂实拍制作的艺术拼贴，不代表现场照片；原图 Luis Miguel Bugallo Sánchez，衍生背景沿用 CC BY-SA 3.0。','Background: artistic collage derived from a cathedral photograph, not a documentary view. Original: Luis Miguel Bugallo Sánchez; derivative background: CC BY-SA 3.0.');sourcePanel.append(artNote);
  if(note)sourcePanel.append(note);
  bottom.append(pricePanel,sourcePanel);content.append(bottom);
  map.querySelector('h3').textContent=t('沿途地图','Route map');
  const steps=map.querySelector('#walkingSteps');const stepDetails=document.createElement('details');const stepSummary=document.createElement('summary');stepSummary.textContent=t('道路分步参考','Calculated directions');stepDetails.append(stepSummary,steps);map.append(stepDetails);
  dashboard.append(content,map);day.replaceChildren(day.querySelector('h2'),dashboard);
  source.remove();
}
