// 협력사용 정적 카탈로그. 계정 검사는 이 파일의 상수만 본다.
const ACCOUNT = { id: 'partner', password: 'woosul2026' };
const AUTH_KEY = 'woosul_partner_auth';
const LANG_KEY = 'woosul_lang';

const DICT = {
	ko: {
		appName: '협력사 카탈로그',
		loginHero: '선정 상품',
		loginLead: '내부에서 골라 둔 올리브영 랭킹 상품입니다. 협력사 공유용 화면입니다.',
		loginTitle: '로그인',
		loginHint: '전달받은 계정으로 들어갑니다.',
		userId: '아이디',
		password: '비밀번호',
		submit: '들어가기',
		errorTitle: '로그인할 수 없습니다',
		errorBody: '아이디 또는 비밀번호가 올바르지 않습니다.',
		errorLink: '아이디를 다시 입력',
		errorLinkPw: '비밀번호를 다시 입력',
		catalogKicker: 'Selected ranking',
		catalogTitle: '선정 상품',
		exported: '정리일',
		priceNote: '가격은 대한민국 원(KRW)입니다.',
		search: '검색',
		searchPlaceholder: '상품명, 브랜드, 상품코드',
		brand: '브랜드',
		allBrands: '전체 브랜드',
		brandSearch: '브랜드 검색',
		brandSelectShown: '검색결과 전체 선택',
		brandClear: '선택 해제',
		brandEmpty: '일치하는 브랜드가 없습니다',
		brandChosen: '브랜드 {n}개 선택',
		brandCount: '{shown}개 중 {picked}개 선택',
		category: '카테고리',
		allCategories: '전체 카테고리',
		sort: '정렬',
		sortSaved: '담은 순서',
		sortRank: '순위',
		sortPrice: '가격',
		sortDiscount: '할인율',
		sortName: '상품명',
		order: '순서',
		orderAsc: '오름차순',
		orderDesc: '내림차순',
		empty: '조건에 맞는 상품이 없습니다.',
		notFound: '상품을 찾을 수 없습니다.',
		back: '목록으로',
		goodsNo: '상품코드',
		normalPrice: '정가',
		salePrice: '판매가',
		badges: '배지',
		ranks: '카테고리별 순위',
		categoryPath: '상품 카테고리',
		article: '정보고시',
		noArticle: '등록된 정보고시가 없습니다.',
		importExcel: 'Excel 가져오기',
		importFail: '엑셀을 읽지 못했습니다.',
		importNoCode: '엑셀에 상품코드 열이 없습니다.',
		importEmpty: '가져올 상품이 없습니다.',
		clearImport: '기본 데이터',
		importedNote: '엑셀에서 불러온 목록입니다.',
		imageAlt: '상품 이미지',
		imageFail: '이미지를 표시할 수 없습니다',
		logout: '로그아웃',
		langLabel: '언어',
		countSuffix: '개 상품',
		missing: '찜에는 있으나 수집 결과에 없는 코드',
		priceUnknown: '가격 정보 없음'
	},
	id: {
		appName: 'Katalog Mitra',
		loginHero: 'Produk pilihan',
		loginLead: 'Produk peringkat Olive Young yang sudah dipilih untuk dibagikan kepada mitra.',
		loginTitle: 'Masuk',
		loginHint: 'Gunakan akun yang sudah diberikan.',
		userId: 'ID pengguna',
		password: 'Kata sandi',
		submit: 'Masuk',
		errorTitle: 'Tidak dapat masuk',
		errorBody: 'ID atau kata sandi tidak sesuai.',
		errorLink: 'Isi ulang ID',
		errorLinkPw: 'Isi ulang kata sandi',
		catalogKicker: 'Selected ranking',
		catalogTitle: 'Produk pilihan',
		exported: 'Tanggal susun',
		priceNote: 'Harga dalam won Korea (KRW).',
		search: 'Cari',
		searchPlaceholder: 'Nama, merek, atau kode',
		brand: 'Merek',
		allBrands: 'Semua merek',
		brandSearch: 'Cari merek',
		brandSelectShown: 'Pilih hasil pencarian',
		brandClear: 'Hapus pilihan',
		brandEmpty: 'Tidak ada merek yang cocok',
		brandChosen: '{n} merek dipilih',
		brandCount: '{picked} dari {shown} dipilih',
		category: 'Kategori',
		allCategories: 'Semua kategori',
		sort: 'Urutkan',
		sortSaved: 'Urutan simpan',
		sortRank: 'Peringkat',
		sortPrice: 'Harga',
		sortDiscount: 'Diskon',
		sortName: 'Nama produk',
		order: 'Urutan',
		orderAsc: 'Naik',
		orderDesc: 'Turun',
		empty: 'Tidak ada produk yang sesuai.',
		notFound: 'Produk tidak ditemukan.',
		back: 'Kembali ke daftar',
		goodsNo: 'Kode produk',
		normalPrice: 'Harga normal',
		salePrice: 'Harga jual',
		badges: 'Lencana',
		ranks: 'Peringkat per kategori',
		categoryPath: 'Kategori produk',
		article: 'Informasi produk',
		noArticle: 'Informasi produk belum tersedia.',
		importExcel: 'Impor Excel',
		importFail: 'Gagal membaca berkas Excel.',
		importNoCode: 'Kolom kode produk tidak ada.',
		importEmpty: 'Tidak ada produk untuk diimpor.',
		clearImport: 'Data awal',
		importedNote: 'Daftar ini diimpor dari Excel.',
		imageAlt: 'gambar produk',
		imageFail: 'Gambar tidak dapat dimuat',
		logout: 'Keluar',
		langLabel: 'Bahasa',
		countSuffix: 'produk',
		missing: 'Kode favorit yang tidak ada di data',
		priceUnknown: 'Harga tidak tersedia'
	}
};

