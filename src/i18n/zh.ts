// 正體中文字典（同時是 i18n key 的型別來源）。
// 這個檔案的 key 決定了 I18nKey；en.ts 少任何一個 key，tsc 都會報錯。

export const zh = {
  // app
  "app.name": "Energy SaaS 研發管理中心",
  "app.short": "研發管理中心",
  "app.product": "Energy SaaS",
  "app.fictional": "所有資料皆為虛構",

  // nav
  "nav.dashboard": "總覽",
  "nav.team": "團隊管理",
  "nav.projects": "專案管理",
  "nav.governance": "技術治理",
  "nav.systems": "系統與事件",
  "nav.collab": "跨部門協作",
  "nav.rbac": "權限矩陣",
  "nav.about": "關於這個 Demo",
  "nav.label": "主選單",

  // top
  "top.role": "模擬登入",
  "top.lang": "語言",
  "top.reset": "重設 Demo 資料",
  "top.resetTitle": "重設 Demo 資料？",
  "top.resetBody": "所有資料會回到初始狀態，你在這個瀏覽器做的修改都會消失。語言與特效設定會保留。",
  "top.resetDone": "已重設 Demo 資料",
  "top.incident": "進行中事件",
  "top.viewIncident": "查看事件",

  // role
  "role.manager": "研發主管",
  "role.techlead": "Tech Lead",
  "role.engineer": "工程師",
  "role.pmcs": "PM／CS",
  "role.admin": "管理員",

  // common
  "common.cancel": "取消",
  "common.save": "儲存",
  "common.close": "關閉",
  "common.copy": "複製",
  "common.copied": "已複製到剪貼簿",
  "common.saved": "已儲存",
  "common.locked": "「{role}」沒有這個權限：{perm}",
  "common.none": "無",
  "common.unassigned": "未指派",
  "common.pts": "點",
  "common.all": "全部",

  // denied
  "denied.title": "這個角色看不到這一頁",
  "denied.body": "目前以「{role}」登入，沒有「{page}」的檢視權限。可以在上方切換角色，或到權限矩陣看每個角色能做什麼。",
  "denied.back": "回到總覽",

  // soon
  "soon.title": "這一頁正在施工",
  "soon.body": "第一版先完成外殼、角色切換與總覽；這一頁的功能會在下一版補上。",

  // notfound
  "notfound.title": "找不到這一頁",

  // perm
  "perm.page.dashboard": "檢視：總覽",
  "perm.page.team": "檢視：團隊管理",
  "perm.page.projects": "檢視：專案管理",
  "perm.page.governance": "檢視：技術治理",
  "perm.page.systems": "檢視：系統與事件",
  "perm.page.collab": "檢視：跨部門協作",
  "perm.page.rbac": "檢視：權限矩陣",
  "perm.page.about": "檢視：關於",
  "perm.team.private": "檢視 1:1、績效與成長計畫",
  "perm.oneonone.write": "撰寫 1:1 紀錄與績效回饋",
  "perm.hiring.manage": "管理招募流程",
  "perm.member.manage": "管理成員與角色",
  "perm.task.assign": "指派任何任務",
  "perm.task.manageSquad": "管理所屬小組的任務",
  "perm.task.updateOwn": "更新自己的任務狀態",
  "perm.standup.write": "填寫每日站會",
  "perm.sprint.plan": "規劃 Sprint",
  "perm.okr.edit": "調整 OKR",
  "perm.adr.write": "撰寫 ADR",
  "perm.review.decide": "Code Review 決策",
  "perm.pipeline.run": "執行與重跑 Pipeline",
  "perm.release.approve": "核准正式環境發版",
  "perm.incident.manage": "處理線上事件",
  "perm.request.create": "提出需求",
  "perm.request.triage": "評估需求並轉成任務",
  "perm.report.generate": "產生週報",
  "perm.rbac.edit": "編輯權限矩陣",

  // dash
  "dash.lead": "研發團隊這一週的交付節奏、品質，以及資料平台的即時健康狀況。",
  "dash.dora": "DORA 四項指標",
  "dash.delivery": "交付與品質",
  "dash.vsLast": "較前週",
  "dash.factory": "能源資料工廠",
  "dash.factoryHint": "拖曳可旋轉、滾輪可縮放；點設備或標籤，看它的即時數據。",
  "dash.legend": "原料方塊是原始電力資料，沖壓機是資料處理管線，發光成品是分析結果與報表。輸送帶速度跟著吞吐量變化。",
  "dash.lowFx": "降低特效",
  "dash.resetView": "重置視角",
  "dash.zoomIn": "放大",
  "dash.zoomOut": "縮小",
  "dash.loading3d": "正在載入 3D 場景…",
  "dash.no3d": "這個瀏覽器無法啟用 WebGL，3D 場景沒有載入。其他功能不受影響。",
  "dash.scale": "模型比例 1:200",
  "dash.pick": "點一個設備",
  "dash.pickHint": "每個設備代表資料平台的一段。點模型或標籤後，相機會平滑移過去，這裡會顯示它的即時數據、負責小組與相關任務。",
  "dash.throughput": "吞吐量",
  "dash.latency": "延遲",
  "dash.error": "錯誤率",
  "dash.owner": "負責小組",
  "dash.lastDeploy": "最近一次部署",
  "dash.deployedBy": "{date}，由 {name} 部署",
  "dash.related": "相關任務",
  "dash.noTasks": "沒有未完成的相關任務。",
  "dash.ok": "運作正常",
  "dash.anomaly": "偵測到異常",
  "dash.incident": "事件處理中",
  "dash.inject": "注入異常",
  "dash.injected": "已對 {tag} 注入 4 秒的異常，注意 3D 場景裡的紅燈",
  "dash.deselect": "取消選取",
  "dash.trends": "近 12 週趨勢",
  "dash.liveIngest": "接入吞吐量",
  "dash.liveLatency": "端到端延遲",
  "dash.liveError": "平均錯誤率",
  "dash.today": "今日累計資料點",
  "dash.perDay": "推估單日",
  "dash.perSec": "筆／秒",
  "dash.points": "筆",
  "dash.openSystems": "看平台架構與事件",

  // status
  "status.backlog": "Backlog",
  "status.progress": "In Progress",
  "status.review": "Review",
  "status.done": "Done",
} as const;

export type I18nKey = keyof typeof zh;
