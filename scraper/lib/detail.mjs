// 올리브영 상품 **상세페이지** 수집.
//
// 목록 DOM(ul.cate_prd_list)에는 상품 상세 설명이 없다. 상세페이지의
// "상품 상세 설명 DOM" 영역(section.GoodsDetailTabs_product-info-panel__*) 전체 HTML을
// 통째로 가져와 detailHtml 에 넣고, 그 안의 이미지는 로컬로 내려받아
// images/<goodsNo>/<goodsNo>_dN.<ext> 로 바꿔 끼운다.
//
// 참고: 아래 evaluate 안의 함수들은 브라우저로 직렬화되어 실행되므로
// 외부 스코프를 참조할 수 없다. 루트 찾기를 두 번 적는 것도 그 때문이다.

import { createContext, warmUp, assertNotBlocked, passChallenge } from './browser.mjs';
import { saveImages, relImagePath } from './images.mjs';
import { fetchArticle } from './article.mjs';

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

// Cloudflare 로 막혔을 때 재시도 전 대기 시간
const BACKOFF = [30000, 60000, 120000, 240000];

// 상세 설명 = 상품 본체 이미지 영역(.iPrdViewimg) 만 담는다.
// 그 밖의 공지배너/협회 안내박스/관련상품 스와이퍼는 수집하지 않는다.
const DETAIL_ROOT_SELECTOR = '.iPrdViewimg';

// 스켈레톤(로딩 Placeholder)이 빠지고 실제 본문이 그려졌는지 확인.
// 바로 읽으면 GoodsDetailTabs_skeleton 만 담긴 껍데기가 저장된다.
function detailReady() {
	const root = document.querySelector('.iPrdViewimg');
	if (!root) return false;
	if (root.querySelector('[class*="skeleton"]')) return false;
	return !!root.querySelector('img');
}

// 1) 원본 HTML + 이미지 URL 목록 — .iPrdViewimg(상품 본체 이미지 영역) 만 추출한다.
function extractDetailSpec() {
	const root = document.querySelector('.iPrdViewimg');
	if (!root) return null;

	const urls = [];
	const add = (u) => {
		if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u);
	};
	for (const el of root.querySelectorAll('img')) {
		// lazy load 된 이미지는 src 자리에 1x1 gif가 있고 진짜 주소는 data-src 에 있다
		add(el.getAttribute('data-src'));
		add(el.getAttribute('src'));
	}
	return { html: root.outerHTML, urls };
}

// 2) imageMap(원본URL -> 로컬 상대경로) 로 src 를 치환한 HTML — 추출 범위는 위와 같다.
function rewriteDetailHtml(imageMap) {
	const root = document.querySelector('.iPrdViewimg');
	if (!root) return null;

	const clone = root.cloneNode(true);

	for (const el of clone.querySelectorAll('img')) {
		const local = imageMap[el.getAttribute('data-src')] || imageMap[el.getAttribute('src')];
		if (!local) continue;
		el.setAttribute('src', local);
		// lazy load 속성은 남겨두면 브라우저가 원본 서버를 다시 친다
		el.removeAttribute('data-src');
		el.removeAttribute('data-srcset');
	}

	// <picture><source srcset="...webp"> 는 로컬로 안 받은 변형이라 제거한다.
	// 제거하지 않으면 오프라인에서 원본 서버를 다시 치게 된다.
	for (const el of clone.querySelectorAll('source')) {
		const raw = el.getAttribute('srcset') || '';
		const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
		const local = parts.map((p) => {
			const [u, ...rest] = p.split(/\s+/);
			const hit = imageMap[u];
			return hit ? [hit, ...rest].join(' ') : null;
		}).filter(Boolean);
		if (local.length) el.setAttribute('srcset', local.join(', '));
		else el.remove();
	}

	return '<!-- 상품상세설명 DOM -->\n' + clone.outerHTML;
}

