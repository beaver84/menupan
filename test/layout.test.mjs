import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICES, getLayout } from '../public/layout.mjs';

test('디바이스 프리셋 4종의 치수가 정의되어 있다', () => {
  assert.deepEqual(DEVICES, {
    signage: { width: 1080, height: 1920 },
    'tablet-land': { width: 1920, height: 1440 },
    'tablet-port': { width: 1440, height: 1920 },
    mobile: { width: 1080, height: 2160 },
  });
});

test('기준 단위 u = min(w, h)로 패딩과 폰트 크기가 계산된다', () => {
  const signage = getLayout('signage');
  assert.equal(signage.u, 1080);
  assert.equal(signage.padding, 92); // 1080 * 0.085
  assert.deepEqual(signage.fonts, { eyebrow: 19, store: 63, sheet: 32, name: 32, price: 32, desc: 20 });

  const tabletLand = getLayout('tablet-land');
  assert.equal(tabletLand.u, 1440);
  assert.equal(tabletLand.padding, 122); // 1440 * 0.085
});

test('tablet-land는 2열·사진 슬롯 숨김, 그 외는 1열·사진 슬롯 표시다', () => {
  assert.deepEqual(
    ['tablet-land', 'signage', 'tablet-port', 'mobile'].map((d) => {
      const { columns, showPhoto } = getLayout(d);
      return [d, columns, showPhoto];
    }),
    [
      ['tablet-land', 2, false],
      ['signage', 1, true],
      ['tablet-port', 1, true],
      ['mobile', 1, true],
    ],
  );
});

test('알 수 없는 디바이스는 에러를 던진다', () => {
  assert.throws(() => getLayout('watch'), /watch/);
});
