import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createSseHub } from '../src/sse.mjs';

function fakeConnection() {
  const req = new EventEmitter();
  const res = {
    status: null,
    headers: null,
    chunks: [],
    ended: false,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    write(chunk) {
      this.chunks.push(chunk);
    },
    end() {
      this.ended = true;
    },
  };
  return { req, res, text: () => res.chunks.join('') };
}

test('SSE 연결 시 text/event-stream 헤더가 설정되고 연결이 유지된다', () => {
  const hub = createSseHub();
  const { req, res } = fakeConnection();

  hub.connect(req, res);

  assert.equal(res.status, 200);
  assert.equal(res.headers['Content-Type'], 'text/event-stream');
  assert.equal(res.headers['Cache-Control'], 'no-cache');
  assert.equal(res.headers['Connection'], 'keep-alive');
  assert.equal(res.ended, false);
});

test('브로드캐스트 시 연결된 모든 클라이언트가 event: menu-updated를 받는다', () => {
  const hub = createSseHub();
  const a = fakeConnection();
  const b = fakeConnection();
  hub.connect(a.req, a.res);
  hub.connect(b.req, b.res);

  hub.broadcast('menu-updated');

  for (const client of [a, b]) {
    assert.match(client.text(), /event: menu-updated\ndata: .*\n\n/);
  }
});

test('연결이 끊긴 클라이언트는 목록에서 제거된다', () => {
  const hub = createSseHub();
  const a = fakeConnection();
  const b = fakeConnection();
  hub.connect(a.req, a.res);
  hub.connect(b.req, b.res);
  assert.equal(hub.size, 2);

  a.req.emit('close');
  hub.broadcast('menu-updated');

  assert.equal(hub.size, 1);
  assert.doesNotMatch(a.text(), /menu-updated/);
  assert.match(b.text(), /menu-updated/);
});
