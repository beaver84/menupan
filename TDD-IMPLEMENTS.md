# TDD-IMPLEMENTS — 마일스톤별 TDD 진행표

> 규칙: [CLAUDE.md](CLAUDE.md) · 기술 상세: [TRD.md](TRD.md) §7 · 제품 요구사항: [PRD.md](PRD.md)
> 출처: `plan.md`가 레포에 없어 TRD §7 구현 순서를 마일스톤으로 묶어 작성함. `plan.md`가 생기면 이 문서를 갱신한다.

## 진행 방식

- 진행 단위는 **마일스톤**이다. 마일스톤 하나는 `/tdd-red` → `/tdd-green` → `/tdd-refactor` 한 바퀴로 닫는다.
- **Red**: 마일스톤의 테스트 케이스 전체를 작성하고 모두 올바른 이유로 실패하는지 확인한다.
- **Green**: 케이스를 통과시키는 최소 구현을 작성한다. 전체 테스트가 통과해야 한다.
- **Refactor**: 통과 상태에서 하드코딩·중복·원칙 위반을 구조적 변경만으로 정리한다.
- 마일스톤은 순서대로 진행한다. 앞 마일스톤의 Refactor가 끝나기 전에 다음 Red를 시작하지 않는다.
- 커밋: 행위적(`feat:`/`fix:`)과 구조적(`refactor:`) 변경을 분리한다.
- 테스트 케이스 체크박스는 Red에서 작성하면 `[x]`, 마일스톤 Green 완료 시 통과 확인으로 같이 유지한다.

상태 표기: `[ ]` 미완료, `[x]` 완료.

---

## M1. Excel 파싱 (`src/parse.mjs`)

목표: 워크북 → `{ settings, pages }` 순수 함수. I/O 없음. (TRD §3.1)

- [x] Red  [x] Green  [x] Refactor

테스트 케이스 (`test/parse.test.mjs`, 인메모리 워크북 사용):

- [x] 일반 시트 1개가 페이지 1개가 되고 시트 이름이 `name`이 된다
- [x] 시트가 여러 개면 시트 순서대로 페이지가 된다
- [x] `_` 접두사 시트는 페이지에서 제외된다
- [x] 헤더 `메뉴명/가격/설명/품절/카테고리`가 `name/price/description/soldOut/category`로 매핑된다
- [x] 가격은 숫자(number)로 변환된다
- [x] `품절`이 `Y`/`y`면 `soldOut: true`, 빈칸이면 `false`다
- [x] 메뉴명이 빈 행은 무시된다
- [x] 가격이 숫자가 아닌 행은 제외되고 예외를 던지지 않는다
- [x] `_설정` 시트(항목/값)가 `settings`(`storeName`, `theme`, `autoRotateSec`)로 변환된다
- [x] `_설정`이 없거나 항목이 누락되면 기본값(`theme: "cafe-dark"`, `autoRotateSec: 0`)이 쓰인다
- [x] `autoRotateSec`는 숫자로 변환된다
- [x] (추가, 행위 변경) 열 순서가 달라도 헤더명(`메뉴명/가격/…`)으로 매핑된다 — TRD §3.1 헤더 기준 매핑

기록:
- Red: `test/parse.test.mjs` 11개 테스트 작성(API: `parseWorkbook(workbook)` → `{ settings, pages }`, `src/parse.mjs`). 실행 결과 `ERR_MODULE_NOT_FOUND: Cannot find module 'src/parse.mjs'` — 구현 부재로 실패(정상 Red). 테스트 실행을 위해 `package.json`(type: module, xlsx CDN 의존성)과 `npm install` 추가.
- Green: `src/parse.mjs`의 `parseWorkbook` 구현. 11/11 통과(전체 테스트 동일).
  - Refactor 후보: `_설정`·헤더 한글 키(`매장명`, `테마`, `자동전환초`)와 기본값(`cafe-dark`, `0`)이 리터럴로 흩어져 있음 → 상수로 추출. `parseItems`의 위치 기반 구조분해(열 순서 가정) → 헤더명 기반 매핑(TRD §3.1은 헤더 기준). 가격 검증 로직 분리. `settings` 초기값과 `parseSettings` 기본값 중복. 가격 제외 시 경고 로그 없음(TRD 명시).
