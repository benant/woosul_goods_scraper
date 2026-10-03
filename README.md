# 올리브영 카테고리별 랭킹 수집기

올리브영 랭킹 페이지의 **목록 DOM**(`ul.cate_prd_list > li`)을 카테고리별로 수집하고,
**상품 상세 설명 DOM**(상세페이지의 `section.GoodsDetailTabs_product-info-panel__*`)까지 이어서 수집해
JSON으로 저장한다. 이미지는 전부 로컬(`oliveyoung_ranking_doms/images/`)에 내려받아 두고,
로컬 대시보드에서 열어보고 **엑셀(xlsx) / CSV**로 내보낸다.
찜한 상품만 협력사에 보여줄 때는 `partner-site/` 정적 페이지를 쓴다.

## 다른 PC에 전달하기 (패키징)

수신자 PC에서 바로 실행할 수 있는 zip 을 만든다.

```bash
cd event-page/goods_summary
node build-package.mjs
```

산출물: `dist/올리브영_랭킹_수집기_YYYYMMDD-HHmm.zip` (약 4 MB)
(zip 이름에만 빌드 시각을 붙여 버전이 구분된다. `node verify-package.mjs "<zip 경로>"` 로 내용 검증)

패키지 구성:

```
올리브영_랭킹_수집기/
├─ 시작하기.bat          <- 더블클릭. 사전 점검 후 서버 기동 + 브라우저 자동 실행
├─ 사용법.txt            <- 수신자용 설명서 (한글)
└─ goods_summary/        <- 저장소와 동일한 구조 (상대경로 의존)
   ├─ oliveyoung_ranking_doms\
   └─ scraper\  (node_modules 포함)
```

`oliveyoung_ranking_doms\images\`(수집한 상품 이미지)는 zip 에 넣지 않는다.
용량만 커지고(수 GB) 수신자 PC 에서 다시 모으면 된다.

`node_modules`(playwright) 를 zip 에 담아 **수신자가 `npm install` 을 할 필요가 없다.**
남는 전제조건은 **Node.js 와 Google Chrome** 뿐이며, `시작하기.bat` 이 둘을 자동 점검한다.
브라우저는 `playwright install` 로 받은 것이 아니라 **시스템 Chrome** 을 사용하므로
별도 브라우저 다운로드(약 150 MB)도 없다.

### 주의: `시작하기.bat` 는 반드시 순수 ASCII

Windows `cmd.exe` 는 `.bat` 를 **시스템 코드페이지**(한글 Windows 면 cp949)로 읽는다.
배치 파일에 한글이 들어가면 — UTF-8 BOM 을 붙여도 — 파싱 단계에서 깨져
`'@echo'` 는(는) 현재 선택된 ...` 같은 오류를 내고 **스크립트 자체가 실행되지 않는다.**
(실제로 BOM 으로 시도했다가 첫 줄부터 깨지는 것을 확인했다)

그래서 배치 파일은 영어/ASCII 로만 작성하고, 한글 안내는 `사용법.txt` 로 분리한다.
`build-package.mjs` 가 `.bat` 에 ASCII 범위 밖 바이트가 있으면 빌드를 실패시킨다.

### 전달 방법

zip 을 카톡/메일/드라이브로 전달하면 된다. 4 MB 이므로 그대로 보낼 수 있다.
수신자는 풀고 `시작하기.bat` 을 더블클릭하면 끝이다.

> ⚠️ `dist/` 는 정적 사이트 배포 대상이므로 `.gitignore` 에 넣어 두었다.

## 실행

> ⚠️ **`package.json` 은 `scraper\` 폴더 안에 있다.** `goods_summary` 에서 실행하면
> `ENOENT ... package.json` 에러가 난다. `scraper` 로 이동한 뒤 실행할 것.

```bash
cd event-page/goods_summary/scraper
npm install          # 최초 1회 (playwright)

