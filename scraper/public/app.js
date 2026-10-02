'use strict';

const $ = (id) => document.getElementById(id);

const state = {
	page: 1,
	size: 50,
	pages: 1,
	total: 0,
	allTotal: 0,
	columns: [],
	summary: null,
	brands: [], // 전체 브랜드 목록 (가나다순)
	pickedBrands: new Set(), // 선택된 브랜드
	favs: new Set(), // 찜(담아두기)한 상품코드
	favView: false // 찜 보기 모드
};

// 빠른 필터 변경 시 요청이 겹칠 수 있다. 늦게 도착한 이전 응답은 버린다.
let reqSeq = 0;

// 필터 상태를 현재 입력값에서 읽어낸다
function filters() {
	return {
		q: $('fQ').value.trim(),
		category: $('fCategory').value,
		brand: [...state.pickedBrands],
		flag: $('fFlag').value,
		minPrice: $('fMinPrice').value,
		maxPrice: $('fMaxPrice').value,
		sort: $('fSort').value,
		order: $('fOrder').value
	};
}

function queryString(extra = {}) {
	const f = filters();
	const p = new URLSearchParams();
	// 찜 보기 모드면 fav=1 (서버에서 담아둔 상품만 필터)
	if (state.favView) p.set('fav', '1');
	for (const [k, v] of Object.entries({ ...f, ...extra })) {
		// 브랜드는 여러 개를 고를 수 있어 같은 키를 여러 번 붙인다
		if (Array.isArray(v)) {
			v.forEach((x) => p.append(k, x));
			continue;
		}
		if (v !== '' && v !== null && v !== undefined) p.set(k, v);
	}
	return p.toString();
}

const esc = (s) =>
	String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const won = (n) => (typeof n === 'number' ? n.toLocaleString('ko-KR') : '');

// 상품명 옆의 "원본 페이지" 아이콘 (외부 링크)
const EXT_ICON =
	'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
	'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>' +
	'<polyline points="15 3 21 3 21 9"></polyline>' +
	'<line x1="10" y1="14" x2="21" y2="3"></line></svg>';

// ------------------------------------------------------------------ 렌더링

// 정렬 대상이 되는 열. 서버(applyQuery)가 COLUMNS 키만 받으므로 그 안에서 고른다.
// 이미지/상세 여부는 정렬할 이유가 없어 뺀다.
const SORTABLE = new Set([
	'categoryName',
	'rank',
	'name',
	'brand',
	'effectivePrice',
	'discountRate',
	'flagsText',
	'goodsNo',
	'manufactureCountry',
	'capacity'
]);

function renderHeader(columns) {
	const order = [
		{ key: 'categoryName', label: '카테고리', cls: 'cat' },
		{ key: 'rank', label: '순위', cls: 'rank' },
		{ key: 'name', label: '상품명', cls: 'name' },
		{ key: 'brand', label: '브랜드' },
		{ key: 'effectivePrice', label: '실제가격', cls: 'num' },
		{ key: 'discountRate', label: '할인율', cls: 'num' },
		{ key: 'flagsText', label: '배지' },
		{ key: 'goodsNo', label: '상품코드' },
		{ key: 'manufactureCountry', label: '제조국', cls: 'mid' },
		{ key: 'capacity', label: '용량', cls: 'long' },
		{ key: 'imageUrl', label: '이미지', cls: 'img' },
		{ key: 'hasDetail', label: '상세', cls: 'detail' },
		{ key: '_collect', label: '수집', cls: 'collect' }
		// hasDetail/_collect 은 엑셀/CSV 에는 빼고 화면에만 쓰는 열이라 필터를 건너뛴다
	].filter((c) => c.key === 'hasDetail' || c.key === '_collect' || columns.some((x) => x.key === c.key));

	// 지금 적용 중인 정렬 상태를 헤더에 표시한다
	const curSort = $('fSort').value;
	const curOrder = $('fOrder').value;

	$('tbl').querySelector('thead').innerHTML =
		'<tr>' +
		order
			.map((c) => {					if (!SORTABLE.has(c.key)) return `<th class="${c.cls ? 'col-' + c.cls : ''}">${esc(c.label)}</th>`;
				const active = c.key === curSort;
				const arrow = active ? (curOrder === 'asc' ? '▲' : '▼') : '';
				const dir = active ? (curOrder === 'asc' ? 'ascending' : 'descending') : 'none';
				const hint = active ? (curOrder === 'asc' ? '내림차순' : '오름차순') : '오름차순';
				return (
					`<th class="sortable${active ? ' sorted' : ''}" data-sort="${esc(c.key)}"` +
					` aria-sort="${dir}" title="클릭: ${hint}"` +
					`>${esc(c.label)}<span class="sortarrow">${arrow}</span></th>`
				);
			})
			.join('') +
		'</tr>';
	return order;
}

