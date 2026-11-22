import type { MetricKey, WeekMetric } from '../core/types';
import { addDays, shortDate } from '../core/date';
import type { Rng } from './rng';
import { L, lerp, round1 } from './util';

// 近 12 週的工程指標：整體趨勢是持續改善，再疊上 seeded 雜訊讓曲線看起來像真的。

export const METRIC_META: Record<MetricKey, { label: { zh: string; en: string }; unit: { zh: string; en: string }; better: 'higher' | 'lower'; dora: boolean }> = {
  deployFreq: { label: L('部署頻率', 'Deploy frequency'), unit: L('次／週', '/ week'), better: 'higher', dora: true },
  leadTime: { label: L('變更前置時間', 'Lead time'), unit: L('小時', 'h'), better: 'lower', dora: true },
  cfr: { label: L('變更失敗率', 'Change failure rate'), unit: L('%', '%'), better: 'lower', dora: true },
  mttr: { label: L('平均復原時間', 'Time to restore'), unit: L('分鐘', 'min'), better: 'lower', dora: true },
  velocity: { label: L('Sprint 速度', 'Sprint velocity'), unit: L('點／週', 'pts / week'), better: 'higher', dora: false },
  defects: { label: L('未結缺陷', 'Open defects'), unit: L('件', ''), better: 'lower', dora: false },
  debtRatio: { label: L('技術債比例', 'Tech debt ratio'), unit: L('%', '%'), better: 'lower', dora: false },
};

export const METRIC_KEYS = Object.keys(METRIC_META) as MetricKey[];

export function buildMetrics(rng: Rng): WeekMetric[] {
  const weeks = 12;
  const lastWeekStart = '2026-11-16';
  const out: WeekMetric[] = [];
  for (let i = 0; i < weeks; i++) {
    const p = i / (weeks - 1);
    const weekStart = addDays(lastWeekStart, (i - weeks + 1) * 7);
    out.push({
      week: shortDate(weekStart),
      weekStart,
      deployFreq: Math.round(lerp(9, 18, p) + rng.float(-1.5, 1.5)),
      leadTime: round1(lerp(52, 30, p) + rng.float(-3, 3)),
      cfr: round1(lerp(14, 8, p) + rng.float(-1.2, 1.2)),
      mttr: Math.round(lerp(95, 48, p) + rng.float(-8, 8)),
      velocity: Math.round(lerp(38, 47, p) + rng.float(-3, 3)),
      defects: Math.round(lerp(34, 22, p) + rng.float(-2, 2)),
      debtRatio: round1(lerp(21, 16.5, p) + rng.float(-0.6, 0.6)),
    });
  }
  return out;
}
