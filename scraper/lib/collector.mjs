// 올리브영 카테고리별 랭킹 목록 수집 로직.
// CLI(collect-ranking-list.mjs)와 대시보드 서버(server.mjs)가 함께 사용한다.
//
// Cloudflare가 일반 HTTP 요청을 403 차단하므로, PC에 설치된 Chrome을
// Playwright로 구동해 렌더링된 DOM을 읽는다.

import fs from 'fs';
import { URL_JSON, ITEMS_JSON, START_PAGE } from './paths.mjs';
import { createContext, warmUp, assertNotBlocked, passChallenge } from './browser.mjs';
import { saveImages, relImagePath } from './images.mjs';
import { collectDetails } from './detail.mjs';

// 중단(signal)이 걸리면 남은 대기시간을 다 소진하지 않고 즉시 깨어난다
const sleep = (ms, signal) =>
	new Promise((resolve) => {
		if (signal?.aborted) return resolve();
		const t = setTimeout(resolve, ms);
		signal?.addEventListener('abort', () => {
			clearTimeout(t);
			resolve();
		}, { once: true });
	});

// 목록 DOM 이 뽑아내는 대표 이미지. 상품코드별로 images/<goodsNo>/<goodsNo>_main.<ext> 에 저장한다.
async function saveListImages(items) {
	const entries = items
		.filter((it) => it.imageUrl && it.imageKey)
		.map((it) => ({
			url: it.imageUrl,
			relNoExt: relImagePath(it.imageKey, `${it.imageKey}_main`)
		}));
	if (!entries.length) return 0;
	const map = await saveImages(entries);
	for (const it of items) {
		const rel = map.get(it.imageUrl);
		if (rel) it.imagePath = rel;
	}
	return map.size;
}

/** 목록/상세 수집 공통으로 쓰는 브라우저 컨텍스트 (browser.mjs) */
export { createContext };

// 랭킹 URL에서 카테고리 메타 추출
export function parseCategoryMeta(url) {
	const u = new URL(url);
	const tClick = u.searchParams.get('t_click') || '';
	// t_click 예: "판매랭킹_스킨케어" -> "스킨케어"
	const parts = tClick.split('_').filter(Boolean);
	return {
		name: parts.slice(1).join('_') || tClick,
		fltDispCatNo: u.searchParams.get('fltDispCatNo'),
		dispCatNo: u.searchParams.get('dispCatNo'),
		rankingUrl: url
	};
}

export function readTargetUrls() {
	const raw = JSON.parse(fs.readFileSync(URL_JSON, 'utf8'));
	return Array.isArray(raw) ? raw : raw.category || [];
}

// 목록 DOM 파싱 (브라우저 컨텍스트에서 실행되므로 외부 스코프를 참조할 수 없다)
function extractItems() {
	const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
	const pick = (root, sel) => root.querySelector(sel);
	const toNum = (t) => {
		if (!t) return null;
		const digits = String(t).replace(/[^\d.]/g, '');
		if (!digits) return null;
		const n = Number(digits);
		return Number.isFinite(n) ? n : null;
	};

	return Array.from(document.querySelectorAll('ul.cate_prd_list > li')).map((li, idx) => {
		const thumbA = pick(li, 'a.prd_thumb') || pick(li, 'a.prd_name');
		const img = pick(li, 'a.prd_thumb img');
		const rankFlag = pick(li, 'span.thumb_flag');
		const jeem = pick(li, 'button.btn_zzim') || pick(li, 'button.cartBtn');

		const normalPrice = toNum(text(pick(li, '.tx_org .tx_num')));
		const salePrice = toNum(text(pick(li, '.tx_cur .tx_num')));
		const effectivePrice = salePrice ?? normalPrice;

		// NOTE: 평점(.review_point .point)은 "10점만점에 5.5점"이라는 상수 텍스트와
		// style="width:%" (빈 서식자)만 있고 실제 값이 없다. 올리브영 메인페이지에서도 동일하다.
		// 따라서 수집하지 않는다. 실제 평점/리뷰수는 상세페이지에서 가져와야 한다.

		const categoryPath = (jeem && jeem.getAttribute('data-ref-goodscategory')) || '';
		const itemNo = jeem ? jeem.getAttribute('data-ref-itemno') : null;
		const goodsNo = (jeem && jeem.getAttribute('data-ref-goodsno')) || (thumbA && thumbA.getAttribute('data-ref-goodsno')) || null;

		return {
			rank: idx + 1,
			rankingType: rankFlag ? rankFlag.className.replace('thumb_flag', '').trim() : null,
			goodsNo,
			itemNo: itemNo && itemNo !== 'null' ? itemNo : null,
			imageKey: goodsNo,
			name: text(pick(li, 'p.tx_name')),
			brand: text(pick(li, 'span.tx_brand')),
			categoryPath,
			categoryParts: categoryPath ? categoryPath.split('>').map((s) => s.trim()).filter(Boolean) : [],
			normalPrice,
			salePrice,
			effectivePrice,
			discountRate:
				normalPrice && effectivePrice && normalPrice > effectivePrice
					? Math.round((1 - effectivePrice / normalPrice) * 100)
					: null,
			flags: Array.from(li.querySelectorAll('.prd_flag .icon_flag')).map((s) => s.textContent.trim()).filter(Boolean),
			imageUrl: img ? img.getAttribute('src') : null,
			// 목록 대표이미지를 images/<imageKey>/<imageKey>_main.<ext> 에 내려받은 뒤 채워진다
			imagePath: null,
			detailUrl: thumbA ? thumbA.href : null
		};
	});
}

