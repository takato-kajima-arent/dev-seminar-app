// Generates data/schedule.json (工程表) and validates scenario constraints (#6 #7 #8).
// Usage: node scripts/build-schedule.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8'));

const d = (s) => (s.length === 5 ? '2026-' + s : s); // "11-12" -> "2026-11-12"

// row: [key, wbs, name, category, areaId, floor, companyId, start, end, workers, outdoor, status, progress, deps, opts]
// Summary rows (companyId null) get span/progress computed from their children.
const rows = [
  // ===== 1 仮設・外部 =====
  ['S1', '1', '仮設・外部', '仮設', 'area-ext', '外部', null, null, null, 0, false, null, null, [], { summary: true }],
  ['tobi-south', '1.1.1', '南面 外部足場 盛替え', '仮設', 'area-ext', '外部 南面', 'c-tobi', '10-26', '10-30', 4, true, 'done', 100, []],
  ['tobi-east-chk', '1.1.5', '東面 外部足場 点検・養生ネット補修', '仮設', 'area-ext', '外部 東面', 'c-tobi', '11-02', '11-11', 4, true, 'in_progress', 95, ['tobi-south'], { id: 'sch-077' }],
  ['tobi-east', '1.1.2', '東面 足場盛替え', '仮設', 'area-ext', '外部 東面', 'c-tobi', '11-12', '11-13', 4, true, 'not_started', 0, ['tobi-south']],
  ['tobi-east-dis', '1.1.3', '東面 外部足場 一部解体', '仮設', 'area-ext', '外部 東面', 'c-tobi', '11-20', '11-27', 5, true, 'not_started', 0, ['tobi-east', 'tosou-seal2']],
  ['tobi-sw-dis', '1.1.4', '南面・西面 外部足場 解体', '仮設', 'area-ext', '外部 南・西面', 'c-tobi', '11-30', '12-11', 5, true, 'not_started', 0, ['tobi-east-dis']],
  ['tosou-seal1', '1.2.1', '1工区 外壁シーリング', '外装', 'area-ext', '外部 1〜4F', 'c-tosou', '10-19', '10-30', 3, true, 'done', 100, []],
  ['sash-kasagi', '1.2.2', '屋上 パラペット笠木 取付', '外装', 'area-ext', '屋上外周', 'c-sash', '10-26', '11-04', 3, true, 'done', 100, []],

  // ===== 2 1工区（B1F〜4F） =====
  ['S2', '2', '1工区（B1F〜4F） 仕上・設備', '内装', 'area-1', 'B1F〜4F', null, null, null, 0, false, null, null, [], { summary: true }],
  ['naiso-24', '2.1.1', '2-4F 事務室 LGS下地・ボード張り', '内装', 'area-1', '2-4F', 'c-naiso', '09-14', '10-30', 6, false, 'done', 100, []],
  ['naiso-1f', '2.1.2', '1F エントランス LGS下地・ボード張り', '内装', 'area-1', '1F', 'c-naiso', '10-19', '11-06', 5, false, 'done', 100, []],
  ['kucho-3f', '2.1.3', '3F 会議室 天井内 空調ダクト盛替え', '空調', 'area-1', '3F', 'c-kucho', '11-16', '11-17', 2, false, 'not_started', 0, ['naiso-24'], { note: 'CH2600 反映の施工図待ち' }],
  ['naiso-3f-lgs', '2.1.4', '3F 会議室 天井下地 組直し（CH2600）', '内装', 'area-1', '3F', 'c-naiso', '11-17', '11-20', 4, false, 'not_started', 0, ['kucho-3f']],
  ['naiso-3f-bd', '2.1.5', '3F 会議室 天井ボード張り', '内装', 'area-1', '3F', 'c-naiso', '11-23', '11-26', 4, false, 'not_started', 0, ['naiso-3f-lgs']],
  ['floor-3f', '2.1.6', '3F 会議室 タイルカーペット・クロス', '内装', 'area-1', '3F', 'c-floor', '12-01', '12-04', 3, false, 'not_started', 0, ['naiso-3f-bd']],
  ['tosou-2f', '2.2.1', '1工区 2F 共用廊下 塗装 中塗り', '内装', 'area-1', '2F', 'c-tosou', '11-04', '11-10', 3, false, 'done', 100, ['naiso-24']],
  ['tosou-1f', '2.2.2', '1F エントランス 塗装下地処理', '内装', 'area-1', '1F', 'c-tosou', '11-17', '11-19', 3, false, 'not_started', 0, ['naiso-1f'], { canAdvance: true }],
  ['tosou-24', '2.2.3', '1工区 共用廊下 塗装 上塗り', '内装', 'area-1', '2-4F', 'c-tosou', '11-24', '11-26', 3, false, 'not_started', 0, ['tosou-2f', 'denki-24']],
  ['floor-24', '2.2.4', '2-4F 事務室 タイルカーペット', '内装', 'area-1', '2-4F', 'c-floor', '11-27', '12-04', 4, false, 'not_started', 0, ['tosou-24']],
  ['floor-4f', '2.2.5', '4F 共用部 長尺シート張り', '内装', 'area-1', '4F', 'c-floor', '11-04', '11-10', 3, false, 'done', 100, ['naiso-24'], { id: 'sch-079' }],
  ['eisei-23-pipe', '2.3.0', '2-3F 給水・排水管 配管', '衛生', 'area-1', '2-3F', 'c-eisei', '10-19', '11-09', 3, false, 'done', 100, [], { id: 'sch-078' }],
  ['eisei-b1', '2.3.1', 'B1F 排水槽・排水ポンプ 据付', '衛生', 'area-1', 'B1F', 'c-eisei', '10-13', '11-06', 3, false, 'done', 100, []],
  ['eisei-23', '2.3.2', '2-3F 給水管 耐圧試験・保温', '衛生', 'area-1', '2-3F', 'c-eisei', '11-10', '11-13', 3, false, 'in_progress', 40, ['naiso-24', 'eisei-23-pipe']],
  ['eisei-24-ki', '2.3.3', '2-4F 衛生器具 取付', '衛生', 'area-1', '2-4F', 'c-eisei', '11-24', '12-02', 3, false, 'not_started', 0, ['eisei-23']],
  ['denki-juhen', '2.4.1', '1F 電気室 受変電設備 据付', '電気', 'area-1', '1F', 'c-denki', '09-28', '10-30', 4, false, 'done', 100, []],
  ['denki-b1', '2.4.2', 'B1F 駐車場 照明配管・配線', '電気', 'area-1', 'B1F', 'c-denki', '10-19', '11-05', 3, false, 'done', 100, []],
  ['denki-kirikae', '2.4.3', '受変電設備 切替（全館停電 8:00〜12:00）', '電気', 'area-1', '1F', 'c-denki', '11-15', '11-15', 6, false, 'not_started', 0, ['denki-juhen', 'denki-kansen']],
  ['denki-24', '2.4.4', '2-4F 照明器具・コンセント 取付', '電気', 'area-1', '2-4F', 'c-denki', '11-16', '11-21', 4, false, 'not_started', 0, ['denki-kirikae']],
  ['shobo-1', '2.5.1', '1工区 消火栓・スプリンクラー配管', '防災', 'area-1', 'B1F〜4F', 'c-shobo', '10-05', '11-06', 3, false, 'done', 100, []],
  ['shobo-1-kanchi', '2.5.2', '1工区 自火報 感知器 取付', '防災', 'area-1', 'B1F〜4F', 'c-shobo', '11-24', '11-30', 3, false, 'not_started', 0, ['denki-24']],
  ['tobi-pit', '2.6.1', 'B1F ピット清掃・資材整理', '仮設', 'area-1', 'B1F', 'c-tobi', '11-18', '11-18', 4, false, 'not_started', 0, ['eisei-b1'], { canAdvance: true }],
  ['gaiko-b1', '2.6.2', 'B1F 駐車場 床面下地清掃・墨出し', '外構', 'area-1', 'B1F', 'c-gaiko', '11-19', '11-20', 3, false, 'not_started', 0, ['denki-b1'], { canAdvance: true }],

  // ===== 3 2工区（5F〜8F） =====
  ['S3', '3', '2工区（5F〜8F） 仕上・設備', '内装', 'area-2', '5F〜8F', null, null, null, 0, false, null, null, [], { summary: true }],
  ['naiso-5f', '3.1.1', '5F 天井ボード張り', '内装', 'area-2', '5F', 'c-naiso', '10-26', '11-10', 5, false, 'done', 100, []],
  ['naiso-6f', '3.1.2', '6F 内装 LGS下地・ボード張り', '内装', 'area-2', '6F', 'c-naiso', '11-02', '11-18', 6, false, 'delayed', 55, ['naiso-5f'], { baselineStart: '2026-11-02', baselineEnd: '2026-11-13' }],
  ['naiso-7f', '3.1.3', '7F 内装 LGS下地・ボード張り', '内装', 'area-2', '7F', 'c-naiso', '11-19', '12-02', 6, false, 'not_started', 0, ['naiso-6f', 'denki-kansen']],
  ['naiso-8f', '3.1.4', '8F 内装 LGS下地・ボード張り', '内装', 'area-2', '8F', 'c-naiso', '12-03', '12-11', 6, false, 'not_started', 0, ['naiso-7f']],
  ['floor-5f', '3.1.5', '5F クロス・床仕上げ', '内装', 'area-2', '5F', 'c-floor', '11-16', '11-24', 4, false, 'not_started', 0, ['naiso-5f', 'sash-5f']],
  ['floor-6f', '3.1.6', '6F クロス・床仕上げ', '内装', 'area-2', '6F', 'c-floor', '11-26', '12-04', 4, false, 'not_started', 0, ['naiso-6f']],
  ['sash-6f', '3.2.1', '6F サッシ・ガラス取付', '外装', 'area-2', '6F', 'c-sash', '10-05', '10-16', 3, false, 'done', 100, []],
  ['sash-78', '3.2.2', '5F・7-8F サッシ取付', '外装', 'area-2', '5F・7-8F', 'c-sash', '10-19', '11-10', 3, false, 'done', 100, ['sash-6f']],
  ['sash-5f', '3.2.3', '5F ガラス取付', '外装', 'area-2', '5F', 'c-sash', '11-11', '11-13', 3, false, 'in_progress', 20, ['sash-78']],
  ['tosou-seal2', '3.2.4', '2工区 外壁シーリング・タッチアップ', '外装', 'area-2', '5-8F 外部', 'c-tosou', '11-12', '11-14', 3, true, 'not_started', 0, ['sash-78']],
  ['denki-eps', '3.3.1', '6F EPS 支持金物取付', '電気', 'area-2', '6F', 'c-denki', '11-04', '11-10', 2, false, 'done', 100, []],
  ['denki-kansen', '3.3.2', '6-8F 幹線ケーブル入線', '電気', 'area-2', '6-8F', 'c-denki', '10-29', '11-14', 5, false, 'in_progress', 60, []],
  ['kucho-58', '3.3.3', '5-8F 空調ダクト・冷媒配管', '空調', 'area-2', '5-8F', 'c-kucho', '09-28', '11-06', 4, false, 'done', 100, []],
  ['eisei-58', '3.3.4', '5-8F 給排水配管', '衛生', 'area-2', '5-8F', 'c-eisei', '09-28', '11-04', 3, false, 'done', 100, []],
  ['shobo-6f', '3.4.1', '6F スプリンクラーヘッド取付', '防災', 'area-2', '6F', 'c-shobo', '11-26', '11-30', 2, false, 'not_started', 0, ['naiso-6f']],

  // ===== 4 3工区（9F〜12F・屋上） =====
  ['S4', '4', '3工区（9F〜12F・屋上） 仕上・設備', '内装', 'area-3', '9F〜屋上', null, null, null, 0, false, null, null, [], { summary: true }],
  ['kucho-9f', '4.1.1', '9F 空調ダクト吊込み', '空調', 'area-3', '9F', 'c-kucho', '10-26', '11-10', 4, false, 'done', 100, []],
  ['kucho-10f', '4.1.2', '10F 空調ダクト吊込み', '空調', 'area-3', '10F', 'c-kucho', '11-16', '11-20', 4, false, 'not_started', 0, ['kucho-9f'], { canAdvance: true }],
  ['kucho-1112', '4.1.3', '11-12F 空調ダクト吊込み', '空調', 'area-3', '11-12F', 'c-kucho', '11-30', '12-11', 4, false, 'not_started', 0, ['kucho-10f']],
  ['kucho-kadai', '4.1.4', '屋上 室外機架台据付', '空調', 'area-3', '屋上', 'c-kucho', '11-10', '11-14', 4, true, 'in_progress', 30, []],
  ['crane-roof', '4.1.5', '屋上 室外機 揚重（クレーン）', '仮設', 'area-3', '屋上', 'c-crane', '11-18', '11-18', 3, true, 'not_started', 0, ['kucho-kadai']],
  ['kucho-roof', '4.1.6', '屋上 室外機据付・冷媒配管接続', '空調', 'area-3', '屋上', 'c-kucho', '11-18', '11-25', 5, true, 'not_started', 0, ['crane-roof']],
  ['bousui-1', '4.2.1', '屋上 防水 下地調整', '外装', 'area-3', '屋上', 'c-bousui', '11-16', '11-19', 4, true, 'not_started', 0, ['kucho-kadai']],
  ['bousui-2', '4.2.2', '屋上 防水 ウレタン塗膜防水', '外装', 'area-3', '屋上', 'c-bousui', '11-20', '12-02', 4, true, 'not_started', 0, ['bousui-1']],
  ['naiso-912', '4.3.1', '9-12F LGS下地', '内装', 'area-3', '9-12F', 'c-naiso', '09-07', '10-23', 6, false, 'done', 100, []],
  ['naiso-910', '4.3.2', '9-10F ボード張り', '内装', 'area-3', '9-10F', 'c-naiso', '10-19', '11-06', 5, false, 'done', 100, ['naiso-912']],
  ['naiso-1112', '4.3.3', '11-12F ボード張り', '内装', 'area-3', '11-12F', 'c-naiso', '12-03', '12-11', 4, false, 'not_started', 0, ['kucho-1112']],
  ['denki-912', '4.4.1', '9-12F 照明・コンセント配線', '電気', 'area-3', '9-12F', 'c-denki', '10-19', '11-06', 4, false, 'done', 100, []],
  ['shobo-12f', '4.4.2', '11-12F 自火報 感知器 取付', '防災', 'area-3', '11-12F', 'c-shobo', '12-07', '12-11', 2, false, 'not_started', 0, ['naiso-1112']],
  ['ev-1', '4.5.1', 'EV 1号機 据付', '昇降機', 'area-3', '昇降路・機械室', 'c-ev', '09-14', '11-06', 3, false, 'done', 100, []],
  ['ev-1-test', '4.5.2', 'EV 1号機 調整・試運転', '昇降機', 'area-3', '昇降路・機械室', 'c-ev', '11-24', '12-04', 2, false, 'not_started', 0, ['ev-1', 'denki-kirikae']],
  ['ev-2', '4.5.3', 'EV 2号機 据付', '昇降機', 'area-3', '昇降路・機械室', 'c-ev', '11-16', '12-11', 3, false, 'not_started', 0, ['ev-1', 'denki-kirikae']],

  // ===== 5 外構 =====
  ['S5', '5', '外構', '外構', 'area-ext', '外構', null, null, null, 0, false, null, null, [], { summary: true }],
  ['gaiko-north', '5.1.1', '北側通路 舗装下地', '外構', 'area-ext', '北側通路', 'c-gaiko', '11-04', '11-17', 5, true, 'delayed', 40, [], { baselineStart: '2026-11-04', baselineEnd: '2026-11-12' }],
  ['gaiko-north-as', '5.1.2', '北側通路 アスファルト舗装', '外構', 'area-ext', '北側通路', 'c-gaiko', '11-24', '11-26', 5, true, 'not_started', 0, ['gaiko-north']],
  ['gaiko-south', '5.2.1', '南側駐輪場 路盤・ワイヤーメッシュ敷設', '外構', 'area-ext', '南側駐輪場', 'c-gaiko', '11-02', '11-10', 4, true, 'done', 100, []],
  ['concrete-south', '5.2.2', '南側駐輪場 土間コン 生コン打設（生コン車 延べ6台）', '外構', 'area-ext', '南側駐輪場', 'c-concrete', '11-13', '11-13', 2, true, 'not_started', 0, ['gaiko-south']],
  ['gaiko-south-con', '5.2.3', '南側駐輪場 土間コン打設・金ゴテ仕上げ', '外構', 'area-ext', '南側駐輪場', 'c-gaiko', '11-13', '11-13', 4, true, 'not_started', 0, ['gaiko-south']],
  ['gaiko-plant', '5.3.1', '外構 縁石・植栽', '外構', 'area-ext', '敷地外周', 'c-gaiko', '12-01', '12-11', 4, true, 'not_started', 0, ['gaiko-north-as']],

  // ===== 6 検査 =====
  ['S6', '6', '検査', '検査', 'area-ext', '全体', null, null, null, 0, false, null, null, [], { summary: true }],
  ['insp-gc1', '6.1', '1工区 社内検査', '検査', 'area-1', 'B1F〜4F', 'c-gc', '11-16', '11-17', 2, false, 'not_started', 0, ['naiso-24', 'tosou-2f', 'eisei-23']],
  ['insp-owner1', '6.2', '1工区 施主検査', '検査', 'area-1', 'B1F〜4F', 'c-gc', '11-19', '11-19', 3, false, 'not_started', 0, ['insp-gc1']],
  ['insp-design', '6.3', '2工区 設計監理者検査', '検査', 'area-2', '5F〜8F', 'c-gc', '12-07', '12-09', 2, false, 'not_started', 0, ['floor-5f', 'floor-6f']],

  // ===== 7 躯体（完了） =====
  ['S7', '7', '躯体', '躯体', 'area-3', '全体', null, null, null, 0, false, null, null, [], { summary: true }],
  ['tekkin-ph', '7.1', '塔屋 RC 配筋', '躯体', 'area-3', '塔屋', 'c-tekkin', '08-03', '08-21', 5, true, 'done', 100, []],
  ['katawaku-ph', '7.2', '塔屋 RC 型枠', '躯体', 'area-3', '塔屋', 'c-katawaku', '08-10', '08-28', 5, true, 'done', 100, ['tekkin-ph']],
];

