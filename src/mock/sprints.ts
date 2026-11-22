import type { Sprint, Standup, Task } from '../core/types';
import { addDays, DEMO_TODAY, workdays } from '../core/date';
import type { Rng } from './rng';
import { ACTIVE_SPRINT } from './tasks';
import { L } from './util';

// 兩週一個 Sprint。過去的 Sprint 用 seeded RNG 產生承諾／完成點數與燃盡曲線；
// 進行中的 Sprint 24 則由任務資料算出，所以拖曳 Kanban 會即時反映在燃盡圖上。

const GOALS: [string, string][] = [
  ['串流引擎完成功能對等', 'Reach feature parity on the stream engine'],
  ['接入閘道憑證自動化', 'Automate gateway certificates'],
  ['串流引擎灰度上線', 'Canary the stream engine'],
  ['告警訂閱與靜音時段上線', 'Ship alert subscriptions and quiet hours'],
  ['回測達標並完成降採樣', 'Pass the backtest and finish downsampling'],
];

export function buildSprints(rng: Rng, tasks: Task[]): Sprint[] {
  const sprints: Sprint[] = [];
  const activeStart = '2026-11-16';
  for (let n = 19; n <= 23; n++) {
    const start = addDays(activeStart, (n - 24) * 14);
    const committed = rng.int(80, 92);
    const completed = Math.round(committed * rng.float(0.84, 1));
    const burndown = [committed];
    let left = committed;
    for (let d = 1; d <= 10; d++) {
      const target = committed - (completed * d) / 10;
      left = Math.max(committed - completed, Math.min(left, Math.round(target + rng.float(-4, 5))));
      burndown.push(d === 10 ? committed - completed : left);
    }
    sprints.push({
      id: `s${n}`, name: `Sprint ${n}`, goal: L(...GOALS[n - 19]), start, end: addDays(start, 11),
      status: 'done', committed, completed, burndown,
    });
  }

  const mine = tasks.filter((t) => t.sprintId === ACTIVE_SPRINT);
  const committed = mine.reduce((s, t) => s + t.points, 0);
  const doneNow = mine.filter((t) => t.status === 'done').reduce((s, t) => s + t.points, 0);
  // 已經過的工作日（不含今天）：把目前完成的點數攤回每一天，得到歷史燃盡點。
  const elapsed = workdays(activeStart, DEMO_TODAY).length - 1;
  const burndown = [committed];
  let burned = 0;
  for (let d = 1; d < elapsed; d++) {
    burned = Math.min(doneNow - 4, Math.round((doneNow * d) / elapsed + rng.float(-3, 1)));
    burndown.push(committed - Math.max(0, burned));
  }
  sprints.push({
    id: ACTIVE_SPRINT, name: 'Sprint 24', goal: L('exactly-once 進主幹，Review 佇列清到 24 小時內', 'Land exactly-once on main and bring review wait under 24 hours'),
    start: activeStart, end: addDays(activeStart, 11), status: 'active', committed, completed: doneNow, burndown,
  });
  sprints.push({
    id: 's25', name: 'Sprint 25', goal: L('閘道 v3 壓測與冷資料分層', 'Gateway v3 load test and cold-data tiering'),
    start: addDays(activeStart, 14), end: addDays(activeStart, 25), status: 'planned', committed: 0, completed: 0, burndown: [],
  });
  return sprints;
}

export function buildStandups(): Standup[] {
  return [
    { id: 'su-1', memberId: 'm4', date: DEMO_TODAY, yesterday: L('回填拆分的 PR 補上重入測試', 'Added re-entrancy tests to the backfill PR'), today: L('處理 Review 意見，開始看閘道連線池', 'Address review comments, start on the gateway connection pool'), blockers: L('PR 等了一天多還沒被看', 'PR has waited over a day for review') },
    { id: 'su-2', memberId: 'm6', date: DEMO_TODAY, yesterday: L('推論服務接上特徵庫', 'Wired inference serving to the feature store'), today: L('壓測推論延遲', 'Load test inference latency'), blockers: L('告警去重還沒空開始', 'No time yet to start alert dedup') },
    { id: 'su-3', memberId: 'm8', date: DEMO_TODAY, yesterday: L('對帳頁送出 Review', 'Sent the reconciliation page for review'), today: L('Webhook 通知通道', 'Webhook notification channel'), blockers: L('無', 'None') },
  ];
}
