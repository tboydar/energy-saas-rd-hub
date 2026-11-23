import type { DeviceId, Incident, L10n } from '../core/types';
import { L } from './util';

// 過去的事件紀錄（已結案），以及「模擬線上事件」可以抽到的劇本。

export interface Scenario {
  deviceId: DeviceId;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
  title: L10n;
  impact: L10n;
  rootCause: L10n;
  mitigation: L10n;
}

export const SCENARIOS: Scenario[] = [
  { deviceId: 'press', severity: 'SEV2',
    title: L('串流處理積壓，端到端延遲超過 SLO', 'Stream processing backlog pushes end-to-end latency past the SLO'),
    impact: L('即時儀表板資料延遲超過 2 分鐘，影響 4 家客戶的告警時效。', 'Live dashboards lag by over 2 minutes, delaying alerts for 4 customers.'),
    rootCause: L('新版水位線設定讓單一分區的狀態暴增，觸發反覆的記憶體回收。', 'A new watermark setting ballooned state on one partition and triggered repeated garbage collection.'),
    mitigation: L('回滾水位線設定並重新平衡分區。', 'Roll back the watermark setting and rebalance partitions.') },
  { deviceId: 'tank', severity: 'SEV1',
    title: L('時序資料庫寫入錯誤率上升', 'Write error rate climbing on the time-series database'),
    impact: L('約 3% 的資料點寫入失敗並進入重試佇列，報表可能出現缺口。', 'About 3% of points fail to write and queue for retry, so reports may show gaps.'),
    rootCause: L('一個儲存節點磁碟寫滿，冷資料分層作業未如期執行。', 'A storage node filled its disk because the cold-tiering job did not run on schedule.'),
    mitigation: L('擴充磁碟、手動觸發分層作業，並從重試佇列補寫。', 'Expand the disk, trigger tiering manually, and replay the retry queue.') },
  { deviceId: 'truck', severity: 'SEV2',
    title: L('接入閘道連線數暴增，部分場站資料遺漏', 'Connection surge on the ingestion gateway drops data from some sites'),
    impact: L('北風電廠等 6 個場站間歇斷線，資料在邊緣端緩衝。', 'Six sites, including Northgale Power Plant, disconnect intermittently and buffer data at the edge.'),
    rootCause: L('場站韌體更新後同時重連，連線池沒有退避機制。', 'Sites reconnected all at once after a firmware update and the connection pool has no backoff.'),
    mitigation: L('啟用連線速率限制並分批重連。', 'Enable connection rate limiting and reconnect in batches.') },
];

export function buildIncidents(): Incident[] {
  return [
    {
      id: 'INC-2041', title: L('時序資料庫寫入延遲飆高', 'Write latency spike on the time-series database'), severity: 'SEV2', deviceId: 'tank', stage: 'closed', commander: 'm5',
      impact: L('寫入延遲升到 900 ms，持續 42 分鐘，無資料遺失。', 'Write latency reached 900 ms for 42 minutes with no data loss.'),
      rootCause: L('壓縮作業與尖峰寫入撞期。', 'Compaction overlapped with peak writes.'),
      mitigation: L('暫停壓縮作業並改到離峰。', 'Pause compaction and move it off-peak.'),
      startedAt: '2026-11-05T06:10:00.000Z', recoveredAt: '2026-11-05T06:52:00.000Z',
      timeline: [
        { stage: 'triggered', at: '2026-11-05T06:10:00.000Z', by: 'system' },
        { stage: 'assigned', at: '2026-11-05T06:13:00.000Z', by: 'm5' },
        { stage: 'mitigating', at: '2026-11-05T06:21:00.000Z', by: 'm5' },
        { stage: 'recovered', at: '2026-11-05T06:52:00.000Z', by: 'm5' },
        { stage: 'postmortem', at: '2026-11-06T02:00:00.000Z', by: 'm1' },
        { stage: 'closed', at: '2026-11-07T03:00:00.000Z', by: 'manager' },
      ],
      postmortem: '',
    },
    {
      id: 'INC-2038', title: L('接入閘道憑證過期，兩個場站斷線', 'Expired gateway certificate disconnects two sites'), severity: 'SEV3', deviceId: 'truck', stage: 'closed', commander: 'm4',
      impact: L('兩個場站斷線 68 分鐘，資料事後由邊緣補傳。', 'Two sites were offline for 68 minutes; data was backfilled from the edge afterwards.'),
      rootCause: L('憑證靠人工更新，到期提醒寄到已停用的信箱。', 'Certificates were renewed by hand and the expiry reminder went to a retired mailbox.'),
      mitigation: L('手動換發憑證。', 'Reissue the certificate manually.'),
      startedAt: '2026-10-21T01:30:00.000Z', recoveredAt: '2026-10-21T02:38:00.000Z',
      timeline: [
        { stage: 'triggered', at: '2026-10-21T01:30:00.000Z', by: 'system' },
        { stage: 'assigned', at: '2026-10-21T01:41:00.000Z', by: 'm4' },
        { stage: 'mitigating', at: '2026-10-21T01:55:00.000Z', by: 'm4' },
        { stage: 'recovered', at: '2026-10-21T02:38:00.000Z', by: 'm4' },
        { stage: 'postmortem', at: '2026-10-22T02:00:00.000Z', by: 'm4' },
        { stage: 'closed', at: '2026-10-23T02:00:00.000Z', by: 'manager' },
      ],
      postmortem: '',
    },
  ];
}
