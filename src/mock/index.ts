import type { AppState } from '../core/types';
import { DEFAULT_MATRIX } from '../core/rbac';
import { buildAdrs } from './adrs';
import { buildDevices } from './devices';
import { buildDebts, buildPipelineRuns, buildQuality, buildReviews } from './governance';
import { buildCandidates, buildPositions } from './hiring';
import { buildIncidents } from './incidents';
import { buildMembers } from './members';
import { buildMetrics } from './metrics';
import { buildObjectives, buildRoadmap } from './okrs';
import { buildProjects } from './projects';
import { buildRequests } from './requests';
import { DEFAULT_SEED, forkRng } from './rng';
import { buildSprints, buildStandups } from './sprints';
import { buildTasks } from './tasks';

/** 資料結構有不相容的變更時把這個數字加一，舊的 localStorage 就會自動重建。 */
export const STATE_VERSION = 1;

/** 用固定 seed 產生整份初始資料。同一個 seed 的結果永遠相同。 */
export function buildInitialState(seed: number = DEFAULT_SEED): AppState {
  const tasks = buildTasks();
  return {
    version: STATE_VERSION,
    seed,
    members: buildMembers(),
    projects: buildProjects(),
    tasks,
    sprints: buildSprints(forkRng(seed, 'sprints'), tasks),
    objectives: buildObjectives(),
    roadmap: buildRoadmap(),
    adrs: buildAdrs(),
    incidents: buildIncidents(),
    metrics: buildMetrics(forkRng(seed, 'metrics')),
    devices: buildDevices(forkRng(seed, 'devices')),
    reviews: buildReviews(forkRng(seed, 'reviews')),
    debts: buildDebts(),
    quality: buildQuality(forkRng(seed, 'quality')),
    pipelineRuns: buildPipelineRuns(forkRng(seed, 'pipeline')),
    requests: buildRequests(),
    positions: buildPositions(forkRng(seed, 'hiring')),
    candidates: buildCandidates(),
    standups: buildStandups(),
    rbac: structuredClone(DEFAULT_MATRIX),
    weeklyReport: '',
    counters: { task: 700, req: 34, adr: 7, inc: 2042, run: 319 },
  };
}
