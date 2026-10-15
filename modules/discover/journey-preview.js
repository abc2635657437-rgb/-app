import {loadGuides, mountSourcedGuide} from './sourced-guide.js?v=20261013';
import {compactJourney} from './compact-journey.js?v=20261013';
import {journeyPhotos,waypointPhotos} from './journey-photos.js';

const root=document.getElementById('journey');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang='zh',guide,ready=false,route=null,currentPlace=null;
const text=(zh,en)=>lang==='en'?en:zh;
const local=value=>value?.[lang]||value?.zh||value||'';
const points=()=>guide.waypoints.map(p=>({...p,name:local(p.name)}));
const send=message=>document.getElementById('journeyMap')?.contentWindow.postMessage(message,location.origin);
const link=(url,label)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
const placeCatalog=new Map();
async function request(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});
  const result=await response.json(); if(!response.ok)throw new Error(text('服务暂时不可用，请重试。','Service unavailable. Please retry.'));return result;
}
function showPlace(id) {
  const place=placeCatalog.get(id);if(!place)return;
  currentPlace=id;
  document.getElementById('placeDetails').innerHTML='<h3>'+esc(local(place.name))+'</h3><p>'+text('西班牙 · 加利西亚 · 法国之路','Spain · Galicia · French Way')+'</p><p>'+esc(local(place.description))+'</p><p>'+text('地图位置：','Map position: ')+place.latitude.toFixed(5)+', '+place.longitude.toFixed(5)+'</p>'+link(place.sourceUrl,text('核对地点来源','Check location source'));
  if(place.image){
    document.getElementById('placeDetails').insertAdjacentHTML('afterbegin','<img class="place-detail-photo" src="'+esc(place.image)+'" alt="'+esc(local(place.name))+'"><small>'+link(place.imageSourceUrl,place.credit)+' · '+link(place.licenseUrl,place.license)+' · '+text('原图按卡片裁切','Cropped to card')+'</small>');
  }
  if(id==='ferreiros')document.getElementById('placeDetails').insertAdjacentHTML('beforeend','<p>'+text('照片：附近 Mirallos 的圣玛丽亚教堂；当前地图标记为 Ferreiros 村，不是精确拍摄点。','Photo: Santa María church in nearby Mirallos. The map pin identifies Ferreiros village, not the exact camera position.')+'</p>');
  root.querySelectorAll('[data-town]').forEach(b=>b.setAttribute('aria-pressed',String('journey-'+b.dataset.town===id)));
  send({type:'guide-focus',point:{...place,name:local(place.name)}});
  document.getElementById('placeDetails').scrollIntoView({block:'nearest',behavior:'auto'});
}
async function overviewPlace(index,button) {
  const item=guide.journey[index],id='journey-'+index;
  if(!placeCatalog.has(id))placeCatalog.set(id,{...item,...journeyPhotos[index],id,sourceUrl:'https://www.openstreetmap.org/?mlat='+journeyPhotos[index].latitude+'&mlon='+journeyPhotos[index].longitude,description:{zh:'法国之路沿途停靠点。地图标出对应城镇或地标；实拍为历史照片，不代表实时状况。',en:'A stop on the French Way. The map locates the town or landmark. This historical photograph is not a live view.'}});
  if(!placeCatalog.has(id)){
    button.disabled=true;
    try{
      const {results}=await request('/api/map/search?q='+encodeURIComponent(item.query));
      const found=results.find(p=>['town','village','city'].includes(p.type))||results[0];
      if(!found)throw new Error();
      placeCatalog.set(id,{...found,id,name:item.name,description:{zh:'这是法国之路萨里亚至圣地亚哥沿线的停靠城镇。地图定位用于认识地点；城镇中心不是指定旅舍或集合点。请按路线标识和实际预订确认下一站。',en:'A stop on the French Way from Sarria to Santiago. The map identifies the town; its centre is not a specific hostel or meeting point. Confirm your next stop using trail signs and your booking.'}});
    }catch(_){document.getElementById('mapFeedback').textContent=text('地点搜索失败，请重试。','Place search failed. Please retry.');return;}
    finally{button.disabled=false;}
  }
  showPlace(id);
}
async function calculate(button) {
  button.disabled=true;const feedback=document.getElementById('mapFeedback');feedback.textContent=text('正在计算真实步行道路…','Calculating a walking route…');
  try{
    route=await request('/api/map/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:points(),mode:'walking',includeSteps:true})});
    if(route.profile!=='walking'||!route.geometry?.coordinates?.length)throw new Error();
    send({type:'guide-route',points:points(),result:route});
    feedback.textContent=text('道路计算参考：','Calculated reference: ')+(route.distanceMeters/1000).toFixed(1)+' km · '+Math.round(route.durationSeconds/60)+text(' 分钟。不是官方朝圣路线轨迹或实时导航。',' min. Not an official Camino track or live navigation.');
    const maneuvers={'depart':text('出发','Depart'),'arrive':text('到达','Arrive'),'turn':text('转弯','Turn'),'continue':text('继续','Continue'),'new name':text('继续前行','Continue'),'fork':text('岔路','Fork'),'roundabout':text('环岛','Roundabout'),'end of road':text('路口','Junction')};
    const directions={left:text('向左','left'),right:text('向右','right'),straight:text('直行','straight'),'slight left':text('稍向左','slight left'),'slight right':text('稍向右','slight right'),'sharp left':text('大幅左转','sharp left'),'sharp right':text('大幅右转','sharp right'),'uturn':text('掉头','U-turn')};
    document.getElementById('walkingSteps').innerHTML=(route.steps||[]).map(s=>'<li>'+esc(maneuvers[s.maneuver?.type]||text('沿道路行进','Follow the road'))+' '+esc(directions[s.maneuver?.modifier]||'')+' · '+esc(s.name||text('未命名步道','Unnamed path'))+' · '+s.distanceMeters+' m</li>').join('');
  }catch(_){feedback.textContent=text('步行路线暂时无法计算，未绘制虚构连线。可重试。','Walking routing failed. No invented line was drawn. Please retry.');}
  finally{button.disabled=false;}
}
async function render() {
  ready=false;route=null;document.documentElement.lang=lang==='en'?'en':'zh-CN';
  document.getElementById('locale').textContent=lang==='en'?'Chinese':'English';
  document.getElementById('preview-label').textContent=text('本地预览 · 未上线','Local preview · unpublished');
  document.querySelector('.journey-brand small').textContent=text('同路人 · 旅行手帖','Journey Journal');
  root.innerHTML='<section class="journey-hero"><span class="journey-kicker">'+text('旅行手帖 · 徒步','Journey Journal · Hiking')+'</span><h1>'+text('朝圣之路 · 萨里亚至圣地亚哥','The Camino · Sarria to Santiago')+'</h1><h2>'+text('西班牙 · 加利西亚','Spain · Galicia')+'</h2><p>'+text('从乡村小路到古城广场，逐站认识这段旅程。下方为全程主要停靠点；目前细致图文与费用已核对到第一段。','From country lanes to historic squares. Explore the main stops below; detailed photographs and prices are currently verified for the first stage.')+'</p></section><nav class="journey-overview" aria-label="'+text('全程停靠点','Journey stops')+'">'+guide.journey.map((p,i)=>'<button type="button" data-town="'+i+'"><small>0'+(i+1)+'</small><b>'+esc(local(p.name))+'</b><small>'+text('查看地点详情','View place details')+'</small></button>').join('')+'</nav><section class="journey-day"><h2>'+text('第一段 · 萨里亚 → 波尔托马林','Stage 1 · Sarria → Portomarín')+'</h2><p class="journey-facts">'+text('路线资料参考约 22.2 km · 约 5 小时步行，不含休息','Guide reference: about 22.2 km · 5 hours walking, excluding breaks')+'</p><div class="journey-grid"><div><figure class="journey-photo"><img src="'+esc(guide.stops[0].image)+'" alt="'+esc(local(guide.stops[0].name))+'" width="800" height="450"><figcaption>'+link(guide.stops[0].imageSourceUrl,'Sharon Mollerus · CC BY 4.0')+' · '+text('乡村路段实拍，准确拍摄点未核实','Rural stage photograph; exact camera position unverified')+'</figcaption></figure><ol class="journey-timeline">'+guide.waypoints.map((p,i)=>'<li><h3>'+ (i+1)+'. '+esc(local(p.name))+'</h3><p>'+esc(local(p.description))+'</p><button type="button" data-place="'+p.id+'">'+text('查看地点详情','View place details')+'</button></li>').join('')+'</ol></div><aside class="journey-map"><h3>'+text('在同路人地图中查看','Explore on Travel World Map')+'</h3><iframe id="journeyMap" src="/artifacts/route-map-preview.html?lang='+lang+'" title="'+text('原有同路人地图 · 加利西亚沿途地点','Travel World Map · Galicia route stops')+'"></iframe><div class="journey-actions"><button type="button" id="showStops">'+text('查看本段全部地点','Show all stage stops')+'</button><button type="button" id="walkingRoute" class="primary">'+text('计算步行路线','Calculate walking route')+'</button></div><p id="mapFeedback" role="status">'+text('原有地图组件与底图，点击编号查看地点。','Existing map component and tiles. Click numbered markers for details.')+'</p><section id="placeDetails" aria-live="polite"><h3>'+text('萨里亚在哪里？','Where is Sarria?')+'</h3><p>'+text('西班牙西北部，加利西亚自治区卢戈省。本段从老城圣玛丽娜教堂出发，朝波尔托马林方向步行。','In Lugo province, Galicia, northwestern Spain. This stage starts by Santa Mariña church in the old town and heads towards Portomarín.')+'</p></section><ol id="walkingSteps" class="journey-steps"></ol><p>'+link('https://www.caminodesantiago.gal/es/planifica/las-rutas/camino-frances/etapa-sarria-portomarin',text('官方路段资料','Official stage information'))+'</p></aside></div></section><section id="sourceGuide"></section>';
  root.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>showPlace(b.dataset.place));
  root.querySelectorAll('[data-town]').forEach(b=>b.onclick=()=>overviewPlace(Number(b.dataset.town),b));
  document.getElementById('showStops').onclick=()=>send({type:'guide-places',points:points()});
  document.getElementById('walkingRoute').onclick=e=>calculate(e.currentTarget);
  await mountSourcedGuide(document.getElementById('sourceGuide'),guide.routeId,lang);
  compactJourney(root,guide,lang);
  root.querySelectorAll('[data-town]').forEach((button,i)=>{
    const p=journeyPhotos[i];
    button.innerHTML='<img src="'+esc(p.image)+'" alt="'+esc(local(guide.journey[i].name))+'"><span><small>0'+(i+1)+'</small><b>'+esc(local(guide.journey[i].name))+'</b></span>';
    button.setAttribute('aria-label',text('查看地点：','View place: ')+local(guide.journey[i].name));
  });
  root.querySelectorAll('[data-place]').forEach((button,i)=>{
    const p=waypointPhotos[i];
    button.innerHTML='<img src="'+esc(p.image)+'" alt="'+esc(local(guide.waypoints[i].name))+'"><span>'+text('查看地点详情','View place details')+'</span>';
  });
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==document.getElementById('journeyMap')?.contentWindow)return;
  if(event.data?.type==='guide-map-ready'){ready=true;send({type:'guide-places',points:points()});}
  if(event.data?.type==='guide-place-selected')showPlace(event.data.id);
});
document.getElementById('locale').onclick=()=>{lang=lang==='zh'?'en':'zh';render();};
try {guide=(await loadGuides())[0];guide.waypoints.forEach((p,i)=>placeCatalog.set(p.id,{...p,...waypointPhotos[i]}));await render();}
catch(error){console.error('Journey preview could not render:',error);root.textContent=text('资料加载失败，请刷新重试。','Could not load guide. Refresh to retry.');}
