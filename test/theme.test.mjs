import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_THEME, THEMES, assetUrl, resolveTheme } from '../public/themes.mjs';
import { DEVICES, pickDevice } from '../public/layout.mjs';
import { renderBoard } from '../public/render.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = path.join(ROOT, 'design', 'project', 'assets');
const THEMES_CSS = path.join(ROOT, 'public', 'templates', 'themes.css');

const page = { name: '커피', items: [] };
const settingsOf = (theme) => ({ storeName: '빌런 커피', theme, autoRotateSec: 0 });

test('지원 테마 목록이 에셋 디렉터리와 일치한다', () => {
  const assetThemes = readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  assert.deepEqual([...THEMES].sort(), assetThemes.sort());
  assert.ok(THEMES.includes(DEFAULT_THEME));
});

test('테마·디바이스로 에셋 URL이 만들어진다', () => {
  assert.equal(assetUrl('cafe-dark', 'signage', 'bg'), '/assets/cafe-dark/bg-signage.png');
  assert.equal(assetUrl('deep-green', 'tablet-land', 'frame'), '/assets/deep-green/frame-tablet-land.png');
});

test('지원 테마 × 4개 디바이스의 에셋 파일이 모두 실제로 존재한다', () => {
  for (const theme of THEMES) {
    for (const device of Object.keys(DEVICES)) {
      for (const kind of ['bg', 'frame']) {
        const file = path.join(ASSETS_DIR, assetUrl(theme, device, kind).replace('/assets/', ''));
        assert.ok(existsSync(file), `${file} 없음`);
      }
    }
  }
});

test('테마 CSS에 지원 테마별 블록이 모두 있다', () => {
  const css = readFileSync(THEMES_CSS, 'utf8');

  for (const theme of THEMES) {
    assert.match(css, new RegExp(String.raw`\.theme-${theme}\s*\{`), `${theme} 블록 없음`);
  }
});

test('알 수 없는 테마 값은 기본 테마로 대체된다', () => {
  assert.equal(resolveTheme('bistro-light'), 'bistro-light');
  assert.equal(resolveTheme('no-such-theme'), DEFAULT_THEME);
  assert.equal(resolveTheme(undefined), DEFAULT_THEME);
});

test('뷰포트 크기에서 가장 가까운 디바이스 프리셋이 선택된다', () => {
  assert.equal(pickDevice(1920, 1440), 'tablet-land');
  assert.equal(pickDevice(1440, 1920), 'tablet-port');
  assert.equal(pickDevice(1080, 1920), 'signage');
  assert.equal(pickDevice(390, 844), 'mobile');
});

test('테마가 바뀌면 렌더링 결과의 테마 클래스와 에셋 URL이 바뀐다', () => {
  const dark = renderBoard({ settings: settingsOf('cafe-dark'), page, device: 'signage' });
  const light = renderBoard({ settings: settingsOf('bistro-light'), page, device: 'signage' });

  assert.match(dark, /class="board theme-cafe-dark device-signage"/);
  assert.match(dark, /\/assets\/cafe-dark\/bg-signage\.png/);
  assert.match(dark, /\/assets\/cafe-dark\/frame-signage\.png/);
  assert.match(light, /class="board theme-bistro-light device-signage"/);
  assert.match(light, /\/assets\/bistro-light\/bg-signage\.png/);
  assert.doesNotMatch(light, /cafe-dark/);
});

test('알 수 없는 테마는 기본 테마 클래스와 에셋으로 렌더링된다', () => {
  const html = renderBoard({ settings: settingsOf('no-such-theme'), page, device: 'signage' });

  assert.match(html, new RegExp(`theme-${DEFAULT_THEME}`));
  assert.doesNotMatch(html, /no-such-theme/);
});
