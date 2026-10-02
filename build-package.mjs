// 다른 PC에 전달할 실행 패키지(zip)를 만든다.
//
//   node build-package.mjs
//
// 산출물: ../dist/올리브영_랭킹_수집기/                        (압축 전 폴더)
//         ../dist/올리브영_랭킹_수집기_YYYYMMDD-HHmm.zip      (날짜시간 버전이 붙은 배포본)
//
// 덮어쓰지 않아도 어느 버전인지 구분되도록 zip 이름에만 빌드 시각을 붙인다.
// (압축을 푼 폴더 이름은 고정이라 사용법/상대경로가 그대로 동작한다)
//
// 폴더 구조는 저장소와 동일하게 유지한다. 코드가 ../oliveyoung_ranking_doms 를
// 상대경로로 참조하므로, 실행 가능한 구조를 그대로 옮겨야 한다.
// node_modules 도 함께 담아 수신자가 npm install 을 하지 않아도 되게 한다.
// (스크립트 의존성은 playwright 뿐이고, 브라우저는 시스템 Chrome 을 쓴다.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = __dirname;
// 산출물은 이 저장소의 dist\ 아래에 만든다 (상위 폴더에 새지 않도록)
const DIST_ROOT = path.join(SRC, 'dist');
const PKG_NAME = '올리브영_랭킹_수집기';
const OUT_DIR = path.join(DIST_ROOT, PKG_NAME);

// 빌드 시각 (예: 20260928-1930) — 배포본 zip 이름에만 붙인다
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const VERSION = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const zipName = `${PKG_NAME}_${VERSION}.zip`;

// images\ 는 수집을 다시 하면 다시 채워지므로 zip 에 넣지 않는다 (용량만 커진다)
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', '_out', 'images']);
const EXCLUDE_FILES = new Set(['server.log', '.DS_Store']);

// node_modules 는 제외하지 않는다 (수신자가 npm install 하지 않도록)
const KEEP_DIRS = new Set(['node_modules']);

function copyDir(from, to) {
	fs.mkdirSync(to, { recursive: true });
	for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
		const src = path.join(from, entry.name);
		const dst = path.join(to, entry.name);

		if (entry.isDirectory()) {
			if (EXCLUDE_DIRS.has(entry.name) && !KEEP_DIRS.has(entry.name)) continue;
			copyDir(src, dst);
		} else {
			if (EXCLUDE_FILES.has(entry.name)) continue;
			fs.copyFileSync(src, dst);
		}
	}
}

function dirSize(dir) {
	let total = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		total += entry.isDirectory() ? dirSize(p) : fs.statSync(p).size;
	}
	return total;
}

function countFiles(dir) {
	let n = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		n += entry.isDirectory() ? countFiles(p) : 1;
	}
	return n;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

// ---------------------------------------------------------------- build

fs.rmSync(DIST_ROOT, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// 프로그램 (scraper/) — node_modules 포함
copyDir(path.join(SRC, 'scraper'), path.join(OUT_DIR, 'goods_summary', 'scraper'));

// 데이터 (oliveyoung_ranking_doms/)
copyDir(path.join(SRC, 'oliveyoung_ranking_doms'), path.join(OUT_DIR, 'goods_summary', 'oliveyoung_ranking_doms'));

// 문서
fs.copyFileSync(path.join(SRC, 'README.md'), path.join(OUT_DIR, 'goods_summary', 'README.md'));

// 실행 템플릿
// - 시작하기.bat : 순수 ASCII 그대로 (BOM 절대 넣지 않는다. BOM 넣으면 cmd.exe 가
//                  첫 줄을 깨뜨려 '@echo off' 인식을 실패한다)
// - 사용법.txt   : UTF-8 BOM (메모장에서 한글 정상 표시)
for (const f of ['시작하기.bat', '사용법.txt']) {
	const src = path.join(SRC, 'dist-template', f);
	const dst = path.join(OUT_DIR, f);
	const body = fs.readFileSync(src);
	if (f.endsWith('.bat')) {
		for (let i = 0; i < body.length; i++) {
			if (body[i] > 0x7f) throw new Error(`${f} 에 ASCII 범위 밖 바이트가 있습니다 (offset ${i}). cmd.exe 가 파싱 실패합니다.`);
		}
		fs.writeFileSync(dst, body);
	} else {
		const hasBom = body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf;
		fs.writeFileSync(dst, hasBom ? body : Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]));
	}
}

// ---------------------------------------------------------------- zip

const zipPath = path.join(DIST_ROOT, zipName);
fs.rmSync(zipPath, { force: true });

// Compress-Archive: UTF-8 파일명 지원, 실제 deflate 압축
execFileSync(
	'powershell',
	['-NoProfile', '-Command', `Compress-Archive -Path '${OUT_DIR}\\*' -DestinationPath '${zipPath}' -Force`],
	{ stdio: 'inherit' }
);

console.log('패키지 생성 완료');
console.log('  버전 :', VERSION);
console.log('  폴더 :', OUT_DIR);
console.log(`  크기 : ${mb(dirSize(OUT_DIR))} (파일 ${countFiles(OUT_DIR)}개)`);
console.log('  zip  :', zipPath, `(${mb(fs.statSync(zipPath).size)})`);
