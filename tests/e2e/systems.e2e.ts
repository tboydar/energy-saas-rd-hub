import { expect, test } from '@playwright/test';
import { open } from './helpers';

// 驗收：模擬一次線上事件（觸發 → 指派 → 處理 → 恢復 → 事後檢討），以及 z-score 異常偵測。

test('事件從觸發走到結案，事後檢討自動帶入內容', async ({ page }) => {
  await open(page, '/systems');
  await expect(page.locator('#page-sum')).toContainText('目前沒有線上事件');

  await page.click('[data-act="simulate"]');
  // 事件進行中：頂欄出現警示斜紋與事件列
  await expect(page.locator('.hazard')).toBeVisible();
  await expect(page.locator('.incident-bar')).toContainText(/INC-\d+/);
  await expect(page.locator('#page-sum')).toContainText('目前階段：觸發');
  const id = (await page.locator('.incident-bar .tag').innerText()).trim();

  const flow = page.locator('#incident-flow');
  // 沒選指揮官不能指派
  await flow.getByRole('button', { name: '指派指揮官' }).click();
  await expect(page.locator('#toast')).toContainText('請先在右側選擇事件指揮官');
  await page.selectOption('#commander', 'm5');
  await flow.getByRole('button', { name: '指派指揮官' }).click();
  await expect(page.locator('#page-sum')).toContainText('目前階段：指派');

  await flow.getByRole('button', { name: '開始緩解' }).click();
  await expect(page.locator('#page-sum')).toContainText('目前階段：處理');

  await flow.getByRole('button', { name: '標記已恢復' }).click();
  await expect(page.locator('#toast')).toContainText('服務已恢復');
  // 恢復後警示斜紋消失
  await expect(page.locator('.hazard')).toHaveCount(0);

  await flow.getByRole('button', { name: '撰寫事後檢討' }).click();
  const text = await page.locator('#pm').inputValue();
  expect(text).toContain(`# 事後檢討：${id}`);
  expect(text).toContain('事件指揮官：紀語彤');
  expect(text).toContain('## 時間軸');

  await flow.getByRole('button', { name: '結案' }).click();
  await expect(page.locator('#incident-box')).toContainText('目前沒有進行中的事件');
  await expect(page.locator('#incident-box table')).toContainText(id);
});

test('架構圖有七個階段；注入異常後，異常紀錄出現那個設備', async ({ page }) => {
  await open(page, '/systems');
  const nodes = page.locator('#arch-flow .react-flow__node');
  await expect(nodes).toHaveCount(7);
  for (const name of ['場站裝置', '收集', '串流', '時序資料庫', '分析', '告警', 'SaaS 報表']) await expect(page.locator('#arch-flow')).toContainText(name);

  await page.locator('#arch-flow .react-flow__node[data-id="tsdb"]').click();
  await expect(page.locator('#select-bar')).toContainText('TNK-01');
  await page.click('[data-act="inject"]');
  // 每秒一筆，連續兩筆超標才告警，所以幾秒內會出現
  await expect(page.locator('#anomaly-log table')).toContainText('TNK-01', { timeout: 12_000 });
});
