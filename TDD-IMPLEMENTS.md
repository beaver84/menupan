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
- [ ] (추가, 행위 변경) 열 순서가 달라도 헤더명(`메뉴명/가격/…`)으로 매핑된다 — TRD §3.1 헤더 기준 매핑. 별도 Red/Green 사이클로 진행

기록:
- Red: `test/parse.test.mjs` 11개 테스트 작성(API: `parseWorkbook(workbook)` → `{ settings, pages }`, `src/parse.mjs`). 실행 결과 `ERR_MODULE_NOT_FOUND: Cannot find module 'src/parse.mjs'` — 구현 부재로 실패(정상 Red). 테스트 실행을 위해 `package.json`(type: module, xlsx CDN 의존성)과 `npm install` 추가.
- Green: `src/parse.mjs`의 `parseWorkbook` 구현. 11/11 통과(전체 테스트 동일).
  - Refactor 후보: `_설정`·헤더 한글 키(`매장명`, `테마`, `자동전환초`)와 기본값(`cafe-dark`, `0`)이 리터럴로 흩어져 있음 → 상수로 추출. `parseItems`의 위치 기반 구조분해(열 순서 가정) → 헤더명 기반 매핑(TRD §3.1은 헤더 기준). 가격 검증 로직 분리. `settings` 초기값과 `parseSettings` 기본값 중복. 가격 제외 시 경고 로그 없음(TRD 명시).
- Refactor: `src/parse.mjs` 구조 변경만. 한글 시트·설정 키와 기본값을 상수(`SETTINGS_SHEET`, `EXCLUDED_SHEET_PREFIX`, `SETTING_KEYS`, `DEFAULT_SETTINGS`, `SOLD_OUT_MARK`)로 추출하고 기본값 중복 제거. `readRows`/`dataRows`/`parsePrice`/`isSoldOut`/`toFiniteNumber` 추출. 11/11 통과. 열 순서 가정(위치 구조분해)은 동작 변경이라 위 추가 케이스로 이월.

## M2. 메뉴 API (`server.mjs` 조립 + `GET /api/menu`)

목표: 파일 경로를 주입받아 파싱 결과를 캐시하고 JSON으로 제공. (TRD §3.2)

- [ ] Red  [ ] Green  [ ] Refactor

테스트 케이스 (`test/api.test.mjs`, 임시 포트 + 테스트용 xlsx 생성):

- [ ] `GET /api/menu`가 200과 M1 형식의 JSON을 반환한다
- [ ] 두 번째 요청은 파일을 다시 읽지 않고 캐시를 반환한다
- [ ] 재로드 호출 후 `/api/menu`가 새 내용을 반환한다
- [ ] 재로드가 실패(파일 손상)하면 마지막 정상 결과를 유지한다
- [ ] 서버 시작 시 파일이 없거나 손상이면 명확한 에러로 실패한다
- [ ] `GET /`가 `public/index.html`을 반환한다
- [ ] 파일 경로와 포트는 주입 가능하다 (기본값 `data/menu.xlsx`, 3000)

기록:
- Red:
- Green:
- Refactor:

## M3. 실시간 갱신 (`src/watch.mjs`, `src/sse.mjs`, `GET /events`)

목표: 파일 변경 → 300ms 디바운스 → 재파싱 → SSE `menu-updated`. (TRD §4)

- [ ] Red  [ ] Green  [ ] Refactor

테스트 케이스 (`test/watch.test.mjs`, `test/sse.test.mjs`, 가짜 타이머·가짜 감시자 주입):

- [ ] 300ms 안에 변경 이벤트가 여러 번 와도 핸들러는 1회만 호출된다
- [ ] 300ms 간격을 두고 온 변경 이벤트는 각각 호출된다
- [ ] SSE 연결 시 `Content-Type: text/event-stream` 헤더와 연결 유지가 설정된다
- [ ] 브로드캐스트 시 연결된 모든 클라이언트가 `event: menu-updated`를 받는다
- [ ] 연결이 끊긴 클라이언트는 목록에서 제거된다
- [ ] 재파싱 성공 시에만 이벤트가 발행된다 (실패 시 캐시 유지, 이벤트 없음)
- [ ] 통합: xlsx 파일을 덮어쓰면 `/events` 구독자가 이벤트를 받고 `/api/menu`가 갱신된다