const FLAGS = {
	세일: { ko: '세일', id: 'Obral' },
	쿠폰: { ko: '쿠폰', id: 'Kupon' },
	오늘드림: { ko: '오늘드림', id: 'Kirim hari ini' },
	증정: { ko: '증정', id: 'Hadiah' },
	'1+1': { ko: '1+1', id: '1+1' },
	무배: { ko: '무배', id: 'Gratis ongkir' }
};

const ARTICLE_RULES = [
	['용량', 'Isi atau berat'],
	['주요 사양', 'Spesifikasi utama'],
	['사용기한', 'Tanggal kedaluwarsa'],
	['사용방법', 'Cara penggunaan'],
	['제조업자', 'Produsen'],
	['제조국', 'Negara pembuat'],
	['모든 성분', 'Komposisi lengkap'],
	['심사필', 'Status kosmetik fungsional'],
	['주의사항', 'Perhatian saat penggunaan'],
	['품질보증', 'Standar jaminan mutu'],
	['소비자상담', 'Telepon layanan konsumen']
];

const IMPORT_KEY = 'woosul_partner_xlsx';
const bundledCatalog = window.PARTNER_CATALOG || { exportedAt: null, products: [], missing: [] };

function readSavedCatalog() {
	try {
		const saved = localStorage.getItem(IMPORT_KEY);
		if (!saved) return null;
		const data = JSON.parse(saved);
		if (!data || !Array.isArray(data.products)) return null;
		return data;
	} catch {
		return null;
	}
}

let catalog = readSavedCatalog() || bundledCatalog;
const state = {
	q: '',
	pickedBrands: new Set(),
	brandQuery: '',
	brandOpen: false,
	category: '',
	sort: 'saved',
	order: 'asc',
	loginId: '',
	showLoginError: false,
	imported: catalog !== bundledCatalog,
	importError: ''
};
let pendingHash = '';

function lang() {
	return localStorage.getItem(LANG_KEY) === 'id' ? 'id' : 'ko';
}

