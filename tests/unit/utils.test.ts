import { describe, expect, test } from 'bun:test';
import { addDays, daysBetween, shortDate, workdays } from '../../src/core/date';
import { currentRoute, href } from '../../src/core/router';
import { compact, esc, html, num, raw } from '../../src/ui/dom';

describe('日期工具', () => {
  test('addDays 會跨月、跨年', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-16', -14)).toBe('2026-11-02');
  });

  test('daysBetween 與 shortDate', () => {
    expect(daysBetween('2026-10-05', '2027-01-17')).toBe(104);
    expect(shortDate('2026-11-06')).toBe('11/6');
  });

  test('workdays 跳過六日：兩週的 Sprint 有 10 個工作日', () => {
    const days = workdays('2026-11-16', '2026-11-27');
    expect(days).toHaveLength(10);
    expect(days).not.toContain('2026-11-21');
    expect(days).not.toContain('2026-11-22');
  });
});

describe('HTML 樣板（防 XSS）', () => {
  test('插入的值一律跳脫', () => {
    const evil = '<img src=x onerror="alert(1)">';
    const out = html`<p>${evil}</p>`.s;
    expect(out).toBe('<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
    expect(out).not.toContain('<img');
  });

  test('另一段 html`` 與 raw() 原樣插入；陣列逐項處理；false 與 null 不輸出', () => {
    const item = (s: string) => html`<li>${s}</li>`;
    expect(html`<ul>${['a', '<b>'].map(item)}</ul>`.s).toBe('<ul><li>a</li><li>&lt;b&gt;</li></ul>');
    expect(html`<i>${raw('<br>')}</i>`.s).toBe('<i><br></i>');
    expect(html`<s>${false}${null}${undefined}</s>`.s).toBe('<s></s>');
  });

  test('esc 處理五個特殊字元', () => {
    expect(esc(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  test('數字格式', () => {
    expect(num(3480)).toBe('3,480');
    expect(num(7.2, 1)).toBe('7.2');
    expect(compact(300_000_000, 'zh')).toBe('3.00 億');
    expect(compact(300_000_000, 'en')).toBe('300.0M');
    expect(compact(12_280_000, 'zh')).toBe('1228.0 萬');
  });
});

describe('hash 路由', () => {
  test('href 組出帶查詢參數的連結', () => {
    expect(href('/projects', { tab: 'kanban', task: 'T-101' })).toBe('#/projects?tab=kanban&task=T-101');
    expect(href('/team')).toBe('#/team');
  });

  test('currentRoute 解析路徑與查詢參數；沒有 hash 時是總覽', () => {
    location.hash = '';
    expect(currentRoute().path).toBe('/dashboard');
    location.hash = '#/projects?tab=okr';
    const route = currentRoute();
    expect(route.path).toBe('/projects');
    expect(route.query.get('tab')).toBe('okr');
    location.hash = '';
  });
});
