import { postmortemTemplate } from '../ai/postmortem';
import { SCENARIOS } from '../mock/incidents';
import { actorId } from './auth';
import { nowStamp } from './date';
import { getLang } from './i18n';
import { store } from './store';
import type { Incident, IncidentStage } from './types';

// 線上事件的狀態機：觸發 → 指派 → 處理 → 恢復 → 事後檢討 → 結案。
// 事件還沒「恢復」之前，即時模擬引擎會讓對應設備的延遲與錯誤率升高，3D 場景也會閃紅燈。

export const INCIDENT_STAGES: IncidentStage[] = ['triggered', 'assigned', 'mitigating', 'recovered', 'postmortem', 'closed'];

export function nextStage(stage: IncidentStage): IncidentStage | null {
  return INCIDENT_STAGES[INCIDENT_STAGES.indexOf(stage) + 1] ?? null;
}

/** 目前要處理的事件：最近一筆還沒結案的。 */
export function currentIncident(): Incident | undefined {
  return store.state.incidents.find((i) => i.stage !== 'closed');
}

export function triggerIncident(scenarioIndex: number): string {
  const sc = SCENARIOS[scenarioIndex] ?? SCENARIOS[0];
  const at = nowStamp();
  const id = store.nextId('inc', 'INC-');
  store.update((s) => {
    s.incidents.unshift({
      id, title: sc.title, severity: sc.severity, deviceId: sc.deviceId, stage: 'triggered', commander: null,
      impact: sc.impact, rootCause: sc.rootCause, mitigation: sc.mitigation,
      startedAt: at, timeline: [{ stage: 'triggered', at, by: 'system' }], postmortem: '', compressed: true,
    });
  });
  return id;
}

/** 把事件推進到下一個階段。指派階段需要指定事件指揮官。 */
export function advanceIncident(id: string, commander?: string): IncidentStage | null {
  const incident = store.state.incidents.find((i) => i.id === id);
  const next = incident ? nextStage(incident.stage) : null;
  if (!incident || !next) return null;
  const at = nowStamp();
  store.update((s) => {
    const target = s.incidents.find((i) => i.id === id)!;
    if (next === 'assigned' && commander) target.commander = commander;
    if (next === 'recovered') target.recoveredAt = at;
    target.stage = next;
    target.timeline.push({ stage: next, at, by: actorId() });
    if (next === 'postmortem' && !target.postmortem) target.postmortem = postmortemTemplate(s, target, getLang());
  });
  return next;
}
