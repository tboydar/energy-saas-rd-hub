import { describe, expect, test } from 'bun:test';
import { draftFeedback } from '../../src/ai/feedback';
import { minutesToRecover, postmortemTemplate } from '../../src/ai/postmortem';
import { analyze, generateWeeklyReport } from '../../src/ai/weeklyReport';
import { buildInitialState } from '../../src/mock';

describe('規則式的週報', () => {
  test('抓出過載的成員，並建議把還沒開始的任務轉給同組有餘裕的人', () => {
    const { risks, asks } = analyze(buildInitialState(), 'zh');
    expect(risks.some((r) => r.text.includes('游承翰') && r.text.includes('138%'))).toBe(true);
    expect(asks.some((a) => a.includes('T-206') && a.includes('阮心妍'))).toBe(true);
  });

  test('Sprint 落後與卡在 Review 的點數會被列為風險', () => {
    const { risks, headline } = analyze(buildInitialState(), 'zh');
    expect(risks.some((r) => r.text.includes('落後理想線 18 點') && r.text.includes('18 點卡在 Review'))).toBe(true);
    expect(headline).toContain('29／94');
  });

  test('有線上事件時，它排在風險清單的第一項', () => {
    const state = buildInitialState();
    state.incidents[0].stage = 'triggered';
    const { risks } = analyze(state, 'zh');
    expect(risks[0].level).toBe('high');
    expect(risks[0].text).toContain(state.incidents[0].id);
  });

  test('資料變了，週報內容跟著變', () => {
    const state = buildInitialState();
    const before = generateWeeklyReport(state, 'zh');
    state.tasks.find((t) => t.id === 'T-101')!.status = 'done';
    expect(generateWeeklyReport(state, 'zh')).not.toBe(before);
  });

  test('輸出是 Markdown，沒有 emoji；英文版沒有中文字', () => {
    const state = buildInitialState();
    const zh = generateWeeklyReport(state, 'zh');
    expect(zh.startsWith('# 研發週報')).toBe(true);
    expect(zh).toContain('| 指標 | 本週 | 前週 | 變化 |');
    expect(zh).not.toMatch(/\p{Extended_Pictographic}/u);
    const en = generateWeeklyReport(state, 'en');
    expect(en.startsWith('# Engineering weekly report')).toBe(true);
    expect(en).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe('回饋草稿與事後檢討範本', () => {
  test('回饋草稿只列資料裡有的事實', () => {
    const state = buildInitialState();
    const text = draftFeedback(state, state.members.find((m) => m.id === 'm6')!, 'zh');
    expect(text).toContain('游承翰');
    expect(text).toContain('目前負載 138%');
    expect(text).toContain('技能評分最高的兩項：資料工程、資料科學');
  });

  test('復原時間：一般事件以分鐘計；Demo 內模擬的事件 1 秒算 1 分鐘', () => {
    const state = buildInitialState();
    const real = state.incidents.find((i) => i.id === 'INC-2041')!;
    expect(minutesToRecover(real)).toBe(42);
    expect(minutesToRecover({ ...real, startedAt: '2026-11-23T00:00:00.000Z', recoveredAt: '2026-11-23T00:00:37.000Z', compressed: true })).toBe(37);
    expect(minutesToRecover({ ...real, recoveredAt: undefined })).toBeNull();
  });

  test('事後檢討範本帶入事件編號、設備與時間軸', () => {
    const state = buildInitialState();
    const incident = state.incidents.find((i) => i.id === 'INC-2041')!;
    const text = postmortemTemplate(state, incident, 'zh');
    expect(text).toContain('# 事後檢討：INC-2041');
    expect(text).toContain('TNK-01');
    expect(text).toContain('復原時間：42 分鐘');
    expect(text.split('\n').filter((l) => l.startsWith('| ') && l.includes('紀語彤')).length).toBeGreaterThan(0);
  });
});
