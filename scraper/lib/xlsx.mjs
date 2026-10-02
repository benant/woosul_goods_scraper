// 최소 xlsx(XLSX = OOXML Spreadsheet) writer. 외부 의존성 없음 (node:zlib 만 사용).
//
// 사용법:
//   const buf = buildXlsx([{ name: '랭킹', columns: [...], rows: [...] }]);
//
// - 문자열은 inlineStr 로 넣어 "=SUM()" 같은 문자열이 수식으로 해석되는 걸 막는다.
// - 숫자는 <v> 로 넣어 엑셀에서 실제 숫자 타입이 되게 한다.
// - type:'url' 컬럼은 셀 값 위에 클릭 가능한 하이퍼링크(http/https 만)를 얹는다.

import zlib from 'node:zlib';

// ------------------------------------------------------------------ CRC32

const CRC_TABLE = (() => {
	const t = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c;
	}
	return t;
})();

function crc32(buf) {
	let c = -1;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

// ------------------------------------------------------------------ ZIP

function zip(files) {
	const now = new Date();
	const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
	const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

	const locals = [];
	const centrals = [];
	let offset = 0;

	for (const f of files) {
		const nameBuf = Buffer.from(f.name, 'utf8');
		const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
		const deflated = zlib.deflateRawSync(raw, { level: 9 });
		// 압축이 오히려 커지면 (이미 압축된 데이터 등) store 로 되돌린다.
		const useDeflate = deflated.length < raw.length;
		const body = useDeflate ? deflated : raw;
		const method = useDeflate ? 8 : 0;
		const crc = crc32(raw);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4); // version needed
		local.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
		local.writeUInt16LE(method, 8);
		local.writeUInt16LE(dosTime, 10);
		local.writeUInt16LE(dosDate, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		local.writeUInt16LE(0, 28);
		locals.push(local, nameBuf, body);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4); // version made by
		central.writeUInt16LE(20, 6); // version needed
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(method, 10);
		central.writeUInt16LE(dosTime, 12);
		central.writeUInt16LE(dosDate, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(body.length, 20);
		central.writeUInt32LE(raw.length, 24);
		central.writeUInt16LE(nameBuf.length, 28);
		central.writeUInt16LE(0, 30); // extra
		central.writeUInt16LE(0, 32); // comment
		central.writeUInt16LE(0, 34); // disk start
		central.writeUInt16LE(0, 36); // internal attrs
		central.writeUInt32LE(0, 38); // external attrs
		central.writeUInt32LE(offset, 42);
		centrals.push(central, nameBuf);

		offset += local.length + nameBuf.length + body.length;
	}

	const centralBuf = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(0, 4);
	eocd.writeUInt16LE(0, 6);
	eocd.writeUInt16LE(files.length, 8);
	eocd.writeUInt16LE(files.length, 10);
	eocd.writeUInt32LE(centralBuf.length, 12);
	eocd.writeUInt32LE(offset, 16);
	eocd.writeUInt16LE(0, 20);

	return Buffer.concat([...locals, centralBuf, eocd]);
}

// ------------------------------------------------------------------ XML

function esc(v) {
	return String(v)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		// XML에서 허용되지 않는 제어문자 제거
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// 엑셀 열 이름: 0 -> A, 25 -> Z, 26 -> AA
function colName(index) {
	let n = index + 1;
	let s = '';
	while (n > 0) {
		const m = (n - 1) % 26;
		s = String.fromCharCode(65 + m) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

const safeSheetName = (name, i) => {
	const clean = String(name || `Sheet${i + 1}`).replace(/[\\/*?:[\]]/g, '').trim();
	return (clean || `Sheet${i + 1}`).slice(0, 31);
};

// 셀 스타일 인덱스 (styles.xml 의 cellXfs 순서와 일치해야 한다)
const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_INT = 2; // #,##0
const STYLE_DEC = 3; // 0.00
const STYLE_URL = 4; // 링크(파란 글자 + 밑줄)

function styleFor(type) {
	if (type === 'int' || type === 'number') return STYLE_INT;
	if (type === 'decimal') return STYLE_DEC;
	if (type === 'url') return STYLE_URL;
	return STYLE_DEFAULT;
}

function cellXml(ref, value, type, style) {
	if (value === null || value === undefined || value === '') {
		return style ? `<c r="${ref}" s="${style}"/>` : '';
	}
	if (type === 'int' || type === 'number' || type === 'decimal') {
		const n = Number(value);
		if (!Number.isFinite(n)) return '';
		return `<c r="${ref}" s="${style}"><v>${n}</v></c>`;
	}
	return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml(sheet) {
	const cols = sheet.columns || [];
	const rows = sheet.rows || [];

	const colsXml = cols.length
		? `<cols>${cols
				.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 12}" customWidth="1"/>`)
				.join('')}</cols>`
		: '';

	// 헤더 (freeze)
	const headerCells = cols
		.map((c, i) => cellXml(`${colName(i)}1`, c.header, 'string', STYLE_HEADER))
		.join('');
	const header = `<row r="1" ht="20" customHeight="1">${headerCells}</row>`;

	// type:'url' 컬럼의 셀에는 하이퍼링크를 얹는다 — 셀 텍스트는 그대로 두고 링크만 추가.
	// r:id 는 시트마다 새로 매기고, 대응하는 관계는 worksheet rels 에 기록한다.
	const hyperlinks = [];
	const linkRels = [];

	const body = rows
		.map((row, r) => {
			const cells = cols
				.map((c, i) => {
					const ref = `${colName(i)}${r + 2}`;
					const v = row[c.key];
					const url = typeof v === 'string' ? v.trim() : '';
					if (c.type === 'url' && /^https?:\/\//i.test(url)) {
						const rid = `rIdH${linkRels.length + 1}`;
						linkRels.push({ id: rid, target: url });
						hyperlinks.push(`<hyperlink ref="${ref}" r:id="${rid}"/>`);
					}
					return cellXml(ref, v, c.type, styleFor(c.type));
				})
				.join('');
			return `<row r="${r + 2}">${cells}</row>`;
		})
		.join('');

	const lastRef = `${colName(Math.max(cols.length - 1, 0))}${rows.length + 1}`;

	// hyperlinks 는 스키마 순서상 autoFilter 뒤에 와야 한다
	const hyperlinksXml = hyperlinks.length ? `<hyperlinks>${hyperlinks.join('')}</hyperlinks>` : '';

	const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${colsXml}<dimension ref="A1:${lastRef}"/><sheetData>${header}${body}</sheetData><autoFilter ref="A1:${lastRef}"/>${hyperlinksXml}</worksheet>`;

	return { xml, rels: linkRels };
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

/**
 * @param {{name:string, columns:{key:string,header:string,width?:number,type?:string}[], rows:object[]}[]} sheets
 * @returns {Buffer}
 */
export function buildXlsx(sheets) {
	const list = sheets.length ? sheets : [{ name: 'Sheet1', columns: [], rows: [] }];

	const overrides = list
		.map(
			(_, i) =>
				`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
		)
		.join('');

	const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`;

	const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

	const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list
		.map((s, i) => `<sheet name="${esc(safeSheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
		.join('')}</sheets></workbook>`;

	const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list
		.map(
			(_, i) =>
				`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
		)
		.join('')}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

	const files = [
		{ name: '[Content_Types].xml', data: contentTypes },
		{ name: '_rels/.rels', data: rels },
		{ name: 'xl/workbook.xml', data: workbook },
		{ name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
		{ name: 'xl/styles.xml', data: STYLES_XML },
		// 시트에 하이퍼링크가 있으면 워크시트용 관계 파일(xl/worksheets/_rels/sheetN.xml.rels)도
		// 함께 넣는다. Content_Types 의 Default rels 선언이 이미 커버하므로 Override 는 불필요.
		...list.flatMap((s, i) => {
			const { xml, rels: linkRels } = sheetXml(s);
			const out = [{ name: `xl/worksheets/sheet${i + 1}.xml`, data: xml }];
			if (linkRels.length) {
				out.push({
					name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
					data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${linkRels
	.map(
		(r) =>
			`<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(r.target)}" TargetMode="External"/>`
	)
	.join('')}</Relationships>`
				});
			}
			return out;
		})
	];

	return zip(files);
}
