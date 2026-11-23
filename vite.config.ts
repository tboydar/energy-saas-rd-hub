import { defineConfig } from 'vite';
import { formatVersion, resolveCommit, resolveVersion } from './scripts/app-version';

// GitHub Pages 會把網站放在 https://<user>.github.io/<repo>/ 這個子路徑。
// 這裡預設用相對路徑 './'，再搭配 hash 路由（#/dashboard），
// 所以不論 repo 叫什麼名字，部署後都能直接開啟、重新整理也不會 404。
// 若想改成絕對路徑，可在建置時指定：VITE_BASE=/your-repo/ bun run build
//
// 版號（v<台灣日期>.<當天第幾次 CI>）與 commit 在建置時寫進程式，也寫進 index.html 的 <meta>，
// 所以不用開瀏覽器也查得到線上是哪一版：curl -s <網址> | grep app-version
export default defineConfig(async ({ command }) => {
  // 只有建置時才去問 CI 這是當天第幾次；開發伺服器與預覽都用本機的版號
  const version = command === 'build' ? await resolveVersion() : formatVersion(new Date(), 'dev');
  const commit = resolveCommit();
  return {
    base: process.env.VITE_BASE || './',
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __APP_COMMIT__: JSON.stringify(commit),
    },
    plugins: [
      {
        name: 'app-version-meta',
        transformIndexHtml: () => [
          { tag: 'meta', attrs: { name: 'app-version', content: version }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'app-commit', content: commit }, injectTo: 'head' },
        ],
      },
    ],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 900,
    },
  };
});
