(function () {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const registry=new Map();
  const points = route => (route?.trip_days || []).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).flatMap(day => (day.trip_places || []).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)));
  const routeStats = route => {
    const distance = Number(route?.distance_meters || 0), duration = Number(route?.duration_seconds || 0), count = points(route).length;
    return [count ? count + ' 站' : '', distance ? (distance / 1000).toFixed(distance > 10000 ? 0 : 1) + ' km' : '', duration ? Math.max(1, Math.round(duration / 60)) + ' 分钟' : ''].filter(Boolean).join(' · ');
  };
  function routeSketch(route) {
    let coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) coords = points(route).map(point => [Number(point.longitude), Number(point.latitude)]);
    coords = (coords || []).filter(pair => Number.isFinite(pair?.[0]) && Number.isFinite(pair?.[1]));
    if (coords.length < 2) return '<div class="route-sketch route-sketch-empty">路线坐标待完善</div>';
    const xs=coords.map(c=>c[0]), ys=coords.map(c=>c[1]), minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys), dx=maxX-minX||1, dy=maxY-minY||1;
    const sampled=coords.filter((_,i)=>i%Math.max(1,Math.floor(coords.length/80))===0 || i===coords.length-1);
    const line=sampled.map(c=>`${10+(c[0]-minX)/dx*280},${110-(c[1]-minY)/dy*90}`).join(' ');
    return '<svg class="route-sketch" viewBox="0 0 300 120" role="img" aria-label="路线缩略图"><path d="M0 82 Q70 35 130 78 T300 55" class="route-land"/><polyline points="'+line+'"/><circle cx="'+line.split(' ')[0].replace(',','" cy="')+'" r="5"/><circle cx="'+line.split(' ').at(-1).replace(',','" cy="')+'" r="5"/></svg>';
  }
  function media(post) {
    const items=(post.post_media||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    if(!items.length)return '';
    return '<div class="post-gallery '+(items.length>1?'is-multiple':'')+'">'+items.map((item,index)=>item.media_type==='video'?'<video controls preload="metadata" src="'+safe(item.public_url)+'"></video>':'<img loading="lazy" decoding="async" src="'+safe(item.public_url)+'" alt="'+safe(post.title||`旅行照片 ${index+1}`)+'">').join('')+'</div>';
  }
  function routeCard(route) {
    if(!route)return '';
    const list=points(route).slice(0,4).map(point=>safe(point.name)).join(' → ');
    return '<button class="post-route-card" onclick="event.stopPropagation();openRouteDetail(\''+route.id+'\')">'+routeSketch(route)+'<span><small>TRAVEL ROUTE</small><b>'+safe(route.title||'旅行路线')+'</b><em>'+safe(list||route.destination||'打开查看路线')+'</em><i>'+safe(routeStats(route))+'　查看详情 →</i></span></button>';
  }
  function card(post, options={}) {
    registry.set(post.id,post);
    const profile=post.profiles||post.owner||{}, name=profile.display_name||profile.username||'旅行者', uid=window.TravelWorldAuth?.session?.()?.user?.id, comments=post.comments||[], likes=post.post_likes||[];
    const liked=likes.some(item=>item.user_id===uid), followed=options.followingIds?.has(post.author_id), favorited=options.favoriteIds?.has(post.id), own=post.author_id===uid;
    const title=post.title?'<h3 class="post-title">'+safe(post.title)+'</h3>':'', copy=post.content?'<div class="post-copy">'+safe(post.content)+'</div>':'';
    const ownerActions=options.ownerActions?'<div class="post-owner-actions"><button onclick="event.stopPropagation();editProfilePost(\''+post.id+'\')">编辑</button><button onclick="event.stopPropagation();deleteProfilePost(\''+post.id+'\')">删除</button></div>':'';
    return '<article class="post-card" data-post-id="'+post.id+'">'+media(post)+'<div class="post-content"><div class="post-author"><button class="post-author-identity" onclick="openTravelUser(\''+post.author_id+'\')">'+(profile.avatar_url?'<img src="'+safe(profile.avatar_url)+'" alt="">':'<span class="post-avatar-fallback">TW</span>')+'<span><b class="post-author-name">'+safe(name)+'</b><small>'+safe(post.location_name||post.city||'旅行记录')+'</small></span></button>'+(!own&&options.showFollow?'<button class="post-map" onclick="toggleCommunityFollow(\''+post.author_id+'\')">'+(followed?'已关注':'关注')+'</button>':'')+'</div><button class="post-open" onclick="openPostDetail(\''+post.id+'\')" aria-label="查看帖子详情">'+title+copy+'</button>'+routeCard(post.route)+ownerActions+'<div class="post-actions"><button class="'+(liked?'is-liked':'')+'" onclick="toggleCommunityLike(\''+post.id+'\')">'+(liked?'♥':'♡')+' '+likes.length+'</button><button onclick="toggleCommunityFavorite(\''+post.id+'\')">'+(favorited?'★ 已收藏':'☆ 收藏')+'</button><span>评论 '+comments.length+'</span>'+(post.location_name?'<button onclick="openCommunityLocation(\''+safe(post.city||post.location_name)+'\')">地图</button>':'')+'</div><div class="comment-row"><input data-comment-input="'+post.id+'" placeholder="写下你的旅行感受"><button onclick="addCommunityComment(\''+post.id+'\')">评论</button></div>'+(comments.length?'<div class="post-comments">'+comments.slice(-4).map(c=>'<div>· <b>'+safe(c.profiles?.display_name||'旅行者')+'</b>：'+safe(c.content)+((c.author_id===uid||own)?'<button onclick="deleteCommunityComment(\''+c.id+'\')">删除</button>':'')+'</div>').join('')+'</div>':'')+'</div></article>';
  }
  window.openPostDetail=async id=>{
    let dialog=document.getElementById('postDetailDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='postDetailDialog';dialog.className='content-dialog';document.body.appendChild(dialog);}
    dialog.innerHTML='<button class="dialog-close" onclick="postDetailDialog.close()">×</button><div class="muted">正在加载完整内容…</div>';dialog.showModal();
    try{const item=await window.TravelWorldAuth.request('/api/community/posts/'+id);dialog.innerHTML='<button class="dialog-close" onclick="postDetailDialog.close()">×</button>'+card(item,{showFollow:false});}catch(error){dialog.innerHTML='<button class="dialog-close" onclick="postDetailDialog.close()">×</button><p>'+safe(error.message)+'</p>';}
  };
  window.TravelPostUI={safe,card,routeCard,routeStats,points,get:id=>registry.get(id)};
}());
