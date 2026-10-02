// 수집 결과(oliveyoung_ranking_items.json)를 읽어 필터/정렬/내보내기용으로 가공한다.

import fs from 'fs';
import { ITEMS_JSON } from './paths.mjs';
import { buildXlsx } from './xlsx.mjs';

// 엑셀/CSV 헤더 + 정렬 키. type: string | int | decimal | url (url 은 엑셀에서 클릭 가능한 링크. CSV 는 문자열 그대로)
export const COLUMNS = [
	{ key: 'categoryName', header: '카테고리', width: 14, type: 'string' },
	{ key: 'rank', header: '순위', width: 7, type: 'int' },
	{ key: 'rankingType', header: '랭킹유형', width: 11, type: 'string' },
	{ key: 'goodsNo', header: '상품코드', width: 15, type: 'string' },
	{ key: 'name', header: '상품명', width: 62, type: 'string' },
	{ key: 'brand', header: '브랜드', width: 18, type: 'string' },
	{ key: 'categoryPath', header: '상품카테고리', width: 26, type: 'string' },
	{ key: 'normalPrice', header: '정가', width: 11, type: 'int' },
	{ key: 'salePrice', header: '판매가', width: 11, type: 'int' },
	{ key: 'effectivePrice', header: '실제가격', width: 11, type: 'int' },
	{ key: 'discountRate', header: '할인율(%)', width: 11, type: 'int' },
	{ key: 'flagsText', header: '배지', width: 26, type: 'string' },
	{ key: 'howToUse', header: '사용방법', width: 60, type: 'string' },
	{ key: 'manufactureCountry', header: '제조국', width: 14, type: 'string' },
	{ key: 'manufacturer', header: '제조업자', width: 40, type: 'string' },
	{ key: 'capacity', header: '용량', width: 18, type: 'string' },
	{ key: 'expirationInfo', header: '사용기한', width: 30, type: 'string' },
	{ key: 'ingredients', header: '전성분', width: 60, type: 'string' },
	{ key: 'caution', header: '사용시 주의사항', width: 60, type: 'string' },
	{ key: 'imageUrl', header: '이미지', width: 46, type: 'url' },
	{ key: 'imagePath', header: '로컬이미지', width: 40, type: 'string' },
	{ key: 'detailUrl', header: '상세URL', width: 60, type: 'url' }
];

export function loadPayload() {
	if (!fs.existsSync(ITEMS_JSON)) return { generatedAt: null, categories: [] };
	return JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));
}

/** 카테고리 구조를 평탄화한 상품 행 배열로 변환 */
export function flatten(payload) {
	const rows = [];
	for (const c of payload.categories || []) {
		for (const it of c.items || []) {
			rows.push({
				categoryName: c.name,
				categoryFltDispCatNo: c.fltDispCatNo,
				collectedAt: c.collectedAt,
				...it,
				...articleToFields(it.article),
				flagsText: (it.flags || []).join(', '),
				hasDetail: !!it.detailHtml,
				hasArticle: !!it.article
			});
		}
	}
	return rows;
}

/**
 * 상품코드로 상품 정보 전체(기본 정보 + 고시 + 상세 DOM)를 찾는다.
 * 같은 상품이 여러 카테고리에 있으면 정보가 가장 풍부한 것(상세→고시 순)을 고른다.
 * 상세/고시가 둘 다 없어도 기본 정보는 돌려준다 — 모달이 상품 정보는 언제나 보여주게.
 */
export function findDetail(payload, goodsNo) {
	let best = null;
	const score = (it) => (it.detailHtml ? 2 : 0) + (it.article ? 1 : 0);
	for (const c of payload.categories || []) {
		for (const it of c.items || []) {
			if (it.goodsNo !== goodsNo) continue;
			if (!best || score(it) > score(best.it)) best = { it, c };
		}
	}
	if (!best) return null;
	const it = best.it;
	return {
		// 고시 표의 내용을 목록과 같은 기준으로 정형 필드(용량/제조국/제조업자/사용기한)로
		// 풀어 함께 돌려준다 — 모달 상단 요약의 spec 영역이 이 값을 쓴다.
		...articleToFields(it.article),
		goodsNo: it.goodsNo,
		name: it.name,
		brand: it.brand,
		categoryName: best.c.name,
		rank: it.rank ?? null,
		rankingType: it.rankingType ?? null,
		categoryPath: it.categoryPath ?? null,
		normalPrice: it.normalPrice ?? null,
		salePrice: it.salePrice ?? null,
		effectivePrice: it.effectivePrice ?? null,
		discountRate: it.discountRate ?? null,
		flags: it.flags || [],
		imageUrl: it.imageUrl ?? null,
		imagePath: it.imagePath ?? null,
		detailUrl: it.detailUrl ?? null,
		detailHtml: it.detailHtml ?? null,
		detailImages: it.detailImages || [],
		detailImageCount: it.detailImageCount || 0,
		detailCollectedAt: it.detailCollectedAt || null,
		article: it.article ?? null,
		articleError: it.articleError ?? null,
		articleCollectedAt: it.articleCollectedAt ?? null
	};
}

/** 목록 응답에서 용량이 큰 detailHtml 을 뺀다 (화면은 필요할 때 /api/detail 로 따로 받는다) */
export function stripDetail(row) {
	const { detailHtml, ...rest } = row;
	return rest;
}

