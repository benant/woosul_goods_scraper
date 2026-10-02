// 스크레이퍼가 사용하는 경로 상수
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, '..', 'oliveyoung_ranking_doms');
export const URL_JSON = path.join(DATA_DIR, 'oliveyoung_ranking.json');
export const ITEMS_JSON = path.join(DATA_DIR, 'oliveyoung_ranking_items.json');
// 상품 이미지 로컬 저장 폴더 (DATA_DIR/images/<goodsNo>/...)
export const IMAGE_DIR = path.join(DATA_DIR, 'images');
// JSON 에 기록되는 상대경로 접두사. 대시보드는 이 경로를 /images/ 로 서빙한다.
export const IMAGE_REL = 'images';
// 수집 작업 상태(Job) 체크포인트. 서버를 껐다 켜도 진행 상황을 잃지 않게 남긴다.
export const JOB_JSON = path.join(DATA_DIR, 'collection_job.json');
// 찜(카트 담아두기) 목록. goodsNo 배열을 JSON 으로 저장한다.
export const FAV_JSON = path.join(DATA_DIR, 'favorites.json');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const START_PAGE = 'https://www.oliveyoung.co.kr/store/main/main.do';
