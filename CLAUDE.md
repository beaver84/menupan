# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Excel 파일 하나(`data/menu.xlsx`)로 카페 메뉴판 화면을 구동한다. **시트(탭) 1개 = 메뉴판 페이지 1개**. Excel 저장 시 파일 감시(chokidar) + SSE로 브라우저가 즉시 갱신된다. 핵심 원칙: **데이터(Excel)와 표현(테마/템플릿)을 분리한다.**

문서 역할 분리 (중복 작성 금지, 서로 링크로 참조):

- `CLAUDE.md` (이 파일) — 작업 방식, 개발 프로세스(TDD), 명령어
- `PRD.md` — 무엇을/왜 만드는가 (제품 요구사항)
- `TRD.md` — 어떻게 만드는가 (아키텍처, API, 데이터 계약, 테스트 전략)
- `docs/menu-project-requirement.md` — 원본 요구사항(Excel 작성 규칙의 기준 문서)
- `design/` — Claude Design 핸드오프 번들. HTML/CSS/JS **프로토타입**이며 프로덕션 코드가 아니다. 시각 결과만 맞추고 내부 구조는 복사하지 않는다. 기준 파일: `design/project/메뉴판 템플릿 시스템.dc.html`

## 현재 상태

그린필드. 아직 `package.json`, `server.mjs`, `public/` 이 없다. 위 문서와 `design/`, `data/menu.xlsx`만 존재한다. 코드는 아래 TDD 프로세스로 처음부터 만든다.

## 명령어

런타임: Node.js (ESM, `.mjs`), 테스트 러너는 내장 `node:test` (추가 의존성 없음).

```bash
npm install                # 의존성 설치
npm start                  # 서버 실행 → http://localhost:3000
npm test                   # 전체 테스트 (node --test)
node --test test/parse.test.mjs                          # 파일 1개
node --test --test-name-pattern="품절" test/parse.test.mjs  # 테스트 1개(이름 패턴)
```

`xlsx`(SheetJS)는 npm 레지스트리 버전(0.18.5, 구버전)을 쓰지 않는다. `package.json`에 공식 CDN tarball을 지정한다:

```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

## 아키텍처 (큰 그림)

```text
menu.xlsx 저장 → chokidar(300ms 디바운스) → server.mjs 재파싱(JSON)
              → SSE `menu-updated` → 브라우저가 GET /api/menu → 재렌더
