import { expect, type Page } from '@playwright/test';

const throttled = new WeakSet<Page>();

/**
 * E2E_CPU_THROTTLE=6 會把頁面的 CPU 放慢成六分之一，用來在本機重現「機器很慢才會出現」的時序問題。
 */
async function throttleCpu(page: Page): Promise<void> {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 0);
  if (!(rate > 1) || throttled.has(page)) return;
  throttled.add(page);
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('Emulation.setCPUThrottlingRate', { rate });
}

/** 開啟某一頁（hash 路由）。每個測試都是全新的瀏覽器環境，所以資料一定是初始狀態。 */
export async function open(page: Page, hash: string): Promise<void> {
  await throttleCpu(page);
  await page.goto(`#${hash}`);
  // 在站內換頁時，上一頁的畫面會留到新頁面的程式載入完成。等 #view 標上新的路徑，才是真的換過去了。
  await expect(page.locator(`#view[data-page="${hash.split('?')[0]}"]`)).toBeVisible();
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
