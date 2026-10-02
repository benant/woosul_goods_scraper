// temp: product name link / external icon check
import { createContext } from './lib/browser.mjs';

const PORT = process.env.PORT || 3117;
const { browser, context } = await createContext(false);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#tbl tbody tr', { timeout: 15000 });

const cellInfo = () =>
	page.evaluate(() => {
		const td = document.querySelector('#tbl tbody tr td.name');
		const a = td.querySelector('a.namelink');
		const ext = td.querySelector('a.extlink');
		return {
			text: td.textContent.trim().slice(0, 30),
			nameLink: a ? a.getAttribute('href') : null,
			nameGoods: a ? a.dataset.goods : null,
			extHref: ext ? ext.getAttribute('href') : null,
			extTarget: ext ? ext.getAttribute('target') : null,
			extHasIcon: ext ? !!ext.querySelector('svg') : false
		};
	});

console.log('row1:', JSON.stringify(await cellInfo()));

// 상세 수집된 상품 찾아 내부 링크로 모달이 열리는지
await page.fill('#fQ', 'A000000263019');
await page.waitForTimeout(800);
console.log('row2:', JSON.stringify(await cellInfo()));

const opened = await page.evaluate(() => {
	const a = document.querySelector('#tbl tbody tr td.name a.namelink');
	if (!a) return 'no-link';
	a.click();
	return 'clicked';
});
await page.waitForSelector('#detailModal[open]', { timeout: 10000 });
await page.waitForFunction(() => document.querySelector('#dmBody img'), null, { timeout: 15000 }).catch(() => {});
console.log('click:', opened, '| modal open:', await page.isVisible('#detailModal'));
console.log('title:', (await page.textContent('#dmTitle')).trim().slice(0, 40));
const scrollY = await page.evaluate(() => window.scrollY);
console.log('scrollY after click (0 = 페이지 안 튀김):', scrollY);
await page.click('#dmClose');

// 원본 아이콘은 새 탭(target=_blank) + 원본 도메인
const ext = await page.evaluate(() => {
	const a = document.querySelector('#tbl tbody tr td.name a.extlink');
	return { href: a.href, target: a.target, rel: a.rel };
});
console.log('ext:', JSON.stringify(ext));

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
