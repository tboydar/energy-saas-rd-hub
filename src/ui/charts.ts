import {
  BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineController, LineElement,
  PointElement, RadarController, RadialLinearScale, Tooltip, type ChartConfiguration,
} from 'chart.js';

// Chart.js 的薄封裝。這個模組用動態 import() 載入（見 lazy.ts），不會拖慢首屏。
// 圖表規則：一張圖只有一個 y 軸；兩個以上的數列一定有圖例；格線用細實線退到背景。

Chart.register(
  BarController, BarElement, CategoryScale, Filler, Legend, LinearScale, LineController, LineElement,
  PointElement, RadarController, RadialLinearScale, Tooltip,
);

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function palette() {
  return {
    s1: css('--series-1'), s2: css('--series-2'), s3: css('--series-3'),
    ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'),
    grid: css('--line-2'), panel: css('--panel'), crit: css('--crit'), warn: css('--warn'),
  };
}

function applyDefaults(): void {
  const p = palette();
  Chart.defaults.font.family = css('--font-ui');
  Chart.defaults.font.size = 13;
  Chart.defaults.color = p.ink2;
  Chart.defaults.borderColor = p.grid;
  Chart.defaults.animation = false;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor = css('--steel');
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 4;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
}
applyDefaults();

const hair = { color: () => palette().grid, lineWidth: 1, drawTicks: false };
const xAxis = { grid: { display: false }, border: { color: palette().grid }, ticks: { maxRotation: 0, autoSkipPadding: 12 } };

export interface TrendOptions { labels: string[]; values: number[]; name: string; unit: string; kind?: 'line' | 'bar' }

/** 單一數列的趨勢圖（不需要圖例，標題已經說明畫的是什麼）。最後一點加大標示。 */
export function trendChart(canvas: HTMLCanvasElement, o: TrendOptions): Chart {
  const p = palette();
  const last = o.values.length - 1;
  const config: ChartConfiguration = o.kind === 'bar'
    ? {
      type: 'bar',
      data: { labels: o.labels, datasets: [{ label: o.name, data: o.values, backgroundColor: o.values.map((_, i) => (i === last ? p.s1 : p.s1 + 'aa')), borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 22 }] },
      options: {},
    }
    : {
      type: 'line',
      data: { labels: o.labels, datasets: [{ label: o.name, data: o.values, borderColor: p.s1, borderWidth: 2, tension: 0.25, fill: true, backgroundColor: p.s1 + '1a', pointRadius: o.values.map((_, i) => (i === last ? 4.5 : 0)), pointHoverRadius: 5, pointBackgroundColor: p.s1, pointBorderColor: p.panel, pointBorderWidth: 2 }] },
      options: {},
    };
  config.options = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.formattedValue} ${o.unit}` } } },
    scales: { x: xAxis, y: { grid: hair, border: { display: false }, ticks: { maxTicksLimit: 4, padding: 6 }, beginAtZero: o.kind === 'bar' } },
  };
  return new Chart(canvas, config);
}

export interface Series { name: string; data: (number | null)[]; color: 's1' | 's2' | 's3'; dashed?: boolean }

/** 多數列折線圖（例如燃盡圖的理想線與實際線）。 */
export function linesChart(canvas: HTMLCanvasElement, labels: string[], series: Series[], unit: string): Chart {
  const p = palette();
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.name, data: s.data, borderColor: p[s.color], backgroundColor: p[s.color], borderWidth: 2, tension: 0,
        borderDash: s.dashed ? [6, 5] : undefined, pointRadius: s.dashed ? 0 : 3.5, pointBorderColor: p.panel, pointBorderWidth: 2, spanGaps: false,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.formattedValue} ${unit}` } } },
      scales: { x: xAxis, y: { grid: hair, border: { display: false }, beginAtZero: true, ticks: { maxTicksLimit: 5, padding: 6 } } },
    },
  });
}

/** 分組長條圖（例如每位成員的容量與承諾點數）。 */
export function barsChart(canvas: HTMLCanvasElement, labels: string[], series: Series[], unit: string): Chart {
  const p = palette();
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s) => ({ label: s.name, data: s.data, backgroundColor: p[s.color], borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 18, borderColor: p.panel, borderWidth: { left: 1, right: 1 } })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.formattedValue} ${unit}` } } },
      scales: { x: xAxis, y: { grid: hair, border: { display: false }, beginAtZero: true, ticks: { maxTicksLimit: 5, padding: 6 } } },
    },
  });
}

export function radarChart(canvas: HTMLCanvasElement, labels: string[], values: number[], name: string): Chart {
  const p = palette();
  return new Chart(canvas, {
    type: 'radar',
    data: { labels, datasets: [{ label: name, data: values, borderColor: p.s1, borderWidth: 2, backgroundColor: p.s1 + '26', pointRadius: 3.5, pointBackgroundColor: p.s1, pointBorderColor: p.panel, pointBorderWidth: 2 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: { r: { min: 0, max: 5, ticks: { stepSize: 1, display: false }, grid: { color: p.grid }, angleLines: { color: p.grid }, pointLabels: { color: p.ink2, font: { size: 13 } } } },
    },
  });
}

export interface LivePoint { label: string; value: number; anomaly: boolean }
export interface LiveChart { push(point: LivePoint): void; load(points: LivePoint[]): void; destroy(): void }

/** 即時折線圖：每秒推一個點，只保留最近 size 個；異常點用紅色大點標出。 */
export function liveChart(canvas: HTMLCanvasElement, name: string, unit: string, size = 60): LiveChart {
  const p = palette();
  const labels: string[] = [];
  const data: number[] = [];
  const flags: boolean[] = [];
  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ label: name, data, borderColor: p.s1, borderWidth: 2, tension: 0.2, fill: true, backgroundColor: p.s1 + '14',
      pointRadius: (c) => (flags[c.dataIndex] ? 5 : 0), pointBackgroundColor: p.crit, pointBorderColor: p.panel, pointBorderWidth: 2 }] },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.formattedValue} ${unit}${flags[c.dataIndex] ? ' ⚠' : ''}` } } },
      scales: { x: { ...xAxis, ticks: { maxRotation: 0, maxTicksLimit: 6 } }, y: { grid: hair, border: { display: false }, ticks: { maxTicksLimit: 4, padding: 6 } } },
    },
  });
  const add = (p: LivePoint) => {
    labels.push(p.label); data.push(p.value); flags.push(p.anomaly);
    if (labels.length > size) { labels.shift(); data.shift(); flags.shift(); }
  };
  return {
    push(point) { add(point); chart.update('none'); },
    load(points) { points.forEach(add); chart.update('none'); },
    destroy: () => chart.destroy(),
  };
}

export type { Chart };
