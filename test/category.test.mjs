import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByCategory } from '../public/group.mjs';
import { renderBoard } from '../public/render.mjs';

const item = (name, category) => ({ name, price: 1000, description: '', soldOut: false, category });
const settings = { storeName: '빌런 커피', theme: 'cafe-dark', autoRotateSec: 0 };

test('같은 카테고리의 항목이 하나의 그룹으로 묶인다', () => {
  const groups = groupByCategory([item('A', '에스프레소'), item('B', '브루'), item('C', '에스프레소')]);

  assert.deepEqual(groups.find((g) => g.category === '에스프레소').items.map((i) => i.name), ['A', 'C']);
});

test('그룹 순서는 시트에서 처음 등장한 순서를 따른다', () => {
  const groups = groupByCategory([item('A', '브루'), item('B', '에스프레소'), item('C', '브루')]);

  assert.deepEqual(groups.map((g) => g.category), ['브루', '에스프레소']);
});

test('카테고리가 빈 항목은 소제목 없는 기본 그룹에 들어간다', () => {
  const groups = groupByCategory([item('A', ''), item('B', '브루'), item('C', '')]);

  assert.deepEqual(groups.map((g) => [g.category, g.items.map((i) => i.name)]), [
    ['', ['A', 'C']],
    ['브루', ['B']],
  ]);
});

test('그룹별 소제목이 렌더링되고 기본 그룹에는 소제목이 없다', () => {
  const page = { name: '커피', items: [item('A', ''), item('B', '에스프레소')] };

  const html = renderBoard({ settings, page, device: 'signage' });

  assert.equal(html.match(/<h3 class="category">/g).length, 1);
  assert.match(html, /<h3 class="category">에스프레소<\/h3>/);
});

test('카테고리가 모두 비어 있으면 소제목 없이 항목만 렌더링된다', () => {
  const page = { name: '커피', items: [item('A', ''), item('B', '')] };

  const html = renderBoard({ settings, page, device: 'signage' });

  assert.doesNotMatch(html, /class="category"/);
  assert.equal(html.match(/<li class="item/g).length, 2);
});
