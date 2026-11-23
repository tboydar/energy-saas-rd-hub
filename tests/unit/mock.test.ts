import { describe, expect, test } from 'bun:test';
import { buildInitialState } from '../../src/mock';

describe('mock data', () => {
  const state = buildInitialState();

  test('固定 seed：每次產生的資料完全相同', () => {
    expect(JSON.stringify(buildInitialState())).toBe(JSON.stringify(state));
  });

  test('換一個 seed，亂數產生的指標就不同', () => {
    expect(JSON.stringify(buildInitialState(1).metrics)).not.toBe(JSON.stringify(state.metrics));
  });

  test('規格要求的數量：8 位成員、12 週指標、6 個設備', () => {
    expect(state.members).toHaveLength(8);
    expect(state.metrics).toHaveLength(12);
    expect(state.devices).toHaveLength(6);
  });

  test('規格點名的四個專案都在', () => {
    const names = state.projects.map((p) => p.name.zh);
    for (const n of ['時序資料管線重構', '異常偵測 v2', '客戶報表 SaaS 化', 'K8s 成本優化']) expect(names).toContain(n);
  });

  test('資料之間的參照都對得上', () => {
    const members = new Set(state.members.map((m) => m.id));
    const projects = new Set(state.projects.map((p) => p.id));
    const objectives = new Set(state.objectives.map((o) => o.id));
    const devices = new Set(state.devices.map((d) => d.id));
    for (const t of state.tasks) {
      expect(projects.has(t.projectId)).toBe(true);
      if (t.assignee) expect(members.has(t.assignee)).toBe(true);
      if (t.deviceId) expect(devices.has(t.deviceId)).toBe(true);
    }
    for (const p of state.projects) {
      expect(members.has(p.owner)).toBe(true);
      expect(objectives.has(p.objectiveId)).toBe(true);
    }
    for (const r of state.roadmap) expect(objectives.has(r.objectiveId)).toBe(true);
    for (const r of state.reviews) if (r.taskId) expect(state.tasks.some((t) => t.id === r.taskId)).toBe(true);
  });

  test('每筆雙語文字都有中文與英文，英文裡沒有中文字', () => {
    const walk = (v: unknown): void => {
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      if (typeof o.zh === 'string' && typeof o.en === 'string') {
        expect(o.zh.length).toBeGreaterThan(0);
        expect(o.en).not.toMatch(/[\u4e00-\u9fff]/);
        return;
      }
      Object.values(o).forEach(walk);
    };
    walk(state);
  });

  test('假資料裡沒有 email、電話或身分證字號樣式', () => {
    const text = JSON.stringify(state);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(text).not.toMatch(/09\d{2}[- ]?\d{3}[- ]?\d{3}/);
    expect(text).not.toMatch(/\b[A-Z][12]\d{8}\b/);
  });
});
