let country='',page=0,requestId=0,lastRegion='',root;
const t=(zh,en)=>window.TravelWorldI18n?.language?.()==='en'?en:zh;
const english=()=>window.TravelWorldI18n?.language?.()==='en';
export async function renderDestinationDirectory(region){
  root=document.getElementById('whereNowGrid');if(!root)return;
  if(region!==lastRegion){lastRegion=region;country='';page=0;}
  const sequence=++requestId;root.replaceChildren();
  let controls=document.getElementById('destinationCountryControls');if(!controls){controls=document.createElement('div');controls.id='destinationCountryControls';root.before(controls);}controls.replaceChildren();
  const feedback=document.createElement('p');feedback.className='destination-feedback';feedback.setAttribute('role','status');feedback.textContent=t('正在载入真实地点与照片…','Loading sourced places and photographs…');root.append(feedback);
  try{
    const response=await fetch('/api/map/destinations?region='+encodeURIComponent(region)+'&country='+country+'&page='+page),data=await response.json();if(sequence!==requestId)return;if(!response.ok)throw new Error();
    const names=new Intl.DisplayNames([t('zh','en')],{type:'region'}),label=document.createElement('label');label.textContent=t('国家 / 地区','Country / region');const select=document.createElement('select');select.setAttribute('aria-label',label.textContent);
    [['',t('全部国家 / 地区','All countries / regions')],...data.countries.map(code=>[code,names.of(code)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;option.selected=value===country;select.append(option);});select.onchange=()=>{country=select.value;page=0;renderDestinationDirectory(region);};label.append(select);controls.append(label);
    const total=document.createElement('small');total.textContent=data.total+t(' 个有来源的地点 · 景点目录，非完整行程',' sourced places · place directory, not full itineraries');controls.append(total);
    if(!data.places.length){feedback.textContent=t('该筛选暂无地点资料。','No places match this filter.');return;}
    const photosResponse=await fetch('/api/map/place-images?w=1280&ids='+data.places.map(p=>p.id).join('|'),{signal:AbortSignal.timeout(30000)}),photosData=await photosResponse.json();if(sequence!==requestId)return;if(!photosResponse.ok)throw new Error();
    root.replaceChildren();let count=0;
    data.places.forEach(place=>{const photo=photosData.photos?.[place.id];if(!photo)return;count++;
      const isEnglish=english();
      const displayName=isEnglish?(place.name_en||place.name):(place.name||place.name_en);
      const countryName=names.of(place.countryCode)||'';
      const card=document.createElement('button');card.type='button';card.className='destination-photo-card';
      const media=document.createElement('span');media.className='destination-photo-media is-loading';
      const image=document.createElement('img');
      image.src=photo.url;if(photo.srcset)image.srcset=photo.srcset;image.sizes='(max-width:520px) 46vw, 240px';
      image.alt=displayName;
      image.loading='lazy';image.decoding='async';image.width=800;image.height=600;
      const year=(photo.date||'').match(/\b(20\d{2})\b/);const badge=document.createElement('span');badge.className='destination-photo-year';
      if(year&&Number(year[1])>=2023){badge.textContent=year[1];media.append(badge);}
      media.append(image);
      const caption=document.createElement('span');caption.className='destination-photo-copy';
      const title=document.createElement('strong');title.textContent=displayName;
      const location=document.createElement('small');
      location.textContent=isEnglish?[countryName,place.destinationCity||place.city].filter(Boolean).join(' · '):countryName;
      caption.append(title,location);card.append(media,caption);
      card.onclick=()=>window.openSourcedMapPlace?.({...place,destinationCity:place.destinationCity},photo);
      image.onload=()=>media.classList.remove('is-loading');
      image.onerror=()=>{media.remove();const note=document.createElement('small');note.className='destination-photo-missing';note.textContent=t('照片暂不可用','Photograph unavailable');card.prepend(note);};
      root.append(card);
    });
    if(!count){feedback.textContent=t('本页地点暂无已关联的授权照片，请翻页查看。','No licensed photographs are linked on this page. Try the next page.');root.append(feedback);}
    const pagination=document.createElement('nav');pagination.className='destination-pagination';pagination.setAttribute('aria-label',t('地点分页','Destination pages'));
    const previous=document.createElement('button'),next=document.createElement('button'),position=document.createElement('span');previous.textContent=t('上一页','Previous');previous.disabled=page===0;previous.onclick=()=>{page--;renderDestinationDirectory(region);};next.textContent=t('更多地点','More places');next.disabled=(page+1)*data.pageSize>=data.total;next.onclick=()=>{page++;renderDestinationDirectory(region);};position.textContent=(page+1)+' / '+Math.max(1,Math.ceil(data.total/data.pageSize));pagination.append(previous,position,next);root.append(pagination);
    const credit=document.createElement('small');credit.className='destination-source-note';credit.textContent=t('全球热门城市候选：按目录提供的知名度分值排序（不是游客量排名）。照片为 Wikimedia Commons 的授权实拍，高清版本按屏幕自动选择，作者与许可见地点详情；2023 年后的照片会标出拍摄年份。地点数据：Audiala · CC BY 4.0。','Popular-city candidates ranked by the catalogue’s notability score (not visitor counts). Photographs are licensed Wikimedia Commons images, served at screen-appropriate resolution; authorship and licence are shown on the place page, and photographs taken since 2023 carry their year. Place data: Audiala · CC BY 4.0.');root.append(credit);
  }catch(_){if(sequence===requestId){feedback.textContent=t('照片资料暂时无法载入，请重试。','Photographs could not load. Please retry.');const retry=document.createElement('button');retry.textContent=t('重试','Retry');retry.onclick=()=>renderDestinationDirectory(region);root.replaceChildren(feedback,retry);}}
}
