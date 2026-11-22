import { DEMO_TODAY, workdays } from './date';
import type { AppState, Incident, Member, Sprint, Task } from './types';

// 從 state 推導出來的數字（負載、Sprint 統計…）。畫面與週報共用同一套算法，數字才會一致。

export function activeSprint(state: AppState): Sprint {
  return state.sprints.find((s) => s.status === 'active') ?? state.sprints[state.sprints.length - 1];
}

export function sprintTasks(state: AppState, sprintId: string): Task[] {
  return state.tasks.filter((t) => t.sprintId === sprintId);
}

export interface Load { committed: number; done: number; capacity: number; pct: number; level: 'over' | 'high' | 'ok' | 'low' }

/** 成員在進行中 Sprint 的負載：承諾點數 ÷ 容量。超過 100% 就是過載。 */
export function memberLoad(state: AppState, member: Member): Load {
  const mine = sprintTasks(state, activeSprint(state).id).filter((t) => t.assignee === member.id);
  const committed = mine.reduce((s, t) => s + t.points, 0);
  const done = mine.filter((t) => t.status === 'done').reduce((s, t) => s + t.points, 0);
  const pct = member.capacity ? Math.round((committed / member.capacity) * 100) : 0;
  const level = pct > 100 ? 'over' : pct >= 90 ? 'high' : pct < 60 ? 'low' : 'ok';
  return { committed, done, capacity: member.capacity, pct, level };
}

export interface SprintStats {
  sprint: Sprint;
  days: string[];
  todayIndex: number;
  committed: number;
  done: number;
  inReview: number;
  remaining: number;
  capacity: number;
  ideal: number[];
  actual: (number | null)[];
  /** 實際剩餘點數 − 理想剩餘點數；正數代表落後。 */
  gap: number;
}

export function sprintStats(state: AppState, sprint: Sprint): SprintStats {
  const days = workdays(sprint.start, sprint.end);
  const n = days.length;
  const capacity = state.members.filter((m) => m.active).reduce((s, m) => s + m.capacity, 0);
  if (sprint.status !== 'active') {
    const ideal = Array.from({ length: n + 1 }, (_, i) => Math.round(sprint.committed * (1 - i / n) * 10) / 10);
    const actual: (number | null)[] = Array.from({ length: n + 1 }, (_, i) => sprint.burndown[i] ?? null);
    return { sprint, days, todayIndex: sprint.status === 'done' ? n : 0, committed: sprint.committed, done: sprint.completed, inReview: 0,
      remaining: sprint.committed - sprint.completed, capacity, ideal, actual, gap: 0 };
  }
  const tasks = sprintTasks(state, sprint.id);
  const committed = tasks.reduce((s, t) => s + t.points, 0);
  const done = tasks.filter((t) => t.status === 'done').reduce((s, t) => s + t.points, 0);
  const inReview = tasks.filter((t) => t.status === 'review').reduce((s, t) => s + t.points, 0);
  const remaining = committed - done;
  const todayIndex = Math.min(n, Math.max(1, workdays(sprint.start, DEMO_TODAY).length - 1));
  const ideal = Array.from({ length: n + 1 }, (_, i) => Math.round(committed * (1 - i / n) * 10) / 10);
  const actual: (number | null)[] = Array.from({ length: n + 1 }, (_, i) => {
    if (i < todayIndex) return sprint.burndown[i] ?? null;
    return i === todayIndex ? remaining : null;
  });
  return { sprint, days, todayIndex, committed, done, inReview, remaining, capacity, ideal, actual, gap: Math.round(remaining - ideal[todayIndex]) };
}

const OPEN_STAGES = ['triggered', 'assigned', 'mitigating'];

/** 還沒恢復的事件（會影響即時模擬與 3D 場景）。 */
export function activeIncident(state: AppState): Incident | undefined {
  return state.incidents.find((i) => OPEN_STAGES.includes(i.stage));
}

export function memberById(state: AppState, id: string | null | undefined): Member | undefined {
  return id ? state.members.find((m) => m.id === id) : undefined;
}
