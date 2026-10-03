// 올리브영 랭킹 수집 대시보드 (로컬 전용)
//
//   npm run dashboard        -> http://localhost:3000
//
// 브라우저를 닫아도 Node 프로세스가 계속 수집하므로, 장시간 작업의 수명이
// 브라우저 탭에 묶이지 않는다. 상태는 JSON 파일에 체크포인트로 남는다.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAll, saveItems } from './lib/collector.mjs';
import { collectDetails } from './lib/detail.mjs';
import { JOB_JSON, DATA_DIR, FAV_JSON } from './lib/paths.mjs';
import { loadPayload, flatten, applyQuery, summarize, buildCsv, buildWorkbook, findDetail, stripDetail, COLUMNS } from './lib/data.mjs';
import { buildPartnerWorkbook } from './lib/partner-sheet.mjs';
import { PUBLIC_DIR, IMAGE_DIR } from './lib/paths.mjs';

const PORT = Number(process.env.PORT) || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------ job state

// ------------------------------------------------------------------ job state

// 기본 job 모양. 저장된 체크포인트를 합칠 때 빠진 키를 채우는 용도로도 쓴다.
const freshJob = () => ({
	status: 'idle',
	index: 0,
	total: 0,
	current: null,
	startedAt: null,
	finishedAt: null,
	error: null,
	result: null,
	log: []
});

// job 을 파일에 남긴다. 서버가 죽어도 마지막 상태를 알 수 있게 하기 위함.
function persistJob() {
	try {
		fs.writeFileSync(JOB_JSON, JSON.stringify(job, null, '\t'), 'utf8');
	} catch {
		/* 디스크에 못 써도 수집은 계속한다 */
	}
}

// 지난 실행이 running 상태로 끝났다면(프로세스 강제 종료) 중단됨으로 정정한다.
// 그대로 두면 "수집 중"인데 실제로는 아무 일도 일어나지 않는 상태가 된다.
function loadPersistedJob() {
	try {
		const saved = JSON.parse(fs.readFileSync(JOB_JSON, 'utf8'));
		if (saved.status === 'running') {
			saved.status = 'aborted';
			saved.finishedAt = new Date().toISOString();
			saved.error = '서버가 재시작되어 중단되었습니다. 저장된 분까지는 유지됩니다.';
			saved.log = [...(saved.log || []).slice(-40), '[재시작] 실행 중이던 작업을 중단됨으로 표시'];
		}
		return { ...freshJob(), ...saved };
	} catch {
		return freshJob();
	}
}

let job = loadPersistedJob();

// ------------------------------------------------------------------ 찜(담아두기)

