import { minutesToRecover, postmortemTemplate } from '../ai/postmortem';
import { can } from '../core/auth';
import { clock } from '../core/date';
import { getLang, t, tx, type I18nKey } from '../core/i18n';
import { advanceIncident, currentIncident, INCIDENT_STAGES, nextStage, triggerIncident } from '../core/incident';
import { href } from '../core/router';
import { memberById } from '../core/selectors';
import { store } from '../core/store';
import type { Incident } from '../core/types';
import type { FlowHandle, FlowSpec } from '../flow/FlowIsland';
import { PIPELINE_STAGES } from '../mock/devices';
import { SCENARIOS } from '../mock/incidents';
import { sim, type Tick } from '../sim/engine';
import type { LiveChart } from '../ui/charts';
import { $, compact, copyText, html, num, on, openModal, raw, setHtml, toast, type Safe } from '../ui/dom';
import { attachFlow } from '../ui/flowMount';
import { icon } from '../ui/icons';
import { loadCharts } from '../ui/lazy';
import { actionBtn, pageHead, statusChip } from '../ui/widgets';

// 系統與事件：互動架構圖（即時數字）→ 即時模擬與 z-score 異常偵測 → 事件處理流程與 Postmortem。

const STAGE_POS: Record<string, [number, number]> = {
  site: [0, 85], collect: [235, 85], stream: [470, 85], tsdb: [780, 0], analytics: [780, 200], alert: [1040, 200], report: [1040, 0],
};
const EDGES: [string, string, I18nKey | null][] = [
  ['site', 'collect', null], ['collect', 'stream', null], ['stream', 'tsdb', 'sys.edge.write'], ['stream', 'analytics', 'sys.edge.features'],
  ['tsdb', 'analytics', 'sys.edge.history'], ['analytics', 'alert', null], ['tsdb', 'report', 'sys.edge.query'], ['analytics', 'report', 'sys.edge.rollup'],
];