/** 상품 하나의 상세 정보 수집. 실패해도 예외를 던지지 않고 detailError 로 담는다. */
async function fetchDetail(context, target, { images = true, article = true, articleOnly = false } = {}) {
	const page = await context.newPage();
	try {
		await page.goto(target.detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await passChallenge(page);
		assertNotBlocked(await page.title());
		await page.waitForSelector(DETAIL_ROOT_SELECTOR, { timeout: 30000 });

		// ---- 고시 전용 모드: 정보고시만 가져온다. 이미지 저장도 안 하므로 빠르다.
		// 주의: detail* 필드를 아예 반환하지 않는다 — Object.assign 병합에서
		// 기존 detailHtml 을 null 로 덮어쓰는 사고를 막기 위함(상세 보존).
		if (articleOnly) {
			const info = await fetchArticle(page, target.goodsNo);
			return {
				article: info.article,
				articleError: info.articleError,
				articleCollectedAt: info.article ? new Date().toISOString() : null
			};
		}

		// 본문(상품 상세 이미지)이 렌더될 때까지 기다린다. 텍스트만 있는 상품은 끝까지 안 차므로
		// 실패해도 그대로 진행해 스켈레톤이 아닌 현재 DOM 을 담는다.
		await page.waitForFunction(detailReady, null, { timeout: 15000 }).catch(() => {});

		// 정보고시(사용방법/제조국/제조업자 등)는 같은 페이지 컨텍스트에서 별도 API 로 온다.
		// 상세 DOM 추출보다 먼저(페이지가 살아 있을 때) 가져온다.
		const articleInfo = article ? await fetchArticle(page, target.goodsNo) : { article: null, articleError: null };

		const spec = await page.evaluate(extractDetailSpec);
		if (!spec) {
			return {
				detailHtml: null,
				detailImages: [],
				detailImageCount: 0,
				detailCollectedAt: new Date().toISOString(),
				detailError: '상세 설명 DOM 을 찾을 수 없음',
				article: articleInfo.article,
				articleError: articleInfo.articleError,
				articleCollectedAt: articleInfo.article ? new Date().toISOString() : null
			};
		}

		// 이미지 없이 HTML 만 가져오려면 치환 단계 아예 생략한다
		if (!images || !spec.urls.length) {
			return {
				detailHtml: spec.html,
				detailImages: [],
				detailImageCount: 0,
				detailCollectedAt: new Date().toISOString(),
				detailError: null,
				article: articleInfo.article,
				articleError: articleInfo.articleError,
				articleCollectedAt: articleInfo.article ? new Date().toISOString() : null
			};
		}

		const entries = spec.urls.map((url, i) => ({
			url,
			relNoExt: relImagePath(target.key, `${target.key}_d${i + 1}`)
		}));
		const map = await saveImages(entries);
		const html = await page.evaluate(rewriteDetailHtml, Object.fromEntries(map));

		return {
			detailHtml: html,
			detailImages: [...map].map(([url, rel]) => ({ url, path: rel })),
			detailImageCount: map.size,
			detailCollectedAt: new Date().toISOString(),
			detailError: null,
			article: articleInfo.article,
			articleError: articleInfo.articleError,
			articleCollectedAt: articleInfo.article ? new Date().toISOString() : null
		};
	} catch (err) {
		return { detailHtml: null, detailImages: [], detailImageCount: 0, detailCollectedAt: new Date().toISOString(), detailError: err.message };
	} finally {
		await page.close();
	}
}

const itemKey = (it) => it.goodsNo || it.itemNo || it.detailUrl;

/**
 * payload 의 모든 상품에 대해 상세페이지를 돌려 상세 필드를 merge 한다.
 * (payload 는 in-place 로 수정된다)
 * @param {object} payload oliveyoung_ranking_items.json 구조
 * @param {{headed?:boolean, delay?:number, images?:boolean, limit?:number,
 *          goodsNo?:string, force?:boolean, onProgress?:(e:object)=>void,
 *          signal?:AbortSignal, saveEvery?:number, onCheckpoint?:(e:object)=>void}} opts
 */
export async function collectDetails(payload, opts = {}) {
	// 기본 대기 5초: 목록(1.5초)보다 길어야 연속 접근에 막히지 않는다
	const {
		headed = false,
		delay = 5000,
		images = true,
		limit = 0,
		goodsNo = '',
		force = false,
		retries = 3,
		onProgress = () => {},
		signal = null,
		// N건마다 저장 콜백. 전체가 끝나기 전에 죽어도 여기까지의 결과가 남는다.
		saveEvery = 10,
		onCheckpoint = () => {},
		// true 면 상세 HTML/이미지는 건드리지 않고 정보고시 없는 상품만 찾아 고시만 받는다
		articleOnly = false
	} = opts;

	// 같은 상품이 여러 카테고리에 올라와도 상세/고시는 1번만 수집한다
	const targets = new Map();
	for (const c of payload.categories || []) {
		for (const it of c.items || []) {
			if (!it.detailUrl) continue;
			if (goodsNo && it.goodsNo !== goodsNo) continue;
			if (articleOnly) {
				// 고시 전용: 정보고시가 이미 있는 상품은 건너뛴다. 단 force(재수집)면 다시 받는다 —
				// 모달의 [고시 수집] 버튼이 특정 상품을 다시 수집할 수 있어야 하기 때문.
				if (it.article && !force) continue;
			} else if (!force && it.detailHtml) {
				// 일반 모드: 이미 상세가 있고 다시 받으라는 지시가 없으면 건너뛴다
				continue;
			}
			const key = itemKey(it);
			if (!targets.has(key)) targets.set(key, { key, goodsNo: it.goodsNo, name: it.name, detailUrl: it.detailUrl });
		}
	}

	const list = [...targets.values()];
	if (limit > 0) list.splice(limit);
	const result = { total: list.length, ok: 0, failed: 0, images: 0, aborted: false, startedAt: new Date().toISOString() };
	if (!list.length) return { ...result, finishedAt: new Date().toISOString() };
	// 시작 전에 이미 중단된 경우 브라우저를 띄우지 않고 바로 나간다
	if (signal?.aborted) return { ...result, aborted: true, finishedAt: new Date().toISOString() };

	let session = await createContext(headed);
	try {
		await warmUp(session.context);

		for (const [idx, target] of list.entries()) {
			if (signal?.aborted) {
				result.aborted = true;
				break;
			}
			const at = { index: idx + 1, total: list.length, goodsNo: target.goodsNo, name: target.name };
			let detail = null;

			// 상세페이지를 연잖아 Cloudflare 에 막히면(잠시만 기다리십시오) 세션째 새로 잡고
			// increasingly 긴 시간 비운 뒤 다시 시도한다. 같은 세션으로는 안 풀린다.
			for (let attempt = 0; attempt <= retries; attempt++) {
				if (signal?.aborted) break;
				detail = await fetchDetail(session.context, target, { images, articleOnly });
				// 고시 전용은 detailError 를 안 쓰므로 고시 실패로 재시도 판정
				const errText = detail.detailError || (articleOnly ? detail.articleError : null);
				if (!errText || !/Cloudflare/i.test(errText) || attempt === retries) break;

				onProgress({ ...at, status: 'retry', error: `${detail.detailError} — ${BACKOFF[attempt] / 1000}초 대기 후 재시도` });
				await session.browser.close();
				await sleep(BACKOFF[attempt], signal);
				if (signal?.aborted) break;
				session = await createContext(headed);
				await warmUp(session.context);
			}
			// 재시도 백오프 대기에 중단이 끼면 이 건은 실패로 세지 않고 나간다
			if (signal?.aborted) {
				result.aborted = true;
				break;
			}
			const finalErr = detail.detailError || (articleOnly ? detail.articleError : null);
			if (finalErr) {
				result.failed++;
				onProgress({ ...at, status: 'error', error: finalErr });
			} else {
				result.ok++;
				result.images += detail.detailImageCount || 0;
				onProgress({ ...at, status: 'ok', imageCount: detail.detailImageCount || 0 });
			}
			// 결과는 수집 즉시 모든 카테고리에 반영해 중간 저장해도 상태가 안 깨지도록 한다
			for (const c of payload.categories || []) {
				for (const it of c.items || []) {
					if (itemKey(it) === target.key) Object.assign(it, detail);
				}
			}
			// N건마다 저장 콜백을 부른다 (호출자가 파일로 flush)
			if (saveEvery > 0 && (idx + 1) % saveEvery === 0) {
				onCheckpoint({ index: idx + 1, total: list.length, ...result });
			}
			if (idx < list.length - 1) await sleep(delay, signal);
		}
	} finally {
		await session.browser.close().catch(() => {});
	}

	return { ...result, finishedAt: new Date().toISOString() };
}
