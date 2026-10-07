// ストレージのファイル本体（files/ 配下）と台帳 data/storage.json を作り直す。
//   npm run gen:files
// 必要なもの：Chrome か Edge（puppeteer-core で HTML → PNG/PDF を描画）、exceljs
// 出力は毎回同じ内容になる（乱数はシード固定）。files/ 配下は作り直す。
import { mkdirSync, rmSync, writeFileSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser, closeBrowser } from "./gen-files/render.mjs";
import { renderPhoto } from "./gen-files/photos.mjs";
import * as docs from "./gen-files/docs.mjs";
import * as xl from "./gen-files/excel.mjs";
import { TEIREI_1110_TXT, TEIREI_1103_TXT } from "./gen-files/transcripts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), "utf8")) : null);
const site = readJson("data/site.json");
const schedule = readJson("data/schedule.json");

const FOLDERS = [
  { id: "fo-root", name: "港南三丁目現場", parentId: null },
  { id: "fo-zumen", name: "01_図面", parentId: "fo-root" },
  { id: "fo-teirei", name: "02_定例会議", parentId: "fo-root" },
  { id: "fo-nippo", name: "03_日報", parentId: "fo-root" },
  { id: "fo-nippo-202610", name: "2026-10", parentId: "fo-nippo" },
  { id: "fo-nippo-202611", name: "2026-11", parentId: "fo-nippo" },
  { id: "fo-anzen", name: "04_安全書類", parentId: "fo-root" },
  { id: "fo-photo", name: "05_工事写真", parentId: "fo-root" },
  { id: "fo-photo-202610", name: "2026-10", parentId: "fo-photo" },
  { id: "fo-photo-202611", name: "2026-11", parentId: "fo-photo" },
  { id: "fo-koutei", name: "06_工程表", parentId: "fo-root" },
  { id: "fo-shiryo", name: "07_打合せ資料", parentId: "fo-root" },
];

