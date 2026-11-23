import { actorId, actorName, can } from '../core/auth';
import { DEMO_TODAY } from '../core/date';
import { plain, t, tx, type I18nKey } from '../core/i18n';
import { activeRun, approveRelease, finishRunningStage, retryFailedStage, STAGE_MS, startRun } from '../core/pipeline';
import { href, type Route } from '../core/router';
import { memberById } from '../core/selectors';
import { store } from '../core/store';
import type { Adr, AdrStatus, Debt, PipelineRun, Review } from '../core/types';
import type { FlowHandle, FlowSpec, FlowTone } from '../flow/FlowIsland';
import { SQUADS } from '../mock/members';
import { $, html, on, openModal, raw, setHtml, toast, type Safe } from '../ui/dom';
import { attachFlow } from '../ui/flowMount';
import { actionBtn, avatar, bar, pageHead, statusChip, tabs } from '../ui/widgets';

// 技術治理：ADR、Code Review 佇列、品質基準與技術債矩陣、CI/CD Pipeline。

const ADR_STATUSES: AdrStatus[] = ['proposed', 'accepted', 'superseded', 'rejected'];
const POINTS = [1, 2, 3, 5, 8];
const adrChip = (a: Adr): Safe => statusChip(a.status === 'accepted' ? 'ok' : a.status === 'proposed' ? 'warn' : 'mute', t(`adr.status.${a.status}` as I18nKey));

