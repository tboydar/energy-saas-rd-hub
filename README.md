# Energy SaaS 研發管理中心

> 純前端作品集 Demo：以「能源 SaaS 軟體研發主管（Software Engineering Manager）」的日常為題，
> 展示帶團隊、管理專案、技術決策、工程指標，以及高資料量時序資料平台的產品思維。
>
> **所有資料皆為虛構（mock data）**：沒有後端、沒有 API 金鑰，也沒有任何真實公司、客戶或個人資料。

## 目前進度（第一版預覽）

- [x] 外殼：側邊選單、模擬登入（5 種角色）、中／英切換、重設 Demo 資料
- [x] 總覽 Dashboard：DORA 與交付指標、近 12 週趨勢、Three.js 等距微縮「能源資料工廠」
- [x] 即時模擬引擎與 z-score 異常偵測（3D 場景同步閃紅燈）
- [ ] 團隊管理、專案管理、技術治理、系統與事件、跨部門協作、權限矩陣、關於（施工中）

## 技術

- Vite + TypeScript（無前端框架）、Three.js、Chart.js
- 狀態存在 `localStorage`；固定 seed 的亂數產生器讓「重設」結果每次一致
- 套件管理與執行使用 [bun](https://bun.sh)

## 本機啟動

```bash
bun install
bun run dev      # 開發伺服器
bun run build    # 型別檢查 + 正式建置（輸出到 dist/）
bun run preview  # 預覽建置結果
```

## 部署到 GitHub Pages

推送到 `main` 分支後，`.github/workflows/deploy.yml` 會自動建置並部署。
Vite 的 `base` 預設為相對路徑 `./`，搭配 hash 路由，所以不論 repo 名稱為何都能直接開啟。
