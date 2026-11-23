// 查核站上的假名稱有沒有剛好和真實的公司或知名人物同名。
// 執行：bun run check:names（會連到下列公開資料來源，約需 10 分鐘，主要花在商工登記的 33 種狀態）
//
// 來源：
//   1. 經濟部商工登記公示資料（公司登記，全部 33 種登記狀態）— 中文組織名，查「名稱包含這些字」
//   2. GLEIF 全球法人機構識別碼 — 英文組織名
//   3. Wikidata — 所有名稱，查標籤或別名完全相同的項目
//   4. 中文維基百科 — 中文名稱，查內文出現這個詞的條目
//
// 名稱直接從假資料取得，所以新增或修改名稱後不必改這支腳本。
// 送出去的只有站上的虛構名稱；查到的結果只印公司或條目名稱。
// 注意：查不到不等於世界上不存在，這只是一套固定範圍的盡職查核。

import { buildInitialState } from '../src/mock';
import { SITE } from '../src/mock/devices';
import { PERSONAS } from '../src/mock/members';
import { CUSTOMERS } from '../src/mock/requests';

const UA = { 'User-Agent': 'name-check/1.0 (portfolio demo verification)' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uniq = (list: string[]) => [...new Set(list)];

async function getJson(url: string, tries = 5): Promise<unknown | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const text = (await res.text()).trim();
        return text === '' ? [] : JSON.parse(text);
      }
    } catch {
      // 逾時或暫時性錯誤：等一下再試
    }
    await sleep(2000 * (i + 1));
  }
  return null;
}

/** 商工登記：某一種登記狀態下，名稱包含 keyword 的公司。查詢失敗回傳 null。 */
async function registry(keyword: string, status: string): Promise<string[] | null> {
  const filter = encodeURIComponent(`Company_Name like ${keyword} and Company_Status eq ${status}`);
  const rows = await getJson(`https://data.gcis.nat.gov.tw/od/data/api/6BBA2268-1367-4B42-9CCA-BC17499EBE8C?$format=json&$filter=${filter}&$skip=0&$top=50`, 3);
  if (!Array.isArray(rows)) return null;
  return (rows as { Company_Name: string; Company_Status_Desc: string }[]).map((c) => `${c.Company_Name}（${c.Company_Status_Desc}）`);
}

async function gleif(name: string): Promise<string[] | null> {
  const j = (await getJson(`https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodeURIComponent(name)}&page[size]=5`)) as { data?: { attributes: { entity: { legalName: { name: string } } } }[] } | null;
  return j?.data ? j.data.map((d) => d.attributes.entity.legalName.name) : null;
}