// 목록 이미지 셀: 로컬 저장분이 있으면 그걸, 없으면 원본 URL 을 보여준다.
// (기본은 로컬 저장 off — 원본 URL 로 직접 표시해 서버 트래픽/용량을 아낀다)
function rowImg(r) {
	const src = r.imagePath ? '/' + r.imagePath : r.imageUrl;
	return `<td class="img">${src ? `<img src="${esc(src)}" loading="lazy" alt="" />` : ''}</td>`;
}

function renderRow(r, order) {
	return (
		'<tr>' +
		order
			.map((c) => {
				switch (c.key) {
					case 'name': {
						// 상품명은 내부 상세(수집한 상품 상세 설명)로, 원본은 옆 아이콘으로
						// (상세를 아직 모은 적 없는 상품은 모달이 "미수집" 안내를 보여준다)
						const name = `<a href="#" class="namelink" data-goods="${esc(r.goodsNo)}">${esc(r.name)}</a>`;
						const ext = r.detailUrl
							? `<a class="extlink" href="${esc(r.detailUrl)}" target="_blank" rel="noopener" title="올리브영 원본 페이지 열기">${EXT_ICON}</a>`
							: '';
						return `<td class="name">${name}${ext}</td>`;
					}
					case 'effectivePrice':
						return `<td class="num">${won(r.effectivePrice)}</td>`;
					case 'discountRate':
						return `<td class="num">${r.discountRate === null ? '' : r.discountRate + '%'}</td>`;
					case 'flagsText':
						return `<td>${(r.flags || []).map((f) => `<span class="tag">${esc(f)}</span>`).join('') || ''}</td>`;
					case 'imageUrl':
						return rowImg(r);					case 'hasDetail':
						return `<td class="detail">${r.hasDetail ? `<button class="linkbtn" data-goods="${esc(r.goodsNo)}">설명 보기</button>` : ''}</td>`;
					case '_collect':
						// 행별 버튼: [상세]=상세+고시 수집, [재수집]=썸네일/가격까지 전부 다시 받기
						// (재수집은 모달로 그 상품을 보고 있는 동안에만 화면에 반영된다)
						// data-goods 를 쓰면 모달 열기 리스너와 겹치므로 data-cgoods 로 담는다.
						const favOn = state.favs.has(r.goodsNo);
						return `<td class="collect">`
							+ `<button class="favbtn${favOn ? ' on' : ''}" data-fav="${esc(r.goodsNo)}" title="찜에 담아두기/빼기">${favOn ? '♥' : '♡'}</button>`
							+ `<button class="collectbtn" data-collect="detail" data-cgoods="${esc(r.goodsNo)}" title="이 상품의 상세페이지(상세+고시)를 수집">상세</button>`
							+ `<button class="collectbtn recollect" data-collect="recollect" data-cgoods="${esc(r.goodsNo)}" title="이미지/상품명/가격/상세/고시를 전부 다시 수집 (모달로 보고 있는 동안에만 화면 갱신)">재수집</button>`
							+ `</td>`;
					case 'rank':
						return `<td class="rank">${esc(r.rank)}</td>`;
					case 'manufactureCountry':
					// 수집 전엔 값이 없으니 빈칸으로 표시
					case 'capacity':
						return `<td class="${c.cls}">${esc(r[c.key])}</td>`;
					default:
						return `<td>${esc(r[c.key])}</td>`;
				}
			})
			.join('') +
		'</tr>'
	);
}

function renderPager() {
	$('pgInfo').textContent = `${state.page} / ${state.pages} 페이지 · ${state.total.toLocaleString()}건`;
	$('pgFirst').disabled = $('pgPrev').disabled = state.page <= 1;
	$('pgNext').disabled = $('pgLast').disabled = state.page >= state.pages;
}

// --------------------------------------------------------- 브랜드 다중 선택

// 브랜드가 380개 넘으므로 전체 select 로는 찾기 어렵다.
// 검색창 + 체크박스 목록으로 고르도록 바꾼다.
function renderBrandList() {
	const kw = $('brandSearch').value.trim().toLowerCase();
	const shown = kw ? state.brands.filter((b) => b.toLowerCase().includes(kw)) : state.brands;

	$('brandList').innerHTML = shown.length
		? shown
				.map(
					(b) =>
						`<li><label><input type="checkbox" value="${esc(b)}"${
							state.pickedBrands.has(b) ? ' checked' : ''
						} /> ${esc(b)}</label></li>`
				)
				.join('')
		: '<li class="ms-empty">일치하는 브랜드가 없습니다</li>';

	$('brandCount').textContent = `${shown.length}개 중 ${state.pickedBrands.size}개 선택`;
	syncBrandButton();
}

// 버튼 라벨은 선택 없을 때 "전체 브랜드", 있으면 "N개 선택"
function syncBrandButton() {
	const n = state.pickedBrands.size;
	$('brandToggle').textContent = n ? `브랜드 ${n}개 선택` : '전체 브랜드';
	$('brandToggle').classList.toggle('on', n > 0);
}

function setBrandOpen(open) {
	$('brandPanel').hidden = !open;
	$('brandToggle').setAttribute('aria-expanded', String(open));
	if (open) $('brandSearch').focus();
}