```

- **서버 (`server.mjs`)**: 시트 → JSON 파싱, 파일 감시, SSE 푸시. 파싱 로직은 순수 함수로 분리해 서버/파일시스템 없이 테스트 가능해야 한다.
- **클라이언트 (`public/`)**: SSE 수신 후 `/api/menu`를 다시 가져와 렌더링. SSE는 "변경됨" 신호만 보내고 데이터는 API로 가져온다(읽기 전용 단방향이라 WebSocket 불필요).
- **Excel 계약** (변경 시 PRD/TRD/테스트 동시 갱신):
  - `_` 접두사 시트는 페이지에서 제외. `_설정` 시트(항목/값)에서 `매장명`, `테마`, `자동전환초`를 읽는다.
  - 메뉴 시트 헤더: `메뉴명 | 가격 | 설명 | 품절 | 카테고리`. 가격은 숫자만(화면에서 `원` 표기), 품절은 `Y` 또는 빈칸.
- **테마 시스템**: 같은 데이터에 테마(CSS 변수 + PNG 에셋)만 교체. `design/project/assets/<테마>/{bg,frame}-<디바이스>.png` — 배경 + 가운데가 투명한 테두리 오버레이 2장 구조. 디바이스 4종: `signage`(1080×1920), `tablet-land`(1920×1440), `tablet-port`(1440×1920), `mobile`(1080×2160). 레이아웃 치수는 `min(w,h)` 기준 비율(`u`)로 스케일한다.
- 에셋 디렉터리에는 요구사항의 `cafe-dark`, `bistro-light` 외에 디자인 번들의 테마(`light-olive`, `deep-green`, `cream`, `beige`, `forest-*`)도 있다. 지원 테마 목록은 TRD에서 확정한다.

## 개발 방법론: Kent Beck TDD + Tidy First (증강 코딩)

출처: Kent Beck 증강 코딩 CLAUDE 가이드 (`claude-code-expert/inflearn-docs/example/Kentbeck-CLAUDE-ko.md`). 아래 규칙은 **모든 코드 변경에 예외 없이** 적용한다.

### 역할

시니어 소프트웨어 엔지니어로서 Kent Beck의 TDD와 Tidy First 원칙을 엄격히 따른다.

### TDD 사이클: Red → Green → Refactor

1. **Red**: 작은 기능 증분을 정의하는 **실패하는 테스트**부터 작성한다. 테스트 이름은 동작을 설명한다(예: `품절이 Y면 soldOut이 true다`). 실패 메시지가 원인을 알려줘야 한다.
2. **Green**: 테스트를 통과시키는 **최소한의 코드만** 작성한다. 그 이상 구현하지 않는다.
3. **Refactor**: 테스트가 **통과한 상태(Green)에서만** 리팩터링한다. 중복 제거, 명확한 이름, 명시적 의존성.
4. 새 기능마다 사이클을 반복한다. 매 단계 후 **모든 테스트를 실행**한다.

버그 수정: 먼저 버그를 재현하는 실패 테스트(가능하면 API 수준)를 쓰고, 그다음 최소 수정으로 고친다.

### Tidy First: 변경 종류를 분리한다

- **구조적 변경(Structural)**: 동작을 바꾸지 않는 재배치(이름 변경, 함수 추출, 파일 이동).
- **행위적 변경(Behavioral)**: 기능 추가/수정.
- **둘을 같은 커밋에 섞지 않는다.** 둘 다 필요하면 **구조적 변경을 먼저** 한다.
- 구조적 변경 전후로 테스트를 돌려 동작이 동일함을 확인한다.

### 커밋 규율

다음이 **모두** 충족될 때만 커밋한다:

- 모든 테스트 통과
- 컴파일러/린터 경고 해결
- 하나의 논리적 작업 단위
- 커밋 메시지에 구조적/행위적 변경 여부를 명시 (예: `refactor: ...` = 구조적, `feat:`/`fix:` = 행위적)

크고 드문 커밋보다 **작고 잦은 커밋**을 선호한다.

### 코드 품질

- 중복을 제거한다.
- 의도를 이름과 구조로 드러낸다.
- 의존성을 명시적으로 만든다(파일 경로, 시계, 파일 감시자는 주입 가능하게).
- 메서드/함수는 작게, 단일 책임으로.
- 상태와 부수효과를 최소화한다.
- 동작하는 가장 단순한 해법을 쓴다.

### 이 프로젝트의 테스트 가이드

- 파싱(Excel → JSON)은 순수 함수 단위 테스트. 픽스처는 테스트 안에서 SheetJS로 인메모리 워크북을 만들어 쓴다(실제 `data/menu.xlsx`에 의존하지 않는다).
- 파일 감시 디바운스(300ms), SSE 이벤트 발행은 시간/감시자를 주입해 결정적으로 테스트한다.
- 화면 구현은 `design/` 프로토타입의 수치(폰트 비율, 디바이스 치수)를 테스트 가능한 순수 함수(레이아웃 계산)로 뽑아 검증한다.

# TDD Red Phase

다음 기능에 대한 **실패하는 테스트만** 작성해주세요: $ARGUMENTS

## 규칙
1. 구현 코드는 절대 작성하지 않음
2. 테스트 파일만 생성 또는 수정
3. 테스트가 실패하는 이유를 설명
4. 테스트 실행하여 실패 확인

# TDD Green Phase

가장 최근에 작성한 실패하는 테스트를 **최소한의 코드로** 통과시켜주세요.

## 규칙
1. 테스트를 통과시키는 최소한의 코드만 작성
2. 하드코딩도 허용 (다음 테스트가 일반화를 강제)
3. 추가 기능이나 "미래를 위한" 코드 금지

# TDD Refactor Phase

테스트가 통과하는 상태를 유지하면서 코드를 리팩토링 해주세요.

## 규칙
1. 새로운 기능 추가 금지
2. 테스트 수정 금지
3. 각 리팩터링 후 테스트 실행
4. 테스트가 실패하면 즉시 되돌리기
## 개선 포인트
- 중복 제거
- 명확한 이름 사용
- 복잡한 조건문 단순화
- 메서드 추출
## 출력 형식
1. 리팩터링 전 코드
2. 리팩터링 후 코드
3. 테스트 실행 결과 (전체 통과 확인)