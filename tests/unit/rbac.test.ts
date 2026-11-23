import { beforeEach, describe, expect, test } from 'bun:test';
import { can, canAssignTask, canMoveTask } from '../../src/core/auth';
import { DEFAULT_MATRIX, isLocked, PERM_GROUPS, PERMS, ROLES } from '../../src/core/rbac';
import { store } from '../../src/core/store';
import type { RoleId } from '../../src/core/types';

describe('RBAC', () => {
  beforeEach(() => {
    store.reset();
    store.setPrefs({ role: 'manager', lang: 'zh' });
  });

  test('預設矩陣只使用定義過的權限，且每個權限都被分進某一組', () => {
    for (const role of ROLES) for (const perm of DEFAULT_MATRIX[role]) expect(PERMS).toContain(perm);
    const grouped = PERM_GROUPS.flatMap((g) => g.perms);
    expect([...grouped].sort()).toEqual([...PERMS].sort());
  });

  test('每個角色都看得到總覽與關於，而且這兩格不能取消', () => {
    for (const role of ROLES) {
      expect(DEFAULT_MATRIX[role]).toContain('page.dashboard');
      expect(DEFAULT_MATRIX[role]).toContain('page.about');
      expect(isLocked(role, 'page.about')).toBe(true);
    }
  });

  test('只有管理員能編輯權限矩陣，而且不能把自己鎖在門外', () => {
    expect(ROLES.filter((r) => DEFAULT_MATRIX[r].includes('rbac.edit'))).toEqual(['admin']);
    expect(isLocked('admin', 'rbac.edit')).toBe(true);
    expect(isLocked('manager', 'rbac.edit')).toBe(false);
  });

  test('規格裡各角色的重點權限', () => {
    const has = (role: RoleId, perm: (typeof PERMS)[number]) => DEFAULT_MATRIX[role].includes(perm);
    expect(has('manager', 'task.assign') && has('manager', 'okr.edit') && has('manager', 'release.approve') && has('manager', 'oneonone.write')).toBe(true);
    expect(has('techlead', 'task.manageSquad') && has('techlead', 'review.decide') && has('techlead', 'adr.write')).toBe(true);
    expect(has('engineer', 'task.updateOwn') && has('engineer', 'standup.write')).toBe(true);
    expect(has('pmcs', 'request.create')).toBe(true);
    expect(has('pmcs', 'task.assign') || has('pmcs', 'task.manageSquad') || has('pmcs', 'task.updateOwn')).toBe(false);
    expect(has('admin', 'member.manage')).toBe(true);
  });

  test('能移動的任務數：主管全部、Tech Lead 自己小組、工程師自己的、PM／CS 沒有', () => {
    const movable = (role: RoleId) => {
      store.setPrefs({ role });
      return store.state.tasks.filter(canMoveTask).length;
    };
    expect(movable('manager')).toBe(store.state.tasks.length);
    expect(movable('techlead')).toBe(17);
    expect(movable('engineer')).toBe(5);
    expect(movable('pmcs')).toBe(0);
  });

  test('工程師可以移動自己的任務，但不能改指派', () => {
    store.setPrefs({ role: 'engineer' });
    const own = store.state.tasks.find((t) => t.assignee === 'm4')!;
    expect(canMoveTask(own)).toBe(true);
    expect(canAssignTask(own)).toBe(false);
  });

  test('矩陣改了，權限判斷立刻跟著變', () => {
    store.setPrefs({ role: 'pmcs' });
    expect(can('request.create')).toBe(true);
    store.update((s) => { s.rbac.pmcs = s.rbac.pmcs.filter((p) => p !== 'request.create'); });
    expect(can('request.create')).toBe(false);
  });
});
