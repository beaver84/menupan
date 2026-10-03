import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, renderBoard } from '../public/render.mjs';
import { createMenuClient } from '../public/menu-client.mjs';

const settings = { storeName: '빌런 커피', theme: 'cafe-dark', autoRotateSec: 0 };
const page = {
  name: '커피',
  items: [
    { name: '아메리카노', price: 4500, description: '깔끔한 산미', soldOut: false, category: '' },
    { name: '디카페인 아메리카노', price: 5000, description: '스위스 워터', soldOut: true, category: '' },
  ],
};

test('가격 포맷이 4,500원 형태다', () => {
  assert.equal(formatPrice(4500), '4,500원');
  assert.equal(formatPrice(12000), '12,000원');
});

test('품절 항목은 sold-out 클래스와 "품절" 배지를 가진다', () => {
  const html = renderBoard({ settings, page, device: 'signage' });

  const items = html.match(/<li class="item[^"]*"[\s\S]*?<\/li>/g);
  assert.equal(items.length, 2);
  assert.doesNotMatch(items[0], /sold-out/);
  assert.doesNotMatch(items[0], /badge/);
  assert.match(items[1], /class="item sold-out"/);
  assert.match(items[1], /<span class="badge">품절<\/span>/);
});

test('페이지 데이터가 매장명, 시트 이름, 항목 목록 마크업으로 렌더링된다', () => {
  const html = renderBoard({ settings, page, device: 'signage' });

  assert.match(html, /빌런 커피/);
  assert.match(html, /커피/);
  assert.match(html, /아메리카노/);
  assert.match(html, /4,500원/);
  assert.match(html, /깔끔한 산미/);
});

test('이름과 설명의 HTML 특수문자는 이스케이프된다', () => {
  const html = renderBoard({
    settings,
    page: { name: 'x', items: [{ name: '<b>해킹</b>', price: 1000, description: '"&"', soldOut: false, category: '' }] },
    device: 'signage',
  });

  assert.doesNotMatch(html, /<b>해킹/);
  assert.match(html, /&lt;b&gt;해킹&lt;\/b&gt;/);
  assert.match(html, /&quot;&amp;&quot;/);
});

test('디바이스에 따라 사진 슬롯과 열 수가 달라진다', () => {
  const land = renderBoard({ settings, page, device: 'tablet-land' });
  const port = renderBoard({ settings, page, device: 'tablet-port' });

  assert.doesNotMatch(land, /photo-slot/);
  assert.match(land, /--columns:\s*2/);
  assert.match(port, /photo-slot/);
  assert.match(port, /--columns:\s*1/);
});

function fakeClient() {
  const listeners = {};
  const eventSource = { addEventListener: (name, fn) => (listeners[name] = fn) };
  const responses = [{ pages: ['v1'] }, { pages: ['v2'] }];
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { json: async () => responses.shift() };
  };
  return { listeners, eventSource, fetchImpl, calls };
}

test('시작하면 /api/menu를 가져와 렌더링하고, menu-updated 수신 시 다시 가져와 재렌더링한다', async () => {
  const { listeners, eventSource, fetchImpl, calls } = fakeClient();
  const received = [];
  const client = createMenuClient({
    fetchImpl,
    createEventSource: (url) => {
      calls.push(url);
      return eventSource;
    },
    onData: (data) => received.push(data),
  });

  await client.start();
  assert.deepEqual(received, [{ pages: ['v1'] }]);

  await listeners['menu-updated']();
  assert.deepEqual(received, [{ pages: ['v1'] }, { pages: ['v2'] }]);
  assert.deepEqual(calls, ['/api/menu', '/events', '/api/menu']);
});
