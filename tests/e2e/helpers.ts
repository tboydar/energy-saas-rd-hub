import { expect, type Page } from '@playwright/test';

/** 開啟某一頁（hash 路由）。每個測試都是全新的瀏覽器環境，所以資料一定是初始狀態。 */
export async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`#${hash}`);
  await expect(page.locator('#view h1')).toBeVisible();
}

export async function signInAs(page: Page, role: 'manager' | 'techlead' | 'engineer' | 'pmcs' | 'admin'): Promise<void> {
  await page.selectOption('#role-select', role);
}

/** 讀出目前存在 localStorage 的某個任務狀態。 */
export function taskStatus(page: Page, id: string): Promise<string> {
  return page.evaluate((taskId) => {
    const state = JSON.parse(localStorage.getItem('esrd:state:v1') ?? '{}') as { tasks: { id: string; status: string }[] };
    return state.tasks.find((t) => t.id === taskId)?.status ?? 'missing';
  }, id);
}

export async function resetDemo(page: Page): Promise<void> {
  await page.click('#reset-btn');
  await page.click('#do-reset');
  await expect(page.locator('#toast')).toContainText('已重設 Demo 資料');
}
