import { getLayout, pickDevice } from './layout.mjs';
import { createMenuClient } from './menu-client.mjs';
import { renderBoard } from './render.mjs';
import { createRotator } from './rotate.mjs';

const root = document.getElementById('board-root');
let menu = null;

const rotator = createRotator({ onChange: draw });

function draw() {
  if (!menu || menu.pages.length === 0) return;

  const device = pickDevice(window.innerWidth, window.innerHeight);
  const { width, height } = getLayout(device);
  const scale = Math.min(window.innerWidth / width, window.innerHeight / height);

  root.innerHTML = renderBoard({ settings: menu.settings, page: menu.pages[rotator.index], device });
  root.style.width = `${width * scale}px`;
  root.style.height = `${height * scale}px`;
  root.firstElementChild.style.transform = `scale(${scale})`;
  document.title = menu.settings.storeName || '메뉴판';
}

createMenuClient({
  onData(data) {
    menu = data;
    rotator.update({ pageCount: data.pages.length, autoRotateSec: data.settings.autoRotateSec });
    draw();
  },
}).start();

window.addEventListener('resize', draw);
