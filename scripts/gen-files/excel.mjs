// Excel（富士空調の日報、日報まとめ、作業員名簿）
// 日付は文字列で入れる（サーバーのプレビューが Date を UTC で切るため）
import ExcelJS from "exceljs";

const thin = { style: "thin", color: { argb: "FF555555" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const FONT = "Yu Gothic";

function newBook(creator) {
  const wb = new ExcelJS.Workbook();
  wb.creator = creator;
  wb.created = new Date("2026-11-10T09:00:00+09:00");
  wb.modified = wb.created;
  return wb;
}

// ---------------------------------------------------------------- 富士空調システム 作業日報（自社様式）
export async function kuchoNippo(out, d) {
  const wb = newBook("富士空調システム 木村");
  const ws = wb.addWorksheet("作業日報", { pageSetup: { paperSize: 9, orientation: "portrait" } });
  ws.columns = [{ width: 5 }, { width: 16 }, { width: 34 }, { width: 10 }, { width: 14 }, { width: 30 }];
  ws.getCell("A1").value = "作　業　日　報";
  ws.getCell("A1").font = { name: FONT, size: 18, bold: true };
  // セル結合はプレビューで値が重複表示されるので使わない
  ws.getCell("F2").value = "富士空調システム株式会社";
  ws.getCell("F2").font = { name: FONT, size: 11, bold: true, color: { argb: "FF1F5F99" } };
  ws.getCell("F2").alignment = { horizontal: "right" };

  const head = [
    ["提出先", "東都建設株式会社　港南三丁目作業所　御中"],
    ["現場名", "（仮称）港南三丁目オフィスビル新築工事　空調設備工事"],
    ["作業日", d.date, "天候", d.weather],
    ["記入者", "現場代理人　木村 聡", "作業時間", d.time],
  ];
  let r = 3;
  for (const h of head) {
    const row = ws.getRow(r);
    row.getCell(1).value = h[0];
    row.getCell(3).value = h[1];
    if (h.length > 2) { row.getCell(4).value = h[2]; row.getCell(5).value = h[3]; }
    for (let c = 1; c <= 6; c++) { row.getCell(c).border = border; row.getCell(c).font = { name: FONT, size: 10.5 }; }
    row.getCell(1).fill = fill("FFDDEBF7");
    if (h.length > 2) row.getCell(4).fill = fill("FFDDEBF7");
    r++;
  }
  r++;
  const hdr = ws.getRow(r);
  ["No", "作業場所", "作業内容", "作業員数", "作業時間", "備考"].forEach((v, i) => {
    const c = hdr.getCell(i + 1);
    c.value = v; c.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = fill("FF1F5F99"); c.border = border; c.alignment = { horizontal: "center" };
  });
  r++;
  const first = r;
  d.items.forEach((it, i) => {
    const row = ws.getRow(r++);
    [i + 1, it.place, it.work, it.n, it.time, it.note].forEach((v, k) => {
      const c = row.getCell(k + 1); c.value = v; c.border = border; c.font = { name: FONT, size: 10.5 };
      c.alignment = { vertical: "middle", wrapText: true, horizontal: k === 0 || k === 3 ? "center" : "left" };
    });
    row.height = 30;
  });
  for (let k = 0; k < 3; k++) { const row = ws.getRow(r++); for (let c = 1; c <= 6; c++) row.getCell(c).border = border; }
  const last = r - 1;
  const tot = ws.getRow(r++);
  tot.getCell(3).value = "合計";
  tot.getCell(4).value = { formula: `SUM(D${first}:D${last})`, result: d.items.reduce((s, x) => s + x.n, 0) };
  for (let c = 1; c <= 6; c++) { tot.getCell(c).border = border; tot.getCell(c).font = { name: FONT, bold: true }; }
  tot.getCell(3).alignment = { horizontal: "right" }; tot.getCell(4).alignment = { horizontal: "center" };
  r++;
  for (const [k, v] of [["翌日予定", d.next], ["連絡事項", d.notes], ["安全", d.safety]]) {
    const row = ws.getRow(r);
    row.getCell(1).value = k;
    row.getCell(3).value = v;
    row.height = 44;
    for (let c = 1; c <= 6; c++) { row.getCell(c).border = border; row.getCell(c).font = { name: FONT, size: 10.5 }; row.getCell(c).alignment = { vertical: "middle", wrapText: true }; }
    row.getCell(1).fill = fill("FFDDEBF7");
    r++;
  }
  await wb.xlsx.writeFile(out);
}

// ---------------------------------------------------------------- 日報まとめ（AI が作る形の手本）
export async function matome(out, rows, creator = "東都建設 佐藤") {
  const wb = newBook(creator);
  const ws = wb.addWorksheet("日報まとめ");
  ws.columns = [
    { header: "日付", key: "date", width: 12 },
    { header: "会社", key: "co", width: 20 },
    { header: "作業内容", key: "work", width: 48 },
    { header: "人数", key: "n", width: 8 },
    { header: "出典", key: "src", width: 30 },
  ];
  ws.getRow(1).eachCell((c) => { c.font = { name: FONT, bold: true }; c.fill = fill("FFE2EFDA"); c.border = border; c.alignment = { horizontal: "center" }; });
  for (const x of rows) ws.addRow({ date: x[0], co: x[1], work: x[2], n: x[3], src: x[4] });
  const total = rows.reduce((s, x) => s + x[3], 0);
  ws.addRow({ date: "", co: "合計", work: "", n: total, src: "" });
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = border; c.font = { name: FONT, size: 10.5, bold: i === rows.length + 2 };
      c.alignment = { vertical: "middle", wrapText: true, horizontal: col === 4 ? "center" : "left" };
    });
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  await wb.xlsx.writeFile(out);
}