function t(key) {
	return (DICT[lang()] && DICT[lang()][key]) || DICT.ko[key] || key;
}

function isAuthed() {
	return sessionStorage.getItem(AUTH_KEY) === '1';
}

function esc(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function safeHttps(raw) {
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' ? url.href : '';
	} catch {
		return '';
	}
}

function money(value) {
	if (typeof value !== 'number') return t('priceUnknown');
	const locale = lang() === 'id' ? 'id-ID' : 'ko-KR';
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: 'KRW',
		maximumFractionDigits: 0
	}).format(value);
}

function formatDate(iso) {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat(lang() === 'id' ? 'id-ID' : 'ko-KR', {
		dateStyle: 'medium'
	}).format(date);
}

function flagLabel(flag) {
	const row = FLAGS[flag];
	if (!row) return flag;
	return row[lang()] || flag;
}

function articleLabel(title) {
	if (lang() !== 'id') return title;
	const rule = ARTICLE_RULES.find(([needle]) => String(title).includes(needle));
	return rule ? rule[1] : title;
}

function rankText(rank) {
	if (typeof rank !== 'number') return '';
	return lang() === 'id' ? `Peringkat ${rank}` : `${rank}위`;
}

function bestRank(product) {
	let best = null;
	for (const row of product.ranks || []) {
		if (typeof row.rank !== 'number') continue;
		if (!best || row.rank < best.rank) best = row;
	}
	return best;
}

