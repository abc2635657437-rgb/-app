const regions=[['asia','亚洲','Asia'],['oceania','澳洲与大洋洲','Australia & Oceania'],['europe','欧洲','Europe'],['north-america','北美','North America'],['south-america','南美','South America'],['africa','非洲','Africa']];
const en=()=>window.TravelWorldI18n?.language?.()==='en';
const t=(zh,english)=>en()?english:zh;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountCompanions(){
  const section=document.getElementById('mapExplore');if(!section)return;
  let root=document.getElementById('regionalAiCompanions');
  if(!root){root=document.createElement('details');root.id='regionalAiCompanions';section.append(root);}else if(root.parentElement!==section)section.append(root);
  const heading=t('AI 旅行伙伴','AI travel companions'),note=t('非真人 · 不计入在线人数','Not human · excluded from online counts');
  const signature=heading+note;if(root.dataset.locale===signature)return;root.dataset.locale=signature;
  root.innerHTML='<summary>'+heading+'</summary><header><small>'+note+'</small></header><div class="ai-companion-grid">'+regions.map(([id,zh,english])=>'<button type="button" data-region="'+id+'"><img src="/assets/route-photos/ai-travel-companion.png" alt=""><span>'+safe(en()?english:zh)+'</span><small>AI</small></button>').join('')+'</div>';
  root.querySelectorAll('[data-region]').forEach(button=>button.onclick=()=>openCompanion(button.dataset.region));
}
function openCompanion(id){
  const region=regions.find(r=>r[0]===id);if(!region)return;
  document.getElementById('aiCompanionDialog')?.remove();
  const name=en()?region[2]:region[1],overlay=document.createElement('div');overlay.id='aiCompanionDialog';overlay.className='dm-overlay';
  overlay.innerHTML='<section class="dm-window" role="dialog" aria-modal="true" aria-label="'+safe(name)+' AI"><header class="dm-header"><button type="button" data-close>'+t('返回','Back')+'</button><img class="dm-avatar" src="/assets/route-photos/ai-travel-companion.png" alt=""><b>'+safe(name)+' · AI</b></header><p class="ai-companion-disclosure">'+t('AI 旅行伙伴，不是真人。建议可能有误；价格、营业和安全信息须核实。','AI travel companion, not a human. Advice may be wrong; verify prices, opening times and safety.')+'</p><div class="dm-history" aria-live="polite"><p class="muted">'+t('告诉我目的地、天数和预算，可以讨论路线、餐饮、住宿和补给。','Share your destination, trip length and budget to discuss routes, food, stays and supplies.')+'</p></div><p class="dm-status" role="status"></p><form class="dm-compose"><textarea required maxlength="2000" aria-label="'+t('给 AI 的问题','Question for AI')+'" placeholder="'+t('想去哪里？','Where would you like to go?')+'"></textarea><button class="btn" type="submit">'+t('发送','Send')+'</button></form></section>';
  document.body.append(overlay);const close=()=>overlay.remove();overlay.querySelector('[data-close]').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close();};overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  const form=overlay.querySelector('form'),input=form.querySelector('textarea'),button=form.querySelector('button'),history=overlay.querySelector('.dm-history'),status=overlay.querySelector('.dm-status');let turns=[];
  const bubble=(text,mine)=>{const node=document.createElement('p');node.className='dm-message'+(mine?' mine':'');node.textContent=text;history.append(node);history.scrollTop=history.scrollHeight;};
  form.onsubmit=async event=>{
    event.preventDefault();const message=input.value.trim();if(!message||button.disabled)return;
    if(!window.TravelWorldAuth?.requireLogin())return;
    button.disabled=true;status.textContent=t('AI 正在查询参考资料…','AI is consulting reference material…');
    try{const result=await window.TravelWorldAuth.request('/api/ai/companion',{method:'POST',body:JSON.stringify({region:id,message,language:en()?'en':'zh',history:turns.slice(-8)})});if(!overlay.isConnected)return;bubble(message,true);bubble(result.answer,false);turns.push({role:'user',content:message},{role:'assistant',content:result.answer});input.value='';status.textContent=t('AI 生成 · 非实时旅行报价','AI-generated · not a live travel quote');}
    catch(_){status.textContent=t('AI 暂时无法回答，问题已保留，可重试。','AI could not answer. Your question is preserved; please retry.');}
    finally{button.disabled=false;}
  };input.focus();
}
