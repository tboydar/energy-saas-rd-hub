import type { Adr, AdrStatus } from '../core/types';
import { L } from './util';

type Seed = [id: string, status: AdrStatus, date: string, author: string, title: [string, string],
  context: [string, string], decision: [string, string], consequences: [string, string], alternatives: [string, string]];

const SEEDS: Seed[] = [
  ['ADR-001', 'accepted', '2026-08-12', 'm1', ['時序資料採熱、溫、冷三層儲存', 'Three-tier hot, warm and cold storage for time series'],
    ['單日 3 億筆原始資料全部放在高速儲存，成本每季成長 30%，但 90% 的查詢只看最近 7 天。', 'Keeping 300M raw points a day on fast storage increases storage cost by 30% a quarter, yet 90% of queries only touch the last 7 days.'],
    ['最近 7 天留在列式時序資料庫；7 到 90 天降採樣為 5 分鐘粒度；90 天以上轉成 Parquet 放物件儲存。', 'Keep 7 days in the columnar time-series DB, downsample 7–90 days to 5-minute grain, and move older data to Parquet on object storage.'],
    ['儲存成本預估下降 40%；跨層查詢需要一層查詢路由，冷資料查詢會變慢到秒級。', 'Storage cost should drop about 40%. Cross-tier queries need a routing layer, and cold queries slow to seconds.'],
    ['全部留在熱層（成本不可持續）；只保留 90 天（不符合客戶合約的 5 年保存）。', 'Keep everything hot (unsustainable cost); retain only 90 days (breaks the 5-year retention in customer contracts).']],
  ['ADR-002', 'accepted', '2026-09-03', 'm1', ['串流處理採事件時間與水位線', 'Event-time stream processing with watermarks'],
    ['場站網路不穩，資料常晚到數分鐘；以處理時間彙總會讓日發電量對不上。', 'Site networks are flaky and data often arrives minutes late. Aggregating by processing time makes daily generation totals disagree.'],
    ['以裝置時間戳為準，水位線容許 10 分鐘晚到；超過的資料走回填管線修正。', 'Use device timestamps, allow 10 minutes of lateness via watermarks, and correct anything later through the backfill pipeline.'],
    ['報表數字可重現；即時儀表板最多延後 10 分鐘才定案，需要在介面標示「暫定值」。', 'Report numbers become reproducible. Live dashboards settle up to 10 minutes late, so the UI must mark provisional values.'],
    ['處理時間彙總（簡單但不準）；無限等待晚到資料（狀態無限成長）。', 'Processing-time aggregation (simple but wrong); waiting forever for late data (unbounded state).']],
  ['ADR-003', 'accepted', '2026-09-24', 'm3', ['多租戶採共用叢集加租戶鍵分區', 'Multi-tenancy on a shared cluster with tenant-key partitioning'],
    ['報表 SaaS 化後租戶數會從 12 家成長到上百家，逐一部署獨立環境無法維運。', 'Once reporting becomes SaaS, tenants grow from 12 to hundreds. One environment per tenant is not operable.'],
    ['所有租戶共用叢集，資料以租戶鍵分區並在查詢層強制過濾；大型租戶可升級為獨立節點池。', 'All tenants share a cluster. Data is partitioned by tenant key with enforced filtering in the query layer; large tenants can move to dedicated node pools.'],
    ['維運成本大幅下降；必須投資租戶隔離測試與「吵鬧鄰居」的資源配額。', 'Operations cost drops sharply. We must invest in isolation tests and quotas against noisy neighbors.'],
    ['每租戶獨立環境（隔離最好但成本線性成長）；每租戶獨立資料庫（遷移與升級困難）。', 'One environment per tenant (best isolation, linear cost); one database per tenant (painful migrations and upgrades).']],
  ['ADR-004', 'accepted', '2026-10-15', 'm2', ['異常偵測先用統計基準，再引入機器學習', 'Statistical baseline first, machine learning later'],
    ['固定門檻的誤報率 12%，客戶開始忽略告警；但標註資料不足以直接訓練模型。', 'Fixed thresholds give a 12% false-positive rate and customers have started ignoring alerts, but labeled data is too thin to train a model.'],
    ['先上線季節性分解加 z-score 的統計基準，同時蒐集客戶回饋當標註；達到 2,000 筆標註後再評估模型。', 'Ship a seasonal-decomposition plus z-score baseline now, collect customer feedback as labels, and revisit ML after 2,000 labels.'],
    ['四週內可上線且可解釋；對複雜的多變量異常（如逆變器連鎖故障）偵測力有限。', 'Ships within four weeks and stays explainable. Weak on complex multivariate anomalies such as cascading inverter faults.'],
    ['直接導入深度學習模型（資料不足、難解釋）；維持固定門檻（客戶信任持續流失）。', 'Jump to deep learning (not enough data, hard to explain); keep fixed thresholds (customer trust keeps eroding).']],
  ['ADR-005', 'proposed', '2026-11-10', 'm5', ['正式環境發版採人工核准加自動回滾', 'Manual approval plus automatic rollback for production releases'],
    ['變更失敗率仍有 8%，其中一半在發版後 10 分鐘內就能從指標看出來。', 'Change failure rate is still 8%, and half of the failures show up in metrics within 10 minutes of release.'],
    ['staging 通過後由研發主管核准；上線後 10 分鐘內錯誤率或延遲超過 SLO 就自動回滾。', 'After staging passes, the engineering manager approves. If error rate or latency breaches the SLO within 10 minutes, roll back automatically.'],
    ['MTTR 預期再降 30%；核准會成為瓶頸，低風險變更之後應改為自動核准。', 'MTTR should drop another 30%. Approval becomes a bottleneck, so low-risk changes should later be auto-approved.'],
    ['完全自動發版（目前測試信心不足）；固定發版時段（Lead Time 會拉長）。', 'Fully automatic releases (test confidence is not there yet); fixed release windows (longer lead time).']],
  ['ADR-006', 'proposed', '2026-11-17', 'm2', ['AI 程式助理的使用準則', 'Guidelines for AI coding assistants'],
    ['團隊已有六成成員使用 AI 助理寫程式，但各自做法不同，Review 時難以判斷產出品質。', 'About 60% of the team already codes with AI assistants, each in their own way, which makes output quality hard to judge in review.'],
    ['允許用於測試、樣板與重構；作者對產出負全責，PR 須標註 AI 參與程度；客戶資料與憑證不得貼入提示。', 'Allow them for tests, boilerplate and refactoring. Authors own the output, PRs state the level of AI involvement, and customer data or credentials never go into prompts.'],
    ['預期 Lead Time 縮短；需要追蹤 AI 參與的 PR 其缺陷率，三個月後回顧準則。', 'Lead time should shrink. We need to track defect rates on AI-assisted PRs and revisit the guidelines in three months.'],
    ['全面禁止（失去效率且難以落實）；完全不規範（品質與資安風險不可控）。', 'Ban them outright (loses the gain and is unenforceable); no rules at all (uncontrolled quality and security risk).']],
];

export function buildAdrs(): Adr[] {
  return SEEDS.map(([id, status, date, author, t, c, d, q, a]) => ({
    id, status, date, author, title: L(...t), context: L(...c), decision: L(...d), consequences: L(...q), alternatives: L(...a),
  }));
}