function categories() {
	const set = new Set();
	for (const product of catalog.products || []) {
		for (const row of product.ranks || []) if (row.categoryName) set.add(row.categoryName);
	}
	return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

function brands() {
	const set = new Set();
	for (const product of catalog.products || []) {
		const name = String(product.brand || '').trim();
		if (name) set.add(name);
	}
	return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

function filteredProducts() {
	const q = state.q.trim().toLowerCase();
	const rows = (catalog.products || []).filter((product) => {
		if (state.pickedBrands.size && !state.pickedBrands.has(String(product.brand || '').trim())) return false;
		if (state.category && !(product.ranks || []).some((row) => row.categoryName === state.category)) return false;
		if (!q) return true;
		const hay = [product.name, product.brand, product.goodsNo, ...(product.ranks || []).map((row) => row.categoryName)]
			.join(' ')
			.toLowerCase();
		return hay.includes(q);
	});
	if (state.sort === 'saved') return state.order === 'desc' ? rows.reverse() : rows;
	const dir = state.order === 'desc' ? -1 : 1;
	rows.sort((a, b) => {
		if (state.sort === 'name') return a.name.localeCompare(b.name, 'ko') * dir;
		const pick = (product) => {
			if (state.sort === 'rank') return bestRank(product)?.rank ?? null;
			if (state.sort === 'discount') return product.discountRate;
			return product.effectivePrice;
		};
		const av = pick(a);
		const bv = pick(b);
		if (typeof av !== 'number') return 1;
		if (typeof bv !== 'number') return -1;
		if (av === bv) return a.name.localeCompare(b.name, 'ko');
		return (av - bv) * dir;
	});
	return rows;
}

function parseRoute() {
	const parts = (location.hash.replace(/^#/, '') || '/login').split('/').filter(Boolean);
	if (parts[0] === 'product' && parts[1]) return { name: 'product', goodsNo: decodeURIComponent(parts[1]) };
	if (parts[0] === 'catalog') return { name: 'catalog' };
	if (parts[0] === 'login') return { name: 'login' };
	return { name: isAuthed() ? 'catalog' : 'login' };
}

function findProduct(goodsNo) {
	return (catalog.products || []).find((product) => product.goodsNo === goodsNo) || null;
}

function langSwitch() {
	const current = lang();
	return `<div class="seg" role="group" aria-label="${esc(t('langLabel'))}">
		<button type="button" data-action="lang" data-lang="ko" aria-pressed="${current === 'ko'}">한국어</button>
		<button type="button" data-action="lang" data-lang="id" aria-pressed="${current === 'id'}">Indonesia</button>
	</div>`;
}

function headerHtml() {
	return `<header class="site-header">
		<a class="brand" href="#/catalog">
			<img class="logo" src="assets/logo_white.png" alt="우술" />
			<span class="brand-name">${esc(t('appName'))}</span>
		</a>
		<div class="header-actions">
			<label class="btn-ghost filebtn">${esc(t('importExcel'))}
				<input id="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
			</label>
			${state.imported ? `<button type="button" class="btn-ghost" data-action="clear-import">${esc(t('clearImport'))}</button>` : ''}
			${langSwitch()}
			<button type="button" class="btn-ghost" data-action="logout">${esc(t('logout'))}</button>
		</div>
	</header>
	${state.importError ? `<p class="error" role="alert">${esc(state.importError)}</p>` : ''}`;
}

function placeholderHtml(extra) {
	return `<div class="ph ${extra || ''}" role="img" aria-label="${esc(t('imageFail'))}">${esc(t('imageFail'))}</div>`;
}

function imageHtml(url, alt, className) {
	const safe = safeHttps(url);
	if (!safe) return placeholderHtml(className);
	return `<img class="${className}" src="${esc(safe)}" alt="${esc(alt)}" />`;
}

function priceHtml(product) {
	const current = typeof product.effectivePrice === 'number' ? product.effectivePrice : product.salePrice;
	const normal = product.normalPrice;
	const showWas = typeof normal === 'number' && typeof current === 'number' && normal > current;
	return `<p class="price-row">
		<span class="now">${esc(money(typeof current === 'number' ? current : null))}</span>
		${showWas ? `<span class="was">${esc(money(normal))}</span>` : ''}
	</p>`;
}

function flagsHtml(flags) {
	if (!flags || !flags.length) return '';
	return `<ul class="flags">${flags.map((flag) => `<li class="pill">${esc(flagLabel(flag))}</li>`).join('')}</ul>`;
}

function renderLogin() {
	const error = state.showLoginError
		? `<div id="loginError" class="error" role="alert" tabindex="-1">
			<p id="errorTitle">${esc(t('errorTitle'))}</p>
			<p>${esc(t('errorBody'))}</p>
			<a href="#loginId" data-action="focus-id">${esc(t('errorLink'))}</a>
			<a href="#loginPw" data-action="focus-pw">${esc(t('errorLinkPw'))}</a>
		</div>`
		: '';
	const invalid = state.showLoginError ? ' aria-invalid="true" aria-describedby="loginError"' : '';
	return `<div class="login">
		<section class="visual">
			<img class="logo" src="assets/logo_white.png" alt="우술" />
			<h1 class="display-ui">${esc(t('loginHero'))}</h1>
			<p class="lead">${esc(t('loginLead'))}</p>
		</section>
		<section class="login-panel">
			<div class="login-card">
				${langSwitch()}
				<h2 class="display-ui">${esc(t('loginTitle'))}</h2>
				<p class="hint">${esc(t('loginHint'))}</p>
				<form id="loginForm" class="form" novalidate>
					${error}
					<label class="field" for="loginId">${esc(t('userId'))}
						<input id="loginId" name="username" autocomplete="username" aria-required="true"${invalid} value="${esc(state.loginId)}" />
					</label>
					<label class="field" for="loginPw">${esc(t('password'))}
						<input id="loginPw" name="password" type="password" autocomplete="current-password" aria-required="true"${invalid} />
					</label>
					<button class="btn-primary" type="submit">${esc(t('submit'))}</button>
				</form>
			</div>
		</section>
	</div>`;
}

function cardHtml(product) {
	const best = bestRank(product);
	const chip = best ? `<span class="chip">${esc(rankText(best.rank))}</span>` : '';
	const discount = typeof product.discountRate === 'number' ? `<span class="discount chip">${esc(String(product.discountRate))}%</span>` : '';
	const alt = `${product.name} ${t('imageAlt')}`;
	return `<a class="card" href="#/product/${encodeURIComponent(product.goodsNo)}">
		<div class="thumb">
			${imageHtml(product.imageUrl, alt, 'cover')}
			${chip}
			${discount}
		</div>
		<div class="card-body">
			<p class="brand-line">${esc(product.brand || '')}${best ? ` · ${esc(best.categoryName)}` : ''}</p>
			<h2 class="pname">${esc(product.name)}</h2>
			${priceHtml(product)}
			${flagsHtml(product.flags)}
		</div>
	</a>`;
}

function gridHtml() {
	const rows = filteredProducts();
	if (!rows.length) return `<div class="empty"><p>${esc(t('empty'))}</p></div>`;
	return rows.map(cardHtml).join('');
}

function fill(key, vars) {
	return Object.entries(vars).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));
}

function visibleBrands() {
	const kw = state.brandQuery.trim().toLowerCase();
	const all = brands();
	return kw ? all.filter((name) => name.toLowerCase().includes(kw)) : all;
}

function brandListHtml() {
	const shown = visibleBrands();
	if (!shown.length) return `<li class="ms-empty">${esc(t('brandEmpty'))}</li>`;
	return shown
		.map(
			(name) =>
				`<li><label><input type="checkbox" value="${esc(name)}"${
					state.pickedBrands.has(name) ? ' checked' : ''
				} /> ${esc(name)}</label></li>`
		)
		.join('');
}

function syncBrandChrome() {
	const toggle = document.getElementById('brandToggle');
	const count = document.getElementById('brandCount');
	if (toggle) {
		const n = state.pickedBrands.size;
		toggle.textContent = n ? fill('brandChosen', { n }) : t('allBrands');
		toggle.classList.toggle('on', n > 0);
		toggle.setAttribute('aria-expanded', String(state.brandOpen));
	}
	if (count) {
		count.textContent = fill('brandCount', { shown: visibleBrands().length, picked: state.pickedBrands.size });
	}
}

function paintBrandList() {
	const list = document.getElementById('brandList');
	if (!list) return;
	const scroll = list.scrollTop;
	list.innerHTML = brandListHtml();
	list.scrollTop = scroll;
	syncBrandChrome();
}

function setBrandOpen(open) {
	state.brandOpen = open;
	const panel = document.getElementById('brandPanel');
	if (panel) panel.hidden = !open;
	syncBrandChrome();
	if (open) {
		const search = document.getElementById('brandSearch');
		if (search) search.focus();
	}
}

function renderCatalog() {
	const brandNames = brands();
	for (const name of [...state.pickedBrands]) {
		if (!brandNames.includes(name)) state.pickedBrands.delete(name);
	}
	const options = categories()
		.map((name) => `<option value="${esc(name)}"${name === state.category ? ' selected' : ''}>${esc(name)}</option>`)
		.join('');
	const when = formatDate(catalog.exportedAt);
	const missing = (catalog.missing || []).length
		? `<p class="note">${esc(t('missing'))}: ${esc(catalog.missing.join(', '))}</p>`
		: '';
	const count = filteredProducts().length;
	return `<div class="page">
		${headerHtml()}
		<main>
			<section class="intro">
				<p class="eyebrow">${esc(t('catalogKicker'))}</p>
				<h1 class="display-ui">${esc(t('catalogTitle'))}</h1>
				<p class="meta">
					<span>${esc(when ? `${t('exported')} ${when}` : '')}</span>
					<span>${esc(t('priceNote'))}</span>
				</p>
				${missing}
				${state.imported ? `<p class="note">${esc(t('importedNote'))}</p>` : ''}
			</section>
			<form id="filters" class="filters" role="search">
				<label class="field">${esc(t('search'))}
					<input id="q" type="search" placeholder="${esc(t('searchPlaceholder'))}" value="${esc(state.q)}" />
				</label>
				<div class="field">
					<span>${esc(t('brand'))}</span>
					<div class="multisel" id="brandSel">
						<button type="button" class="ms-btn${state.pickedBrands.size ? ' on' : ''}" id="brandToggle" data-action="brand-toggle" aria-expanded="${state.brandOpen ? 'true' : 'false'}" aria-haspopup="true">${esc(state.pickedBrands.size ? fill('brandChosen', { n: state.pickedBrands.size }) : t('allBrands'))}</button>
						<div class="ms-panel" id="brandPanel"${state.brandOpen ? '' : ' hidden'}>
							<input type="search" id="brandSearch" placeholder="${esc(t('brandSearch'))}" autocomplete="off" value="${esc(state.brandQuery)}" />
							<div class="ms-tools">
								<button type="button" class="linkbtn" data-action="brand-all">${esc(t('brandSelectShown'))}</button>
								<button type="button" class="linkbtn" data-action="brand-none">${esc(t('brandClear'))}</button>
								<span class="hint" id="brandCount">${esc(fill('brandCount', { shown: visibleBrands().length, picked: state.pickedBrands.size }))}</span>
							</div>
							<ul class="ms-list" id="brandList">${brandListHtml()}</ul>
						</div>
					</div>
				</div>
				<label class="field">${esc(t('category'))}
					<select id="cat">
						<option value="">${esc(t('allCategories'))}</option>
						${options}
					</select>
				</label>
				<label class="field">${esc(t('sort'))}
					<select id="sort">
						<option value="saved"${state.sort === 'saved' ? ' selected' : ''}>${esc(t('sortSaved'))}</option>
						<option value="rank"${state.sort === 'rank' ? ' selected' : ''}>${esc(t('sortRank'))}</option>
						<option value="price"${state.sort === 'price' ? ' selected' : ''}>${esc(t('sortPrice'))}</option>
						<option value="discount"${state.sort === 'discount' ? ' selected' : ''}>${esc(t('sortDiscount'))}</option>
						<option value="name"${state.sort === 'name' ? ' selected' : ''}>${esc(t('sortName'))}</option>
					</select>
				</label>
				<label class="field">${esc(t('order'))}
					<select id="order">
						<option value="asc"${state.order === 'asc' ? ' selected' : ''}>${esc(t('orderAsc'))}</option>
						<option value="desc"${state.order === 'desc' ? ' selected' : ''}>${esc(t('orderDesc'))}</option>
					</select>
				</label>
			</form>
			<p id="resultCount" class="count" aria-live="polite">${esc(`${count}${lang() === 'ko' ? t('countSuffix') : ' ' + t('countSuffix')}`)}</p>
			<div id="grid" class="grid">${gridHtml()}</div>
		</main>
	</div>`;
}

function articleHtml(article) {
	const entries = article && typeof article === 'object' ? Object.entries(article) : [];
	if (!entries.length) return `<p>${esc(t('noArticle'))}</p>`;
	return entries
		.map(([title, content]) => {
			const label = articleLabel(title);
			const text = String(content ?? '').trim();
			if (text.length > 180) {
				return `<details class="spec"><summary>${esc(label)}</summary><p>${esc(text)}</p></details>`;
			}
			return `<div class="spec"><h3>${esc(label)}</h3><p>${esc(text)}</p></div>`;
		})
		.join('');
}

function renderProduct(goodsNo) {
	const product = findProduct(goodsNo);
	if (!product) {
		return `<div class="page">${headerHtml()}<main><a class="back" href="#/catalog">${esc(t('back'))}</a><h1 class="display-ui">${esc(t('notFound'))}</h1></main></div>`;
	}
	const thumb = safeHttps(product.imageUrl);
	const gallery = (product.gallery || []).map(safeHttps).filter(Boolean);
	const photos = [];
	if (thumb) photos.push(thumb);
	for (const url of gallery) if (url !== thumb) photos.push(url);
	const photoHtml = photos.length
		? photos
				.map(
					(url, index) =>
						`<img src="${esc(url)}" alt="${esc(`${product.name} ${index + 1}`)}" loading="lazy" />`
				)
				.join('')
		: placeholderHtml('');
	const ranks = (product.ranks || [])
		.map((row) => `<li>${esc(row.categoryName)} ${esc(rankText(row.rank))}</li>`)
		.join('');
	return `<div class="page">
		${headerHtml()}
		<main class="detail">
			<a class="back" href="#/catalog">
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6 9 12l6 6"/></svg>
				${esc(t('back'))}
			</a>
			<div class="detail-layout">
				<div class="detail-photos">${photoHtml}</div>
				<div class="detail-copy">
					<p class="brand-line">${esc(product.brand || '')}</p>
					<h1 class="pname">${esc(product.name)}</h1>
					<p class="code">${esc(t('goodsNo'))} ${esc(product.goodsNo)}</p>
					${priceHtml(product)}
					${typeof product.discountRate === 'number' ? `<p class="code">${esc(t('sortDiscount'))} ${esc(String(product.discountRate))}%</p>` : ''}
					${flagsHtml(product.flags)}
					${ranks ? `<h2 class="subhead">${esc(t('ranks'))}</h2><ul class="ranks">${ranks}</ul>` : ''}
					${product.categoryPath ? `<p class="path">${esc(t('categoryPath'))}: ${esc(product.categoryPath)}</p>` : ''}
					<section class="article">
						<h2 class="display-ui">${esc(t('article'))}</h2>
						${articleHtml(product.article)}
					</section>
				</div>
			</div>
		</main>
	</div>`;
}

function render() {
	document.documentElement.lang = lang();
	const route = parseRoute();
	if (!isAuthed() && route.name !== 'login') {
		pendingHash = location.hash;
		location.hash = '#/login';
		return;
	}
	if (isAuthed() && route.name === 'login') {
		location.replace('#/catalog');
		return;
	}
	const app = document.getElementById('app');
	if (route.name === 'login') app.innerHTML = renderLogin();
	else if (route.name === 'product') app.innerHTML = renderProduct(route.goodsNo);
	else app.innerHTML = renderCatalog();
	document.title = `${t('appName')} · WOOSUL`;

	if (state.showLoginError && route.name === 'login') {
		const alert = document.getElementById('loginError');
		if (alert) alert.focus();
	}
}

function readFilters() {
	const q = document.getElementById('q');
	const cat = document.getElementById('cat');
	const sort = document.getElementById('sort');
	const order = document.getElementById('order');
	if (q) state.q = q.value;
	if (cat) state.category = cat.value;
	if (sort) state.sort = sort.value;
	if (order) state.order = order.value;
}

function paintGrid() {
	const grid = document.getElementById('grid');
	const count = document.getElementById('resultCount');
	if (!grid) return;
	grid.innerHTML = gridHtml();
	if (count) {
		const n = filteredProducts().length;
		count.textContent = lang() === 'ko' ? `${n}${t('countSuffix')}` : `${n} ${t('countSuffix')}`;
	}
}

function submitLogin(event) {
	event.preventDefault();
	const form = event.target;
	const id = String(new FormData(form).get('username') || '').trim();
	const password = String(new FormData(form).get('password') || '');
	state.loginId = id;
	if (id === ACCOUNT.id && password === ACCOUNT.password) {
		state.showLoginError = false;
		sessionStorage.setItem(AUTH_KEY, '1');
		const next = pendingHash && pendingHash !== '#/login' ? pendingHash : '#/catalog';
		pendingHash = '';
		if (location.hash === next) render();
		else location.hash = next;
		return;
	}
	state.showLoginError = true;
	render();
}

document.addEventListener('click', (event) => {
	const brandSel = document.getElementById('brandSel');
	const brandPanel = document.getElementById('brandPanel');
	if (brandPanel && !brandPanel.hidden && brandSel && !brandSel.contains(event.target)) setBrandOpen(false);

	const button = event.target.closest('[data-action]');
	if (!button || !document.getElementById('app').contains(button)) return;
	if (button.dataset.action === 'focus-id' || button.dataset.action === 'focus-pw') {
		event.preventDefault();
		const field = document.getElementById(button.dataset.action === 'focus-pw' ? 'loginPw' : 'loginId');
		if (field) field.focus();
		return;
	}
	if (button.dataset.action === 'lang') {
		localStorage.setItem(LANG_KEY, button.dataset.lang === 'id' ? 'id' : 'ko');
		render();
		return;
	}
	if (button.dataset.action === 'logout') {
		sessionStorage.removeItem(AUTH_KEY);
		state.showLoginError = false;
		location.hash = '#/login';
		return;
	}
	if (button.dataset.action === 'brand-toggle') {
		event.preventDefault();
		setBrandOpen(!state.brandOpen);
		return;
	}
	if (button.dataset.action === 'brand-all') {
		event.preventDefault();
		for (const name of visibleBrands()) state.pickedBrands.add(name);
		paintBrandList();
		paintGrid();
		return;
	}
	if (button.dataset.action === 'brand-none') {
		event.preventDefault();
		state.pickedBrands.clear();
		paintBrandList();
		paintGrid();
		return;
	}
	if (button.dataset.action === 'clear-import') {
		localStorage.removeItem(IMPORT_KEY);
		catalog = bundledCatalog;
		state.imported = false;
		state.importError = '';
		render();
	}
});

document.addEventListener('submit', (event) => {
	if (event.target.getAttribute('id') === 'loginForm') submitLogin(event);
	if (event.target.getAttribute('id') === 'filters') {
		event.preventDefault();
		readFilters();
		paintGrid();
	}
});

document.addEventListener('input', (event) => {
	if (event.target.id === 'brandSearch') {
		state.brandQuery = event.target.value;
		paintBrandList();
		return;
	}
	if (event.target.id !== 'q') return;
	state.q = event.target.value;
	paintGrid();
});

document.addEventListener('change', async (event) => {
	if (event.target.id === 'xlsxFile') {
		const file = event.target.files && event.target.files[0];
		if (!file) return;
		try {
			const next = await window.importPartnerXlsx(await file.arrayBuffer());
			if (!next.products.length) {
				const error = new Error('empty');
				error.code = 'empty';
				throw error;
			}
			catalog = next;
			state.imported = true;
			state.importError = '';
			try {
				localStorage.setItem(IMPORT_KEY, JSON.stringify(catalog));
			} catch {
				state.importError = t('importFail');
			}
			if (location.hash.startsWith('#/product/')) location.hash = '#/catalog';
			else render();
		} catch (error) {
			const code = error && error.code;
			state.importError = code === 'no-code' ? t('importNoCode') : code === 'empty' ? t('importEmpty') : t('importFail');
			render();
		}
		return;
	}
	if (event.target.matches('#brandList input[type="checkbox"]')) {
		const name = event.target.value;
		if (event.target.checked) state.pickedBrands.add(name);
		else state.pickedBrands.delete(name);
		syncBrandChrome();
		paintGrid();
		return;
	}
	if (!['cat', 'sort', 'order'].includes(event.target.id)) return;
	readFilters();
	paintGrid();
});

document.addEventListener(
	'error',
	(event) => {
		const img = event.target;
		if (!(img instanceof HTMLImageElement) || !img.closest('#app')) return;
		const extra = img.classList.contains('hero-img') ? 'hero' : '';
		img.replaceWith(document.createRange().createContextualFragment(placeholderHtml(extra)).firstChild);
	},
	true
);

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && state.brandOpen) setBrandOpen(false);
});

window.addEventListener('hashchange', () => render());

if (!location.hash) location.replace(isAuthed() ? '#/catalog' : '#/login');
else render();
