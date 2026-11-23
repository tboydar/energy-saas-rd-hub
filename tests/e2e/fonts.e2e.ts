import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

// 介面用的是系統字型（system-ui 等），每個作業系統實際畫出來的字型不同。
// 這個測試確認中文與英文都有真的字可用（不是缺字方框），並記下實際用到的字型。
// 設定 FONT_REPORT_DIR 時，字型清單與截圖會另外存到那個資料夾。Windows 檢查的流程會把它上傳。

const REPORT_DIR = process.env.FONT_REPORT_DIR;

/** 用頁面的字型畫兩個不同的字。畫出來一模一樣或一片空白，就代表是缺字方框。 */
function glyphsDiffer(page: Page, a: string, b: string): Promise<boolean> {
  return page.evaluate(([first, second]) => {
    const family = getComputedStyle(document.body).fontFamily;
    const draw = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const context = canvas.getContext('2d');
      if (!context) return '';
      if (text) {
        context.font = `32px ${family}`;
        context.textBaseline = 'top';
        context.fillText(text, 4, 4);
      }
      return canvas.toDataURL();
    };
    const [one, two] = [draw(first), draw(second)];
    return one !== two && one !== draw('');
  }, [a, b]);
}

/** 用 DevTools 協定問瀏覽器：畫面上的文字實際是用哪些字型畫的（字型名稱 → 字數）。 */
async function renderedFonts(page: Page): Promise<Record<string, number>> {
  await page.evaluate(() => {
    let index = 0;
    for (const element of document.querySelectorAll('#app *')) {
      const hasText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '');
      if (hasText && index < 400) element.setAttribute('data-font-probe', String(index++));
    }
  });
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('DOM.enable');
  await devtools.send('CSS.enable');
  const { root } = await devtools.send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await devtools.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-font-probe]' });
  const totals: Record<string, number> = {};
  for (const nodeId of nodeIds) {
    const { fonts } = await devtools.send('CSS.getPlatformFontsForNode', { nodeId });
    for (const font of fonts) totals[font.familyName] = (totals[font.familyName] ?? 0) + font.glyphCount;
  }
  await devtools.detach();
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('[data-font-probe]')) element.removeAttribute('data-font-probe');
  });
  return Object.fromEntries(Object.entries(totals).sort((p, q) => q[1] - p[1]));
}

test('中文與英文都用實際的字型畫出來，沒有缺字方框', async ({ page }, testInfo) => {
  await open(page, '/team');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  expect(await glyphsDiffer(page, '研', '發')).toBe(true);
  expect(await glyphsDiffer(page, '晴', '樾')).toBe(true);
  expect(await glyphsDiffer(page, 'R', 'D')).toBe(true);
  const zh = await renderedFonts(page);
  expect(Object.keys(zh).length).toBeGreaterThan(0);
  if (REPORT_DIR) {
    mkdirSync(REPORT_DIR, { recursive: true });
    await page.screenshot({ path: join(REPORT_DIR, 'team-zh.png') });
  }

  await page.click('[data-lang="en"]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#view h1')).toBeVisible();
  const en = await renderedFonts(page);
  expect(Object.keys(en).length).toBeGreaterThan(0);

  const report = {
    platform: process.platform,
    userAgent: await page.evaluate(() => navigator.userAgent),
    fontFamily: await page.evaluate(() => getComputedStyle(document.body).fontFamily),
    zh,
    en,
  };
  await testInfo.attach('fonts.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  if (REPORT_DIR) {
    writeFileSync(join(REPORT_DIR, 'fonts.json'), JSON.stringify(report, null, 2));
    await page.screenshot({ path: join(REPORT_DIR, 'team-en.png') });
  }
});