npm run dashboard      # 대시보드 http://localhost:3000
npm run collect        # 목록 수집 (CLI)
npm run collect:detail # 상세페이지 수집 (CLI) — 목록 결과가 있어야 돌아감
npm run export:partner # 찜 상품을 partner-site/data/catalog.js 로 내보냄
```

Windows 명령 프롬프트:

```
cd /d D:\woosul\www\woosul_www3\event-page\goods_summary\scraper
npm run dashboard
```

리포지토리 루트에 머무르면서 실행하려면:

```bash
npm --prefix event-page/goods_summary/scraper run dashboard
```

### CLI 옵션 (목록 수집: `npm run collect -- <옵션>`)

| 옵션 | 설명 |
| --- | --- |
| `--headed` | 브라우저를 띄워 수집 (차단될 때) |
| `--limit 3` | 앞 3개 카테고리만 |
| `--top 8` | 카테고리별 상위 N개만 |
| `--delay 2000` | 요청 간 대기 ms (기본 1500) |
| `--no-images` | 대표이미지를 로컬에 받지 않음 |
| `--detail` | 목록 뒤에 상세페이지까지 이어서 수집 (매우 오래 걸림) |

### CLI 옵션 (상세 수집: `npm run collect:detail -- <옵션>`)

목록 결과(`oliveyoung_ranking_items.json`)를 읽어 상세만 돌아간다.
**이미 수집한 상품은 자동으로 건너뛰므로** 중단했다 이어서 돌릴 수 있다.

| 옵션 | 설명 |
| --- | --- |
| `--limit 20` | 앞에서 20개 상품만 |
| `--goodsNo A000000263019` | 특정 상품만 |
| `--force` | 이미 수집한 상품도 다시 받기 |
| `--no-images` | HTML 만 받고 이미지는 받지 않음 |
| `--delay 8000` | 요청 간 대기 ms (기본 5000, 막히면 늘릴 것) |
| `--headed` | 브라우저를 띄워 수집 (차단될 때) |

## 대시보드 (http://localhost:3000)

- 수집 데이터 표: 검색 / 카테고리 / **브랜드** / 배지 / 가격대 필터, 정렬, 페이지네이션
  - 브랜드는 380개 내외라 드롭다운(정렬됨)에서 고른다. 부분 문자열은 검색창으로 잡는다
- **CSV · xlsx 내려받기**: 화면에 걸린 필터·정렬이 그대로 적용됨
  - xlsx는 `전체랭킹` 시트 1개 + 카테고리별 시트 13개로 구성
  - 헤더 행 고정(freeze) + 자동필터 적용, 금액은 천단위 서식의 진짜 숫자 타입
- **수집 실행** 버튼: 서버 안에서 수집을 직접 돌리고 SSE로 실시간 진행률 표시
  - 브라우저 탭을 닫아도 Node 프로세스가 계속 수집한다
  - 수집 폼(옵션 + 로그)은 기본적으로 숨겨져 있다. 실행하면 자동으로 펼쳐지고,
    [접기] 를 누르면 다시 숨는다(다음 방문에도 유지). 상단 [수집 설정] 으로 언제든 다시 펼친다
  - 폼은 2단 구성: **왼쪽 = 수집 옵션**, **오른쪽 = 수집 로그**(새 줄이 보이면 자동 스크롤)
  - 옵션: 카테고리당 최대 개수 / 대기시간 / 카테고리 수 / headed /
    "상품이미지 로컬 저장"(기본 켜) / "상세페이지까지 이어서 수집" / "이미 수집한 상품도 다시 받기"
- **상세만 수집** 버튼: 목록은 그대로 두고 아직 안 받은 상품의 상세만 돌아간다
  - 이미 수집한 상품은 자동으로 건너뛴다 ("이미 수집한 상품도 다시 받기" 는 `--force`)
- **설명 보기** (표의 `상세` 열): 수집한 상품 상세 설명 DOM 을 원본 그대로 렌더링
  - 목록 API 응답에서는 `detailHtml` 을 뺀다(상품당 수십 KB). 필요할 때 `/api/detail` 로 따로 받는다

> 포트 변경: `PORT=3100 npm run dashboard`

## 협력사 카탈로그 (`partner-site/`)

대시보드에서 **찜**해 둔 상품만 협력사 브라우저로 보여주는 정적 사이트다.
서버가 없고, `partner-site/` 폴더를 그대로 올리면 된다. `index.html` 을 파일로 열어도 된다.

화면은 세 개다. 주소는 해시로 나뉜다.

| 해시 | 화면 |
| --- | --- |
| `#/login` | 로그인 |
| `#/catalog` | 찜 상품 목록 |
| `#/product/<goodsNo>` | 상세 |

