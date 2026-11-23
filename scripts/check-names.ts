// 查核站上的假名稱有沒有剛好和真實的公司或知名人物同名。
// 執行：bun run check:names（會連到下列公開資料來源，約需 10 分鐘，主要花在公司登記的 33 種狀態）
//
// 來源：
//   1. 經濟部商工登記公示資料，公司登記 — 中文組織名，查「名稱包含這些字」。
//      官方的「公司登記_公司狀態代碼對照表」共有 01 到 33 這 33 個狀態代碼，全部都查。
//   2. 經濟部商工登記公示資料，分公司登記（存活、非存活）— 中文組織名
//   3. g0v 台灣公司資料 — 中文組織名。它收錄公司登記與商業登記（行號），不分狀態。
//      商業登記的官方關鍵字查詢 API 需要申請 IP 授權，所以改用這個來源。
//   4. GLEIF 全球法人機構識別碼 — 英文組織名
//   5. Wikidata — 所有名稱，查標籤或別名完全相同的項目
//   6. 中文維基百科 — 中文名稱，查內文出現這個詞的條目
//
// 名稱直接從假資料取得，所以新增或修改名稱後不必改這支腳本。
// 送出去的只有站上的虛構名稱；查到的結果只印公司或條目名稱。
// 這套查核找的是「剛好同名」。站上的資料本來就全部是編的，沒有任何一筆來自真實來源。

import { collectNames } from './mock-names';

const UA = { 'User-Agent': 'name-check/1.0 (portfolio demo verification)' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/** 分公司登記：status 是 00（存活）或 99（非存活）。 */
async function branchRegistry(keyword: string, status: '00' | '99'): Promise<string[] | null> {
  const filter = encodeURIComponent(`Branch_Office_Name like ${keyword} and Status_Type_Code eq ${status}`);
  const rows = await getJson(`https://data.gcis.nat.gov.tw/od/data/api/20B4A6C1-1C0C-4E80-91BA-6DF97D2D9FC9?$format=json&$filter=${filter}&$skip=0&$top=50`, 3);
  if (!Array.isArray(rows)) return null;
  return (rows as { Branch_Office_Name: string; Branch_Office_Status_Desc: string }[]).map((c) => `${c.Branch_Office_Name}（${c.Branch_Office_Status_Desc}）`);
}

/** g0v 台灣公司資料：公司名稱或商業名稱包含 keyword 的登記，不分狀態。 */
async function g0vCompanies(keyword: string): Promise<string[] | null> {
  const j = (await getJson(`https://company.g0v.ronny.tw/api/search?q=${encodeURIComponent(keyword)}`)) as { data?: Record<string, unknown>[]; found?: number } | null;
  if (!j || !Array.isArray(j.data)) return null;
  const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const rows = j.data.map((d) => `${clean(d['公司名稱'] ?? d['商業名稱'])}（${clean(d['公司狀況'] ?? d['登記現況'])}）`);
  // found 是總筆數，data 只有第一頁；筆數不同時補一行說明
  if ((j.found ?? rows.length) > rows.length) rows.push(`另有 ${(j.found ?? 0) - rows.length} 筆`);
  return rows;
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
const { orgsZh, orgsEn, peopleZh, peopleEn } = collectNames();

// ── 對照組：用一般名詞查，每個來源都應該查得到東西。
// 查不到代表查詢本身壞了（例如被限流），後面的「0 筆」就不能當證據。
// 刻意不用任何真實公司的名稱當關鍵字。
console.log('對照組（確認每個來源真的查得到東西）');
const controls: [string, string[] | null][] = [
  ['公司登記「儲能」／核准設立', await registry('儲能', '01')],
  ['公司登記「能源」／解散', await registry('能源', '04')],
  ['分公司登記「能源」／存活', await branchRegistry('能源', '00')],
  ['分公司登記「台北」／非存活', await branchRegistry('台北', '99')],
  ['g0v 公司資料「儲能」', await g0vCompanies('儲能')],
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
// 官方「公司登記_公司狀態代碼對照表」（製表日期 2026/11/23）的全部代碼：01 核准設立 … 33 清理完結
const STATUSES = Array.from({ length: 33 }, (_, i) => String(i + 1).padStart(2, '0'));

console.log(`\n中文組織名（${orgsZh.length} 個）：公司登記 33 種狀態、分公司登記、g0v 公司資料（含商業登記）、Wikidata、中文維基百科`);
for (const name of orgsZh) {
  let found = 0;
  for (const status of STATUSES) {
    const rows = await check(`公司登記[${status}]`, name, () => registry(name, status));
    found += rows?.length ?? 0;
    await sleep(400);
  }
  let branches = 0;
  for (const status of ['00', '99'] as const) {
    const rows = await check(`分公司登記[${status}]`, name, () => branchRegistry(name, status));
    branches += rows?.length ?? 0;
    await sleep(400);
  }
  const g0v = await check('g0v 公司資料', name, () => g0vCompanies(name));
  const wd = await check('Wikidata', name, () => wikidata(name, 'zh'));
  const wp = await check('中文維基百科', name, () => zhWikipedia(name));
  console.log(`  ${name}：公司登記 ${found} 筆、分公司 ${branches} 筆、g0v ${g0v?.length ?? '待重試'} 筆、Wikidata ${wd?.length ?? '待重試'} 筆、維基百科 ${wp?.length ?? '待重試'} 篇`);
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
