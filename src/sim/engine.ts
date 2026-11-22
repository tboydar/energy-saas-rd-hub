import { activeIncident } from '../core/selectors';
import { store } from '../core/store';
import type { DeviceId } from '../core/types';
import { createRng } from '../mock/rng';
import { RollingZ } from './zscore';

// 即時模擬引擎：每秒為六個設備各產生一筆假資料（吞吐量、延遲、錯誤率），
// 用 z-score 找異常，並把結果廣播給 Dashboard、3D 場景與「系統與事件」頁。
// 真實情境是單日數億筆；這裡是縮小版，只模擬「每秒的彙總值」。

export type DeviceStatus = 'ok' | 'anomaly' | 'incident';
export interface DeviceSample { throughput: number; latency: number; error: number; z: number; status: DeviceStatus }
export interface Anomaly { id: number; at: number; deviceId: DeviceId; metric: 'latency' | 'throughput'; value: number; z: number }
export interface Tick {
  at: number;
  devices: Record<DeviceId, DeviceSample>;
  /** 平台整體：接入吞吐量、端到端延遲、平均錯誤率。 */
  total: { throughput: number; latency: number; error: number; anomaly: boolean };
  /** 今天累計處理的資料點數。 */
  today: number;
  /** 0–1.5 的流量係數，3D 輸送帶用它決定速度。 */
  flow: number;
  fresh: Anomaly[];
}

const IDS: DeviceId[] = ['solar', 'truck', 'press', 'tank', 'substation', 'console'];
const HISTORY = 120;
const ALARM_HOLD = 6;

type Listener = (tick: Tick) => void;

class Engine {
  private rng = createRng(store.state.seed + 7);
  private listeners = new Set<Listener>();
  private timer = 0;
  private step = 0;
  private zLatency = new Map<DeviceId, RollingZ>();
  private zThroughput = new Map<DeviceId, RollingZ>();
  private spikes = new Map<DeviceId, number>();
  private alarmUntil = new Map<DeviceId, number>();
  private nextSpikeAt = 75;
  private anomalySeq = 0;
  private today = 0;
  history: Tick[] = [];
  anomalies: Anomaly[] = [];

  constructor() {
    const now = new Date();
    const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    this.today = seconds * 3470;
    for (const id of IDS) {
      this.zLatency.set(id, new RollingZ());
      this.zThroughput.set(id, new RollingZ());
    }
    // 先暖機 30 步：z-score 一開始就有基準，圖表也不會從空白開始。
    for (let i = 30; i > 0; i--) this.advance(Date.now() - i * 1000, false);
  }

  start(): void {
    if (this.timer) return;
    this.timer = window.setInterval(() => {
      if (document.hidden) return; // 分頁不在前景時暫停，省電也省 CPU
      this.advance(Date.now(), true);
    }, 1000);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get latest(): Tick {
    return this.history[this.history.length - 1];
  }

  /** 手動對某個設備注入 4 秒的尖峰，用來示範異常偵測。 */
  inject(deviceId: DeviceId): void {
    this.spikes.set(deviceId, 4);
  }

  private advance(at: number, notify: boolean): void {
    this.step++;
    const { rng } = this;
    const incident = activeIncident(store.state);

    // 偶發的自然尖峰（只在沒有事件時發生），讓異常偵測有東西可以抓。
    if (!incident && this.step >= this.nextSpikeAt) {
      this.spikes.set(rng.pick(IDS), rng.int(2, 3));
      this.nextSpikeAt = this.step + rng.int(45, 80);
    }

    const wave = Math.sin(this.step / 37) * 0.04;
    const devices = {} as Record<DeviceId, DeviceSample>;
    const fresh: Anomaly[] = [];
    let upstream = 1;

    for (const id of IDS) {
      const base = store.state.devices.find((d) => d.id === id)!;
      let tp = 1 + wave + rng.gauss() * 0.025;
      let lat = 1 + wave * 0.6 + rng.gauss() * 0.045;
      let err = Math.max(0, 1 + rng.gauss() * 0.22);

      const spike = this.spikes.get(id) ?? 0;
      if (spike > 0) {
        tp *= 0.62;
        lat *= 2.6 + rng.float(0, 0.8);
        err *= 4;
        this.spikes.set(id, spike - 1);
      }
      const hit = incident?.deviceId === id;
      if (hit) {
        const easing = incident!.stage === 'mitigating' ? 0.55 : 1;
        tp *= 1 - 0.45 * easing;
        lat *= 1 + 3.2 * easing;
        err = err * (1 + 5 * easing) + 2.4 * easing;
      }
      // 異常偵測只看設備「自身」的訊號。上游變慢造成的流量下降只反映在顯示數值上，
      // 不重複告警——否則一個上游尖峰就會讓下游全部亮紅燈（告警風暴）。
      const own = base.baseThroughput * tp;
      if (id !== 'console') {
        tp *= upstream;
        if (id === 'solar' || id === 'truck' || id === 'press') upstream = Math.min(upstream, hit ? 0.6 : spike > 0 ? 0.8 : 1);
      }

      const throughput = base.baseThroughput * tp;
      const latency = base.baseLatency * lat;
      const error = base.baseError * err;
      const zl = this.zLatency.get(id)!.push(latency);
      const zt = this.zThroughput.get(id)!.push(own);

      if (zl.anomaly || zt.anomaly) {
        const useLatency = Math.abs(zl.z) >= Math.abs(zt.z);
        // 只在「剛變成異常」的那一刻記一筆；持續異常期間不重複洗版。
        const isNew = (this.alarmUntil.get(id) ?? 0) < this.step;
        this.alarmUntil.set(id, this.step + ALARM_HOLD);
        if (notify && isNew) fresh.push({ id: ++this.anomalySeq, at, deviceId: id, metric: useLatency ? 'latency' : 'throughput', value: useLatency ? latency : throughput, z: useLatency ? zl.z : zt.z });
      }
      const alarmed = (this.alarmUntil.get(id) ?? 0) >= this.step;
      devices[id] = { throughput, latency, error, z: Math.abs(zl.z) >= Math.abs(zt.z) ? zl.z : zt.z, status: hit ? 'incident' : alarmed ? 'anomaly' : 'ok' };
    }

    const latency = devices.solar.latency + devices.truck.latency + devices.press.latency + devices.tank.latency;
    const error = (devices.solar.error + devices.truck.error + devices.press.error + devices.tank.error) / 4;
    const throughput = devices.truck.throughput;
    this.today += throughput;
    const flow = Math.max(0.15, Math.min(1.5, devices.press.throughput / 3460));
    const tick: Tick = {
      at, devices, today: this.today, flow, fresh,
      total: { throughput, latency, error, anomaly: IDS.some((id) => devices[id].status !== 'ok') },
    };
    this.history.push(tick);
    if (this.history.length > HISTORY) this.history.shift();
    if (fresh.length) this.anomalies = [...fresh, ...this.anomalies].slice(0, 30);
    if (notify) this.listeners.forEach((fn) => fn(tick));
  }
}

let engine: Engine | null = null;

/** 全站共用一個引擎，第一次取用時才建立並開始跳動。 */
export function sim(): Engine {
  if (!engine) {
    engine = new Engine();
    engine.start();
  }
  return engine;
}