const MIME = { png: "image/png", pdf: "application/pdf", txt: "text/plain", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const T = (s) => `2026-${s}:00+09:00`; // "11-10T18:30" → ISO

// ---- 写真（工事黒板の中身）----
const PROJECT = "港南三丁目オフィスビル新築工事";
const patrol = (no, place, what, co, scene, args, time) => ({
  board: { 工事名: PROJECT, 工種: `安全パトロール（指摘${"①②③④⑤⑥"[no - 1]}）`, 場所: place, 内容: `${what}\n${co}`, 日付: "2026年11月6日", 撮影: "東都建設 伊藤" },
  scene, args, stamp: `2026/11/06 ${time}`,
});

// 10月分 進捗写真（外観全景＋2工区の内装が中心）。11/4 17:20〜 に佐藤さんがまとめて格納（mail-011）
const OCT_PHOTOS = [
  ["1016", "6F", "サッシ・ガラス取付 完了", "建具工事", "明和サッシ", "sash", { glass: true }, "15:40", "小林"],
  ["1022", "7F", "サッシ取付 施工状況", "建具工事", "明和サッシ", "sash", { glass: false }, "10:15", "小林"],
  ["1023", "9F", "LGS下地 完了", "内装工事", "東邦内装", "lgs", undefined, "16:05", "小林"],
  ["1026", "5F", "天井ボード張り 着手", "内装工事", "東邦内装", "ceilingBoard", { done: 0.25 }, "13:30", "小林"],
  ["1027", "6F", "空調ダクト・冷媒配管 施工状況", "空調設備工事", "富士空調システム", "duct", { pipes: false }, "11:20", "中村"],
  ["1028", "8F", "給排水配管 施工状況", "衛生設備工事", "青葉設備工業", "duct", { pipes: true }, "14:10", "中村"],
  ["1029", "7F", "幹線ケーブル入線 着手", "電気設備工事", "三光電設", "rack", { cables: 1 }, "15:00", "中村"],
  ["1029", "5F", "天井ボード張り 施工状況", "内装工事", "東邦内装", "ceilingBoard", { done: 0.6 }, "16:20", "小林"],
  ["1030", "外部 東面", "外観全景（足場・メッシュシート）", "仮設工事", "北斗鳶工業", "facade", { side: "東面", seed: 4 }, "09:10", "佐藤"],
  ["1030", "外部 南面", "外観全景（足場・メッシュシート）", "仮設工事", "北斗鳶工業", "facade", { side: "南面", seed: 9 }, "09:20", "佐藤"],
  ["1030", "7F", "幹線ケーブル入線 施工状況", "電気設備工事", "三光電設", "rack", { cables: 3 }, "14:40", "佐藤"],
  ["1030", "9F", "空調ダクト吊込み 施工状況", "空調設備工事", "富士空調システム", "duct", { pipes: false }, "15:30", "佐藤"],
].map(([md, place, what, kind, co, scene, args, time, shot], i) => {
  const no = String(i + 1).padStart(2, "0");
  const [m, d] = [md.slice(0, 2), md.slice(2)];
  const safe = place.replace(/\s/g, "") + "_" + what.replace(/[\s（）・]/g, "");
  return {
    id: "f-photo-202610-" + no, name: "2026" + md + "_進捗" + no + "_" + safe + ".png", folderId: "fo-photo-202610", dir: "photo/2026-10",
    updatedAt: T("11-04T17:" + String(20 + i).padStart(2, "0")), by: "u-sato",
    photo: { scene, args, stamp: "2026/" + m + "/" + d + " " + time, board: { 工事名: PROJECT, 工種: kind, 場所: place, 内容: what + "\n" + co, 日付: "2026年" + Number(m) + "月" + Number(d) + "日", 撮影: "東都建設 " + shot } },
  };
});

const FILES = [
  // ===== 02_定例会議 =====
  { id: "f-teirei-1110-txt", name: "2026-11-10_工程定例_文字起こし.txt", folderId: "fo-teirei", dir: "teirei", updatedAt: T("11-10T18:30"), by: "u-ito",
    description: "11/10 工程定例の録音を自動文字起こししたもの（話者名は手動付与）", make: (p) => writeFileSync(p, TEIREI_1110_TXT, "utf8") },
  { id: "f-teirei-1103-txt", name: "2026-11-03_工程定例_文字起こし.txt", folderId: "fo-teirei", dir: "teirei", updatedAt: T("11-03T17:40"), by: "u-ito",
    description: "11/3 工程定例の文字起こし", make: (p) => writeFileSync(p, TEIREI_1103_TXT, "utf8") },
  { id: "f-teirei-1103-pdf", name: "2026-11-03_工程定例_議事録.pdf", folderId: "fo-teirei", dir: "teirei", updatedAt: T("11-04T09:20"), by: "u-ito",
    description: "11/3 工程定例の議事録（伊藤作成）", make: (p) => docs.teireiMinutes1103(p) },

  // ===== 05_工事写真 / 2026-11（パトロール指摘・是正）=====
  { id: "f-patrol-1106-01", name: "20261106_パトロール指摘01_2F東側_床開口.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T10:33"), by: "u-ito",
    photo: patrol(1, "2F 東側", "床開口部 養生不足", "北斗鳶工業", "opening", undefined, "10:31") },
  { id: "f-patrol-1106-02", name: "20261106_パトロール指摘02_3F廊下_消火器前.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T10:40"), by: "u-ito",
    photo: patrol(2, "3F 廊下", "消火器の前に資材仮置き", "東邦内装", "extinguisher", false, "10:38") },
  { id: "f-patrol-1106-03", name: "20261106_パトロール指摘03_6F_脚立天板.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T10:48"), by: "u-ito",
    photo: patrol(3, "6F", "脚立の天板に乗って作業", "三光電設", "ladder", undefined, "10:46") },
  { id: "f-patrol-1106-04", name: "20261106_パトロール指摘04_外部東面5層_手すり.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T10:55"), by: "u-ito",
    photo: patrol(4, "外部 東面 5層目", "足場の手すり 外れ", "北斗鳶工業", "scaffold", undefined, "10:53") },
  { id: "f-patrol-1106-05", name: "20261106_パトロール指摘05_1F電気室前_ケーブル.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T11:03"), by: "u-ito",
    photo: patrol(5, "1F 電気室前", "通路に仮設ケーブル散乱", "三光電設", "cables", false, "11:01") },
  { id: "f-patrol-1106-06", name: "20261106_パトロール指摘06_屋上_ガスボンベ.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T11:11"), by: "u-ito",
    photo: patrol(6, "屋上", "ガスボンベ 転倒防止なし", "富士空調システム", "roof", { cylinders: true, frames: 0 }, "11:09") },
  { id: "f-zesei-1106-01", name: "20261106_是正01_2F東側_床開口養生.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T14:19"), by: "u-matsumoto",
    photo: { scene: "openingFixed", stamp: "2026/11/06 14:12", board: { 工事名: PROJECT, 工種: "安全パトロール（是正①）", 場所: "2F 東側", 内容: "床開口部 養生・固定 完了\n北斗鳶工業", 日付: "2026年11月6日", 撮影: "北斗鳶工業 松本" } } },
  { id: "f-zesei-1106-02", name: "20261106_是正02_3F廊下_消火器前.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-06T13:04"), by: "u-shimizu",
    photo: { scene: "extinguisher", args: true, stamp: "2026/11/06 12:58", board: { 工事名: PROJECT, 工種: "安全パトロール（是正②）", 場所: "3F 廊下", 内容: "消火器前の資材 撤去\n（3F倉庫へ移動）東邦内装", 日付: "2026年11月6日", 撮影: "東邦内装 清水" } } },
  { id: "f-zesei-1107-05", name: "20261107_是正05_1F電気室前_ケーブル整理.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-07T10:14"), by: "u-inoue",
    photo: { scene: "cables", args: true, stamp: "2026/11/07 10:08", board: { 工事名: PROJECT, 工種: "安全パトロール（是正⑤）", 場所: "1F 電気室前", 内容: "仮設ケーブル 壁際へ整理・養生\n三光電設", 日付: "2026年11月7日", 撮影: "三光電設 井上" } } },
  // 進捗写真（フィラー）
  { id: "f-photo-1104-01", name: "20261104_6F_LGS下地_施工状況.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-04T16:05"), by: "u-kobayashi",
    photo: { scene: "lgs", stamp: "2026/11/04 14:20", board: { 工事名: PROJECT, 工種: "内装工事", 場所: "6F", 内容: "LGS下地 施工状況\n東邦内装", 日付: "2026年11月4日", 撮影: "東都建設 小林" } } },
  { id: "f-photo-1109-01", name: "20261109_北側通路_既設排水管_試掘.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-09T11:00"), by: "u-sato",
    photo: { scene: "trench", stamp: "2026/11/09 10:45", board: { 工事名: PROJECT, 工種: "外構工事", 場所: "北側通路", 内容: "既設排水管 位置確認（試掘）\n図面より約500mm北側", 日付: "2026年11月9日", 撮影: "東都建設 佐藤" } } },
  { id: "f-photo-1110-01", name: "20261110_屋上_室外機架台_据付状況.png", folderId: "fo-photo-202611", dir: "photo/2026-11", updatedAt: T("11-10T17:05"), by: "u-nakamura",
    photo: { scene: "roof", args: { cylinders: false, frames: 3, fx: 470 }, stamp: "2026/11/10 16:30", board: { 工事名: PROJECT, 工種: "空調設備工事", 場所: "屋上", 内容: "室外機架台 据付状況\n富士空調システム", 日付: "2026年11月10日", 撮影: "東都建設 中村" } } },

  // ===== 05_工事写真 / 2026-10（10月分 進捗写真12枚。mail-011 で佐藤さんが上田さんに案内）=====
  ...OCT_PHOTOS,

  // ===== 03_日報（過去のまとめ）=====
  { id: "f-nippo-matome-1030-xlsx", name: "日報まとめ_2026-10-30.xlsx", folderId: "fo-nippo-202610", dir: "nippo/2026-10", updatedAt: T("10-31T10:10"), by: "u-sato",
    description: "10/30 作業分の日報まとめ",
    make: (p) => xl.matome(p, [
      ["2026-10-30", "三光電設", "7F 幹線ケーブル入線", 4, "チャット（2工区）"],
      ["2026-10-30", "青葉設備工業", "2-3F 給水管 配管", 3, "チャット（1工区）"],
      ["2026-10-30", "東邦内装", "5F 天井ボード張り", 5, "メール添付（手書き日報の画像）"],
      ["2026-10-30", "富士空調システム", "9F ダクト吊込み", 4, "メール添付（Excel）"],
      ["2026-10-30", "光陽塗装", "1工区 2F 共用廊下 下塗り", 3, "メール添付（PDF）"],
    ]) },
  { id: "f-nippo-matome-1106-xlsx", name: "日報まとめ_2026-11-06.xlsx", folderId: "fo-nippo-202611", dir: "nippo/2026-11", updatedAt: T("11-07T10:30"), by: "u-takahashi",
    description: "11/6 作業分の日報まとめ（事務 高橋が取りまとめ）",
    make: (p) => xl.matome(p, [
      ["2026-11-06", "三光電設", "7F 幹線ケーブル入線（西側）、7F 天井内ラック 高さ調整", 5, "チャット（2工区）"],
      ["2026-11-06", "青葉設備工業", "3F 給水管 配管、2F 衛生器具 搬入・仮置き", 3, "チャット（1工区）"],
      ["2026-11-06", "東邦内装", "6F LGS下地、5F 天井ボード張り", 6, "メール添付（手書き日報の画像）"],
      ["2026-11-06", "富士空調システム", "9F ダクト吊込み", 4, "メール添付（Excel）"],
      ["2026-11-06", "光陽塗装", "1工区 2F 共用廊下 中塗り（東側）", 3, "メール添付（PDF）"],
    ], "東都建設 高橋") },
  { id: "f-nippo-matome-1109-xlsx", name: "日報まとめ_2026-11-09.xlsx", folderId: "fo-nippo-202611", dir: "nippo/2026-11", updatedAt: T("11-10T10:45"), by: "u-takahashi",
    description: "11/9 作業分の日報まとめ（事務 高橋が取りまとめ）",
    make: (p) => xl.matome(p, [
      ["2026-11-09", "三光電設", "7F 幹線ケーブル入線、6F EPS 支持金物 墨出し", 5, "チャット（2工区）"],
      ["2026-11-09", "青葉設備工業", "2-3F 給水管 耐圧試験 準備（水張り）、3F 排水管 配管", 3, "チャット（1工区）"],
      ["2026-11-09", "東邦内装", "6F LGS下地（ボード待ち）、5F 天井ボード張り", 6, "メール添付（手書き日報の画像）"],
      ["2026-11-09", "富士空調システム", "9F ダクト吊込み、屋上 架台 墨出し", 4, "メール添付（Excel）"],
      ["2026-11-09", "光陽塗装", "1工区 2F 共用廊下 中塗り（西側）", 3, "メール添付（PDF）"],
    ], "東都建設 高橋") },

  // ===== メール添付（日報）folderId null =====
  { id: "f-nippo-naiso-1110-png", name: "東邦内装_日報_1110.png", folderId: null, dir: "mail", updatedAt: T("11-11T07:28"), by: "u-shimizu",
    description: "東邦内装 11/10 作業日報（手書きをスキャン）", make: (p) => docs.naisoScan(p) },
  { id: "f-nippo-kucho-1110-xlsx", name: "作業日報_富士空調_20261110.xlsx", folderId: null, dir: "mail", updatedAt: T("11-11T08:05"), by: "u-kimura",
    description: "富士空調システム 11/10 作業日報",
    make: (p) => xl.kuchoNippo(p, {
      date: "2026年11月10日（火）", weather: "晴れ", time: "8:00〜17:00",
      items: [
        { place: "屋上", work: "室外機架台据付（ACP-1〜2 アンカー・架台組立）", n: 3, time: "8:00〜17:00", note: "11/18 室外機揚重予定" },
        { place: "9F", work: "空調ダクト吊込み（残り・9F完了）", n: 1, time: "8:00〜17:00", note: "" },
      ],
      next: "屋上 室外機架台据付（ACP-3〜4）　4名",
      notes: "11/12 8:30 室外機搬入（4tユニック2台、北側搬入口、1F仮置き）\n11/18 揚重の計画書は作成中",
      safety: "KY実施（屋上端部はフルハーネス・親綱使用）",
    }) },
  { id: "f-nippo-tosou-1110-pdf", name: "作業日報_光陽塗装_20261110.pdf", folderId: null, dir: "mail", updatedAt: T("11-11T08:20"), by: "u-yamaguchi",
    description: "光陽塗装 11/10 作業日報",
    make: (p) => docs.tosouNippo(p, {
      reportDate: "2026年11月11日", date: "2026年11月10日（火）", weather: "晴れ", time: "8:00〜17:00（休憩 12:00〜13:00）",
      items: [{ place: "1工区 2F 共用廊下", work: "壁面 中塗り（西側）※中塗り完了", n: 3, mat: "水性つや消し塗料（承認色 N-85）" }],
      total: 3, workers: ["山口 誠", "福田 勝", "村上 浩"],
      next: "2工区 外壁シーリング・タッチアップ（11/12〜、雨天時は要相談）",
      notes: "・KY実施（脚立使用時の天板作業禁止を再確認）<br>・養生テープ撤去、残材は2F仮置き場へ片付け済み<br>・上塗りは乾燥確認後、日程をご相談",
    }) },
  { id: "f-nippo-kucho-1105-xlsx", name: "作業日報_富士空調_20261105.xlsx", folderId: null, dir: "mail", updatedAt: T("11-06T08:10"), by: "u-kimura",
    description: "富士空調システム 11/5 作業日報",
    make: (p) => xl.kuchoNippo(p, {
      date: "2026年11月5日（木）", weather: "曇り", time: "8:00〜17:00",
      items: [
        { place: "9F", work: "空調ダクト吊込み（東側）", n: 3, time: "8:00〜17:00", note: "" },
        { place: "屋上", work: "室外機架台 墨出し・アンカー位置確認", n: 1, time: "13:00〜17:00", note: "" },
      ],
      next: "9F 空調ダクト吊込み　4名",
      notes: "屋上機器の搬入ルート図 受領（11/4）",
      safety: "KY実施",
    }) },
  { id: "f-nippo-tosou-1106-pdf", name: "作業日報_光陽塗装_20261106.pdf", folderId: null, dir: "mail", updatedAt: T("11-07T08:15"), by: "u-yamaguchi",
    description: "光陽塗装 11/6 作業日報",
    make: (p) => docs.tosouNippo(p, {
      reportDate: "2026年11月7日", date: "2026年11月6日（金）", weather: "晴れ", time: "8:00〜17:00（休憩 12:00〜13:00）",
      items: [{ place: "1工区 2F 共用廊下", work: "壁面 中塗り（東側）", n: 3, mat: "水性つや消し塗料" }],
      total: 3, workers: ["山口 誠", "福田 勝", "村上 浩"],
      next: "1工区 2F 共用廊下 中塗り（西側）",
      notes: "・KY実施<br>・共用廊下 塗装色見本を本日提出（承認待ち）",
    }) },
  // ===== メール添付（その他）=====
  { id: "f-mail-anzentaikai-pdf", name: "2026年末安全大会_開催案内.pdf", folderId: null, dir: "mail", updatedAt: T("10-30T15:50"), by: "u-saito",
    description: "本社 安全環境部 年末安全大会の開催案内", make: (p) => docs.anzenTaikai(p) },
  { id: "f-mail-shoninsho-3f-pdf", name: "設計変更承認書_3F会議室天井高.pdf", folderId: null, dir: "mail", updatedAt: T("11-11T09:45"), by: "u-morita",
    description: "3F会議室 天井高変更（CH2700→2600）の承認書。施工者欄は未記入", make: (p) => docs.shoninsho3F(p) },

  // ===== 01_図面 =====
  { id: "f-route-okujo-pdf", name: "屋上機器_搬入ルート図.pdf", folderId: "fo-zumen", dir: "zumen", updatedAt: T("11-04T11:40"), by: "u-sato",
    description: "屋上室外機の搬入・揚重ルート（富士空調へ送付）", make: (p) => docs.routeOkujo(p) },
  { id: "f-zumen-3f-pdf", name: "A-103_3階平面図_Rev3.pdf", folderId: "fo-zumen", dir: "zumen", updatedAt: T("11-09T17:20"), by: "u-kobayashi",
    description: "3階平面図（会議室A 天井高変更を反映）", make: (p) => docs.zumen3F(p) },
  { id: "f-zumen-ev-koutei-pdf", name: "EV据付工程表_改訂.pdf", folderId: "fo-zumen", dir: "zumen", updatedAt: T("10-30T11:10"), by: "u-abe",
    description: "ミツワ昇降機 EV据付工程表（改訂版。2号機 ガイドレール建込み 11/16〜）", make: (p) => docs.evKoutei(p) },
  { id: "f-zumen-6f-eps-pdf", name: "E-612_6階EPS詳細図.pdf", folderId: "fo-zumen", dir: "zumen", updatedAt: T("10-20T15:00"), by: "u-nakamura",
    description: "6F EPS 平面詳細・床開口", make: (p) => docs.zumen6FEps(p) },
  { id: "f-zumen-gaiko-haisui-pdf", name: "G-021_外構_北側通路_排水ルート図_Rev1.pdf", folderId: "fo-zumen", dir: "zumen", updatedAt: T("11-11T11:30"), by: "u-morita",
    description: "北側通路 既設排水管の実位置と変更ルート（森田設計の回答を反映）", make: (p) => docs.zumenGaikoHaisui(p) },
  // ===== 04_安全書類 =====
  { id: "f-anzen-meibo-xlsx", name: "作業員名簿_2026-11.xlsx", folderId: "fo-anzen", dir: "anzen", updatedAt: T("11-10T17:30"), by: "u-takahashi",
    description: "協力会社 作業員名簿（11月更新・事務 高橋が管理）", make: (p) => xl.meibo(p) },
  { id: "f-anzen-kyoiku-pdf", name: "新規入場者教育記録_2026-11.pdf", folderId: "fo-anzen", dir: "anzen", updatedAt: T("11-10T17:45"), by: "u-takahashi",
    description: "11/1〜11/10 の新規入場者教育記録（教育担当 伊藤、取りまとめ 高橋）", make: (p) => docs.kyoikuKiroku(p) },
  { id: "f-anzen-teishutsu-xlsx", name: "提出状況一覧_2026-11.xlsx", folderId: "fo-anzen", dir: "anzen", updatedAt: T("11-11T11:20"), by: "u-takahashi",
    description: "協力会社の安全書類 提出状況（事務 高橋）", make: (p) => xl.teishutsu(p) },
  // ===== 06_工程表 =====
  { id: "f-koutei-w46-pdf", name: "週間工程表_W46.pdf", folderId: "fo-koutei", dir: "koutei", updatedAt: T("11-09T08:00"), by: "u-sato",
    description: "11/9〜11/14 の週間工程表", make: (p) => docs.weeklySchedule(p, schedule, site) },
  // ===== 07_打合せ資料 =====
  { id: "f-shiryo-seshu-1104-pdf", name: "施主定例資料_第24回_2026-11-04.pdf", folderId: "fo-shiryo", dir: "shiryo", updatedAt: T("11-04T09:00"), by: "u-sato",
    description: "第24回 施主定例の配布資料", make: (p) => docs.shiryoSeshuTeirei(p) },
  { id: "f-shiryo-tenjo3f-pdf", name: "3F会議室_天井高変更_検討資料.pdf", folderId: "fo-shiryo", dir: "shiryo", updatedAt: T("11-06T16:40"), by: "u-kobayashi",
    description: "3F会議室A 天井高さ変更の検討資料（森田設計と打合せ用）", make: (p) => docs.shiryoTenjo3F(p) },
  { id: "f-shiryo-juhenden-pdf", name: "受変電設備_切替作業要領書_案.pdf", folderId: "fo-shiryo", dir: "shiryo", updatedAt: T("11-05T16:50"), by: "u-inoue",
    description: "三光電設 受変電設備 切替作業の要領書（案）", make: (p) => docs.youryouJuhenden(p) },
  { id: "f-shiryo-kyoiku-annai-pdf", name: "新規入場者教育_案内_1112.pdf", folderId: "fo-shiryo", dir: "shiryo", updatedAt: T("11-10T16:30"), by: "u-takahashi",
    description: "11/12（木）13:00〜 新規入場者教育の案内（事務 高橋）", make: (p) => docs.kyoikuAnnai(p) },
];

