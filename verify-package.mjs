// 생성된 zip 패키지의 내용을 검증한다 (한글 파일명 디코딩 포함).
import fs from 'node:fs';

const zipPath = process.argv[2];
const buf = fs.readFileSync(zipPath);

// ZIP 중앙 디렉토리를 직접 읽는다. UTF-8 플래그(bit 11)가 안 켜진 이름은 UTF-8 로 해석.
const names = [];
let i = 0;
const SIG = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
while ((i = buf.indexOf(SIG, i)) !== -1) {
	const nameLen = buf.readUInt16LE(i + 28);
	const extraLen = buf.readUInt16LE(i + 30);
	const commentLen = buf.readUInt16LE(i + 32);
	const flags = buf.readUInt16LE(i + 8);
	const raw = buf.slice(i + 46, i + 46 + nameLen);
	if (!(flags & 1)) names.push(raw.toString('utf8'));
	i += 46 + nameLen + extraLen + commentLen;
}

const required = [
	'시작하기.bat',
	'사용법.txt',
	'goods_summary\\README.md',
	'goods_summary\\scraper\\server.mjs',
	'goods_summary\\scraper\\collect-ranking-list.mjs',
	'goods_summary\\scraper\\collect-goods-detail.mjs',
	'goods_summary\\scraper\\package.json',
	'goods_summary\\scraper\\public\\index.html',
	'goods_summary\\scraper\\public\\app.js',
	'goods_summary\\scraper\\public\\style.css',
	'goods_summary\\scraper\\lib\\collector.mjs',
	'goods_summary\\scraper\\lib\\detail.mjs',
	'goods_summary\\scraper\\lib\\images.mjs',
	'goods_summary\\scraper\\lib\\browser.mjs',
	'goods_summary\\scraper\\lib\\data.mjs',
	'goods_summary\\scraper\\lib\\xlsx.mjs',
	'goods_summary\\scraper\\lib\\paths.mjs',
	'goods_summary\\scraper\\node_modules\\playwright\\package.json',
	'goods_summary\\scraper\\node_modules\\playwright-core\\package.json',
	'goods_summary\\oliveyoung_ranking_doms\\oliveyoung_ranking.json',
	'goods_summary\\oliveyoung_ranking_doms\\oliveyoung_ranking_items.json'
];

console.log('zip :', zipPath);
console.log('크기:', (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2), 'MB');
console.log('파일:', names.length, '개\n');

let ok = true;
for (const n of required) {
	const has = names.includes(n);
	if (!has) ok = false;
	console.log(has ? '  OK  ' : '  MISS', n);
}

const korean = names.filter((n) => /[가-힣]/.test(n));
const broken = names.some((n) => n.includes('\uFFFD'));

console.log('\n한글 파일명:', JSON.stringify(korean));
console.log('한글 깨짐:', broken ? '있음 (문제)' : '없음 (정상)');
console.log(ok ? '\n필수 파일 모두 존재 — 패키지 정상' : '\n필수 파일 누락 — 실패');
process.exit(ok && !broken ? 0 : 1);
