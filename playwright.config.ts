import { defineConfig } from '@playwright/test';

// E2E 測試設定。
// 預設會自己啟動 `bun run preview`（先跑過 bun run build）。
// 也可以對已部署的網站跑同一套測試：E2E_BASE_URL=https://<帳號>.github.io/<repo>/ bun run test:e2e

const PORT = 4173;
const external = process.env.E2E_BASE_URL;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  // 不用 *.spec.ts／*.test.ts，避免被 bun test 當成單元測試撿走
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: external ?? `http://localhost:${PORT}/`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    // 本機直接用已安裝的 Chrome，不必下載 Playwright 的瀏覽器；CI 用 playwright install 裝的 Chromium
    channel: ci ? undefined : 'chrome',
    // CI 的機器沒有 GPU：允許用軟體算圖跑 WebGL，3D 場景才建得起來
    launchOptions: ci ? { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {},
  },
  webServer: external
    ? undefined
    : { command: `bun run preview --port ${PORT} --strictPort`, url: `http://localhost:${PORT}/`, reuseExistingServer: !ci, timeout: 60_000 },
});
