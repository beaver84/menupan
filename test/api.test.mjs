import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import XLSX from 'xlsx';
import { startServer, DEFAULT_PORT, DEFAULT_MENU_PATH } from '../src/app.mjs';

const HEADER = ['메뉴명', '가격', '설명', '품절', '카테고리'];
const silentLogger = { error() {}, warn() {}, info() {} };

function writeMenu(filePath, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  writeFileSync(filePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function setup(t, { sheets, readWorkbook, watch } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'menupan-api-'));
  const menuPath = path.join(dir, 'menu.xlsx');
  const publicDir = path.join(dir, 'public');
  await fs.mkdir(publicDir);
  await fs.writeFile(path.join(publicDir, 'index.html'), '<h1>테스트 메뉴판</h1>');
  writeMenu(menuPath, sheets ?? { 커피: [HEADER, ['아메리카노', 4500, '깔끔한 산미', '', '에스프레소']] });

  const options = { menuPath, publicDir, port: 0, logger: silentLogger };
  if (readWorkbook) options.readWorkbook = readWorkbook;
  if (watch) options.watch = watch;
  const server = await startServer(options);

  t.after(async () => {
    await server.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  return { server, menuPath, publicDir, url: (p) => `http://127.0.0.1:${server.port}${p}` };
}

test('GET /api/menu가 200과 M1 형식의 JSON을 반환한다', async (t) => {
  const { url } = await setup(t);

  const res = await fetch(url('/api/menu'));
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.deepEqual(body, {
    settings: { storeName: '', theme: 'cafe-dark', autoRotateSec: 0 },
    pages: [
      {
        name: '커피',
        items: [
          { name: '아메리카노', price: 4500, description: '깔끔한 산미', soldOut: false, category: '에스프레소' },
        ],
      },
    ],
  });
});

test('두 번째 요청은 파일을 다시 읽지 않고 캐시를 반환한다', async (t) => {
  let reads = 0;
  const readWorkbook = (filePath) => {
    reads += 1;
    return XLSX.readFile(filePath);
  };
  const { url } = await setup(t, { readWorkbook });

  await fetch(url('/api/menu'));
  await fetch(url('/api/menu'));

  assert.equal(reads, 1);
});

test('재로드 호출 후 /api/menu가 새 내용을 반환한다', async (t) => {
  const { server, menuPath, url } = await setup(t);
  writeMenu(menuPath, { 디저트: [HEADER, ['치즈케이크', 6500, '', '', '']] });

  const reloaded = await server.reload();
  const body = await (await fetch(url('/api/menu'))).json();

  assert.equal(reloaded, true);
  assert.deepEqual(body.pages.map((p) => p.name), ['디저트']);
});

test('재로드가 실패(파일 읽기 오류)하면 마지막 정상 결과를 유지한다', async (t) => {
  const { server, menuPath, url } = await setup(t);
  await fs.rm(menuPath);

  const reloaded = await server.reload();
  const res = await fetch(url('/api/menu'));
  const body = await res.json();

  assert.equal(reloaded, false);
  assert.equal(res.status, 200);
  assert.deepEqual(body.pages.map((p) => p.name), ['커피']);
});

test('서버 시작 시 파일이 없으면 파일 경로가 담긴 명확한 에러로 실패한다', async () => {
  const missingPath = path.join(os.tmpdir(), 'menupan-does-not-exist', 'menu.xlsx');

  await assert.rejects(
    startServer({ menuPath: missingPath, port: 0, logger: silentLogger }),
    (err) => err instanceof Error && err.message.includes(missingPath),
  );
});

test('포트가 이미 사용 중이면 EADDRINUSE 에러로 실패한다', async (t) => {
  const { server } = await setup(t);

  await assert.rejects(
    startServer({ port: server.port, logger: silentLogger }),
    (err) => err.code === 'EADDRINUSE',
  );
});

test('GET /가 public/index.html을 반환한다', async (t) => {
  const { url } = await setup(t);

  const res = await fetch(url('/'));
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(html, /테스트 메뉴판/);
});

test('파일 경로와 포트는 주입 가능하고 기본값은 data/menu.xlsx, 3000이다', async (t) => {
  const { server, menuPath } = await setup(t);

  assert.ok(server.port > 0, '포트 0을 주입하면 OS가 할당한 포트를 쓴다');
  assert.notEqual(server.port, DEFAULT_PORT);
  assert.equal(DEFAULT_PORT, 3000);
  assert.deepEqual(
    [path.basename(path.dirname(DEFAULT_MENU_PATH)), path.basename(DEFAULT_MENU_PATH)],
    ['data', 'menu.xlsx'],
  );
  assert.notEqual(menuPath, DEFAULT_MENU_PATH);
});

async function subscribe(url) {
  const res = await fetch(url('/events'));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const received = { text: '' };
  (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        received.text += decoder.decode(value);
      }
    } catch {
      // 연결 종료
    }
  })();
  return { res, received, stop: () => reader.cancel().catch(() => {}) };
}

async function waitFor(predicate, timeoutMs = 3000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor 시간 초과');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('재파싱 성공 시에만 menu-updated 이벤트가 발행된다', async (t) => {
  let onChange;
  const watch = (_filePath, handler) => {
    onChange = handler;
    return { close() {} };
  };
  const { menuPath, url } = await setup(t, { watch });
  const { res, received, stop } = await subscribe(url);
  t.after(stop);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);

  writeMenu(menuPath, { 디저트: [HEADER, ['치즈케이크', 6500, '', '', '']] });
  await onChange();
  await waitFor(() => received.text.includes('event: menu-updated'));
  const afterSuccess = received.text;

  await fs.rm(menuPath);
  await onChange();
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(received.text, afterSuccess, '실패한 재로드는 이벤트를 보내지 않는다');
});

test('통합: xlsx 파일을 덮어쓰면 /events 구독자가 이벤트를 받고 /api/menu가 갱신된다', async (t) => {
  const { menuPath, url } = await setup(t);
  const { received, stop } = await subscribe(url);
  t.after(stop);
  await new Promise((resolve) => setTimeout(resolve, 300));

  writeMenu(menuPath, { 음료: [HEADER, ['자몽에이드', 6000, '', '', '']] });

  await waitFor(() => received.text.includes('event: menu-updated'), 5000);
  const body = await (await fetch(url('/api/menu'))).json();
  assert.deepEqual(body.pages.map((p) => p.name), ['음료']);
});

test('GET /assets/<테마>/<파일>이 PNG 에셋을 반환한다', async (t) => {
  const { url } = await setup(t);

  const res = await fetch(url('/assets/cafe-dark/bg-signage.png'));

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
});
