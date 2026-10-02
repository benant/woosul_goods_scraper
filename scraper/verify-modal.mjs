// temp: modal close button hit test
import { createContext } from './lib/browser.mjs';

const PORT = process.env.PORT || 3117;
const { browser, context } = await createContext(false);
const page = await context.newPage();

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.fill('#fQ', 'A000000263019');
await page.waitForTimeout(800);
await page.click('#tbl tbody tr td.name a.namelink');
await page.waitForSelector('#detailModal[open]', { timeout: 10000 });
await page.waitForFunction(() => document.querySelector('#dmBody img'), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);

const box = await page.evaluate(() => {
	const r = (sel) => {
		const el = document.querySelector(sel);
		if (!el) return null;
		const b = el.getBoundingClientRect();
		return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
	};
	return { head: r('.modal-head'), close: r('#dmClose'), body: r('#dmBody'), dlg: r('#detailModal') };
});
console.log(JSON.stringify(box, null, 1));

// 실제로 닫기 버튼이 클릭되는지 (좌표 클릭)
const cx = (b) => [b.close.left + b.close.right, b.close.top + b.close.bottom].map((v) => v / 2);
const [x, y] = cx(box);
const hit = await page.evaluate(([x, y]) => {
	const el = document.elementFromPoint(x, y);
	return el ? el.id || el.className || el.tagName : 'none';
}, [x, y]);
console.log('point hit element:', hit);

const scroll = await page.evaluate(() => {
	const b = document.getElementById('dmBody');
	return { client: b.clientHeight, scroll: b.scrollHeight, scrollable: b.scrollHeight > b.clientHeight };
});
console.log('body scroll:', JSON.stringify(scroll));
await page.evaluate(() => {
	const b = document.getElementById('dmBody');
	b.scrollTop = b.scrollHeight;
});
await page.waitForTimeout(200);
const last = await page.evaluate(() => {
	const imgs = document.querySelectorAll('#dmBody img');
	const last = imgs[imgs.length - 1];
	const b = document.getElementById('dmBody').getBoundingClientRect();
	const l = last.getBoundingClientRect();
	return { lastImgBottom: Math.round(l.bottom), bodyBottom: Math.round(b.bottom), reachable: l.bottom <= b.bottom + 2 };
});
console.log('last image reachable:', JSON.stringify(last));

// 좌표가 낡지 않게 클릭 직전에 다시 잰다
const fresh = await page.evaluate(() => {
	const b = document.getElementById('dmClose').getBoundingClientRect();
	const cx = b.left + b.width / 2;
	const cy = b.top + b.height / 2;
	const el = document.elementFromPoint(cx, cy);
	return { x: cx, y: cy, hit: el ? el.id || el.className || el.tagName : 'none' };
});
console.log('fresh hit:', JSON.stringify(fresh));
const who = await page.evaluate(([x, y]) => {
	const el = document.elementFromPoint(x, y);
	if (!el) return null;
	const b = el.getBoundingClientRect();
	const chain = [];
	for (let n = el; n && n !== document.body; n = n.parentElement) chain.push(n.id || n.className || n.tagName);
	return {
		rect: { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) },
		chain: chain.slice(0, 6),
		inDialog: !!el.closest('#detailModal'),
		pos: getComputedStyle(el).position,
		z: getComputedStyle(el).zIndex
	};
}, [fresh.x, fresh.y]);
console.log('who:', JSON.stringify(who));
await page.mouse.click(fresh.x, fresh.y);
await page.waitForTimeout(300);
console.log('modal closed by coordinate click:', !(await page.isVisible('#detailModal')));

if (await page.isVisible('#detailModal')) {
	await page.click('#dmClose', { timeout: 5000 }).catch((e) => console.log('button click failed:', e.message.split('\n')[0]));
	await page.waitForTimeout(300);
	console.log('modal closed by button click:', !(await page.isVisible('#detailModal')));
}

// ESC 로 닫히는지
await page.evaluate(() => document.getElementById('detailModal').showModal());
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('modal closed by ESC:', !(await page.isVisible('#detailModal')));

await browser.close();
