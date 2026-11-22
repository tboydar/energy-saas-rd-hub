// 全站共用的資料型別。所有內容皆為虛構（mock data）。

export type Lang = 'zh' | 'en';
/** 雙語文字：mock data 與使用者輸入都用同一種形狀，畫面依目前語言取值。 */
export interface L10n { zh: string; en: string }

export type RoleId = 'manager' | 'techlead' | 'engineer' | 'pmcs' | 'admin';
export type SquadId = 'platform' | 'analytics' | 'saas';
export type SkillKey = 'backend' | 'data' | 'frontend' | 'cloud' | 'ml' | 'collab';
export type DeviceId = 'solar' | 'truck' | 'tank' | 'press' | 'substation' | 'console';

export interface OneOnOne { id: string; date: string; mood: number; summary: L10n; actions: L10n }
export interface GrowthItem { id: string; text: L10n; done: boolean }

export interface Member {
  id: string;
  name: L10n;
  level: L10n;
  squad: SquadId;
  systemRole: RoleId;
  active: boolean;
  hue: number;
  capacity: number;
  skills: Record<SkillKey, number>;
  okrProgress: number;
  careerGoal: L10n;
  growthPlan: GrowthItem[];
  oneOnOnes: OneOnOne[];
  feedbackDraft: string;
}

export type ProjectStatus = 'onTrack' | 'atRisk' | 'offTrack';
export interface Project {
  id: string;
  name: L10n;
  description: L10n;
  squad: SquadId;
  owner: string;
  start: string;
  end: string;
  progress: number;
  status: ProjectStatus;
  objectiveId: string;
  deviceId: DeviceId;
  milestones: { date: string; name: L10n }[];
}

export type TaskStatus = 'backlog' | 'progress' | 'review' | 'done';
export type TaskType = 'feature' | 'bug' | 'debt' | 'ops';
export interface Task {
  id: string;
  title: L10n;
  projectId: string;
  assignee: string | null;
  status: TaskStatus;
  points: number;
  sprintId: string | null;
  type: TaskType;
  priority: 'P0' | 'P1' | 'P2';
  deviceId?: DeviceId;
  requestId?: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal: L10n;
  start: string;
  end: string;
  status: 'done' | 'active' | 'planned';
  committed: number;
  completed: number;
  /** 每個工作日結束時的剩餘點數；進行中的 Sprint 只記到昨天，今天由任務即時計算。 */
  burndown: number[];
}

export interface KeyResult { id: string; title: L10n; progress: number }
export interface Objective { id: string; title: L10n; owner: string; krs: KeyResult[] }
export interface RoadmapItem {
  id: string;
  title: L10n;
  month: string;
  objectiveId: string;
  projectId?: string;
  status: 'done' | 'inProgress' | 'planned';
}

export type AdrStatus = 'proposed' | 'accepted' | 'superseded' | 'rejected';
export interface Adr {
  id: string;
  title: L10n;
  status: AdrStatus;
  date: string;
  author: string;
  context: L10n;
  decision: L10n;
  consequences: L10n;
  alternatives: L10n;
}

export type IncidentStage = 'triggered' | 'assigned' | 'mitigating' | 'recovered' | 'postmortem' | 'closed';
export interface Incident {
  id: string;
  title: L10n;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
  deviceId: DeviceId;
  stage: IncidentStage;
  commander: string | null;
  impact: L10n;
  rootCause: L10n;
  mitigation: L10n;
  startedAt: string;
  recoveredAt?: string;
  timeline: { stage: IncidentStage; at: string; by: string }[];
  postmortem: string;
}

export interface WeekMetric {
  week: string;
  weekStart: string;
  deployFreq: number;
  leadTime: number;
  cfr: number;
  mttr: number;
  velocity: number;
  defects: number;
  debtRatio: number;
}
export type MetricKey = Exclude<keyof WeekMetric, 'week' | 'weekStart'>;

export interface Device {
  id: DeviceId;
  tag: string;
  name: L10n;
  role: L10n;
  site: L10n;
  squad: SquadId;
  baseThroughput: number;
  throughputUnit: L10n;
  baseLatency: number;
  baseError: number;
  version: string;
  lastDeploy: string;
  deployedBy: string;
}

export interface Review {
  id: string;
  title: L10n;
  taskId?: string;
  author: string;
  reviewer: string;
  additions: number;
  deletions: number;
  ageHours: number;
  ci: 'pass' | 'fail' | 'running';
  risk: 'low' | 'med' | 'high';
  status: 'open' | 'approved' | 'changes';
}

export interface Debt {
  id: string;
  title: L10n;
  note: L10n;
  impact: number;
  cost: number;
  squad: SquadId;
  status: 'open' | 'planned' | 'paid';
}

export interface QualityMetric {
  key: string;
  label: L10n;
  value: number;
  target: number;
  unit: string;
  better: 'higher' | 'lower';
}

export type StageName = 'build' | 'test' | 'staging' | 'prod';
export type StageStatus = 'pending' | 'running' | 'pass' | 'fail' | 'waiting';
export interface PipelineRun {
  id: string;
  title: L10n;
  commit: string;
  author: string;
  startedAt: string;
  attempts: number;
  approvedBy?: string;
  stages: { name: StageName; status: StageStatus; seconds: number }[];
}

export interface DemandRequest {
  id: string;
  title: L10n;
  desc: L10n;
  customer: L10n;
  requester: L10n;
  kind: 'feature' | 'report' | 'integration' | 'support';
  value: number;
  effort: number;
  risk: number;
  status: 'new' | 'evaluated' | 'converted' | 'declined';
  taskId?: string;
  createdAt: string;
}

export type HiringStage = 'applied' | 'screen' | 'tech' | 'final' | 'offer';
export interface Position { id: string; title: L10n; squad: SquadId; openDays: number; funnel: Record<HiringStage, number> }
export interface Candidate { id: string; alias: L10n; positionId: string; stage: HiringStage; note: L10n }

export interface Standup { id: string; memberId: string; date: string; yesterday: L10n; today: L10n; blockers: L10n }

export interface AppState {
  version: number;
  seed: number;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  sprints: Sprint[];
  objectives: Objective[];
  roadmap: RoadmapItem[];
  adrs: Adr[];
  incidents: Incident[];
  metrics: WeekMetric[];
  devices: Device[];
  reviews: Review[];
  debts: Debt[];
  quality: QualityMetric[];
  pipelineRuns: PipelineRun[];
  requests: DemandRequest[];
  positions: Position[];
  candidates: Candidate[];
  standups: Standup[];
  rbac: Record<RoleId, string[]>;
  weeklyReport: string;
  counters: Record<string, number>;
}

export interface Prefs { role: RoleId; lang: Lang; lowFx: boolean }
