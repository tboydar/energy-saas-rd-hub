import type { L10n } from '../core/types';

/** 建立一段雙語文字。 */
export const L = (zh: string, en: string): L10n => ({ zh, en });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const round1 = (n: number) => Math.round(n * 10) / 10;