// 정보고시(article) 의 표준 제목 → 저장 필드 매핑.
// 올리브영이 제목을 바꿀 수 있어 앞부분 일치로 찾는다.
const ARTICLE_KEYS = [
	['howToUse', '사용방법'],
	['manufactureCountry', '제조국'],
	['manufacturer', '제조업자'],
	['capacity', '용량'],
	['capacity', '내용물의 용량'],
	['expirationInfo', '사용기한'],
	['ingredients', '모든 성분'],
	['caution', '주의사항']
];

/** 정보고시 {제목:내용} 을 정형 필드로 옮긴다 */
export function articleToFields(article) {
	if (!article || typeof article !== 'object') return {};
	const out = {};
	for (const [field, needle] of ARTICLE_KEYS) {
		if (out[field]) continue;
		for (const [title, content] of Object.entries(article)) {
			if (title.includes(needle)) {
				out[field] = String(content ?? '').trim();
				break;
			}
		}
	}
	return out;
}

const num = (v) => {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
};

/**
 * 화면/내보내기 공통 필터·정렬.
 * @param {object[]} rows
 * @param {object} q {q, category, brand, flag, maxPrice, minPrice, sort, order}
 *        brand 는 문자열 하나나 배열(다중 선택) 모두 받는다.
 */
export function applyQuery(rows, q = {}) {
	const kw = (q.q || '').trim().toLowerCase();
	const flag = (q.flag || '').trim();
	// 브랜드는 여러 개를 고를 수 있다. 문자열 하나만 넘어와도 배열로 맞춰 쓴다.
	const brands = (Array.isArray(q.brand) ? q.brand : [q.brand])
		.map((b) => String(b ?? '').trim())
		.filter(Boolean);
	const maxPrice = num(q.maxPrice);
	const minPrice = num(q.minPrice);

	let out = rows.filter((r) => {
		if (kw) {
			// 성분/사용방법 같은 긴 텍스트도 검색 대상에 넣는다
			const hay = `${r.name || ''} ${r.brand || ''} ${r.goodsNo || ''} ${r.categoryPath || ''} ${r.howToUse || ''} ${r.ingredients || ''} ${r.manufacturer || ''}`.toLowerCase();
			if (!hay.includes(kw)) return false;
		}
		if (q.category && r.categoryName !== q.category) return false;
		// 브랜드는 체크한 것 중 하나에만 걸리면 된다 (선택이 없으면 전체)
		if (brands.length && !brands.includes(r.brand)) return false;
		if (flag && !(r.flags || []).includes(flag)) return false;
		if (maxPrice !== null && !(r.effectivePrice !== null && r.effectivePrice <= maxPrice)) return false;
		if (minPrice !== null && !(r.effectivePrice !== null && r.effectivePrice >= minPrice)) return false;
		return true;
	});

	const sort = COLUMNS.some((c) => c.key === q.sort) ? q.sort : 'effectivePrice';
	const order = q.order === 'asc' ? 1 : -1;
	out = out.slice().sort((a, b) => {
		const av = a[sort];
		const bv = b[sort];
		// null은 항상 뒤로
		if (av === null || av === undefined) return 1;
		if (bv === null || bv === undefined) return -1;
		if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * order;
		return String(av).localeCompare(String(bv), 'ko') * order;
	});

	return out;
}

export function summarize(payload, rows) {
	const cats = (payload.categories || []).map((c) => ({
		name: c.name,
		fltDispCatNo: c.fltDispCatNo,
		itemCount: c.itemCount,
		collectedAt: c.collectedAt,
		error: c.error || null
	}));
	const flagSet = new Set();
	const brandSet = new Set();
	let minPrice = null;
	let maxPrice = null;
	for (const r of rows) {
		for (const f of r.flags || []) flagSet.add(f);
		if (r.brand) brandSet.add(r.brand);
		if (typeof r.effectivePrice === 'number') {
			minPrice = minPrice === null ? r.effectivePrice : Math.min(minPrice, r.effectivePrice);
			maxPrice = maxPrice === null ? r.effectivePrice : Math.max(maxPrice, r.effectivePrice);
		}
	}
	return {
		generatedAt: payload.generatedAt || null,
		totalItems: rows.length,
		categories: cats,
		flags: [...flagSet].sort((a, b) => a.localeCompare(b, 'ko')),
		brands: [...brandSet].sort((a, b) => a.localeCompare(b, 'ko')),
		priceRange: { min: minPrice, max: maxPrice }
	};
}

// ------------------------------------------------------------------ CSV

const csvCell = (v) => {
	if (v === null || v === undefined) return '';
	const s = String(v);
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildCsv(rows, columns = COLUMNS) {
	const head = columns.map((c) => csvCell(c.header)).join(',');
	const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','));
	// 엑셀에서 UTF-8 CSV가 깨지지 않도록 BOM 추가
	return '﻿' + [head, ...body].join('\r\n');
}

// ------------------------------------------------------------------ XLSX

/** 시트 1장(전체랭킹)에 검색결과 전체를 담는다 (카테고리별 시트 분리는 하지 않는다) */
export function buildWorkbook(rows, summary) {
	return buildXlsx([
		{
			name: '전체랭킹',
			columns: COLUMNS,
			rows
		}
	]);
}