async function wikidata(name: string, lang: 'zh' | 'en'): Promise<string[] | null> {
  const j = (await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&limit=10&type=item&language=${lang}&uselang=${lang}&search=${encodeURIComponent(name)}`)) as { search?: { id: string; label?: string; description?: string; match?: { text?: string } }[] } | null;
  if (!j?.search) return null;
  const same = (text?: string) => (text ?? '').toLowerCase() === name.toLowerCase();
  return j.search.filter((s) => same(s.label) || same(s.match?.text)).map((s) => `${s.id} ${s.label ?? ''}：${s.description ?? '無描述'}`);
}

async function zhWikipedia(name: string): Promise<string[] | null> {
  const j = (await getJson(`https://zh.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=5&srsearch=${encodeURIComponent(`"${name}"`)}`)) as { query?: { search: { title: string }[] } } | null;
  return j?.query ? j.query.search.map((s) => s.title) : null;
}

// ── 從假資料取出所有名稱
const state = buildInitialState();
const orgsZh = uniq([...CUSTOMERS.map((c) => c.zh), SITE.zh.split('・')[0], ...state.requests.map((r) => r.customer.zh)]);
const orgsEn = uniq([...CUSTOMERS.map((c) => c.en), SITE.en.split(',')[0], ...state.requests.map((r) => r.customer.en)]);
const personas = Object.values(PERSONAS).filter((p) => p.name.zh !== '系統管理員');
const peopleZh = uniq([...state.members.map((m) => m.name.zh), ...personas.map((p) => p.name.zh)]);
const peopleEn = uniq([...state.members.map((m) => m.name.en), ...personas.map((p) => p.name.en)]);

// ── 對照組：用一般名詞查，每個來源都應該查得到東西。
// 查不到代表查詢本身壞了（例如被限流），後面的「0 筆」就不能當證據。
// 刻意不用任何真實公司的名稱當關鍵字。
console.log('對照組（確認每個來源真的查得到東西）');
const controls: [string, string[] | null][] = [
  ['商工登記「儲能」／核准設立', await registry('儲能', '01')],
  ['商工登記「能源」／解散', await registry('能源', '04')],
  ['GLEIF「Wind Farm」', await gleif('Wind Farm')],
  ['Wikidata「風力發電廠」', await wikidata('風力發電廠', 'zh')],
  ['中文維基百科「風力發電廠」', await zhWikipedia('風力發電廠')],
];
for (const [label, rows] of controls) console.log(`  ${rows && rows.length ? '通過' : '失敗'}　${label}（${rows ? rows.length : '查詢失敗'} 筆）`);
if (controls.some(([, rows]) => !rows || rows.length === 0)) {
  console.error('\n對照組沒有全部通過，無法驗證。請稍後再試。');
  process.exit(2);
}

// ── 正式查核
const hits: string[] = [];
type Query = () => Promise<string[] | null>;
let failed: { label: string; query: Query }[] = [];
/** 執行一個查詢並記錄結果；失敗的先記下來，最後統一重試。 */
async function check(source: string, name: string, query: Query): Promise<string[] | null> {
  const rows = await query();
  if (rows === null) failed.push({ label: `${source}／${name}`, query });
  else for (const row of rows) hits.push(`${source}／${name} → ${row}`);
  return rows;
}
const STATUSES = Array.from({ length: 33 }, (_, i) => String(i + 1).padStart(2, '0'));

console.log(`\n中文組織名（${orgsZh.length} 個）：商工登記 33 種狀態、Wikidata、中文維基百科`);
for (const name of orgsZh) {
  let found = 0;
  for (const status of STATUSES) {
    const rows = await check(`商工登記[${status}]`, name, () => registry(name, status));
    found += rows?.length ?? 0;
    await sleep(400);
  }
  const wd = await check('Wikidata', name, () => wikidata(name, 'zh'));
  const wp = await check('中文維基百科', name, () => zhWikipedia(name));
  console.log(`  ${name}：商工登記 ${found} 筆、Wikidata ${wd?.length ?? '待重試'} 筆、維基百科 ${wp?.length ?? '待重試'} 篇`);
}

console.log(`\n英文組織名（${orgsEn.length} 個）：GLEIF、Wikidata`);
for (const name of orgsEn) {
  const g = await check('GLEIF', name, () => gleif(name));
  const wd = await check('Wikidata', name, () => wikidata(name, 'en'));
  console.log(`  ${name}：GLEIF ${g?.length ?? '待重試'} 筆、Wikidata ${wd?.length ?? '待重試'} 筆`);
  await sleep(800);
}

console.log(`\n中文人名（${peopleZh.length} 個）：Wikidata、中文維基百科`);
for (const name of peopleZh) {
  const wd = await check('Wikidata', name, () => wikidata(name, 'zh'));
  const wp = await check('中文維基百科', name, () => zhWikipedia(name));
  console.log(`  ${name}：Wikidata ${wd?.length ?? '待重試'} 筆、維基百科 ${wp?.length ?? '待重試'} 篇`);
  await sleep(800);
}

console.log(`\n英文人名（${peopleEn.length} 個）：Wikidata`);
for (const name of peopleEn) {
  const wd = await check('Wikidata', name, () => wikidata(name, 'en'));
  console.log(`  ${name}：Wikidata ${wd?.length ?? '待重試'} 筆`);
  await sleep(800);
}

// ── 重試失敗的查詢（多半是對方暫時限流），最多三輪
for (let round = 1; round <= 3 && failed.length; round++) {
  console.log(`\n重試第 ${round} 輪：${failed.length} 個查詢`);
  await sleep(20000);
  const pending = failed;
  failed = [];
  for (const item of pending) {
    const rows = await item.query();
    if (rows === null) failed.push(item);
    else {
      for (const row of rows) hits.push(`${item.label} → ${row}`);
      console.log(`  ${item.label}：${rows.length} 筆`);
    }
    await sleep(1500);
  }
}

console.log('\n── 結果');
console.log(`名稱總數：${orgsZh.length + orgsEn.length + peopleZh.length + peopleEn.length}`);
console.log(`查詢失敗：${failed.length}${failed.length ? '\n  ' + failed.map((f) => f.label).join('\n  ') : ''}`);
console.log(`命中：${hits.length}${hits.length ? '\n  ' + hits.join('\n  ') : ''}`);
process.exit(hits.length ? 1 : failed.length ? 2 : 0);
