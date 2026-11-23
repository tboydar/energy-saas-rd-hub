import { expect, test } from '@playwright/test';
import { open, resetDemo, signInAs, taskStatus } from './helpers';

// 驗收：Kanban 可拖曳；重新整理後資料保留；按「重設」回到初始資料。

test('拖曳卡片到 Done 欄', async ({ page }) => {
  await open(page, '/projects?tab=kanban');
  // 放到欄位的標題列：它一定在畫面內，不會因為要捲動而中斷拖曳
  await page.locator('.kb-card[data-task="T-101"] .kb-title').dragTo(page.locator('.kb-col[data-status="done"] .kb-head'));
  await expect(page.locator('.kb-col[data-status="done"] [data-task="T-101"]')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('T-101 已移到 Done');
  expect(await taskStatus(page, 'T-101')).toBe('done');
});

test('用卡片上的箭頭移動；重新整理後保留；重設後回到初始資料', async ({ page }) => {
  await open(page, '/projects?tab=kanban');
  await expect(page.locator('#page-sum')).toContainText('落後理想線 18 點');
  await page.click('[data-move="1"][data-id="T-102"]');
  await expect(page.locator('.kb-col[data-status="done"] [data-task="T-102"]')).toBeVisible();
  // 標題下的現況是從資料算的：完成 5 點後，落後從 18 點變成 13 點
  await expect(page.locator('#page-sum')).toContainText('落後理想線 13 點');

  await page.reload();
  await expect(page.locator('.kb-col[data-status="done"] [data-task="T-102"]')).toBeVisible();
  expect(await taskStatus(page, 'T-102')).toBe('done');

  await resetDemo(page);
  await expect(page.locator('.kb-col[data-status="review"] [data-task="T-102"]')).toBeVisible();
  expect(await taskStatus(page, 'T-102')).toBe('review');
});

test('連續兩次重設，資料逐字相同（固定 seed）', async ({ page }) => {
  await open(page, '/projects?tab=kanban');
  await resetDemo(page);
  const first = await page.evaluate(() => localStorage.getItem('esrd:state:v1'));
  await page.click('[data-move="1"][data-id="T-101"]');
  await resetDemo(page);
  expect(await page.evaluate(() => localStorage.getItem('esrd:state:v1'))).toBe(first);
});

test('主管可以在任務視窗改指派', async ({ page }) => {
  await open(page, '/projects?tab=kanban');
  await page.locator('.kb-card[data-task="T-206"] .kb-title').click();
  const dialog = page.locator('dialog.modal');
  await expect(dialog).toContainText('告警去重與抑制規則');
  await dialog.locator('#tk-assignee').selectOption('m7');
  await dialog.locator('#tk-save').click();
  await expect(page.locator('.kb-card[data-task="T-206"]')).toContainText('阮心妍');
});

test('工程師只能移動自己的任務，也不能改指派', async ({ page }) => {
  await open(page, '/projects?tab=kanban');
  await signInAs(page, 'engineer');
  // 預設只看自己的任務；取消勾選後看得到別人的卡，但沒有移動用的箭頭
  await page.uncheck('#f-mine');
  await expect(page.locator('.kb-card[data-task="T-101"]')).toHaveAttribute('draggable', 'false');
  await expect(page.locator('[data-id="T-101"][data-move]')).toHaveCount(0);
  await expect(page.locator('[data-id="T-102"][data-move]').first()).toBeVisible();
  await page.locator('.kb-card[data-task="T-102"] .kb-title').click();
  await expect(page.locator('dialog.modal #tk-assignee')).toBeDisabled();
  await expect(page.locator('dialog.modal #tk-status')).toBeEnabled();
});
