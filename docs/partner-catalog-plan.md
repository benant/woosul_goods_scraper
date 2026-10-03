# 협력사 상품 카탈로그 정적 사이트

내부 랭킹 수집기에서 찜한 상품만 골라, 협력사가 브라우저로 보는 정적 사이트 계획이다.
이 문서를 코드와 대조해 검증한 뒤 그대로 구현한다.

## 1. 수집기에서 확인한 사실

- 수집 결과는 `oliveyoung_ranking_doms/oliveyoung_ranking_items.json`이다. 카테고리 13개(스킨케어, 마스크팩, 클렌징, 선케어, 메이크업, 네일, 뷰티소품, 더모 코스메틱, 향수/디퓨저, 헤어케어, 바디케어, 럭스에딧, 맨즈에딧) 아래 `items`가 있다.
- 대시보드 찜은 `oliveyoung_ranking_doms/favorites.json`에 상품코드 문자열 배열로 저장된다. 현재 순서는 `A000000170538`, `A000000217620`이고, 둘 다 수집 JSON에 있다.
- 같은 상품코드가 여러 카테고리에 동시에 있을 수 있다. 협력사 화면은 상품코드당 카드 1장으로 묶고, 카테고리별 순위는 배열로 남긴다.
- 기존 찜 내보내기(`GET /api/export?fav=1`)는 CSV와 xlsx만 만든다. 협력사 웹이 읽을 스냅샷은 없다.
- 목록·엑셀 필드는 `scraper/lib/data.mjs`의 `COLUMNS`와 같다. 상세 화면용으로는 정보고시(`article`)와 상세 이미지 원본 URL(`detailImages[].url`)이 더 있다.
- `detailHtml`은 로컬 이미지 경로로 바뀌어 있고 용량이 크다. 협력사 사이트에 넣지 않는다.
- 대표 이미지는 `imageUrl`(올리브영 CDN)을 쓴다. `imagePath`는 이 저장소의 로컬 파일이고 `images/`는 gitignore라 정적 사이트에 실을 수 없다.
- 정보고시 제목은 고정 스키마가 아니다. 예: `내용물의 용량 또는 중량`, `사용방법`, `제조국`, `화장품법에 따라 기재해야 하는 모든 성분`, `사용할 때의 주의사항`.

## 2. 만들 것

정적 파일만으로 동작하는 협력사 카탈로그.

- 로그인, 목록, 상세 세 화면.
- 화면 언어는 한국어와 인도네시아어만. 상품명·고시 본문·브랜드명은 수집된 한국어 그대로 둔다. 번역 원문이 없다.
- 로그인은 `partner-site/js/app.js`에 하드코딩한 계정 하나만 비교한다. 서버 세션은 없다.
- 계정: 아이디 `partner`, 비밀번호 `woosul2026`. 협력사에는 이 값을 사이트 밖에서 전달한다. 로그인 화면에 비밀번호를 적지 않는다.
- 로그인 성공 표시는 `sessionStorage` 키 `woosul_partner_auth`. 탭을 닫으면 다시 로그인한다.
- 언어는 `localStorage` 키 `woosul_lang` (`ko` 기본, `id`).

데이터 갱신:

- `npm --prefix scraper run export:partner`가 찜 목록과 수집 JSON을 읽어 `partner-site/data/catalog.js`를 다시 쓴다.
- 파일은 `window.PARTNER_CATALOG = { ... }` 형태다. `file://`에서도 fetch 없이 열린다.
- 찜에 있는데 수집 JSON에 없는 코드는 `missing` 배열에만 남기고 카드는 만들지 않는다.
- 한 상품이 여러 카테고리에 있으면 상세 HTML·고시가 더 있는 쪽을 본문으로 고르고, 순위는 전부 `ranks`에 넣는다. 카드 순서는 `favorites.json` 순서를 따른다.

## 3. 화면

해시 라우팅 단일 페이지 `partner-site/index.html`.

| 해시 | 화면 |
| --- | --- |
| `#/login` | 로그인 |
| `#/catalog` | 찜 상품 목록 |
| `#/product/<goodsNo>` | 상세 |

로그인 전에는 목록·상세 해시도 로그인으로 보내고, 성공 후 그 해시로 돌아간다.

