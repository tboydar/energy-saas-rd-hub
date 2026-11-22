import { clock } from '../core/date';
import type { AppState, Incident, Lang } from '../core/types';

// 事後檢討（Postmortem）範本：從事件欄位與時間軸自動帶入，剩下的留給人填。

const STAGE: Record<string, { zh: string; en: string }> = {
  triggered: { zh: '告警觸發', en: 'Alert triggered' },
  assigned: { zh: '指派事件指揮官', en: 'Incident commander assigned' },
  mitigating: { zh: '開始緩解', en: 'Mitigation started' },
  recovered: { zh: '服務恢復', en: 'Service restored' },
  postmortem: { zh: '事後檢討', en: 'Postmortem' },
  closed: { zh: '結案', en: 'Closed' },
};

export function minutesToRecover(incident: Incident): number | null {
  if (!incident.recoveredAt) return null;
  const ms = Date.parse(incident.recoveredAt) - Date.parse(incident.startedAt);
  return Math.max(1, Math.round(ms / (incident.compressed ? 1000 : 60000)));
}

export function postmortemTemplate(state: AppState, incident: Incident, lang: Lang): string {
  const zh = lang === 'zh';
  const who = (id: string) => {
    const m = state.members.find((x) => x.id === id);
    if (m) return m.name[lang];
    return id === 'system' ? (zh ? '監控系統' : 'Monitoring') : zh ? '研發主管' : 'Engineering manager';
  };
  const device = state.devices.find((d) => d.id === incident.deviceId);
  const mttr = minutesToRecover(incident);
  const lines = incident.timeline.map((e) => `| ${clock(e.at)} | ${STAGE[e.stage][lang]} | ${who(e.by)} |`).join('\n');
  if (zh) {
    return [
      `# 事後檢討：${incident.id} ${incident.title.zh}`, '',
      `- 嚴重度：${incident.severity}`, `- 受影響設備：${device?.tag ?? ''} ${device?.role.zh ?? ''}`,
      `- 事件指揮官：${incident.commander ? who(incident.commander) : '未指派'}`, `- 復原時間：${mttr ?? '—'} 分鐘`, '',
      '## 影響', incident.impact.zh, '',
      '## 時間軸', ...(incident.compressed ? ['（Demo 時間壓縮：1 秒 = 1 分鐘）'] : []), '| 時間 | 事件 | 處理人 |', '| --- | --- | --- |', lines, '',
      '## 根本原因', incident.rootCause.zh, '',
      '## 處置方式', incident.mitigation.zh, '',
      '## 做得好的地方', '- 告警在第一時間觸發並指派到人', '- （待補）', '',
      '## 可以更好的地方', '- （待補：偵測、溝通、工具哪裡卡住）', '',
      '## 改善項目', '- [ ] 把這次的失效模式加入發版後自動回滾條件（負責人／期限）', '- [ ] 補上對應的監控與告警（負責人／期限）', '- [ ] 更新值班手冊（負責人／期限）', '',
      '> 無究責原則：檢討的是系統與流程，不是個人。',
    ].join('\n');
  }
  return [
    `# Postmortem: ${incident.id} ${incident.title.en}`, '',
    `- Severity: ${incident.severity}`, `- Affected component: ${device?.tag ?? ''} ${device?.role.en ?? ''}`,
    `- Incident commander: ${incident.commander ? who(incident.commander) : 'Unassigned'}`, `- Time to restore: ${mttr ?? '—'} min`, '',
    '## Impact', incident.impact.en, '',
    '## Timeline', ...(incident.compressed ? ['(Demo time compression: 1 second = 1 minute)'] : []), '| Time | Event | Owner |', '| --- | --- | --- |', lines, '',
    '## Root cause', incident.rootCause.en, '',
    '## Resolution', incident.mitigation.en, '',
    '## What went well', '- The alert fired promptly and reached an owner', '- (to be added)', '',
    '## What could be better', '- (to be added: where detection, communication or tooling slowed us down)', '',
    '## Action items', '- [ ] Add this failure mode to the post-release auto-rollback conditions (owner / due date)', '- [ ] Add the missing monitoring and alerts (owner / due date)', '- [ ] Update the on-call runbook (owner / due date)', '',
    '> Blameless: we examine systems and process, not people.',
  ].join('\n');
}
