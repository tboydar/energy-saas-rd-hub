import { draftFeedback } from '../ai/feedback';
import { can } from '../core/auth';
import { DEMO_TODAY } from '../core/date';
import { comma, getLang, plain, t, tx, type I18nKey } from '../core/i18n';
import { ROLES } from '../core/rbac';
import type { Route } from '../core/router';
import { memberLoad, type Load } from '../core/selectors';
import { store } from '../core/store';
import type { HiringStage, Member, RoleId, SkillKey, SquadId } from '../core/types';
import type { FlowHandle, FlowSpec, FlowTone } from '../flow/FlowIsland';
import { HIRING_STAGES } from '../mock/hiring';
import { PERSONAS, SKILL_LABELS, SQUADS } from '../mock/members';
import { $, html, on, openModal, raw, setHtml, toast, type Safe } from '../ui/dom';
import { attachFlow } from '../ui/flowMount';
import { icon } from '../ui/icons';
import { ChartBag, loadCharts } from '../ui/lazy';
import { actionBtn, avatar, bar, pageHead, statusChip, tabs } from '../ui/widgets';

// 團隊管理：成員負載與成長（含 1:1、績效回饋草稿）、組織圖、招募漏斗。

const SKILLS = Object.keys(SKILL_LABELS) as SkillKey[];
const loadChip = (load: Load): Safe =>
  load.level === 'over' ? statusChip('crit', t('team.load.over'))
    : load.level === 'high' ? statusChip('warn', t('team.load.high'))
      : load.level === 'low' ? statusChip('mute', t('team.load.low')) : statusChip('ok', t('team.load.ok'));

