import type { L10n, Member, RoleId, SquadId } from '../core/types';
import { L } from './util';

// 8 位虛構成員。姓名、職涯目標與 1:1 內容全部為杜撰，不對應任何真實人物。

export const SQUADS: Record<SquadId, L10n> = {
  platform: L('資料平台組', 'Data Platform'),
  analytics: L('分析與 AI 組', 'Analytics & AI'),
  saas: L('SaaS 應用組', 'SaaS Apps'),
};

export const SKILL_LABELS = {
  backend: L('後端', 'Backend'),
  data: L('資料工程', 'Data eng'),
  frontend: L('前端', 'Frontend'),
  cloud: L('雲端與 K8s', 'Cloud & K8s'),
  ml: L('資料科學', 'Data science'),
  collab: L('溝通協作', 'Collaboration'),
} as const;

/** 模擬登入時，每個角色對應的虛構人物。 */
export const PERSONAS: Record<RoleId, { name: L10n; title: L10n; memberId?: string; squad?: SquadId }> = {
  manager: { name: L('黎若衡', 'Jo-Heng Li'), title: L('研發主管', 'Engineering Manager') },
  techlead: { name: L('沈予安', 'Yu-An Shen'), title: L('Tech Lead／資料平台組', 'Tech Lead, Data Platform'), memberId: 'm1', squad: 'platform' },
  engineer: { name: L('藍書緯', 'Shu-Wei Lan'), title: L('工程師／資料平台組', 'Engineer, Data Platform'), memberId: 'm4', squad: 'platform' },
  pmcs: { name: L('溫芷寧', 'Chih-Ning Wen'), title: L('產品經理（PM／CS）', 'Product Manager (PM/CS)') },
  admin: { name: L('系統管理員', 'System Admin'), title: L('管理員', 'Administrator') },
};

type Seed = [
  id: string, zh: string, en: string, levelZh: string, levelEn: string, squad: SquadId, role: RoleId,
  capacity: number, skills: [number, number, number, number, number, number], okr: number, goalZh: string, goalEn: string,
];

const SEEDS: Seed[] = [
  ['m1', '沈予安', 'Yu-An Shen', 'Staff Engineer／Tech Lead', 'Staff Engineer / Tech Lead', 'platform', 'techlead', 12, [5, 5, 2, 4, 2, 4], 68,
    '成為能跨組推動架構演進的 Principal Engineer', 'Grow into a Principal Engineer who drives architecture across teams'],
  ['m2', '柯景澄', 'Ching-Cheng Ko', 'Senior Engineer／Tech Lead', 'Senior Engineer / Tech Lead', 'analytics', 'techlead', 10, [3, 4, 2, 3, 5, 4], 52,
    '從技術帶領者走向工程經理', 'Move from tech lead toward engineering management'],
  ['m3', '駱以晴', 'Yi-Ching Luo', 'Senior Engineer／Tech Lead', 'Senior Engineer / Tech Lead', 'saas', 'techlead', 13, [4, 3, 4, 3, 1, 5], 44,
    '成為產品導向的全端技術負責人', 'Become a product-minded full-stack technical owner'],
  ['m4', '藍書緯', 'Shu-Wei Lan', 'Engineer II', 'Engineer II', 'platform', 'engineer', 13, [4, 3, 2, 3, 1, 3], 61,
    '一年內升任 Senior，能獨立負責一條資料管線', 'Reach Senior within a year and own a data pipeline end to end'],
  ['m5', '紀語彤', 'Yu-Tung Chi', 'Senior SRE', 'Senior SRE', 'platform', 'engineer', 13, [3, 3, 1, 5, 1, 4], 72,
    '建立平台的 SLO 與成本治理文化', 'Build an SLO and cost-governance culture for the platform'],
  ['m6', '游承翰', 'Cheng-Han You', 'ML Engineer', 'ML Engineer', 'analytics', 'engineer', 13, [3, 4, 1, 3, 4, 3], 48,
    '深耕時序異常偵測，完成一次對外技術分享', 'Go deep on time-series anomaly detection and give one external talk'],
  ['m7', '阮心妍', 'Hsin-Yen Juan', 'Junior Engineer', 'Junior Engineer', 'analytics', 'engineer', 10, [2, 3, 2, 1, 3, 3], 57,
    '半年內能獨立完成中型功能並加入 on-call 輪值', 'Deliver mid-sized features independently and join on-call within six months'],
  ['m8', '石柏宇', 'Po-Yu Shih', 'Frontend Engineer II', 'Frontend Engineer II', 'saas', 'engineer', 13, [2, 2, 5, 2, 1, 4], 63,
    '主導報表前端架構，培養資料視覺化專長', 'Lead the reporting front-end architecture and build data-viz expertise'],
];

