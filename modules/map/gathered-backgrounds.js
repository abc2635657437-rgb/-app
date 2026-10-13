(function () {
  const ids={'cn-great-wall':'Q12501','fr-eiffel':'Q243','in-taj-mahal':'Q9141','fr-louvre':'Q19675','us-liberty':'Q9202','au-opera':'Q45178','cn-west-lake':'Q10866444'};
  const artwork=fetch('/modules/data/place-backgrounds.json?v=1').then(r=>{if(!r.ok)throw Error('Background registry unavailable');return r.json();}).then(d=>d.backgrounds).catch(()=>({}));
  const sheet=window.showLandmark;
  let request=0;
  window.showLandmark=async source=>{
    const sequence=++request,registry=await artwork;
    if(sequence!==request)return;
    const art=registry[ids[source.id]],english=()=>window.TravelWorldI18n?.language?.()==='en';
    sheet(art?{...source,image:art.image.replace('gathered-background.png','source.jpg'),photos:[]}:source);
    if(!art)return;
    const panel=document.querySelector('#landmarkDetailOverlay .landmark-sheet');if(!panel)return;
    panel.classList.add('gathered-landmark');panel.style.setProperty('--gathered-art','url("'+art.image+'")');
    const credit=document.createElement('p');credit.className='gathered-credit';
    credit.append((english()?'Gathered artistic background · source photograph: ':'Gathered 艺术衍生背景 · 源图：')+art.sourceAuthor+' · '+art.license+' · ');
    const link=document.createElement('a');link.href=art.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=english()?'Source and attribution':'来源与署名';credit.append(link);panel.append(credit);
    const license=document.createElement('a');license.href=art.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';license.textContent=art.license;credit.append(' · ',license);
    const picture=panel.querySelector('.landmark-sheet-gallery figcaption');if(picture)picture.textContent=art.sourceAuthor+' · '+art.license;
  };
  const css=document.createElement('link');css.rel='stylesheet';css.href='/modules/map/gathered-backgrounds.css?v=1';document.head.append(css);
}());
