// 찜 엑셀. 대시보드의 찜 Excel 과 export:partner 가 같은 열을 쓴다.
// partner-site 는 이 파일을 읽어 목록/상세 데이터로 쓴다.
import { COLUMNS, articleToFields } from './data.mjs';
import { buildXlsx } from './xlsx.mjs';

export const PARTNER_COLUMNS = [
	...COLUMNS,
	{ key: 'detailImageUrls', header: '상세이미지', width: 80, type: 'string' },
	{ key: 'articleText', header: '정보고시', width: 80, type: 'string' }
];

function articleText(article) {
	if (!article || typeof article !== 'object') return '';
	return Object.entries(article)
		.map(([title, content]) => `${title}\n${String(content ?? '').trim()}`)
		.join('\n\n');
}

function detailImageUrls(row) {
	if (typeof row.detailImageUrls === 'string' && row.detailImageUrls.trim()) return row.detailImageUrls.trim();
	const seen = new Set();
	const urls = [];
	const list = Array.isArray(row.detailImages) ? row.detailImages : row.gallery || [];
	for (const img of list) {
		const url = typeof img === 'string' ? img : img && img.url;
		if (typeof url !== 'string' || !url.startsWith('https://') || seen.has(url)) continue;
		seen.add(url);
		urls.push(url);
	}
	return urls.join('\n');
}

/** 수집 행 또는 카탈로그 상품을 엑셀 한 줄로 만든다. detailHtml 은 열에 넣지 않는다. */
export function partnerExportRow(row) {
	return {
		...row,
		...articleToFields(row.article),
		flagsText: row.flagsText || (Array.isArray(row.flags) ? row.flags.join(', ') : ''),
		detailImageUrls: detailImageUrls(row),
		articleText: row.articleText || articleText(row.article)
	};
}

/** 상품 1개에 순위가 여러 개면 순위마다 한 줄. 이미지는 같은 주소를 반복한다. */
export function rowsFromCatalog(products) {
	const rows = [];
	for (const product of products || []) {
		const ranks = product.ranks && product.ranks.length ? product.ranks : [{ categoryName: '', rank: null, rankingType: null }];
		for (const rank of ranks) {
			rows.push(
				partnerExportRow({
					...product,
					categoryName: rank.categoryName || '',
					rank: rank.rank,
					rankingType: rank.rankingType || null,
					gallery: product.gallery || []
				})
			);
		}
	}
	return rows;
}

export function buildPartnerWorkbook(rows) {
	return buildXlsx([
		{
			name: '찜상품',
			columns: PARTNER_COLUMNS,
			rows: rows.map(partnerExportRow)
		}
	]);
}