- Refactor: `src/parse.mjs` 구조 변경만. 한글 시트·설정 키와 기본값을 상수(`SETTINGS_SHEET`, `EXCLUDED_SHEET_PREFIX`, `SETTING_KEYS`, `DEFAULT_SETTINGS`, `SOLD_OUT_MARK`)로 추출하고 기본값 중복 제거. `readRows`/`dataRows`/`parsePrice`/`isSoldOut`/`toFiniteNumber` 추출. 11/11 통과. 열 순서 가정(위치 구조분해)은 동작 변경이라 위 추가 케이스로 이월 → 후속 Red/Green으로 `indexColumns`(헤더 기반 매핑) 구현, 12/12 통과.

## M2. 메뉴 API (`src/app.mjs` + `GET /api/menu`, `server.mjs`는 진입점)

목표: 파일 경로를 주입받아 파싱 결과를 캐시하고 JSON으로 제공. (TRD §3.2)

API 계약: `startServer({ menuPath, publicDir, port, readWorkbook?, logger? })` → `Promise<{ port, reload(): Promise<boolean>, close() }>`. 시작 시 읽기 실패면 `menuPath`가 담긴 에러로 reject. `reload()`는 성공 시 `true`, 실패 시 캐시를 유지하고 `false`. 기본값 `DEFAULT_PORT`(3000), `DEFAULT_MENU_PATH`(`data/menu.xlsx`) export. `server.mjs`는 `startServer`를 기본값으로 호출만 한다(테스트 대상 아님).

- [x] Red  [x] Green  [x] Refactor

테스트 케이스 (`test/api.test.mjs`, 임시 포트 + 테스트용 xlsx 생성):

- [x] `GET /api/menu`가 200과 M1 형식의 JSON을 반환한다
- [x] 두 번째 요청은 파일을 다시 읽지 않고 캐시를 반환한다
- [x] 재로드 호출 후 `/api/menu`가 새 내용을 반환한다
- [x] 재로드가 실패(파일 손상)하면 마지막 정상 결과를 유지한다
- [x] 서버 시작 시 파일이 없거나 손상이면 명확한 에러로 실패한다
- [x] `GET /`가 `public/index.html`을 반환한다
- [x] 파일 경로와 포트는 주입 가능하다 (기본값 `data/menu.xlsx`, 3000)

기록:
- Red: `test/api.test.mjs` 7개 테스트 작성(임시 디렉터리·포트 0·인메모리 xlsx, `readWorkbook`/`logger` 주입). 실행 결과 `ERR_MODULE_NOT_FOUND: Cannot find module 'src/app.mjs'` — 구현 부재로 실패(정상 Red). Green 단계에서 `express` 의존성 설치 필요. "파일 손상" 케이스는 SheetJS가 임의 텍스트를 CSV로 읽어 throw하지 않으므로 "파일 읽기 오류(파일 삭제)"로 구체화함.
- Green: `src/app.mjs`의 `startServer` 구현(express, `/api/menu` 캐시, 정적 제공, `reload`, `close`), 진입점 `server.mjs`, `express` 의존성 추가. 전체 18/18 통과. 테스트 헬퍼는 `XLSX.writeFile`(ESM에서 fs 미설정으로 실패)을 `XLSX.write` + `writeFileSync`로 교체(단언 변경 없음), 프로덕션은 `XLSX.set_fs(fs)` 필요.
  - Refactor 후보: `XLSX.set_fs(fs)`가 모듈 로드 시 전역 부수효과 → `readWorkbook` 기본값을 별도 함수로 분리. `startServer`가 앱 생성·초기 로드·리슨·close를 한 함수에서 처리(책임 분리: `createApp`/`listen`). 시작/재로드 에러 처리 중복. 한글 에러·로그 메시지 리터럴. `closeAllConnections` 의존. `server.mjs` 포트/경로 환경변수 미지원(필요 시 새 케이스).
- Refactor: `XLSX.set_fs(fs)` 전역 부수효과와 기본 `readWorkbook`을 `src/read-workbook.mjs`로 분리. `app.mjs`는 주입받는 `readWorkbook`만 사용. 전체 통과.

## M3. 실시간 갱신 (`src/watch.mjs`, `src/sse.mjs`, `GET /events`)

목표: 파일 변경 → 300ms 디바운스 → 재파싱 → SSE `menu-updated`. (TRD §4)

- [x] Red  [x] Green  [x] Refactor

