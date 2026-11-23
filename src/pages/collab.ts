import { analyze, generateWeeklyReport } from '../ai/weeklyReport';
import { actorName, can } from '../core/auth';
import { DEMO_TODAY } from '../core/date';
import { getLang, plain, t, tx, type I18nKey } from '../core/i18n';
import { href } from '../core/router';
import { activeSprint } from '../core/selectors';
import { store } from '../core/store';
import type { DemandRequest } from '../core/types';
import type { FlowHandle, FlowSpec } from '../flow/FlowIsland';
import { CUSTOMERS } from '../mock/requests';
import { $, copyText, html, on, raw, setHtml, toast, type Safe } from '../ui/dom';
import { attachFlow } from '../ui/flowMount';
import { icon } from '../ui/icons';
import { actionBtn, pageHead, statusChip } from '../ui/widgets';

// 跨部門協作：需求入口 → 評估（價值、工時、風險）→ 轉成工程任務；以及一鍵產生的週報。

const KINDS: DemandRequest['kind'][] = ['feature', 'report', 'integration', 'support'];
const POINTS = [1, 2, 3, 5, 8];
const score = (r: Pick<DemandRequest, 'value' | 'effort' | 'risk'>) => Math.round(((r.value * 2) / (r.effort + r.risk / 2)) * 10) / 10;

