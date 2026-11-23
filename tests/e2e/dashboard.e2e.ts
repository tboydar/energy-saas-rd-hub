import { expect, test } from '@playwright/test';
import { open } from './helpers';

// 驗收：總覽的指標與趨勢圖；3D 場景點擊設備會聚焦並顯示資料小卡；介面可切換英文。

// 3D 場景的載入時間：有 GPU 時不到一秒，用軟體算圖（CI）時可能要十幾秒
const SCENE_TIMEOUT = 60_000;

test('七張指標卡與七張近 12 週趨勢圖', async ({ page }) => {
  await open(page, '/dashboard');
  await expect(page.locator('.meter')).toHaveCount(7);
  for (const name of ['部署頻率', '變更前置時間', '變更失敗率', '平均復原時間', 'Sprint 速度', '未結缺陷', '技術債比例']) {
    await expect(page.locator('.meters')).toContainText(name);
  }
  await expect(page.locator('canvas[data-metric]')).toHaveCount(7);
});

test('3D 場景載入後，點設備會顯示資料小卡，小卡的任務連結會跳到專案頁', async ({ page }) => {
  await open(page, '/dashboard');
  await expect(page.locator('.stage-canvas')).toBeVisible({ timeout: SCENE_TIMEOUT });
  await expect(page.locator('.tag3d')).toHaveCount(6);

  await page.click('.tag3d[data-device="press"]');
  const card = page.locator('#device-card');
  await expect(card.locator('h3')).toHaveText('沖壓機');
  await expect(card.locator('.tag').first()).toHaveText('PRS-01');
  for (const label of ['吞吐量', '延遲', '錯誤率', '負責小組', '最近一次部署', '相關任務']) await expect(card).toContainText(label);
  await expect(card.locator('[data-live="tp"]')).toContainText(/[\d,]+/);
  await expect(page.locator('.tag3d[data-device="press"]')).toHaveClass(/is-selected/);

  await card.locator('.task-links a').first().click();
  await expect(page).toHaveURL(/#\/projects\?tab=kanban&task=T-101/);
  await expect(page.locator('dialog.modal')).toContainText('T-101');
});

test('點設備後相機是平滑移動過去的，不是瞬間跳過去', async ({ page }) => {
  await open(page, '/dashboard');
  await expect(page.locator('.stage-canvas')).toBeVisible({ timeout: SCENE_TIMEOUT });
  await page.click('.tag3d[data-device="truck"]');
  // 標籤的位置是每一幀由相機投影算出來的，所以它走過的位置就是相機走過的位置。
  // 在頁面裡「逐幀」記錄，直到連續幾幀不再變動。用幀數而不是毫秒，
  // 這樣不管電腦快慢（CI 沒有 GPU，每一幀都很久）結果都一樣。
  const path = await page.evaluate(() => new Promise<string[]>((resolve) => {
    const tag = document.querySelector<HTMLElement>('.tag3d[data-device="truck"]')!;
    const seen = [tag.style.transform];
    let still = 0;
    let frames = 0;
    const tick = () => {
      const now = tag.style.transform;
      if (now !== seen[seen.length - 1]) {
        seen.push(now);
        still = 0;
      } else {
        still++;
      }
      if (still >= 10 || ++frames >= 400) resolve(seen);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  // 瞬間跳過去只會有起點與終點兩個位置；平滑移動會經過很多個中間位置
  expect(path.length).toBeGreaterThan(5);
  expect(path[path.length - 1]).not.toBe(path[0]);
});

test('切換英文：介面與假資料都換成英文，重新整理後維持', async ({ page }) => {
  await open(page, '/dashboard');
  await page.click('[data-lang="en"]');
  await expect(page.locator('#view h1')).toHaveText('Overview');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.locator('.nav').innerText()).not.toMatch(/[\u4e00-\u9fff]/);

  await page.goto('#/team');
  await expect(page.locator('#view h1')).toHaveText('Team');
  expect(await page.locator('#view').innerText()).not.toMatch(/[\u4e00-\u9fff]/);

  await page.reload();
  await expect(page.locator('#view h1')).toHaveText('Team');
});

test('「降低特效」的設定會保留', async ({ page }) => {
  await open(page, '/dashboard');
  await expect(page.locator('.stage-canvas')).toBeVisible({ timeout: SCENE_TIMEOUT });
  await page.check('#lowfx');
  await page.reload();
  await expect(page.locator('#lowfx')).toBeChecked();
});
