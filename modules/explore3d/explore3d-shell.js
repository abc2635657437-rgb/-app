// Boots the West Lake scene inside the app shell.
//
// The explore page was written as a standalone document; in the shell it is one
// of five screens. This module waits until 探索 is actually shown, imports the
// scene then (so the home feed is not competing with a WebGL context), and
// keeps the canvas sized to the screen.

let started = false;

async function startScene() {
  if (started) return;
  started = true;
  try {
    await import('/modules/explore3d/explore3d.js?v=4');
  } catch (error) {
    started = false;
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '3D 场景没有启动：' + error.message;
      status.classList.add('is-visible');
    }
    console.error(error);
  }
}

function onScreen(id) {
  if (id === 'map') {
    startScene();
    // the canvas was laid out at zero size while hidden
    window.dispatchEvent(new Event('resize'));
  }
}

window.addEventListener('tw:screen', event => onScreen(event.detail));
window.addEventListener('load', () => {
  if (document.body.dataset.screen === 'map') onScreen('map');
});
