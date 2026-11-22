import { DEMO_TODAY, shortDate } from '../core/date';
import { activeIncident, activeSprint, memberLoad, sprintStats } from '../core/selectors';
import type { AppState, Lang, MetricKey } from '../core/types';
import { METRIC_KEYS, METRIC_META } from '../mock/metrics';
import { SQUADS } from '../mock/members';

// 「AI 週報助理」：完全用規則與範本從資料產生週報，沒有呼叫任何 LLM。
// 這樣做的理由：Demo 不需要 API 金鑰、輸出可重現，也方便說明「AI 助理先出草稿、人再修改」的流程。

export interface ReportInsight { level: 'high' | 'med' | 'low'; text: string }

export function analyze(state: AppState, lang: Lang): { risks: ReportInsight[]; asks: string[]; headline: string } {
  const zh = lang === 'zh';
  const name = (id: string | null) => state.members.find((m) => m.id === id)?.name[lang] ?? (zh ? '未指派' : 'unassigned');
  const sprint = activeSprint(state);
  const stats = sprintStats(state, sprint);
  const risks: ReportInsight[] = [];
  const asks: string[] = [];

  const incident = activeIncident(state);
  if (incident) {
    risks.push({ level: 'high', text: zh
      ? `線上事件 ${incident.id}（${incident.severity}）尚未恢復：${incident.title.zh}`
      : `Incident ${incident.id} (${incident.severity}) is still open: ${incident.title.en}` });
  }

  if (stats.gap > 5) {
    risks.push({ level: stats.gap > 12 ? 'high' : 'med', text: zh
      ? `${sprint.name} 落後理想線 ${stats.gap} 點；有 ${stats.inReview} 點卡在 Review，清掉就能追回進度`
      : `${sprint.name} is ${stats.gap} points behind the ideal line; ${stats.inReview} points are waiting in review and would close the gap` });
  }

  const loads = state.members.filter((m) => m.active).map((m) => ({ m, load: memberLoad(state, m) }));
  for (const { m, load } of loads.filter((x) => x.load.level === 'over')) {
    const spare = loads.filter((x) => x.m.squad === m.squad && x.load.level === 'low')[0];
    const movable = state.tasks.find((t) => t.assignee === m.id && t.sprintId === sprint.id && t.status === 'backlog');
    risks.push({ level: load.pct >= 130 ? 'high' : 'med', text: zh
      ? `${m.name.zh} 負載 ${load.pct}%（${load.committed}／${load.capacity} 點）`
      : `${m.name.en} is at ${load.pct}% load (${load.committed}/${load.capacity} pts)` });
    if (spare && movable) {
      asks.push(zh
        ? `把 ${movable.id}「${movable.title.zh}」從 ${m.name.zh} 轉給 ${spare.m.name.zh}（目前負載 ${spare.load.pct}%）`
        : `Move ${movable.id} "${movable.title.en}" from ${m.name.en} to ${spare.m.name.en} (currently at ${spare.load.pct}%)`);
    }
  }

  const stale = state.reviews.filter((r) => r.status === 'open' && r.ageHours >= 24).sort((a, b) => b.ageHours - a.ageHours);
  if (stale.length) {
    risks.push({ level: 'med', text: zh
      ? `${stale.length} 個 PR 等待 Review 超過 24 小時，最久的是 ${stale[0].id}（${stale[0].ageHours} 小時）`
      : `${stale.length} PRs have waited over 24 hours for review; the oldest is ${stale[0].id} (${stale[0].ageHours} h)` });
  }

  for (const p of state.projects.filter((x) => x.status !== 'onTrack')) {
    risks.push({ level: p.status === 'offTrack' ? 'high' : 'med', text: zh
      ? `專案「${p.name.zh}」${p.status === 'offTrack' ? '已落後' : '有風險'}（進度 ${p.progress}%，負責人 ${name(p.owner)}）`
      : `Project "${p.name.en}" is ${p.status === 'offTrack' ? 'off track' : 'at risk'} (${p.progress}% done, owner ${name(p.owner)})` });
  }

  const failing = state.quality.filter((q) => (q.better === 'higher' ? q.value < q.target : q.value > q.target));
  if (failing.length) {
    risks.push({ level: 'low', text: zh
      ? `${failing.length} 項品質基準未達標：${failing.map((q) => q.label.zh).join('、')}`
      : `${failing.length} quality baselines are missed: ${failing.map((q) => q.label.en).join(', ')}` });
  }

  for (const pos of state.positions.filter((x) => x.openDays >= 30)) {
    asks.push(zh
      ? `職缺「${pos.title.zh}」已開 ${pos.openDays} 天（${SQUADS[pos.squad].zh}），請協助加速終面與核薪`
      : `"${pos.title.en}" has been open ${pos.openDays} days (${SQUADS[pos.squad].en}); help needed to speed up final rounds and the offer`);
  }
  const debt = [...state.debts].filter((d) => d.status !== 'paid').sort((a, b) => b.impact / b.cost - a.impact / a.cost)[0];
  if (debt) {
    asks.push(zh
      ? `下個 Sprint 保留 15% 容量處理技術債 ${debt.id}「${debt.title.zh}」（影響 ${debt.impact}、成本 ${debt.cost}）`
      : `Reserve 15% of next sprint for tech debt ${debt.id} "${debt.title.en}" (impact ${debt.impact}, cost ${debt.cost})`);
  }
  const pending = state.requests.filter((r) => r.status === 'new');
  if (pending.length) {
    asks.push(zh
      ? `${pending.length} 件跨部門需求待評估：${pending.map((r) => r.id).join('、')}`
      : `${pending.length} cross-team requests await evaluation: ${pending.map((r) => r.id).join(', ')}`);
  }

  const pctDone = stats.committed ? Math.round((stats.done / stats.committed) * 100) : 0;
  const headline = zh
    ? `${sprint.name} 完成 ${stats.done}／${stats.committed} 點（${pctDone}%），${stats.gap > 5 ? `落後理想線 ${stats.gap} 點` : '進度符合預期'}；${incident ? '有一起線上事件處理中' : '本週沒有進行中的線上事件'}。`
    : `${sprint.name} has completed ${stats.done}/${stats.committed} points (${pctDone}%), ${stats.gap > 5 ? `${stats.gap} points behind the ideal line` : 'on pace'}; ${incident ? 'one production incident is in progress' : 'no production incident is open'}.`;

  const order = { high: 0, med: 1, low: 2 };
  risks.sort((a, b) => order[a.level] - order[b.level]);
  return { risks, asks, headline };
}

