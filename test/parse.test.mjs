import { test } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { parseWorkbook } from '../src/parse.mjs';

const HEADER = ['메뉴명', '가격', '설명', '품절', '카테고리'];

function buildWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return wb;
}

function menuSheet(...rows) {
  return [HEADER, ...rows];
}

test('일반 시트 1개가 페이지 1개가 되고 시트 이름이 name이 된다', () => {
  const wb = buildWorkbook({ 커피: menuSheet(['아메리카노', 4500, '깔끔한 산미', '', '에스프레소']) });

  const { pages } = parseWorkbook(wb);

  assert.equal(pages.length, 1);
  assert.equal(pages[0].name, '커피');
});

test('시트가 여러 개면 시트 순서대로 페이지가 된다', () => {
  const wb = buildWorkbook({
    커피: menuSheet(['아메리카노', 4500, '', '', '']),
    디저트: menuSheet(['치즈케이크', 6500, '', '', '']),
    음료: menuSheet(['자몽에이드', 6000, '', '', '']),
  });

  const { pages } = parseWorkbook(wb);

  assert.deepEqual(pages.map((p) => p.name), ['커피', '디저트', '음료']);
});

test('_ 접두사 시트는 페이지에서 제외된다', () => {
  const wb = buildWorkbook({
    커피: menuSheet(['아메리카노', 4500, '', '', '']),
    _설정: [['항목', '값'], ['매장명', '빌런 커피']],
    _메모: [['아무 내용']],
  });

  const { pages } = parseWorkbook(wb);

  assert.deepEqual(pages.map((p) => p.name), ['커피']);
});

test('헤더 메뉴명/가격/설명/품절/카테고리가 name/price/description/soldOut/category로 매핑된다', () => {
  const wb = buildWorkbook({ 커피: menuSheet(['아메리카노', 4500, '깔끔한 산미', '', '에스프레소']) });

  const { pages } = parseWorkbook(wb);

  assert.deepEqual(pages[0].items, [
    { name: '아메리카노', price: 4500, description: '깔끔한 산미', soldOut: false, category: '에스프레소' },
  ]);
});

test('가격은 숫자(number)로 변환된다', () => {
  const wb = buildWorkbook({ 커피: menuSheet(['아메리카노', '4500', '', '', '']) });

  const { pages } = parseWorkbook(wb);

  assert.strictEqual(pages[0].items[0].price, 4500);
});

test('품절이 Y/y면 soldOut true, 빈칸이면 false다', () => {
  const wb = buildWorkbook({
    커피: menuSheet(
      ['디카페인 아메리카노', 5000, '', 'Y', ''],
      ['플랫 화이트', 5500, '', 'y', ''],
      ['카페라떼', 5000, '', '', ''],
    ),
  });

  const { pages } = parseWorkbook(wb);

  assert.deepEqual(pages[0].items.map((i) => i.soldOut), [true, true, false]);
});

test('메뉴명이 빈 행은 무시된다', () => {
  const wb = buildWorkbook({
    커피: menuSheet(
      ['아메리카노', 4500, '', '', ''],
      ['', 5000, '이름 없는 행', '', ''],
      ['카페라떼', 5000, '', '', ''],
    ),
  });

  const { pages } = parseWorkbook(wb);

  assert.deepEqual(pages[0].items.map((i) => i.name), ['아메리카노', '카페라떼']);
});

test('가격이 숫자가 아닌 행은 제외되고 예외를 던지지 않는다', () => {
  const wb = buildWorkbook({
    커피: menuSheet(
      ['아메리카노', '₩4,500', '', '', ''],
      ['카페라떼', 5000, '', '', ''],
    ),
  });

  let result;
  assert.doesNotThrow(() => {
    result = parseWorkbook(wb);
  });
  assert.deepEqual(result.pages[0].items.map((i) => i.name), ['카페라떼']);
});

test('_설정 시트(항목/값)가 settings(storeName, theme, autoRotateSec)로 변환된다', () => {
  const wb = buildWorkbook({
    커피: menuSheet(['아메리카노', 4500, '', '', '']),
    _설정: [['항목', '값'], ['매장명', '빌런 커피'], ['테마', 'bistro-light'], ['자동전환초', 10]],
  });

  const { settings } = parseWorkbook(wb);

  assert.deepEqual(settings, { storeName: '빌런 커피', theme: 'bistro-light', autoRotateSec: 10 });
});

test('_설정이 없거나 항목이 누락되면 기본값(theme cafe-dark, autoRotateSec 0)이 쓰인다', () => {
  const withoutSettings = buildWorkbook({ 커피: menuSheet(['아메리카노', 4500, '', '', '']) });
  const partialSettings = buildWorkbook({ _설정: [['항목', '값'], ['매장명', '빌런 커피']] });

  assert.equal(parseWorkbook(withoutSettings).settings.theme, 'cafe-dark');
  assert.equal(parseWorkbook(withoutSettings).settings.autoRotateSec, 0);
  assert.equal(parseWorkbook(partialSettings).settings.storeName, '빌런 커피');
  assert.equal(parseWorkbook(partialSettings).settings.theme, 'cafe-dark');
  assert.equal(parseWorkbook(partialSettings).settings.autoRotateSec, 0);
});

test('autoRotateSec는 숫자로 변환된다', () => {
  const wb = buildWorkbook({ _설정: [['항목', '값'], ['자동전환초', '15']] });

  const { settings } = parseWorkbook(wb);

  assert.strictEqual(settings.autoRotateSec, 15);
});

test('열 순서가 달라도 헤더명으로 매핑된다', () => {
  const wb = buildWorkbook({
    커피: [
      ['카테고리', '품절', '가격', '메뉴명', '설명'],
      ['에스프레소', 'Y', 5000, '디카페인 아메리카노', '스위스 워터'],
    ],
  });

  const { pages } = parseWorkbook(wb);

  assert.deepEqual(pages[0].items, [
    { name: '디카페인 아메리카노', price: 5000, description: '스위스 워터', soldOut: true, category: '에스프레소' },
  ]);
});