export function mount(root: HTMLElement): () => void {
  let filter: string | null = null;
  let flow: FlowHandle | null = null;
  const form = { title: '', desc: '', customer: 0, kind: 'feature' as DemandRequest['kind'] };

  function counts() {
    const { state } = store;
    const sprint = activeSprint(state);
    const fromReq = state.tasks.filter((x) => x.requestId);
    return {
      intake: state.requests.filter((r) => r.status === 'new').length,
      eval: state.requests.filter((r) => r.status === 'evaluated').length,
      converted: state.requests.filter((r) => r.status === 'converted').length,
      declined: state.requests.filter((r) => r.status === 'declined').length,
      backlog: fromReq.filter((x) => x.sprintId !== sprint.id).length,
      sprint: fromReq.filter((x) => x.sprintId === sprint.id).length,
    };
  }

  function flowSpec(): FlowSpec {
    const c = counts();
    const node = (id: keyof typeof c, x: number, y: number, tone: FlowSpec['nodes'][number]['tone']) => ({
      id, x, y, width: 168, title: t(`collab.stage.${id}` as I18nKey), badge: t('collab.count', { n: c[id] }), tone: c[id] ? tone : 'idle' as const,
    });
    return {
      nodes: [node('intake', 0, 60, 'active'), node('eval', 220, 60, 'ok'), node('converted', 440, 0, 'done'), node('declined', 440, 130, 'warn'), node('backlog', 660, 0, 'ok'), node('sprint', 880, 0, 'done')],
      edges: [
        { id: 'a', source: 'intake', target: 'eval', animated: c.intake > 0, tone: 'ok' },
        { id: 'b', source: 'eval', target: 'converted', animated: c.eval > 0, tone: 'done' },
        { id: 'c', source: 'eval', target: 'declined', tone: 'idle', dashed: true },
        { id: 'd', source: 'converted', target: 'backlog', tone: 'ok' },
        { id: 'e', source: 'backlog', target: 'sprint', tone: 'ok' },
      ],
    };
  }

  const STATUS_OF: Record<string, DemandRequest['status'] | null> = { intake: 'new', eval: 'evaluated', converted: 'converted', declined: 'declined', backlog: 'converted', sprint: 'converted' };

  function requestCard(r: DemandRequest): Safe {
    const triage = can('request.triage');
    const open = r.status === 'new' || r.status === 'evaluated';
    const s = score(r);
    const advice = s >= 2 ? t('collab.advice.high') : s >= 1.2 ? t('collab.advice.mid') : t('collab.advice.low');
    const chip = r.status === 'converted' ? 'ok' : r.status === 'declined' ? 'mute' : r.status === 'evaluated' ? 'info' : 'warn';
    const slider = (key: 'value' | 'effort' | 'risk') => html`<label class="slider"><span>${t(`collab.${key}` as I18nKey)}</span>
      <input type="range" min="1" max="5" step="1" value="${r[key]}" data-req="${r.id}" data-key="${key}" ${triage && open ? '' : raw('disabled')} /><output>${r[key]}</output></label>`;
    return html`<article class="req" data-card="${r.id}">
      <div><div class="req-meta"><span class="tag">${r.id}</span>${statusChip(chip, t(`collab.status.${r.status}` as I18nKey))}<span class="chip is-plain">${t(`collab.kind.${r.kind}` as I18nKey)}</span><span class="small muted">${tx(r.customer)}</span></div>
        <h3>${tx(r.title)}</h3><p class="muted" style="font-size:14px">${tx(r.desc)}</p>
        <p class="small muted" style="margin-top:6px">${t('collab.requester')}　${tx(r.requester)}　<span class="num">${r.createdAt}</span></p>
        ${r.taskId ? html`<p style="margin-top:8px"><a class="btn btn-sm" href="${href('/projects', { tab: 'kanban', task: r.taskId })}">${icon('link', 15)}${t('collab.viewTask', { id: r.taskId })}</a></p>` : ''}</div>
      <div class="stack" style="gap:8px">${slider('value')}${slider('effort')}${slider('risk')}
        <div class="score" title="${t('collab.scoreHint')}"><span class="small muted">${t('collab.score')}</span><b data-score="${r.id}">${s.toFixed(1)}</b><span class="small" data-advice="${r.id}">${advice}</span></div>
        ${open ? html`<div class="row">
          ${actionBtn({ act: 'save-eval', label: t('collab.saveEval'), perm: 'request.triage', cls: 'btn-sm', data: { id: r.id } })}
          ${actionBtn({ act: 'convert', label: t('collab.convert'), perm: 'request.triage', cls: 'btn-sm', data: { id: r.id } })}
          ${actionBtn({ act: 'decline', label: t('collab.decline'), perm: 'request.triage', cls: 'btn-sm btn-quiet', data: { id: r.id } })}
          <select data-project="${r.id}" aria-label="${t('collab.convertTo')}" title="${t('collab.convertTo')}" ${triage ? '' : raw('disabled')}>${store.state.projects.map((p) => html`<option value="${p.id}" ${p.id === 'p3' ? raw('selected') : ''}>${tx(p.name)}</option>`)}</select>
        </div>` : ''}</div>
    </article>`;
  }

  function listHtml(): Safe {
    const want = filter ? STATUS_OF[filter] : null;
    const list = store.state.requests.filter((r) => !want || r.status === want);
    return html`<div class="panel-head"><h2>${t('collab.list')}</h2>${filter ? html`<span class="chip is-info">${t('collab.filter', { name: t(`collab.stage.${filter}` as I18nKey) })}</span><button type="button" class="btn btn-sm" data-act="clear-filter">${t('collab.clearFilter')}</button>` : ''}</div>
      ${list.length ? list.map(requestCard) : html`<p class="empty">${t('collab.empty')}</p>`}`;
  }

  function reportHtml(): Safe {
    const text = store.state.weeklyReport;
    const found = analyze(store.state, getLang());
    return html`<div class="panel-head"><h2>${t('collab.report')}</h2>
        ${actionBtn({ act: 'generate', label: text ? t('collab.regenerate') : t('collab.generate'), perm: 'report.generate', cls: 'btn-primary' })}
        <button type="button" class="btn" data-act="copy-report" ${text ? '' : raw('disabled')}>${icon('copy', 16)}${t('collab.copyMd')}</button></div>
      <div class="panel-body stack"><p class="muted small" style="max-width:90ch">${t('collab.reportLead')}</p>
        <div class="row"><span class="small muted">${t('collab.insights')}</span>${statusChip(found.risks.some((r) => r.level === 'high') ? 'crit' : 'warn', t('collab.risks', { n: found.risks.length }))}${statusChip('info', t('collab.asks', { n: found.asks.length }))}</div>
        ${text ? html`<pre class="md" id="report" tabindex="0">${text}</pre>` : html`<p class="empty" id="report">${t('collab.reportEmpty')}</p>`}</div>`;
  }

  function summary(): string {
    const n = store.state.requests.filter((r) => r.status === 'new').length;
    return n ? t('collab.sum', { n }) : t('collab.sumNone');
  }

  function render(): void {
    const sum = $('#page-sum', root);
    if (sum) sum.textContent = summary();
    setHtml($('#req-list', root)!, listHtml());
    setHtml($('#report-box', root)!, reportHtml());
    flow?.update(flowSpec(), filter);
  }

  const create = can('request.create');
  setHtml(root, html`<div class="page">
    ${pageHead(t('nav.collab'), summary())}
    <section class="stack" style="gap:6px"><h2 class="section-title">${t('collab.flow')}</h2><p class="muted small">${t('collab.flowHint')}</p><div class="flow is-short" id="req-flow" style="height:290px"></div></section>
    <div class="grid split">
      <section class="panel" id="req-list"></section>
      <section class="panel" style="align-self:start"><div class="panel-head"><h2>${t('collab.new')}</h2></div><div class="panel-body stack">
        <label class="field"><span>${t('collab.f.title')}</span><input type="text" id="rq-title" maxlength="80" ${create ? '' : raw('disabled')} /></label>
        <div class="form-row">
          <label class="field"><span>${t('collab.f.customer')}</span><select id="rq-customer" ${create ? '' : raw('disabled')}>${CUSTOMERS.map((c, i) => html`<option value="${i}">${tx(c)}</option>`)}</select></label>
          <label class="field"><span>${t('collab.f.kind')}</span><select id="rq-kind" ${create ? '' : raw('disabled')}>${KINDS.map((k) => html`<option value="${k}">${t(`collab.kind.${k}` as I18nKey)}</option>`)}</select></label>
        </div>
        <label class="field"><span>${t('collab.f.desc')}</span><textarea id="rq-desc" maxlength="400" ${create ? '' : raw('disabled')}></textarea></label>
        <div>${actionBtn({ act: 'submit', label: t('collab.submit'), perm: 'request.create', cls: 'btn-primary', icon: 'plus' })}</div>
      </div></section>
    </div>
    <section class="panel" id="report-box"></section>
  </div>`);

  flow = attachFlow($('#req-flow', root)!, flowSpec(), { layoutKey: 'requests', onNodeClick: (id) => { filter = filter === id ? null : id; render(); } });
  render();

  const offs = [
    on(root, 'input', '#rq-title, #rq-desc, #rq-customer, #rq-kind', (_e, el) => {
      const v = (el as HTMLInputElement).value;
      if (el.id === 'rq-title') form.title = v;
      else if (el.id === 'rq-desc') form.desc = v;
      else if (el.id === 'rq-customer') form.customer = Number(v);
      else form.kind = v as DemandRequest['kind'];
    }),
    // 拖動滑桿時先即時更新分數，按「儲存評估」才寫回資料
    on(root, 'input', '[data-req]', (_e, el) => {
      const card = el.closest<HTMLElement>('[data-card]')!;
      const out = el.nextElementSibling;
      if (out) out.textContent = (el as HTMLInputElement).value;
      const get = (k: string) => Number(card.querySelector<HTMLInputElement>(`[data-key="${k}"]`)!.value);
      const s = score({ value: get('value'), effort: get('effort'), risk: get('risk') });
      card.querySelector('[data-score]')!.textContent = s.toFixed(1);
      card.querySelector('[data-advice]')!.textContent = s >= 2 ? t('collab.advice.high') : s >= 1.2 ? t('collab.advice.mid') : t('collab.advice.low');
    }),
    on(root, 'click', '[data-act]', (_e, el) => {
      const id = el.dataset.id;
      const card = id ? root.querySelector<HTMLElement>(`[data-card="${id}"]`) : null;
      const read = (k: string) => Number(card?.querySelector<HTMLInputElement>(`[data-key="${k}"]`)?.value ?? 3);
      switch (el.dataset.act) {
        case 'clear-filter': filter = null; render(); break;
        case 'submit': {
          if (!form.title.trim()) { toast(t('collab.needTitle'), 'warn'); return; }
          const rid = store.nextId('req', 'REQ-0');
          const entry: DemandRequest = { id: rid, title: plain(form.title.trim()), desc: plain(form.desc.trim() || '—'), customer: CUSTOMERS[form.customer], requester: plain(actorName()), kind: form.kind, value: 3, effort: 3, risk: 2, status: 'new', createdAt: DEMO_TODAY };
          store.update((s) => { s.requests.unshift(entry); });
          form.title = form.desc = '';
          $<HTMLInputElement>('#rq-title', root)!.value = '';
          $<HTMLTextAreaElement>('#rq-desc', root)!.value = '';
          toast(t('collab.submitted', { id: rid }));
          break;
        }
        case 'save-eval':
          store.update((s) => { const r = s.requests.find((x) => x.id === id); if (r) { r.value = read('value'); r.effort = read('effort'); r.risk = read('risk'); r.status = 'evaluated'; } });
          toast(t('collab.evalSaved', { id: id! }));
          break;
        case 'decline':
          store.update((s) => { const r = s.requests.find((x) => x.id === id); if (r) r.status = 'declined'; });
          toast(t('collab.declined', { id: id! }));
          break;
        case 'convert': {
          const r = store.state.requests.find((x) => x.id === id);
          if (!r) return;
          const effort = read('effort');
          const points = POINTS[effort - 1];
          const projectId = card?.querySelector<HTMLSelectElement>('[data-project]')?.value ?? 'p3';
          const taskId = store.nextId('task', 'T-');
          store.update((s) => {
            const target = s.requests.find((x) => x.id === id)!;
            Object.assign(target, { value: read('value'), effort, risk: read('risk'), status: 'converted', taskId });
            s.tasks.push({ id: taskId, title: target.title, projectId, assignee: null, status: 'backlog', points, sprintId: null, type: 'feature', priority: score(target) >= 2 ? 'P1' : 'P2', requestId: target.id });
          });
          toast(t('collab.converted', { req: r.id, task: taskId, pts: points }));
          break;
        }
        case 'generate': {
          const text = generateWeeklyReport(store.state, getLang());
          store.update((s) => { s.weeklyReport = text; });
          $('#report', root)?.scrollIntoView({ block: 'nearest' });
          break;
        }
        case 'copy-report':
          void copyText(store.state.weeklyReport).then((ok) => ok && toast(t('common.copied')));
          break;
      }
    }),
    store.subscribe((kind) => { if (kind === 'state') render(); }),
  ];

  return () => {
    offs.forEach((off) => off());
    flow?.destroy();
  };
}
