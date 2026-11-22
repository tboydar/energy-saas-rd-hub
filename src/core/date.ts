// 日期工具：一律用「本地時間的 YYYY-MM-DD」，避免時區換日造成的偏移。

/** Demo 的基準日：mock data 的日期都以這天推算，所以每次重設結果一致。 */
export const DEMO_TODAY = '2026-11-23';

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

/** 兩個日期之間的工作日清單（含頭尾，跳過六日）。 */
export function workdays(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const wd = parseDate(d).getDay();
    if (wd !== 0 && wd !== 6) out.push(d);
  }
  return out;
}

export function shortDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function nowStamp(): string {
  return new Date().toISOString();
}

export function clock(isoStamp: string): string {
  const d = new Date(isoStamp);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