// ---- build ----
const tasks = [];
const idOf = {};
// Ids are positional over rows without an explicit opts.id (keeps legacy ids stable);
// rows added later carry an explicit id so they can sit in their logical WBS position.
let seq = 0;
for (const r of rows) {
  if (idOf[r[0]]) throw new Error('dup key ' + r[0]);
  idOf[r[0]] = r[14]?.id ?? 'sch-' + String(++seq).padStart(3, '0');
}
if (new Set(Object.values(idOf)).size !== rows.length) throw new Error('dup id');
for (const r of rows) {
  const [key, wbs, name, category, areaId, floor, companyId, s, e, workers, outdoor, status, progress, deps, opts = {}] = r;
  const t = {
    id: idOf[key], wbs, name, category, areaId, floor, companyId,
    baselineStart: opts.baselineStart ?? (s && d(s)), baselineEnd: opts.baselineEnd ?? (e && d(e)),
    start: s && d(s), end: e && d(e),
    workers, outdoor, canAdvance: !!opts.canAdvance,
    progress, status,
    dependsOn: deps.map((k) => { if (!idOf[k]) throw new Error('bad dep ' + k); return idOf[k]; }),
    note: opts.note ?? '',
  };
  if (opts.summary) t.summary = true;
  tasks.push(t);
}
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5 + 1;
for (const t of tasks.filter((t) => t.summary)) {
  const kids = tasks.filter((c) => !c.summary && c.wbs.split('.')[0] === t.wbs);
  t.start = t.baselineStart = kids.map((k) => k.start).sort()[0];
  t.end = t.baselineEnd = kids.map((k) => k.end).sort().at(-1);
  let w = 0, p = 0;
  for (const k of kids) { const dd = days(k.start, k.end); w += dd; p += dd * k.progress; }
  t.progress = Math.round(p / w);
  t.status = t.progress >= 100 ? 'done' : t.progress === 0 ? 'not_started' : 'in_progress';
}