// ---------------------------------------------------------------- 作業員名簿
export async function meibo(out) {
  const wb = newBook("東都建設 高橋");
  const ws = wb.addWorksheet("作業員名簿 2026-11");
  ws.columns = [
    { header: "No", width: 5 }, { header: "会社名", width: 20 }, { header: "氏名", width: 12 }, { header: "ふりがな", width: 16 },
    { header: "職種", width: 10 }, { header: "年齢", width: 6 }, { header: "血液型", width: 7 }, { header: "健康診断日", width: 12 },
    { header: "主な資格", width: 30 }, { header: "入場日", width: 12 },
  ];
  const data = [
    ["北斗鳶工業", "松本 剛", "まつもと つよし", "鳶工（職長）", 46, "A", "2026-04-12", "足場の組立て等作業主任者、玉掛け", "2025-10-01"],
    ["北斗鳶工業", "上野 修平", "うえの しゅうへい", "鳶工", 33, "O", "2026-04-12", "足場の組立て等作業主任者", "2025-10-01"],
    ["北斗鳶工業", "小松 大地", "こまつ だいち", "鳶工", 28, "B", "2026-05-20", "フルハーネス特別教育", "2026-11-02"],
    ["三光電設", "井上 拓也", "いのうえ たくや", "電工（職長）", 41, "A", "2026-03-08", "第一種電気工事士、職長教育", "2026-01-15"],
    ["三光電設", "宮本 涼", "みやもと りょう", "電工", 35, "AB", "2026-03-08", "第二種電気工事士", "2026-01-15"],
    ["三光電設", "中野 翼", "なかの つばさ", "電工", 22, "O", "2026-06-02", "第二種電気工事士", "2026-11-05"],
    ["富士空調システム", "木村 聡", "きむら さとし", "現場代理人", 49, "B", "2026-02-18", "1級管工事施工管理技士", "2026-02-02"],
    ["富士空調システム", "西村 健", "にしむら けん", "ダクト工", 37, "A", "2026-02-18", "玉掛け、高所作業車", "2026-11-09"],
    ["富士空調システム", "岡本 誠也", "おかもと せいや", "配管工", 29, "O", "2026-07-11", "ガス溶接技能講習", "2026-11-10"],
    ["東邦内装", "清水 隆", "しみず たかし", "内装工（職長）", 52, "A", "2026-04-01", "職長教育、石綿作業主任者", "2026-05-11"],
    ["東邦内装", "大野 浩", "おおの ひろし", "内装工", 44, "A", "2026-04-01", "", "2026-05-11"],
    ["東邦内装", "川口 健太", "かわぐち けんた", "内装工", 31, "B", "2026-04-01", "", "2026-05-11"],
    ["東邦内装", "吉田 光", "よしだ ひかる", "内装工", 24, "O", "2026-08-21", "", "2026-11-02"],
    ["東邦内装", "石川 学", "いしかわ まなぶ", "内装工", 38, "AB", "2026-04-01", "", "2026-06-01"],
    ["東邦内装", "森下 誠", "もりした まこと", "内装工", 27, "A", "2026-04-01", "", "2026-06-01"],
    ["青葉設備工業", "林 和也", "はやし かずや", "配管工（職長）", 45, "O", "2026-05-09", "職長教育、酸欠危険作業主任者", "2026-03-02"],
    ["青葉設備工業", "松田 亮", "まつだ りょう", "配管工", 34, "B", "2026-05-09", "", "2026-03-02"],
    ["青葉設備工業", "佐々木 純", "ささき じゅん", "配管工", 26, "A", "2026-05-09", "", "2026-10-19"],
    ["光陽塗装", "山口 誠", "やまぐち まこと", "塗装工（職長）", 50, "A", "2026-03-27", "有機溶剤作業主任者", "2026-09-01"],
    ["光陽塗装", "福田 勝", "ふくだ まさる", "塗装工", 52, "O", "2026-03-27", "", "2026-11-04"],
    ["光陽塗装", "村上 浩", "むらかみ ひろし", "塗装工", 39, "A", "2026-03-27", "", "2026-11-04"],
    ["新栄外構", "山下 浩", "やました ひろし", "土工（職長）", 47, "B", "2026-06-15", "車両系建設機械（整地）", "2026-10-01"],
    ["新栄外構", "原 拓真", "はら たくま", "土工", 31, "A", "2026-06-15", "小型移動式クレーン", "2026-11-04"],
    ["新栄外構", "久保 亮介", "くぼ りょうすけ", "土工", 45, "O", "2026-06-15", "", "2026-11-04"],
    ["明和サッシ", "池田 修", "いけだ おさむ", "サッシ工（職長）", 43, "A", "2026-05-30", "玉掛け", "2026-10-19"],
  ];
  data.forEach((d, i) => ws.addRow([i + 1, ...d]));
  ws.getRow(1).eachCell((c) => { c.font = { name: FONT, bold: true }; c.fill = fill("FFFCE4D6"); c.border = border; });
  ws.eachRow((row, i) => { if (i > 1) row.eachCell({ includeEmpty: true }, (c) => { c.border = border; c.font = { name: FONT, size: 10 }; }); });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  await wb.xlsx.writeFile(out);
}

