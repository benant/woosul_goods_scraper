// 찜 Excel(partner 열)을 협력사 카탈로그 데이터로 읽는다.
// 우리 writer 의 inlineStr 과, 엑셀이 다시 저장한 shared string 을 모두 받는다.
(function () {
	const ARTICLE_HEADERS = ['사용방법', '제조국', '제조업자', '용량', '사용기한', '전성분', '사용시 주의사항'];

	function fail(code) {
		const error = new Error(code);
		error.code = code;
		throw error;
	}

	function toBytes(input) {
		if (input instanceof ArrayBuffer) return new Uint8Array(input);
		if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
		return new Uint8Array(input);
	}

	function decodeXml(value) {
		return String(value)
			.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
			.replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&amp;/g, '&');
	}

	async function inflateRaw(bytes) {
		const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	}

	async function unzip(bytes) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		let eocd = -1;
		const min = Math.max(0, bytes.length - 22 - 65535);
		for (let i = bytes.length - 22; i >= min; i--) {
			if (view.getUint32(i, true) === 0x06054b50) {
				eocd = i;
				break;
			}
		}
		if (eocd < 0) fail('bad-file');
		const count = view.getUint16(eocd + 10, true);
		let offset = view.getUint32(eocd + 16, true);
		const files = new Map();
		for (let n = 0; n < count; n++) {
			if (view.getUint32(offset, true) !== 0x02014b50) fail('bad-file');
			const method = view.getUint16(offset + 10, true);
			const compSize = view.getUint32(offset + 20, true);
			const nameLen = view.getUint16(offset + 28, true);
			const extraLen = view.getUint16(offset + 30, true);
			const commentLen = view.getUint16(offset + 32, true);
			const localOffset = view.getUint32(offset + 42, true);
			const name = new TextDecoder('utf-8').decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
			const localNameLen = view.getUint16(localOffset + 26, true);
			const localExtraLen = view.getUint16(localOffset + 28, true);
			const dataStart = localOffset + 30 + localNameLen + localExtraLen;
			const comp = bytes.subarray(dataStart, dataStart + compSize);
			let data = comp;
			if (method === 8) data = await inflateRaw(comp);
			else if (method !== 0) fail('bad-file');
			files.set(name.replace(/\\/g, '/'), data);
			offset += 46 + nameLen + extraLen + commentLen;
		}
		return files;
	}

	function textOf(files, name) {
		const data = files.get(name);
		return data ? new TextDecoder('utf-8').decode(data) : '';
	}

	function blocks(xml, tag) {
		const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b([^>]*)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>)`, 'g');
		const out = [];
		let match;
		while ((match = re.exec(xml))) out.push({ attrs: match[1] || '', inner: match[2] || '' });
		return out;
	}

	function attr(attrs, name) {
		const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
		return match ? match[1] : '';
	}

	function texts(xml) {
		return blocks(xml, 't').map((part) => decodeXml(part.inner)).join('');
	}

	function sharedStrings(xml) {
		if (!xml) return [];
		return blocks(xml, 'si').map((part) => texts(part.inner));
	}

	function colIndex(letters) {
		let n = 0;
		for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
		return n - 1;
	}

	function sheetObjects(xml, strings) {
		const rows = blocks(xml, 'row').map((row) => {
			const cells = {};
			for (const cell of blocks(row.inner, 'c')) {
				const ref = attr(cell.attrs, 'r');
				const letters = (ref.match(/^[A-Z]+/) || [])[0];
				if (!letters) continue;
				const type = attr(cell.attrs, 't');
				let value = '';
				if (type === 'inlineStr') value = texts(cell.inner);
				else if (type === 's') value = strings[Number(texts(cell.inner) || (cell.inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || 0)] || '';
				else if (type === 'str') value = decodeXml((cell.inner.match(/<(?:[\w-]+:)?v>([\s\S]*?)<\/(?:[\w-]+:)?v>/) || [])[1] || '');
				else value = (cell.inner.match(/<(?:[\w-]+:)?v>([\s\S]*?)<\/(?:[\w-]+:)?v>/) || [])[1] || '';
				cells[letters] = value;
			}
			return cells;
		});
		if (!rows.length) return [];
		const headers = [];
		for (const [letters, value] of Object.entries(rows[0])) headers[colIndex(letters)] = String(value).trim();
		const objects = [];
		for (const cells of rows.slice(1)) {
			const obj = {};
			let any = false;
			for (const [letters, value] of Object.entries(cells)) {
				const header = headers[colIndex(letters)];
				if (!header) continue;
				obj[header] = value;
				if (String(value).trim()) any = true;
			}
			if (any) objects.push(obj);
		}
		return objects;
	}

	function firstSheet(files) {
		const rels = textOf(files, 'xl/_rels/workbook.xml.rels');
		const match = rels.match(/Target="(?:\/xl\/)?(worksheets\/[^"]+\.xml)"/);
		const path = match ? `xl/${match[1]}` : 'xl/worksheets/sheet1.xml';
		const xml = textOf(files, path);
		if (!xml) fail('bad-file');
		return xml;
	}

	function num(value) {
		if (value === null || value === undefined || String(value).trim() === '') return null;
		const n = Number(String(value).replace(/,/g, '').replace(/%/g, ''));
		return Number.isFinite(n) ? n : null;
	}

	function parseArticleText(value) {
		const article = {};
		for (const block of String(value || '').split(/\n\s*\n/)) {
			const lines = block.split('\n');
			const title = (lines.shift() || '').trim();
			const content = lines.join('\n').trim();
			if (title && content) article[title] = content;
		}
		return article;
	}

	function httpsUrls(value) {
		return String(value || '')
			.split(/[\s,]+/)
			.map((item) => item.trim())
			.filter((item) => item.startsWith('https://'));
	}

	function rowsToCatalog(objects) {
		if (!objects.some((row) => '상품코드' in row)) fail('no-code');
		const order = [];
		const map = new Map();
		for (const row of objects) {
			const goodsNo = String(row['상품코드'] || '').trim();
			if (!goodsNo) continue;
			if (!map.has(goodsNo)) {
				const article = parseArticleText(row['정보고시']);
				if (!Object.keys(article).length) {
					for (const header of ARTICLE_HEADERS) {
						const content = String(row[header] || '').trim();
						if (content) article[header] = content;
					}
				}
				map.set(goodsNo, {
					goodsNo,
					name: String(row['상품명'] || '').trim(),
					brand: String(row['브랜드'] || '').trim(),
					categoryPath: String(row['상품카테고리'] || '').trim(),
					normalPrice: num(row['정가']),
					salePrice: num(row['판매가']),
					effectivePrice: num(row['실제가격']),
					discountRate: num(row['할인율(%)']),
					flags: String(row['배지'] || '')
						.split(',')
						.map((item) => item.trim())
						.filter(Boolean),
					imageUrl: String(row['대표이미지'] || row['이미지'] || '').trim(),
					detailUrl: String(row['상세URL'] || '').trim(),
					gallery: httpsUrls(row['상세이미지']),
					article,
					ranks: []
				});
				order.push(goodsNo);
			}
			const product = map.get(goodsNo);
			const categoryName = String(row['카테고리'] || '').trim();
			const rank = num(row['순위']);
			if (categoryName || rank !== null) {
				const next = { categoryName, rank, rankingType: String(row['랭킹유형'] || '').trim() || null };
				const index = product.ranks.findIndex((item) => item.categoryName === categoryName);
				if (index === -1) product.ranks.push(next);
				else if (rank !== null && (product.ranks[index].rank === null || rank < product.ranks[index].rank)) product.ranks[index] = next;
			}
			for (const url of httpsUrls(row['상세이미지'])) {
				if (!product.gallery.includes(url)) product.gallery.push(url);
			}
			if (!product.imageUrl) product.imageUrl = String(row['대표이미지'] || row['이미지'] || '').trim();
		}
		const products = order.map((goodsNo) => {
			const product = map.get(goodsNo);
			if (typeof product.effectivePrice !== 'number') product.effectivePrice = product.salePrice ?? product.normalPrice;
			return product;
		});
		return { exportedAt: new Date().toISOString(), sourceGeneratedAt: null, products, missing: [] };
	}

	window.importPartnerXlsx = async function (input) {
		const files = await unzip(toBytes(input));
		const strings = sharedStrings(textOf(files, 'xl/sharedStrings.xml'));
		return rowsToCatalog(sheetObjects(firstSheet(files), strings));
	};
})();