- 화면 언어는 **한국어 / 인도네시아어**만. 오른쪽 위 버튼으로 바꾼다.
  상품명, 브랜드, 정보고시 본문은 수집된 한국어 그대로다.
- 로그인은 `partner-site/js/app.js` 의 계정 상수만 비교한다. 서버 검증은 없다.
  아이디 `partner`, 비밀번호 `woosul2026`. 로그인 화면에는 적혀 있지 않으므로 협력사에는 따로 전달한다.
  탭을 닫으면 다시 로그인한다.
- 로그인하지 않고 `#/catalog` 나 상세 주소로 들어가면 로그인 화면이 나온다.

목록에서는 상품명·브랜드·상품코드 검색, 카테고리, 정렬(담은 순서 / 순위 / 가격 / 할인율 / 상품명)이 된다.
처음 카드 순서는 `oliveyoung_ranking_doms/favorites.json` 순서다.
상세에는 상품코드, 가격, 배지, 카테고리별 순위, 정보고시가 나온다.
상세 설명 이미지는 왼쪽 칸 너비에 맞춰 전부 이어서 보인다.

### 데이터 갱신

찜을 바꾸면 사이트가 자동으로 따라가지 않는다. 내보내기를 다시 실행한다.

```bash
cd scraper
npm run export:partner
```

리포지토리 루트에서:

```bash
npm --prefix scraper run export:partner
```

`favorites.json` 과 `oliveyoung_ranking_items.json` 을 읽어
`partner-site/data/catalog.js` 와 `partner-site/data/catalog.xlsx` 를 덮어쓴다.
대시보드의 **찜 Excel** 도 같은 열(상세이미지, 정보고시 포함)로 내려받는다.
협력사 화면의 [Excel 가져오기]로 그 파일을 불러오면 그 내용이 목록과 상세가 된다.
같은 상품이 여러 카테고리에 있으면 카드는 1장이고, 순위는 카테고리별로 모두 남긴다.
찜에만 있고 수집 JSON 에 없는 코드는 카드를 만들지 않는다.

이미지는 올리브영 CDN 주소(`imageUrl`, `detailImages[].url`)를 쓴다.
`detailHtml` 과 `images/` 로컬 파일은 넣지 않는다. 상세 HTML 의 그림 경로가 이미 로컬로 바뀌어 있어
협력사 PC 에서는 깨지기 때문이다. 협력사 화면의 그림은 인터넷이 되어야 보인다.

협력사에 보낼 때는 `partner-site/` 폴더 전체를 정적 호스팅에 올리거나 폴더째 전달한다.
비밀번호는 JS 안에 있으므로, 폴더를 받은 사람은 파일을 열어 계정을 볼 수 있다.

## 이미지 로컬 저장

모든 이미지는 `oliveyoung_ranking_doms/images/<goodsNo>/` 아래에 저장되고,
JSON 에는 원본 URL 과 함께 로컬 상대경로가 함께 들어간다.

| 종류 | 저장 위치 |
| --- | --- |
| 목록 대표이미지 | `images/<goodsNo>/<goodsNo>_main.<ext>` |
| 상세 설명 이미지 | `images/<goodsNo>/<goodsNo>_d1.<ext>`, `_d2`, … |

