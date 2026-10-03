# TRD — 기술 요구사항 (menupan)

> 제품 요구사항은 [PRD.md](PRD.md), 개발 프로세스(TDD)는 [CLAUDE.md](CLAUDE.md) 참고.

## 1. 기술 스택

| 항목 | 선택 | 비고 |
|---|---|---|
| 런타임 | Node.js (ESM, `.mjs`) | |
| 서버 | `express` | 정적 파일 + API + SSE |
| 파일 감시 | `chokidar` | 300ms 디바운스 |
| Excel 파싱 | `xlsx` (SheetJS 0.20.3) | **공식 CDN tarball**로 설치 (npm 레지스트리 0.18.5 사용 금지) |
| 프론트 | 바닐라 HTML/CSS/JS | 빌드 단계 없음 |
| 테스트 | 내장 `node:test` + `node:assert` | 추가 의존성 없음 (결정 사항) |

```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

보안 스캐너(Snyk 등)의 SheetJS 오탐은 공식적으로 무시 권장.

## 2. 디렉터리 구조 (목표)

```text
├── package.json
├── server.mjs              # 진입점: 조립(wiring)만 담당
├── src/
│   ├── parse.mjs           # 순수 함수: workbook → { settings, pages }
│   ├── watch.mjs           # chokidar + 디바운스 (주입 가능)
│   └── sse.mjs             # SSE 클라이언트 관리/브로드캐스트
├── data/menu.xlsx
├── public/
│   ├── index.html
│   ├── client.js           # SSE 수신 + 렌더링
│   ├── layout.mjs          # 순수 함수: 디바이스 치수 → 스타일 수치
│   └── templates/          # board-grid.css + 테마별 CSS
├── test/                   # *.test.mjs
└── design/                 # 핸드오프 번들(참조 전용)
```

구조는 TDD 진행 중 필요에 따라 조정 가능. 단 **파싱·레이아웃 계산은 I/O 없는 순수 함수**로 유지한다.

## 3. 데이터 계약

### 3.1 Excel → JSON (`GET /api/menu` 응답)

```json
{
  "settings": { "storeName": "빌런 커피", "theme": "cafe-dark", "autoRotateSec": 0 },
  "pages": [
    {
      "name": "커피",
      "items": [
        { "name": "아메리카노", "price": 4500, "description": "깔끔한 산미",
          "soldOut": false, "category": "에스프레소" }
      ]
    }
  ]
}
```

파싱 규칙:

- 이름이 `_`로 시작하는 시트는 `pages`에서 제외. `_설정`은 `settings`로 변환(항목/값 2열).
- 헤더 행 기준 매핑: `메뉴명→name`, `가격→price`(number), `설명→description`, `품절→soldOut`(`Y`/`y` → true), `카테고리→category`.
- 메뉴명이 비어 있는 행은 무시. 설정 누락 시 기본값(`theme: "cafe-dark"`, `autoRotateSec: 0`).
- 가격이 숫자가 아니면 해당 행은 경고 로그 후 제외(또는 `null`) — 서버는 죽지 않는다.
- 표시 포맷(`4,500원`)은 **클라이언트**에서 `toLocaleString('ko-KR') + '원'`.

### 3.2 엔드포인트

| 메서드/경로 | 설명 |
|---|---|
| `GET /` | `public/index.html` |
| `GET /api/menu` | 현재 파싱 결과(JSON). 마지막 정상 파싱 결과를 캐시해 반환 |
| `GET /events` | SSE 스트림. 변경 시 `event: menu-updated` (데이터 본문 없음) |

## 4. 갱신 파이프라인

1. chokidar가 `data/menu.xlsx`의 변경을 감지.
2. **300ms 디바운스**: Excel 저장 시 중복 파일 이벤트를 1회로 합친다.
3. 재파싱 성공 → 캐시 교체 → 연결된 모든 SSE 클라이언트에 `menu-updated` 전송.
4. 재파싱 실패(파일 잠김/손상) → 캐시 유지, 에러 로그, 이벤트 미전송.
5. 클라이언트는 이벤트 수신 시 `/api/menu`를 다시 가져와 재렌더. SSE 끊김 시 `EventSource` 자동 재연결.

SSE를 쓰는 이유: 표시는 읽기 전용 단방향이므로 WebSocket 불필요.

## 5. 프론트엔드 / 테마

- 레이어 구성: `배경 PNG` → `콘텐츠` → `테두리 PNG(가운데 투명, pointer-events: none)`.
- 에셋 경로: `assets/<테마>/{bg,frame}-<디바이스>.png` (테마 × 디바이스 × 2). 서버가 정적 제공할 위치는 구현 시 확정(`public/assets/` 로 `design/project/assets/` 복사 또는 정적 매핑).
- 디바이스 프리셋(px): `signage` 1080×1920, `tablet-land` 1920×1440, `tablet-port` 1440×1920, `mobile` 1080×2160.
- 기준 단위 `u = min(w, h)`; 패딩 `u×0.085`, 폰트 비율(eyebrow 0.0175, store 0.058, sheet/name/price 0.030, desc 0.0185). 값은 `design/project/메뉴판 템플릿 시스템.dc.html` 에서 가져온다.
- `tablet-land`: 메뉴 2열, 사진 슬롯 숨김. 그 외 1열 + 사진 슬롯(자리표시자).
- 폰트: Pretendard(본문), Nanum Myeongjo(제목/매장명).
- 테마 값(예): `light-olive`, `deep-green`, `cream`, `beige`(디자인 번들), `cafe-dark`, `bistro-light`(요구사항 문서). **최종 지원 목록과 `_설정`의 값 이름은 구현 시 확정**하고 이 문서를 갱신한다.
- `자동전환초 > 0`이면 클라이언트 타이머로 페이지 순환. 데이터 갱신 시 현재 페이지 인덱스를 유지(범위 초과 시 보정).
- 품절 스타일: 취소선 + opacity 0.5 + "품절" 배지.

## 6. 테스트 전략 (TDD)

[CLAUDE.md](CLAUDE.md)의 Red → Green → Refactor / Tidy First 규칙을 따른다.

| 대상 | 종류 | 방법 |
|---|---|---|
| `parse.mjs` | 단위 | 테스트 내에서 SheetJS로 인메모리 워크북 생성 → 기대 JSON 비교 |
| 디바운스/감시 | 단위 | 감시자·타이머 주입(가짜 타이머)로 300ms 합치기 검증 |
| SSE 브로드캐스트 | 단위/통합 | 가짜 response 객체 또는 임시 포트 서버 + `fetch` 스트림 |
| API | 통합 | 임시 포트에 서버 기동 → `GET /api/menu` 검증 |
| `layout.mjs` | 단위 | 디바이스별 치수/열 수/사진 슬롯 여부 |

- 실제 `data/menu.xlsx`에 의존하는 테스트 금지(픽스처는 테스트 안에서 생성).
- 시간·파일 경로·포트는 의존성 주입.
- `npm test` = `node --test`, 단일 테스트: `node --test --test-name-pattern="<이름>" <파일>`.

## 7. 구현 순서 (제안, 각 항목 = Red→Green→Refactor 반복)

1. `parse.mjs`: 시트 → pages (헤더 매핑, `_` 시트 제외)
2. `parse.mjs`: `_설정` → settings (기본값 포함), 품절/가격 규칙, 잘못된 입력 처리
3. `GET /api/menu` + 캐시
4. 디바운스 감시자 + SSE 브로드캐스트 (`/events`)
5. 클라이언트 렌더링 (순수 레이아웃 함수 → DOM)
6. 테마 적용 + 디바이스 반응형
7. 자동 전환 타이머
8. (확장) 카테고리 그룹, 테마 추가

## 8. 비기능 요구사항

- 갱신 지연 ≈ 디바운스(300ms) + 파싱 시간.
- 파싱 오류 시 서비스 지속(마지막 정상 데이터 유지).
- 외부 네트워크 의존: 웹폰트 CDN(Pretendard, Google Fonts) — 오프라인 사이니지에는 로컬 호스팅 고려.
- Windows/macOS 모두에서 동작(경로는 `node:path` 사용).
