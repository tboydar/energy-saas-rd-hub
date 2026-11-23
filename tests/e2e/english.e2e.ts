import { expect, test, type Page } from '@playwright/test';
import { open, signInAs } from './helpers';

// 驗收：介面可切換英文。
// 英文模式下走過每一頁、每個分頁，畫面上不該有中文字或全形標點（語言切換鈕上的「中文」除外）。

const PAGES = ['/dashboard', '/team', '/projects', '/governance', '/systems', '/collab', '/rbac', '/about'];

/** 找出畫面上含有中文字或全形標點的文字與屬性。 */
function leftovers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cjk = /[\u3000-\u303F\u30FB\u3400-\u9FFF\uFF00-\uFFEF]/;
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest('[data-lang], script, style, noscript')) continue;
      const text = node.textContent ?? '';
      if (cjk.test(text)) found.add(text.trim().slice(0, 60));
    }
    for (const element of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
      for (const name of ['title', 'aria-label', 'placeholder']) {
        const value = element.getAttribute(name);
        if (value && cjk.test(value)) found.add(`${name}="${value.slice(0, 50)}"`);
      }
    }
    if (cjk.test(document.title)) found.add(`title: ${document.title}`);
    return [...found];
  });
}

async function scanPages(page: Page, pages: string[]): Promise<string[]> {
  const problems: string[] = [];
  for (const hash of pages) {
    await open(page, hash);
    const tabs = page.locator('#view [role="tab"]');
    const count = await tabs.count();
    for (let i = 0; i < Math.max(count, 1); i++) {
      if (count) await tabs.nth(i).click();
      // 圖表與流程圖是進到頁面後才載入的
      await page.waitForTimeout(300);
      await page.waitForLoadState('networkidle');
      for (const text of await leftovers(page)) problems.push(`${hash}${count ? ` 第 ${i + 1} 個分頁` : ''}：${text}`);
    }
  }
  return problems;
}

test('英文介面的每一頁、每個分頁都沒有殘留的中文或全形標點', async ({ page }) => {
  test.slow(); // 要走過二十幾個畫面
  await open(page, '/about');
  await page.click('[data-lang="en"]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await scanPages(page, PAGES)).toEqual([]);

  // 權限矩陣只有管理員看得到完整內容
  await signInAs(page, 'admin');
  expect(await scanPages(page, ['/rbac', '/team'])).toEqual([]);
});