export function mount(root: HTMLElement): () => void {
  const engine = sim();
  let stageKey: string | null = null;
  let arch: FlowHandle | null = null;
  let incFlow: FlowHandle | null = null;
  let tpChart: LiveChart | null = null;
  let latChart: LiveChart | null = null;
  let disposed = false;
  let signature = '';
  let anomalyCount = -1;

  const who = (id: string) => (id === 'system' ? t('sys.by.system') : memberById(store.state, id) ? tx(memberById(store.state, id)!.name) : t(`role.${id}` as I18nKey));

  function archSpec(tick: Tick): FlowSpec {
    const { state } = store;
    const spec: FlowSpec = { nodes: [], edges: [] };
    for (const st of PIPELINE_STAGES) {
      const d = state.devices.find((x) => x.id === st.deviceId)!;
      const s = tick.devices[d.id];
      const [x, y] = STAGE_POS[st.key];
      spec.nodes.push({
        id: st.key, x, y, tag: d.tag, title: tx(st.name), subtitle: tx(st.note),
        tone: s.status === 'ok' ? 'ok' : 'crit',
        badge: s.status === 'ok' ? undefined : s.status === 'incident' ? t('dash.incident') : t('dash.anomaly'),
        stats: [
          { label: t('sys.tp'), value: `${num(Math.round(s.throughput))} ${tx(d.throughputUnit)}` },
          { label: t('sys.lat'), value: s.latency >= 1000 ? `${(s.latency / 1000).toFixed(2)} s` : `${Math.round(s.latency)} ms` },
          { label: t('sys.err'), value: `${s.error.toFixed(2)}%` },
        ],
      });
    }
    for (const [a, b, label] of EDGES) {
      const src = PIPELINE_STAGES.find((p) => p.key === a)!;
      const bad = tick.devices[src.deviceId].status !== 'ok';
      spec.edges.push({ id: `${a}-${b}`, source: a, target: b, label: label ? t(label) : undefined, animated: true, tone: bad ? 'crit' : 'ok' });
    }
    return spec;
  }

  function selectBar(): Safe {
    const st = PIPELINE_STAGES.find((p) => p.key === stageKey);
    if (!st) return html`<span class="muted">${t('sys.pickStage')}</span>`;
    const d = store.state.devices.find((x) => x.id === st.deviceId)!;
    return html`<span class="tag">${d.tag}</span><b>${tx(st.name)}</b><span class="muted">${tx(d.role)}，${d.version}</span>
      <span style="margin-left:auto" class="row"><button type="button" class="btn btn-sm" data-act="inject">${icon('alert', 15)}${t('sys.inject')}</button>
      <a class="btn btn-sm" href="${href('/dashboard', { device: d.id })}">${icon('focus', 15)}${t('sys.view3d')}</a></span>`;
  }

  function liveStats(tick: Tick): Safe {
    return html`
      <div><dt>${t('dash.liveIngest')}</dt><dd>${num(Math.round(tick.total.throughput))}<small>${t('dash.perSec')}</small></dd></div>
      <div><dt>${t('dash.liveLatency')}</dt><dd>${(tick.total.latency / 1000).toFixed(2)}<small>s</small></dd></div>
      <div><dt>${t('dash.liveError')}</dt><dd>${tick.total.error.toFixed(2)}<small>%</small></dd></div>
      <div><dt>${t('dash.today')}</dt><dd>${compact(tick.today, getLang())}<small>${t('dash.points')}</small></dd></div>
      <div><dt>${t('dash.perDay')}</dt><dd>${compact(tick.total.throughput * 86400, getLang())}<small>${t('dash.points')}</small></dd></div>`;
  }

  function anomalyLog(): Safe {
    const list = engine.anomalies.slice(0, 8);
    if (!list.length) return html`<p class="empty small">${t('sys.noAnomalies')}</p>`;
    return html`<div class="table-wrap"><table class="table"><thead><tr><th>${t('sys.col.time')}</th><th>${t('sys.col.device')}</th><th>${t('sys.col.metric')}</th><th class="num">${t('sys.col.value')}</th><th class="num">z</th></tr></thead>
      <tbody>${list.map((a) => { const d = store.state.devices.find((x) => x.id === a.deviceId)!; return html`<tr><td class="num" style="text-align:left">${clock(new Date(a.at).toISOString())}</td><td><span class="tag">${d.tag}</span> ${tx(d.name)}</td>
        <td>${a.metric === 'latency' ? t('dash.latency') : t('dash.throughput')}</td><td class="num">${num(Math.round(a.value))}</td><td class="num">${a.z.toFixed(1)}</td></tr>`; })}</tbody></table></div>`;
  }

  function incidentSpec(incident: Incident): FlowSpec {
    const spec: FlowSpec = { nodes: [], edges: [] };
    const at = INCIDENT_STAGES.indexOf(incident.stage);
    const upcoming = nextStage(incident.stage);
    INCIDENT_STAGES.forEach((stage, i) => {
      const entry = incident.timeline.find((e) => e.stage === stage);
      spec.nodes.push({
        id: stage, x: i * 220, y: i % 2 ? 46 : 0, width: 176,
        title: t(`sys.stage.${stage}` as I18nKey),
        subtitle: entry ? `${clock(entry.at)}　${who(entry.by)}` : t('sys.pending'),
        tone: i < at ? 'done' : i === at ? (stage === 'closed' ? 'done' : 'active') : 'idle',
        action: stage === upcoming ? {
          id: 'advance', label: t(`sys.act.${stage}` as I18nKey), primary: true,
          lockedWhy: can('incident.manage') ? undefined : t('common.locked', { role: t(`role.${store.prefs.role}` as I18nKey), perm: t('perm.incident.manage') }),
        } : undefined,
      });
      if (i > 0) spec.edges.push({ id: `${INCIDENT_STAGES[i - 1]}-${stage}`, source: INCIDENT_STAGES[i - 1], target: stage, tone: i <= at ? 'done' : 'idle', animated: i === at + 1, dashed: i > at + 1 });
    });
    return spec;
  }

  function incidentDetail(incident: Incident): Safe {
    const { state } = store;
    const d = state.devices.find((x) => x.id === incident.deviceId)!;
    const manage = can('incident.manage');
    const mttr = minutesToRecover(incident);
    const known = INCIDENT_STAGES.indexOf(incident.stage) >= INCIDENT_STAGES.indexOf('mitigating');
    return html`<div class="incident-grid">
      <section class="panel"><div class="panel-head"><span class="tag">${incident.id}</span><h2>${tx(incident.title)}</h2>${statusChip(incident.stage === 'recovered' || incident.stage === 'postmortem' ? 'ok' : 'crit', incident.severity)}</div>
        <div class="panel-body stack">
          <dl class="kv">
            <dt>${t('sys.affected')}</dt><dd><span class="tag">${d.tag}</span> ${tx(d.name)}（${tx(d.role)}）　<a href="${href('/dashboard', { device: d.id })}">${t('sys.view3d')}</a></dd>
            <dt>${t('sys.impact')}</dt><dd>${tx(incident.impact)}</dd>
            <dt>${t('sys.rootCause')}</dt><dd>${known ? tx(incident.rootCause) : html`<span class="muted">${t('sys.rootUnknown')}</span>`}</dd>
            <dt>${t('sys.mitigation')}</dt><dd>${known ? tx(incident.mitigation) : html`<span class="muted">—</span>`}</dd>
            ${mttr ? html`<dt>${t('sys.mttr')}</dt><dd><b class="num">${t('sys.minutes', { n: mttr })}</b>${incident.compressed ? html` <span class="muted small">${t('sys.compressed')}</span>` : ''}</dd>` : ''}
          </dl>
          ${manage ? '' : html`<div class="locked-note">${icon('lock')}<span>${t('sys.viewOnly', { perm: t('perm.incident.manage') })}</span></div>`}
        </div></section>
      <section class="panel"><div class="panel-body stack">
        <label class="field"><span>${t('sys.commander')}</span><select id="commander" ${manage && incident.stage === 'triggered' ? '' : raw('disabled')}>
          <option value="">${t('sys.pickCommander')}</option>${state.members.filter((m) => m.active).map((m) => html`<option value="${m.id}" ${m.id === incident.commander ? raw('selected') : ''}>${tx(m.name)}（${tx(m.level)}）</option>`)}</select></label>
        <ul class="timeline">${incident.timeline.map((e) => html`<li><time>${clock(e.at)}</time><span><b>${t(`sys.stage.${e.stage}` as I18nKey)}</b>　${who(e.by)}</span></li>`)}</ul>
      </div></section>
    </div>
    ${incident.stage === 'postmortem' ? html`<section class="panel"><div class="panel-head"><h2>${t('sys.pm')}</h2><span class="muted">${t('sys.pmHint')}</span></div>
      <div class="panel-body stack"><textarea id="pm" style="min-height:340px;font-family:ui-monospace,Menlo,monospace;font-size:13.5px" ${manage ? '' : raw('disabled')}>${incident.postmortem}</textarea>
      <div class="row">${actionBtn({ act: 'pm-copy', label: t('sys.pmCopy'), icon: 'copy' })}${actionBtn({ act: 'pm-reset', label: t('sys.pmReset'), perm: 'incident.manage', icon: 'retry' })}</div></div></section>` : ''}`;
  }

  function historyTable(): Safe {
    const closed = store.state.incidents.filter((i) => i.stage === 'closed');
    return html`<section class="panel"><div class="panel-head"><h2>${t('sys.history')}</h2></div><div class="table-wrap"><table class="table">
      <thead><tr><th></th><th>${t('sys.incident')}</th><th>${t('sys.severity')}</th><th>${t('sys.affected')}</th><th>${t('sys.commander')}</th><th class="num">${t('sys.mttr')}</th><th></th></tr></thead>
      <tbody>${closed.map((i) => { const d = store.state.devices.find((x) => x.id === i.deviceId)!; const m = minutesToRecover(i); return html`<tr><td><span class="tag">${i.id}</span></td><td>${tx(i.title)}<div class="small muted num">${i.startedAt.slice(0, 10)}</div></td>
        <td>${i.severity}</td><td><span class="tag">${d.tag}</span></td><td>${i.commander ? who(i.commander) : '—'}</td><td class="num">${m ? t('sys.minutes', { n: m }) : '—'}</td>
        <td><button type="button" class="btn btn-sm" data-act="view-pm" data-id="${i.id}">${t('sys.viewPm')}</button></td></tr>`; })}</tbody></table></div></section>`;
  }

  function renderIncident(): void {
    incFlow?.destroy();
    incFlow = null;
    const box = $('#incident-box', root)!;
    const incident = currentIncident();
    if (!incident) {
      setHtml(box, html`<section class="panel"><div class="panel-body row">
        <span class="muted">${t('sys.noActive')}</span>
        <label class="field" style="margin-left:auto;flex-direction:row;align-items:center;gap:8px"><span>${t('sys.scenario')}</span><select id="scenario">${SCENARIOS.map((s, i) => html`<option value="${i}">${s.severity}　${tx(s.title)}</option>`)}</select></label>
        ${actionBtn({ act: 'simulate', label: t('sys.simulate'), perm: 'incident.manage', cls: 'btn-primary', icon: 'alert' })}
      </div></section>${historyTable()}`);
      return;
    }
    setHtml(box, html`<div class="flow is-short" id="incident-flow" style="height:270px"></div>${incidentDetail(incident)}${historyTable()}`);
    incFlow = attachFlow($('#incident-flow', root)!, incidentSpec(incident), {
      onAction: () => {
        const cur = currentIncident();
        if (!cur || !can('incident.manage')) return;
        const commander = $<HTMLSelectElement>('#commander', root)?.value;
        if (cur.stage === 'triggered' && !commander) { toast(t('sys.needCommander'), 'warn'); return; }
        const next = advanceIncident(cur.id, commander);
        const after = store.state.incidents.find((i) => i.id === cur.id)!;
        if (next === 'recovered') toast(t('sys.toast.recovered', { n: minutesToRecover(after) ?? 1 }));
        if (next === 'closed') toast(t('sys.toast.closed', { id: cur.id }));
      },
    });
  }

  const sig = () => { const i = currentIncident(); return `${i?.id}:${i?.stage}:${i?.commander}:${store.state.incidents.length}:${store.prefs.role}`; };

  setHtml(root, html`<div class="page">
    ${pageHead(t('nav.systems'), t('sys.lead'))}
    <section class="stack" style="gap:0"><h2 class="section-title" style="margin-bottom:6px">${t('sys.arch')}</h2><p class="muted small" style="margin-bottom:10px;max-width:90ch">${t('sys.archHint')}</p>
      <div class="flow has-bar" id="arch-flow" style="height:440px"></div><div class="select-bar" id="select-bar"></div></section>
    <section class="panel"><div class="panel-head"><h2>${t('sys.live')}</h2><span class="muted">${t('sys.zscore')}</span></div>
      <dl class="live-strip" id="live-stats" style="border-top:0;border-bottom:1px solid var(--line-2)"></dl>
      <div class="panel-body stack"><p class="muted small" style="max-width:90ch">${t('sys.liveHint')}</p>
        <div class="grid cols-2">
          <div><h3 class="section-title">${t('sys.chart.tp')}</h3><div class="chart-mid"><canvas id="live-tp" role="img" aria-label="${t('sys.chart.tp')}"></canvas></div></div>
          <div><h3 class="section-title">${t('sys.chart.lat')}</h3><div class="chart-mid"><canvas id="live-lat" role="img" aria-label="${t('sys.chart.lat')}"></canvas></div></div>
        </div>
        <div><h3 class="section-title">${t('sys.anomalies')}</h3><div id="anomaly-log"></div></div>
      </div></section>
    <section class="stack"><h2 class="section-title">${t('sys.incident')}</h2><p class="muted small" style="max-width:90ch">${t('sys.incidentLead')}</p><div class="stack" id="incident-box" style="gap:18px"></div></section>
  </div>`);

  const bar = $('#select-bar', root)!;
  const stats = $('#live-stats', root)!;
  const log = $('#anomaly-log', root)!;
  setHtml(bar, selectBar());
  arch = attachFlow($('#arch-flow', root)!, archSpec(engine.latest), {
    layoutKey: 'arch',
    onNodeClick: (id) => { stageKey = id; setHtml(bar, selectBar()); arch?.update(archSpec(engine.latest), stageKey); },
  });

  const point = (tick: Tick, value: number) => ({ label: clock(new Date(tick.at).toISOString()), value: Math.round(value), anomaly: tick.total.anomaly });
  void loadCharts().then(({ liveChart }) => {
    const a = $<HTMLCanvasElement>('#live-tp', root);
    const b = $<HTMLCanvasElement>('#live-lat', root);
    if (disposed || !a || !b) return;
    tpChart = liveChart(a, t('dash.liveIngest'), t('dash.perSec'));
    latChart = liveChart(b, t('dash.liveLatency'), 'ms');
    const recent = engine.history.slice(-60);
    tpChart.load(recent.map((x) => point(x, x.total.throughput)));
    latChart.load(recent.map((x) => point(x, x.total.latency)));
  });

  function applyTick(tick: Tick): void {
    setHtml(stats, liveStats(tick));
    arch?.update(archSpec(tick), stageKey);
    tpChart?.push(point(tick, tick.total.throughput));
    latChart?.push(point(tick, tick.total.latency));
    if (engine.anomalies.length !== anomalyCount || tick.fresh.length) {
      anomalyCount = engine.anomalies.length;
      setHtml(log, anomalyLog());
    }
  }
  applyTick(engine.latest);
  signature = sig();
  renderIncident();

  const offs = [
    engine.subscribe(applyTick),
    store.subscribe(() => {
      // 只有事件的階段、指揮官或角色變了才重畫；編輯 Postmortem 文字不會打斷輸入。
      const next = sig();
      if (next !== signature) { signature = next; renderIncident(); }
    }),
    on(root, 'focusout', '#pm', (_e, el) => {
      const cur = currentIncident();
      const text = (el as HTMLTextAreaElement).value;
      if (cur && cur.postmortem !== text) store.update((s) => { s.incidents.find((i) => i.id === cur.id)!.postmortem = text; });
    }),
    on(root, 'click', '[data-act]', (_e, el) => {
      switch (el.dataset.act) {
        case 'inject': {
          const st = PIPELINE_STAGES.find((p) => p.key === stageKey);
          if (!st) return;
          engine.inject(st.deviceId);
          toast(t('sys.toast.injected', { tag: store.state.devices.find((d) => d.id === st.deviceId)!.tag }), 'warn');
          break;
        }
        case 'simulate': {
          const id = triggerIncident(Number($<HTMLSelectElement>('#scenario', root)?.value ?? 0));
          toast(t('sys.toast.triggered', { id }), 'warn');
          break;
        }
        case 'pm-copy':
          void copyText($<HTMLTextAreaElement>('#pm', root)?.value ?? '').then((ok) => ok && toast(t('common.copied')));
          break;
        case 'pm-reset': {
          const cur = currentIncident();
          if (!cur) return;
          const text = postmortemTemplate(store.state, cur, getLang());
          const area = $<HTMLTextAreaElement>('#pm', root);
          if (area) area.value = text;
          store.update((s) => { s.incidents.find((i) => i.id === cur.id)!.postmortem = text; });
          break;
        }
        case 'view-pm': {
          const incident = store.state.incidents.find((i) => i.id === el.dataset.id);
          if (!incident) return;
          const text = incident.postmortem || postmortemTemplate(store.state, incident, getLang());
          openModal(html`<div class="modal-head"><span class="tag">${incident.id}</span><h2>${tx(incident.title)}</h2><button type="button" class="btn btn-quiet btn-icon" data-close aria-label="${t('common.close')}">${icon('close', 16)}</button></div>
            <div class="modal-body"><pre class="md">${text}</pre></div>
            <div class="modal-foot"><button type="button" class="btn" id="pm-modal-copy">${icon('copy', 16)}${t('sys.pmCopy')}</button><button type="button" class="btn btn-primary" data-close>${t('common.close')}</button></div>`,
          (dialog) => {
            dialog.classList.add('is-wide');
            $('#pm-modal-copy', dialog)!.addEventListener('click', () => void copyText(text).then((ok) => ok && toast(t('common.copied'))));
          });
          break;
        }
      }
    }),
  ];

  return () => {
    disposed = true;
    offs.forEach((off) => off());
    arch?.destroy();
    incFlow?.destroy();
    tpChart?.destroy();
    latChart?.destroy();
  };
}