테스트 케이스 (`test/watch.test.mjs`, `test/sse.test.mjs`, 가짜 타이머·가짜 감시자 주입):

- [x] 300ms 안에 변경 이벤트가 여러 번 와도 핸들러는 1회만 호출된다
- [x] 300ms 간격을 두고 온 변경 이벤트는 각각 호출된다
- [x] SSE 연결 시 `Content-Type: text/event-stream` 헤더와 연결 유지가 설정된다
- [x] 브로드캐스트 시 연결된 모든 클라이언트가 `event: menu-updated`를 받는다
- [x] 연결이 끊긴 클라이언트는 목록에서 제거된다
- [x] 재파싱 성공 시에만 이벤트가 발행된다 (실패 시 캐시 유지, 이벤트 없음)
- [x] 통합: xlsx 파일을 덮어쓰면 `/events` 구독자가 이벤트를 받고 `/api/menu`가 갱신된다

기록:
- Red: `test/watch.test.mjs`(2), `test/sse.test.mjs`(3), `test/api.test.mjs`(+2) 작성. 구현 부재(`ERR_MODULE_NOT_FOUND` src/watch.mjs, src/sse.mjs)와 `/events` 404로 실패.
- Green: `src/watch.mjs`(`debounce`, `watchFile` chokidar), `src/sse.mjs`(`createSseHub`), `app.mjs`에 `/events`·`watch` 주입·재로드 성공 시 브로드캐스트. `chokidar` 의존성 추가. 26/26 통과.
- Refactor: `watchFile`의 `change`/`add` 핸들러 생성 중복을 `WATCHED_EVENTS` 반복으로 정리. 2회 연속 실행 모두 통과.

## M4. 클라이언트 렌더링 (`public/layout.mjs`, `render.mjs`, `menu-client.mjs`, `client.js`, `index.html`)

목표: 디바이스 치수 → 스타일 수치 순수 함수, API 데이터 → DOM 렌더링. (TRD §5)

- [x] Red  [x] Green  [x] Refactor

테스트 케이스 (`test/layout.test.mjs`, `test/render.test.mjs`):

- [x] 디바이스 프리셋 4종(`signage` 1080×1920, `tablet-land` 1920×1440, `tablet-port` 1440×1920, `mobile` 1080×2160)의 치수가 정의되어 있다
- [x] 기준 단위 `u = min(w, h)`로 패딩(`u×0.085`)과 폰트 크기가 계산된다
- [x] `tablet-land`는 2열·사진 슬롯 숨김, 그 외는 1열·사진 슬롯 표시다
- [x] 가격 포맷이 `4,500원` 형태다
- [x] 품절 항목은 취소선·흐림·"품절" 배지 클래스/속성을 가진다
- [x] 페이지 데이터가 매장명, 시트 이름, 항목 목록 마크업으로 렌더링된다
- [x] 이름·설명의 HTML 특수문자는 이스케이프된다
- [x] SSE `menu-updated` 수신 시 `/api/menu`를 다시 가져와 재렌더링한다 (가짜 EventSource/fetch 주입)

기록:
- Red: `test/layout.test.mjs`(4), `test/render.test.mjs`(6) 작성. `ERR_MODULE_NOT_FOUND`(public/layout.mjs)로 실패.
- Green: `public/layout.mjs`(`DEVICES`, `getLayout`), `public/render.mjs`(`renderBoard`, `formatPrice`, HTML 이스케이프), `public/menu-client.mjs`(`createMenuClient`). 36/36 통과.
- Refactor: 렌더링 보조 함수(`renderItem`, `boardStyle`)로 분리. 비율 상수를 `PADDING_RATIO`/`FONT_RATIOS`로 명명.

## M5. 테마와 반응형 (`public/templates/`, 에셋)

목표: `_설정`의 `테마` 값만으로 CSS와 배경/테두리 PNG가 교체된다. (TRD §5)

- [x] Red  [x] Green  [x] Refactor

테스트 케이스 (`test/theme.test.mjs`):

- [x] 지원 테마 목록이 에셋 디렉터리(`design/project/assets`)와 일치한다
- [x] 테마 CSS(`public/templates/themes.css`)에 지원 테마별 블록이 모두 있다
- [x] `GET /assets/<테마>/<파일>`이 PNG 에셋을 반환한다
- [x] 테마·디바이스로 에셋 경로 `assets/<테마>/{bg,frame}-<디바이스>.png`가 만들어진다
- [x] 지원 테마 × 4개 디바이스의 에셋 파일이 모두 실제로 존재한다
- [x] 알 수 없는 테마 값은 기본 테마로 대체된다 (렌더링 포함)
- [x] 뷰포트 크기에서 가장 가까운 디바이스 프리셋이 선택된다
- [x] 테마 변경 이벤트 후 렌더링 결과의 테마 클래스와 에셋 URL이 바뀐다

