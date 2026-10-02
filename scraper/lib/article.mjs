// 올리브영 상품 **정보고시(article)** 수집.
//
// 상세페이지의 "품질정보 제공" 표(사용방법, 제조국, 제조업자, 성분 등)는
// POST /goods/api/v1/article 로 내려온다. 전송 데이터는 company_n_goods_info.txt 참고:
//   { goodsNumber, goodsOptionInfoList: [{standardCode, optionName}], liquorFlag }
//
// 주의 사항 (실험으로 확인):
// - goodsOptionInfoList 를 비우면 400. 옵션이 없는 단일 상품도 표준코드 1개는 넣어야 한다.
// - 이 API 는 page.request 나 절대 URL fetch 로는 Cloudflare 403. 반드시 상세페이지에
//   들러난 뒤 페이지 컨텍스트(evaluate) 안의 상대경로 fetch 로 불러야 한다.
// - 옵션 목록(표준코드)은 화면에 렌더되지 않고 Next.js flight 데이터(__next_f script)에
//   이스케이프된 JSON 으로만 존재한다. depth 카운터로 배열을 잘라 파싱한다.

/**
 * 페이지의 script 태그에서 옵션 목록(표준코드/옵션명)을 뽑는다. (page.evaluate 용)
 * 단일 상품은 옵션이 1개(자기 자신)로 나온다.
 */
function extractOptionsFromFlight() {
	const all = [...document.querySelectorAll('script')].map((s) => s.textContent || '').join('');
	const marker = '\\"options\\":[';
	let start = all.indexOf(marker);
	if (start < 0) return [];

	// 배열 끝 찾기: 문자열(escape 포함)을 건너뛰며 괄호 깊이를 센다
	let i = start + marker.length - 1;
	let depth = 0;
	let end = -1;
	let inStr = false;
	let esc = false;
	for (; i < all.length; i++) {
		const ch = all[i];
		if (esc) {
			esc = false;
			continue;
		}
		if (ch === '\\') {
			esc = true;
			continue;
		}
		if (ch === '"') {
			inStr = !inStr;
			continue;
		}
		if (inStr) continue;
		if (ch === '[' || ch === '{') depth++;
		else if (ch === ']' || ch === '}') {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}
	if (end < 0) return [];

	let raw = all.slice(start + marker.length - 1, end + 1);
	raw = raw.split('\\"').join('"');
	try {
		const arr = JSON.parse(raw);
		return arr
			.filter((o) => /^\d{6,}$/.test(String(o.standardCode || '')))
			.map((o) => ({ standardCode: String(o.standardCode), optionName: String(o.optionName || '').trim() }));
	} catch {
		return [];
	}
}

/** article API 호출. 반드시 evaluate 안(페이지 컨텍스트)에서 상대경로로 불러야 403 을 피한다. */
async function articleRequest(payload) {
	const res = await fetch('/goods/api/v1/article', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			accept: 'application/json, text/javascript, */*; q=0.01',
			'x-requested-with': 'XMLHttpRequest'
		},
		body: JSON.stringify(payload)
	});
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		return { code: res.status, status: 'ERROR', message: `HTTP ${res.status} (JSON 아님)`, data: null };
	}
}

/** 응답을 {제목: 내용} 평탄화. 그룹이 여러 개면 제목 앞에 [그룹명] 을 붙인다. */
function flattenArticles(articleInfoList) {
	const out = {};
	const list = articleInfoList || [];
	for (const group of list) {
		const prefix = list.length > 1 ? `[${group.title}] ` : '';
		for (const it of group.items || []) {
			if (!it?.title) continue;
			out[prefix + it.title] = it.content ?? '';
		}
	}
	return out;
}

/**
 * 상세페이지(page)가 열려 있는 상태에서 정보고시를 가져온다.
 * 실패해도 예외를 던지지 않고 articleError 로 돌려준다 — 상세 수집 본진을 막지 않게.
 * @param {import('playwright').Page} page 상세페이지가 열려 있는 페이지
 * @param {string} goodsNo 상품코드
 * @returns {Promise<{article:object|null, articleError:string|null}>}
 */
export async function fetchArticle(page, goodsNo) {
	try {
		const options = await page.evaluate(extractOptionsFromFlight).catch(() => []);
		if (!options.length) return { article: null, articleError: '옵션(표준코드)을 찾지 못함' };

		const j = await page.evaluate(articleRequest, {
			goodsNumber: goodsNo,
			goodsOptionInfoList: options,
			liquorFlag: false
		});

		if (j?.status !== 'SUCCESS' || !j?.data) {
			return { article: null, articleError: j?.message || `code ${j?.code}` };
		}

		const flat = flattenArticles(j.data.articleInfoList);
		if (!Object.keys(flat).length) return { article: null, articleError: '정보고시 항목이 비어 있음' };
		return { article: flat, articleError: null };
	} catch (err) {
		return { article: null, articleError: err.message };
	}
}
