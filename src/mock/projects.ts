import type { DeviceId, Project, ProjectStatus, SquadId } from '../core/types';
import { L } from './util';

type Seed = [id: string, zh: string, en: string, squad: SquadId, owner: string, start: string, end: string,
  progress: number, status: ProjectStatus, objective: string, device: DeviceId, descZh: string, descEn: string,
  milestones: [string, string, string][]];

const SEEDS: Seed[] = [
  ['p1', '時序資料管線重構', 'Time-series Pipeline Refactor', 'platform', 'm1', '2026-10-05', '2026-12-18', 62, 'onTrack', 'o1', 'press',
    '把批次彙總改成串流處理，讓單日 3 億筆資料的端到端延遲低於 5 秒。', 'Replace batch aggregation with stream processing so 300M points a day flow end to end in under 5 seconds.',
    [['2026-11-06', '串流引擎灰度上線', 'Stream engine canary'], ['2026-12-11', '舊批次作業下線', 'Legacy batch retired']]],
  ['p2', '異常偵測 v2', 'Anomaly Detection v2', 'analytics', 'm2', '2026-10-19', '2026-12-24', 45, 'atRisk', 'o2', 'substation',
    '用季節性基準取代固定門檻，把無效告警減半。', 'Swap fixed thresholds for a seasonal baseline to cut noisy alerts in half.',
    [['2026-11-20', '離線回測達標', 'Offline backtest passes'], ['2026-12-15', '三家試點客戶上線', 'Three pilot customers live']]],
  ['p3', '客戶報表 SaaS 化', 'Customer Reporting as SaaS', 'saas', 'm3', '2026-10-12', '2026-12-30', 38, 'onTrack', 'o3', 'console',
    '把人工客製報表變成客戶可自助設定的多租戶產品。', 'Turn hand-built customer reports into a self-serve, multi-tenant product.',
    [['2026-11-27', '範本引擎 Beta', 'Template engine beta'], ['2026-12-22', '排程寄送上線', 'Scheduled delivery live']]],
  ['p4', 'K8s 成本優化', 'K8s Cost Optimization', 'platform', 'm5', '2026-11-02', '2026-12-11', 55, 'onTrack', 'o4', 'tank',
    '混用 Spot 節點並把冷資料分層，讓每百萬筆資料的成本下降 25%。', 'Mix in spot nodes and tier cold data to cut cost per million points by 25%.',
    [['2026-11-25', 'Spot 混合節點上線', 'Spot mix in production'], ['2026-12-09', '冷資料分層完成', 'Cold tiering done']]],
  ['p5', '場站接入閘道 v3', 'Site Ingestion Gateway v3', 'platform', 'm4', '2026-11-09', '2027-01-15', 20, 'atRisk', 'o1', 'truck',
    '重寫連線層並加入邊緣緩衝，場站斷線後資料可以自動補傳。', 'Rewrite the connection layer and add edge buffering so sites backfill automatically after an outage.',
    [['2026-12-04', '邊緣緩衝試行', 'Edge buffering trial'], ['2027-01-08', '壓測單日 3 億筆', 'Load test at 300M points a day']]],
  ['p6', '告警通知中心', 'Alert Notification Center', 'saas', 'm3', '2026-10-26', '2026-12-04', 80, 'onTrack', 'o2', 'substation',
    '讓客戶自己設定訂閱、靜音時段與升級政策。', 'Let customers manage subscriptions, quiet hours and escalation on their own.',
    [['2026-11-13', '訂閱與靜音上線', 'Subscriptions and quiet hours live'], ['2026-12-02', '升級政策上線', 'Escalation policy live']]],
];

export function buildProjects(): Project[] {
  return SEEDS.map(([id, zh, en, squad, owner, start, end, progress, status, objectiveId, deviceId, d1, d2, ms]) => ({
    id, name: L(zh, en), description: L(d1, d2), squad, owner, start, end, progress, status, objectiveId, deviceId,
    milestones: ms.map(([date, a, b]) => ({ date, name: L(a, b) })),
  }));
}
