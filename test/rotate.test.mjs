import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRotator } from '../public/rotate.mjs';

function setup(t) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const onChange = mock.fn();
  const rotator = createRotator({ onChange });
  t.after(() => rotator.stop());
  return { rotator, onChange };
}

test('autoRotateSec가 0이면 타이머가 시작되지 않는다', (t) => {
  const { rotator, onChange } = setup(t);

  rotator.update({ pageCount: 3, autoRotateSec: 0 });
  t.mock.timers.tick(60_000);

  assert.equal(onChange.mock.callCount(), 0);
  assert.equal(rotator.index, 0);
});

test('양수면 해당 초마다 다음 페이지 인덱스로 이동한다', (t) => {
  const { rotator, onChange } = setup(t);

  rotator.update({ pageCount: 3, autoRotateSec: 5 });
  t.mock.timers.tick(4_999);
  assert.equal(rotator.index, 0);
  t.mock.timers.tick(1);

  assert.equal(rotator.index, 1);
  assert.deepEqual(onChange.mock.calls.map((c) => c.arguments[0]), [1]);
});

test('마지막 페이지 다음은 첫 페이지로 돌아간다', (t) => {
  const { rotator } = setup(t);

  rotator.update({ pageCount: 3, autoRotateSec: 5 });
  t.mock.timers.tick(15_000);

  assert.equal(rotator.index, 0);
});

test('데이터 갱신 후에도 현재 페이지 인덱스가 유지된다', (t) => {
  const { rotator } = setup(t);
  rotator.update({ pageCount: 3, autoRotateSec: 5 });
  t.mock.timers.tick(5_000);
  assert.equal(rotator.index, 1);

  rotator.update({ pageCount: 3, autoRotateSec: 5 });

  assert.equal(rotator.index, 1);
});

test('갱신으로 페이지 수가 줄어 인덱스가 범위를 넘으면 마지막 페이지로 보정된다', (t) => {
  const { rotator } = setup(t);
  rotator.update({ pageCount: 4, autoRotateSec: 5 });
  t.mock.timers.tick(15_000);
  assert.equal(rotator.index, 3);

  rotator.update({ pageCount: 2, autoRotateSec: 5 });

  assert.equal(rotator.index, 1);
});

test('설정이 바뀌면 기존 타이머가 정리되고 새 주기로 재시작된다', (t) => {
  const { rotator, onChange } = setup(t);
  rotator.update({ pageCount: 5, autoRotateSec: 10 });
  t.mock.timers.tick(4_000);

  rotator.update({ pageCount: 5, autoRotateSec: 3 });
  t.mock.timers.tick(3_000);

  assert.equal(rotator.index, 1);
  assert.equal(onChange.mock.callCount(), 1);
  t.mock.timers.tick(6_000);
  assert.equal(rotator.index, 3);
});

test('자동 전환을 끄면 타이머가 정리된다', (t) => {
  const { rotator, onChange } = setup(t);
  rotator.update({ pageCount: 3, autoRotateSec: 5 });

  rotator.update({ pageCount: 3, autoRotateSec: 0 });
  t.mock.timers.tick(30_000);

  assert.equal(onChange.mock.callCount(), 0);
});
