import { expect, test } from '@playwright/test';
import { open, signInAs, taskStatus } from './helpers';

// 驗收：Code Review 決策、ADR、CI/CD Pipeline 的失敗重跑與發版核准。

test('核准 PR 後，關聯的任務移到 Done', async ({ page }) => {
  await open(page, '/governance?tab=review');
  await expect(page.locator('#page-sum')).toContainText('6 個 PR 待審');
  await page.click('[data-act="pr-approve"][data-id="PR-482"]');
  await expect(page.locator('#toast')).toContainText('PR-482 已核准，任務 T-102 移到 Done');
  await expect(page.locator('#page-sum')).toContainText('5 個 PR 待審');
  expect(await taskStatus(page, 'T-102')).toBe('done');
});

test('Pipeline：Test 失敗 → 重跑 → 等待核准 → 上線', async ({ page }) => {
  await open(page, '/governance?tab=cicd');
  await page.click('[data-act="run"]');
  const flow = page.locator('#cicd-flow');
  await flow.getByRole('button', { name: '重跑失敗階段' }).click({ timeout: 15_000 });
  await flow.getByRole('button', { name: '核准發版' }).click({ timeout: 15_000 });
  await expect(page.locator('#toast')).toContainText('已部署到正式環境', { timeout: 15_000 });
  const first = page.locator('#cicd-history tbody tr').first();
  await expect(first.locator('.stage-dots i.is-pass')).toHaveCount(4);
  await expect(first).toContainText('研發主管');
});

test('工程師可以重跑 Pipeline，但不能核准發版', async ({ page }) => {
  await open(page, '/governance?tab=cicd');
  await signInAs(page, 'engineer');
  await page.click('[data-act="run"]');
  const flow = page.locator('#cicd-flow');
  await flow.getByRole('button', { name: '重跑失敗階段' }).click({ timeout: 15_000 });
  const approve = flow.getByRole('button', { name: '核准發版' });
  await expect(approve).toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 });
  await approve.click({ force: true });
  await expect(page.locator('#toast')).toContainText('沒有這個權限：核准正式環境發版');
});

test('Tech Lead 可以新增 ADR', async ({ page }) => {
  await open(page, '/governance?tab=adr');
  await signInAs(page, 'techlead');
  await page.click('[data-act="adr-new"]');
  const dialog = page.locator('dialog.modal');
  await dialog.locator('#na-title').fill('E2E：告警規則改用設定檔');
  await dialog.locator('#na-decision').fill('把門檻搬到設定檔，不必發版就能調整。');
  await dialog.locator('#na-save').click();
  await expect(page.locator('.adr-item').first()).toContainText('E2E：告警規則改用設定檔');
  await expect(page.locator('.adr-item').first()).toContainText('提案中');
});
