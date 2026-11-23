import { expect, test } from '@playwright/test';
import { open, signInAs } from './helpers';

// 驗收：PM／CS 提需求 → 研發評估後轉成工程任務；一鍵產生週報。

test('PM 提出需求，研發主管把它轉成工程任務', async ({ page }) => {
  await open(page, '/collab');
  await signInAs(page, 'pmcs');
  await page.fill('#rq-title', 'E2E：匯出逆變器告警清單');
  await page.fill('#rq-desc', '客戶想每週拿到告警清單。');
  await page.click('[data-act="submit"]');
  await expect(page.locator('#toast')).toContainText('已送出 REQ-035');
  const card = page.locator('[data-card="REQ-035"]');
  await expect(card).toContainText('E2E：匯出逆變器告警清單');
  // PM 不能評估或轉任務
  await expect(card.locator('[data-act="convert"]')).toHaveAttribute('aria-disabled', 'true');

  await signInAs(page, 'manager');
  await page.locator('[data-card="REQ-035"] [data-act="convert"]').click();
  await expect(page.locator('#toast')).toContainText('REQ-035 已轉成任務 T-701');
  await page.locator('[data-card="REQ-035"]').getByRole('link', { name: /T-701/ }).click();
  await expect(page).toHaveURL(/#\/projects\?tab=kanban&task=T-701/);
  await expect(page.locator('dialog.modal')).toContainText('E2E：匯出逆變器告警清單');
});

test('一鍵產生週報；資料變了，週報跟著變', async ({ page }) => {
  await open(page, '/collab');
  await page.click('[data-act="generate"]');
  const report = page.locator('#report');
  await expect(report).toContainText('# 研發週報');
  await expect(report).toContainText('Sprint 24 完成 29／94 點');
  await expect(report).toContainText('游承翰 負載 138%');
  await expect(report).toContainText('本週沒有進行中的線上事件');

  // 到別頁觸發事件，再回來重新產生
  await page.goto('#/systems');
  await page.click('[data-act="simulate"]');
  await expect(page.locator('.hazard')).toBeVisible();
  await page.goto('#/collab');
  await page.click('[data-act="generate"]');
  await expect(page.locator('#report')).toContainText('有一起線上事件處理中');
  await expect(page.locator('#report')).toContainText('尚未恢復');
});
