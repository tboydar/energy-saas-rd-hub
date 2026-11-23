import { expect, test } from '@playwright/test';
import { open } from './helpers';

// 版號：v<台灣日期>.<當天第幾次 CI>。本機建置是 .dev；查不到當天序號時是 .r<執行編號>。
const VERSION = /^v\d{8}\.(\d+|r\d+|dev)$/;

test('側欄、關於頁與 index.html 顯示同一個版號', async ({ page }) => {
  await open(page, '/about');
  const shown = (await page.locator('#app-version').innerText()).trim();
  expect(shown).toMatch(VERSION);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', shown);
  await expect(page.locator('#about-version')).toContainText(shown);

  const commit = await page.locator('meta[name="app-commit"]').getAttribute('content');
  expect(commit).toMatch(/^[0-9a-f]{7}$/);
  await expect(page.locator('#about-version')).toContainText(commit!);
});
