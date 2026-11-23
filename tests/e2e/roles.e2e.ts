import { expect, test } from '@playwright/test';
import { open, signInAs } from './helpers';

// 驗收：切換 5 種角色，選單與權限正確變化。

const MENU = {
  manager: ['dashboard', 'team', 'projects', 'governance', 'systems', 'collab', 'rbac', 'about'],
  techlead: ['dashboard', 'team', 'projects', 'governance', 'systems', 'collab', 'about'],
  engineer: ['dashboard', 'projects', 'governance', 'systems', 'about'],
  pmcs: ['dashboard', 'projects', 'systems', 'collab', 'about'],
  admin: ['dashboard', 'team', 'rbac', 'about'],
} as const;

// 可以拖曳的 Kanban 卡片數：主管全部、Tech Lead 自己小組、工程師只有自己的、PM／CS 沒有
const DRAGGABLE = { manager: 34, techlead: 17, engineer: 5, pmcs: 0 } as const;

for (const role of Object.keys(MENU) as (keyof typeof MENU)[]) {
  test(`${role}：選單只列出有權限的頁面`, async ({ page }) => {
    await open(page, '/dashboard');
    await signInAs(page, role);
    await expect(page.locator('.nav a')).toHaveCount(MENU[role].length);
    const pages = await page.locator('.nav a').evaluateAll((links) => links.map((a) => a.getAttribute('href')!.replace('#/', '')));
    expect(pages).toEqual([...MENU[role]]);
  });
}

for (const role of Object.keys(DRAGGABLE) as (keyof typeof DRAGGABLE)[]) {
  test(`${role}：可拖曳的 Kanban 卡片是 ${DRAGGABLE[role]} 張`, async ({ page }) => {
    await open(page, '/projects?tab=kanban');
    await signInAs(page, role);
    await expect(page.locator('.kb-col').first()).toBeVisible();
    await expect(page.locator('.kb-card[draggable="true"]')).toHaveCount(DRAGGABLE[role]);
  });
}

test('直接輸入沒有權限的網址，會看到說明而不是頁面內容', async ({ page }) => {
  await open(page, '/dashboard');
  await signInAs(page, 'engineer');
  await page.goto('#/team');
  await expect(page.locator('.notice h1')).toHaveText('這個角色看不到這一頁');
  await expect(page.locator('.notice')).toContainText('工程師');
});

test('沒有權限的按鈕顯示成上鎖，點了會說明缺哪個權限，而且不會執行', async ({ page }) => {
  await open(page, '/systems');
  await signInAs(page, 'pmcs');
  const simulate = page.locator('[data-act="simulate"]');
  await expect(simulate).toHaveAttribute('aria-disabled', 'true');
  // 上鎖的按鈕真人仍然點得到；Playwright 預設會等它「可用」，所以要求它直接點
  await simulate.click({ force: true });
  await expect(page.locator('#toast')).toContainText('沒有這個權限：處理線上事件');
  await expect(page.locator('.hazard')).toHaveCount(0);
});

test('管理員修改權限矩陣後，其他角色立刻受影響；還原後恢復', async ({ page }) => {
  await open(page, '/rbac');
  await signInAs(page, 'admin');
  await page.uncheck('[data-role="pmcs"][data-perm="request.create"]');
  await signInAs(page, 'pmcs');
  await page.goto('#/collab');
  await expect(page.locator('[data-act="submit"]')).toHaveAttribute('aria-disabled', 'true');

  await signInAs(page, 'admin');
  await page.goto('#/rbac');
  await page.click('[data-act="reset"]');
  await signInAs(page, 'pmcs');
  await page.goto('#/collab');
  await expect(page.locator('[data-act="submit"]')).not.toHaveAttribute('aria-disabled', 'true');
});
