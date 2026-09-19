(function () {
  const originalGo=window.go, stack=[];
  if(typeof originalGo!=='function')return;
  window.go=function(id){const current=document.querySelector('.screen.active')?.id;if(current&&current!==id)stack.push(current);originalGo(id);sync();};
  const button=document.createElement('button');button.id='globalBack';button.type='button';button.className='global-back';button.setAttribute('aria-label','返回上一页');button.textContent='← 返回';document.body.appendChild(button);
  const overlay=()=>[...document.querySelectorAll('.landmark-sheet-overlay,.route-detail-overlay,.dm-overlay')].at(-1);
  const scrollTop=()=>{const layer=overlay();if(!layer)return scrollY;return Math.max(layer.scrollTop,...[...layer.querySelectorAll('.dm-history,.dm-profile,.route-detail,.landmark-sheet')].map(node=>node.scrollTop));};
  const sync=()=>button.classList.toggle('visible',scrollTop()>180&&Boolean(overlay()||stack.length));
  const closeOverlay=()=>{const layer=overlay();if(!layer)return false;const close=layer.querySelector('[data-close],#dmProfileBack,#dmBack,.landmark-sheet-back');if(close){close.click();return true}return false;};
  button.onclick=()=>{if(!closeOverlay()){const target=stack.pop();if(target)originalGo(target);else history.back();scrollTo({top:0,behavior:'smooth'});}sync();};
  document.addEventListener('scroll',sync,{passive:true,capture:true});addEventListener('resize',sync);try{new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});}catch(_){}
  document.addEventListener('gesturestart',event=>{if(!event.target.closest('#mapCanvas'))event.preventDefault();},{passive:false});
  addEventListener('wheel',event=>{if(event.ctrlKey&&!event.target.closest('#mapCanvas'))event.preventDefault();},{passive:false});sync();
}());