$('brandToggle').addEventListener('click', () => setBrandOpen($('brandPanel').hidden));
$('brandSearch').addEventListener('input', renderBrandList);

$('brandList').addEventListener('change', (e) => {
	if (e.target.type !== 'checkbox') return;
	const b = e.target.value;
	if (e.target.checked) state.pickedBrands.add(b);
	else state.pickedBrands.delete(b);
	renderBrandList();
	reload();
});

// 목록 바깥을 누르면 닫는다
document.addEventListener('click', (e) => {
	if (!$('brandPanel').hidden && !$('brandSel').contains(e.target)) setBrandOpen(false);
});
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && !$('brandPanel').hidden) setBrandOpen(false);
});

$('brandAll').addEventListener('click', () => {
	// 검색 결과에 보이는 것만 전체 선택 (380개를 한 번에 고를 수는 있게)
	$('brandList')
		.querySelectorAll('input[type="checkbox"]')
		.forEach((el) => el.checked && state.pickedBrands.add(el.value));
	renderBrandList();
	reload();
});

$('brandNone').addEventListener('click', () => {
	state.pickedBrands.clear();
	renderBrandList();
	reload();
});

// ------------------------------------------------------------------ 데이터

async function loadItems() {
	const seq = ++reqSeq;
	const res = await fetch('/api/items?' + queryString({ page: state.page, size: state.size }));
	const data = await res.json();
	if (seq !== reqSeq) return; // 더 최신 요청이 이미 결과를 그렸음

	state.total = data.total;
	state.allTotal = data.allTotal;
	state.pages = data.pages;
	state.page = data.page;
	state.columns = data.columns;

	const order = renderHeader(data.columns);
	$('tbl').querySelector('tbody').innerHTML = data.items.map((r) => renderRow(r, order)).join('');
	// 상품명 링크와 "설명 보기" 버튼이 같은 동작을 하므로 data-goods 로 한 번에 묶는다
	$('tbl')
		.querySelectorAll('[data-goods]')
		.forEach((el) =>
			el.addEventListener('click', (e) => {
				e.preventDefault();
				openDetail(el.dataset.goods);
			})
		);
	// 행별 [찜][상세][재수집] 버튼 — data-cgoods 를 써서 위의 모달 열기 루프와 안 겹친다
	$('tbl')
		.querySelectorAll('button.collectbtn')
		.forEach((el) =>
			el.addEventListener('click', (e) => {
				e.preventDefault();
				if (el.dataset.collect === 'recollect') recollectOne(el.dataset.cgoods);
				else collectOne(el.dataset.cgoods, el.dataset.collect);
			})
		);
	$('tbl')
		.querySelectorAll('button.favbtn')
		.forEach((el) => el.addEventListener('click', (e) => {
			e.preventDefault();
			toggleFav(el.dataset.fav);
		}));
	$('countLine').textContent = `전체 ${state.allTotal.toLocaleString()}건 중 ${state.total.toLocaleString()}건 표시`;
	renderPager();
}