기록:
- Red: `test/theme.test.mjs`(8), `test/api.test.mjs`(+1) 작성. `ERR_MODULE_NOT_FOUND`(public/themes.mjs)와 `/assets` 404로 실패. 에셋은 중복 복사하지 않고 `design/project/assets`를 `/assets`로 정적 제공하기로 결정.
- Green: `public/themes.mjs`(`THEMES`, `resolveTheme`, `assetUrl`), `pickDevice`(가로세로 비율 로그 거리), `render.mjs`에 테마 클래스·bg/frame 레이어, `app.mjs`에 `assetsDir` 정적 제공, `public/templates/themes.css`. 테스트의 정규식 이스케이프 버그(`String.raw`) 수정. 45/45 통과. 지원 테마 8종(`cafe-dark`, `bistro-light`, `light-olive`, `deep-green`, `cream`, `beige`, `forest-dark`, `forest-light`); 요구사항에 색이 없는 4종은 임의 색상값(디자인 확정 필요).
- Refactor: 테마·에셋 규칙을 `themes.mjs` 한 곳에 모음(중복 없음). 추가 정리 없음.

## M6. 페이지 자동 전환

목표: `자동전환초 > 0`이면 타이머로 페이지 순환. (PRD §3-8)

- [x] Red  [x] Green  [x] Refactor

테스트 케이스 (`test/rotate.test.mjs`, `public/rotate.mjs`, 가짜 타이머):

- [x] `autoRotateSec`가 0이면 타이머가 시작되지 않는다
- [x] 양수면 해당 초마다 다음 페이지 인덱스로 이동한다
- [x] 마지막 페이지 다음은 첫 페이지로 돌아간다
- [x] 데이터 갱신 후에도 현재 페이지 인덱스가 유지된다
- [x] 갱신으로 페이지 수가 줄어 인덱스가 범위를 넘으면 마지막 페이지로 보정된다
- [x] 설정이 바뀌면 기존 타이머가 정리되고 새 주기로 재시작된다
- [x] 자동 전환을 끄면 타이머가 정리된다

기록:
- Red: `test/rotate.test.mjs`(7, `node:test` 가짜 타이머) 작성. `ERR_MODULE_NOT_FOUND`(public/rotate.mjs)로 실패.
- Green: `public/rotate.mjs`(`createRotator`: `update`, `stop`, `index`). 같은 주기의 데이터 갱신은 타이머 위상을 유지. 52/52 통과. 브라우저 연결 코드 `public/client.js`·`index.html`·`templates/board-grid.css` 추가(테스트 대상 아님, 서버 스모크로 `/`, `/client.js`, CSS, PNG, `/events` 200 확인).
- Refactor: 추가 정리 없음(타이머 재시작 조건을 `update` 한 곳에 유지).

## M7. (확장) 카테고리 그룹

목표: `카테고리` 열로 한 페이지 안에서 소제목 그룹을 나눈다. (PRD §3-9)

- [x] Red  [x] Green  [x] Refactor

테스트 케이스 (`test/category.test.mjs`):

- [x] 같은 카테고리의 항목이 하나의 그룹으로 묶인다
- [x] 그룹 순서는 시트에서 처음 등장한 순서를 따른다
- [x] 카테고리가 빈 항목은 소제목 없는 기본 그룹에 들어간다
- [x] 그룹별 소제목이 렌더링되고 기본 그룹에는 소제목이 없다
- [x] 카테고리가 모두 비어 있으면 소제목 없이 항목만 렌더링된다

기록:
- Red: `test/category.test.mjs`(5) 작성. `ERR_MODULE_NOT_FOUND`(public/group.mjs)로 실패.
- Green: `public/group.mjs`(`groupByCategory`, `Map` 삽입 순서 유지), `render.mjs`가 그룹별 `<h3 class="category">`와 `<ul class="items">`를 렌더링. 57/57 통과.
- Refactor: `renderGroup`으로 그룹 렌더링 분리.
