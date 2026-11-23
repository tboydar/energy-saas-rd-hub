import { describe, expect, test } from 'bun:test';
import { Glob } from 'bun';
import { collectNames } from '../../scripts/mock-names';
import { buildInitialState } from '../../src/mock';

// 驗收：全站沒有任何真實公司、客戶或個人資料。
// 站上的每一筆資料都寫在 src/mock/ 裡，這裡確認它沒有別的來源，也送不出去。

const SRC = new URL('../../src/', import.meta.url).pathname;

async function sourceFiles(): Promise<{ path: string; text: string }[]> {
  const files: { path: string; text: string }[] = [];
  for await (const path of new Glob('**/*.{ts,tsx,css}').scan({ cwd: SRC })) files.push({ path, text: await Bun.file(SRC + path).text() });
  return files;
}

// 最後一次用 `bun run check:names` 查核過的名稱。
// 假資料新增或改了名稱，這個測試就會失敗：先跑 check:names，確認沒有同名，再更新這份清單。
const CHECKED_NAMES = {
  orgsZh: ['晴樾能源', '朔風電廠', '霧島儲能', '星嶼微電網', '鯨落風場'],
  orgsEn: ['Fairglow Energy', 'Northgale Power Plant', 'Mist Isle Storage', 'Starreef Microgrid', 'Whalefall Wind Farm'],
  peopleZh: ['沈予安', '柯景澄', '駱以晴', '藍書緯', '紀語彤', '游承翰', '阮心妍', '石柏宇', '黎若衡', '溫芷寧'],
  peopleEn: ['Yu-An Shen', 'Ching-Cheng Ko', 'Yi-Ching Luo', 'Shu-Wei Lan', 'Yu-Tung Chi', 'Cheng-Han You', 'Hsin-Yen Juan', 'Po-Yu Shih', 'Jo-Heng Li', 'Chih-Ning Wen'],
};

describe('資料來源', () => {
  test('假資料裡的組織名與人名，就是查核過的那一批', () => {
    expect(collectNames()).toEqual(CHECKED_NAMES);
  });

  test('招募候選人只有代號，沒有姓名', () => {
    for (const candidate of buildInitialState().candidates) {
      expect(candidate.alias.zh).toMatch(/^候選人 [A-Z]$/);
      expect(candidate.alias.en).toMatch(/^Candidate [A-Z]$/);
    }
  });

  test('網站的程式沒有任何網址，沒有地方可以載入或送出資料', async () => {
    const files = await sourceFiles();
    expect(files.length).toBeGreaterThan(40);
    expect(files.filter((f) => /https?:\/\//.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  test('網站的程式不使用連線、Cookie 或定位的 API', async () => {
    const banned = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|document\.cookie|indexedDB|navigator\.geolocation/;
    expect((await sourceFiles()).filter((f) => banned.test(f.text)).map((f) => f.path)).toEqual([]);
  });
});