async function collectOne(context, url) {
	const page = await context.newPage();
	try {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await passChallenge(page);
		// 목록이 채워질 때까지 대기 (Cloudflare 검증 화면이면 selector가 안 뜬다)
		await page.waitForSelector('ul.cate_prd_list > li', { timeout: 30000 });
		const items = await page.evaluate(extractItems);
		const title = await page.title();
		assertNotBlocked(title);
		return items;
	} finally {
		await page.close();
	}
}

/**
 * 전체 카테고리 수집.
 * @param {{delay?:number, top?:number, headed?:boolean, limit?:number, images?:boolean,
 *          detail?:boolean, onProgress?:(e:object)=>void, signal?:AbortSignal,
 *          detailDelay?:number}} opts
 */
export async function collectAll(opts = {}) {
	const {
		delay = 1500,
		top = 0,
		headed = false,
		limit = 0,
		images = true,
		detail = false,
		onProgress = () => {},
		signal = null,
		// (meta)=>bool : 특정 카테고리만 방문할 때 쓴다 (상품 1건 재수집)
		limitFilter = null,
		// 목록 수집 간격(1.5초)보다 길어야 연속 접근에 막히지 않는다
		detailDelay = 5000
	} = opts;

	let urls = readTargetUrls();
	if (limit > 0) urls = urls.slice(0, limit);
	// 재수집 등에서 필요한 카테고리만 골라 방문할 수 있게 한다
	if (typeof limitFilter === 'function') urls = urls.filter((u) => limitFilter(parseCategoryMeta(u)));
	if (!urls.length) throw new Error(`수집할 URL이 없습니다: ${URL_JSON}`);

	const { browser, context } = await createContext(headed);

	const categories = [];

	try {
		// Cloudflare 통과용 예열 방문
		await warmUp(context);

		for (const [idx, url] of urls.entries()) {
			if (signal?.aborted) break;
			const meta = parseCategoryMeta(url);
			try {
				const collected = await collectOne(context, url);
				// 목록 응답은 rowsPerPage 무시하고 최대 100개를 돌려준다. top 으로 자를 수 있다.
				const items = top > 0 ? collected.slice(0, top) : collected;
				// 대표 이미지는 같은 상품코드가 여러 카테고리에 나와도 한 번만 받는다
				const imageCount = images ? await saveListImages(items) : 0;
				categories.push({ ...meta, collectedAt: new Date().toISOString(), itemCount: items.length, items });
				onProgress({ index: idx + 1, total: urls.length, name: meta.name, count: items.length, imageCount, status: 'ok' });
			} catch (err) {
				categories.push({
					...meta,
					collectedAt: new Date().toISOString(),
					itemCount: 0,
					items: [],
					error: err.message
				});
				onProgress({ index: idx + 1, total: urls.length, name: meta.name, count: 0, status: 'error', error: err.message });
			}
			if (idx < urls.length - 1) await sleep(delay, signal);
		}

		const payload = { source: START_PAGE, generatedAt: new Date().toISOString(), categories };

		// --detail 이면 목록 수집이 끝난 뒤 이어서 상세페이지(상품 상세 설명 DOM)를 돌린다
		if (detail && !signal?.aborted) {
			const result = await collectDetails(payload, {
				delay: detailDelay,
				images,
				signal,
				onProgress: (e) => onProgress({ ...e, phase: 'detail' })
			});
			payload.detail = result;
		}

		return payload;
	} finally {
		await browser.close();
	}
}

export function saveItems(payload) {
	fs.writeFileSync(ITEMS_JSON, JSON.stringify(payload, null, '\t'), 'utf8');
	return ITEMS_JSON;
}
