import { can, persona } from '../core/auth';
import { t, tx, type I18nKey } from '../core/i18n';
import { ROLES, type Perm } from '../core/rbac';
import { currentRoute, href, onRouteChange, type Route } from '../core/router';
import { activeIncident } from '../core/selectors';
import { store } from '../core/store';
import type { Lang, RoleId } from '../core/types';
import { mount as mountDashboard } from '../pages/dashboard';
import { $, html, on, openModal, raw, setHtml, toast } from './dom';
import { icon } from './icons';
import { initials } from './widgets';

// 外殼：側邊選單、頂欄（模擬登入、語言、重設）與頁面切換。
// 選單只列出目前角色有檢視權限的頁面；直接輸入網址到沒權限的頁面會看到說明畫面。

export type PageMount = (root: HTMLElement, route: Route) => (() => void) | void;
interface PageDef { path: string; perm: Perm; nav: I18nKey; icon: string; load: () => Promise<{ mount: PageMount }> }

const soon = () => import('../pages/soon');
const PAGES: PageDef[] = [
  // 總覽是預設頁，直接打包進主程式；其餘頁面各自切成獨立 chunk，點到才下載。
  { path: '/dashboard', perm: 'page.dashboard', nav: 'nav.dashboard', icon: 'dashboard', load: async () => ({ mount: mountDashboard }) },
  { path: '/team', perm: 'page.team', nav: 'nav.team', icon: 'team', load: soon },
  { path: '/projects', perm: 'page.projects', nav: 'nav.projects', icon: 'projects', load: soon },
  { path: '/governance', perm: 'page.governance', nav: 'nav.governance', icon: 'governance', load: soon },
  { path: '/systems', perm: 'page.systems', nav: 'nav.systems', icon: 'systems', load: soon },
  { path: '/collab', perm: 'page.collab', nav: 'nav.collab', icon: 'collab', load: soon },
  { path: '/rbac', perm: 'page.rbac', nav: 'nav.rbac', icon: 'rbac', load: soon },
  { path: '/about', perm: 'page.about', nav: 'nav.about', icon: 'about', load: soon },
];

const LOGO = raw('<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l11 6.2v12.6L16 28 5 21.8V9.2z" fill="#ffc83d"/><path d="M16 15.4l11-6.2v12.6L16 28z" fill="#f0633d"/><path d="M16 15.4L5 9.2v12.6L16 28z" fill="#d9a520"/></svg>');

