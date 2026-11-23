import { expect, test } from '@playwright/test';
import { open, signInAs } from './helpers';

// 驗收：團隊管理的負載警示、1:1 紀錄、績效回饋草稿，以及私人資料的權限。

test('負載過高會警示；主管可以寫 1:1 並產生回饋草稿', async ({ page }) => {
  await open(page, '/team?member=m6');
  await expect(page.locator('.banner')).toContainText('游承翰 138%');
  await expect(page.locator('.detail h2')).toHaveText('游承翰');
  await expect(page.locator('#radar')).toBeVisible();

  await page.fill('#note-summary', 'E2E：討論把告警去重轉給心妍。');
  await page.fill('#note-actions', '本週五前完成交接。');
  await page.click('[data-act="save-note"]');
  await expect(page.locator('#toast')).toContainText('已儲存 1:1 紀錄');
  await expect(page.locator('.note').first()).toContainText('E2E：討論把告警去重轉給心妍。');

  await page.click('[data-act="ai-draft"]');
  await expect(page.locator('#feedback')).toHaveValue(/目前負載 138%/);
  await page.click('[data-act="save-draft"]');
  await page.reload();
  await expect(page.locator('#feedback')).toHaveValue(/目前負載 138%/);
  await expect(page.locator('.note').first()).toContainText('E2E：討論把告警去重轉給心妍。');
});

test('Tech Lead 看得到負載，但看不到 1:1 與績效', async ({ page }) => {
  await open(page, '/team?member=m6');
  await signInAs(page, 'techlead');
  await expect(page.locator('.detail h2')).toHaveText('游承翰');
  await expect(page.locator('.detail .locked-note')).toBeVisible();
  await expect(page.locator('#note-summary')).toHaveCount(0);
  await expect(page.locator('#feedback')).toHaveCount(0);
});

test('組織圖：研發主管、小組負責人與成員共 9 個節點', async ({ page }) => {
  await open(page, '/team?tab=org');
  await expect(page.locator('#org-flow .react-flow__node')).toHaveCount(9);
  await page.locator('#org-flow .react-flow__node[data-id="m7"]').click();
  await expect(page.locator('.detail h2')).toHaveText('阮心妍');
});
