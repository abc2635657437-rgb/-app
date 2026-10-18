(function(){
  // The approved five-page journal is the only home shell.
  document.body.classList.add('journal-preview');
  const css=document.createElement('link');css.rel='stylesheet';css.href='/modules/theme/journal-preview.css?v=18-rounded-buddy';document.head.append(css);
  const applyTimeTheme=()=>{const hour=new Date().getHours();document.body.dataset.timeTheme=hour<8||hour>=20?'night':'day';};
  applyTimeTheme();window.setInterval(applyTimeTheme,60_000);
  const pageBackgrounds={home:'great-wall',map:'zhangjiajie',messages:'west-lake',friends:'erhai',profile:'potala'};
  const setPageBackground=id=>{if(pageBackgrounds[id])document.body.dataset.pageBg=pageBackgrounds[id];};
  const baseGo=window.go;
  if(baseGo)window.go=function(id,...args){const result=baseGo.call(this,id,...args);setPageBackground(id);return result;};
  setPageBackground(document.querySelector('.screen.active')?.id||'home');
  const lang=()=>window.TravelWorldI18n?.language?.()||'zh';
  const t=(zh,en)=>lang()==='en'?en:zh;
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  let companionMount;
  import('../chat/ai-companions.js').then(m=>{companionMount=m.mountCompanions;companionMount();});
  const originalPublish=window.publishBuddyPlan;
  window.publishBuddyPlan=()=>{
    const type=document.getElementById('journalTripType')?.value,budget=document.getElementById('journalTripBudget')?.value,note=document.getElementById('tripNote');
    if(note){note.value=note.value.replace(/^\[(Hiking|Self-drive|City walk)\](?: Budget: CNY \d+(?:\.\d+)? per person)?\n/,'');note.value='['+(type||'Hiking')+']'+(budget?' Budget: CNY '+budget+' per person':'')+'\n'+note.value;}
    return originalPublish?.();
  };
  function decorate(){
    const hero=document.querySelector('.uk-hero');
    if(hero&&!hero.classList.contains('journal-hero')){
      hero.className='uk-hero journal-hero';
      hero.innerHTML='<button class="journal-hero-link" type="button"><img src="/assets/route-photos/page-bg-great-wall-mobile.png?v=2" alt=""><span class="journal-hero-copy"><h1 data-journal-title></h1><p data-journal-subtitle></p></span><span class="journal-hero-caption" data-journal-caption></span></button>';
      hero.querySelector('button').onclick=()=>{window.go('map');window.loadMap?.();};
    }
    if(hero){setText(hero.querySelector('[data-journal-title]'),t('山海之间','Between Mountains & Sea'));setText(hero.querySelector('[data-journal-subtitle]'),t('沿途风景，日常记录。','Scenes and stories along the way.'));setText(hero.querySelector('[data-journal-caption]'),t('长城','Great Wall'));}
    const map=document.getElementById('map');
    if(map){
      const canvas=document.getElementById('mapCanvas'),card=canvas?.closest('.map-card');
      if(card&&card.parentElement!==map)map.insertBefore(card,map.querySelector('#mapExplore'));
      setText(map.querySelector('.title'),t('探索','Explore'));
      map.querySelector('.sub')?.setAttribute('hidden','');
      const plan=document.querySelector('#mapExplore>#dest')?.closest('.card')||document.getElementById('dest')?.closest('.card');if(plan)plan.hidden=true;
    }
    const friends=document.getElementById('friends');
    if(friends&&!friends.querySelector('.journal-buddy-heading')){
      const title=friends.querySelector('.title');if(title){title.classList.add('journal-buddy-heading');title.insertAdjacentHTML('afterend','<p class="journal-buddy-subtitle"></p>');}
    }
    if(friends){setText(friends.querySelector('.title'),t('下一程，一起走。','The next journey, together.'));setText(friends.querySelector('.journal-buddy-subtitle'),t('在路上，遇见同路人。','Meet fellow travelers along the way.'));}
    if(friends&&!friends.querySelector('.journal-trip-filters')){
      const composer=document.getElementById('tripTitle')?.closest('.card');
      if(composer){const fold=document.createElement('details');fold.className='journal-composer';const summary=document.createElement('summary');summary.dataset.journalCompose='';fold.append(summary);composer.before(fold);fold.append(composer);
        const type=document.createElement('select');type.id='journalTripType';type.className='input';type.setAttribute('aria-label',t('旅行类型','Trip type'));type.innerHTML='<option value="Hiking">'+t('徒步','Hiking')+'</option><option value="Self-drive">'+t('自驾游','Self-drive')+'</option><option value="City walk">'+t('城市漫游','City walk')+'</option>';document.getElementById('tripNote').before(type);
        const budget=document.createElement('input');budget.id='journalTripBudget';budget.type='number';budget.min='0';budget.step='1';budget.className='input';budget.placeholder=t('每人预算（CNY，选填）','Budget per person (CNY, optional)');type.after(budget);
      }
      const filters=document.createElement('div');filters.className='journal-trip-filters';filters.innerHTML='<button class="active" data-trip-filter="all"></button><button data-trip-filter="hiking"></button><button data-trip-filter="driving"></button><button data-trip-filter="city"></button><button data-trip-publish></button>';friends.querySelector('.journal-buddy-subtitle')?.after(filters);
      filters.querySelectorAll('[data-trip-filter]').forEach(button=>button.onclick=()=>{filters.querySelectorAll('[data-trip-filter]').forEach(b=>b.classList.toggle('active',b===button));friends.querySelectorAll('#buddyPlans>.card').forEach(card=>{const text=card.textContent;card.hidden=button.dataset.tripFilter!=='all'&&!(button.dataset.tripFilter==='driving'?/Self-drive|自驾/i:button.dataset.tripFilter==='city'?/City walk|城市漫游/i:/Hiking|徒步/i).test(text);});});
      filters.querySelector('[data-trip-publish]').onclick=()=>{const fold=friends.querySelector('.journal-composer');if(fold){fold.open=!fold.open;if(fold.open)document.getElementById('tripTitle')?.focus();}};
    }
    if(friends){[['all','全部','All'],['hiking','徒步','Hiking'],['driving','自驾游','Self-drive'],['city','城市漫游','City walk']].forEach(([id,zh,en])=>setText(friends.querySelector('[data-trip-filter="'+id+'"]'),t(zh,en)));setText(friends.querySelector('[data-trip-publish]'),t('发布同行','Publish trip'));setText(friends.querySelector('[data-journal-compose]'),t('发布旅行计划','Publish a trip'));const type=document.getElementById('journalTripType');if(type){['徒步','自驾游','城市漫游'].forEach((zh,i)=>setText(type.options[i],t(zh,['Hiking','Self-drive','City walk'][i])));type.setAttribute('aria-label',t('旅行类型','Trip type'));}const budget=document.getElementById('journalTripBudget');if(budget)budget.placeholder=t('每人预算（CNY，选填）','Budget per person (CNY, optional)');}
    const messages=document.getElementById('messages');
    if(messages&&!messages.querySelector('.journal-tabs')){const tabs=document.createElement('div');tabs.className='journal-tabs';tabs.innerHTML='<button class="active" data-messages></button><button data-requests></button>';messages.querySelector('.dm-page-head').after(tabs);tabs.querySelector('[data-requests]').onclick=()=>{window.go('friends');document.getElementById('incomingApplications')?.scrollIntoView({block:'center'});};}
    if(messages){setText(messages.querySelector('.title'),t('聊天','Chat'));setText(messages.querySelector('[data-messages]'),t('消息','Messages'));setText(messages.querySelector('[data-requests]'),t('申请','Requests'));companionMount?.();}
    const profile=document.getElementById('profile');if(profile){profile.classList.add('journal-profile');if(!profile.querySelector('.journal-profile-head')){const head=document.createElement('header');head.className='journal-profile-head';head.innerHTML='<h1></h1><button type="button"></button>';profile.prepend(head);head.querySelector('button').onclick=()=>{const settings=profile.querySelector('.profile-settings');settings.hidden=!settings.hidden;if(!settings.hidden)settings.scrollIntoView({block:'start'});};const settings=profile.querySelector('.profile-settings');if(settings)settings.hidden=true;}setText(profile.querySelector('.journal-profile-head h1'),t('我的','My space'));setText(profile.querySelector('.journal-profile-head button'),t('设置','Settings'));}
  }
  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;observer.disconnect();decorate();observer.observe(document.querySelector('.app'),{childList:true,subtree:true});});};
  const observer=new MutationObserver(schedule);decorate();observer.observe(document.querySelector('.app'),{childList:true,subtree:true});
  window.addEventListener('tw-auth-change',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}());
