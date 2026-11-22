import { STAGE_ORDER } from '../mock/governance';
import { nowStamp } from './date';
import { store } from './store';
import type { L10n, PipelineRun, StageName } from './types';

// CI/CD Pipeline 的模擬：build → test → staging →（人工核准）→ prod。
// Test 階段第一次一定失敗（模擬不穩定測試），重跑後通過；prod 前要有人核准。

/** 每個階段在畫面上跑多久（毫秒）。 */
export const STAGE_MS: Record<StageName, number> = { build: 1500, test: 2300, staging: 1900, prod: 1900 };
const STAGE_SECONDS: Record<StageName, [number, number]> = { build: [70, 95], test: [210, 280], staging: [120, 160], prod: [90, 130] };

/** 還沒跑完的那一次執行（一次只會有一個）。 */
export function activeRun(): PipelineRun | undefined {
  return store.state.pipelineRuns.find((r) => r.stages.some((s) => s.status !== 'pass'));
}

export function startRun(title: L10n, author: string): string {
  const id = store.nextId('run', 'RUN-');
  const commit = Math.floor(Math.random() * 0xfffffff).toString(16).padStart(7, '0');
  store.update((s) => {
    s.pipelineRuns.unshift({
      id, title, commit, author, startedAt: nowStamp(), attempts: 1,
      stages: STAGE_ORDER.map((name, i) => ({ name, status: i === 0 ? 'running' : 'pending', seconds: 0 })),
    });
  });
  return id;
}

export type StepResult = 'next' | 'failed' | 'waiting' | 'done' | 'none';

/** 讓「執行中」的階段跑完，並決定接下來發生什麼。 */
export function finishRunningStage(runId: string): StepResult {
  const run = store.state.pipelineRuns.find((r) => r.id === runId);
  const index = run?.stages.findIndex((s) => s.status === 'running') ?? -1;
  if (!run || index < 0) return 'none';
  let result: StepResult = 'next';
  store.update((s) => {
    const target = s.pipelineRuns.find((r) => r.id === runId)!;
    const stage = target.stages[index];
    const [lo, hi] = STAGE_SECONDS[stage.name];
    stage.seconds = lo + Math.floor(Math.random() * (hi - lo));
    if (stage.name === 'test' && target.attempts === 1) {
      stage.status = 'fail';
      result = 'failed';
      return;
    }
    stage.status = 'pass';
    const next = target.stages[index + 1];
    if (!next) {
      result = 'done';
    } else if (next.name === 'prod' && !target.approvedBy) {
      next.status = 'waiting';
      result = 'waiting';
    } else {
      next.status = 'running';
    }
  });
  return result;
}

export function retryFailedStage(runId: string): void {
  store.update((s) => {
    const run = s.pipelineRuns.find((r) => r.id === runId);
    const stage = run?.stages.find((x) => x.status === 'fail');
    if (run && stage) {
      run.attempts += 1;
      stage.status = 'running';
    }
  });
}

export function approveRelease(runId: string, by: string): void {
  store.update((s) => {
    const run = s.pipelineRuns.find((r) => r.id === runId);
    const prod = run?.stages.find((x) => x.name === 'prod');
    if (run && prod?.status === 'waiting') {
      run.approvedBy = by;
      prod.status = 'running';
    }
  });
}