- `detailHtml` 안의 `src` 는 이미 로컬 상대경로로 바뀌어 있다 (오프라인으로 열 수 있다).
  원본이 필요하면 `detailImages[].url` 에 남아 있다.
- `lazy load` 된 이미지는 `src` 자리에 1x1 gif가 있고 진짜 주소는 `data-src` 에 있다.
  둘 다 처리해서 로컬 파일로 교체하고 `data-src` 는 지운다.
- `<picture><source srcset="…webp">` 는 같은 그림의 webp 변형이라 로컬로 안 받는다.
  원본 URL 이 남으면 오프라인에서 다시 치기 때문에 `<source>` 자체를 제거한다.
- **이미 있는 파일은 다시 받지 않는다.** 같은 파일은 캐시 여부를 먼저 보고, 건너뛴다.
- 대시보드는 `/images/...` 로 이 폴더를 서빙한다 (`server.mjs` 경로 탈출 방지 포함).

> ⚠️ **용량**: 상품 1건당 상세 이미지 25~40개, 약 3 MB 다. 1,300건이면 대략 **3~4 GB** 다.
> 이미지 원본이 필요 없다면 `--no-images` 로 HTML 만 받고, 이미 받은 파일은 지워도 된다
> (수집은 파일이 있으면 다시 받지 않는다).

## 알아둘 점

**1. 일반 HTTP로는 수집할 수 없다.**
올리브영이 Cloudflare로 403을 반환한다(`__cf_bm` 쿠키 + "잠시만 기다려 주세요" 페이지).
그래서 PC에 설치된 Chrome을 Playwright로 구동해 렌더링된 DOM을 읽는다.
(`playwright install` 로 브라우저를 따로 받지 않고 `channel: 'chrome'` 으로 시스템 Chrome 사용)

**2. `rowsPerPage=8` 은 서버에서 무시된다.**
카테고리당 **100개**가 내려온다. 옵션 없이 실행하면 상위 100개를 전부 수집한다.
8개만 필요하면 `--top 8` 또는 대시보드의 "카테고리당 최대".

**3. 목록 DOM에는 평점이 없다.**
`.review_point .point` 는 `style="width:%"` (빈 서식자) 이고 텍스트는 항상
"10점만점에 5.5점" 이라는 **상수**다. 올리브영 메인페이지에서도 동일하게 그렇다.
따라서 `rating` 필드는 수집하지 않는다 — 값이 아니라 없는 데이터라 담으면 엑셀에서 전부 5.5로 나온다.
실제 평점과 리뷰수는 **상세페이지**에서 가져와야 한다.

**4. 상세 설명은 목록에 없다.** → 상세페이지 수집(`collect:detail`)으로 채운다. `items[].detailHtml`.
리뷰 수 / 옵션 / 판매량까지 넣으려면 `lib/detail.mjs` 의 `fetchDetail` 을 더 채우면 된다.

**5. 같은 상품이 여러 카테고리에 오를 수 있다.**
1300행 중 고유 상품은 1176개이며 123개 상품이 2개 이상 카테고리에 동시에 등장한다
(예: 스킨케어 + 더모 코스메틱). 카테고리 안에서는 중복이 없다. 엑셀에서 그대로 중복 행으로 두는 게
순위를 보존하므로, 중복 제거가 필요하면 `goodsNo` 기준으로 직접 필터링한다.

**6. 더모 코스메틱 / 럭스에딧 / 맨즈에딧 은 카테고리가 섞여 있다.**
큐레이션 목록이라 `상품카테고리` 가 스킨케어·메이크업 등 여러 갈래로 나온다. 정상이다.

## 출력 구조

```jsonc
{
  "source": "https://www.oliveyoung.co.kr/store/main/main.do",
  "generatedAt": "2026-09-28T08:14:53.000Z",
  "categories": [
    {
      "name": "스킨케어",              // t_click 파라미터에서 추출
      "fltDispCatNo": "10000010001",
      "dispCatNo": "900000100100001",
      "rankingUrl": "https://...",
      "collectedAt": "2026-09-28T08:14:53.000Z",
      "itemCount": 100,
      "items": [ /* 아래 필드 */ ]
    }
  ]
}
```