const schedule = {
  project: { name: site.site.name, start: '2025-10-01', end: '2027-03-31', viewStart: '2026-10-26', viewEnd: '2026-12-13' },
  tasks,
  milestones: [
    { id: 'ms-001', name: '受変電設備 切替（全館停電 8:00〜12:00）', date: '2026-11-15' },
    { id: 'ms-002', name: '1工区 施主検査', date: '2026-11-19' },
    { id: 'ms-003', name: '外部足場 解体開始（東面）', date: '2026-11-20' },
    { id: 'ms-004', name: '外部足場 解体完了', date: '2026-12-11' },
    { id: 'ms-005', name: '本受電', date: '2026-12-15' },
    { id: 'ms-006', name: '消防検査', date: '2027-02-16' },
    { id: 'ms-007', name: '竣工・引渡し', date: '2027-03-31' },
  ],
};

// ---- validate ----
const errs = [];
const companies = new Set(site.companies.map((c) => c.id));
const areas = new Set(site.areas.map((a) => a.id));
const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
const TODAY = '2026-11-11', D = '2026-11-12';
for (const t of tasks) {
  if (!areas.has(t.areaId)) errs.push(`${t.id} bad area`);
  if (t.summary) { if (t.companyId !== null) errs.push(`${t.id} summary has company`); continue; }
  if (!companies.has(t.companyId)) errs.push(`${t.id} bad company ${t.companyId}`);
  if (t.start > t.end) errs.push(`${t.id} start>end`);
  for (const dep of t.dependsOn) { if (!byId[dep]) errs.push(`${t.id} bad dep`); else if (byId[dep].start > t.start) errs.push(`${t.id} dep ${dep} starts later`); }
  if (t.status === 'done' && (t.progress !== 100 || t.end > '2026-11-10')) errs.push(`${t.id} done inconsistent`);
  if (t.status === 'in_progress' && !(t.start <= TODAY && TODAY <= t.end && t.progress > 0 && t.progress < 100)) errs.push(`${t.id} in_progress inconsistent`);
  if (t.status === 'not_started' && !(t.start > TODAY && t.progress === 0)) errs.push(`${t.id} not_started inconsistent`);
  if (t.canAdvance && !(t.status === 'not_started' && !t.outdoor && t.dependsOn.every((x) => byId[x].status === 'done'))) errs.push(`${t.id} canAdvance inconsistent`);
}
const active = tasks.filter((t) => !t.summary && t.start <= D && D <= t.end);
const want = { 'c-naiso': 6, 'c-denki': 5, 'c-kucho': 4, 'c-eisei': 3, 'c-tobi': 4, 'c-gaiko': 5, 'c-tosou': 3, 'c-sash': 3 };
const got = {};
for (const t of active) got[t.companyId] = (got[t.companyId] || 0) + t.workers;
if (JSON.stringify(Object.keys(got).sort()) !== JSON.stringify(Object.keys(want).sort())) errs.push('11/12 company set mismatch: ' + Object.keys(got));
for (const [c, n] of Object.entries(want)) if (got[c] !== n) errs.push(`11/12 ${c} workers ${got[c]} != ${n}`);
const outdoor = active.filter((t) => t.outdoor).map((t) => t.name).sort();
const wantOut = ['東面 足場盛替え', '北側通路 舗装下地', '2工区 外壁シーリング・タッチアップ', '屋上 室外機架台据付'].sort();
if (JSON.stringify(outdoor) !== JSON.stringify(wantOut)) errs.push('outdoor mismatch ' + outdoor);
const delayed = tasks.filter((t) => t.status === 'delayed');
if (delayed.length !== 2) errs.push('delayed count');
const adv = tasks.filter((t) => t.canAdvance);
if (adv.length !== 4) errs.push('canAdvance count');

