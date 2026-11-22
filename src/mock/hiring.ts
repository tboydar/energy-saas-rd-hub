import type { Candidate, HiringStage, Position } from '../core/types';
import type { Rng } from './rng';
import { L } from './util';

export const HIRING_STAGES: HiringStage[] = ['applied', 'screen', 'tech', 'final', 'offer'];

// 招募漏斗：人數由 seeded RNG 逐階段遞減產生；候選人只用代號，不放任何姓名。
export function buildPositions(rng: Rng): Position[] {
  const funnel = (applied: number): Record<HiringStage, number> => {
    const screen = Math.round(applied * rng.float(0.35, 0.5));
    const tech = Math.round(screen * rng.float(0.4, 0.55));
    const final = Math.max(1, Math.round(tech * rng.float(0.35, 0.55)));
    const offer = rng.int(0, 1);
    return { applied, screen, tech, final, offer };
  };
  return [
    { id: 'pos1', title: L('資深資料工程師', 'Senior Data Engineer'), squad: 'platform', openDays: rng.int(30, 45), funnel: funnel(rng.int(38, 52)) },
    { id: 'pos2', title: L('機器學習工程師', 'Machine Learning Engineer'), squad: 'analytics', openDays: rng.int(14, 28), funnel: funnel(rng.int(24, 34)) },
    { id: 'pos3', title: L('前端工程師', 'Frontend Engineer'), squad: 'saas', openDays: rng.int(6, 12), funnel: funnel(rng.int(16, 24)) },
  ];
}

export function buildCandidates(): Candidate[] {
  return [
    { id: 'c1', alias: L('候選人 A', 'Candidate A'), positionId: 'pos1', stage: 'final', note: L('串流處理經驗紮實，系統設計面試表現突出', 'Strong streaming background, stood out in system design') },
    { id: 'c2', alias: L('候選人 B', 'Candidate B'), positionId: 'pos1', stage: 'tech', note: L('資料建模佳，需確認 on-call 意願', 'Good data modeling; confirm willingness for on-call') },
    { id: 'c3', alias: L('候選人 C', 'Candidate C'), positionId: 'pos2', stage: 'tech', note: L('有時序預測專案經驗', 'Has shipped time-series forecasting projects') },
    { id: 'c4', alias: L('候選人 D', 'Candidate D'), positionId: 'pos2', stage: 'screen', note: L('轉職背景，學習曲線快', 'Career changer with a steep learning curve') },
    { id: 'c5', alias: L('候選人 E', 'Candidate E'), positionId: 'pos3', stage: 'screen', note: L('資料視覺化作品集完整', 'Solid data-visualization portfolio') },
    { id: 'c6', alias: L('候選人 F', 'Candidate F'), positionId: 'pos1', stage: 'offer', note: L('已口頭接受，等待到職日確認', 'Verbally accepted; start date pending') },
  ];
}
