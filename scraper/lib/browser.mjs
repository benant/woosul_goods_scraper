// 목록/상세 수집이 공통으로 쓰는 브라우저 컨텍스트.
//
// Cloudflare가 일반 HTTP 요청을 403 차단하므로, PC에 설치된 Chrome을
// Playwright로 구동해 렌더링된 DOM을 읽는다.
// (playwright install 로 받은 브라우저가 아니라 시스템 Chrome 을 쓴다)

import { chromium } from 'playwright';
import { START_PAGE } from './paths.mjs';

export async function createContext(headed = false) {
	const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
	const context = await browser.newContext({
		locale: 'ko-KR',
		viewport: { width: 1440, height: 2000 },
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
	});
	return { browser, context };
}

/** Cloudflare 통과용 예열 방문 */
export async function warmUp(context) {
	const page = await context.newPage();
	try {
		await page.goto(START_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
	} finally {
		await page.close();
	}
}

/** "잠시만 기다려 주세요" 같은 차단 페이지가 떴는지 확인 */
export function assertNotBlocked(title) {
	if (/잠시만|Just a moment|Access denied/i.test(title)) {
		throw new Error(`Cloudflare 차단 페이지가 감지됨 (title: ${title})`);
	}
	return title;
}

/**
 * Cloudflare 는 JS 챌린지(잠시만 기다려 주세요) 페이지를 띄우고 브라우저가 스스로 푼다.
 * 사람이 기다리듯 챌린지가 풀릴 때까지 기다린 뒤 검사를 한 번 더 한다.
 * 그래도 안 풀렸으면 assertNotBlocked 가 에러로 남긴다.
 */
export async function passChallenge(page, timeout = 30000) {
	if (!/잠시만|Just a moment|Access denied/i.test(await page.title())) return;
	await page
		.waitForFunction(() => !/잠시만|Just a moment|Access denied/i.test(document.title), null, { timeout })
		.catch(() => {});
	await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
}