async function main() {
  const filesDir = join(ROOT, "files");
  rmSync(filesDir, { recursive: true, force: true });
  mkdirSync(filesDir, { recursive: true });
  writeFileSync(join(filesDir, ".gitkeep"), "");

  const people = new Set(site.people.map((p) => p.id));
  await openBrowser();
  const out = [];
  try {
    for (const f of FILES) {
      if (!people.has(f.by)) throw new Error(`${f.id}: 不明な人物 ${f.by}`);
      const rel = `files/${f.dir}/${f.name}`;
      const abs = join(ROOT, rel);
      mkdirSync(dirname(abs), { recursive: true });
      if (f.photo) await renderPhoto(abs, f.photo);
      else await f.make(abs);
      const ext = f.name.split(".").pop();
      const size = statSync(abs).size;
      out.push({ id: f.id, name: f.name, folderId: f.folderId, path: rel, mime: MIME[ext], size, updatedAt: f.updatedAt, updatedById: f.by,
        description: f.description ?? (f.photo ? `${f.photo.board.場所}　${f.photo.board.内容.replace(/\n/g, " ")}` : "") });
      console.log(`  ${f.id.padEnd(26)} ${String(size).padStart(8)}  ${rel}`);
    }
  } finally {
    await closeBrowser();
  }
  const storage = { rootName: "港南三丁目現場 共有フォルダ", folders: FOLDERS, files: out };
  writeFileSync(join(ROOT, "data/storage.json"), JSON.stringify(storage, null, 2) + "\n", "utf8");
  console.log(`data/storage.json: folders ${FOLDERS.length}, files ${out.length}`);

  // メール・チャットが参照している fileId の登録漏れチェック
  const ids = new Set(out.map((f) => f.id));
  for (const sec of ["mail", "chat"]) {
    const txt = existsSync(join(ROOT, `data/${sec}.json`)) ? readFileSync(join(ROOT, `data/${sec}.json`), "utf8") : "";
    const missing = [...new Set([...txt.matchAll(/"fileId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))].filter((id) => !ids.has(id));
    if (missing.length) console.warn(`!! data/${sec}.json が参照しているが未登録: ${missing.join(", ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