기록:
- Red:
- Green:
- Refactor:

## M4. 클라이언트 렌더링 (`public/layout.mjs`, `public/client.js`, `public/index.html`)

목표: 디바이스 치수 → 스타일 수치 순수 함수, API 데이터 → DOM 렌더링. (TRD §5)

- [ ] Red  [ ] Green  [ ] Refactor

테스트 케이스 (`test/layout.test.mjs`, `test/render.test.mjs`):

- [ ] 디바이스 프리셋 4종(`signage` 1080×1920, `tablet-land` 1920×1440, `tablet-port` 1440×1920, `mobile` 1080×2160)의 치수가 정의되어 있다
- [ ] 기준 단위 `u = min(w, h)`로 패딩(`u×0.085`)과 폰트 크기가 계산된다
- [ ] `tablet-land`는 2열·사진 슬롯 숨김, 그 외는 1열·사진 슬롯 표시다
- [ ] 가격 포맷이 `4,500원` 형태다
- [ ] 품절 항목은 취소선·흐림·"품절" 배지 클래스/속성을 가진다
- [ ] 페이지 데이터가 매장명, 시트 이름, 항목 목록 마크업으로 렌더링된다
- [ ] SSE `menu-updated` 수신 시 `/api/menu`를 다시 가져와 재렌더링한다 (가짜 EventSource/fetch 주입)

기록:
- Red:
- Green:
- Refactor:

## M5. 테마와 반응형 (`public/templates/`, 에셋)

목표: `_설정`의 `테마` 값만으로 CSS와 배경/테두리 PNG가 교체된다. (TRD §5)

- [ ] Red  [ ] Green  [ ] Refactor

테스트 케이스 (`test/theme.test.mjs`):

- [ ] 지원 테마 목록이 정의되어 있고 TRD와 일치한다
- [ ] 테마·디바이스로 에셋 경로 `assets/<테마>/{bg,frame}-<디바이스>.png`가 만들어진다
- [ ] 지원 테마 × 4개 디바이스의 에셋 파일이 모두 실제로 존재한다
- [ ] 알 수 없는 테마 값은 기본 테마로 대체된다
- [ ] 뷰포트 크기에서 가장 가까운 디바이스 프리셋이 선택된다
- [ ] 테마 변경 이벤트 후 렌더링 결과의 테마 클래스와 에셋 URL이 바뀐다

기록:
- Red:
- Green:
- Refactor:

## M6. 페이지 자동 전환

목표: `자동전환초 > 0`이면 타이머로 페이지 순환. (PRD §3-8)

- [ ] Red  [ ] Green  [ ] Refactor

테스트 케이스 (`test/rotate.test.mjs`, 가짜 타이머):

- [ ] `autoRotateSec`가 0이면 타이머가 시작되지 않는다
- [ ] 양수면 해당 초마다 다음 페이지 인덱스로 이동한다
- [ ] 마지막 페이지 다음은 첫 페이지로 돌아간다
- [ ] 데이터 갱신 후에도 현재 페이지 인덱스가 유지된다
- [ ] 갱신으로 페이지 수가 줄어 인덱스가 범위를 넘으면 마지막 페이지로 보정된다
- [ ] 설정이 바뀌면 기존 타이머가 정리되고 새 주기로 재시작된다

기록:
- Red:
- Green:
- Refactor:

## M7. (확장) 카테고리 그룹

목표: `카테고리` 열로 한 페이지 안에서 소제목 그룹을 나눈다. (PRD §3-9)

- [ ] Red  [ ] Green  [ ] Refactor

테스트 케이스 (`test/category.test.mjs`):

- [ ] 같은 카테고리의 항목이 하나의 그룹으로 묶인다
- [ ] 그룹 순서는 시트에서 처음 등장한 순서를 따른다
- [ ] 카테고리가 빈 항목은 소제목 없는 기본 그룹에 들어간다
- [ ] 그룹별 소제목이 렌더링된다

기록:
- Red:
- Green:
- Refactor:
