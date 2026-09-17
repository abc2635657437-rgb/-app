(function () {
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  window.showLandmark=item=>{
    window.currentMapLandmark=item;
    const root=document.getElementById('landmarkCard');if(!root)return;
    const photos=[...(item.image?[{url:item.image,title:item.name,source:'Travel World'}]:[]),...(item.photos||[])].filter((photo,index,list)=>list.findIndex(other=>other.url===photo.url)===index).slice(0,6);
    root.innerHTML='<article class="landmark-detail"><header><span class="landmark-icon">'+safe(item.icon)+'</span><div><small>'+safe(item.country)+' · '+safe(item.city)+'</small><h2>'+safe(item.name)+'</h2></div><b>★ '+safe(item.rating)+'</b></header>'+(photos.length?'<div class="landmark-gallery">'+photos.map((photo,index)=>'<figure class="'+(index===0?'featured':'')+'"><img src="'+safe(photo.url)+'" loading="lazy" decoding="async" alt="'+safe(photo.title||item.name)+'"><figcaption>'+safe(photo.author||photo.source||'实景图片')+(photo.fullUrl?' · <a href="'+safe(photo.fullUrl)+'" target="_blank" rel="noopener">来源</a>':'')+'</figcaption></figure>').join('')+'</div>':'<div class="landmark-photo-loading">热门图片暂时不可用</div>')+'<p>'+safe(item.description)+'</p><div class="landmark-tags">'+(item.tags||[]).map(tag=>'<span>'+safe(tag)+'</span>').join('')+'<span>推荐 '+safe(item.bestSeason)+'</span></div><div class="landmark-actions"><button class="btn" onclick="addLandmark(\''+item.id+'\')">加入我的路线</button><button class="btn alt" onclick="planLandmarkWithAi(\''+item.id+'\')">AI 规划这里</button></div><small class="landmark-source">热门实景图片由 Wikimedia Commons 提供，版权归各作者所有。</small></article>';
  };
}());