목록: 검색(상품명, 브랜드, 상품코드), 카테고리, 정렬(담은 순서, 순위, 가격, 할인율, 상품명). 처음 순서는 찜 배열 순서다. 카드에는 대표 이미지, 순위, 브랜드, 상품명, 판매가, 할인율, 배지를 보여 준다.

상세: 대표 이미지, 상세 이미지(처음 8장, 나머지는 더 보기), 상품코드, 가격, 배지, 카테고리별 순위, 상품 카테고리 경로, 정보고시 전체, 올리브영 상세 URL 링크. 고시가 없으면 그 구역을 비운다.

## 4. 디자인

뷰티 카탈로그용으로 고른 방향은 Soft UI, 라이트 모드, 핑크·라벤더다. 마케팅 랜딩(히어로·후기·CTA) 패턴은 이 화면에 맞지 않아 쓰지 않는다.

- 배경 `#FDF2F8`, 카드 `#FFFFFF`, 테두리 `#FBCFE8`, 본문 `#831843`, 보조 글자 `#475569`
- 주요 버튼 `#EC4899` 배경에 검은 글자. 포인트 `#8B5CF6`는 검은 글자 대비가 4.5:1 미만이면 버튼 배경으로 쓰지 않고 장식에만 쓴다.
- 제목: 한국어 `Noto Serif KR`, 인도네시아어 `Playfair Display`. 본문: `Noto Sans KR` (한글과 라틴 모두 포함). `Inter`는 한글이 없어 쓰지 않는다.
- 네온, 다크 모드, 이모지 아이콘은 쓰지 않는다. 아이콘은 인라인 SVG.
- 클릭 요소는 `cursor: pointer`, 호버 150–300ms, 포커스 링 표시, `prefers-reduced-motion`에서 이동 애니메이션 제거.
- 너비 375, 768, 1024, 1440에서 레이아웃이 깨지지 않게 한다.
- 로그인 실패는 폼 상단 `role="alert"`에 포커스를 옮기고, 아이디·비밀번호 필드에도 오류를 연결한다.

## 5. 파일

```
docs/partner-catalog-plan.md
scraper/export-partner-catalog.mjs
scraper/package.json          # export:partner 스크립트만 추가
partner-site/index.html
partner-site/css/app.css
partner-site/js/app.js
partner-site/data/catalog.js  # 현재 찜 2건으로 생성
```

기존 대시보드, 수집기, 찜 API는 바꾸지 않는다.

## 6. 완료 조건

1. `npm --prefix scraper run export:partner`가 현재 찜 2건이 들어 있는 `catalog.js`를 만든다.
2. 틀린 비밀번호는 로그인되지 않고, 오류 문구가 한국어·인도네시아어로 바뀐다.
3. `partner` / `woosul2026`로 들어가면 목록에 찜 상품 2장이 보인다.
4. 카드를 누르면 상세에 가격, 순위, 정보고시가 보인다.
5. 언어를 인도네시아어로 바꾸면 버튼·라벨이 인도네시아어가 되고, 상품명은 한국어로 남는다.
6. 로그인하지 않고 `#/catalog`로 들어가면 로그인 화면이 나온다.

## 7. 문서 검증 결과

2026-10-02에 수집 JSON, `favorites.json`, `scraper/server.mjs`, `scraper/lib/data.mjs`, `.gitignore`와 대조했다.

- [x] 찜 파일은 문자열 배열이고, 순서는 `A000000170538`, `A000000217620`이다. 초안에 적었던 순서가 반대라 1절을 고쳤다.
- [x] 카테고리 이름은 1절의 13개와 같다.
- [x] 기존 내보내기는 `GET /api/export`의 CSV와 xlsx뿐이다.
- [x] `A000000217620`의 `detailHtml`은 `src="images/..."`가 110곳이고 `https` 이미지 주소는 없다. `.gitignore`는 `oliveyoung_ranking_doms/images/*`다. 대표 그림은 `imageUrl`이다.
- [x] 검증 시점에는 `partner-site/`가 없었다.
- [x] 색·서체·라이트 모드·네온 금지는 디자인 생성 결과와 같다. 히어로·후기·CTA 랜딩 패턴은 카탈로그에 맞지 않아 제외한 상태를 유지한다. 한글이 없는 `Inter` 대신 `Noto Sans KR`을 쓰는 예외도 유지한다.
- [x] 상세에 상품코드를 넣도록 3절을 보완했다. 협력사가 상품을 구분하는 수집 필드다.
