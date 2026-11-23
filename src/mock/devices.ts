import type { Device, DeviceId, L10n } from '../core/types';
import type { Rng } from './rng';
import { L, round1 } from './util';

// 3D 工廠裡可以點擊的設備，每一個都對應資料平台的一段。
// 設備標籤（PRS-01…）仿照工廠管線圖的編號習慣，貫穿 3D、事件與任務。

export const SITE = L('晴光能源・一號場站', 'Fairglow Energy, Site One');

export function buildDevices(rng: Rng): Device[] {
  const j = (base: number, pct: number) => round1(base * (1 + rng.float(-pct, pct)));
  const perSec = L('筆／秒', 'pts/s');
  return [
    { id: 'solar', tag: 'SOL-01', name: L('太陽能板陣列', 'Solar array'), role: L('場站裝置與邊緣收集器', 'Site devices and edge collectors'), site: SITE, squad: 'platform',
      baseThroughput: j(3480, 0.02), throughputUnit: perSec, baseLatency: j(180, 0.05), baseError: 0.08, version: 'edge-agent 2.8.1', lastDeploy: '2026-11-12', deployedBy: 'm4' },
    { id: 'truck', tag: 'TRK-01', name: L('裝卸貨車', 'Loading truck'), role: L('資料接入閘道', 'Ingestion gateway'), site: SITE, squad: 'platform',
      baseThroughput: j(3470, 0.02), throughputUnit: perSec, baseLatency: j(45, 0.05), baseError: 0.05, version: 'gateway 3.0.0-rc2', lastDeploy: '2026-11-19', deployedBy: 'm4' },
    { id: 'press', tag: 'PRS-01', name: L('沖壓機', 'Stamping press'), role: L('串流處理與分析管線', 'Stream processing and analytics pipeline'), site: SITE, squad: 'platform',
      baseThroughput: j(3460, 0.02), throughputUnit: perSec, baseLatency: j(850, 0.05), baseError: 0.12, version: 'stream-engine 5.4.0', lastDeploy: '2026-11-20', deployedBy: 'm1' },
    { id: 'tank', tag: 'TNK-01', name: L('原料儲槽', 'Storage tanks'), role: L('時序資料庫', 'Time-series database'), site: SITE, squad: 'platform',
      baseThroughput: j(3455, 0.02), throughputUnit: perSec, baseLatency: j(12, 0.05), baseError: 0.03, version: 'tsdb-operator 1.12.3', lastDeploy: '2026-11-17', deployedBy: 'm5' },
    { id: 'substation', tag: 'SUB-01', name: L('變電箱', 'Transformer box'), role: L('異常偵測與告警', 'Anomaly detection and alerting'), site: SITE, squad: 'analytics',
      baseThroughput: j(3450, 0.02), throughputUnit: perSec, baseLatency: j(1800, 0.05), baseError: 0.2, version: 'detector 2.0.0-beta4', lastDeploy: '2026-11-21', deployedBy: 'm6' },
    { id: 'console', tag: 'CTL-01', name: L('控制台', 'Control console'), role: L('SaaS 報表 API', 'SaaS reporting API'), site: SITE, squad: 'saas',
      baseThroughput: j(126, 0.04), throughputUnit: L('請求／秒', 'req/s'), baseLatency: j(220, 0.05), baseError: 0.15, version: 'report-api 4.7.2', lastDeploy: '2026-11-18', deployedBy: 'm3' },
  ];
}

/** 資料平台架構圖的七個階段，以及各自對應的 3D 設備。 */
export const PIPELINE_STAGES: { key: string; name: L10n; note: L10n; deviceId: DeviceId }[] = [
  { key: 'site', name: L('場站裝置', 'Site devices'), note: L('逆變器、電表、氣象站', 'Inverters, meters, weather stations'), deviceId: 'solar' },
  { key: 'collect', name: L('收集', 'Collect'), note: L('MQTT／Modbus 閘道', 'MQTT / Modbus gateway'), deviceId: 'truck' },
  { key: 'stream', name: L('串流', 'Stream'), note: L('事件時間、水位線', 'Event time, watermarks'), deviceId: 'press' },
  { key: 'tsdb', name: L('時序資料庫', 'Time-series DB'), note: L('熱、溫、冷三層', 'Hot, warm, cold tiers'), deviceId: 'tank' },
  { key: 'analytics', name: L('分析', 'Analytics'), note: L('彙總、降採樣、基準模型', 'Rollups, downsampling, baselines'), deviceId: 'press' },
  { key: 'alert', name: L('告警', 'Alerting'), note: L('z-score 異常偵測', 'z-score anomaly detection'), deviceId: 'substation' },
  { key: 'report', name: L('SaaS 報表', 'SaaS reports'), note: L('多租戶報表 API', 'Multi-tenant reporting API'), deviceId: 'console' },
];
