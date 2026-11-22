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

export function avatar(member: Pick<Member, 'name' | 'hue'> | undefined, small = false): Safe {
  if (!member) return html`<span class="avatar ${small ? 'sm' : ''}" style="--h:200" aria-hidden="true">?</span>`;
  return html`<span class="avatar ${small ? 'sm' : ''}" style="--h:${member.hue}" title="${tx(member.name)}" aria-hidden="true">${initials(member.name)}</span>`;
}

export interface ActionButton {
  act: string;
  label: string;
  /** 需要的權限；也可以直接給 boolean（例如「只能動自己的任務」這種要看資料的判斷）。 */
  perm?: Perm;
  allowed?: boolean;
  cls?: string;
  icon?: string;
  data?: Record<string, string>;
  title?: string;
}

/**
 * 依權限顯示或停用的按鈕。沒有權限時不隱藏，而是顯示成停用並說明缺哪個權限，
 * 這樣切換角色時可以清楚看到「誰能做什麼」。點擊由 shell 統一攔截。
 */
export function actionBtn(o: ActionButton): Safe {
  const allowed = o.allowed ?? (o.perm ? can(o.perm) : true);
  const why = !allowed && o.perm
    ? t('common.locked', { role: t(`role.${store.prefs.role}` as I18nKey), perm: t(`perm.${o.perm}` as I18nKey) })
    : '';
  const data = Object.entries(o.data ?? {}).map(([k, v]) => html` data-${k}="${v}"`);
  return html`<button type="button" class="btn ${o.cls ?? ''}" data-act="${o.act}"${data} ${allowed ? '' : html`aria-disabled="true" data-why="${why || t('common.locked', { role: t(`role.${store.prefs.role}` as I18nKey), perm: o.label })}"`} title="${allowed ? o.title ?? '' : why}">${!allowed ? icon('lock', 14) : o.icon ? icon(o.icon, 16) : ''}${o.label}</button>`;
}

export function statusChip(kind: 'ok' | 'warn' | 'crit' | 'info' | 'mute', label: string): Safe {
  return html`<span class="chip ${kind === 'mute' ? '' : `is-${kind}`}">${label}</span>`;
}
