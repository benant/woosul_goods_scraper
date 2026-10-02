// 상품 이미지를 로컬(oliveyoung_ranking_doms/images/<goodsNo>/)에 내려받아 저장한다.
//
// JSON 에는 이미지 원본 URL 과 함께 로컬 상대경로(images/...)를 함께 남기므로,
// 원본이 사라져도 데이터가 살아 있고 오프라인으로 열 수 있다.
// 이미 있는 파일은 다시 받지 않는다(재실행해도 idempotent).

import fs from 'fs';
import path from 'path';
import { DATA_DIR, IMAGE_REL } from './paths.mjs';

const EXT_BY_MIME = {
	'image/jpeg': '.jpg',
	'image/jpg': '.jpg',
	'image/pjpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/avif': '.avif',
	'image/gif': '.gif',
	'image/bmp': '.bmp',
	'image/svg+xml': '.svg',
	'image/x-icon': '.ico',
	'image/vnd.microsoft.icon': '.ico'
};

// 같은 목적지로 캐시돼 있을 수 있는 확장자들(요청 전에 존재 확인용)
const ALL_EXTS = [...new Set(Object.values(EXT_BY_MIME))];

const toPosix = (p) => p.split(path.sep).join('/');

/** 로컬 상대경로 만들기. images/<goodsNo>/<파일명> */
export function relImagePath(...segments) {
	return toPosix(path.join(IMAGE_REL, ...segments.map((s) => String(s))));
}

const extFromUrl = (url) => {
	try {
		const ext = path.extname(new URL(url).pathname).toLowerCase();
		return ALL_EXTS.includes(ext) ? ext : null;
	} catch {
		return null;
	}
};

const absPath = (rel) => path.join(DATA_DIR, ...rel.split('/'));

// 이미지 CDN(image.oliveyoung.co.kr)은 공개 경로라 쿠키가 필요 없다.
// 브라우저 컨텍스트의 request 를 재사용하면 그 컨텍스트의 쿠키/세션을 물려받아
// 연속 다운로드가 Cloudflare 에 걸려 다음 페이지 수집이 막히므로, 평범한 fetch 로 받는다.
const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * 이미지 하나를 내려받아 저장하고 로컬 상대경로를 돌려준다.
 * @param {string|null} url 원본 이미지 URL
 * @param {string} relNoExt 확장자를 뺀 상대경로 (예: images/A000000263019/A000000263019_d1)
 * @returns {Promise<string|null>} 저장된 상대경로. 실패하면 null
 */
export async function saveImage(url, relNoExt) {
	if (!url || !/^https?:\/\//i.test(url)) return null;

	// 이미 받아둔 파일이 있으면 네트워크를 건드리지 않는다
	for (const ext of ALL_EXTS) {
		const candidate = relNoExt + ext;
		if (fs.existsSync(absPath(candidate))) return candidate;
	}

	const res = await fetch(url, {
		redirect: 'follow',
		signal: AbortSignal.timeout(30000),
		headers: { referer: 'https://www.oliveyoung.co.kr/', 'user-agent': UA, accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }
	}).catch(() => null);
	if (!res || !res.ok) return null;

	const body = Buffer.from(await res.arrayBuffer().catch(() => null) || []);
	if (!body.length) return null;

	const mime = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
	const ext = EXT_BY_MIME[mime] || extFromUrl(url) || '.jpg';
	const rel = relNoExt + ext;

	const file = absPath(rel);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, body);
	return rel;
}

/**
 * 여러 이미지를 제한된 동시성으로 내려받는다.
 * @param {{url:string, relNoExt:string}[]} entries
 * @param {{concurrency?:number}} opts
 * @returns {Promise<Map<string,string>>} 원본 URL -> 로컬 상대경로
 */
export async function saveImages(entries, { concurrency = 6 } = {}) {
	const map = new Map();
	// 같은 URL 은 한 번만 받는다
	const todo = [];
	const seen = new Set();
	for (const e of entries) {
		if (!e || !e.url || seen.has(e.url)) continue;
		seen.add(e.url);
		todo.push(e);
	}

	let cursor = 0;
	const worker = async () => {
		while (cursor < todo.length) {
			const entry = todo[cursor++];
			const rel = await saveImage(entry.url, entry.relNoExt);
			if (rel) map.set(entry.url, rel);
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrency, todo.length || 1) }, worker));
	return map;
}
