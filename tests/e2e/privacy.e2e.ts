import { expect, test } from '@playwright/test';
import { open } from './helpers';

// 驗收：純前端、不接後端、全站沒有任何真實資料。
// 這裡看瀏覽器實際發出的請求：只能向網站自己的來源拿靜態檔案，資料只存在 localStorage。

const PAGES = ['/dashboard', '/team', '/projects', '/governance', '/systems', '/collab', '/rbac', '/about'];

test('走過每一頁，瀏覽器只向網站本身拿靜態檔案', async ({ page, baseURL }) => {
  test.slow(); // 每一頁都要等延後載入的程式載完
  const origin = new URL(baseURL ?? 'http://localhost/').origin;
  const requests: { url: string; method: string; type: string }[] = [];
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method(), type: request.resourceType() }));

  for (const hash of PAGES) {
    await open(page, hash);
    // 圖表、流程圖、3D 場景的程式是進到頁面後才載入的，等它們都載完
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
  }

  const http = requests.filter((r) => /^https?:/.test(r.url));
  expect(http.length).toBeGreaterThan(5);
  expect(http.filter((r) => new URL(r.url).origin !== origin).map((r) => r.url)).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.url}`)).toEqual([]);
  expect(requests.filter((r) => ['xhr', 'fetch', 'websocket', 'eventsource', 'ping'].includes(r.type)).map((r) => `${r.type} ${r.url}`)).toEqual([]);

  const stored = await page.evaluate(() => ({ cookie: document.cookie, keys: Object.keys(localStorage), session: sessionStorage.length }));
  expect(stored.cookie).toBe('');
  expect(stored.session).toBe(0);
  expect(stored.keys.length).toBeGreaterThan(0);
  expect(stored.keys.filter((key) => !key.startsWith('esrd:'))).toEqual([]);
});