const cname = (id) => site.companies.find((c) => c.id === id)?.shortName ?? id;
const real = tasks.filter((t) => !t.summary);
console.log(`tasks: ${tasks.length} (summary ${tasks.length - real.length}, work ${real.length}), milestones: ${schedule.milestones.length}`);
console.log('status:', JSON.stringify(real.reduce((a, t) => ((a[t.status] = (a[t.status] || 0) + 1), a), {})));
console.log('\n== 11/12 active (by company) ==');
for (const c of Object.keys(got)) {
  console.log(`${cname(c)} (${c}) total ${got[c]}名`);
  for (const t of active.filter((t) => t.companyId === c)) console.log(`   ${t.id} ${t.name} ${t.start}~${t.end} ${t.workers}名 ${t.outdoor ? '屋外' : '屋内'} [${t.status}]`);
}
console.log('\n== delayed ==');
for (const t of delayed) console.log(`${t.id} ${t.name} ${cname(t.companyId)} baseline ${t.baselineStart}~${t.baselineEnd} -> ${t.start}~${t.end} ${t.progress}% ${t.workers}名 ${t.outdoor ? '屋外' : '屋内'}`);
console.log('\n== canAdvance=true ==');
for (const t of adv) console.log(`${t.id} ${t.name} ${cname(t.companyId)} ${t.start}~${t.end} ${t.workers}名`);
console.log('\n== not_started indoor, canAdvance=false, unfinished deps ==');
for (const t of real.filter((t) => t.status === 'not_started' && !t.outdoor && !t.canAdvance && t.dependsOn.some((x) => byId[x].status !== 'done')))
  console.log(`${t.id} ${t.name} ${t.start}~${t.end}`);

if (errs.length) { console.error('\nERRORS:\n' + errs.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(root, 'data/schedule.json'), JSON.stringify(schedule, null, 2) + '\n');
console.log('\nOK: wrote data/schedule.json');
