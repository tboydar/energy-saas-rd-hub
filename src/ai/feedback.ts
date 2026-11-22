import { activeSprint, memberLoad } from '../core/selectors';
import type { AppState, Lang, Member, SkillKey } from '../core/types';
import { SKILL_LABELS } from '../mock/members';

// 績效回饋草稿：依成員的任務、技能與 1:1 紀錄，用規則組出一份「可以開始改」的初稿。

export function draftFeedback(state: AppState, member: Member, lang: Lang): string {
  const zh = lang === 'zh';
  const sprint = activeSprint(state);
  const load = memberLoad(state, member);
  const done = state.tasks.filter((t) => t.assignee === member.id && t.sprintId === sprint.id && t.status === 'done');
  const skills = (Object.keys(member.skills) as SkillKey[]).sort((a, b) => member.skills[b] - member.skills[a]);
  const top = skills.slice(0, 2).map((k) => SKILL_LABELS[k][lang]);
  const low = SKILL_LABELS[skills[skills.length - 1]][lang];
  const openGrowth = member.growthPlan.filter((g) => !g.done).map((g) => g.text[lang]);
  const lastTalk = member.oneOnOnes[0];
  const nm = member.name[lang];

  if (zh) {
    return [
      `【績效回饋草稿】${nm}（${member.level.zh}）`, '（由規則產生的初稿，請依實際觀察修改後再使用）', '',
      '做得好的地方',
      done.length ? `- ${sprint.name} 已完成 ${load.done} 點：${done.map((t) => t.title.zh).join('、')}` : `- ${sprint.name} 的任務仍在進行中，請補充具體成果`,
      `- 強項是${top.join('與')}，是團隊在這兩個領域的主要依靠`, '',
      '可以更好的地方',
      `- ${low}相對較弱，可以透過結對或小型任務補強`,
      load.level === 'over' ? `- 目前負載 ${load.pct}%，需要一起練習「說不」與提早提出風險` : load.level === 'low' ? `- 目前負載 ${load.pct}%，有餘裕承擔更有挑戰的任務` : `- 目前負載 ${load.pct}%，節奏健康`, '',
      '下一步',
      ...(openGrowth.length ? openGrowth.map((g) => `- ${g}`) : ['- 成長計畫已全數完成，下次 1:1 一起訂新目標']),
      lastTalk ? `- 延續上次 1:1 的行動：${lastTalk.actions.zh}` : '- 安排一次 1:1 對齊職涯目標',
      `- 職涯目標：${member.careerGoal.zh}`,
    ].join('\n');
  }
  return [
    `Performance feedback draft: ${nm} (${member.level.en})`, '(A rule-based first draft. Edit it against what you actually observed before using it.)', '',
    'What went well',
    done.length ? `- Completed ${load.done} points in ${sprint.name}: ${done.map((t) => t.title.en).join(', ')}` : `- ${sprint.name} work is still in progress; add concrete results`,
    `- Strongest in ${top.join(' and ')}; the team leans on them in both areas`, '',
    'What could be better',
    `- ${low} is comparatively weak; pairing or a small scoped task would help`,
    load.level === 'over' ? `- Currently at ${load.pct}% load; practice saying no and raising risk early` : load.level === 'low' ? `- Currently at ${load.pct}% load; there is room for a more challenging task` : `- Currently at ${load.pct}% load, a healthy pace`, '',
    'Next steps',
    ...(openGrowth.length ? openGrowth.map((g) => `- ${g}`) : ['- Growth plan is complete; set new goals in the next 1:1']),
    lastTalk ? `- Follow up on the last 1:1 action: ${lastTalk.actions.en}` : '- Schedule a 1:1 to align on career goals',
    `- Career goal: ${member.careerGoal.en}`,
  ].join('\n');
}
