(function () {
  const style = document.createElement('style');
  style.textContent = '.nav-icon{display:inline-block;font-size:20px;line-height:20px;color:#d17d57;text-shadow:0 1px 0 #fff}.brand-subtitle{font-size:12px;margin-top:3px}.ai-float{position:fixed;z-index:20;right:18px;bottom:92px;width:52px;height:52px;border-radius:50%;background:#173f4f;color:#fff;border:3px solid #fff;box-shadow:0 7px 18px #173f4f33;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:grab;touch-action:none;transition:transform .2s}.ai-float.is-hidden{transform:translateX(42px);opacity:.42}.ai-float::after{content:"AI";position:absolute;bottom:-15px;font-size:9px;color:#173f4f;background:#fff;border-radius:8px;padding:1px 4px}.ai-float-tab{position:fixed;z-index:19;right:0;bottom:120px;width:18px;height:52px;border-radius:10px 0 0 10px;background:#173f4f;color:#fff;display:none;align-items:center;justify-content:center;font-size:10px;cursor:pointer}.ai-float-tab.visible{display:flex}';
  document.head.appendChild(style);
  const ball = document.createElement('button'); ball.className = 'ai-float'; ball.type = 'button'; ball.setAttribute('aria-label', '打开旅行助手'); ball.textContent = '✦';
  const tab = document.createElement('button'); tab.className = 'ai-float-tab'; tab.type = 'button'; tab.textContent = 'AI';
  document.body.appendChild(ball); document.body.appendChild(tab);
  let dragging = false, moved = false, timer, startX, startY, originX, originY;
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function hide() { ball.classList.add('is-hidden'); tab.classList.add('visible'); }
  function show() { ball.classList.remove('is-hidden'); tab.classList.remove('visible'); }
  ball.addEventListener('pointerdown', event => { dragging = true; moved = false; startX = event.clientX; startY = event.clientY; originX = ball.offsetLeft; originY = ball.offsetTop; ball.setPointerCapture(event.pointerId); timer = setTimeout(() => { if (!moved) hide(); }, 720); });
  ball.addEventListener('pointermove', event => { if (!dragging) return; const dx = event.clientX - startX; const dy = event.clientY - startY; if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; clearTimeout(timer); } ball.style.left = clamp(originX + dx, 4, innerWidth - ball.offsetWidth - 4) + 'px'; ball.style.top = clamp(originY + dy, 8, innerHeight - ball.offsetHeight - 8) + 'px'; ball.style.right = 'auto'; ball.style.bottom = 'auto'; });
  ball.addEventListener('pointerup', event => { dragging = false; clearTimeout(timer); if (!moved) { if (typeof go === 'function') go('ai'); } else { const center = ball.offsetLeft + ball.offsetWidth / 2; ball.style.left = (center < innerWidth / 2 ? 8 : innerWidth - ball.offsetWidth - 8) + 'px'; } });
  ball.addEventListener('dblclick', hide); tab.addEventListener('click', show);
}());
