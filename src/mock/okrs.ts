import type { Objective, RoadmapItem } from '../core/types';
import { L } from './util';

// 2026 Q4 的 OKR 與產品路線圖。每個路線圖項目都指向一個 Objective，用來檢查「工程投入有沒有對齊目標」。

export const QUARTER = { label: '2026 Q4', start: '2026-10-05', end: '2027-01-17' };

export function buildObjectives(): Objective[] {
  return [
    { id: 'o1', title: L('資料管線撐得住單日 3 億筆', 'The pipeline handles 300M points a day'), owner: 'm1', krs: [
      { id: 'o1-k1', title: L('端到端延遲 p95 低於 5 秒', 'End-to-end p95 latency under 5 s'), progress: 70 },
      { id: 'o1-k2', title: L('資料遺失率低於 0.01%', 'Data loss below 0.01%'), progress: 55 },
      { id: 'o1-k3', title: L('回填 30 天資料少於 4 小時', 'Backfill 30 days in under 4 hours'), progress: 40 },
    ] },
    { id: 'o2', title: L('客戶少看一半的無效告警', 'Customers see half as many noisy alerts'), owner: 'm2', krs: [
      { id: 'o2-k1', title: L('誤報率從 12% 降到 6%', 'False-positive rate from 12% to 6%'), progress: 45 },
      { id: 'o2-k2', title: L('從異常到告警少於 60 秒', 'Anomaly to alert in under 60 s'), progress: 60 },
      { id: 'o2-k3', title: L('三家試點客戶採用 v2', 'Three pilot customers adopt v2'), progress: 33 },
    ] },
    { id: 'o3', title: L('報表成為客戶可自助的 SaaS 產品', 'Reporting becomes a self-serve SaaS product'), owner: 'm3', krs: [
      { id: 'o3-k1', title: L('客戶自建範本達 20 份', 'Customers build 20 templates on their own'), progress: 35 },
      { id: 'o3-k2', title: L('報表產生 p95 低於 10 秒', 'Report generation p95 under 10 s'), progress: 50 },
      { id: 'o3-k3', title: L('人工客製報表需求下降 40%', 'Custom report requests down 40%'), progress: 25 },
    ] },
    { id: 'o4', title: L('用更少的雲端成本處理更多資料', 'Process more data on less cloud spend'), owner: 'm5', krs: [
      { id: 'o4-k1', title: L('每百萬筆資料成本下降 25%', 'Cost per million points down 25%'), progress: 60 },
      { id: 'o4-k2', title: L('閒置資源低於 10%', 'Idle resources below 10%'), progress: 70 },
    ] },
  ];
}

export function buildRoadmap(): RoadmapItem[] {
  return [
    { id: 'r1', title: L('資料 Schema 治理', 'Data schema governance'), month: '2026-10', objectiveId: 'o1', status: 'done' },
    { id: 'r2', title: L('閒置環境自動關機', 'Idle environment auto-shutdown'), month: '2026-10', objectiveId: 'o4', projectId: 'p4', status: 'done' },
    { id: 'r3', title: L('串流引擎 exactly-once 上線', 'Exactly-once stream engine'), month: '2026-11', objectiveId: 'o1', projectId: 'p1', status: 'inProgress' },
    { id: 'r4', title: L('告警通知中心正式推出', 'Alert Notification Center GA'), month: '2026-11', objectiveId: 'o2', projectId: 'p6', status: 'inProgress' },
    { id: 'r5', title: L('Spot 混合節點', 'Spot node mix'), month: '2026-11', objectiveId: 'o4', projectId: 'p4', status: 'inProgress' },
    { id: 'r6', title: L('異常偵測 v2 試點', 'Anomaly Detection v2 pilot'), month: '2026-12', objectiveId: 'o2', projectId: 'p2', status: 'planned' },
    { id: 'r7', title: L('自助報表範本 Beta', 'Self-serve report templates beta'), month: '2026-12', objectiveId: 'o3', projectId: 'p3', status: 'planned' },
    { id: 'r8', title: L('降採樣與冷資料分層', 'Downsampling and cold tiering'), month: '2026-12', objectiveId: 'o1', projectId: 'p4', status: 'planned' },
    { id: 'r9', title: L('報表排程寄送', 'Scheduled report delivery'), month: '2027-01', objectiveId: 'o3', projectId: 'p3', status: 'planned' },
    { id: 'r10', title: L('閘道 v3 壓測單日 3 億筆', 'Gateway v3 load test at 300M a day'), month: '2027-01', objectiveId: 'o1', projectId: 'p5', status: 'planned' },
  ];
}
