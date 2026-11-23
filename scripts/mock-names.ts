// 從假資料取出所有組織名與人名。查核腳本與單元測試共用。
import { buildInitialState } from '../src/mock';
import { SITE } from '../src/mock/devices';
import { PERSONAS } from '../src/mock/members';
import { CUSTOMERS } from '../src/mock/requests';

export interface MockNames {
  orgsZh: string[];
  orgsEn: string[];
  peopleZh: string[];
  peopleEn: string[];
}

const uniq = (list: string[]) => [...new Set(list)];

export function collectNames(): MockNames {
  const state = buildInitialState();
  // 「系統管理員」是角色名稱，不是人名
  const personas = Object.values(PERSONAS).filter((p) => p.name.zh !== '系統管理員');
  return {
    orgsZh: uniq([...CUSTOMERS.map((c) => c.zh), SITE.zh.split('・')[0], ...state.requests.map((r) => r.customer.zh)]),
    orgsEn: uniq([...CUSTOMERS.map((c) => c.en), SITE.en.split(',')[0], ...state.requests.map((r) => r.customer.en)]),
    peopleZh: uniq([...state.members.map((m) => m.name.zh), ...personas.map((p) => p.name.zh)]),
    peopleEn: uniq([...state.members.map((m) => m.name.en), ...personas.map((p) => p.name.en)]),
  };
}