// 찜 목록: goodsNo 배열을 파일로 유지한다. 카트에 담아두듯 상품을 골라두고
// 그것만 보거나 내보내기 위한 용도.
function loadFavs() {
	try {
		const v = JSON.parse(fs.readFileSync(FAV_JSON, 'utf8'));
		return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

function saveFavs(list) {
	try {
		fs.writeFileSync(FAV_JSON, JSON.stringify([...new Set(list)], null, '\t'), 'utf8');
	} catch {
		/* 저장 실패해도 서비스는 계속 */
	}
}

let favs = loadFavs();

const sseClients = new Set();
// 실행 중인 작업의 AbortController. [중지] 요청이 이 신호를 걸어 수집 루프가 안전하게 빠져나온다.
let currentStop = null;

function broadcast(event, data) {
	const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
	for (const res of sseClients) {
		try {
			res.write(payload);
		} catch {
			sseClients.delete(res);
		}
	}
}

function setJob(patch) {
	job = { ...job, ...patch };
	persistJob();
	broadcast('job', job);
}

async function runCollection(opts) {
	if (job.status === 'running') throw new Error('이미 수집 중입니다.');
	const ac = new AbortController();
	currentStop = ac;
	setJob({
		status: 'running',
		index: 0,
		total: 0,
		current: null,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		error: null,
		result: null,
		log: []
	});

	try {
		const payload = await collectAll({
			...opts,
			signal: ac.signal,
			onProgress: (e) => {
				job = {
					...job,
					index: e.index,
					total: e.total,
					current: e.name,
					lastProgressAt: new Date().toISOString(),
					log: [...job.log.slice(-40), `${e.name}: ${e.status === 'ok' ? `${e.count}개` : `실패 ${e.error}`}`]
				};
				persistJob();
				broadcast('job', job);
			}
		});

		const aborted = ac.signal.aborted;
		saveItems(payload);
		const total = payload.categories.reduce((s, c) => s + c.itemCount, 0);
		setJob({
			status: aborted ? 'stopped' : 'done',
			finishedAt: new Date().toISOString(),
			current: null,
			result: {
				categories: payload.categories.length,
				items: total,
				...(aborted ? { note: '사용자가 중지했습니다. 여기까지의 결과가 저장되었습니다.' } : {})
			}
		});
		broadcast('data-changed', { at: new Date().toISOString() });
	} catch (err) {
		setJob({ status: 'error', error: err.message, finishedAt: new Date().toISOString(), current: null });
	} finally {
		currentStop = null;
	}
}

// 목록 수집 없이 상세페이지만 돌린다. 처리한 결과는 같은 JSON에 merge 되므로
// 저장 전까지는 목록의 대표이미지 등 다른 필드는 그대로 보존된다.
async function runDetailCollection(opts) {
	if (job.status === 'running') throw new Error('이미 수집 중입니다.');
	const ac = new AbortController();
	currentStop = ac;
	setJob({
		status: 'running',
		index: 0,
		total: 0,
		current: null,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		error: null,
		result: null,
		log: []
	});

	try {
		const payload = loadPayload();
		if (!payload.categories || !payload.categories.length) throw new Error('먼저 목록 수집을 실행하세요.');

		const result = await collectDetails(payload, {
			...opts,
			signal: ac.signal,
			// 10건마다 파일로 flush. 중간에 꺼져도 직전 저장분까지는 남는다.
			saveEvery: 10,
			onCheckpoint: (e) => {
				saveItems(payload);
				const at = new Date().toISOString();
				job = {
					...job,
					lastSavedAt: at,
					lastSavedIndex: e.index,
					log: [...job.log.slice(-40), `[중간저장] ${e.index}/${e.total}건 → 파일`]
				};
				persistJob();
				broadcast('job', job);
			},
			onProgress: (e) => {
				job = {
					...job,
					index: e.index,
					total: e.total,
					current: e.goodsNo || e.name || '',
					lastProgressAt: new Date().toISOString(),
					log: [
						...job.log.slice(-40),
						`${e.goodsNo || e.name}: ${e.status === 'ok' ? `이미지 ${e.imageCount}개` : e.status === 'retry' ? e.error : `실패 ${e.error}`}`
					]
				};
				persistJob();
				broadcast('job', job);
			}
		});
		const aborted = result.aborted || ac.signal.aborted;
		saveItems(payload);

		setJob({
			status: aborted ? 'stopped' : 'done',
			finishedAt: new Date().toISOString(),
			current: null,
			result: {
				categories: payload.categories.length,
				items: result.ok,
				images: result.images,
				failed: result.failed,
				...(aborted ? { note: '사용자가 중지했습니다. 여기까지의 결과가 저장되었습니다.' } : {})
			}
		});
		broadcast('data-changed', { at: new Date().toISOString() });
	} catch (err) {
		setJob({ status: 'error', error: err.message, finishedAt: new Date().toISOString(), current: null });
	} finally {
		currentStop = null;
	}
}

// 상품 1건 전체 재수집: 목록(썸네일/상품명/가격/배지) + 상세 + 고시.
// images.mjs 의 saveImage 는 로컬 파일이 이미 있으면 다시 받지 않으므로,
// 깨진 썸네일을 다시 받게 하려면 기존 썸네일 파일을 지운 뒤 수집한다.
async function runItemRecollection(goodsNo, opts = {}) {
	if (job.status === 'running') throw new Error('이미 수집 중입니다.');
	const ac = new AbortController();
	currentStop = ac;
	setJob({
		status: 'running',
		index: 0,
		total: 0,
		current: null,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		error: null,
		result: null,
		log: [`[재수집] ${goodsNo}: 목록+상세+고시 다시 받는 중…`]
	});

	try {
		const payload = loadPayload();
		if (!payload.categories || !payload.categories.length) throw new Error('먼저 목록 수집을 실행하세요.');

		// 1) 깨졌을 수 있는 썸네일 파일을 지운다 (다시 내려받게)
		const fsMod = await import('node:fs');
		const pathMod = await import('node:path');
		const imgDir = pathMod.join(DATA_DIR, 'images', goodsNo);
		if (fsMod.existsSync(imgDir)) {
			for (const f of fsMod.readdirSync(imgDir)) {
				// 썸네일(_main.*)만 지운다. 상세 이미지(_dN.*)는 상세 수집이 알아서 처리한다.
				if (f.startsWith(`${goodsNo}_main.`)) fsMod.rmSync(pathMod.join(imgDir, f), { force: true });
			}
		}

		// 2) 목록 재수집: 상품이 올라간 카테고리 페이지만 다시 읽는다
		const catNames = new Set(
			(payload.categories || []).filter((c) => (c.items || []).some((it) => it.goodsNo === goodsNo)).map((c) => c.name)
		);
		const listResult = await collectAll({
			...opts,
			// 해당 상품이 속한 카테고리만 방문
			limitFilter: (meta) => catNames.has(meta.name),
			// 썸네일 로컬 저장 여부(옵션). 기본은 URL 만 저장해 서버 트래픽을 줄인다.
			images: opts.images !== false,
			signal: ac.signal,
			onProgress: (e) => {
				job = {
					...job,
					index: e.index,
					total: e.total,
					current: `${goodsNo} 목록`,
					lastProgressAt: new Date().toISOString(),
					log: [...job.log.slice(-40), `목록: ${e.status === 'ok' ? `${e.count}개` : `실패 ${e.error}`}`]
				};
				persistJob();
				broadcast('job', job);
			}
		});
		if (ac.signal.aborted) {
			saveItems(loadPayload());
			setJob({ status: 'stopped', finishedAt: new Date().toISOString(), current: null });
			return;
		}

		// 3) 재수집한 목록 값을 기존 데이터에 반영한다 (상품명/가격/썸네일/배지 새로움)
		const fresh = {};
		for (const c of listResult.categories || []) {
			for (const it of c.items || []) {
				if (it.goodsNo === goodsNo) fresh[it.imageKey || goodsNo] = it;
			}
		}
		const freshItem = fresh[goodsNo];
		if (!freshItem) {
			// 목록 100위 안에 없으면(랭킹 변동) 새 목록 값을 못 받아온다.
			// 기존 데이터는 그대로 두고, 상세/고시/썸네일만 다시 받아 병합한다.
			console.log(`[재수집] ${goodsNo}: 최신 목록에 없음(랭킹 변동). 기존 정보 유지 + 상세/고시만 갱신`);
		}
		if (freshItem) {

		// 기존의 상세/고시는 일단 보존해두고, 아래 상세 수집이 다시 채운다
		const prevDetail = { detailHtml: null, detailImages: [], detailImageCount: 0, article: null, articleError: null, articleCollectedAt: null };
		for (const c of payload.categories || []) {
			for (const it of c.items || []) {
				if (it.goodsNo === goodsNo) {
					Object.assign(it, freshItem, {
						// rank 는 카테고리별로 다르므로 각자 유지
						rank: it.rank,
						rankingType: it.rankingType,
						detailHtml: it.detailHtml ?? prevDetail.detailHtml,
						detailImages: it.detailImages ?? prevDetail.detailImages,
						detailImageCount: it.detailImageCount ?? prevDetail.detailImageCount,
						detailCollectedAt: it.detailCollectedAt ?? prevDetail.detailCollectedAt,
						article: it.article ?? prevDetail.article,
						articleError: it.articleError ?? prevDetail.articleError,
						articleCollectedAt: it.articleCollectedAt ?? prevDetail.articleCollectedAt
					});
				}
			}
		}
		saveItems(payload);
		broadcast('data-changed', { at: new Date().toISOString() });
		}

		// 4) 상세+고시 재수집 (force: 이미 있어도 다시 받는다)
		const detailResult = await collectDetails(payload, {
			goodsNo,
			force: true,
			delay: Number(opts.delay) || 5000,
			headed: !!opts.headed,
			images: opts.images !== false,
			signal: ac.signal,
			onProgress: (e) => {
				job = {
					...job,
					index: e.index,
					total: e.total,
					current: `${goodsNo} 상세/고시`,
					lastProgressAt: new Date().toISOString(),
					log: [
						...job.log.slice(-40),
						`${e.goodsNo || e.name}: ${e.status === 'ok' ? `이미지 ${e.imageCount}개` : e.status === 'retry' ? e.error : `실패 ${e.error}`}`
					]
				};
				persistJob();
				broadcast('job', job);
			}
		});
		saveItems(payload);
		const aborted = detailResult.aborted || ac.signal.aborted;
		setJob({
			status: aborted ? 'stopped' : 'done',
			finishedAt: new Date().toISOString(),
			current: null,
			result: {
				categories: 1,
				items: detailResult.ok || 1,
				images: (detailResult.images || 0) + (freshItem?.imagePath ? 1 : 0),
				failed: detailResult.failed || 0,
				...(aborted ? { note: '사용자가 중지했습니다.' } : {})
			}
		});
		broadcast('data-changed', { at: new Date().toISOString() });
	} catch (err) {
		setJob({ status: 'error', error: err.message, finishedAt: new Date().toISOString(), current: null });
	} finally {
		currentStop = null;
	}
}

// ------------------------------------------------------------------ helpers

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.avif': 'image/avif',
	'.bmp': 'image/bmp',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon'
};

function sendJson(res, data, status = 200) {
	const body = JSON.stringify(data);
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
	res.end(body);
}

function sendFile(res, filePath, { download = null } = {}) {
	if (!fs.existsSync(filePath)) return sendJson(res, { error: '파일을 찾을 수 없습니다.' }, 404);
	const ext = path.extname(filePath);
	const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
	if (download) {
		headers['Content-Type'] = download.type;
		headers['Content-Disposition'] = `attachment; filename="${download.name}"`;
	}
	res.writeHead(200, headers);
	fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let raw = '';
		req.on('data', (c) => {
			raw += c;
			if (raw.length > 1e6) reject(new Error('body too large'));
		});
		req.on('end', () => {
			try {
				resolve(raw ? JSON.parse(raw) : {});
			} catch {
				resolve({});
			}
		});
		req.on('error', reject);
	});
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');

