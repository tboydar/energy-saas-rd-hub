import { can } from '../core/auth';
import { t, type I18nKey } from '../core/i18n';
import { DEFAULT_MATRIX, isLocked, PERM_GROUPS, ROLES, type Perm } from '../core/rbac';
import { store } from '../core/store';
import type { RoleId } from '../core/types';
import { html, on, raw, setHtml, toast, type Safe } from '../ui/dom';
import { icon } from '../ui/icons';
import { actionBtn, pageHead } from '../ui/widgets';

// 權限矩陣：把 RBAC 畫成一張「角色 × 權限」的表。管理員可以直接修改，全站立即生效。

export function mount(root: HTMLElement): () => void {
  function cell(role: RoleId, perm: Perm, edit: boolean): Safe {
    const has = store.state.rbac[role].includes(perm);
    const locked = isLocked(role, perm);
    const label = `${t(`role.${role}` as I18nKey)}: ${t(`perm.${perm}` as I18nKey)}`;
    if (edit && !locked) return html`<input type="checkbox" data-role="${role}" data-perm="${perm}" ${has ? raw('checked') : ''} aria-label="${label}" />`;
    if (locked) return html`<span class="yes" title="${t('rbac.fixed')}">${icon('lock', 16)}<span class="sr-only">${t('rbac.fixed')}</span></span>`;
    return has
      ? html`<span class="yes" title="${t('rbac.yes')}">${icon('check', 18)}<span class="sr-only">${t('rbac.yes')}</span></span>`
      : html`<span class="no" title="${t('rbac.no')}">—<span class="sr-only">${t('rbac.no')}</span></span>`;
  }

  function render(): void {
    const edit = can('rbac.edit');
    const current = store.prefs.role;
    setHtml(root, html`<div class="page">
      ${pageHead(t('nav.rbac'), t('rbac.lead'), actionBtn({ act: 'reset', label: t('rbac.reset'), perm: 'rbac.edit', icon: 'reset' }))}
      <div class="banner is-info">${icon(edit ? 'about' : 'lock')}<span>${edit ? t('rbac.editHint') : t('rbac.readonly', { perm: t('perm.rbac.edit'), role: t(`role.${current}` as I18nKey) })}</span></div>
      <section class="panel"><div class="table-wrap"><table class="table rbac">
        <thead><tr><th>${t('rbac.perm')}</th>${ROLES.map((r) => html`<th class="${r === current ? 'is-current' : ''}"><b>${t(`role.${r}` as I18nKey)}</b><p>${t(`rbac.desc.${r}` as I18nKey)}</p>
          ${r === current ? html`<span class="chip is-info">${t('rbac.current')}</span>` : html`<button type="button" class="btn btn-sm" data-signin="${r}">${t('rbac.signIn')}</button>`}
          <div class="small muted" style="margin-top:6px">${t('rbac.count', { n: store.state.rbac[r].length })}</div></th>`)}</tr></thead>
        <tbody>${PERM_GROUPS.map((g) => html`<tr class="group"><td colspan="${ROLES.length + 1}">${t(`rbac.group.${g.key}` as I18nKey)}</td></tr>
          ${g.perms.map((p) => html`<tr><td>${t(`perm.${p}` as I18nKey)}</td>${ROLES.map((r) => html`<td class="${r === current ? 'is-current' : ''}">${cell(r, p, edit)}</td>`)}</tr>`)}`)}</tbody>
      </table></div></section>
    </div>`);
  }

  const offs = [
    on(root, 'change', '[data-perm]', (_e, el) => {
      const role = el.dataset.role as RoleId;
      const perm = el.dataset.perm as Perm;
      const on = (el as HTMLInputElement).checked;
      store.update((s) => { s.rbac[role] = on ? [...new Set([...s.rbac[role], perm])] : s.rbac[role].filter((p) => p !== perm); });
      toast(t('rbac.changed', { role: t(`role.${role}` as I18nKey), perm: t(`perm.${perm}` as I18nKey) }));
    }),
    on(root, 'click', '[data-signin]', (_e, el) => store.setPrefs({ role: el.dataset.signin as RoleId })),
    on(root, 'click', '[data-act="reset"]', () => {
      store.update((s) => { s.rbac = structuredClone(DEFAULT_MATRIX); });
      toast(t('rbac.resetDone'));
    }),
    store.subscribe((kind) => { if (kind === 'state') render(); }),
  ];
  render();
  return () => offs.forEach((off) => off());
}