function metricRow(state: AppState, key: MetricKey, lang: Lang): string {
  const meta = METRIC_META[key];
  const cur = state.metrics[state.metrics.length - 1][key];
  const prev = state.metrics[state.metrics.length - 2][key];
  const diff = Math.round((cur - prev) * 10) / 10;
  const improved = meta.better === 'higher' ? diff > 0 : diff < 0;
  const verdict = diff === 0 ? (lang === 'zh' ? '持平' : 'flat') : improved ? (lang === 'zh' ? '改善' : 'better') : lang === 'zh' ? '退步' : 'worse';
  const note = lang === 'zh' ? `（${verdict}）` : ` (${verdict})`;
  return `| ${meta.label[lang]} | ${cur} ${meta.unit[lang]} | ${prev} | ${diff > 0 ? '+' : ''}${diff}${note} |`;
}

/** 產生 Markdown 週報（風險與資源需求報告）。 */
export function generateWeeklyReport(state: AppState, lang: Lang): string {
  const zh = lang === 'zh';
  const { risks, asks, headline } = analyze(state, lang);
  const name = (id: string) => state.members.find((m) => m.id === id)?.name[lang] ?? id;
  const light = { onTrack: '🟢', atRisk: '🟡', offTrack: '🔴' };
  const levelText = { high: zh ? '高' : 'High', med: zh ? '中' : 'Med', low: zh ? '低' : 'Low' };
  const projects = state.projects.map((p) => {
    const next = p.milestones.find((m) => m.date >= DEMO_TODAY);
    const ms = next ? (zh ? `，下個里程碑 ${shortDate(next.date)} ${next.name.zh}` : `, next milestone ${shortDate(next.date)} ${next.name.en}`) : '';
    return `- ${light[p.status]} ${p.name[lang]}${zh ? '：' : ': '}${p.progress}%${zh ? '，負責人 ' : ', owner '}${name(p.owner)}${ms}`;
  });
  const done = state.tasks.filter((t) => t.sprintId === activeSprint(state).id && t.status === 'done');
  const next = state.tasks.filter((t) => t.status === 'progress' && t.priority === 'P0');

  const out = zh
    ? [
      `# 研發週報｜${DEMO_TODAY} 當週`, '', '> 由「AI 週報助理」依規則從 Demo 資料產生，未呼叫任何 LLM。所有資料皆為虛構。', '',
      '## 一句話摘要', headline, '',
      '## 工程指標（與前一週比較）', '| 指標 | 本週 | 前週 | 變化 |', '| --- | --- | --- | --- |', ...METRIC_KEYS.map((k) => metricRow(state, k, lang)), '',
      '## 專案進度', ...projects, '',
      '## 風險', ...(risks.length ? risks.map((r, i) => `${i + 1}. 【${levelText[r.level]}】${r.text}`) : ['目前沒有需要上報的風險。']), '',
      '## 資源需求與建議', ...(asks.length ? asks.map((a) => `- ${a}`) : ['- 本週沒有額外的資源需求。']), '',
      '## 本週完成', ...(done.length ? done.map((t) => `- ${t.id} ${t.title.zh}（${t.points} 點）`) : ['- 尚無完成項目']), '',
      '## 下週重點', ...(next.length ? next.map((t) => `- ${t.id} ${t.title.zh}（${t.assignee ? name(t.assignee) : '未指派'}）`) : ['- 依 Sprint 目標推進']),
    ]
    : [
      `# Engineering weekly report | week of ${DEMO_TODAY}`, '', '> Generated by the AI report assistant from demo data using rules only. No LLM was called. All data is fictional.', '',
      '## One-line summary', headline, '',
      '## Engineering metrics (vs. previous week)', '| Metric | This week | Last week | Change |', '| --- | --- | --- | --- |', ...METRIC_KEYS.map((k) => metricRow(state, k, lang)), '',
      '## Project status', ...projects, '',
      '## Risks', ...(risks.length ? risks.map((r, i) => `${i + 1}. [${levelText[r.level]}] ${r.text}`) : ['Nothing to escalate this week.']), '',
      '## Resource needs and suggestions', ...(asks.length ? asks.map((a) => `- ${a}`) : ['- No extra resources needed this week.']), '',
      '## Completed this week', ...(done.length ? done.map((t) => `- ${t.id} ${t.title.en} (${t.points} pts)`) : ['- Nothing completed yet']), '',
      '## Focus for next week', ...(next.length ? next.map((t) => `- ${t.id} ${t.title.en} (${t.assignee ? name(t.assignee) : 'unassigned'})`) : ['- Keep moving on the sprint goal']),
    ];
  return out.join('\n');
}
