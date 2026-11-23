import { can, canAssignTask, canMoveTask, persona } from '../core/auth';
import { daysBetween, DEMO_TODAY, shortDate } from '../core/date';
import { getLang, plain, sentences, t, tx, type I18nKey } from '../core/i18n';
import { href, type Route } from '../core/router';
import { activeSprint, memberById, memberLoad, sprintStats, sprintTasks } from '../core/selectors';
import { store } from '../core/store';
import type { Project, Task, TaskStatus } from '../core/types';
import type { FlowHandle, FlowSpec } from '../flow/FlowIsland';
import { SQUADS } from '../mock/members';
import { QUARTER } from '../mock/okrs';
import { $, $$, html, on, openModal, raw, setHtml, toast, type Safe } from '../ui/dom';
import { attachFlow } from '../ui/flowMount';
import { icon } from '../ui/icons';
import { ChartBag, loadCharts } from '../ui/lazy';
import { actionBtn, avatar, bar, pageHead, statusChip, tabs } from '../ui/widgets';

// 專案管理：甘特圖、Kanban（可拖曳）、Sprint 規劃與燃盡圖、季度 OKR 與路線圖對齊。

const STATUSES: TaskStatus[] = ['backlog', 'progress', 'review', 'done'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => { const m = Number(ym.slice(5, 7)); return getLang() === 'zh' ? `${m} 月` : MONTHS_EN[m - 1]; };
const projectChip = (p: Project): Safe => statusChip(p.status === 'onTrack' ? 'ok' : p.status === 'atRisk' ? 'warn' : 'crit', t(`proj.status.${p.status}` as I18nKey));
const roleName = () => t(`role.${store.prefs.role}` as I18nKey);

export function mount(root: HTMLElement, route: Route): () => void {
  let tab = route.query.get('tab') ?? 'gantt';
  const who = persona();
  const filters = { project: route.query.get('project') ?? '', assignee: '', mine: store.prefs.role === 'engineer' };
  let sprintId = activeSprint(store.state).id;
  const charts = new ChartBag();
  let flow: FlowHandle | null = null;
  let dragId: string | null = null;
  const standup = { yesterday: '', today: '', blockers: '' };

  const name = (id: string | null | undefined) => { const m = memberById(store.state, id); return m ? tx(m.name) : t('common.unassigned'); };
  const projectOf = (task: Task) => store.state.projects.find((p) => p.id === task.projectId);

  // ───── 甘特圖
  function ganttTab(): Safe {
    const { state } = store;
    const total = daysBetween(QUARTER.start, QUARTER.end) + 1;
    const pos = (iso: string) => Math.max(0, Math.min(100, (daysBetween(QUARTER.start, iso) / total) * 100));
    const months = [['2026-10', 27], ['2026-11', 30], ['2026-12', 31], ['2027-01', 17]] as const;
    const today = pos(DEMO_TODAY);
    return html`<section class="panel"><div class="panel-head"><h2>${QUARTER.label}</h2><span class="muted">${t('proj.ganttCaption', { date: shortDate(DEMO_TODAY) })}</span></div>
      <div class="table-wrap"><div class="gantt" style="min-width:820px">
        <div class="gantt-head"><div class="gantt-label">${t('proj.col.project')}</div><div class="gantt-months" style="position:relative">${months.map(([ym, days]) => html`<span style="flex:${days}">${monthLabel(ym)}</span>`)}<span class="gantt-today-label" style="left:${today}%">${t('proj.today')}</span></div></div>
        ${state.projects.map((p) => {
          const left = pos(p.start);
          const width = pos(p.end) - left;
          return html`<div class="gantt-row">
            <div class="gantt-label"><a href="${href('/projects', { tab: 'kanban', project: p.id })}" title="${t('proj.viewTasks')}">${tx(p.name)}</a>
              <div class="row">${projectChip(p)}<span>${name(p.owner)}</span></div></div>
            <div class="gantt-track">
              <div class="gantt-bar is-${p.status}" style="left:${left}%;width:${width}%" title="${p.start} → ${p.end}"><i style="width:${p.progress}%"></i></div>
              <span class="gantt-pct" style="left:${left + width}%">${p.progress}%</span>
              ${p.milestones.map((m) => html`<span class="gantt-ms ${m.date < DEMO_TODAY ? 'is-past' : ''}" style="left:${pos(m.date)}%" title="${shortDate(m.date)} ${tx(m.name)}"></span>`)}
              <span class="gantt-today" style="left:${today}%"></span>
            </div></div>`;
        })}
      </div></div></section>
      <section class="panel"><div class="table-wrap"><table class="table">
        <thead><tr><th>${t('proj.col.project')}</th><th>${t('proj.col.squad')}</th><th>${t('proj.col.owner')}</th><th>${t('proj.col.progress')}</th><th>${t('proj.col.objective')}</th><th>${t('proj.col.next')}</th><th></th></tr></thead>
        <tbody>${state.projects.map((p) => {
          const next = p.milestones.find((m) => m.date >= DEMO_TODAY);
          const objective = state.objectives.find((o) => o.id === p.objectiveId);
          return html`<tr><td><b>${tx(p.name)}</b><div class="small muted" style="max-width:44ch">${tx(p.description)}</div></td>
            <td>${tx(SQUADS[p.squad])}</td><td><span class="row nowrap" style="flex-wrap:nowrap">${avatar(memberById(state, p.owner), true)}${name(p.owner)}</span></td>
            <td style="min-width:170px"><div class="row" style="justify-content:space-between"><span class="num">${p.progress}%</span>${projectChip(p)}</div>${bar(p.progress)}</td>
            <td class="small">${tx(objective?.title)}</td><td class="small">${next ? html`<span class="num">${shortDate(next.date)}</span> ${tx(next.name)}` : '—'}</td>
            <td><a class="btn btn-sm" href="${href('/projects', { tab: 'kanban', project: p.id })}">${t('proj.viewTasks')}</a></td></tr>`;
        })}</tbody></table></div></section>`;
  }

  // ───── Kanban
  function kanbanHint(): string {
    if (can('task.assign')) return t('kanban.hint.all');
    if (can('task.manageSquad') && who.squad) return t('kanban.hint.squad', { squad: tx(SQUADS[who.squad]) });
    if (can('task.updateOwn') && who.memberId) return t('kanban.hint.own');
    return t('kanban.hint.none');
  }

  function card(task: Task): Safe {
    const movable = canMoveTask(task);
    const i = STATUSES.indexOf(task.status);
    const m = memberById(store.state, task.assignee);
    return html`<article class="kb-card ${movable ? '' : 'is-locked'}" draggable="${String(movable)}" data-task="${task.id}" tabindex="0" aria-label="${task.id} ${tx(task.title)}">
      <div class="kb-top"><span class="tag">${task.id}</span><span class="kb-type">${t(`task.type.${task.type}` as I18nKey)}</span>${task.priority === 'P0' ? html`<span class="p0">P0</span>` : ''}<span class="pts" title="${t('task.points')}">${task.points}</span></div>
      <p class="kb-title">${tx(task.title)}</p>
      <div class="kb-foot"><span>${tx(projectOf(task)?.name)}</span><span class="who-sm">${avatar(m, true)}${m ? tx(m.name) : t('common.unassigned')}</span></div>
      ${movable ? html`<div class="kb-move">
        ${i > 0 ? html`<button type="button" class="btn btn-sm" data-move="-1" data-id="${task.id}" title="${t('kanban.left')}" aria-label="${t('kanban.left')}">${icon('left', 14)}</button>` : ''}
        ${i < STATUSES.length - 1 ? html`<button type="button" class="btn btn-sm" data-move="1" data-id="${task.id}" title="${t('kanban.right')}" aria-label="${t('kanban.right')}">${icon('right', 14)}</button>` : ''}</div>` : ''}
    </article>`;
  }

  function kanbanTab(): Safe {
    const { state } = store;
    const list = state.tasks.filter((x) => (!filters.project || x.projectId === filters.project)
      && (!filters.assignee || x.assignee === filters.assignee) && (!filters.mine || !who.memberId || x.assignee === who.memberId));
    return html`
      <p class="hint">${can('task.assign') || can('task.manageSquad') || can('task.updateOwn') ? '' : icon('lock', 15)}${kanbanHint()}</p>
      <div class="filters">
        <label class="field"><span>${t('kanban.project')}</span><select id="f-project"><option value="">${t('common.all')}</option>${state.projects.map((p) => html`<option value="${p.id}" ${p.id === filters.project ? raw('selected') : ''}>${tx(p.name)}</option>`)}</select></label>
        <label class="field"><span>${t('kanban.assignee')}</span><select id="f-assignee"><option value="">${t('common.all')}</option>${state.members.map((m) => html`<option value="${m.id}" ${m.id === filters.assignee ? raw('selected') : ''}>${tx(m.name)}</option>`)}</select></label>
        ${who.memberId ? html`<label class="check"><input type="checkbox" id="f-mine" ${filters.mine ? raw('checked') : ''} />${t('kanban.mine')}</label>` : ''}
      </div>
      <div class="kanban">${STATUSES.map((st) => {
        const col = list.filter((x) => x.status === st);
        return html`<section class="kb-col" data-status="${st}" aria-label="${t(`status.${st}` as I18nKey)}">
          <div class="kb-head"><h3>${t(`status.${st}` as I18nKey)}</h3><span>${t('kanban.count', { n: col.length, p: col.reduce((s, x) => s + x.points, 0) })}</span></div>
          <div class="kb-list">${col.length ? col.map(card) : html`<p class="empty small">${t('kanban.empty')}</p>`}</div></section>`;
      })}</div>`;
  }

  function moveTask(id: string, status: TaskStatus): void {
    const task = store.state.tasks.find((x) => x.id === id);
    if (!task || task.status === status) return;
    if (!canMoveTask(task)) { toast(t('kanban.noMove', { role: roleName() }), 'warn'); return; }
    store.update((s) => { s.tasks.find((x) => x.id === id)!.status = status; });
    toast(t('kanban.moved', { id, status: t(`status.${status}` as I18nKey) }));
  }

  function openTask(id: string): void {
    const { state } = store;
    const task = state.tasks.find((x) => x.id === id);
    if (!task) return;
    const project = projectOf(task);
    const move = canMoveTask(task);
    const assign = canAssignTask(task);
    const plan = can('sprint.plan');
    const device = state.devices.find((d) => d.id === task.deviceId);
    const sprint = activeSprint(state);
    // Tech Lead 只能指派給自己小組的人；主管可以指派給任何人
    const pool = state.members.filter((m) => m.active && (can('task.assign') || m.squad === project?.squad));
    openModal(html`
      <div class="modal-head"><span class="tag">${task.id}</span><h2>${tx(task.title)}</h2><button type="button" class="btn btn-quiet btn-icon" data-close aria-label="${t('common.close')}">${icon('close', 16)}</button></div>
      <div class="modal-body">
        <dl class="kv"><dt>${t('task.project')}</dt><dd>${tx(project?.name)}</dd><dt>${t('task.type')}</dt><dd>${t(`task.type.${task.type}` as I18nKey)}</dd>
          <dt>${t('task.priority')}</dt><dd>${task.priority}</dd><dt>${t('task.points')}</dt><dd class="num">${task.points}</dd>
          ${device ? html`<dt>${t('task.device')}</dt><dd><span class="tag">${device.tag}</span> ${tx(device.name)}　<a href="${href('/dashboard', { device: device.id })}" data-close>${t('task.viewDevice')}</a></dd>` : ''}
          ${task.requestId ? html`<dt></dt><dd><a href="${href('/collab')}" data-close>${t('task.fromRequest', { id: task.requestId })}</a></dd>` : ''}</dl>
        <div class="form-row">
          <label class="field"><span>${t('task.status')}</span><select id="tk-status" ${move ? '' : raw('disabled')}>${STATUSES.map((s) => html`<option value="${s}" ${s === task.status ? raw('selected') : ''}>${t(`status.${s}` as I18nKey)}</option>`)}</select></label>
          <label class="field"><span>${t('task.assignee')}</span><select id="tk-assignee" ${assign ? '' : raw('disabled')}><option value="">${t('common.unassigned')}</option>${(assign ? pool : state.members).map((m) => html`<option value="${m.id}" ${m.id === task.assignee ? raw('selected') : ''}>${tx(m.name)}（${memberLoad(state, m).pct}%）</option>`)}</select></label>
        </div>
        <label class="row"><input type="checkbox" id="tk-sprint" ${task.sprintId === sprint.id ? raw('checked') : ''} ${plan ? '' : raw('disabled')} />${t('task.sprint')}（${sprint.name}）</label>
        ${!move && !assign && !plan ? html`<div class="locked-note">${icon('lock')}<span>${t('task.readonly')}</span></div>` : ''}
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>${t('common.close')}</button>${move || assign || plan ? html`<button type="button" class="btn btn-primary" id="tk-save">${t('common.save')}</button>` : ''}</div>`,
    (dialog, close) => {
      $('#tk-save', dialog)?.addEventListener('click', () => {
        const status = $<HTMLSelectElement>('#tk-status', dialog)!.value as TaskStatus;
        const assignee = $<HTMLSelectElement>('#tk-assignee', dialog)!.value || null;
        const inSprint = $<HTMLInputElement>('#tk-sprint', dialog)!.checked;
        store.update((s) => {
          const target = s.tasks.find((x) => x.id === id)!;
          if (move) target.status = status;
          if (assign) target.assignee = assignee;
          if (plan) target.sprintId = inSprint ? sprint.id : target.sprintId === sprint.id ? null : target.sprintId;
        });
        close();
        toast(t('task.saved', { id }));
      });
    });
  }

  // ───── Sprint
  function sprintTab(): Safe {
    const { state } = store;
    const sprint = state.sprints.find((s) => s.id === sprintId) ?? activeSprint(state);
    const st = sprintStats(state, sprint);
    const open = sprint.status !== 'done';
    const inSprint = sprintTasks(state, sprint.id);
    const candidates = state.tasks.filter((x) => x.sprintId === null && x.status !== 'done');
    const gapText = sprint.status !== 'active' ? '' : st.gap > 2 ? t('sprint.behind', { n: st.gap }) : st.gap < -2 ? t('sprint.ahead', { n: -st.gap }) : t('sprint.onPace');
    const todays = state.standups.filter((s) => s.date === DEMO_TODAY);
    return html`
      <div class="filters"><label class="field"><span>${t('sprint.select')}</span><select id="sprint-select">${[...state.sprints].reverse().map((s) => html`<option value="${s.id}" ${s.id === sprint.id ? raw('selected') : ''}>${s.name}（${t(`sprint.status.${s.status}` as I18nKey)}，${shortDate(s.start)}–${shortDate(s.end)}）</option>`)}</select></label>
        <p class="muted" style="padding-bottom:6px"><b>${t('sprint.goal')}</b>　${tx(sprint.goal)}</p></div>
      <dl class="stats">
        <div><dt>${t('sprint.committed')}</dt><dd>${st.committed}<small>${t('common.pts')}</small></dd></div>
        <div><dt>${t('sprint.done')}</dt><dd>${st.done}<small>${t('common.pts')}</small></dd></div>
        <div><dt>${t('sprint.review')}</dt><dd>${st.inReview}<small>${t('common.pts')}</small></dd></div>
        <div><dt>${t('sprint.remaining')}</dt><dd>${st.remaining}<small>${t('common.pts')}</small></dd></div>
        <div><dt>${t('sprint.capacity')}</dt><dd>${st.capacity}<small>${t('common.pts')}</small></dd></div>
      </dl>
      ${gapText ? html`<div class="banner ${st.gap > 2 ? '' : 'is-quiet'}">${icon(st.gap > 2 ? 'alert' : 'check')}<span>${gapText}</span></div>` : ''}
      ${open && st.committed > st.capacity ? html`<div class="banner">${icon('alert')}<span>${t('sprint.overCap', { n: st.committed - st.capacity })}</span></div>` : ''}
      <div class="grid cols-2">
        <section class="panel"><div class="panel-head"><h2>${t('sprint.burndown')}</h2><span class="muted">${sprint.name}</span></div><div class="panel-body"><div class="chart-tall"><canvas id="burndown" role="img" aria-label="${t('sprint.burndown')}"></canvas></div></div></section>
        <section class="panel"><div class="panel-head"><h2>${open ? t('sprint.capVs') : t('sprint.velocity')}</h2></div><div class="panel-body"><div class="chart-tall"><canvas id="second-chart" role="img" aria-label="${open ? t('sprint.capVs') : t('sprint.velocity')}"></canvas></div></div></section>
      </div>
      ${open ? html`<section class="panel"><div class="panel-head"><h2>${t('sprint.plan')}</h2></div>
        <div class="panel-body grid cols-2">
          <div><h3 class="section-title">${t('sprint.inSprint', { p: st.committed })}</h3><ul class="plan-list">${inSprint.map((x) => html`<li><span class="tag">${x.id}</span><span class="grow">${tx(x.title)}<span class="small muted">　${name(x.assignee)}</span></span><span class="pts">${x.points}</span>${actionBtn({ act: 'sprint-remove', label: t('sprint.remove'), perm: 'sprint.plan', cls: 'btn-sm', data: { id: x.id } })}</li>`)}</ul></div>
          <div><h3 class="section-title">${t('sprint.candidates')}</h3>${candidates.length ? html`<ul class="plan-list">${candidates.map((x) => html`<li><span class="tag">${x.id}</span><span class="grow">${tx(x.title)}<span class="small muted">　${name(x.assignee)}</span></span><span class="pts">${x.points}</span>${actionBtn({ act: 'sprint-add', label: t('sprint.add'), perm: 'sprint.plan', cls: 'btn-sm', data: { id: x.id } })}</li>`)}</ul>` : html`<p class="muted small">${t('sprint.noCandidates')}</p>`}</div>
        </div></section>` : ''}
      <section class="panel"><div class="panel-head"><h2>${t('sprint.standup')}</h2><span class="muted num">${DEMO_TODAY}</span></div>
        <div class="panel-body grid cols-2">
          <div>${todays.map((s) => { const m = memberById(state, s.memberId); return html`<div class="standup">${avatar(m)}<div><b>${m ? tx(m.name) : ''}</b>
            <dl><dt>${t('sprint.yesterday')}</dt><dd>${tx(s.yesterday)}</dd><dt>${t('sprint.todayPlan')}</dt><dd>${tx(s.today)}</dd><dt>${t('sprint.blockers')}</dt><dd>${tx(s.blockers)}</dd></dl></div></div>`; })}</div>
          <div class="stack">
            ${who.memberId ? html`<p class="small muted">${t('sprint.standupAs', { name: tx(who.name) })}</p>
              <label class="field"><span>${t('sprint.yesterday')}</span><input type="text" id="su-yesterday" value="${standup.yesterday}" ${can('standup.write') ? '' : raw('disabled')} /></label>
              <label class="field"><span>${t('sprint.todayPlan')}</span><input type="text" id="su-today" value="${standup.today}" ${can('standup.write') ? '' : raw('disabled')} /></label>
              <label class="field"><span>${t('sprint.blockers')}</span><input type="text" id="su-blockers" value="${standup.blockers}" ${can('standup.write') ? '' : raw('disabled')} /></label>
              <div>${actionBtn({ act: 'standup-post', label: t('sprint.post'), perm: 'standup.write', cls: 'btn-primary' })}</div>`
              : html`<div class="locked-note">${icon('lock')}<span>${t('sprint.noIdentity')}</span></div>`}
          </div>
        </div></section>`;
  }

  function sprintCharts(): void {
    const { state } = store;
    const sprint = state.sprints.find((s) => s.id === sprintId) ?? activeSprint(state);
    const st = sprintStats(state, sprint);
    void loadCharts().then(({ linesChart, barsChart }) => {
      const a = $<HTMLCanvasElement>('#burndown', root);
      const b = $<HTMLCanvasElement>('#second-chart', root);
      if (!a?.isConnected || !b) return;
      charts.add(linesChart(a, st.ideal.map((_, i) => `D${i}`), [
        { name: t('sprint.ideal'), data: st.ideal, color: 's1', dashed: true },
        { name: t('sprint.actual'), data: st.actual, color: 's2' },
      ], t('common.pts')));
      if (sprint.status === 'done') {
        const past = state.sprints.filter((s) => s.status !== 'planned');
        charts.add(barsChart(b, past.map((s) => s.name.replace('Sprint ', 'S')), [
          { name: t('sprint.commitSeries'), data: past.map((s) => sprintStats(state, s).committed), color: 's1' },
          { name: t('sprint.completedSeries'), data: past.map((s) => sprintStats(state, s).done), color: 's2' },
        ], t('common.pts')));
      } else {
        const people = state.members.filter((m) => m.active);
        const tasks = sprintTasks(state, sprint.id);
        charts.add(barsChart(b, people.map((m) => tx(m.name)), [
          { name: t('sprint.capSeries'), data: people.map((m) => m.capacity), color: 's1' },
          { name: t('sprint.commitSeries'), data: people.map((m) => tasks.filter((x) => x.assignee === m.id).reduce((s, x) => s + x.points, 0)), color: 's2' },
        ], t('common.pts')));
      }
    });
  }

  // ───── OKR
  function okrList(): Safe {
    const { state } = store;
    const edit = can('okr.edit');
    return html`${state.objectives.map((o, n) => {
      const pct = Math.round(o.krs.reduce((s, k) => s + k.progress, 0) / o.krs.length);
      return html`<div class="objective"><div class="objective-head"><span class="tag">O${n + 1}</span><h3>${tx(o.title)}</h3>
          <span class="row small muted" style="flex-wrap:nowrap">${avatar(memberById(state, o.owner), true)}${name(o.owner)}</span><span class="pct">${pct}%</span></div>
        ${o.krs.map((k) => html`<div class="kr"><label for="${k.id}">${tx(k.title)}</label>
          <input type="range" id="${k.id}" data-kr="${k.id}" data-objective="${o.id}" min="0" max="100" step="5" value="${k.progress}" ${edit ? '' : raw('disabled')} aria-valuetext="${k.progress}%" />
          <output for="${k.id}">${k.progress}%</output></div>`)}</div>`;
    })}`;
  }

  function roadmapHtml(): Safe {
    const { state } = store;
    const months = [...new Set(state.roadmap.map((r) => r.month))].sort();
    return html`${months.map((ym) => html`<div><h3>${monthLabel(ym)}</h3>${state.roadmap.filter((r) => r.month === ym).map((r) => {
      const oi = state.objectives.findIndex((o) => o.id === r.objectiveId);
      return html`<div class="rm-item is-${r.status}">${tx(r.title)}<div class="row"><span class="tag">O${oi + 1}</span>${statusChip(r.status === 'done' ? 'ok' : r.status === 'inProgress' ? 'info' : 'mute', t(`okr.rm.${r.status}` as I18nKey))}</div></div>`;
    })}</div>`)}`;
  }

  function alignSpec(): FlowSpec {
    const { state } = store;
    const edit = can('okr.edit');
    const spec: FlowSpec = { nodes: [], edges: [] };
    state.projects.forEach((p, i) => spec.nodes.push({ id: p.id, x: 0, y: 30 + i * 118, tag: t('okr.kind.project'), badge: `${p.progress}%`, title: tx(p.name), tone: p.status === 'onTrack' ? 'ok' : p.status === 'atRisk' ? 'warn' : 'crit' }));
    state.roadmap.forEach((r, i) => {
      spec.nodes.push({ id: r.id, x: 300, y: i * 80, tag: monthLabel(r.month), badge: t(`okr.rm.${r.status}` as I18nKey), title: tx(r.title), tone: r.status === 'done' ? 'done' : r.status === 'inProgress' ? 'ok' : 'idle', canSource: edit });
      if (r.projectId) spec.edges.push({ id: `pe-${r.id}`, source: r.projectId, target: r.id, tone: 'idle', curve: 'default' });
      spec.edges.push({ id: `oe-${r.id}`, source: r.id, target: r.objectiveId, tone: r.status === 'done' ? 'done' : r.status === 'inProgress' ? 'ok' : 'idle', dashed: r.status === 'planned', animated: r.status === 'inProgress', curve: 'default' });
    });
    state.objectives.forEach((o, i) => {
      const pct = Math.round(o.krs.reduce((s, k) => s + k.progress, 0) / o.krs.length);
      spec.nodes.push({ id: o.id, x: 620, y: 40 + i * 190, tag: `O${i + 1}`, title: tx(o.title), tone: 'active', canTarget: true, stats: [{ label: t('proj.col.progress'), value: `${pct}%` }, { label: t('proj.col.owner'), value: name(o.owner) }] });
    });
    return spec;
  }

  function okrTab(): Safe {
    return html`
      <section class="panel"><div class="panel-head"><h2>${t('okr.title', { q: QUARTER.label })}</h2>${can('okr.edit') ? html`<span class="muted">${t('okr.editHint')}</span>` : html`<span class="chip is-plain">${icon('lock', 13)} ${t('perm.okr.edit')}</span>`}</div><div id="okr-list">${okrList()}</div></section>
      <section class="stack"><h2 class="section-title">${t('okr.align')}</h2><p class="muted small" style="max-width:90ch">${t('okr.alignHint')}</p><div class="flow is-tall" id="align-flow" style="height:600px"></div></section>
      <section class="panel"><div class="panel-head"><h2>${t('okr.roadmap')}</h2></div><div class="roadmap" id="roadmap">${roadmapHtml()}</div></section>`;
  }

  /** 標題下的那一行：專案數、有風險的數量，以及 Sprint 是否落後。 */
  function summary(): string {
    const { state } = store;
    const st = sprintStats(state, activeSprint(state));
    return sentences(
      t('proj.sum', { n: state.projects.length, risk: state.projects.filter((p) => p.status !== 'onTrack').length }),
      st.gap > 2 && t('proj.sumBehind', { sprint: st.sprint.name, gap: st.gap }),
    );
  }

  // ───── 繪製
  function render(): void {
    charts.clear();
    flow?.destroy();
    flow = null;
    setHtml(root, html`<div class="page">
      ${pageHead(t('nav.projects'), summary())}
      ${tabs([{ id: 'gantt', label: t('proj.tab.gantt') }, { id: 'kanban', label: t('proj.tab.kanban') }, { id: 'sprint', label: t('proj.tab.sprint') }, { id: 'okr', label: t('proj.tab.okr') }], tab)}
      ${tab === 'kanban' ? kanbanTab() : tab === 'sprint' ? sprintTab() : tab === 'okr' ? okrTab() : ganttTab()}
    </div>`);
    if (tab === 'sprint') sprintCharts();
    if (tab === 'okr') {
      flow = attachFlow($('#align-flow', root)!, alignSpec(), {
        layoutKey: 'okr-align',
        minimap: true,
        onConnect: (source, target) => {
          const item = store.state.roadmap.find((r) => r.id === source);
          const objective = store.state.objectives.find((o) => o.id === target);
          if (!item || !objective || !can('okr.edit')) return;
          store.update((s) => { s.roadmap.find((r) => r.id === source)!.objectiveId = target; });
          toast(t('okr.realigned', { item: tx(item.title), obj: tx(objective.title) }));
        },
      });
    }
  }

  /** OKR 分頁在資料變動時只更新內容，不重建流程圖（保留使用者的縮放與拖曳）。 */
  function refreshOkr(): void {
    const list = $('#okr-list', root);
    const roadmap = $('#roadmap', root);
    if (!list || !roadmap) { render(); return; }
    setHtml(list, okrList());
    setHtml(roadmap, roadmapHtml());
    const sum = $('#page-sum', root);
    if (sum) sum.textContent = summary();
    flow?.update(alignSpec());
  }

  const offs = [
    on(root, 'click', '[data-tab]', (_e, el) => { tab = el.dataset.tab!; render(); }),
    on(root, 'change', '#f-project, #f-assignee, #f-mine, #sprint-select', (_e, el) => {
      if (el.id === 'f-project') filters.project = (el as HTMLSelectElement).value;
      else if (el.id === 'f-assignee') filters.assignee = (el as HTMLSelectElement).value;
      else if (el.id === 'f-mine') filters.mine = (el as HTMLInputElement).checked;
      else sprintId = (el as HTMLSelectElement).value;
      render();
    }),
    on(root, 'input', '#su-yesterday, #su-today, #su-blockers', (_e, el) => {
      standup[el.id.replace('su-', '') as keyof typeof standup] = (el as HTMLInputElement).value;
    }),
    on(root, 'input', '[data-kr]', (_e, el) => { const out = el.nextElementSibling; if (out) out.textContent = `${(el as HTMLInputElement).value}%`; }),
    on(root, 'change', '[data-kr]', (_e, el) => {
      store.update((s) => {
        const kr = s.objectives.find((o) => o.id === el.dataset.objective)?.krs.find((k) => k.id === el.dataset.kr);
        if (kr) kr.progress = Number((el as HTMLInputElement).value);
      });
      toast(t('okr.saved'));
    }),
    on(root, 'click', '[data-move]', (e, el) => {
      e.stopPropagation();
      const task = store.state.tasks.find((x) => x.id === el.dataset.id);
      const next = task && STATUSES[STATUSES.indexOf(task.status) + Number(el.dataset.move)];
      if (task && next) moveTask(task.id, next);
    }),
    on(root, 'click', '.kb-card', (e, el) => { if (!(e.target as Element).closest('[data-move]')) openTask(el.dataset.task!); }),
    on(root, 'keydown', '.kb-card', (e, el) => { if (e.key === 'Enter' && e.target === el) openTask(el.dataset.task!); }),
    on(root, 'dragstart', '.kb-card', (e, el) => {
      dragId = el.dataset.task!;
      e.dataTransfer?.setData('text/plain', dragId);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-dragging');
    }),
    on(root, 'dragend', '.kb-card', (_e, el) => {
      el.classList.remove('is-dragging');
      $$('.kb-col.is-over', root).forEach((c) => c.classList.remove('is-over'));
      dragId = null;
    }),
    on(root, 'dragover', '.kb-col', (e, el) => { if (dragId) { e.preventDefault(); el.classList.add('is-over'); } }),
    on(root, 'dragleave', '.kb-col', (e, el) => { if (!el.contains(e.relatedTarget as Node | null)) el.classList.remove('is-over'); }),
    on(root, 'drop', '.kb-col', (e, el) => {
      e.preventDefault();
      const id = dragId ?? e.dataTransfer?.getData('text/plain');
      el.classList.remove('is-over');
      if (id) moveTask(id, el.dataset.status as TaskStatus);
    }),
    on(root, 'click', '[data-act]', (_e, el) => {
      const id = el.dataset.id;
      switch (el.dataset.act) {
        case 'sprint-add': store.update((s) => { const x = s.tasks.find((k) => k.id === id); if (x) x.sprintId = sprintId; }); break;
        case 'sprint-remove': store.update((s) => { const x = s.tasks.find((k) => k.id === id); if (x) x.sprintId = null; }); break;
        case 'standup-post': {
          if (!who.memberId) return;
          if (!standup.today.trim()) { toast(t('sprint.standupEmpty'), 'warn'); return; }
          const entry = { id: `su-${Date.now()}`, memberId: who.memberId, date: DEMO_TODAY, yesterday: plain(standup.yesterday.trim() || t('common.none')), today: plain(standup.today.trim()), blockers: plain(standup.blockers.trim() || t('common.none')) };
          standup.yesterday = standup.today = standup.blockers = '';
          store.update((s) => { s.standups = [entry, ...s.standups.filter((x) => !(x.memberId === entry.memberId && x.date === entry.date))]; });
          toast(t('sprint.posted'));
          break;
        }
      }
    }),
    store.subscribe((kind) => { if (kind !== 'state') return; if (tab === 'okr') refreshOkr(); else render(); }),
  ];

  render();
  const wanted = route.query.get('task');
  if (wanted) openTask(wanted);

  return () => {
    offs.forEach((off) => off());
    charts.clear();
    flow?.destroy();
    document.querySelectorAll('dialog.modal').forEach((d) => d.remove());
  };
}
