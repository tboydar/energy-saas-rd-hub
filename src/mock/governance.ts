import type { Debt, PipelineRun, QualityMetric, Review, StageName } from '../core/types';
import type { Rng } from './rng';
import { L, round1 } from './util';

export const STAGE_ORDER: StageName[] = ['build', 'test', 'staging', 'prod'];

export function buildReviews(rng: Rng): Review[] {
  const size = (lo: number, hi: number) => rng.int(lo, hi);
  return [
    { id: 'PR-482', title: L('批次回填拆分為可重入任務', 'Split the backfill job into re-entrant tasks'), taskId: 'T-102', author: 'm4', reviewer: 'm1', additions: size(380, 460), deletions: size(90, 150), ageHours: rng.int(24, 30), ci: 'pass', risk: 'med', status: 'open' },
    { id: 'PR-485', title: L('邊緣緩衝：斷線補傳', 'Edge buffering with store-and-forward'), taskId: 'T-503', author: 'm1', reviewer: 'm5', additions: size(560, 680), deletions: size(30, 60), ageHours: rng.int(7, 12), ci: 'pass', risk: 'high', status: 'open' },
    { id: 'PR-479', title: L('誤報率回測報表', 'False-positive backtest report'), taskId: 'T-203', author: 'm7', reviewer: 'm2', additions: size(220, 300), deletions: size(5, 20), ageHours: rng.int(28, 36), ci: 'pass', risk: 'low', status: 'open' },
    { id: 'PR-487', title: L('發電量對帳頁（前端）', 'Generation reconciliation page (front end)'), taskId: 'T-303', author: 'm8', reviewer: 'm3', additions: size(480, 600), deletions: size(60, 100), ageHours: rng.int(4, 8), ci: 'running', risk: 'med', status: 'open' },
    { id: 'PR-488', title: L('調整自動擴縮的消費延遲門檻', 'Tune the consumer-lag threshold for autoscaling'), author: 'm5', reviewer: 'm1', additions: size(25, 45), deletions: size(5, 12), ageHours: rng.int(2, 4), ci: 'pass', risk: 'low', status: 'open' },
    { id: 'PR-471', title: L('告警規則從程式碼搬到設定檔', 'Move alert rules from code to configuration'), author: 'm6', reviewer: 'm2', additions: size(170, 220), deletions: size(210, 270), ageHours: rng.int(50, 58), ci: 'fail', risk: 'med', status: 'open' },
  ];
}

export function buildDebts(): Debt[] {
  return [
    { id: 'TD-01', title: L('閘道缺少背壓機制', 'Gateway has no backpressure'), note: L('場站同時重連時會壓垮連線池，已造成一次事件。', 'Simultaneous reconnects can overwhelm the connection pool; it has already caused an incident.'), impact: 5, cost: 3, squad: 'platform', status: 'planned' },
    { id: 'TD-02', title: L('舊版彙總腳本沒有測試', 'Legacy aggregation scripts lack tests'), note: L('每次修改都靠人工比對數字。', 'Every change is verified by comparing numbers by hand.'), impact: 4, cost: 2, squad: 'platform', status: 'open' },
    { id: 'TD-03', title: L('報表服務與資料層緊耦合', 'Reporting service tightly coupled to the data layer'), note: L('換儲存層就得改報表邏輯，拖慢 SaaS 化。', 'Changing storage forces report logic changes and slows the SaaS effort.'), impact: 5, cost: 5, squad: 'saas', status: 'open' },
    { id: 'TD-04', title: L('資料庫遷移仍是手動', 'Database migrations are still manual'), note: L('發版前需人工執行腳本，容易漏步驟。', 'Scripts are run by hand before releases, so steps get missed.'), impact: 4, cost: 3, squad: 'platform', status: 'open' },
    { id: 'TD-05', title: L('告警規則寫死在程式碼', 'Alert rules hard-coded'), note: L('客戶調整門檻要等發版。', 'Customers wait for a release to change a threshold.'), impact: 3, cost: 2, squad: 'analytics', status: 'planned' },
    { id: 'TD-06', title: L('測試環境資料不具代表性', 'Test data is not representative'), note: L('只有兩個場站的資料，壓測結果不可信。', 'With data from only two sites, load tests cannot be trusted.'), impact: 3, cost: 4, squad: 'analytics', status: 'open' },
    { id: 'TD-07', title: L('前端元件庫版本落後', 'Front-end component library is outdated'), note: L('落後兩個大版本，無障礙修正無法套用。', 'Two major versions behind; accessibility fixes cannot be applied.'), impact: 2, cost: 2, squad: 'saas', status: 'open' },
    { id: 'TD-08', title: L('缺少租戶層級成本歸屬', 'No per-tenant cost attribution'), note: L('無法回答「哪個客戶最花成本」。', 'We cannot answer which customer costs the most.'), impact: 2, cost: 4, squad: 'platform', status: 'open' },
  ];
}

export function buildQuality(rng: Rng): QualityMetric[] {
  return [
    { key: 'coverage', label: L('單元測試覆蓋率', 'Unit test coverage'), value: round1(rng.float(76.5, 79.5)), target: 80, unit: '%', better: 'higher' },
    { key: 'build', label: L('主幹建置時間', 'Main branch build time'), value: round1(rng.float(8.8, 9.8)), target: 10, unit: 'min', better: 'lower' },
    { key: 'flaky', label: L('不穩定測試比例', 'Flaky test rate'), value: round1(rng.float(2.6, 3.4)), target: 2, unit: '%', better: 'lower' },
    { key: 'prsize', label: L('PR 平均大小', 'Average PR size'), value: rng.int(290, 340), target: 400, unit: 'LOC', better: 'lower' },
    { key: 'firstReview', label: L('Review 首次回應', 'Time to first review'), value: round1(rng.float(4.8, 5.8)), target: 4, unit: 'h', better: 'lower' },
    { key: 'critical', label: L('靜態分析重大問題', 'Critical static-analysis issues'), value: rng.int(3, 5), target: 0, unit: '', better: 'lower' },
    { key: 'dup', label: L('重複程式碼', 'Duplicated code'), value: round1(rng.float(4.2, 4.9)), target: 5, unit: '%', better: 'lower' },
  ];
}

export function buildPipelineRuns(rng: Rng): PipelineRun[] {
  const sec = () => ({ build: rng.int(70, 95), test: rng.int(210, 280), staging: rng.int(120, 160), prod: rng.int(90, 130) });
  const commit = () => Math.floor(rng.next() * 0xfffffff).toString(16).padStart(7, '0');
  const done = (id: string, zh: string, en: string, author: string, startedAt: string, attempts: number): PipelineRun => {
    const s = sec();
    return {
      id, title: L(zh, en), commit: commit(), author, startedAt, attempts, approvedBy: 'manager',
      stages: STAGE_ORDER.map((name) => ({ name, status: 'pass', seconds: s[name] })),
    };
  };
  return [
    done('RUN-318', '降採樣規則引擎', 'Downsampling rule engine', 'm4', '2026-11-20T03:12:00.000Z', 1),
    done('RUN-317', '依消費延遲自動擴縮', 'Autoscale on consumer lag', 'm5', '2026-11-19T07:40:00.000Z', 2),
    done('RUN-316', '修正跨時區換日的日報重複計算', 'Fix double counting across time zones', 'm3', '2026-11-18T02:05:00.000Z', 1),
  ];
}