async function loadSummary() {
	const res = await fetch('/api/summary');
	const s = await res.json();
	state.summary = s;

	$('metaLine').textContent = s.generatedAt
		? `마지막 수집 ${new Date(s.generatedAt).toLocaleString('ko-KR')} · 카테고리 ${s.categories.length}개 · 상품 ${s.totalItems.toLocaleString()}건`
		: '수집된 데이터가 없습니다. 수집을 실행하세요.';

	const keep = (sel, list, label) => {
		const prev = sel.value;
		sel.innerHTML = `<option value="">${label}</option>` + list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
		sel.value = prev;
	};
	keep($('fCategory'), s.categories.map((c) => c.name), '전체 카테고리');
	keep($('fFlag'), s.flags, '전체 배지');

	// 새로 수집되면 브랜드 목록이 바뀌므로, 사라진 브랜드는 선택에서 뺀다
	state.brands = (s.brands || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
	for (const b of [...state.pickedBrands]) {
		if (!state.brands.includes(b)) state.pickedBrands.delete(b);
	}
	renderBrandList();

	renderJob(s.job);
}

async function refresh() {
	await loadSummary();
	await loadItems();
}

// ------------------------------------------------------------------ 작업 상태

const STATUS_TEXT = { idle: '대기', running: '수집 중', done: '완료', stopped: '중지됨', aborted: '중단됨', error: '오류' };

// 수집 폼은 필요할 때만 띄운다. 사용자가 접은 상태는 다음 방문에도 유지된다.
const JOB_HIDDEN_KEY = 'oy.jobHidden';

function showJob(visible, remember = true) {
	$('jobPanel').hidden = !visible;
	$('btnToggleJob').setAttribute('aria-expanded', String(visible));
	$('btnToggleJob').textContent = visible ? '수집 설정 닫기' : '수집 설정';
	if (remember) {
		try {
			localStorage.setItem(JOB_HIDDEN_KEY, visible ? '0' : '1');
		} catch {
			/* localStorage 차단 환경이면 무시 */
		}
	}
}

const STATUS_CLASS = { idle: '', running: 'running', done: 'done', stopped: 'aborted', aborted: 'aborted', error: 'error' };

// 시작 시각부터 지금까지의 경과시간 (예: 1:23:45)
function fmtElapsed(sinceIso) {
	if (!sinceIso) return '';
	let s = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

// 정체 감지 기준. 수집이 실제로 어떤 진행 표시도 못 내는 시간.
const STALLED_MS = 180000; // 3분

function renderJob(job) {
	if (!job) return;
	// 수집이 돌아가는 중이면 숨겨 둔 폼을 자동으로 꺼낸다
	if (job.status === 'running' && $('jobPanel').hidden) showJob(true, false);
	const badge = $('jobStatus');
	badge.textContent = STATUS_TEXT[job.status] || job.status;
	badge.className = 'badge ' + (STATUS_CLASS[job.status] ?? '');

	const pct = job.total ? Math.round((job.index / job.total) * 100) : 0;
	const running = job.status === 'running';
	$('jobBar').style.width = (job.status === 'done' ? 100 : pct) + '%';

	// [중지] 버튼은 수집 중에만 보인다
	$('btnStopJob').hidden = !running;

	let text = '';
	if (running) {
		// 경과시간 · 처리속도 · 남은 예상시간
		const elapsed = fmtElapsed(job.startedAt);
		let tail = '';
		if (job.total && job.index) {
			const msPer = (Date.now() - new Date(job.startedAt).getTime()) / job.index;
			const remain = Math.max(0, Math.round(((job.total - job.index) * msPer) / 1000));
			const rm = Math.floor(remain / 60), rs = remain % 60;
			tail = ` · 남음 약 ${rm}:${String(rs).padStart(2, '0')}`;
		}
		const saved = job.lastSavedAt ? ` · 마지막 저장 ${fmtElapsed(job.lastSavedAt)} 전` : '';
		text = `[${job.index}/${job.total}] ${job.current || '준비 중'} … ${elapsed} 경과${tail}${saved}`;
	} else if (job.status === 'done') {
		const r = job.result || {};
		const imgs = typeof r.images === 'number' ? ` / 이미지 ${r.images.toLocaleString()}개` : '';
		text = `완료 — 카테고리 ${r.categories ?? 0}개 / 상품 ${(r.items ?? 0).toLocaleString()}건${imgs}`;
	} else if (job.status === 'stopped' || job.status === 'aborted') {
		const r = job.result || {};
		const savedNote = job.lastSavedAt ? `마지막 저장 ${new Date(job.lastSavedAt).toLocaleTimeString('ko-KR')}` : '저장된 분 없음';
		text = `${job.status === 'aborted' ? '서버 재시작으로 중단' : '사용자가 중지'} — 여기까지 저장됨 (${savedNote})${r.note ? ' · ' + r.note : ''}`;
	} else if (job.status === 'error') text = `오류 — ${job.error}`;
	else text = '수집 작업이 없습니다.';
	$('jobText').textContent = text;

	// 정체 감지: 수집 중인데 마지막 진행 표시가 3분 넘게 없으면 경고
	const stalled = running && job.lastProgressAt && Date.now() - new Date(job.lastProgressAt).getTime() > STALLED_MS;
	$('jobStalled').hidden = !stalled;

	const busy = job.status === 'running';
	$('btnCollect').disabled = busy;
	$('btnCollect').textContent = busy ? '수집 중…' : '수집 실행';
	$('btnCollect2').disabled = busy;
	$('btnCollect2').textContent = busy ? '수집 중…' : '이 옵션으로 다시 실행';
	$('btnDetailCollect').disabled = busy;
	$('btnDetailCollect').textContent = busy ? '수집 중…' : '상세만 수집';
	$('btnArticleCollect').disabled = busy;
	$('btnArticleCollect').textContent = busy ? '수집 중…' : '고시만 수집';

	const log = $('jobLog');
	log.innerHTML = (job.log || []).map((l) => `<li>${esc(l)}</li>`).join('');
	log.scrollTop = log.scrollHeight; // 새 줄이 보이면 아래로
}

function connectEvents() {
	const es = new EventSource('/api/events');
	es.addEventListener('job', (e) => renderJob(JSON.parse(e.data)));
	es.addEventListener('data-changed', async () => {
		await loadSummary();
		await loadItems();
		// 상품 1건 수집이 모달에서 시작됐었고 모달이 아직 닫히지 않았다면
		// 새로 받은 내용을 바로 보여주기 위해 다시 연다
		if (openGoodsNo && collectOneFromModal && $('detailModal').open) {
			collectOneFromModal = false;
			await openDetail(openGoodsNo);
		}
		// 행 [재수집]: "보고 있는 동안에만 갱신" — 모달이 열려 있고 같은 상품일 때만 다시 그린다
		if (recollectWatch && $('detailModal').open && openGoodsNo === recollectWatch) {
			recollectWatch = null;
			await openDetail(openGoodsNo);
		} else if (recollectWatch) {
			recollectWatch = null; // 모달이 닫혔거나 다른 상품을 보고 있으면 화면 갱신은 하지 않음
		}
	});
}

// ------------------------------------------------------------------ 이벤트

function debounce(fn, ms) {
	let t;
	return (...a) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...a), ms);
	};
}

