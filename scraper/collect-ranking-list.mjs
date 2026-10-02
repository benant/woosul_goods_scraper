// 올리브영 카테고리별 판매랭킹 "목록 페이지" 수집기 (CLI)
//
// - 입력: ../oliveyoung_ranking_doms/oliveyoung_ranking.json (카테고리 목록 URL)
// - 출력: ../oliveyoung_ranking_doms/oliveyoung_ranking_items.json
// - 상품 DOM: ul.cate_prd_list > li
// - 대표이미지: ../oliveyoung_ranking_doms/images/<goodsNo>/<goodsNo>_main.<ext>
// - --detail 이면 이어서 상세페이지(상품 상세 설명 DOM)도 수집한다 (lib/detail.mjs)
//
// 실제 수집 로직은 lib/collector.mjs 에 있고 (대시보드 서버도 같은 것을 쓴다),
// 이 파일은 커맨드라인 인터페이스만 담당한다.
//
// 사용법:
//   npm run collect                 # 헤드리스 수집
//   npm run collect -- --headed     # 브라우저를 띄워서 수집 (차단될 때)
//   npm run collect -- --limit 3    # 앞 3개 카테고리만
//   npm run collect -- --top 8      # 카테고리별 상위 N개만 (기본: 응답 전체, 최대 100개)
//   npm run collect -- --delay 2000 # 요청 간 대기(ms)
//   npm run collect -- --no-images  # 대표이미지를 로컬에 받지 않음
//   npm run collect -- --detail     # 목록 뒤에 상세페이지까지 이어서 수집 (매우 오래 걸림)

import { collectAll, saveItems } from './lib/collector.mjs';
import { ITEMS_JSON } from './lib/paths.mjs';

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const getOpt = (name, fallback) => {
	const i = argv.indexOf(name);
	return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const opts = {
	headed: hasFlag('--headed'),
	images: !hasFlag('--no-images'),
	detail: hasFlag('--detail'),
	limit: Number(getOpt('--limit', 0)) || 0,
	top: Number(getOpt('--top', 0)) || 0,
	delay: Number(getOpt('--delay', 1500))
};

console.log(`카테고리 수집 시작 (${opts.headed ? 'headed' : 'headless'})`);

const payload = await collectAll({
	...opts,
	onProgress: (e) => {
		const tag = e.phase === 'detail' ? '상세' : '목록';
		if (e.status === 'retry') {
			process.stdout.write(`[${tag} 재시도] ${e.goodsNo || e.name} — ${e.error}\n`);
			return;
		}
		const tail = e.status === 'ok' ? `${e.count ?? e.imageCount ?? 0}개` : `실패 - ${e.error}`;
		process.stdout.write(`[${tag} ${e.index}/${e.total}] ${e.name || e.goodsNo} ... ${tail}\n`);
	}
});

saveItems(payload);

const total = payload.categories.reduce((sum, c) => sum + c.itemCount, 0);
const failed = payload.categories.filter((c) => c.error).length;
console.log(`\n완료: 카테고리 ${payload.categories.length}개 / 상품 ${total}개 (실패 ${failed}개)`);
console.log('저장:', ITEMS_JSON);
