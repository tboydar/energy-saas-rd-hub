import type { RoleId } from './types';

// RBAC 的定義：有哪些角色、哪些權限、預設矩陣。
// 這個檔案只放「資料」，判斷邏輯在 auth.ts，矩陣本身存在 store 裡（管理員可以改）。

export const ROLES: RoleId[] = ['manager', 'techlead', 'engineer', 'pmcs', 'admin'];

export const PERMS = [
  'page.dashboard', 'page.team', 'page.projects', 'page.governance', 'page.systems', 'page.collab', 'page.rbac', 'page.about',
  'team.private', 'oneonone.write', 'hiring.manage', 'member.manage',
  'task.assign', 'task.manageSquad', 'task.updateOwn', 'standup.write', 'sprint.plan', 'okr.edit',
  'adr.write', 'review.decide', 'pipeline.run', 'release.approve',
  'incident.manage',
  'request.create', 'request.triage', 'report.generate',
  'rbac.edit',
] as const;
export type Perm = (typeof PERMS)[number];

export const PERM_GROUPS: { key: 'pages' | 'team' | 'delivery' | 'governance' | 'ops' | 'collab' | 'admin'; perms: Perm[] }[] = [
  { key: 'pages', perms: ['page.dashboard', 'page.team', 'page.projects', 'page.governance', 'page.systems', 'page.collab', 'page.rbac', 'page.about'] },
  { key: 'team', perms: ['team.private', 'oneonone.write', 'hiring.manage', 'member.manage'] },
  { key: 'delivery', perms: ['task.assign', 'task.manageSquad', 'task.updateOwn', 'standup.write', 'sprint.plan', 'okr.edit'] },
  { key: 'governance', perms: ['adr.write', 'review.decide', 'pipeline.run', 'release.approve'] },
  { key: 'ops', perms: ['incident.manage'] },
  { key: 'collab', perms: ['request.create', 'request.triage', 'report.generate'] },
  { key: 'admin', perms: ['rbac.edit'] },
];

export const DEFAULT_MATRIX: Record<RoleId, Perm[]> = {
  // 研發主管：看全部；指派任務、調整 OKR、核准發版、寫 1:1。
  manager: [
    'page.dashboard', 'page.team', 'page.projects', 'page.governance', 'page.systems', 'page.collab', 'page.rbac', 'page.about',
    'team.private', 'oneonone.write', 'hiring.manage',
    'task.assign', 'sprint.plan', 'okr.edit',
    'adr.write', 'review.decide', 'pipeline.run', 'release.approve',
    'incident.manage', 'request.create', 'request.triage', 'report.generate',
  ],
  // Tech Lead：管理所屬小組任務、Code Review 決策、記錄 ADR。
  techlead: [
    'page.dashboard', 'page.team', 'page.projects', 'page.governance', 'page.systems', 'page.collab', 'page.about',
    'task.manageSquad', 'task.updateOwn', 'standup.write', 'sprint.plan',
    'adr.write', 'review.decide', 'pipeline.run',
    'incident.manage', 'request.triage', 'report.generate',
  ],
  // 工程師：看自己的任務、更新狀態、填每日站會。
  engineer: [
    'page.dashboard', 'page.projects', 'page.governance', 'page.systems', 'page.about',
    'task.updateOwn', 'standup.write', 'pipeline.run',
  ],
  // PM／CS：看路線圖、提需求、看事件狀態；不能改工程指派。
  pmcs: [
    'page.dashboard', 'page.projects', 'page.systems', 'page.collab', 'page.about',
    'request.create', 'report.generate',
  ],
  // 管理員：管理成員、角色、權限矩陣。
  admin: [
    'page.dashboard', 'page.team', 'page.rbac', 'page.about',
    'member.manage', 'rbac.edit',
  ],
};

/** 不能被取消的格子：避免把自己鎖在門外，或讓任何角色連「總覽／關於」都看不到。 */
export function isLocked(role: RoleId, perm: Perm): boolean {
  if (perm === 'page.dashboard' || perm === 'page.about') return true;
  return role === 'admin' && (perm === 'page.rbac' || perm === 'rbac.edit');
}
