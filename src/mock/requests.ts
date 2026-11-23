import type { DemandRequest } from '../core/types';
import { L } from './util';

// PM／CS 提進來的需求。客戶名稱全部虛構。
// 中文名稱查過經濟部商工登記資料（核准設立的公司），英文名稱查過 GLEIF，都沒有任何公司名稱包含這些字。
export const CUSTOMERS = [
  L('晴樾能源', 'Fairglow Energy'),
  L('北風電廠', 'Northgale Power Plant'),
  L('霧島儲能', 'Mist Isle Storage'),
  L('星嶼微電網', 'Starreef Microgrid'),
  L('鯨落風場', 'Whalefall Wind Farm'),
];

export function buildRequests(): DemandRequest[] {
  return [
    { id: 'REQ-031', title: L('逆變器層級的每日發電報表', 'Daily generation report per inverter'), desc: L('維運人員想直接看到哪一台逆變器發電偏低，不用自己匯出比對。', 'Operators want to see which inverter underperforms without exporting and comparing by hand.'),
      customer: CUSTOMERS[1], requester: L('溫芷寧（PM）', 'Chih-Ning Wen (PM)'), kind: 'report', value: 4, effort: 3, risk: 2, status: 'evaluated', createdAt: '2026-11-17' },
    { id: 'REQ-032', title: L('告警靜音時段可依場站設定', 'Per-site quiet hours for alerts'), desc: L('夜間巡檢時不想被低優先告警打擾。', 'They do not want low-priority alerts during night inspections.'),
      customer: CUSTOMERS[0], requester: L('客服團隊', 'Customer Success'), kind: 'feature', value: 3, effort: 2, risk: 1, status: 'new', createdAt: '2026-11-19' },
    { id: 'REQ-033', title: L('每 5 分鐘資料的 API 匯出', 'API export of 5-minute data'), desc: L('客戶的能源管理系統要定時拉取儲能充放電資料。', "The customer's energy management system needs to pull charge and discharge data on a schedule."),
      customer: CUSTOMERS[2], requester: L('溫芷寧（PM）', 'Chih-Ning Wen (PM)'), kind: 'integration', value: 5, effort: 4, risk: 3, status: 'new', createdAt: '2026-11-20' },
    { id: 'REQ-029', title: L('報表加上碳排減量估算', 'Add carbon reduction estimates to reports'), desc: L('永續報告需要每月減碳量。', 'Sustainability reporting needs monthly carbon savings.'),
      customer: CUSTOMERS[3], requester: L('客服團隊', 'Customer Success'), kind: 'report', value: 3, effort: 2, risk: 1, status: 'declined', createdAt: '2026-11-10' },
  ];
}