const reload = async () => {
	state.page = 1;
	await loadItems();
};

// 헤더 클릭 정렬. 셀렉트(fSort/fOrder)와 같은 값을 공유하므로
// 내보내기(CSV/Excel)도 언제나 화면과 같은 정렬로 나간다.
$('tbl')
	.querySelector('thead')
	.addEventListener('click', (e) => {
		const th = e.target.closest('th[data-sort]');
		if (!th) return;
		const key = th.dataset.sort;
		const label = th.textContent.replace(/[▲▼]/g, '').trim();
		// 같은 열을 다시 누르면 방향을 뒤집고, 다른 열을 누르면 오름차순부터
		const next = $('fSort').value === key ? ($('fOrder').value === 'asc' ? 'desc' : 'asc') : 'asc';

		const sel = $('fSort');
		if (![...sel.options].some((o) => o.value === key)) {
			const opt = document.createElement('option');
			opt.value = key;
			opt.textContent = '정렬: ' + label;
			sel.appendChild(opt);
		}
		sel.value = key;
		$('fOrder').value = next;
		reload();
	});

$('fQ').addEventListener('input', debounce(reload, 300));
['fCategory', 'fFlag', 'fMinPrice', 'fMaxPrice', 'fSort', 'fOrder'].forEach((id) =>
	$(id).addEventListener('change', reload)
);

$('btnReset').addEventListener('click', async () => {
	['fQ', 'fMinPrice', 'fMaxPrice'].forEach((id) => ($(id).value = ''));
	['fCategory', 'fFlag'].forEach((id) => ($(id).value = ''));
	state.pickedBrands.clear();
	renderBrandList();
	setBrandOpen(false);
	$('fSort').value = 'effectivePrice';
	$('fOrder').value = 'asc';
	await reload();
});

$('btnRefresh').addEventListener('click', refresh);

// ------------------------------------------------------------------ 찜(담아두기)

// 카트에 담아두듯 상품을 골라두는 기능. 파일로 저장되므로 브라우저를 바꿔도 유지된다.
async function loadFavs() {
	try {
		const res = await fetch('/api/favs');
		const data = await res.json();
		state.favs = new Set(data.favs || []);
	} catch {
		state.favs = new Set();
	}
}

async function toggleFav(goodsNo) {
	try {
		const res = await fetch('/api/favs/toggle', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ goodsNo })
		});
		const data = await res.json();
		if (data.error) return alert(data.error);
		if (data.on) state.favs.add(goodsNo);
		else state.favs.delete(goodsNo);
		// 행의 하트를 즉시 반영 (목록 전체를 다시 그리지 않고)
		const hb = document.querySelector(`#tbl button.favbtn[data-fav="${goodsNo}"]`);
		if (hb) {
			hb.textContent = data.on ? '♥' : '♡';
			hb.classList.toggle('on', !!data.on);
		}
		syncFavUi();
		// 찜 보기 중이면 목록을 다시 그려 담기 해제한 상품을 바로 치운다
		if (state.favView) await loadItems();
		// 모달이 열려 있고 그 상품이면 모달의 찜 버튼도 동기화
		if ($('detailModal').open && openGoodsNo === goodsNo) setModalFav(data.on);
	} catch (err) {
		alert('찜 처리가 실패했습니다: ' + err.message);
	}
}

function setModalFav(on) {
	const b = $('dmFav');
	b.textContent = on ? '♥ 찜함' : '♡ 찜';
	b.classList.toggle('on', !!on);
}

// 찜 관련 버튼 라벨/상태를 현재 상태에 맞춘다
function syncFavUi() {
	const b = $('btnFavView');
	b.textContent = state.favView ? `♥ 찜 보기 (${state.favs.size})` : `♡ 찜 보기 (${state.favs.size})`;
	b.setAttribute('aria-pressed', String(state.favView));
	b.classList.toggle('on', state.favView);
	$('btnFavClear').disabled = state.favs.size === 0;
	$('btnFavCsv').disabled = $('btnFavXlsx').disabled = state.favs.size === 0;
}

// 상단 [수집 실행] 과 폼 안의 [이 옵션으로 다시 실행] 이 같은 동작을 한다
async function startCollect() {
	showJob(true);
	$('btnCollect').disabled = true;
	try {
		const res = await fetch('/api/collect', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				top: Number($('optTop').value) || 0,
				delay: Number($('optDelay').value) || 1500,
				detailDelay: Number($('optDetailDelay').value) || 5000,
				limit: Number($('optLimit').value) || 0,
				headed: $('optHeaded').checked,
				images: $('optImages').checked,
				detail: $('optDetail').checked
			})
		});
		const data = await res.json();
		if (data.error) alert(data.error);
		else renderJob(data.job);
	} catch (err) {
		alert('수집을 시작하지 못했습니다: ' + err.message);
		$('btnCollect').disabled = false;
	}
}