// ---------------------------------------------------------------- 安全書類 提出状況一覧（事務 高橋）
export async function teishutsu(out) {
  const wb = newBook("東都建設 高橋");
  const ws = wb.addWorksheet("提出状況 2026-11");
  ws.columns = [
    { header: "会社名", width: 20 }, { header: "作業員名簿", width: 12 }, { header: "新規入場者 書類", width: 15 },
    { header: "持込機械届", width: 12 }, { header: "火気使用届", width: 12 }, { header: "有機溶剤 使用届", width: 15 },
    { header: "最終確認日", width: 12 }, { header: "備考", width: 40 },
  ];
  const data = [
    ["北斗鳶工業", "済", "済", "済", "—", "—", "2026-11-02", ""],
    ["三光電設", "済", "済", "済", "済", "—", "2026-11-05", "11/15 切替作業の作業員追加分 → 11/13 までに提出依頼中"],
    ["富士空調システム", "済", "済", "未", "済", "—", "2026-11-10", "11/18 揚重のラフター持込機械届 未提出（大江戸クレーン分）"],
    ["東邦内装", "済", "済", "済", "—", "済", "2026-11-10", "新規2名（11/12 教育受講予定）書類受領"],
    ["青葉設備工業", "済", "—", "済", "済", "—", "2026-10-29", ""],
    ["光陽塗装", "済", "済", "済", "—", "済", "2026-11-04", "福田・村上 11/4 受講済み"],
    ["新栄外構", "済", "済", "済", "—", "—", "2026-11-04", "11/13 土間打設の作業員 追加なし（確認済み）"],
    ["明和サッシ", "済", "—", "済", "—", "—", "2026-10-19", ""],
    ["ミツワ昇降機", "済", "—", "済", "済", "—", "2026-11-10", "2号機 作業員名簿 更新版 11/10 受領"],
    ["山王インテリア", "済", "済", "—", "—", "済", "2026-11-02", ""],
  ];
  data.forEach((d) => ws.addRow(d));
  ws.addRow([]);
  ws.addRow(["凡例：済＝受領・確認済み／未＝未提出／—＝該当なし"]);
  ws.getRow(1).eachCell((c) => { c.font = { name: FONT, bold: true }; c.fill = fill("FFFCE4D6"); c.border = border; c.alignment = { horizontal: "center", wrapText: true }; });
  ws.eachRow((row, i) => {
    if (i === 1 || i > data.length + 1) return;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = border; c.font = { name: FONT, size: 10, color: c.value === "未" ? { argb: "FFC00000" } : undefined, bold: c.value === "未" };
      c.alignment = { vertical: "middle", wrapText: true, horizontal: col >= 2 && col <= 6 ? "center" : "left" };
    });
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  await wb.xlsx.writeFile(out);
}
