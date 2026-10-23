(function () {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const photoFallback = '/assets/route-photos/community-photo-fallback.svg';
  const actionIcons = {
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a8 8 0 0 1-8 8 8.7 8.7 0 0 1-4-.9L3 20l1.4-4.1a8 8 0 1 1 16.1-4.4Z"/></svg>',
    favorite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z"/></svg>'
  };
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
  function media(post, options = {}) {
    const items=(post.post_media||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    if(!items.length)return '';
    const displayItems=options.homeFeed?items.slice(0,1):items;
    const mode=options.homeFeed?'feed':'detail';
    if(options.detail){
      const english=window.TravelWorldI18n?.language?.()==='en';
      const slides=items.map((item,index)=>'<div class="post-gallery-slide" role="group" aria-roledescription="slide" aria-label="'+(index+1)+' '+(english?'of':'共')+' '+items.length+'">'+(item.media_type==='video'?'<video controls preload="metadata" aria-label="'+(english?'Travel video ':'旅行视频 ')+(index+1)+'" src="'+safe(item.public_url)+'"></video>':'<button type="button" class="post-media-open" data-post-media="detail" data-post-id="'+safe(post.id)+'" data-media-url="'+safe(item.public_url)+'" aria-label="'+(english?'Open photo ':'查看第 ')+(index+1)+(english?'':' 张图片')+'"><img loading="lazy" decoding="async" draggable="false" src="'+safe(item.public_url)+'" alt="'+safe(post.title||`旅行照片 ${index+1}`)+'" onerror="this.onerror=null;this.src=\''+photoFallback+'\';this.alt=\'旅行照片暂不可用\';this.classList.add(\'is-fallback\')"></button>')+'</div>').join('');
      const pagination=items.length>1?'<nav class="post-gallery-pagination" aria-label="'+(english?'Photo pagination':'照片分页')+'">'+items.map((_,index)=>'<button type="button" data-post-gallery-index="'+index+'" aria-label="'+(english?'Item ':'第 ')+(index+1)+(english?' of ':' 项，共 ')+items.length+(english?'':' 项')+'" aria-current="'+(index===0)+'"><span></span></button>').join('')+'</nav>':'';
      const status=(english?'Item 1 of ':'第 1 项，共 ')+items.length+(english?'':' 项');
      return '<div class="post-gallery post-gallery-carousel '+(items.length>1?'is-multiple':'is-single')+'" data-post-gallery="true"><div class="post-gallery-track" data-post-gallery-track role="region" aria-roledescription="carousel" aria-label="'+(english?'Travel photos':'旅行照片轮播')+'" tabindex="0">'+slides+'</div>'+pagination+'<span class="post-gallery-announcement" data-post-gallery-status aria-live="polite">'+status+'</span></div>';
    }
    return '<div class="post-gallery '+(displayItems.length>1?'is-multiple':'')+'">'+displayItems.map((item,index)=>item.media_type==='video'?'<video controls preload="metadata" src="'+safe(item.public_url)+'"></video>':'<button type="button" class="post-media-open" data-post-media="'+mode+'" data-post-id="'+safe(post.id)+'" data-media-url="'+safe(item.public_url)+'" aria-label="'+(options.homeFeed?'轻点查看旅行分享，快速双击点赞':'查看完整图片')+'"><img loading="lazy" decoding="async" src="'+safe(item.public_url)+'" alt="'+safe(post.title||`旅行照片 ${index+1}`)+'" onerror="this.onerror=null;this.src=\''+photoFallback+'\';this.alt=\'旅行照片暂不可用\';this.classList.add(\'is-fallback\')"></button>').join('')+'</div>';
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
    const likeCount=post.like_count!=null&&Number.isFinite(Number(post.like_count))?Number(post.like_count):likes.length;
    const pendingLike=options.pendingLike??Boolean(window.isCommunityLikePending?.(post.id));
    const pendingFavorite=options.pendingFavorite??Boolean(window.isCommunityFavoritePending?.(post.id));
    const pendingComment=options.pendingComment??Boolean(window.isCommunityCommentPending?.(post.id));
    const id=safe(post.id), title=safe(post.title||'旅行记录'), copy=post.content?'<div class="post-copy">'+safe(post.content)+'</div>':'';
    const location=post.location_name||post.city?'<span class="post-location-tag">'+safe(post.location_name||post.city)+'</span>':'';
    const avatar=profile.avatar_url?'<img src="'+safe(profile.avatar_url)+'" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'post-avatar-fallback\',textContent:\'TW\'}))">':'<span class="post-avatar-fallback">TW</span>';
    const author='<div class="post-author"><button type="button" class="post-author-identity" onclick="openTravelUser(\''+safe(post.author_id)+'\')">'+avatar+'<span><b class="post-author-name">'+safe(name)+'</b><small>'+safe(post.location_name||post.city||'旅行记录')+'</small></span></button>'+(!own&&options.showFollow?'<button type="button" class="post-map" onclick="toggleCommunityFollow(\''+safe(post.author_id)+'\')">'+(followed?'已关注':'关注')+'</button>':'')+'</div>';
    const like='<button type="button" class="post-like-action '+(liked?'is-liked':'')+'" data-post-action="like" aria-label="'+(liked?'取消喜欢':'喜欢')+'，'+likeCount+' 人喜欢" aria-pressed="'+liked+'" '+(pendingLike?'disabled aria-busy="true"':'')+' onclick="toggleCommunityLike(\''+id+'\')">'+actionIcons.like+'<span>喜欢</span><span class="post-action-count">'+likeCount+'</span></button>';
    const favorite='<button type="button" class="post-favorite-action" data-post-action="favorite" aria-label="'+(favorited?'取消收藏':'收藏')+'" aria-pressed="'+Boolean(favorited)+'" '+(pendingFavorite?'disabled aria-busy="true"':'')+' onclick="toggleCommunityFavorite(\''+id+'\')">'+actionIcons.favorite+'<span>'+(favorited?'已收藏':'收藏')+'</span></button>';
    const commentAction='<button type="button" class="post-comment-action" data-post-action="comment" aria-label="评论，共 '+comments.length+' 条" onclick="focusTravelPostComment(\''+id+'\')">'+actionIcons.comment+'<span>评论</span><span class="post-action-count">'+comments.length+'</span></button>';
    const commentValue=options.commentValue==null?'':String(options.commentValue);
    const commentForm='<form class="comment-row" data-comment-form="'+id+'" onsubmit="event.preventDefault();addCommunityComment(\''+id+'\')"><input data-comment-input="'+id+'" aria-label="写下评论" maxlength="1000" autocomplete="off" placeholder="写下你的旅行感受" value="'+safe(commentValue)+'" '+(pendingComment?'disabled':'')+'><button type="submit" data-post-action="send-comment" '+(pendingComment?'disabled aria-busy="true"':'')+'>'+(pendingComment?'发送中…':'评论')+'</button></form>';
    const commentList='<section class="post-comments" aria-labelledby="post-comments-title-'+id+'"><h2 id="post-comments-title-'+id+'">评论 · '+comments.length+'</h2>'+(comments.length?comments.map(item=>'<div><b>'+safe(item.profiles?.display_name||'旅行者')+'</b>：'+safe(item.content)+((item.author_id===uid||own)?'<button type="button" data-comment-delete="'+safe(item.id)+'" aria-label="删除这条评论">删除</button>':'')+'</div>').join(''):'<p class="comments-empty">还没有评论，写下第一条吧。</p>')+'</section>';
    const ownerActions=options.ownerActions?'<div class="post-owner-actions"><button type="button" onclick="event.stopPropagation();editProfilePost(\''+id+'\')">编辑</button><button type="button" onclick="event.stopPropagation();deleteProfilePost(\''+id+'\')">删除</button></div>':'';
    if(options.homeFeed){
      const alt='查看帖子详情：'+title;
      return '<article class="post-card home-feed-card" data-post-id="'+id+'">'+media(post,{homeFeed:true})+'<div class="post-content"><button type="button" class="post-open" data-post-open-trigger="true" onclick="openPostDetail(\''+id+'\')" aria-label="'+safe(alt)+'"><h3 class="post-title">'+title+'</h3>'+copy+location+'</button>'+routeCard(post.route)+ownerActions+'<div class="home-feed-engagement">'+author+'<div class="post-actions">'+like+'</div></div></div></article>';
    }
    if(options.detail){
      const mapAction=post.location_name?'<button type="button" class="post-map" data-community-location="'+safe(post.city||post.location_name)+'">查看地图</button>':'';
      return '<article class="post-card home-feed-card post-detail-card" data-post-id="'+id+'">'+media(post,{detail:true})+'<div class="post-content">'+author+'<h1 class="post-title" id="post-detail-title" data-post-title tabindex="-1">'+title+'</h1>'+copy+location+routeCard(post.route)+'<div class="post-actions">'+like+commentAction+favorite+mapAction+'</div>'+commentForm+commentList+'</div></article>';
    }
    return '<article class="post-card'+(options.compact?' home-feed-card':'')+'" data-post-id="'+id+'">'+media(post)+'<div class="post-content">'+author+'<button type="button" class="post-open" data-post-open-trigger="true" onclick="openPostDetail(\''+id+'\')" aria-label="查看帖子详情"><h3 class="post-title">'+title+'</h3>'+copy+'</button>'+routeCard(post.route)+ownerActions+'<div class="post-actions">'+like+commentAction+favorite+'</div>'+commentForm+commentList+'</div></article>';
  }
  let activeDetail=null, detailRequest=0, detailController=null;
  function setupPostGalleries(root){
    root?.querySelectorAll?.('.post-gallery-carousel:not([data-gallery-ready])').forEach(gallery=>{
      const track=gallery.querySelector('[data-post-gallery-track]');
      const slides=[...(track?.children||[])];
      if(!track||!slides.length)return;
      gallery.dataset.galleryReady='true';
      const dots=[...gallery.querySelectorAll('[data-post-gallery-index]')];
      const status=gallery.querySelector('[data-post-gallery-status]');
      let frame=0,drag=null;
      const announce=()=>{
        frame=0;
        const width=track.clientWidth||1,index=Math.max(0,Math.min(slides.length-1,Math.round(track.scrollLeft/width)));
        dots.forEach((dot,i)=>dot.setAttribute('aria-current',String(i===index)));
        if(status)status.textContent=window.TravelWorldI18n?.language?.()==='en'?'Item '+(index+1)+' of '+slides.length:'第 '+(index+1)+' 项，共 '+slides.length+' 项';
      };
      const goTo=index=>{
        const bounded=Math.max(0,Math.min(slides.length-1,index));
        track.scrollTo({left:slides[bounded].offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
        announce();
      };
      track.addEventListener('scroll',()=>{if(!frame)frame=window.requestAnimationFrame(announce);},{passive:true});
      gallery.addEventListener('click',event=>{
        const dot=event.target.closest?.('[data-post-gallery-index]');
        if(dot)goTo(Number(dot.dataset.postGalleryIndex));
      });
      gallery.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        const index=Math.max(0,Math.min(slides.length-1,Math.round(track.scrollLeft/(track.clientWidth||1))));
        const next=event.key==='ArrowLeft'?index-1:event.key==='ArrowRight'?index+1:event.key==='Home'?0:slides.length-1;
        event.preventDefault();goTo(next);
      });
      track.addEventListener('pointerdown',event=>{
        if(event.pointerType!=='mouse'||event.button!==0||event.target.closest?.('video,.post-gallery-pagination'))return;
        drag={pointerId:event.pointerId,startX:event.clientX,startScroll:track.scrollLeft,moved:false,captured:false};
      });
      track.addEventListener('pointermove',event=>{
        if(!drag||drag.pointerId!==event.pointerId)return;
        const delta=event.clientX-drag.startX;
        if(!drag.moved&&Math.abs(delta)<5)return;
        drag.moved=true;track.classList.add('is-dragging');
        if(!drag.captured){track.setPointerCapture?.(event.pointerId);drag.captured=true;}
        track.scrollLeft=drag.startScroll-delta;event.preventDefault();
      });
      const finishDrag=event=>{
        if(!drag||drag.pointerId!==event.pointerId)return;
        if(drag.moved)gallery.dataset.suppressClickUntil=String(Date.now()+450);
        track.classList.remove('is-dragging');drag=null;
      };
      track.addEventListener('pointerup',finishDrag);
      track.addEventListener('pointercancel',finishDrag);
      track.addEventListener('lostpointercapture',()=>{track.classList.remove('is-dragging');drag=null;});
      announce();
    });
  }
  document.addEventListener('click',event=>{
    const gallery=event.target.closest?.('.post-gallery-carousel');
    if(!gallery)return;
    if(Number(gallery.dataset.suppressClickUntil||0)>Date.now()){
      event.preventDefault();event.stopPropagation();gallery.dataset.suppressClickUntil='0';return;
    }
  },true);
  function favoriteSet(){return window.getCommunityFavoriteIds?.()||new Set();}
  function refreshPostDetail(id,options={}){
    if(!activeDetail||String(activeDetail.id)!==String(id))return;
    const dialog=document.getElementById('postDetailDialog'),body=dialog?.querySelector('.post-detail-content');if(!dialog?.open||!body)return;
    const current=dialog.querySelector('[data-comment-input="'+CSS.escape(String(id))+'"]');
    const value=options.clearComment?'':options.commentValue??current?.value??'';
    const scrollTop=dialog.scrollTop;
    body.innerHTML=card(activeDetail.post,{detail:true,favoriteIds:favoriteSet(),commentValue:value});
    setupPostGalleries(body);
    dialog.scrollTop=scrollTop;
    const focus=options.focusAction==='comment'?dialog.querySelector('[data-comment-input="'+CSS.escape(String(id))+'"]'):options.focusAction?dialog.querySelector('[data-post-action="'+options.focusAction+'"]'):null;
    focus?.focus({preventScroll:true});
  }
  window.openPostDetail=async id=>{
    detailController?.abort();
    const request=++detailRequest;
    const controller=new AbortController(); detailController=controller;
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    let dialog=document.getElementById('postDetailDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='postDetailDialog';dialog.className='post-detail-dialog';
      dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
      dialog.addEventListener('close',()=>{detailRequest++;detailController?.abort();detailController=null;activeDetail=null;});
      document.body.appendChild(dialog);
    }
    activeDetail={id,post:null};
    dialog.setAttribute('aria-label','帖子详情');
    dialog.innerHTML='<button type="button" class="post-detail-close" aria-label="关闭详情" onclick="closePostDetail()">×</button><div class="post-detail-content"><p role="status" class="muted">正在打开旅行分享…</p></div>';
    if(!dialog.open)dialog.showModal();
    try{
      const item=await window.TravelWorldAuth.request('/api/community/posts/'+encodeURIComponent(id),{signal:controller.signal});
      if(request!==detailRequest||!dialog.open)return;
      activeDetail={id,post:item};
      dialog.querySelector('.post-detail-content').innerHTML=card(item,{detail:true,favoriteIds:favoriteSet()});
      setupPostGalleries(dialog.querySelector('.post-detail-content'));
      dialog.setAttribute('aria-labelledby','post-detail-title');
      dialog.querySelector('[data-post-title]')?.focus({preventScroll:true});
    }catch(error){
      if(request!==detailRequest||!dialog.open)return;
      const escapedId=safe(id);
      const message=error?.name==='AbortError'?'等待有点久，这条旅行分享暂时没有响应。请重试。':'这条旅行分享暂时无法打开，请检查网络后重试。';
      dialog.querySelector('.post-detail-content').innerHTML='<div class="post-detail-error"><p role="alert">'+message+'</p><button type="button" onclick="retryPostDetail(\''+escapedId+'\')">重试</button></div>';
    }finally{window.clearTimeout(timeout);if(detailController===controller)detailController=null;}
  };
  window.closePostDetail=()=>document.getElementById('postDetailDialog')?.close();
  window.retryPostDetail=id=>window.openPostDetail(id);
  window.focusTravelPostComment=id=>{const input=[...document.querySelectorAll('[data-comment-input]')].find(node=>node.dataset.commentInput===String(id));if(input){input.scrollIntoView({behavior:'smooth',block:'center'});input.focus({preventScroll:true});}};
  window.openPostMedia=url=>{let dialog=document.getElementById('postMediaDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='postMediaDialog';dialog.className='post-media-dialog';dialog.onclick=event=>{if(event.target===dialog)dialog.close();};document.body.appendChild(dialog);}dialog.innerHTML='<button type="button" aria-label="关闭" onclick="closePostMedia()">×</button><img src="'+safe(url)+'" alt="完整旅行图片">';if(!dialog.open)dialog.showModal();};
  window.closePostMedia=()=>document.getElementById('postMediaDialog')?.close();
  const imageOpenTimers=new WeakMap(), pointerTapTimes=new WeakMap(), pointerDoubleTaps=new WeakSet();
  document.addEventListener('pointerdown',event=>{
    const imageButton=event.target.closest?.('[data-post-media="feed"]');
    if(!imageButton)return;
    const now=Date.now(),last=pointerTapTimes.get(imageButton),timer=imageOpenTimers.get(imageButton);
    if(last&&now-last<500){pointerTapTimes.delete(imageButton);pointerDoubleTaps.add(imageButton);if(timer){clearTimeout(timer);imageOpenTimers.delete(imageButton);}return;}
    pointerTapTimes.set(imageButton,now);
    window.setTimeout(()=>{if(pointerTapTimes.get(imageButton)===now)pointerTapTimes.delete(imageButton);},550);
  },true);
  document.addEventListener('click',event=>{
    const target=event.target;
    const openTrigger=target.closest?.('[data-post-open-trigger]');
    if(openTrigger){const cardNode=openTrigger.closest('.post-card');cardNode?.querySelectorAll('[data-post-media="feed"]').forEach(button=>{const timer=imageOpenTimers.get(button);if(timer){clearTimeout(timer);imageOpenTimers.delete(button);}});}
    const imageButton=target.closest?.('[data-post-media]');
    if(imageButton){
      event.preventDefault();
      if(imageButton.dataset.postMedia!=='feed'){window.openPostMedia(imageButton.dataset.mediaUrl);return;}
      const postId=imageButton.dataset.postId;
      if(event.detail===0){window.openPostDetail(postId);return;}
      if(pointerDoubleTaps.has(imageButton)){pointerDoubleTaps.delete(imageButton);window.likeCommunityPost?.(postId);return;}
      const pending=imageOpenTimers.get(imageButton);
      if(pending){clearTimeout(pending);imageOpenTimers.delete(imageButton);window.likeCommunityPost?.(postId);return;}
      imageOpenTimers.set(imageButton,setTimeout(()=>{imageOpenTimers.delete(imageButton);window.openPostDetail(postId);},520));
    }
    const mapButton=target.closest?.('[data-community-location]');
    if(mapButton){window.openCommunityLocation?.(mapButton.dataset.communityLocation);return;}
    const deleteButton=target.closest?.('[data-comment-delete]');
    if(deleteButton){window.deleteCommunityComment?.(deleteButton.dataset.commentDelete);}
  });
  window.TravelPostUI={safe,card,routeCard,routeStats,points,get:id=>registry.get(id),all:()=>[...registry.values()],getActiveDetail:id=>activeDetail&&String(activeDetail.id)===String(id)?activeDetail.post:null,refreshDetail:refreshPostDetail};
}());