export function mount(root: HTMLElement, route: Route): () => void {
  let tab = route.query.get('tab') ?? 'members';
  let selectedId = route.query.get('member') ?? store.state.members[0].id;
  const charts = new ChartBag();
  let flow: FlowHandle | null = null;
  // 尚未儲存的輸入內容：重畫時要放回去，才不會因為勾一個核取方塊就把打到一半的字清掉。
  const draft = { summary: '', actions: '', mood: 3, feedback: new Map<string, string>() };

  const selected = (): Member => store.state.members.find((m) => m.id === selectedId) ?? store.state.members[0];

  function membersTab(): Safe {
    const { state } = store;
    const rows = state.members.map((m) => ({ m, load: memberLoad(state, m) }));
    const over = rows.filter((r) => r.load.level === 'over' && r.m.active);
    return html`
      ${over.length ? html`<div class="banner" role="status">${icon('alert')}<span>${t('team.overload', { n: over.length, names: over.map((r) => `${tx(r.m.name)} ${r.load.pct}%`).join(getLang() === 'zh' ? '、' : ', ') })}</span></div>` : ''}
      <div class="grid split">
        <section class="panel"><div class="table-wrap"><table class="table">
          <thead><tr><th>${t('team.col.member')}</th><th>${t('team.col.squad')}</th><th>${t('team.col.load')}</th><th>${t('team.col.okr')}</th></tr></thead>
          <tbody>${rows.map(({ m, load }) => html`
            <tr class="is-clickable ${m.id === selectedId ? 'is-selected' : ''}" data-member="${m.id}" tabindex="0" aria-selected="${String(m.id === selectedId)}">
              <td><div class="member-cell">${avatar(m)}<div><b>${tx(m.name)}</b><span>${tx(m.level)}</span></div></div></td>
              <td>${tx(SQUADS[m.squad])}${m.active ? '' : html` <span class="chip is-plain">${t('team.inactive')}</span>`}</td>
              <td class="load-cell"><div class="row"><span class="num">${load.pct}%</span>${loadChip(load)}</div>${bar(load.pct, load.level)}</td>
              <td class="load-cell"><div class="row"><span class="num">${m.okrProgress}%</span></div>${bar(m.okrProgress, m.okrProgress >= 60 ? 'good' : 'ok')}</td>
            </tr>`)}</tbody>
        </table></div></section>
        ${detail(selected())}
      </div>`;
  }

  function detail(m: Member): Safe {
    const load = memberLoad(store.state, m);
    const priv = can('team.private');
    const write = can('oneonone.write');
    const feedback = draft.feedback.get(m.id) ?? m.feedbackDraft;
    return html`<aside class="panel detail"><div class="panel-body stack">
      <div class="detail-head">${avatar(m)}<div><h2>${tx(m.name)}</h2><p class="muted small">${tx(m.level)}${comma()}${tx(SQUADS[m.squad])}</p></div></div>
      <div class="row">${loadChip(load)}<span class="small muted">${t('team.loadDetail', { c: load.committed, cap: load.capacity })}</span>
        <span style="margin-left:auto">${actionBtn({ act: 'manage', label: t('team.manage'), perm: 'member.manage', cls: 'btn-sm' })}</span></div>
      <div><h3 class="section-title">${t('team.skills')}</h3><div class="radar-box"><canvas id="radar" role="img" aria-label="${t('team.skills')}: ${SKILLS.map((k) => `${tx(SKILL_LABELS[k])} ${m.skills[k]}`).join(', ')}"></canvas></div></div>
      <div><h3 class="section-title">${t('team.goal')}</h3><p>${tx(m.careerGoal)}</p></div>
      ${priv ? html`
        <div><h3 class="section-title">${t('team.growth')}</h3>
          <ul class="check-list">${m.growthPlan.map((g) => html`<li><input type="checkbox" id="${g.id}" data-growth="${g.id}" ${g.done ? raw('checked') : ''} ${write ? '' : raw('disabled')} /><label for="${g.id}" class="${g.done ? 'is-done' : ''}">${tx(g.text)}</label></li>`)}</ul></div>
        <div><h3 class="section-title">${t('team.oneOnOne')}</h3>
          ${m.oneOnOnes.length ? m.oneOnOnes.map((o) => html`<div class="note">
              <div class="note-meta"><span class="num">${o.date}</span><span>${t('team.mood')} <b class="num">${o.mood} / 5</b></span></div>
              <p>${tx(o.summary)}</p><dl><dt>${t('team.actions')}</dt><dd>${tx(o.actions)}</dd></dl></div>`) : html`<p class="muted small">${t('team.noOneOnOne')}</p>`}
        </div>
        <div class="stack"><h3 class="section-title">${t('team.addOneOnOne')}</h3>
          <div class="form-row">
            <label class="field" style="flex:0 0 120px"><span>${t('team.mood')}</span><select id="note-mood" ${write ? '' : raw('disabled')}>${[1, 2, 3, 4, 5].map((n) => html`<option value="${n}" ${n === draft.mood ? raw('selected') : ''}>${n} / 5</option>`)}</select></label>
          </div>
          <label class="field"><span>${t('team.summary')}</span><textarea id="note-summary" ${write ? '' : raw('disabled')}>${draft.summary}</textarea></label>
          <label class="field"><span>${t('team.actions')}</span><textarea id="note-actions" style="min-height:56px" ${write ? '' : raw('disabled')}>${draft.actions}</textarea></label>
          <div>${actionBtn({ act: 'save-note', label: t('team.saveNote'), perm: 'oneonone.write', cls: 'btn-primary' })}</div>
        </div>
        <div class="stack"><h3 class="section-title">${t('team.feedback')}</h3>
          <p class="muted small">${t('team.feedbackHint')}</p>
          <textarea id="feedback" style="min-height:200px" ${write ? '' : raw('disabled')}>${feedback}</textarea>
          <div class="row">${actionBtn({ act: 'ai-draft', label: t('team.aiDraft'), perm: 'oneonone.write' })}${actionBtn({ act: 'save-draft', label: t('team.saveDraft'), perm: 'oneonone.write' })}</div>
        </div>`
        : html`<div class="locked-note">${icon('lock')}<span>${t('team.private', { perm: t('perm.team.private') })}</span></div>`}
    </div></aside>`;
  }

  function orgSpec(): FlowSpec {
    const { state } = store;
    const spec: FlowSpec = { nodes: [], edges: [] };
    spec.nodes.push({ id: 'em', x: 0, y: 235, title: tx(PERSONAS.manager.name), subtitle: tx(PERSONAS.manager.title), tone: 'ok' });
    const tone = (l: Load): FlowTone => (l.level === 'over' ? 'crit' : l.level === 'high' ? 'warn' : l.level === 'low' ? 'idle' : 'done');
    let y = 0;
    for (const squad of Object.keys(SQUADS) as SquadId[]) {
      const people = state.members.filter((m) => m.squad === squad && m.active);
      const lead = people.find((m) => m.systemRole === 'techlead');
      const rest = people.filter((m) => m !== lead);
      const top = y;
      rest.forEach((m, i) => {
        const l = memberLoad(state, m);
        spec.nodes.push({ id: m.id, x: 560, y: top + i * 118, title: tx(m.name), subtitle: tx(m.level), badge: `${l.pct}%`, tag: tx(SQUADS[squad]), tone: tone(l) });
        spec.edges.push({ id: `e-${m.id}`, source: lead?.id ?? 'em', target: m.id, tone: 'idle' });
      });
      const height = Math.max(1, rest.length) * 118;
      if (lead) {
        const l = memberLoad(state, lead);
        spec.nodes.push({ id: lead.id, x: 280, y: top + (height - 118) / 2, title: tx(lead.name), subtitle: tx(lead.level), badge: `${l.pct}%`, tag: tx(SQUADS[squad]), tone: tone(l) });
        spec.edges.push({ id: `e-${lead.id}`, source: 'em', target: lead.id, tone: 'ok' });
      }
      y += height + 36;
    }
    return spec;
  }

  function hiringTab(): Safe {
    const { state } = store;
    return html`<p class="muted">${t('team.hiring.lead')}</p>
      <div class="grid cols-3">${state.positions.map((p) => {
        const max = p.funnel.applied || 1;
        return html`<section class="panel"><div class="panel-head"><h2>${tx(p.title)}</h2><span class="muted">${t('team.hiring.open', { n: p.openDays })}</span></div>
          <div class="panel-body stack"><p class="small muted">${tx(SQUADS[p.squad])}</p>
          <div class="funnel">${HIRING_STAGES.map((s) => html`<div class="funnel-row"><span>${t(`hire.${s}` as I18nKey)}</span><i style="width:${(p.funnel[s] / max) * 100}%"></i><b>${p.funnel[s]}</b></div>`)}</div></div></section>`;
      })}</div>
      <section class="panel"><div class="panel-head"><h2>${t('team.hiring.candidates')}</h2></div><div class="table-wrap"><table class="table">
        <thead><tr><th>${t('team.hiring.candidates')}</th><th>${t('team.hiring.position')}</th><th>${t('team.hiring.stage')}</th><th>${t('team.hiring.note')}</th><th>${t('team.hiring.move')}</th></tr></thead>
        <tbody>${state.candidates.map((c) => {
          const i = HIRING_STAGES.indexOf(c.stage);
          return html`<tr><td><b>${tx(c.alias)}</b></td><td>${tx(state.positions.find((p) => p.id === c.positionId)?.title)}</td>
            <td>${statusChip(c.stage === 'offer' ? 'ok' : 'info', t(`hire.${c.stage}` as I18nKey))}</td><td>${tx(c.note)}</td>
            <td><div class="row" style="flex-wrap:nowrap">
              ${actionBtn({ act: 'cand-move', label: '', icon: 'left', perm: 'hiring.manage', cls: 'btn-sm btn-icon', data: { id: c.id, dir: '-1' }, title: t('team.hiring.back'), enabled: i > 0 })}
              ${actionBtn({ act: 'cand-move', label: '', icon: 'right', perm: 'hiring.manage', cls: 'btn-sm btn-icon', data: { id: c.id, dir: '1' }, title: t('team.hiring.forward'), enabled: i < HIRING_STAGES.length - 1 })}
            </div></td></tr>`;
        })}</tbody></table></div></section>`;
  }

  function render(): void {
    charts.clear();
    flow?.destroy();
    flow = null;
    setHtml(root, html`<div class="page">
      ${pageHead(t('nav.team'), t('team.sum', { n: store.state.members.filter((m) => m.active).length, s: new Set(store.state.members.filter((m) => m.active).map((m) => m.squad)).size }))}
      ${tabs([{ id: 'members', label: t('team.tab.members') }, { id: 'org', label: t('team.tab.org') }, { id: 'hiring', label: t('team.tab.hiring') }], tab)}
      ${tab === 'members' ? membersTab() : tab === 'hiring' ? hiringTab() : html`<p class="muted">${t('team.org.lead')}</p><div class="flow is-tall" id="org-flow"></div>`}
    </div>`);
    if (tab === 'members') {
      const m = selected();
      const canvas = $<HTMLCanvasElement>('#radar', root);
      if (canvas) void loadCharts().then(({ radarChart }) => { if (canvas.isConnected) charts.add(radarChart(canvas, SKILLS.map((k) => tx(SKILL_LABELS[k])), SKILLS.map((k) => m.skills[k]), tx(m.name))); });
    }
    if (tab === 'org') {
      flow = attachFlow($('#org-flow', root)!, orgSpec(), {
        layoutKey: 'org',
        onNodeClick: (id) => {
          if (!store.state.members.some((x) => x.id === id)) return;
          selectedId = id;
          tab = 'members';
          render();
        },
      });
    }
  }

  function manage(m: Member): void {
    openModal(html`
      <div class="modal-head"><h2>${t('team.manageTitle', { name: tx(m.name) })}</h2></div>
      <div class="modal-body">
        <label class="field"><span>${t('team.field.squad')}</span><select id="mm-squad">${(Object.keys(SQUADS) as SquadId[]).map((s) => html`<option value="${s}" ${s === m.squad ? raw('selected') : ''}>${tx(SQUADS[s])}</option>`)}</select></label>
        <label class="field"><span>${t('team.field.role')}</span><select id="mm-role">${ROLES.map((r) => html`<option value="${r}" ${r === m.systemRole ? raw('selected') : ''}>${t(`role.${r}` as I18nKey)}</option>`)}</select></label>
        <label class="field"><span>${t('team.field.capacity')}</span><input type="number" id="mm-cap" min="0" max="30" value="${m.capacity}" /></label>
        <label class="row"><input type="checkbox" id="mm-active" ${m.active ? raw('checked') : ''} />${t('team.field.active')}</label>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>${t('common.cancel')}</button><button type="button" class="btn btn-primary" id="mm-save">${t('common.save')}</button></div>`,
    (dialog, close) => {
      $('#mm-save', dialog)!.addEventListener('click', () => {
        store.update((s) => {
          const target = s.members.find((x) => x.id === m.id)!;
          target.squad = $<HTMLSelectElement>('#mm-squad', dialog)!.value as SquadId;
          target.systemRole = $<HTMLSelectElement>('#mm-role', dialog)!.value as RoleId;
          target.capacity = Math.max(0, Number($<HTMLInputElement>('#mm-cap', dialog)!.value) || 0);
          target.active = $<HTMLInputElement>('#mm-active', dialog)!.checked;
        });
        close();
        toast(t('team.memberSaved'));
      });
    });
  }

  const offs = [
    on(root, 'click', '[data-tab]', (_e, el) => { tab = el.dataset.tab!; render(); }),
    on(root, 'click', '[data-member]', (_e, el) => { selectedId = el.dataset.member!; draft.summary = ''; draft.actions = ''; render(); }),
    on(root, 'keydown', '[data-member]', (e, el) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedId = el.dataset.member!; render(); } }),
    on(root, 'input', '#note-summary, #note-actions, #feedback, #note-mood', (_e, el) => {
      const value = (el as HTMLTextAreaElement).value;
      if (el.id === 'note-summary') draft.summary = value;
      else if (el.id === 'note-actions') draft.actions = value;
      else if (el.id === 'note-mood') draft.mood = Number(value);
      else draft.feedback.set(selectedId, value);
    }),
    on(root, 'change', '[data-growth]', (_e, el) => {
      store.update((s) => {
        const g = s.members.find((m) => m.id === selectedId)?.growthPlan.find((x) => x.id === el.dataset.growth);
        if (g) g.done = (el as HTMLInputElement).checked;
      });
    }),
    on(root, 'click', '[data-act]', (_e, el) => {
      const m = selected();
      switch (el.dataset.act) {
        case 'manage': manage(m); break;
        case 'save-note': {
          if (!draft.summary.trim()) { toast(t('team.noteEmpty'), 'warn'); return; }
          const note = { id: `${m.id}-o${Date.now()}`, date: DEMO_TODAY, mood: draft.mood, summary: plain(draft.summary.trim()), actions: plain(draft.actions.trim() || t('common.none')) };
          draft.summary = '';
          draft.actions = '';
          store.update((s) => { s.members.find((x) => x.id === m.id)!.oneOnOnes.unshift(note); });
          toast(t('team.noteSaved'));
          break;
        }
        case 'ai-draft':
          draft.feedback.set(m.id, draftFeedback(store.state, m, getLang()));
          render();
          toast(t('team.draftMade'));
          break;
        case 'save-draft': {
          const text = draft.feedback.get(m.id) ?? m.feedbackDraft;
          draft.feedback.delete(m.id);
          store.update((s) => { s.members.find((x) => x.id === m.id)!.feedbackDraft = text; });
          toast(t('team.draftSaved'));
          break;
        }
        case 'cand-move':
          store.update((s) => {
            const c = s.candidates.find((x) => x.id === el.dataset.id);
            if (!c) return;
            const next = HIRING_STAGES[HIRING_STAGES.indexOf(c.stage) + Number(el.dataset.dir)] as HiringStage | undefined;
            if (next) c.stage = next;
          });
          break;
      }
    }),
    store.subscribe((kind) => { if (kind === 'state') render(); }),
  ];

  render();
  return () => {
    offs.forEach((off) => off());
    charts.clear();
    flow?.destroy();
  };
}
