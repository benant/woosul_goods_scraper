// 올리브영 상품 **상세페이지** 수집 (CLI)
//
// - 입력: ../oliveyoung_ranking_doms/oliveyoung_ranking_items.json (목록 수집 결과)
// - 출력: 같은 파일 (items[] 에 detailHtml / detailImages / detailCollectedAt merge)
//
// 목록 수집(collect-ranking-list.mjs)과 분리돼 있어서, 필요한 것만 골라서 돌아간다.
// 이미 수집된 상품은 자동으로 건너뛰고(--force 로 강제 재수집).
//
// 사용법:
//   npm run collect:detail                     # 아직 안 받은 상품 전부
//   npm run collect:detail -- --limit 20       # 20개만
//   npm run collect:detail -- --goodsNo A000000263019
//   npm run collect:detail -- --headed         # 브라우저를 띄워서 (차단될 때)
//   npm run collect:detail -- --delay 8000     # 요청 간 대기 ms (기본 5000, 막히면 늘릴 것)
//   npm run collect:detail -- --no-images      # HTML 만 받고 이미지는 받지 않음
//   npm run collect:detail -- --force          # 이미 있는 것도 다시 받기

import fs from 'fs';
import { collectDetails } from './lib/detail.mjs';
import { saveItems } from './lib/collector.mjs';
import { ITEMS_JSON } from './lib/paths.mjs';

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const getOpt = (name, fallback) => {
	const i = argv.indexOf(name);
	return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const opts = {
	headed: hasFlag('--headed'),
	images: !hasFlag('--no-images'),
	force: hasFlag('--force'),
	// --article-only: 상세 HTML/이미지는 건드리지 않고 고시 없는 상품만 정보고시만 수집
	articleOnly: hasFlag('--article-only'),
	limit: Number(getOpt('--limit', 0)) || 0,
	goodsNo: getOpt('--goodsNo', ''),
	delay: Number(getOpt('--delay', 5000))
};

if (!fs.existsSync(ITEMS_JSON)) {
	console.error(`목록 수집 결과가 없습니다: ${ITEMS_JSON}\n먼저 'npm run collect' 를 실행하세요.`);
	process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));
const allItems = (payload.categories || []).reduce((sum, c) => sum + (c.items || []).length, 0);
const done = (payload.categories || []).reduce(
	(sum, c) => sum + (c.items || []).filter((it) => it.detailHtml).length,
	0
);

console.log(
	`상세 수집 시작 (${opts.headed ? 'headed' : 'headless'}, 이미지 ${opts.images ? '저장' : '제외'}${
		opts.articleOnly ? ', 고시 전용' : ''
	})`
);
console.log(`목록 상품 ${allItems}건 중 상세 ${done}건 이미 수집됨 → 수집 대상 ${opts.goodsNo || opts.limit || '전체'}`);

const startedAt = Date.now();
// Ctrl+C 로 중간에 끊어도 여기까지의 결과가 남도록 진행분을 저장한다.
// abort 가 걸리면 루프가 안전하게 빠져나와 아래 saveItems 까지 실행된다.
const ac = new AbortController();
let interrupted = false;
process.on('SIGINT', () => {
	if (interrupted) {
		console.log('\n강제 종료합니다. (미저장 진행분은 유실)');
		process.exit(130);
	}
	interrupted = true;
	console.log('\n중지 요청 받음 — 지금까지의 결과를 저장하고 종료합니다... (다시 누르면 강제 종료)');
	ac.abort();
});

const result = await collectDetails(payload, {
	...opts,
	signal: ac.signal,
	// 10건마다 파일로 저장 — 강제 종료돼도 직전 저장분까지는 남는다
	onCheckpoint: () => saveItems(payload),
	onProgress: (e) => {
		const sec = ((Date.now() - startedAt) / 1000).toFixed(0);
		if (e.status === 'retry') {
			process.stdout.write(`[재시도] ${sec.padStart(5)}s  ${e.goodsNo} — ${e.error}\n`);
			return;
		}
		const tail = e.status === 'ok' ? (opts.articleOnly ? '고시 저장' : `이미지 ${e.imageCount}개`) : `실패 - ${e.error}`;
		process.stdout.write(`[${String(e.index).padStart(4)}/${e.total}] ${sec.padStart(5)}s  ${e.goodsNo || e.name} ... ${tail}\n`);
	}
});

saveItems(payload);
console.log(
	`\n${result.aborted ? '중단됨' : '완료'}: 성공 ${result.ok}개 / 실패 ${result.failed}개, 상세 이미지 ${result.images}개`
);
console.log('저장:', ITEMS_JSON);