$('btnCollect').addEventListener('click', startCollect);
$('btnCollect2').addEventListener('click', startCollect);
$('btnToggleJob').addEventListener('click', () => showJob($('jobPanel').hidden));
$('btnCollapseJob').addEventListener('click', () => showJob(false));

// [중지]: 서버에 abort 를 걸어 지금까지의 결과를 저장하며 안전하게 끝낸다
$('btnStopJob').addEventListener('click', async () => {
	if ($('btnStopJob').disabled) return;
	$('btnStopJob').disabled = true;
	try {
		const res = await fetch('/api/collect/stop', { method: 'POST' });
		const data = await res.json();
		if (data.error) alert(data.error);
		else renderJob(data.job);
	} catch (err) {
		alert('중지 요청이 실패했습니다: ' + err.message);
	} finally {
		$('btnStopJob').disabled = false;
	}
});

// 고시 전용 수집: 상세/이미지는 건드리지 않고 정보고시 없는 상품만 찾아 고시만 받는다
$('btnArticleCollect').addEventListener('click', async () => {
	$('btnArticleCollect').disabled = true;
	showJob(true);
	try {
		const res = await fetch('/api/collect-detail', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				delay: Number($('optDetailDelay').value) || 5000,
				limit: Number($('optTop').value) || 0,
				headed: $('optHeaded').checked,
				articleOnly: true
			})
		});
		const data = await res.json();
		if (data.error) alert(data.error);
		else renderJob(data.job);
	} catch (err) {
		alert('고시 수집을 시작하지 못했습니다: ' + err.message);
		$('btnArticleCollect').disabled = false;
	}
});

$('btnDetailCollect').addEventListener('click', async () => {
	$('btnDetailCollect').disabled = true;
	showJob(true);
	try {
		const res = await fetch('/api/collect-detail', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				delay: Number($('optDetailDelay').value) || 5000,
				limit: Number($('optTop').value) || 0,
				headed: $('optHeaded').checked,
				images: $('optImages').checked,
				force: $('optForce').checked
			})
		});
		const data = await res.json();
		if (data.error) alert(data.error);
		else renderJob(data.job);
	} catch (err) {
		alert('상세 수집을 시작하지 못했습니다: ' + err.message);
		$('btnDetailCollect').disabled = false;
	}
});

const download = (format, extra = {}) => {
	window.location.href = '/api/export?' + queryString({ format, ...extra });
};
$('btnCsv').addEventListener('click', () => download('csv'));
$('btnXlsx').addEventListener('click', () => download('xlsx'));
// 찜 내보내기: 담아둔 상품만 (fav=1)
$('btnFavCsv').addEventListener('click', () => download('csv', { fav: '1' }));
$('btnFavXlsx').addEventListener('click', () => download('xlsx', { fav: '1' }));

// 찜 보기 토글: 담아둔 상품만 테이블에 보인다
$('btnFavView').addEventListener('click', async () => {
	if (!state.favView && state.favs.size === 0) {
		alert('찜한 상품이 없습니다. 목록의 ♡ 버튼이나 모달의 [찜] 버튼으로 담아두세요.');
		return;
	}
	state.favView = !state.favView;
	syncFavUi();
	await reload();
});

// 찜 전체 비우기
$('btnFavClear').addEventListener('click', async () => {
	if (!confirm(`찜 ${state.favs.size}건을 모두 비웁니다. 계속할까요?`)) return;
	await fetch('/api/favs/clear', { method: 'POST' });
	state.favs.clear();
	state.favView = false;
	syncFavUi();
	await reload();
});

$('pgFirst').addEventListener('click', () => ((state.page = 1), loadItems()));
$('pgPrev').addEventListener('click', () => ((state.page = Math.max(1, state.page - 1)), loadItems()));
$('pgNext').addEventListener('click', () => ((state.page = Math.min(state.pages, state.page + 1)), loadItems()));
$('pgLast').addEventListener('click', () => ((state.page = state.pages), loadItems()));

// ------------------------------------------------------------------ 상품 1건 수집

// 지금 열려 있는 모달의 상품 코드. 수집 완료 후 모달을 다시 열 때 쓴다.
let openGoodsNo = null;
// collectOne 을 모달 안 버튼에서 시작했는지 — 완료 후 모달을 자동으로 다시 열기 위함
let collectOneFromModal = false;
// 행 [재수집]이 "보고 있는 상품"에 대해 시작됐는지 — 완료 시 그때도 보고 있으면 갱신
let recollectWatch = null;