const GROWTH: Record<string, [string, string, boolean][]> = {
  m1: [['主持季度架構審查會議', 'Chair the quarterly architecture review', true], ['把管線重構經驗整理成內部分享', 'Turn the pipeline refactor into an internal talk', false], ['培養一位副手分擔 Code Review', 'Coach a deputy to share code review load', false]],
  m2: [['完成「回饋與困難對話」工作坊', 'Finish the feedback and hard-conversations workshop', true], ['每月輪值主持一次小組 1:1', 'Run squad 1:1s once a month', false], ['獨立負責異常偵測 v2 的對外溝通', 'Own external communication for Anomaly Detection v2', false]],
  m3: [['每季跟一次客戶訪談', 'Join one customer interview per quarter', true], ['為報表產品寫一份技術願景文件', 'Write a technical vision doc for reporting', false]],
  m4: [['獨立設計並上線降採樣規則引擎', 'Design and ship the downsampling rule engine', true], ['主講一次事後檢討會議', 'Lead one postmortem review', false], ['補強雲端成本與容量規劃知識', 'Strengthen cloud cost and capacity planning skills', false]],
  m5: [['為三條核心管線定義 SLO', 'Define SLOs for three core pipelines', true], ['建立每月成本回顧例會', 'Start a monthly cost review', true], ['帶一位工程師加入 on-call', 'Onboard one engineer to on-call', false]],
  m6: [['完成季節性分解基準模型', 'Ship the seasonal-decomposition baseline', false], ['投稿一場社群技術分享', 'Submit one community tech talk', false], ['學會把模型包成線上服務', 'Learn to serve models online', true]],
  m7: [['通過 on-call 見習', 'Pass on-call shadowing', false], ['獨立完成誤報率回測報表', 'Deliver the false-positive backtest report solo', true], ['每週一次與導師結對程式設計', 'Pair with a mentor once a week', true]],
  m8: [['建立報表圖表元件規範', 'Define chart component guidelines for reports', true], ['主導對帳頁的效能調校', 'Lead performance tuning of the reconciliation page', false]],
};

const ONE_ON_ONES: Record<string, [string, number, string, string, string, string][]> = {
  m6: [
    ['2026-11-18', 2, '同時扛推論服務化、特徵庫與告警去重三件事，上週又排到 on-call，覺得每件都做不深。', 'Carrying inference serving, the feature store and alert dedup at once, plus on-call last week. Feels spread too thin to go deep on anything.',
      '把告警去重移交給心妍並安排結對；下個 Sprint 承諾點數降到 10 點以內。', 'Hand alert dedup to Hsin-Yen with pairing sessions; cap next sprint at 10 points.'],
    ['2026-11-04', 3, '對季節性分解的方向有信心，但缺少標註資料來驗證。', 'Confident in the seasonal-decomposition direction but lacks labeled data to validate it.',
      '請 PM 協調兩家試點客戶提供異常事件回饋。', 'Ask PM to line up two pilot customers for anomaly feedback.'],
  ],
  m7: [
    ['2026-11-17', 4, '回測報表第一次獨立做完，想嘗試更有挑戰的任務，也想開始見習 on-call。', 'Finished the backtest report independently for the first time. Wants a bigger challenge and to start shadowing on-call.',
      '接手告警去重（與承翰結對）；十二月開始 on-call 見習。', 'Take over alert dedup, pairing with Cheng-Han; start on-call shadowing in December.'],
  ],
  m1: [
    ['2026-11-16', 3, 'Review 佇列集中在自己身上，變成團隊瓶頸；希望有人分擔。', 'The review queue piles up on them and has become a team bottleneck. Wants someone to share it.',
      '指定書緯為平台組第二位 reviewer；PR 超過 400 行先拆分。', 'Make Shu-Wei the second reviewer for the platform squad; split PRs over 400 lines.'],
  ],
  m4: [
    ['2026-11-12', 4, '降採樣規則引擎順利上線，想了解升 Senior 還差什麼。', 'The downsampling rule engine shipped smoothly. Wants to know the gap to Senior.',
      '一起對照職級表，下季安排主導一個跨組專案。', 'Walk through the career ladder together and plan to lead a cross-squad project next quarter.'],
  ],
};

export function buildMembers(): Member[] {
  return SEEDS.map(([id, zh, en, levelZh, levelEn, squad, role, capacity, sk, okr, goalZh, goalEn]) => ({
    id,
    name: L(zh, en),
    level: L(levelZh, levelEn),
    squad,
    systemRole: role,
    active: true,
    capacity,
    skills: { backend: sk[0], data: sk[1], frontend: sk[2], cloud: sk[3], ml: sk[4], collab: sk[5] },
    okrProgress: okr,
    careerGoal: L(goalZh, goalEn),
    growthPlan: (GROWTH[id] ?? []).map(([a, b, done], n) => ({ id: `${id}-g${n + 1}`, text: L(a, b), done })),
    oneOnOnes: (ONE_ON_ONES[id] ?? []).map(([date, mood, s1, s2, a1, a2], n) => ({
      id: `${id}-o${n + 1}`, date, mood, summary: L(s1, s2), actions: L(a1, a2),
    })),
    feedbackDraft: '',
  }));
}