### items 필드

| 필드 | 설명 | 예시 |
| --- | --- | --- |
| `rank` | 카테고리 내 순위 (1~100) | `1` |
| `rankingType` | 랭킹 배지 종류 | `"best"` |
| `goodsNo` | 상품 코드 (상세페이지 수집 시 사용) | `"A000000263019"` |
| `itemNo` | 옵션 품목 코드 (없으면 `null`) | `null` |
| `name` | 상품명 | `"[9월 올영픽] ..."` |
| `brand` | 브랜드 | `"라로슈포제"` |
| `categoryPath` | 상품 카테고리 경로 원본 | `"01 > 스킨케어 > 크림"` |
| `categoryParts` | 경로 분리 배열 | `["01","스킨케어","크림"]` |
| `normalPrice` | 정가 (숫자) | `52000` |
| `salePrice` | 판매가 (숫자, 세일 없으면 `null`) | `38300` |
| `effectivePrice` | 실제 판매가 = `salePrice ?? normalPrice` | `38300` |
| `discountRate` | 할인율 % (정가 대비, 정가 없을 때 `null`) | `26` |
| `flags` | 아이콘 배지 배열 (세일/쿠폰/오늘드림/증정/1+1/무배 ...) | `["세일","쿠폰","오늘드림"]` |
| `imageUrl` | 대표 이미지 원본 URL | `"https://image.oliveyoung.co.kr/..."` |
| `imagePath` | 대표 이미지 로컬 상대경로 | `"images/A000000263019/A000000263019_main.jpg"` |
| `imageKey` | 이미지 폴더 키 (보통 `goodsNo`) | `"A000000263019"` |
| `detailUrl` | 상세페이지 URL | `"https://.../getGoodsDetail.do?goodsNo=..."` |

### 상세 수집이 추가하는 필드

| 필드 | 설명 | 예시 |
| --- | --- | --- |
| `detailHtml` | 상품 상세 설명 DOM 전체 HTML. 이미지 주소는 로컬 상대경로로 치환됨 | `"<!-- 상품상세설명 DOM -->\n<section …>"` |
| `detailImages` | 상세 이미지 `[{url, path}]` — 원본과 로컬 경로 | `[{"url":"https://…","path":"images/…/…_d1.png"}]` |
| `detailImageCount` | 저장한 상세 이미지 수 | `26` |
| `detailCollectedAt` | 상세 수집 시각 (ISO) | `"2026-09-28T09:41:02.000Z"` |
| `detailError` | 실패 사유 (성공하면 `null`) | `null` |

`--detail` 로 목록과 한 번에 돌렸을 때만 최상위에 요약이 추가된다.

```jsonc
"detail": { "total": 1300, "ok": 1287, "failed": 13, "images": 33122, "startedAt": "…", "finishedAt": "…" }
```

## 확장 메모 (상세페이지 수집)

1. `oliveyoung_ranking_items.json` 의 `items[].detailUrl` 을 순회 — 구현: `lib/detail.mjs`
2. 같은 상품코드는 카테고리가 달라도 1번만 수집하고, 결과는 전 카테고리에 merge 한다
3. 대시보드는 저장된 JSON을 매 요청마다 읽으므로, 저장만 하면 새로고침 없이 반영됨
4. 실제 평점/리뷰수/옵션/판매량은 여기(`fetchDetail`)에서 더 채우면 된다
5. **Cloudflare**: 상세페이지를 연속으로 열면 `잠시만 기다리십시오` 화면이 뜬다.
   막히면 Chrome 세션을 통째로 새로 잡고 30초 → 60초 → 120초 → 240초 대기 후 재시도한다
   (`lib/detail.mjs` 의 `BACKOFF`). 그래도 안 되면 `--headed` 로 띄워서 돌리면 된다.
