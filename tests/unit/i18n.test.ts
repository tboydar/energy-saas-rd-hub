import { describe, expect, test } from 'bun:test';
import { plain, sentences, setLang, t, tx } from '../../src/core/i18n';
import { en } from '../../src/i18n/en';
import { zh } from '../../src/i18n/zh';

/** 取出字串裡用到的變數名稱：{name} 與 {n|one|many} 兩種寫法。 */
const vars = (text: string) => [...new Set([...text.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]))].sort();

describe('i18n 字典', () => {
  test('中英文字典的 key 完全一致', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });

  test('中文字典沒有空字串', () => {
    for (const [key, value] of Object.entries(zh)) expect(value.length, key).toBeGreaterThan(0);
  });

  test('每個 key 的中英文使用同一組變數', () => {
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) expect(vars(en[key]), key).toEqual(vars(zh[key]));
  });

  test('英文字典裡沒有殘留的中文字', () => {
    for (const [key, value] of Object.entries(en)) expect(value, key).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe('t() 與輔助函式', () => {
  test('帶入變數', () => {
    setLang('zh');
    expect(t('team.sum', { n: 8, s: 3 })).toBe('8 位工程師，3 個小組。');
  });

  test('英文單複數', () => {
    setLang('en');
    expect(t('collab.count', { n: 1 })).toBe('1 item');
    expect(t('collab.count', { n: 2 })).toBe('2 items');
    expect(t('collab.sum', { n: 1 })).toBe('1 request awaits evaluation.');
    expect(t('team.sum', { n: 1, s: 1 })).toBe('1 engineer in 1 squad.');
    setLang('zh');
  });

  test('tx：空字串是刻意留空，不會退回另一種語言', () => {
    setLang('en');
    expect(tx({ zh: '件', en: '' })).toBe('');
    expect(tx({ zh: '小時', en: 'h' })).toBe('h');
    setLang('zh');
    expect(tx(undefined)).toBe('');
  });

  test('sentences：中文直接相連，英文加空格，並略過不成立的部分', () => {
    setLang('zh');
    expect(sentences('甲。', false, '乙。')).toBe('甲。乙。');
    setLang('en');
    expect(sentences('A.', undefined, 'B.')).toBe('A. B.');
    setLang('zh');
  });

  test('plain：使用者輸入在兩種語言放同一段文字', () => {
    expect(plain('你好')).toEqual({ zh: '你好', en: '你好' });
  });
});
