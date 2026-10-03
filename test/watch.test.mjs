import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from '../src/watch.mjs';

test('300ms 안에 변경 이벤트가 여러 번 와도 핸들러는 1회만 호출된다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const handler = mock.fn();
  const onChange = debounce(handler, 300);

  onChange();
  t.mock.timers.tick(100);
  onChange();
  t.mock.timers.tick(100);
  onChange();
  t.mock.timers.tick(300);

  assert.equal(handler.mock.callCount(), 1);
});

test('300ms 간격을 두고 온 변경 이벤트는 각각 호출된다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const handler = mock.fn();
  const onChange = debounce(handler, 300);

  onChange();
  t.mock.timers.tick(300);
  onChange();
  t.mock.timers.tick(300);

  assert.equal(handler.mock.callCount(), 2);
});
