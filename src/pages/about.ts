import { comma, t, type I18nKey } from '../core/i18n';
import { href, navigate } from '../core/router';
import { APP_COMMIT, APP_VERSION } from '../core/version';
import type { FlowSpec } from '../flow/FlowIsland';
import { $, html, setHtml } from '../ui/dom';
import { attachFlow } from '../ui/flowMount';
import { pageHead } from '../ui/widgets';

// 關於這個 Demo：職責對應表、研發流程全景（同時是網站地圖）、技術說明與 3 分鐘導覽。

const DUTIES: [duty: string, page: I18nKey, path: string, query?: Record<string, string>][] = [
  ['team', 'nav.team', '/team'],
  ['tech', 'nav.governance', '/governance'],
  ['sdlc', 'nav.projects', '/projects', { tab: 'sprint' }],
  ['metrics', 'nav.dashboard', '/dashboard'],
  ['ai', 'nav.collab', '/collab'],
  ['incident', 'nav.systems', '/systems'],
  ['data', 'nav.systems', '/systems'],
];

const SDLC: [id: string, x: number, y: number, path: string, query?: Record<string, string>][] = [
  ['request', 0, 0, '/collab'],
  ['plan', 230, 0, '/projects', { tab: 'okr' }],
  ['design', 460, 0, '/governance', { tab: 'adr' }],
  ['build', 690, 0, '/projects', { tab: 'kanban' }],
  ['review', 920, 0, '/governance', { tab: 'review' }],
  ['cicd', 920, 170, '/governance', { tab: 'cicd' }],
  ['observe', 690, 170, '/systems'],
  ['incident', 460, 170, '/systems'],
  ['report', 230, 170, '/dashboard'],
];

const STEPS: [path: string, query?: Record<string, string>][] = [
  ['/dashboard'], ['/dashboard', { device: 'press' }], ['/team', { member: 'm6' }], ['/projects', { tab: 'kanban' }], ['/systems'], ['/collab'],
];

export function mount(root: HTMLElement): () => void {
  setHtml(root, html`<div class="page">
    ${pageHead(t('nav.about'))}
    <section class="notice-box"><h2>${t('about.fictionalTitle')}</h2><p class="prose">${t('about.fictionalBody')}</p></section>
    <section class="panel"><div class="panel-head"><h2>${t('about.map')}</h2></div><div class="table-wrap"><table class="table">
      <thead><tr><th>${t('about.col.duty')}</th><th>${t('about.col.where')}</th><th>${t('about.col.how')}</th></tr></thead>
      <tbody>${DUTIES.map(([key, page, path, query]) => html`<tr><td class="nowrap"><b>${t(`about.duty.${key}` as I18nKey)}</b></td>
        <td class="nowrap"><a href="${href(path, query)}">${t(page)}</a></td><td>${t(`about.duty.${key}How` as I18nKey)}</td></tr>`)}</tbody></table></div></section>
    <section class="stack" style="gap:6px"><h2 class="section-title">${t('about.sdlc')}</h2><p class="muted small">${t('about.sdlcHint')}</p><div class="flow" id="sdlc-flow" style="height:400px"></div></section>
    <div class="grid cols-2">
      <section class="panel"><div class="panel-head"><h2>${t('about.script')}</h2></div><div class="panel-body"><ol class="steps">${STEPS.map(([path, query], i) => html`<li><span class="n">${i + 1}</span><span>${t(`about.step.${i + 1}` as I18nKey)}</span><a class="btn btn-sm" href="${href(path, query)}">${t('about.open')}</a></li>`)}</ol></div></section>
      <section class="panel"><div class="panel-head"><h2>${t('about.tech')}</h2></div><div class="panel-body"><ul class="tech-list">${[1, 2, 3, 4, 5, 6].map((n) => html`<li>${t(`about.tech.${n}` as I18nKey)}</li>`)}</ul>
        <p class="muted small" id="about-version" style="margin-top:14px"><b>${t('app.version')} <span class="num">${APP_VERSION}</span></b>${APP_COMMIT ? `${comma()}commit ${APP_COMMIT}` : ''}<br />${t('about.versionHint')}</p></div></section>
    </div>
  </div>`);

  const spec: FlowSpec = {
    nodes: SDLC.map(([id, x, y], i) => ({
      id, x, y, width: 178, tag: String(i + 1), title: t(`about.n.${id}` as I18nKey), subtitle: t(`about.n.${id}Sub` as I18nKey),
      tone: id === 'incident' ? 'warn' : id === 'report' ? 'done' : 'ok',
    })),
    edges: [
      ...SDLC.slice(1).map(([id], i) => ({ id: `e${i}`, source: SDLC[i][0], target: id, tone: 'ok' as const, animated: true })),
      { id: 'loop', source: 'report', target: 'request', tone: 'active', dashed: true, label: t('about.e.learn'), curve: 'default' },
    ],
  };
  const lookup = new Map(SDLC.map(([id, , , path, query]) => [id, { path, query }]));
  const flow = attachFlow($('#sdlc-flow', root)!, spec, {
    layoutKey: 'sdlc',
    onNodeClick: (id) => { const to = lookup.get(id); if (to) navigate(to.path, to.query); },
  });
  return () => flow.destroy();
}
