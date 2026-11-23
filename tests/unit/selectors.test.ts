import { describe, expect, test } from 'bun:test';
import { activeIncident, activeSprint, memberLoad, sprintStats } from '../../src/core/selectors';
import { buildInitialState } from '../../src/mock';

describe('推導資料', () => {
  test('負載 = 承諾點數 ÷ 容量，超過 100% 是過載', () => {
    const state = buildInitialState();
    const load = (id: string) => memberLoad(state, state.members.find((m) => m.id === id)!);
    expect(load('m6')).toMatchObject({ committed: 18, capacity: 13, pct: 138, level: 'over' });
    expect(load('m7')).toMatchObject({ pct: 50, level: 'low' });
    expect(load('m2')).toMatchObject({ pct: 80, level: 'ok' });
  });

  test('進行中的 Sprint：承諾、完成、Review 中與落後的點數', () => {
    const state = buildInitialState();
    const st = sprintStats(state, activeSprint(state));
    expect(st.sprint.name).toBe('Sprint 24');
    expect(st).toMatchObject({ committed: 94, done: 29, inReview: 18, remaining: 65, capacity: 97, gap: 18 });
    expect(st.ideal[0]).toBe(94);
    expect(st.ideal[st.ideal.length - 1]).toBe(0);
    expect(st.actual[st.todayIndex]).toBe(65);
    expect(st.actual[st.todayIndex + 1]).toBeNull();
  });

  test('把任務移到 Done，燃盡圖今天的點就會下降', () => {
    const state = buildInitialState();
    state.tasks.find((t) => t.id === 'T-101')!.status = 'done';
    const st = sprintStats(state, activeSprint(state));
    expect(st.done).toBe(37);
    expect(st.gap).toBe(10);
  });

  test('已結束的 Sprint 用當時記錄的數字', () => {
    const state = buildInitialState();
    const past = state.sprints.find((s) => s.status === 'done')!;
    const st = sprintStats(state, past);
    expect(st.committed).toBe(past.committed);
    expect(st.actual[0]).toBe(past.committed);
  });

  test('一開始沒有進行中的事件；觸發後才有', () => {
    const state = buildInitialState();
    expect(activeIncident(state)).toBeUndefined();
    state.incidents[0].stage = 'mitigating';
    expect(activeIncident(state)?.id).toBe(state.incidents[0].id);
    state.incidents[0].stage = 'recovered';
    expect(activeIncident(state)).toBeUndefined();
  });
});
