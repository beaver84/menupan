import { groupByCategory } from './group.mjs';
import { getLayout } from './layout.mjs';
import { assetUrl, resolveTheme } from './themes.mjs';

export function formatPrice(price) {
  return `${price.toLocaleString('ko-KR')}원`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderItem(item) {
  const badge = item.soldOut ? '<span class="badge">품절</span>' : '';
  const classes = item.soldOut ? 'item sold-out' : 'item';

  return `<li class="${classes}">
  <div class="row"><span class="name">${escapeHtml(item.name)}</span>${badge}<span class="leader"></span><span class="price">${formatPrice(item.price)}</span></div>
  <div class="desc">${escapeHtml(item.description)}</div>
</li>`;
}

function renderGroup({ category, items }) {
  const heading = category ? `<h3 class="category">${escapeHtml(category)}</h3>\n` : '';

  return `${heading}<ul class="items">
${items.map(renderItem).join('\n')}
</ul>`;
}

function boardStyle(layout) {
  const fonts = Object.entries(layout.fonts).map(([key, px]) => `--font-${key}:${px}px`);
  return [`--columns:${layout.columns}`, `--u:${layout.u}px`, `--pad:${layout.padding}px`, ...fonts].join(';');
}

export function renderBoard({ settings, page, device }) {
  const layout = getLayout(device);
  const theme = resolveTheme(settings.theme);
  const photo = layout.showPhoto ? '<div class="photo-slot">[ 사진 슬롯 ]</div>' : '';

  return `<div class="board theme-${theme} device-${device}" style="${boardStyle(layout)};width:${layout.width}px;height:${layout.height}px">
  <div class="board-bg" style="background-image:url('${assetUrl(theme, device, 'bg')}')"></div>
  <div class="board-content">
    <h1 class="store">${escapeHtml(settings.storeName)}</h1>
    <h2 class="sheet">${escapeHtml(page.name)}</h2>
    ${photo}
${groupByCategory(page.items).map(renderGroup).join('\n')}
  </div>
  <div class="board-frame" style="background-image:url('${assetUrl(theme, device, 'frame')}')"></div>
</div>`;
}
