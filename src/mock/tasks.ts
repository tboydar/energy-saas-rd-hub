import type { DeviceId, Task, TaskStatus, TaskType } from '../core/types';
import { L } from './util';

export const ACTIVE_SPRINT = 's24';

type Seed = [id: string, project: string, zh: string, en: string, type: TaskType, points: number,
  status: TaskStatus, assignee: string | null, inSprint: boolean, priority: 'P0' | 'P1' | 'P2', device?: DeviceId];

const SEEDS: Seed[] = [
  // p1 時序資料管線重構
  ['T-101', 'p1', '串流處理改用 exactly-once 語意', 'Move stream processing to exactly-once semantics', 'feature', 8, 'progress', 'm1', true, 'P0', 'press'],
  ['T-102', 'p1', '批次回填拆分為可重入任務', 'Split the backfill job into re-entrant tasks', 'feature', 5, 'review', 'm4', true, 'P1', 'press'],
  ['T-103', 'p1', '降採樣規則引擎', 'Downsampling rule engine', 'feature', 5, 'done', 'm4', true, 'P1', 'tank'],
  ['T-104', 'p1', '移除舊版 cron 彙總腳本', 'Remove legacy cron aggregation scripts', 'debt', 3, 'done', 'm4', true, 'P2'],
  ['T-105', 'p1', '管線端到端延遲儀表板', 'End-to-end pipeline latency dashboard', 'ops', 3, 'done', 'm5', true, 'P1', 'press'],
  ['T-106', 'p1', 'Schema 相容性檢查', 'Schema compatibility checks', 'feature', 5, 'backlog', null, false, 'P1'],
  ['T-107', 'p1', '晚到資料的水位線調校', 'Tune watermarks for late-arriving data', 'feature', 3, 'backlog', 'm1', false, 'P1', 'press'],
  // p2 異常偵測 v2
  ['T-201', 'p2', '基準模型改為季節性分解', 'Replace the baseline with seasonal decomposition', 'feature', 8, 'progress', 'm2', true, 'P0', 'substation'],
  ['T-202', 'p2', '特徵庫：日照量與逆變器溫度', 'Feature store: irradiance and inverter temperature', 'feature', 5, 'done', 'm6', true, 'P1'],
  ['T-203', 'p2', '誤報率回測報表', 'False-positive backtest report', 'feature', 3, 'review', 'm7', true, 'P1'],
  ['T-204', 'p2', '模型線上推論服務化', 'Serve the model for online inference', 'feature', 8, 'progress', 'm6', true, 'P0', 'substation'],
  ['T-205', 'p2', '標註工具：異常事件回饋', 'Labeling tool for anomaly feedback', 'feature', 5, 'backlog', 'm7', false, 'P2'],
  ['T-206', 'p2', '告警去重與抑制規則', 'Alert dedup and suppression rules', 'feature', 5, 'backlog', 'm6', true, 'P1', 'substation'],
  ['T-207', 'p2', '修正夜間零發電被誤判為異常', 'Fix false alarms on zero nighttime generation', 'bug', 2, 'done', 'm7', true, 'P1'],
  // p3 客戶報表 SaaS 化
  ['T-301', 'p3', '多租戶報表範本引擎', 'Multi-tenant report template engine', 'feature', 8, 'progress', 'm3', true, 'P0', 'console'],
  ['T-302', 'p3', '報表排程與 Email 寄送', 'Report scheduling and email delivery', 'feature', 5, 'backlog', 'm3', false, 'P1'],
  ['T-303', 'p3', '發電量對帳頁（前端）', 'Generation reconciliation page (front end)', 'feature', 5, 'review', 'm8', true, 'P1', 'console'],
  ['T-304', 'p3', '匯出 PDF 與試算表', 'Export to PDF and spreadsheet', 'feature', 3, 'done', 'm8', true, 'P2'],
  ['T-305', 'p3', '租戶層級權限', 'Tenant-level permissions', 'feature', 5, 'backlog', null, false, 'P1'],
  ['T-306', 'p3', '修正跨時區換日的日報重複計算', 'Fix double counting in daily reports across time zones', 'bug', 3, 'done', 'm3', true, 'P0', 'console'],
  // p4 K8s 成本優化
  ['T-401', 'p4', '時序資料庫節點改用 Spot 與預留混合', 'Mix spot and reserved nodes for the time-series DB', 'ops', 5, 'progress', 'm5', true, 'P1', 'tank'],
  ['T-402', 'p4', '冷資料分層到物件儲存', 'Tier cold data to object storage', 'feature', 8, 'backlog', 'm5', false, 'P1', 'tank'],
  ['T-403', 'p4', '依消費延遲自動擴縮', 'Autoscale on consumer lag', 'ops', 3, 'done', 'm5', true, 'P1'],
  ['T-404', 'p4', '閒置環境夜間自動關機', 'Shut down idle environments at night', 'ops', 2, 'done', 'm5', true, 'P2'],
  ['T-405', 'p4', '依租戶標記成本歸屬', 'Cost attribution labels per tenant', 'ops', 3, 'backlog', null, false, 'P2'],
  // p5 場站接入閘道 v3
  ['T-501', 'p5', 'MQTT 接入層連線池重寫', 'Rewrite the MQTT ingestion connection pool', 'feature', 8, 'backlog', 'm4', false, 'P1', 'truck'],
  ['T-502', 'p5', '裝置憑證輪替流程', 'Device certificate rotation flow', 'feature', 5, 'backlog', null, false, 'P1', 'solar'],
  ['T-503', 'p5', '邊緣緩衝：斷線補傳', 'Edge buffering with store-and-forward', 'feature', 5, 'review', 'm1', true, 'P1', 'solar'],
  ['T-504', 'p5', 'Modbus 點位對照表匯入工具', 'Modbus point-mapping import tool', 'feature', 3, 'backlog', 'm4', false, 'P2', 'solar'],
  ['T-505', 'p5', '閘道壓測：單日 3 億筆', 'Gateway load test at 300M points a day', 'ops', 5, 'backlog', 'm5', false, 'P0', 'truck'],
  // p6 告警通知中心
  ['T-601', 'p6', '告警訂閱與靜音時段', 'Alert subscriptions and quiet hours', 'feature', 5, 'done', 'm8', false, 'P1', 'substation'],
  ['T-602', 'p6', '即時通訊、Email 與 Webhook 通知通道', 'Chat, email and webhook notification channels', 'feature', 5, 'progress', 'm8', true, 'P1', 'substation'],
  ['T-603', 'p6', '值班升級政策', 'On-call escalation policy', 'feature', 3, 'backlog', 'm3', false, 'P1'],
  ['T-604', 'p6', '告警列表改用虛擬捲動', 'Virtual scrolling for the alert list', 'debt', 3, 'backlog', 'm8', false, 'P2'],
];

export function buildTasks(): Task[] {
  return SEEDS.map(([id, projectId, zh, en, type, points, status, assignee, inSprint, priority, deviceId]) => ({
    id, title: L(zh, en), projectId, assignee, status, points, sprintId: inSprint ? ACTIVE_SPRINT : null, type, priority, deviceId,
  }));
}
