import { en } from '../i18n/en';
import { zh, type I18nKey } from '../i18n/zh';
import type { L10n, Lang } from './types';

// 很小的 i18n：兩份字典（zh.ts / en.ts）＋ t()。
// en 的型別是 Record<I18nKey, string>，所以少翻一個 key，tsc 就會報錯。

let lang: Lang = 'zh';
const dicts: Record<Lang, Record<I18nKey, string>> = { zh, en };

export function setLang(next: Lang): void {
  lang = next;
  document.documentElement.lang = next === 'zh' ? 'zh-Hant' : 'en';
}

export function getLang(): Lang {
  return lang;
}

/** 取字典文字；可帶 {name} 形式的變數。 */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  let text: string = dicts[lang][key] ?? dicts.zh[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/** 取 mock data 或使用者輸入的雙語文字。 */
export function tx(text: L10n | undefined | null): string {
  if (!text) return '';
  // 用 ?? 而不是 ||：空字串是「刻意留空」（例如英文不需要量詞），不該退回另一種語言
  return text[lang] ?? text.zh ?? '';
}

/** 使用者輸入的內容沒有翻譯，兩種語言放同一段文字。 */
export function plain(text: string): L10n {
  return { zh: text, en: text };
}

export type { I18nKey };
