import { shortDate } from '../core/date';
import { getLang, sentences, t, tx } from '../core/i18n';
import { href, type Route } from '../core/router';
import { activeIncident, activeSprint, memberById, sprintStats } from '../core/selectors';
import { store } from '../core/store';
import type { DeviceId, MetricKey } from '../core/types';
import { SQUADS } from '../mock/members';
import { METRIC_KEYS, METRIC_META } from '../mock/metrics';
import { sim, type DeviceSample, type Tick } from '../sim/engine';
import type { FactoryHandle, FactoryLabel } from '../three/factory';
import { $, compact, html, num, on, raw, setHtml, toast, type Safe } from '../ui/dom';
import { icon } from '../ui/icons';
import { ChartBag, loadCharts, loadFactory } from '../ui/lazy';
import { pageHead, statusChip } from '../ui/widgets';

// 總覽：工程指標銘牌帶 → 3D 能源資料工廠（含設備小卡與即時流量）→ 近 12 週趨勢。

const BAR_METRICS: MetricKey[] = ['deployFreq', 'velocity', 'defects'];

function sparkline(values: number[]): Safe {
  const w = 62;
  const h = 22;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (w - 6), h - 3 - ((v - min) / span) * (h - 6)]);
  const [lx, ly] = pts[pts.length - 1];
  return raw(`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--series-1)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.6" fill="var(--series-1)"/></svg>`);
}

function meter(key: MetricKey): Safe {
  const meta = METRIC_META[key];
  const series = store.state.metrics.map((m) => m[key]);
  const cur = series[series.length - 1];
  const diff = Math.round((cur - series[series.length - 2]) * 10) / 10;
  const good = meta.better === 'higher' ? diff > 0 : diff < 0;
  const cls = diff === 0 ? 'is-flat' : good ? 'is-good' : 'is-bad';
  const arrow = diff === 0 ? '＝' : diff > 0 ? '▲' : '▼';
  return html`<div class="meter">
    <div class="meter-label">${tx(meta.label)}</div>
    <div class="meter-value">${cur}<small>${tx(meta.unit)}</small></div>
    <div class="meter-foot"><span class="delta ${cls}" title="${t('dash.vsLast')}">${arrow} ${Math.abs(diff)}<span class="sr-only"> ${t('dash.vsLast')}</span></span>${sparkline(series)}</div>
  </div>`;
}

const fmtLatency = (ms: number) => (ms >= 1000 ? html`${(ms / 1000).toFixed(2)}<small>s</small>` : html`${Math.round(ms)}<small>ms</small>`);

function statusOf(sample: DeviceSample | undefined): Safe {
  const st = sample?.status ?? 'ok';
  return st === 'ok' ? statusChip('ok', t('dash.ok')) : st === 'anomaly' ? statusChip('crit', t('dash.anomaly')) : statusChip('crit', t('dash.incident'));
}

