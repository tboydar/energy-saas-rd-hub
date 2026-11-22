import { defineConfig } from 'vite';

// GitHub Pages 會把網站放在 https://<user>.github.io/<repo>/ 這個子路徑。
// 這裡預設用相對路徑 './'，再搭配 hash 路由（#/dashboard），
// 所以不論 repo 叫什麼名字，部署後都能直接開啟、重新整理也不會 404。
// 若想改成絕對路徑，可在建置時指定：VITE_BASE=/your-repo/ bun run build
export default defineConfig({
  base: process.env.VITE_BASE || './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