export function mountShell(app: HTMLElement): void {
  setHtml(app, html`<div class="shell"><aside class="side" id="side"></aside><div class="main"><header class="top" id="top"></header><main id="view" tabindex="-1"></main></div></div>`);
  const side = $('#side', app)!;
  const top = $('#top', app)!;
  const view = $('#view', app)!;

  function renderSide(): void {
    const active = currentRoute().path;
    setHtml(side, html`
      <a class="brand" href="${href('/dashboard')}">${LOGO}<span class="brand-name">${t('app.product')}<small>${t('app.short')}</small></span></a>
      <nav class="nav" aria-label="${t('nav.label')}">
        ${PAGES.filter((p) => can(p.perm)).map((p) => html`<a href="${href(p.path)}" class="${p.path === active ? 'is-active' : ''}" ${p.path === active ? raw('aria-current="page"') : ''} title="${t(p.nav)}">${icon(p.icon)}<span>${t(p.nav)}</span></a>`)}
      </nav>
      <p class="side-foot">${t('app.fictional')}</p>`);
  }

  function renderTop(): void {
    const { role, lang } = store.prefs;
    const who = persona();
    const incident = activeIncident(store.state);
    setHtml(top, html`
      ${incident ? raw('<div class="hazard" aria-hidden="true"></div>') : ''}
      <div class="top-row">
        <div class="who">
          <span class="avatar" style="--h:${ROLES.indexOf(role) * 62 + 20}" aria-hidden="true">${initials(who.name)}</span>
          <div class="who-text"><b>${tx(who.name)}</b><span>${tx(who.title)}</span></div>
        </div>
        <div class="tool">
          <label for="role-select">${t('top.role')}</label>
          <select id="role-select">${ROLES.map((r) => html`<option value="${r}" ${r === role ? raw('selected') : ''}>${t(`role.${r}` as I18nKey)}</option>`)}</select>
        </div>
        <div class="seg" role="group" aria-label="${t('top.lang')}">
          <button type="button" data-lang="zh" aria-pressed="${String(lang === 'zh')}">中文</button>
          <button type="button" data-lang="en" aria-pressed="${String(lang === 'en')}">EN</button>
        </div>
        <button type="button" class="btn" id="reset-btn">${icon('reset', 16)}${t('top.reset')}</button>
      </div>
      ${incident ? html`<div class="incident-bar" role="status">${icon('alert', 18)}<b>${t('top.incident')}</b><span class="tag">${incident.id}</span><span>${incident.severity}</span><span>${tx(incident.title)}</span><a href="${href('/systems')}">${t('top.viewIncident')}</a></div>` : ''}`);
  }

  let cleanup: (() => void) | void;
  let token = 0;
  async function show(): Promise<void> {
    const route = currentRoute();
    const def = PAGES.find((p) => p.path === route.path);
    cleanup?.();
    cleanup = undefined;
    const mine = ++token;
    renderSide();
    document.title = `${def ? t(def.nav) : t('notfound.title')}｜${t('app.name')}`;
    if (!def) {
      setHtml(view, html`<div class="page"><div class="notice"><h1>${t('notfound.title')}</h1><a class="btn" href="${href('/dashboard')}">${t('denied.back')}</a></div></div>`);
      return;
    }
    if (!can(def.perm)) {
      setHtml(view, html`<div class="page"><div class="notice">${icon('lock', 34)}<h1>${t('denied.title')}</h1>
        <p>${t('denied.body', { role: t(`role.${store.prefs.role}` as I18nKey), page: t(def.nav) })}</p>
        <a class="btn" href="${href('/dashboard')}">${t('denied.back')}</a></div></div>`);
      return;
    }
    const mod = await def.load();
    if (mine !== token) return; // 載入期間使用者又切到別頁
    view.replaceChildren();
    cleanup = mod.mount(view, route);
  }

  on(top, 'change', '#role-select', (_e, el) => store.setPrefs({ role: (el as HTMLSelectElement).value as RoleId }));
  on(top, 'click', '[data-lang]', (_e, el) => store.setPrefs({ lang: el.dataset.lang as Lang }));
  on(top, 'click', '#reset-btn', () => {
    openModal(html`
      <div class="modal-head"><h2>${t('top.resetTitle')}</h2></div>
      <div class="modal-body"><p>${t('top.resetBody')}</p></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>${t('common.cancel')}</button><button type="button" class="btn btn-primary" id="do-reset">${t('top.reset')}</button></div>`,
    (dialog, close) => {
      $('#do-reset', dialog)!.addEventListener('click', () => {
        store.reset();
        close();
        toast(t('top.resetDone'));
      });
    });
  });

  // 沒有權限的按鈕（aria-disabled）：在捕獲階段攔下點擊，改成提示缺少的權限。
  document.addEventListener('click', (event) => {
    const locked = (event.target as Element | null)?.closest<HTMLElement>('[aria-disabled="true"]');
    if (!locked) return;
    event.preventDefault();
    event.stopPropagation();
    if (locked.dataset.why) toast(locked.dataset.why, 'warn');
  }, true);

  let seen = { role: store.prefs.role, lang: store.prefs.lang, rbac: JSON.stringify(store.state.rbac), incident: activeIncident(store.state)?.id };
  store.subscribe((kind) => {
    const next = { role: store.prefs.role, lang: store.prefs.lang, rbac: JSON.stringify(store.state.rbac), incident: activeIncident(store.state)?.id };
    const identityChanged = next.role !== seen.role || next.lang !== seen.lang;
    const rbacChanged = next.rbac !== seen.rbac;
    const incidentChanged = next.incident !== seen.incident;
    seen = next;
    if (kind === 'reset' || identityChanged) {
      renderTop();
      void show();
    } else if (rbacChanged) {
      renderSide();
    }
    if (incidentChanged && !identityChanged && kind !== 'reset') renderTop();
  });

  onRouteChange(() => void show());
  renderTop();
  void show();
}
