import { beforeEach, describe, expect, test } from 'bun:test';
import { advanceIncident, currentIncident, triggerIncident } from '../../src/core/incident';
import { activeRun, approveRelease, finishRunningStage, retryFailedStage, startRun } from '../../src/core/pipeline';
import { activeIncident } from '../../src/core/selectors';
import { store } from '../../src/core/store';

beforeEach(() => {
  store.reset();
  store.setPrefs({ role: 'manager', lang: 'zh' });
});

describe('線上事件的流程', () => {
  test('觸發 → 指派 → 處理 → 恢復 → 事後檢討 → 結案', () => {
    expect(currentIncident()).toBeUndefined();
    const id = triggerIncident(0);
    expect(id).toMatch(/^INC-\d+$/);
    expect(currentIncident()?.stage).toBe('triggered');
    expect(activeIncident(store.state)?.id).toBe(id);

    expect(advanceIncident(id, 'm5')).toBe('assigned');
    expect(currentIncident()?.commander).toBe('m5');
    expect(advanceIncident(id)).toBe('mitigating');
    expect(advanceIncident(id)).toBe('recovered');
    expect(currentIncident()?.recoveredAt).toBeDefined();
    // 恢復之後就不再影響即時模擬
    expect(activeIncident(store.state)).toBeUndefined();

    expect(advanceIncident(id)).toBe('postmortem');
    expect(currentIncident()?.postmortem).toContain(`# 事後檢討：${id}`);
    expect(advanceIncident(id)).toBe('closed');
    expect(currentIncident()).toBeUndefined();
    expect(advanceIncident(id)).toBeNull();

    const stages = store.state.incidents.find((i) => i.id === id)!.timeline.map((e) => e.stage);
    expect(stages).toEqual(['triggered', 'assigned', 'mitigating', 'recovered', 'postmortem', 'closed']);
  });
});

describe('CI/CD Pipeline 的流程', () => {
  test('Test 第一次失敗，重跑後通過；上 Production 前要核准', () => {
    expect(activeRun()).toBeUndefined();
    const id = startRun({ zh: '測試用變更', en: 'Test change' }, 'm4');
    const stage = (name: string) => store.state.pipelineRuns.find((r) => r.id === id)!.stages.find((s) => s.name === name)!.status;

    expect(finishRunningStage(id)).toBe('next');
    expect(stage('build')).toBe('pass');
    expect(stage('test')).toBe('running');

    expect(finishRunningStage(id)).toBe('failed');
    expect(stage('test')).toBe('fail');
    // 失敗時沒有東西在跑，再呼叫不會前進
    expect(finishRunningStage(id)).toBe('none');

    retryFailedStage(id);
    expect(store.state.pipelineRuns.find((r) => r.id === id)!.attempts).toBe(2);
    expect(finishRunningStage(id)).toBe('next');
    expect(stage('staging')).toBe('running');

    expect(finishRunningStage(id)).toBe('waiting');
    expect(stage('prod')).toBe('waiting');
    expect(finishRunningStage(id)).toBe('none');

    approveRelease(id, 'manager');
    expect(stage('prod')).toBe('running');
    expect(finishRunningStage(id)).toBe('done');
    expect(activeRun()).toBeUndefined();
    expect(store.state.pipelineRuns.find((r) => r.id === id)!.approvedBy).toBe('manager');
  });
});

describe('store', () => {
  test('update 會寫進 localStorage；reset 回到初始資料', () => {
    const initial = JSON.stringify(store.state);
    store.update((s) => { s.tasks[0].status = 'done'; });
    expect(JSON.parse(localStorage.getItem('esrd:state:v1')!).tasks[0].status).toBe('done');
    store.reset();
    expect(JSON.stringify(store.state)).toBe(initial);
    expect(localStorage.getItem('esrd:state:v1')).toBe(initial);
  });

  test('nextId 產生遞增的流水號', () => {
    const a = store.nextId('task', 'T-');
    const b = store.nextId('task', 'T-');
    expect(Number(b.slice(2))).toBe(Number(a.slice(2)) + 1);
  });
});