// 상품 1건 전체 재수집(썸네일/상품명/가격/상세/고시). 요구사항:
// "해당 상품 정보를 확인하고 있을때만 갱신" → 모달이 열려 있고 같은 상품일 때만
// 완료 후 화면(모달+목록)을 새로 그린다. 모달이 닫혀 있으면 조용히 파일에만 저장.
async function recollectOne(goodsNo) {
	if (state.summary?.job?.status === 'running') {
		alert('다른 수집이 진행 중입니다. 끝난 후 다시 시도하세요.');
		return;
	}
	showJob(true);
	const watching = $('detailModal').open && openGoodsNo === goodsNo;
	try {
		const res = await fetch('/api/recollect-item', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				goodsNo,
				delay: Number($('optDetailDelay').value) || 5000,
				headed: $('optHeaded').checked
			})
		});
		const data = await res.json();
		if (data.error) {
			alert(data.error);
			return;
		}
		if (watching) {
			// 보고 있는 동안 갱신: 완료 이벤트(data-changed)에서 모달을 다시 연다
			recollectWatch = goodsNo;
		}
		renderJob(data.job);
	} catch (err) {
		alert('재수집을 시작하지 못했습니다: ' + err.message);
	}
}

// 상품 1건 수집. mode: 'detail' = 상세(상세+고시), 'article' = 고시만.
// 어디서 시작했는지에 따라 끝난 뒤 모달을 다시 열거나 목록을 새로 그린다.
async function collectOne(goodsNo, mode, { fromModal = false } = {}) {
	if (state.summary?.job?.status === 'running') {
		alert('다른 수집이 진행 중입니다. 끝난 후 다시 시도하세요.');
		return;
	}
	showJob(true);
	const label = mode === 'article' ? '고시' : '상세';
	try {
		const res = await fetch('/api/collect-item', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				goodsNo,
				articleOnly: mode === 'article',
				delay: Number($('optDetailDelay').value) || 5000,
				headed: $('optHeaded').checked,
				images: $('optImages').checked
			})
		});
		const data = await res.json();
		if (data.error) {
			alert(data.error);
			return;
		}
		openGoodsNo = goodsNo;
		collectOneFromModal = fromModal;
		renderJob(data.job);
	} catch (err) {
		alert(`${label} 수집을 시작하지 못했습니다: ` + err.message);
	}
}

// ------------------------------------------------------------------ 상세 모달

