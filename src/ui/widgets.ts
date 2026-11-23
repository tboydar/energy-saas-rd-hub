import { can } from '../core/auth';
import { t, tx, type I18nKey } from '../core/i18n';
import type { Perm } from '../core/rbac';
import { store } from '../core/store';
import type { L10n, Member } from '../core/types';
import { html, type Safe } from './dom';
import { icon } from './icons';

// 各頁共用的小元件。

export function initials(name: L10n): string {
  const text = tx(name);
  // 中文取最後一個字（名），英文取每個單字的首字母
  if (/[\u4e00-\u9fff]/.test(text)) return text.slice(-1);
  return text.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/** 頭像的顏色代表小組（資料平台、分析與 AI、SaaS 應用），不是隨機配色。 */
export function avatar(member: Pick<Member, 'name' | 'squad'> | undefined, small = false): Safe {
  if (!member) return html`<span class="avatar ${small ? 'sm' : ''}" aria-hidden="true">?</span>`;
  return html`<span class="avatar is-${member.squad} ${small ? 'sm' : ''}" title="${tx(member.name)}" aria-hidden="true">${initials(member.name)}</span>`;
}

export interface ActionButton {
  act: string;
  label: string;
  /** 需要的權限。沒有時按鈕會顯示成上鎖，並說明缺哪個權限。 */
  perm?: Perm;
  /** 權限要看資料才能決定時（例如「只能動自己的任務」），直接給判斷結果，會覆蓋 perm 的查詢。 */
  allowed?: boolean;
  /** 與權限無關的停用（例如已經在最後一個階段）。 */
  enabled?: boolean;
  cls?: string;
  icon?: string;
  data?: Record<string, string>;
  title?: string;
}

/**
 * 依權限顯示或停用的按鈕。沒有權限時不隱藏，而是顯示成上鎖並說明缺哪個權限，
 * 這樣切換角色時可以清楚看到「誰能做什麼」。上鎖按鈕的點擊由 shell 統一攔截。
 */
export function actionBtn(o: ActionButton): Safe {
  const allowed = o.allowed ?? (o.perm ? can(o.perm) : true);
  const role = t(`role.${store.prefs.role}` as I18nKey);
  const why = allowed ? '' : t('common.locked', { role, perm: o.perm ? t(`perm.${o.perm}` as I18nKey) : o.label || o.title || '' });
  const data = Object.entries(o.data ?? {}).map(([k, v]) => html` data-${k}="${v}"`);
  const state = !allowed ? html` aria-disabled="true" data-why="${why}"` : o.enabled === false ? html` disabled` : '';
  const label = o.label || html`<span class="sr-only">${o.title ?? ''}</span>`;
  return html`<button type="button" class="btn ${o.cls ?? ''}" data-act="${o.act}"${data}${state} title="${allowed ? o.title ?? '' : why}">${!allowed ? icon('lock', 14) : o.icon ? icon(o.icon, 16) : ''}${label}</button>`;
}

export function statusChip(kind: 'ok' | 'warn' | 'crit' | 'info' | 'mute', label: string): Safe {
  return html`<span class="chip ${kind === 'mute' ? '' : `is-${kind}`}">${label}</span>`;
}

export function tabs(items: { id: string; label: string }[], active: string): Safe {
  return html`<div class="tabs" role="tablist">${items.map((i) => html`<button type="button" role="tab" class="tab" data-tab="${i.id}" aria-selected="${String(i.id === active)}">${i.label}</button>`)}</div>`;
}

/** 頁首：標題，加上一行由資料算出的現況（不是固定的介紹文字）。 */
export function pageHead(title: string, summary?: string, actions?: Safe): Safe {
  return html`<header class="page-head"><h1>${title}</h1>${summary ? html`<p class="page-sum" id="page-sum">${summary}</p>` : ''}${actions ? html`<div class="actions">${actions}</div>` : ''}</header>`;
}

/** 進度條：level 決定顏色（over 紅、high 黃、good 綠，其餘用主色）。 */
export function bar(pct: number, level: 'over' | 'high' | 'good' | 'ok' | 'low' = 'ok', label?: string): Safe {
  const cls = level === 'over' || level === 'high' || level === 'good' ? `is-${level}` : '';
  return html`<div class="bar ${cls}" role="img" aria-label="${label ?? `${pct}%`}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
}

/** 掛上一張互動流程圖（延遲載入 xyflow），回傳 Promise 方便頁面在離開時銷毀。 */
export function flowLabels(): { reset: string; hint: string } {
  return { reset: t('flow.reset'), hint: t('flow.hint') };
}
