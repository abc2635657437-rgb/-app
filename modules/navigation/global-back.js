(function () {
  const originalGo=window.go, stack=[];
  if(typeof originalGo!=='function')return;
  window.go=function(id){const current=document.querySelector('.screen.active')?.id;if(current&&current!==id)stack.push(current);originalGo(id);sync();};
  const button=document.createElement('button');button.id='globalBack';button.type='button';button.className='global-back';button.setAttribute('aria-label','返回上一页');button.textContent='← 返回';document.body.appendChild(button);
  const sync=()=>button.classList.toggle('visible',scrollY>220&&stack.length>0&&!document.querySelector('.dm-overlay,.route-detail-overlay,.landmark-sheet-overlay'));
  button.onclick=()=>{const target=stack.pop();if(target)originalGo(target);else history.back();scrollTo({top:0,behavior:'smooth'});sync();};
  addEventListener('scroll',sync,{passive:true});addEventListener('resize',sync);sync();
}());