// ------------------------------------------------------------------ routes

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	const p = url.pathname;

	try {
		// ---- 대시보드
		if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
			return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
		}
		if (req.method === 'GET' && (p === '/app.js' || p === '/style.css')) {
			return sendFile(res, path.join(PUBLIC_DIR, p.slice(1)));
		}

		// ---- 로컬로 내려받은 상품 이미지
		if (req.method === 'GET' && p.startsWith('/images/')) {
			const rel = decodeURIComponent(p.slice('/images/'.length));
			const file = path.resolve(IMAGE_DIR, rel);
			if (!file.startsWith(path.resolve(IMAGE_DIR))) return sendJson(res, { error: '잘못된 경로입니다.' }, 400);
			return sendFile(res, file);
		}

		// ---- 데이터
		if (req.method === 'GET' && p === '/api/summary') {
			const payload = loadPayload();
			const rows = flatten(payload);
			return sendJson(res, { job, ...summarize(payload, rows) });
		}

		if (req.method === 'GET' && p === '/api/items') {
			const payload = loadPayload();
			let all = flatten(payload);
			// 찜 보기 모드: 담아둔 상품만
			if (url.searchParams.get('fav') === '1') {
				const set = new Set(favs);
				all = all.filter((r) => set.has(r.goodsNo));
			}
			const filtered = applyQuery(all, {
				q: url.searchParams.get('q'),
				category: url.searchParams.get('category'),
				// brand 는 같은 키가 여러 번 올 수 있다 (다중 선택)
				brand: url.searchParams.getAll('brand'),
				flag: url.searchParams.get('flag'),
				minPrice: url.searchParams.get('minPrice'),
				maxPrice: url.searchParams.get('maxPrice'),
				sort: url.searchParams.get('sort'),
				order: url.searchParams.get('order')
			});

			const size = Math.min(Number(url.searchParams.get('size')) || 50, 500);
			const pages = Math.max(1, Math.ceil(filtered.length / size));
			const page = Math.min(Math.max(Number(url.searchParams.get('page')) || 1, 1), pages);

			return sendJson(res, {
				total: filtered.length,
				favCount: favs.length,
				allTotal: all.length,
				page,
				pages,
				size,
				columns: COLUMNS,
				// detailHtml 은 상품당 수십 KB 라 목록 응답에서는 뺀다
				items: filtered.slice((page - 1) * size, page * size).map(stripDetail)
			});
		}

		// ---- 찜(담아두기)
		if (req.method === 'GET' && p === '/api/favs') {
			return sendJson(res, { favs });
		}
		if (req.method === 'POST' && p === '/api/favs/toggle') {
			const body = await readBody(req);
			const goodsNo = String(body.goodsNo || '').trim();
			if (!goodsNo) return sendJson(res, { error: 'goodsNo 가 필요합니다.' }, 400);
			const on = !favs.includes(goodsNo);
			favs = on ? [...favs, goodsNo] : favs.filter((g) => g !== goodsNo);
			saveFavs(favs);
			return sendJson(res, { on, favCount: favs.length });
		}
		if (req.method === 'POST' && p === '/api/favs/clear') {
			favs = [];
			saveFavs(favs);
			return sendJson(res, { favCount: 0 });
		}

		// ---- 상품 상세 (기본 정보 + 정보고시 + 상세 DOM)
		if (req.method === 'GET' && p === '/api/detail') {
			const detail = findDetail(loadPayload(), url.searchParams.get('goodsNo'));
			if (!detail) return sendJson(res, { error: '상품을 찾을 수 없습니다.' }, 404);
			return sendJson(res, detail);
		}

		// ---- 내보내기 (현재 필터가 그대로 적용됨)
		if (req.method === 'GET' && p === '/api/export') {
			const format = (url.searchParams.get('format') || 'csv').toLowerCase();
			const payload = loadPayload();
			let all = flatten(payload);
			// 찜 보기 모드: 담아둔 상품만 내보낸다
			if (url.searchParams.get('fav') === '1') {
				const set = new Set(favs);
				all = all.filter((r) => set.has(r.goodsNo));
			}
			const filtered = applyQuery(all, {
				q: url.searchParams.get('q'),
				category: url.searchParams.get('category'),
				brand: url.searchParams.getAll('brand'),
				flag: url.searchParams.get('flag'),
				minPrice: url.searchParams.get('minPrice'),
				maxPrice: url.searchParams.get('maxPrice'),
				sort: url.searchParams.get('sort'),
				order: url.searchParams.get('order')
			});

			if (!filtered.length) return sendJson(res, { error: '내보낼 데이터가 없습니다.' }, 400);

			const base = `oliveyoung_ranking_${stamp()}`;
			if (format === 'xlsx') {
				const summary = summarize(payload, all);
				// 찜 엑셀은 협력사 사이트가 그대로 가져올 수 있게 상세이미지·정보고시 열을 붙인다.
				const buf = url.searchParams.get('fav') === '1' ? buildPartnerWorkbook(filtered) : buildWorkbook(filtered, summary);
				res.writeHead(200, {
					'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					'Content-Disposition': `attachment; filename="${base}.xlsx"`,
					'Content-Length': buf.length
				});
				return res.end(buf);
			}

			const csv = buildCsv(filtered);
			res.writeHead(200, {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${base}.csv"`,
				'Content-Length': Buffer.byteLength(csv)
			});
			return res.end(csv);
		}

		// ---- 수집 실행
		if (req.method === 'GET' && p === '/api/job') {
			return sendJson(res, job);
		}

		if (req.method === 'POST' && p === '/api/collect') {
			if (job.status === 'running') return sendJson(res, { error: '이미 수집 중입니다.', job }, 409);
			const body = await readBody(req);
			runCollection({
				top: Number(body.top) || 0,
				delay: Number(body.delay) || 1500,
				detailDelay: Number(body.detailDelay) || 5000,
				headed: !!body.headed,
				limit: Number(body.limit) || 0,
				images: body.images !== false,
				detail: !!body.detail
			});
			return sendJson(res, { started: true, job });
		}

		// ---- 수집 중지 (진행 중인 것까지 저장하고 안전하게 끝낸다)
		if (req.method === 'POST' && p === '/api/collect/stop') {
			if (job.status !== 'running' || !currentStop) return sendJson(res, { error: '진행 중인 수집이 없습니다.' }, 409);
			currentStop.abort();
			return sendJson(res, { stopping: true, job });
		}

		// ---- 상세페이지만 수집
		if (req.method === 'POST' && p === '/api/collect-detail') {
			if (job.status === 'running') return sendJson(res, { error: '이미 수집 중입니다.', job }, 409);
			const body = await readBody(req);
			runDetailCollection({
				delay: Number(body.delay) || 5000,
				headed: !!body.headed,
				limit: Number(body.limit) || 0,
				images: body.images !== false,
				force: !!body.force,
				// 고시 전용: 고시 없는 상품만 방문해 정보고시만 받는다 (상세/이미지 무영향)
				articleOnly: !!body.articleOnly
			});
			return sendJson(res, { started: true, job });
		}

		// ---- 상품 1건만 수집 (목록의 행 버튼 / 상세 모달의 버튼)
		// articleOnly: true 면 고시만, false 면 상세(상세+고시 함께)를 받는다.
		if (req.method === 'POST' && p === '/api/collect-item') {
			if (job.status === 'running') return sendJson(res, { error: '다른 수집이 진행 중입니다. 끝난 후 다시 시도하세요.', job }, 409);
			const body = await readBody(req);
			const goodsNo = String(body.goodsNo || '').trim();
			if (!goodsNo) return sendJson(res, { error: 'goodsNo 가 필요합니다.' }, 400);
			// 대상 상품이 목록에 있는지 확인해 실패를 즉시 알린다
			const target = flatten(loadPayload()).find((r) => r.goodsNo === goodsNo);
			if (!target) return sendJson(res, { error: `목록에서 상품(${goodsNo})을 찾을 수 없습니다.` }, 404);
			runDetailCollection({
				goodsNo,
				// 행/모달 버튼은 사용자가 그 상품을 명시적으로 다시 받으려 한 것이므로 항상 재수집
				force: true,
				delay: Number(body.delay) || 5000,
				headed: !!body.headed,
				images: body.images !== false,
				articleOnly: !!body.articleOnly
			});
			return sendJson(res, { started: true, job });
		}

		// ---- 상품 1건 재수집: 썸네일/상품명/가격(목록 전부) + 상세 + 고시를 전부 다시 받는다.
		// 이미지 캐시를 우회해 깨진 썸네일을 새로 내려받는다. 목록 행의 [재수집] 버튼용.
		if (req.method === 'POST' && p === '/api/recollect-item') {
			if (job.status === 'running') return sendJson(res, { error: '다른 수집이 진행 중입니다. 끝난 후 다시 시도하세요.', job }, 409);
			const body = await readBody(req);
			const goodsNo = String(body.goodsNo || '').trim();
			if (!goodsNo) return sendJson(res, { error: 'goodsNo 가 필요합니다.' }, 400);
			const target = flatten(loadPayload()).find((r) => r.goodsNo === goodsNo);
			if (!target) return sendJson(res, { error: `목록에서 상품(${goodsNo})을 찾을 수 없습니다.` }, 404);
			runItemRecollection(goodsNo, {
				delay: Number(body.delay) || 5000,
				headed: !!body.headed,
				images: body.images !== false
			});
			return sendJson(res, { started: true, job });
		}

		// ---- SSE 진행률
		if (req.method === 'GET' && p === '/api/events') {
			res.writeHead(200, {
				'Content-Type': 'text/event-stream; charset=utf-8',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			});
			res.write(`event: job\ndata: ${JSON.stringify(job)}\n\n`);
			sseClients.add(res);
			const ka = setInterval(() => res.write(': keep-alive\n\n'), 20000);
			req.on('close', () => {
				clearInterval(ka);
				sseClients.delete(res);
			});
			return;
		}

		return sendJson(res, { error: 'not found' }, 404);
	} catch (err) {
		console.error(err);
		return sendJson(res, { error: err.message }, 500);
	}
});

server.listen(PORT, () => {
	console.log(`올리브영 랭킹 대시보드: http://localhost:${PORT}`);
	console.log('종료하려면 Ctrl+C');
});

// Ctrl+C 로 내려도 진행 중이던 job 상태를 파일에 남긴다.
// 다음 실행 때 loadPersistedJob() 이 이걸 읽어 '중단됨'으로 표시한다.
for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, () => {
		try {
			if (job.status === 'running') {
				persistJob();
				console.log('\n수집이 진행 중이던 상태로 종료합니다. 재시작 시 중단됨으로 표시됩니다.');
			}
		} finally {
			process.exit(0);
		}
	});
}