// detailHtml 안의 이미지 경로는 JSON 기준 상대경로(images/...)이므로
// 대시보드 루트(/images/...)로 붙여준다.
const absolutizeImages = (html) => html.replace(/(src|srcset)="images\//g, '$1="/images/');

const wonOrEmpty = (n) => (typeof n === 'number' ? n.toLocaleString('ko-KR') + '원' : '');

// 정보고시 원문을 표로. article 은 {제목: 내용} 형태.
function renderArticleTable(article) {
	const rows = Object.entries(article || {})
		.map(
			([title, content]) =>
				`<tr><th scope="row">${esc(title)}</th><td>${esc(String(content ?? '')).replace(/\n/g, '<br/>')}</td></tr>`
		)
		.join('');
	return rows ? `<table class="article-table"><tbody>${rows}</tbody></table>` : '';
}

// 모달 본문: 쇼핑몰 상세처럼 상단 요약(이미지+가격) + 탭(정보고시/상세 설명)
function renderDetailBody(d) {
	const imgSrc = d.imagePath ? '/' + d.imagePath : d.imageUrl;
	const priceHtml =
		(d.normalPrice && d.salePrice && d.normalPrice !== d.salePrice
			? `<span class="price-normal">${wonOrEmpty(d.normalPrice)}</span>`
			: '') +
		(d.effectivePrice !== null && d.effectivePrice !== undefined
			? `<span class="price-sale">${wonOrEmpty(d.effectivePrice)}</span>`
			: '') +
		(d.discountRate ? `<span class="price-rate">${d.discountRate}%</span>` : '');

	const flagHtml = (d.flags || []).map((f) => `<span class="tag">${esc(f)}</span>`).join('');

	// ---- 탭: 정보고시 / 상품 상세 설명
	// 둘 중 내용이 있는 쪽을 기본 탭으로 (둘 다 없으면 고시 탭 + 안내 문구)
	const hasArticle = !!d.article;
	const hasDetail = !!d.detailHtml;
	const defTab = hasDetail && !hasArticle ? 'detail' : 'article';

	const articlePane = `
		<div class="tabpane" id="pane-article"${defTab === 'article' ? '' : ' hidden'}>
			${hasArticle
				? renderArticleTable(d.article)
				: '<p class="goods-empty">아직 수집되지 않았습니다. [고시 수집] 버튼을 누르면 채워집니다.</p>'}
		</div>`;

	const detailPane = `
		<div class="tabpane" id="pane-detail"${defTab === 'detail' ? '' : ' hidden'}>
			${hasDetail
				? `<div class="goods-detailhtml">${absolutizeImages(String(d.detailHtml).replace(/<[\s\S]*?script[\s\S]*?>[\s\S]*?<\/[\s\S]*?script[\s\S]*?>/gi, ''))}</div>`
				: '<p class="goods-empty">아직 수집되지 않았습니다. [상세 수집] 버튼을 누르면 채워집니다.</p>'}
		</div>`;

	return `
		<div class="goods-top">
			<div class="goods-photo">${imgSrc ? `<img src="${esc(imgSrc)}" alt="" />` : '<div class="goods-photo-empty">이미지 없음</div>'}</div>
			<div class="goods-info">
				<p class="goods-brand">${esc(d.brand || '')}${d.rank ? `<span class="goods-rank">랭킹 ${esc(d.rank)}위</span>` : ''}</p>
				<h2 class="goods-name">${esc(d.name || '')}</h2>
				<div class="goods-price">${priceHtml}</div>
				<div class="goods-flags">${flagHtml}</div>
				<dl class="goods-spec">
					<div><dt>카테고리</dt><dd>${esc(d.categoryPath || d.categoryName || '')}</dd></div>
					<div><dt>용량</dt><dd>${esc(d.capacity || '')}</dd></div>
					<div><dt>제조국</dt><dd>${esc(d.manufactureCountry || '')}</dd></div>
					<div><dt>제조업자</dt><dd>${esc(d.manufacturer || '')}</dd></div>
					<div><dt>사용기한</dt><dd>${esc(d.expirationInfo || '')}</dd></div>
				</dl>
			</div>
		</div>
		<div class="modal-tabs" role="tablist">
			<button type="button" class="mtab${defTab === 'article' ? ' on' : ''}" data-tab="article" role="tab" aria-selected="${defTab === 'article'}" aria-controls="pane-article">품질정보 제공 (정보고시)</button>
			<button type="button" class="mtab${defTab === 'detail' ? ' on' : ''}" data-tab="detail" role="tab" aria-selected="${defTab === 'detail'}" aria-controls="pane-detail">상품 상세 설명</button>
		</div>
		${articlePane}
		${detailPane}`;
}

async function openDetail(goodsNo) {
	openGoodsNo = goodsNo; // 모달 안 [상세/고시 수집] 버튼이 이 값을 쓴다
	const modal = $('detailModal');
	$('dmTitle').textContent = '불러오는 중…';
	$('dmMeta').textContent = '';
	$('dmBody').innerHTML = '';
	modal.showModal();

	try {
		const res = await fetch('/api/detail?goodsNo=' + encodeURIComponent(goodsNo));
		const data = await res.json();
		if (data.error) throw new Error(data.error);
		$('dmTitle').textContent = data.name || goodsNo;
		$('dmMeta').textContent = [data.brand, data.categoryName, `이미지 ${data.detailImageCount}개`]
			.filter(Boolean)
			.join(' · ');
		$('dmLink').href = data.detailUrl || '#';
		setModalFav(state.favs.has(goodsNo));
		$('dmBody').innerHTML = renderDetailBody(data);
	} catch (err) {
		$('dmTitle').textContent = '상품 정보를 불러올 수 없음';
		$('dmMeta').textContent = goodsNo;
		$('dmBody').textContent = err.message;
	}
}

$('dmClose').addEventListener('click', () => $('detailModal').close());

// 모달 본문 탭 전환 (위임 — renderDetailBody 가 다시 그려져도 그대로 동작)
$('dmBody').addEventListener('click', (e) => {
	const tab = e.target.closest('.mtab');
	if (!tab) return;
	const key = tab.dataset.tab;
	for (const b of $('dmBody').querySelectorAll('.mtab')) {
		const on = b === tab;
		b.classList.toggle('on', on);
		b.setAttribute('aria-selected', String(on));
	}
	for (const p of $('dmBody').querySelectorAll('.tabpane')) {
		p.hidden = p.id !== 'pane-' + key;
	}
});

// 모달 안 [상세 수집]/[고시 수집]: 이 상품만 곧바로 수집하고, 끝나면 모달을 다시 열어
// 방금 받은 내용을 보여준다
$('dmCollectDetail').addEventListener('click', () => {
	if (openGoodsNo) collectOne(openGoodsNo, 'detail', { fromModal: true });
});
$('dmCollectArticle').addEventListener('click', () => {
	if (openGoodsNo) collectOne(openGoodsNo, 'article', { fromModal: true });
});

// 모달 안 [찜]: 이 상품을 담아두기/빼기
$('dmFav').addEventListener('click', () => {
	if (openGoodsNo) toggleFav(openGoodsNo);
});

// ------------------------------------------------------------------ 시작

// 기본은 숨김. 사용자가 직접 펼쳐 본 적이 있을 때만 펼친 상태로 기억한다.
let openedByUser = false;
try {
	openedByUser = localStorage.getItem(JOB_HIDDEN_KEY) === '0';
} catch {
	/* localStorage 차단 환경이면 무시 */
}
showJob(openedByUser, false);

// 찜 목록을 먼저 읽어 두면 첫 목록 렌더링부터 하트가 채워져 나온다
loadFavs().then(() => {
	refresh().then(() => {
		syncFavUi();
		connectEvents();
	});
});

// 수집 중에는 매초 다시 그려 경과시간/남은시간이 흐르게 한다
setInterval(() => {
	if (state.summary?.job?.status === 'running') renderJob(state.summary.job);
}, 1000);