export function mount(root: HTMLElement, route: Route): () => void {
  let tab = route.query.get('tab') ?? 'adr';
  let adrId = store.state.adrs[0]?.id ?? '';
  let flow: FlowHandle | null = null;
  let timer = 0;
  let timerKey = '';

  const name = (id: string) => { const m = memberById(store.state, id); return m ? tx(m.name) : id === 'manager' ? t('role.manager') : id; };

  // ───── ADR
  function adrTab(): Safe {
    const { state } = store;
    const a = state.adrs.find((x) => x.id === adrId) ?? state.adrs[0];
    const write = can('adr.write');
    return html`<div class="row" style="justify-content:flex-end">${actionBtn({ act: 'adr-new', label: t('adr.new'), perm: 'adr.write', icon: 'plus', cls: 'btn-primary' })}</div>
      <div class="adr-grid">
        <section class="panel" style="overflow:hidden">${state.adrs.map((x) => html`<button type="button" class="adr-item" data-adr="${x.id}" aria-current="${String(x.id === a.id)}">
          <span class="row" style="justify-content:space-between"><span class="tag">${x.id}</span>${adrChip(x)}</span><b>${tx(x.title)}</b><span class="small muted"><span class="num">${x.date}</span>　${name(x.author)}</span></button>`)}</section>
        <section class="panel"><div class="panel-head"><span class="tag">${a.id}</span><h2>${tx(a.title)}</h2>
            <label class="row small"><span class="muted">${t('adr.status')}</span><select id="adr-status" ${write ? '' : raw('disabled')}>${ADR_STATUSES.map((s) => html`<option value="${s}" ${s === a.status ? raw('selected') : ''}>${t(`adr.status.${s}` as I18nKey)}</option>`)}</select></label></div>
          <div class="panel-body adr-body"><p class="small muted" style="margin-bottom:12px">${t('adr.author')}　${name(a.author)}　<span class="num">${a.date}</span></p>
            <h3>${t('adr.context')}</h3><p>${tx(a.context)}</p><h3>${t('adr.decision')}</h3><p>${tx(a.decision)}</p>
            <h3>${t('adr.consequences')}</h3><p>${tx(a.consequences)}</p><h3>${t('adr.alternatives')}</h3><p>${tx(a.alternatives)}</p></div></section>
      </div>`;
  }

  function newAdr(): void {
    openModal(html`<div class="modal-head"><h2>${t('adr.new')}</h2></div>
      <div class="modal-body">
        <label class="field"><span>${t('adr.title')}</span><input type="text" id="na-title" maxlength="80" /></label>
        <label class="field"><span>${t('adr.context')}</span><textarea id="na-context"></textarea></label>
        <label class="field"><span>${t('adr.decision')}</span><textarea id="na-decision"></textarea></label>
        <label class="field"><span>${t('adr.consequences')}</span><textarea id="na-consequences" style="min-height:60px"></textarea></label>
        <label class="field"><span>${t('adr.alternatives')}</span><textarea id="na-alternatives" style="min-height:60px"></textarea></label>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>${t('common.cancel')}</button><button type="button" class="btn btn-primary" id="na-save">${t('adr.create')}</button></div>`,
    (dialog, close) => {
      dialog.classList.add('is-wide');
      const val = (id: string) => $<HTMLInputElement>(`#${id}`, dialog)!.value.trim();
      $('#na-save', dialog)!.addEventListener('click', () => {
        if (!val('na-title') || !val('na-decision')) { toast(t('adr.needFields'), 'warn'); return; }
        const id = `ADR-${String(store.state.counters.adr ?? 7).padStart(3, '0')}`;
        store.update((s) => {
          s.counters.adr = (s.counters.adr ?? 7) + 1;
          s.adrs.unshift({ id, status: 'proposed', date: DEMO_TODAY, author: actorId(), title: plain(val('na-title')), context: plain(val('na-context') || '—'), decision: plain(val('na-decision')), consequences: plain(val('na-consequences') || '—'), alternatives: plain(val('na-alternatives') || '—') });
        });
        adrId = id;
        close();
        toast(t('adr.created', { id }));
      });
    });
  }

  // ───── Code Review
  function reviewTab(): Safe {
    const { state } = store;
    const row = (r: Review): Safe => {
      const author = memberById(state, r.author);
      const stale = r.status === 'open' && r.ageHours >= 24;
      return html`<tr><td><span class="tag">${r.id}</span></td>
        <td><b>${tx(r.title)}</b>${r.taskId ? html`<div class="small"><a href="${href('/projects', { tab: 'kanban', task: r.taskId })}">${r.taskId}</a></div>` : ''}</td>
        <td><span class="row nowrap" style="flex-wrap:nowrap">${avatar(author, true)}${name(r.author)} → ${name(r.reviewer)}</span></td>
        <td class="num nowrap"><span class="size-add">+${r.additions}</span> <span class="size-del">−${r.deletions}</span></td>
        <td class="nowrap">${stale ? statusChip('crit', t('review.hours', { n: r.ageHours })) : html`<span class="num">${t('review.hours', { n: r.ageHours })}</span>`}</td>
        <td>${statusChip(r.ci === 'pass' ? 'ok' : r.ci === 'fail' ? 'crit' : 'warn', t(`review.ci.${r.ci}` as I18nKey))}</td>
        <td>${statusChip(r.risk === 'high' ? 'crit' : r.risk === 'med' ? 'warn' : 'mute', t(`review.risk.${r.risk}` as I18nKey))}</td>
        <td>${r.status === 'open' ? html`<div class="row" style="flex-wrap:nowrap">${actionBtn({ act: 'pr-approve', label: t('review.approve'), perm: 'review.decide', cls: 'btn-sm', icon: 'check', data: { id: r.id } })}${actionBtn({ act: 'pr-changes', label: t('review.changes'), perm: 'review.decide', cls: 'btn-sm', data: { id: r.id } })}</div>`
          : html`<div class="row" style="flex-wrap:nowrap">${statusChip(r.status === 'approved' ? 'ok' : 'warn', t(`review.st.${r.status}` as I18nKey))}${actionBtn({ act: 'pr-reopen', label: t('review.reopen'), perm: 'review.decide', cls: 'btn-sm btn-quiet', data: { id: r.id } })}</div>`}</td></tr>`;
    };
    return html`<p class="muted" style="max-width:90ch">${t('review.lead')}</p><section class="panel"><div class="table-wrap"><table class="table">
      <thead><tr><th></th><th>${t('review.col.pr')}</th><th>${t('review.col.people')}</th><th class="num">${t('review.col.size')}</th><th>${t('review.col.age')}</th><th>${t('review.col.ci')}</th><th>${t('review.col.risk')}</th><th>${t('review.col.decision')}</th></tr></thead>
      <tbody>${[...state.reviews].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || b.ageHours - a.ageHours).map(row)}</tbody></table></div></section>`;
  }

  function decide(id: string, decision: 'approved' | 'changes' | 'open'): void {
    const pr = store.state.reviews.find((r) => r.id === id);
    if (!pr) return;
    const task = store.state.tasks.find((x) => x.id === pr.taskId);
    const moves = decision !== 'open' && task?.status === 'review';
    store.update((s) => {
      s.reviews.find((r) => r.id === id)!.status = decision;
      // Review 的結果會帶動任務：核准 → Done；要求修改 → 退回 In Progress
      if (moves) s.tasks.find((x) => x.id === pr.taskId)!.status = decision === 'approved' ? 'done' : 'progress';
    });
    if (decision === 'approved') toast(moves ? t('review.toast.approved', { id, task: task!.id }) : t('review.toast.approvedPlain', { id }));
    if (decision === 'changes') toast(moves ? t('review.toast.changes', { id, task: task!.id }) : t('review.toast.changesPlain', { id }), 'warn');
  }

  // ───── 品質與技術債
  function matrix(debts: Debt[]): Safe {
    const size = 360;
    const pad = 40;
    const span = size - pad * 2;
    const x = (cost: number) => pad + ((cost - 0.5) / 5) * span;
    const y = (impact: number) => size - pad - ((impact - 0.5) / 5) * span;
    const mid = pad + span / 2;
    // 同一格有兩個點時錯開，避免重疊
    const seen = new Map<string, number>();
    const dots = debts.map((d) => {
      const key = `${d.cost}-${d.impact}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return `<g><title>${d.id}</title><circle class="dot ${d.status === 'planned' ? 'is-planned' : ''}" cx="${x(d.cost) + n * 22}" cy="${y(d.impact)}" r="12"/><text class="dot-label" x="${x(d.cost) + n * 22}" y="${y(d.impact)}">${d.id.slice(-2)}</text></g>`;
    }).join('');
    return raw(`<svg class="matrix" viewBox="0 0 ${size} ${size}" role="img" aria-label="${t('debt.title')}">
      <rect x="${pad}" y="${pad}" width="${span / 2}" height="${span / 2}" fill="#e3f1e6"/>
      <rect x="${pad}" y="${pad}" width="${span}" height="${span}" fill="none" stroke="var(--line)"/>
      <line x1="${mid}" y1="${pad}" x2="${mid}" y2="${size - pad}" stroke="var(--line)"/><line x1="${pad}" y1="${mid}" x2="${size - pad}" y2="${mid}" stroke="var(--line)"/>
      <text class="q" x="${pad + 8}" y="${pad + 18}">${t('debt.q.first')}</text><text class="q" x="${mid + 8}" y="${pad + 18}">${t('debt.q.plan')}</text>
      <text class="q" x="${pad + 8}" y="${size - pad - 8}">${t('debt.q.easy')}</text><text class="q" x="${mid + 8}" y="${size - pad - 8}">${t('debt.q.later')}</text>
      <text x="${size / 2}" y="${size - 10}" text-anchor="middle">${t('debt.cost')} →</text>
      <text x="14" y="${size / 2}" text-anchor="middle" transform="rotate(-90 14 ${size / 2})">${t('debt.impact')} →</text>
      ${dots}</svg>`);
  }

  function qualityTab(): Safe {
    const { state } = store;
    return html`<section class="panel"><div class="panel-head"><h2>${t('quality.title')}</h2></div><div class="table-wrap"><table class="table">
        <thead><tr><th>${t('quality.metric')}</th><th class="num">${t('quality.value')}</th><th>${t('quality.target')}</th><th style="width:30%"></th><th>${t('quality.result')}</th></tr></thead>
        <tbody>${state.quality.map((q) => {
          const ok = q.better === 'higher' ? q.value >= q.target : q.value <= q.target;
          // 目標是 0 的指標（例如重大問題數）：只要不是 0 就畫滿
          const pct = q.target === 0 ? (q.value === 0 ? 0 : 100) : (q.value / q.target) * 100;
          return html`<tr><td><b>${tx(q.label)}</b></td><td class="num">${q.value} ${q.unit}</td><td class="small muted">${q.better === 'higher' ? t('quality.atLeast', { n: `${q.target} ${q.unit}` }) : t('quality.atMost', { n: `${q.target} ${q.unit}` })}</td>
            <td>${bar(Math.min(100, pct), ok ? 'good' : 'over')}</td><td>${statusChip(ok ? 'ok' : 'crit', ok ? t('quality.pass') : t('quality.fail'))}</td></tr>`;
        })}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>${t('debt.title')}</h2><span class="muted">${t('debt.hint')}</span></div>
        <div class="panel-body matrix-wrap"><div>${matrix(state.debts)}</div>
          <div class="table-wrap"><table class="table"><tbody>${[...state.debts].sort((a, b) => b.impact / b.cost - a.impact / a.cost).map((d) => html`<tr>
            <td><span class="tag">${d.id}</span></td><td><b>${tx(d.title)}</b><div class="small muted">${tx(d.note)}</div><div class="small muted">${tx(SQUADS[d.squad])}　${t('debt.impact')} ${d.impact}　${t('debt.cost')} ${d.cost}</div></td>
            <td>${d.status === 'open' ? actionBtn({ act: 'debt-plan', label: t('debt.toBacklog'), perm: 'sprint.plan', cls: 'btn-sm', data: { id: d.id } }) : statusChip(d.status === 'paid' ? 'ok' : 'info', t(`debt.status.${d.status}` as I18nKey))}</td></tr>`)}</tbody></table></div>
        </div></section>`;
  }

  // ───── CI/CD
  function shownRun(): PipelineRun | undefined {
    return activeRun() ?? store.state.pipelineRuns[0];
  }

  function pipelineSpec(run: PipelineRun | undefined): FlowSpec {
    const spec: FlowSpec = { nodes: [], edges: [] };
    const role = t(`role.${store.prefs.role}` as I18nKey);
    const tone: Record<string, FlowTone> = { pending: 'idle', running: 'active', pass: 'done', fail: 'crit', waiting: 'warn' };
    const stage = (n: string) => run?.stages.find((s) => s.name === n);
    spec.nodes.push({ id: 'commit', x: 0, y: 40, width: 170, title: t('cicd.stage.commit'), subtitle: run ? `${run.commit}　${name(run.author)}` : '', tone: run ? 'done' : 'idle' });
    const ids = ['build', 'test', 'staging'] as const;
    ids.forEach((id, i) => {
      const s = stage(id);
      const st = s?.status ?? 'pending';
      spec.nodes.push({
        id, x: 215 * (i + 1), y: i % 2 ? 0 : 80, width: 170, title: t(`cicd.stage.${id}` as I18nKey), tone: tone[st],
        badge: t(`cicd.st.${st}` as I18nKey),
        subtitle: st === 'fail' ? t('cicd.flaky', { n: run!.attempts }) : s?.seconds ? t('cicd.secs', { n: s.seconds }) : undefined,
        action: st === 'fail' ? { id: 'retry', label: t('cicd.retry'), primary: true, lockedWhy: can('pipeline.run') ? undefined : t('common.locked', { role, perm: t('perm.pipeline.run') }) } : undefined,
      });
    });
    const prod = stage('prod');
    const waiting = prod?.status === 'waiting';
    spec.nodes.push({
      id: 'gate', x: 215 * 4, y: 40, width: 170, title: t('cicd.stage.gate'), tone: waiting ? 'warn' : run?.approvedBy ? 'done' : 'idle',
      badge: waiting ? t('cicd.st.waiting') : undefined,
      subtitle: run?.approvedBy ? t('cicd.approvedBy', { name: name(run.approvedBy) }) : undefined,
      action: waiting ? { id: 'approve', label: t('cicd.approve'), primary: true, lockedWhy: can('release.approve') ? undefined : t('common.locked', { role, perm: t('perm.release.approve') }) } : undefined,
    });
    const pst = prod?.status === 'waiting' ? 'pending' : prod?.status ?? 'pending';
    spec.nodes.push({ id: 'prod', x: 215 * 5, y: 40, width: 170, title: t('cicd.stage.prod'), tone: tone[pst], badge: t(`cicd.st.${pst}` as I18nKey), subtitle: prod?.seconds ? t('cicd.secs', { n: prod.seconds }) : undefined });
    const order = ['commit', 'build', 'test', 'staging', 'gate', 'prod'];
    order.slice(1).forEach((id, i) => {
      const target = spec.nodes.find((n) => n.id === id)!;
      spec.edges.push({ id: `${order[i]}-${id}`, source: order[i], target: id, tone: target.tone === 'idle' ? 'idle' : target.tone, animated: target.tone === 'active', dashed: target.tone === 'idle' });
    });
    return spec;
  }

  function cicdStatus(): Safe {
    const active = activeRun();
    const run = shownRun();
    const options = store.state.reviews.map((r) => r.title).concat(store.state.tasks.filter((x) => x.status === 'review').map((x) => x.title));
    return html`<span class="grow">${run ? t(active ? 'cicd.current' : 'cicd.last', { id: run.id, title: tx(run.title) }) : ''}</span>
      <label class="field" style="flex-direction:row;align-items:center;gap:8px"><span>${t('cicd.change')}</span><select id="run-change" ${can('pipeline.run') && !active ? '' : raw('disabled')}>${options.slice(0, 8).map((o, i) => html`<option value="${i}">${tx(o)}</option>`)}</select></label>
      ${actionBtn({ act: 'run', label: t('cicd.run'), perm: 'pipeline.run', cls: 'btn-primary', icon: 'play', enabled: !active })}`;
  }

  function historyHtml(): Safe {
    return html`<div class="panel-head"><h2>${t('cicd.history')}</h2></div><div class="table-wrap"><table class="table">
      <thead><tr><th>${t('cicd.col.run')}</th><th>${t('cicd.col.change')}</th><th>${t('cicd.col.stages')}</th><th class="num">${t('cicd.col.attempts')}</th><th>${t('cicd.col.approver')}</th></tr></thead>
      <tbody>${store.state.pipelineRuns.slice(0, 8).map((r) => html`<tr><td><span class="tag">${r.id}</span></td><td>${tx(r.title)}<div class="small muted"><span class="num">${r.commit}</span>　${name(r.author)}</div></td>
        <td><span class="stage-dots" role="img" aria-label="${r.stages.map((s) => `${s.name} ${s.status}`).join(', ')}">${r.stages.map((s) => html`<i class="is-${s.status}" title="${s.name}: ${t(`cicd.st.${s.status}` as I18nKey)}"></i>`)}</span></td>
        <td class="num">${r.attempts}</td><td>${r.approvedBy ? name(r.approvedBy) : '—'}</td></tr>`)}</tbody></table>`;
  }

  function cicdTab(): Safe {
    return html`<p class="muted" style="max-width:90ch">${t('cicd.lead')}</p>
      <div class="select-bar" id="cicd-status" style="border-top:1px solid var(--line);border-radius:var(--r) var(--r) 0 0;margin:0">${cicdStatus()}</div>
      <div class="flow is-short" id="cicd-flow" style="height:300px;border-radius:0 0 var(--r) var(--r);margin-top:-19px"></div>
      <section class="panel" id="cicd-history">${historyHtml()}</section>`;
  }

  /** 有階段正在執行時，排一個計時器讓它跑完；同一個階段不會重複排。 */
  function schedule(): void {
    const run = activeRun();
    const running = run?.stages.find((s) => s.status === 'running');
    const key = run && running ? `${run.id}:${running.name}:${run.attempts}` : '';
    if (key === timerKey) return;
    clearTimeout(timer);
    timerKey = key;
    if (!run || !running) return;
    timer = window.setTimeout(() => {
      timerKey = '';
      const result = finishRunningStage(run.id);
      if (result === 'failed') toast(t('cicd.toast.failed'), 'warn');
      if (result === 'waiting') toast(t('cicd.toast.waiting'));
      if (result === 'done') toast(t('cicd.toast.done', { id: run.id }));
    }, STAGE_MS[running.name]);
  }

  /** 標題下的那一行：ADR 與待審 PR 的數量。 */
  function summary(): string {
    const { state } = store;
    const open = state.reviews.filter((r) => r.status === 'open');
    return t('gov.sum', { adr: state.adrs.length, prop: state.adrs.filter((a) => a.status === 'proposed').length, pr: open.length, stale: open.filter((r) => r.ageHours >= 24).length });
  }

  function render(): void {
    flow?.destroy();
    flow = null;
    setHtml(root, html`<div class="page">
      ${pageHead(t('nav.governance'), summary())}
      ${tabs([{ id: 'adr', label: t('gov.tab.adr') }, { id: 'review', label: t('gov.tab.review') }, { id: 'quality', label: t('gov.tab.quality') }, { id: 'cicd', label: t('gov.tab.cicd') }], tab)}
      ${tab === 'review' ? reviewTab() : tab === 'quality' ? qualityTab() : tab === 'cicd' ? cicdTab() : adrTab()}
    </div>`);
    if (tab === 'cicd') {
      flow = attachFlow($('#cicd-flow', root)!, pipelineSpec(shownRun()), {
        layoutKey: 'cicd',
        onAction: (_node, action) => {
          const run = activeRun();
          if (!run) return;
          if (action === 'retry' && can('pipeline.run')) retryFailedStage(run.id);
          if (action === 'approve' && can('release.approve')) approveRelease(run.id, actorId());
        },
      });
      schedule();
    }
  }

  const offs = [
    on(root, 'click', '[data-tab]', (_e, el) => { tab = el.dataset.tab!; render(); }),
    on(root, 'click', '[data-adr]', (_e, el) => { adrId = el.dataset.adr!; render(); }),
    on(root, 'change', '#adr-status', (_e, el) => {
      store.update((s) => { const a = s.adrs.find((x) => x.id === adrId); if (a) a.status = (el as HTMLSelectElement).value as AdrStatus; });
      toast(t('adr.statusSaved', { id: adrId }));
    }),
    on(root, 'click', '[data-act]', (_e, el) => {
      const id = el.dataset.id ?? '';
      switch (el.dataset.act) {
        case 'adr-new': newAdr(); break;
        case 'pr-approve': decide(id, 'approved'); break;
        case 'pr-changes': decide(id, 'changes'); break;
        case 'pr-reopen': decide(id, 'open'); break;
        case 'debt-plan': {
          const d = store.state.debts.find((x) => x.id === id);
          const project = store.state.projects.find((p) => p.squad === d?.squad);
          if (!d || !project) return;
          const taskId = store.nextId('task', 'T-');
          store.update((s) => {
            s.debts.find((x) => x.id === id)!.status = 'planned';
            s.tasks.push({ id: taskId, title: d.title, projectId: project.id, assignee: null, status: 'backlog', points: POINTS[d.cost - 1], sprintId: null, type: 'debt', priority: d.impact >= 4 ? 'P1' : 'P2' });
          });
          toast(t('debt.planned', { id, task: taskId }));
          break;
        }
        case 'run': {
          if (activeRun()) { toast(t('cicd.busy'), 'warn'); return; }
          const options = store.state.reviews.map((r) => r.title).concat(store.state.tasks.filter((x) => x.status === 'review').map((x) => x.title));
          const title = options[Number($<HTMLSelectElement>('#run-change', root)?.value ?? 0)] ?? plain(actorName());
          const runId = startRun(title, actorId());
          toast(t('cicd.toast.started', { id: runId }));
          break;
        }
      }
    }),
    store.subscribe((kind) => {
      if (kind !== 'state') return;
      if (tab !== 'cicd') { render(); return; }
      // CI/CD 分頁只更新內容，不重建流程圖
      const status = $('#cicd-status', root);
      const history = $('#cicd-history', root);
      if (status) setHtml(status, cicdStatus());
      if (history) setHtml(history, historyHtml());
      flow?.update(pipelineSpec(shownRun()));
      schedule();
    }),
  ];

  render();
  return () => {
    clearTimeout(timer);
    offs.forEach((off) => off());
    flow?.destroy();
    document.querySelectorAll('dialog.modal').forEach((d) => d.remove());
  };
}
