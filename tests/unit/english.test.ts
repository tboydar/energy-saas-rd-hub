import { describe, expect, test } from 'bun:test';
import { draftFeedback } from '../../src/ai/feedback';
import { postmortemTemplate } from '../../src/ai/postmortem';
import { generateWeeklyReport } from '../../src/ai/weeklyReport';
import { en } from '../../src/i18n/en';
import { buildInitialState } from '../../src/mock';

// 驗收：介面可切換英文。英文的文字裡不該混進中文字或全形標點。

const CJK = /[\u3000-\u303F\u30FB\u3400-\u9FFF\uFF00-\uFFEF]/;

/** 走過整份資料，找出所有 { zh, en } 形式的雙語文字裡的英文。 */
function englishTexts(value: unknown, path = 'state', out: [string, string][] = []): [string, string][] {
  if (Array.isArray(value)) value.forEach((item, i) => englishTexts(item, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.zh === 'string' && typeof record.en === 'string') out.push([path, record.en]);
    else for (const [key, child] of Object.entries(record)) englishTexts(child, `${path}.${key}`, out);
  }
  return out;
}

describe('英文內容', () => {
  const state = buildInitialState();

  test('英文字典沒有中文字或全形標點', () => {
    expect(Object.entries(en).filter(([, text]) => CJK.test(text)).map(([key]) => key)).toEqual([]);
  });

  test('假資料的英文欄位沒有中文字或全形標點', () => {
    const texts = englishTexts(state);
    expect(texts.length).toBeGreaterThan(200);
    expect(texts.filter(([, text]) => CJK.test(text)).map(([path]) => path)).toEqual([]);
  });

  test('英文的週報、事後檢討、回饋草稿沒有中文字或全形標點', () => {
    const outputs = [
      generateWeeklyReport(state, 'en'),
      ...state.incidents.map((incident) => postmortemTemplate(state, incident, 'en')),
      ...state.members.map((member) => draftFeedback(state, member, 'en')),
    ];
    const lines = outputs.flatMap((text) => text.split('\n')).filter((line) => CJK.test(line));
    expect(lines).toEqual([]);
  });
});
