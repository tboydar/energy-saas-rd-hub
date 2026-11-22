import { PERSONAS } from '../mock/members';
import { tx } from './i18n';
import type { Perm } from './rbac';
import { store } from './store';
import type { Task } from './types';

// 權限判斷。畫面上所有「能不能看、能不能按」都問這裡，矩陣改了就立即生效。

export function can(perm: Perm): boolean {
  return store.state.rbac[store.prefs.role]?.includes(perm) ?? false;
}

export function persona() {
  return PERSONAS[store.prefs.role];
}

/** 目前登入者的顯示名稱（寫入紀錄時用）。 */
export function actorName(): string {
  return tx(persona().name);
}

/** 目前登入者在時間軸等紀錄中的代號：有成員身分用成員 id，否則用角色 id。 */
export function actorId(): string {
  return persona().memberId ?? store.prefs.role;
}

function taskSquad(task: Task): string | undefined {
  return store.state.projects.find((p) => p.id === task.projectId)?.squad;
}

/** 指派任務：主管可指派全部；Tech Lead 只能指派自己小組專案的任務。 */
export function canAssignTask(task: Task): boolean {
  if (can('task.assign')) return true;
  return can('task.manageSquad') && taskSquad(task) === persona().squad;
}

/** 移動任務（改狀態）：除了能指派的人，工程師也能更新「指派給自己」的任務。 */
export function canMoveTask(task: Task): boolean {
  if (canAssignTask(task)) return true;
  return can('task.updateOwn') && !!persona().memberId && task.assignee === persona().memberId;
}