export function mount(root: HTMLElement, route: Route): () => void {
  const engine = sim();
  const charts = new ChartBag();
  let factory: FactoryHandle | null = null;
  let disposed = false;
  const wanted = route.query.get('device') as DeviceId | null;
  let selected: DeviceId | null = store.state.devices.some((d) => d.id === wanted) ? wanted : null;
  let statusKey = '';

  const labels = (): FactoryLabel[] => store.state.devices.map((d) => ({ id: d.id, tag: d.tag, name: tx(d.name) }));
  const dora = METRIC_KEYS.filter((k) => METRIC_META[k].dora);
  const rest = METRIC_KEYS.filter((k) => !METRIC_META[k].dora);

  /** 標題下的那一行：Sprint 進度與有沒有線上事件，都從資料算出來。 */
  function summary(): string {
    const st = sprintStats(store.state, activeSprint(store.state));
    const incident = activeIncident(store.state);
    return sentences(
      t('dash.sum', { sprint: st.sprint.name, day: st.todayIndex + 1, done: st.done, total: st.committed }),
      incident ? t('dash.sumIncident', { id: incident.id }) : t('dash.sumCalm'),
    );
  }

  setHtml(root, html`<div class="page">
    ${pageHead(t('nav.dashboard'), summary())}
    <section class="meters" aria-label="${t('dash.dora')}">
      <div class="meter-group"><h2 class="meter-cap">${t('dash.dora')}</h2><div class="meter-row" style="--n:${dora.length}">${dora.map(meter)}</div></div>
      <div class="meter-group"><h2 class="meter-cap">${t('dash.delivery')}</h2><div class="meter-row" style="--n:${rest.length}">${rest.map(meter)}</div></div>
    </section>
    <section class="stage-wrap">
      <div class="stage" id="stage">
        <div class="stage-labels" id="stage-labels"></div>
        <div class="stage-title"><h2>${t('dash.factory')}</h2><p>${t('dash.factoryHint')}</p></div>
        <div class="stage-msg" id="stage-msg">${t('dash.loading3d')}</div>
        <div class="stage-tools">
          <button type="button" class="btn btn-sm btn-icon" data-act="zoom-in" title="${t('dash.zoomIn')}" aria-label="${t('dash.zoomIn')}">${icon('plus', 16)}</button>
          <button type="button" class="btn btn-sm btn-icon" data-act="zoom-out" title="${t('dash.zoomOut')}" aria-label="${t('dash.zoomOut')}"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
          <button type="button" class="btn btn-sm" data-act="reset-view">${icon('focus', 16)}${t('dash.resetView')}</button>
          <label class="check"><input type="checkbox" id="lowfx" ${store.prefs.lowFx ? raw('checked') : ''} />${t('dash.lowFx')}</label>
        </div>
      </div>
      <aside class="device-card" id="device-card" aria-live="off"></aside>
      <dl class="live-strip" id="live-strip"></dl>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>${t('dash.trends')}</h2><a class="btn btn-sm" href="${href('/systems')}">${t('dash.openSystems')}</a></div>
      <div class="charts" id="charts">${METRIC_KEYS.map((k) => {
        const last = store.state.metrics[store.state.metrics.length - 1][k];
        return html`<div class="chart-box"><h3>${tx(METRIC_META[k].label)}<b>${last} <span class="small muted">${tx(METRIC_META[k].unit)}</span></b></h3><div class="chart-canvas"><canvas data-metric="${k}" role="img" aria-label="${tx(METRIC_META[k].label)}"></canvas></div></div>`;
      })}</div>
    </section>
  </div>`);

  const card = $('#device-card', root)!;
  const strip = $('#live-strip', root)!;

  function renderCard(): void {
    const tick = engine.latest;
    if (!selected) {
      setHtml(card, html`<h3>${t('dash.pick')}</h3><p class="muted small">${t('dash.pickHint')}</p>
        <div class="task-links">${store.state.devices.map((d) => html`<a href="${href('/dashboard', { device: d.id })}" data-device="${d.id}"><span class="tag">${d.tag}</span><span>${tx(d.name)}</span><span style="margin-left:auto">${statusOf(tick.devices[d.id])}</span></a>`)}</div>
        <div><h4 class="small muted">${t('dash.keyTitle')}</h4><dl class="kv key">
          <dt>${t('dash.key.raw')}</dt><dd>${t('dash.key.rawIs')}</dd><dt>${t('dash.key.press')}</dt><dd>${t('dash.key.pressIs')}</dd>
          <dt>${t('dash.key.product')}</dt><dd>${t('dash.key.productIs')}</dd><dt>${t('dash.key.belt')}</dt><dd>${t('dash.key.beltIs')}</dd></dl></div>`);
      return;
    }
    const d = store.state.devices.find((x) => x.id === selected)!;
    const s = tick.devices[d.id];
    const tasks = store.state.tasks.filter((x) => x.deviceId === d.id && x.status !== 'done').slice(0, 5);
    const by = memberById(store.state, d.deployedBy);
    setHtml(card, html`
      <div class="device-head"><span class="tag">${d.tag}</span><span data-live="status">${statusOf(s)}</span>
        <button type="button" class="btn btn-quiet btn-sm btn-icon" data-act="deselect" style="margin-left:auto" title="${t('dash.deselect')}" aria-label="${t('dash.deselect')}">${icon('close', 16)}</button></div>
      <div><h3>${tx(d.name)}</h3><p class="muted small">${tx(d.role)}</p><p class="muted small">${tx(d.site)}</p></div>
      <dl class="device-stats">
        <div><dt>${t('dash.throughput')}</dt><dd data-live="tp"></dd></div>
        <div><dt>${t('dash.latency')}</dt><dd data-live="lat"></dd></div>
        <div><dt>${t('dash.error')}</dt><dd data-live="err"></dd></div>
      </dl>
      <dl class="kv">
        <dt>${t('dash.owner')}</dt><dd>${tx(SQUADS[d.squad])}</dd>
        <dt>${t('dash.lastDeploy')}</dt><dd><span class="num">${d.version}</span><br /><span class="muted small">${t('dash.deployedBy', { date: shortDate(d.lastDeploy), name: by ? tx(by.name) : '—' })}</span></dd>
      </dl>
      <div><h4 class="small muted">${t('dash.related')}</h4>
        ${tasks.length
          ? html`<div class="task-links">${tasks.map((x) => html`<a href="${href('/projects', { tab: 'kanban', task: x.id })}"><span class="tag">${x.id}</span><span>${tx(x.title)}</span></a>`)}</div>`
          : html`<p class="muted small">${t('dash.noTasks')}</p>`}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">
        <button type="button" class="btn btn-sm" data-act="inject">${icon('alert', 15)}${t('dash.inject')}</button>
        <a class="btn btn-sm" href="${href('/systems')}">${t('dash.openSystems')}</a>
      </div>`);
    renderLive(tick);
  }

  function renderLive(tick: Tick): void {
    if (selected) {
      const d = store.state.devices.find((x) => x.id === selected)!;
      const s = tick.devices[selected];
      const set = (key: string, content: Safe) => { const el = $(`[data-live="${key}"]`, card); if (el) setHtml(el, content); };
      set('tp', html`${num(Math.round(s.throughput))}<small>${tx(d.throughputUnit)}</small>`);
      set('lat', fmtLatency(s.latency));
      set('err', html`${s.error.toFixed(2)}<small>%</small>`);
      set('status', statusOf(s));
    }
    setHtml(strip, html`
      <div><dt>${t('dash.liveIngest')}</dt><dd>${num(Math.round(tick.total.throughput))}<small>${t('dash.perSec')}</small></dd></div>
      <div><dt>${t('dash.liveLatency')}</dt><dd>${(tick.total.latency / 1000).toFixed(2)}<small>s</small></dd></div>
      <div><dt>${t('dash.liveError')}</dt><dd>${tick.total.error.toFixed(2)}<small>%</small></dd></div>
      <div><dt>${t('dash.today')}</dt><dd>${compact(tick.today, getLang())}<small>${t('dash.points')}</small></dd></div>
      <div><dt>${t('dash.perDay')}</dt><dd>${compact(tick.total.throughput * 86400, getLang())}<small>${t('dash.points')}</small></dd></div>`);
  }

  function applyTick(tick: Tick): void {
    renderLive(tick);
    factory?.setFlow(tick.flow);
    for (const d of store.state.devices) factory?.setStatus(d.id, tick.devices[d.id].status);
    // 沒選設備時，清單裡的狀態燈只在狀態有變時才重畫
    const key = store.state.devices.map((d) => tick.devices[d.id].status).join();
    if (key !== statusKey) {
      statusKey = key;
      if (!selected) renderCard();
    }
  }

  function select(id: DeviceId | null): void {
    selected = id;
    renderCard();
  }

  renderCard();
  applyTick(engine.latest);
  const offTick = engine.subscribe(applyTick);

  const offClick = on(root, 'click', '[data-act], [data-device]', (event, el) => {
    if (el.dataset.device) {
      event.preventDefault();
      const id = el.dataset.device as DeviceId;
      select(id);
      factory?.focus(id);
      return;
    }
    switch (el.dataset.act) {
      case 'zoom-in': factory?.zoomBy(1.35); break;
      case 'zoom-out': factory?.zoomBy(1 / 1.35); break;
      case 'reset-view': factory?.resetView(); break;
      case 'deselect': select(null); factory?.focus(null); factory?.resetView(); break;
      case 'inject':
        if (selected) {
          engine.inject(selected);
          toast(t('dash.injected', { tag: store.state.devices.find((d) => d.id === selected)!.tag }), 'warn');
        }
        break;
    }
  });
  const offChange = on(root, 'change', '#lowfx', (_e, el) => {
    const low = (el as HTMLInputElement).checked;
    store.setPrefs({ lowFx: low });
    factory?.setLowFx(low);
  });
  const offStore = store.subscribe((kind) => {
    if (kind !== 'state') return;
    renderCard();
    const sum = $('#page-sum', root);
    if (sum) sum.textContent = summary();
  });

  // 3D 與圖表都等首屏畫完、瀏覽器有空時才載入
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  idle(() => {
    void loadFactory().then(async ({ createFactory }) => {
      if (disposed) return;
      const made = await createFactory({
        container: $('#stage', root)!, labelLayer: $('#stage-labels', root)!, labels: labels(), ariaLabel: t('dash.canvasLabel'), lowFx: store.prefs.lowFx, onSelect: select,
        onAutoLowFx: () => {
          store.setPrefs({ lowFx: true });
          const box = $<HTMLInputElement>('#lowfx', root);
          if (box) box.checked = true;
        },
      });
      // 初始化是非同步的：如果使用者在這段時間已經離開這一頁，就直接釋放
      if (disposed) { made.dispose(); return; }
      factory = made;
      $('#stage-msg', root)?.remove();
      applyTick(engine.latest);
      if (selected) factory.focus(selected);
    }).catch(() => { const msg = $('#stage-msg', root); if (msg) msg.textContent = t('dash.no3d'); });
  });
  idle(() => {
    void loadCharts().then(async ({ trendChart }) => {
      const weeks = store.state.metrics.map((m) => m.week);
      // 一次只建一張圖，中間讓出主執行緒，七張圖就不會擠成一個長任務
      for (const canvas of Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas[data-metric]'))) {
        if (disposed) return;
        const key = canvas.dataset.metric as MetricKey;
        charts.add(trendChart(canvas, {
          labels: weeks, values: store.state.metrics.map((m) => m[key]), name: tx(METRIC_META[key].label), unit: tx(METRIC_META[key].unit),
          kind: BAR_METRICS.includes(key) ? 'bar' : 'line',
        }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
  });

  return () => {
    disposed = true;
    offTick();
    offClick();
    offChange();
    offStore();
    charts.clear();
    factory?.dispose();
  };
}
