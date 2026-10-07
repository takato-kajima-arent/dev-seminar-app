// PDF（議事録・日報・図面・安全書類・工程表・打合せ資料・メール添付）と、手書き日報スキャン PNG
import { renderPdf, renderPng, esc, rng } from "./render.mjs";

const DOC_CSS = `
  @page { margin: 0; }
  body { font-family: "Yu Gothic", "BIZ UDGothic", "Meiryo", sans-serif; color: #111; font-size: 10.5pt; }
  .page { padding: 16mm 16mm 14mm; }
  h1 { font-size: 18pt; text-align: center; letter-spacing: .3em; margin: 0 0 6mm; font-weight: 700; }
  h2 { font-size: 11.5pt; margin: 5mm 0 2mm; border-left: 4px solid #333; padding-left: 6px; }
  table.t { width: 100%; border-collapse: collapse; }
  table.t th, table.t td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
  table.t th { background: #eee; font-weight: 600; white-space: nowrap; }
  .r { text-align: right; } .c { text-align: center; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 4mm; font-size: 10pt; }
  .small { font-size: 8.5pt; color: #444; }
  .stamp { display: inline-flex; align-items: center; justify-content: center; width: 15mm; height: 15mm; border: 2px solid #c62828; border-radius: 50%; color: #c62828; font-weight: 700; font-family: "Yu Mincho", serif; font-size: 10pt; transform: rotate(-8deg); }
  .box { border: 1px solid #333; display: inline-block; }
`;

const pdf = (body, out, opts) => renderPdf(body, DOC_CSS, out, opts);
const rows = (arr) => arr.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");

// ---------------------------------------------------------------- 定例 議事録（11/03）
export async function teireiMinutes1103(out) {
  const body = `<div class="page">
  <div class="meta"><span>東都建設株式会社　港南三丁目作業所</span><span>文書No. KT-定例-045</span></div>
  <h1>工程定例 議事録</h1>
  <table class="t">
    <tr><th>工事名</th><td colspan="3">（仮称）港南三丁目オフィスビル新築工事</td></tr>
    <tr><th>日時</th><td>2026年11月3日（火・祝）15:00〜15:35<br><span class="small">※文化の日のため作業は休工、工程定例のみ実施</span></td><th>場所</th><td>現場事務所 2F 会議室</td></tr>
    <tr><th>出席者</th><td colspan="3">東都建設：山本（所長）、佐藤、中村、小林、伊藤<br>協力会社：三光電設 井上、富士空調システム 木村、東邦内装 清水、北斗鳶工業 松本、青葉設備工業 林、新栄外構 山下、光陽塗装 山口</td></tr>
    <tr><th>記録</th><td>伊藤</td><th>配布</th><td>出席者各位（作業所内共有フォルダ）</td></tr>
  </table>
  <h2>1. 全体連絡</h2>
  <ul>
    <li>他現場で脚立からの転落災害あり。脚立の天板・天板1段下での作業禁止を各社で再周知すること。</li>
    <li>11/19（木）1工区 施主検査に決定（港南不動産開発 上田様、森田設計 森田様 立会い）。1工区の各社は手直しを事前に完了させること。</li>
    <li>受変電設備の切替日は 11/15（日）で調整中。確定次第連絡する。</li>
  </ul>
  <h2>2. 各工区の状況</h2>
  <table class="t">
    <tr><th style="width:16mm">工区</th><th style="width:36mm">会社</th><th>状況・予定</th></tr>
    ${rows([
      ["2工区", "東邦内装", "6F LGS下地 本格着手。石膏ボードはメーカー納期回答待ち。"],
      ["2工区", "三光電設", "6F EPS 支持金物 11/4〜。7F 幹線 入線中、8F は 11/9〜。"],
      ["3工区", "富士空調システム", "9F ダクト吊込み継続。屋上 室外機架台 11/10〜。搬入ルート図を元請に依頼。"],
      ["1工区", "青葉設備工業", "2-3F 給水管 配管は今週完了。耐圧試験日は別途調整。"],
      ["1工区", "光陽塗装", "2F 共用廊下 中塗り 11/4〜。"],
      ["外構", "新栄外構", "北側通路 舗装下地 11/4 着手。南側駐輪場 路盤 並行。"],
      ["外部", "北斗鳶工業", "変更なし。東面 足場一部解体は 11/20〜 予定どおり。"],
    ])}
  </table>
  <h2>3. 決定事項・宿題</h2>
  <table class="t">
    <tr><th style="width:8mm">No</th><th>内容</th><th style="width:30mm">担当</th><th style="width:22mm">期限</th></tr>
    ${rows([
      ["1", "安全パトロールを実施する（10:30〜、各社職長は可能な限り同行）", "東都建設 伊藤", "11/6（金）"],
      ["2", "2F 共用廊下 上塗りの色見本を提出する", "光陽塗装", "11/6（金）"],
      ["3", "6F 石膏ボードの納期をメーカーに確認し、結果を報告する", "東邦内装", "11/5（木）"],
      ["4", "北側通路 舗装下地に着手する（搬入動線と誘導員配置は朝礼で確認）", "新栄外構", "11/4（水）"],
      ["5", "屋上機器の搬入ルート図を作成し、富士空調へ送付する", "東都建設 佐藤", "11/4（水）"],
    ])}
  </table>
  <h2>4. 次回</h2>
  <p>2026年11月10日（火）15:00〜　現場事務所 2F 会議室</p>
  <p class="small r">以上　（作成：2026/11/04 伊藤）</p>
</div>`;
  await pdf(body, out);
}

// ---------------------------------------------------------------- 光陽塗装 PDF 日報
export async function tosouNippo(out, d) {
  const body = `<div class="page" style="padding:14mm 15mm">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px double #e67e22;padding-bottom:3mm;margin-bottom:5mm">
    <div><div style="font-size:9pt;color:#e67e22;font-weight:700">KOYO TOSOU</div><div style="font-size:13pt;font-weight:700">光陽塗装株式会社</div></div>
    <div style="font-size:20pt;font-weight:700;letter-spacing:.4em">作業日報</div>
    <div class="small r">東京都大田区（架空）<br>TEL 03-0000-0000</div>
  </div>
  <table class="t">
    <tr><th style="width:26mm">提出先</th><td>東都建設株式会社　港南三丁目作業所　御中</td><th style="width:20mm">報告日</th><td style="width:34mm">${d.reportDate}</td></tr>
    <tr><th>工事名</th><td colspan="3">（仮称）港南三丁目オフィスビル新築工事　塗装工事</td></tr>
    <tr><th>作業日</th><td>${d.date}</td><th>天候</th><td>${d.weather}</td></tr>
    <tr><th>作業時間</th><td colspan="3">${d.time}</td></tr>
  </table>
  <h2>作業内容</h2>
  <table class="t">
    <tr><th style="width:10mm">No</th><th style="width:42mm">工区・場所</th><th>作業内容</th><th style="width:18mm">人数</th><th style="width:36mm">使用材料</th></tr>
    ${d.items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${it.place}</td><td>${it.work}</td><td class="c">${it.n}名</td><td>${it.mat}</td></tr>`).join("")}
    ${Array.from({ length: 4 - d.items.length }, () => `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`).join("")}
    <tr><th colspan="3" class="r">合計人数</th><td class="c"><b>${d.total}名</b></td><td></td></tr>
  </table>
  <h2>作業員</h2>
  <table class="t"><tr>${d.workers.map((w) => `<td class="c">${w}</td>`).join("")}</tr></table>
  <h2>翌作業日の予定</h2>
  <table class="t"><tr><td style="height:16mm">${d.next}</td></tr></table>
  <h2>安全・特記事項</h2>
  <table class="t"><tr><td style="height:22mm">${d.notes}</td></tr></table>
  <div style="display:flex;justify-content:flex-end;gap:6mm;margin-top:8mm">
    <table class="t" style="width:auto"><tr><th>職長</th><th>元請確認</th></tr>
    <tr><td style="width:24mm;height:22mm" class="c"><span class="stamp">山口</span></td><td style="width:24mm"></td></tr></table>
  </div>
</div>`;
  await pdf(body, out);
}

// ---------------------------------------------------------------- 図面の枠（A3横）
function drawingSheet({ title, no, scale, date, svg, notes = [] }) {
  return `<div style="width:420mm;height:297mm;padding:10mm;position:relative">
  <div style="position:absolute;inset:10mm;border:2px solid #111"></div>
  <div style="position:absolute;inset:12mm;border:.6px solid #111"></div>
  <div style="position:absolute;left:14mm;top:14mm;width:392mm;height:240mm">${svg}</div>
  ${notes.length ? `<div style="position:absolute;left:16mm;bottom:16mm;font-size:9pt;line-height:1.6">${notes.map((n) => `<div>${esc(n)}</div>`).join("")}</div>` : ""}
  <table class="t" style="position:absolute;right:12mm;bottom:12mm;width:175mm;font-size:8.5pt;background:#fff">
    <tr><th>工事名</th><td colspan="3">（仮称）港南三丁目オフィスビル新築工事</td></tr>
    <tr><th>図面名</th><td colspan="3" style="font-size:12pt;font-weight:700">${esc(title)}</td></tr>
    <tr><th>図番</th><td>${esc(no)}</td><th>縮尺</th><td>${esc(scale)}</td></tr>
    <tr><th>作成</th><td>東都建設 港南三丁目作業所</td><th>日付</th><td>${esc(date)}</td></tr>
  </table>
</div>`;
}

const GRID = (xs, ys, w, h, labelsX, labelsY) => {
  let s = "";
  xs.forEach((x, i) => { s += `<line x1="${x}" y1="20" x2="${x}" y2="${h - 10}" stroke="#c0392b" stroke-width=".8" stroke-dasharray="12 4 2 4"/><circle cx="${x}" cy="14" r="9" fill="#fff" stroke="#111"/><text x="${x}" y="18" font-size="10" text-anchor="middle">${labelsX[i]}</text>`; });
  ys.forEach((y, i) => { s += `<line x1="20" y1="${y}" x2="${w - 10}" y2="${y}" stroke="#c0392b" stroke-width=".8" stroke-dasharray="12 4 2 4"/><circle cx="14" cy="${y}" r="9" fill="#fff" stroke="#111"/><text x="14" y="${y + 4}" font-size="10" text-anchor="middle">${labelsY[i]}</text>`; });
  return s;
};

// 屋上機器 搬入ルート図
export async function routeOkujo(out) {
  const svg = `<svg viewBox="0 -40 1480 940" width="100%" height="100%" font-family="Yu Gothic, Meiryo">
  <defs><marker id="ar" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#d35400"/></marker></defs>
  <text x="20" y="-10" font-size="22" font-weight="700">① 配置図（地上：搬入車両ルート・クレーン位置）</text>
  <rect x="40" y="70" width="680" height="760" fill="none" stroke="#555" stroke-width="2" stroke-dasharray="10 6"/>
  <text x="50" y="92" font-size="13" fill="#555">敷地境界（仮囲い）</text>
  <rect x="160" y="230" width="440" height="460" fill="#f2f2f2" stroke="#111" stroke-width="3"/>
  <text x="380" y="460" font-size="22" text-anchor="middle">建物（地上12階）</text>
  <rect x="300" y="150" width="160" height="80" fill="#fff4e0" stroke="#d35400" stroke-width="2"/>
  <text x="380" y="185" font-size="14" text-anchor="middle">クレーン据付位置</text><text x="380" y="205" font-size="13" text-anchor="middle">25tラフター（11/18）</text>
  <circle cx="380" cy="190" r="175" fill="none" stroke="#d35400" stroke-dasharray="6 6"/>
  <text x="560" y="140" font-size="13" fill="#d35400">作業半径 R=16m</text>
  <rect x="330" y="60" width="100" height="20" fill="#2e86c1"/><text x="440" y="76" font-size="15" font-weight="700" fill="#2e86c1">北側搬入口</text>
  <rect x="30" y="420" width="20" height="100" fill="#2e86c1"/><text x="60" y="475" font-size="14" fill="#2e86c1">西ゲート</text>
  <rect x="710" y="420" width="20" height="100" fill="#2e86c1"/><text x="620" y="410" font-size="14" fill="#2e86c1">東ゲート</text>
  <path d="M380 10 L380 140" stroke="#d35400" stroke-width="5" marker-end="url(#ar)"/>
  <text x="395" y="120" font-size="14" fill="#d35400">4tユニック 進入</text>
  <rect x="470" y="250" width="110" height="60" fill="#fdebd0" stroke="#d35400"/><text x="525" y="276" font-size="13" text-anchor="middle">1F 仮置き</text><text x="525" y="296" font-size="12" text-anchor="middle">（室外機 梱包のまま）</text>
  <path d="M440 200 L500 245" stroke="#d35400" stroke-width="3" marker-end="url(#ar)"/>
  <text x="20" y="870" font-size="13">N ↑</text>
  <text x="760" y="40" font-size="22" font-weight="700">② 屋上伏図（荷取り・据付位置）</text>
  <rect x="790" y="80" width="640" height="560" fill="#fafafa" stroke="#111" stroke-width="3"/>
  <rect x="800" y="90" width="620" height="540" fill="none" stroke="#111" stroke-dasharray="4 4"/>
  <text x="1110" y="625" font-size="12" text-anchor="middle">パラペット</text>
  <rect x="900" y="100" width="220" height="90" fill="#fff4e0" stroke="#d35400" stroke-width="2"/><text x="1010" y="140" font-size="15" text-anchor="middle">荷取りステージ</text><text x="1010" y="162" font-size="12" text-anchor="middle">（開口養生・手すり設置）</text>
  ${[0, 1, 2, 3].map((i) => `<rect x="${880 + i * 130}" y="300" width="110" height="160" fill="#d6eaf8" stroke="#2e86c1" stroke-width="2"/><text x="${935 + i * 130}" y="385" font-size="14" text-anchor="middle">室外機架台</text><text x="${935 + i * 130}" y="405" font-size="13" text-anchor="middle">ACP-${i + 1}</text>`).join("")}
  <path d="M1010 190 L1010 290" stroke="#d35400" stroke-width="4" marker-end="url(#ar)"/>
  <rect x="1300" y="480" width="110" height="130" fill="#eee" stroke="#111"/><text x="1355" y="550" font-size="13" text-anchor="middle">EV機械室</text>
  <rect x="820" y="500" width="120" height="110" fill="#eee" stroke="#111"/><text x="880" y="560" font-size="13" text-anchor="middle">階段室</text>
  <text x="790" y="680" font-size="15">【搬入手順】</text>
  <text x="790" y="705" font-size="13">1. 11/12 8:30　4tユニック2台で北側搬入口より搬入、1F仮置き（シート養生）</text>
  <text x="790" y="728" font-size="13">2. 11/18　25tラフターを北側に据付、荷取りステージへ揚重</text>
  <text x="790" y="751" font-size="13">3. 屋上はハンドリフト・チェーンブロックで架台まで小運搬、据付</text>
  <text x="790" y="774" font-size="13">4. 吊荷の下は立入禁止（北側通路は揚重中 通行止め、誘導員2名）</text>
  <text x="790" y="806" font-size="12" fill="#c0392b">※揚重計画書は富士空調システムより別途提出のこと</text>
</svg>`;
  await pdf(drawingSheet({ title: "屋上機器 搬入ルート図", no: "KT-仮-031", scale: "1/300（参考）", date: "2026.11.04", svg }), out, { format: "A3", landscape: true });
}

// 3F 平面図
export async function zumen3F(out) {
  const xs = [80, 330, 580, 830, 1080, 1330], ys = [80, 340, 600];
  let svg = `<svg viewBox="0 0 1420 760" width="100%" height="100%" font-family="Yu Gothic, Meiryo">`;
  svg += GRID(xs, ys, 1420, 700, ["X1", "X2", "X3", "X4", "X5", "X6"], ["Y1", "Y2", "Y3"]);
  svg += `<rect x="80" y="80" width="1250" height="520" fill="none" stroke="#111" stroke-width="5"/>`;
  for (const x of xs) for (const y of ys) svg += `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" fill="#111"/>`;
  svg += `<rect x="80" y="80" width="500" height="260" fill="#fdf2e9" stroke="#111" stroke-width="2.5"/><text x="330" y="200" font-size="22" text-anchor="middle" font-weight="700">会議室A</text><text x="330" y="230" font-size="15" text-anchor="middle" fill="#c0392b">CH=2,600（変更）</text><text x="330" y="252" font-size="12" text-anchor="middle" fill="#888">旧 CH=2,700</text>`;
  svg += `<rect x="580" y="80" width="250" height="260" fill="none" stroke="#111" stroke-width="2.5"/><text x="705" y="215" font-size="18" text-anchor="middle">会議室B</text>`;
  svg += `<rect x="830" y="80" width="500" height="260" fill="none" stroke="#111" stroke-width="2.5"/><text x="1080" y="215" font-size="18" text-anchor="middle">事務室</text>`;
  svg += `<rect x="80" y="340" width="1250" height="80" fill="#f4f6f7" stroke="#111" stroke-width="1.5"/><text x="705" y="386" font-size="16" text-anchor="middle">廊下</text>`;
  svg += `<rect x="80" y="420" width="250" height="180" fill="none" stroke="#111" stroke-width="2.5"/><text x="205" y="515" font-size="16" text-anchor="middle">EV</text>`;
  svg += `<rect x="330" y="420" width="250" height="180" fill="none" stroke="#111" stroke-width="2.5"/><text x="455" y="515" font-size="16" text-anchor="middle">階段</text>`;
  svg += `<rect x="580" y="420" width="250" height="180" fill="none" stroke="#111" stroke-width="2.5"/><text x="705" y="505" font-size="16" text-anchor="middle">トイレ</text>`;
  svg += `<rect x="830" y="420" width="120" height="180" fill="none" stroke="#111" stroke-width="2.5"/><text x="890" y="515" font-size="14" text-anchor="middle">EPS</text>`;
  svg += `<rect x="950" y="420" width="380" height="180" fill="none" stroke="#111" stroke-width="2.5"/><text x="1140" y="515" font-size="16" text-anchor="middle">倉庫・給湯室</text>`;
  svg += `<path d="M120 340 a50 50 0 0 1 50 -50" fill="none" stroke="#111"/><path d="M620 340 a40 40 0 0 1 40 -40" fill="none" stroke="#111"/>`;
  svg += `<g font-size="12">${xs.slice(0, -1).map((x, i) => `<line x1="${x}" y1="650" x2="${xs[i + 1]}" y2="650" stroke="#111"/><text x="${(x + xs[i + 1]) / 2}" y="644" text-anchor="middle">7,200</text>`).join("")}</g>`;
  svg += `<circle cx="1380" cy="660" r="26" fill="none" stroke="#111"/><path d="M1380 634 L1372 660 L1388 660 z" fill="#111"/><text x="1380" y="628" font-size="12" text-anchor="middle">N</text></svg>`;
  await pdf(drawingSheet({ title: "3階 平面図", no: "A-103 (Rev.3)", scale: "1/100", date: "2026.11.09", svg, notes: ["Rev.3：会議室A 天井高さ CH2,700→CH2,600 に変更（設計変更 承認待ち）"] }), out, { format: "A3", landscape: true });
}

// 6F EPS 詳細図
export async function zumen6FEps(out) {
  let svg = `<svg viewBox="0 0 1420 760" width="100%" height="100%" font-family="Yu Gothic, Meiryo">`;
  svg += `<text x="40" y="40" font-size="20" font-weight="700">6F EPS 平面詳細（1/20）</text>`;
  svg += `<rect x="120" y="90" width="560" height="440" fill="#fafafa" stroke="#111" stroke-width="5"/>`;
  svg += `<rect x="180" y="150" width="200" height="320" fill="#fff" stroke="#2e86c1" stroke-width="2"/><text x="280" y="310" font-size="15" text-anchor="middle" fill="#2e86c1">幹線ケーブルラック</text><text x="280" y="332" font-size="13" text-anchor="middle" fill="#2e86c1">W=600</text>`;
  svg += `<rect x="440" y="160" width="180" height="120" fill="#fff" stroke="#111" stroke-width="2"/><text x="530" y="225" font-size="14" text-anchor="middle">分電盤 L-6</text>`;
  for (let i = 0; i < 4; i++) svg += `<circle cx="${470 + i * 45}" cy="400" r="17" fill="#fff" stroke="#c0392b" stroke-width="2"/><text x="${470 + i * 45}" y="404" font-size="10" text-anchor="middle">S${i + 1}</text>`;
  svg += `<text x="540" y="445" font-size="13" text-anchor="middle" fill="#c0392b">スリーブ φ100×4</text>`;
  svg += `<line x1="120" y1="580" x2="680" y2="580" stroke="#111"/><text x="400" y="574" font-size="13" text-anchor="middle">2,400</text>`;
  svg += `<line x1="453" y1="560" x2="453" y2="420" stroke="#111" stroke-dasharray="4 3"/><line x1="120" y1="560" x2="453" y2="560" stroke="#111"/><text x="286" y="554" font-size="12" text-anchor="middle">1,330（S1芯）</text>`;
  svg += `<text x="760" y="40" font-size="20" font-weight="700">床開口 断面（1/10）</text>`;
  svg += `<rect x="780" y="200" width="560" height="60" fill="#d5d8dc" stroke="#111" stroke-width="2"/><rect x="980" y="200" width="140" height="60" fill="#fff" stroke="#111" stroke-width="2"/>`;
  svg += `<text x="1050" y="290" font-size="13" text-anchor="middle">床開口 700×400</text><text x="1060" y="180" font-size="13" text-anchor="middle">耐火処理（貫通部）</text>`;
  svg += `<text x="780" y="400" font-size="14">特記</text><text x="780" y="425" font-size="13">・スリーブ位置は躯体図（S-206）による</text><text x="780" y="450" font-size="13">・ケーブルラック支持金物は @1,500 以下</text><text x="780" y="475" font-size="13">・区画貫通部は認定工法にて処理のこと</text></svg>`;
  await pdf(drawingSheet({ title: "6階 EPS 詳細図", no: "E-612", scale: "1/20・1/10", date: "2026.10.20", svg }), out, { format: "A3", landscape: true });
}

// 外構 北側通路 排水ルート
export async function zumenGaikoHaisui(out) {
  let svg = `<svg viewBox="0 0 1420 760" width="100%" height="100%" font-family="Yu Gothic, Meiryo">`;
  svg += `<rect x="60" y="80" width="1300" height="140" fill="#f2f2f2" stroke="#111" stroke-width="4"/><text x="710" y="160" font-size="22" text-anchor="middle">建物（北面）</text>`;
  svg += `<rect x="60" y="220" width="1300" height="200" fill="#fdfefe" stroke="#111" stroke-width="2"/><text x="90" y="250" font-size="15">北側通路（舗装 t=50 / 路盤 t=150）</text>`;
  svg += `<rect x="60" y="420" width="1300" height="20" fill="#7f8c8d"/><text x="70" y="465" font-size="13">仮囲い（移設予定）</text>`;
  svg += `<path d="M120 300 L1300 300" stroke="#888" stroke-width="6" stroke-dasharray="20 10"/><text x="700" y="290" font-size="13" text-anchor="middle" fill="#666">既設排水管 VU150（図面上の位置）</text>`;
  svg += `<path d="M120 350 L1300 350" stroke="#2e86c1" stroke-width="6"/><text x="700" y="378" font-size="13" text-anchor="middle" fill="#2e86c1">既設排水管 VU150（試掘で確認した実位置：+500 北側）</text>`;
  svg += `<path d="M120 350 L400 350 L400 260 L1300 260" stroke="#c0392b" stroke-width="4" fill="none"/><text x="1050" y="250" font-size="14" text-anchor="middle" fill="#c0392b" font-weight="700">変更ルート案（新設 VU150）</text>`;
  for (const x of [120, 400, 800, 1300]) svg += `<rect x="${x - 15}" y="${(x === 120 ? 335 : 245)}" width="30" height="30" fill="#fff" stroke="#111" stroke-width="2"/>`;
  svg += `<text x="120" y="325" font-size="12" text-anchor="middle">既設桝</text><text x="400" y="238" font-size="12" text-anchor="middle">新設桝①</text><text x="800" y="238" font-size="12" text-anchor="middle">新設桝②</text>`;
  svg += `<text x="60" y="560" font-size="15">特記</text><text x="60" y="588" font-size="13">・11/9 試掘にて既設排水管が設計図より約500mm北側にあることを確認</text><text x="60" y="612" font-size="13">・新設排水管は建物側（南側）へ約400mm振り、既設管との離隔を確保する（森田設計 11/10 回答）</text><text x="60" y="636" font-size="13">・勾配 1/100 以上確保のこと（既設桝への接続高さは変更なし）</text>`;
  svg += `<line x1="1140" y1="262" x2="1140" y2="298" stroke="#c0392b" stroke-width="1.5"/><text x="1150" y="285" font-size="12" fill="#c0392b">約400 建物側へ</text>`;
  svg += `<circle cx="1300" cy="560" r="26" fill="none" stroke="#111"/><path d="M1300 586 L1292 560 L1308 560 z" fill="#111"/><text x="1300" y="604" font-size="12" text-anchor="middle">N</text></svg>`;
  await pdf(drawingSheet({ title: "外構 北側通路 排水ルート図", no: "G-021 (Rev.1)", scale: "1/100", date: "2026.11.10", svg }), out, { format: "A3", landscape: true });
}

// ---------------------------------------------------------------- 安全書類：新規入場者教育記録
export async function kyoikuKiroku(out) {
  const ppl = [
    ["2026/11/02", "北斗鳶工業", "小松 大地", "鳶工", "28", "済"],
    ["2026/11/02", "東邦内装", "吉田 光", "内装工", "24", "済"],
    ["2026/11/04", "新栄外構", "原 拓真", "土工", "31", "済"],
    ["2026/11/04", "新栄外構", "久保 亮介", "土工", "45", "済"],
    ["2026/11/05", "三光電設", "中野 翼", "電工", "22", "済"],
    ["2026/11/09", "富士空調システム", "西村 健", "ダクト工", "37", "済"],
    ["2026/11/10", "富士空調システム", "岡本 誠也", "配管工", "29", "済"],
    ["2026/11/04", "光陽塗装", "福田 勝", "塗装工", "52", "済"],
    ["2026/11/04", "光陽塗装", "村上 浩", "塗装工", "39", "済"],
  ];
  const body = `<div class="page">
  <div class="meta"><span>様式 安-07　（取りまとめ：事務 高橋）</span><span>東都建設株式会社 港南三丁目作業所</span></div>
  <h1>新規入場者教育 実施記録</h1>
  <table class="t" style="margin-bottom:4mm">
    <tr><th>工事名</th><td>（仮称）港南三丁目オフィスビル新築工事</td><th>期間</th><td>2026年11月1日〜11月10日</td></tr>
    <tr><th>教育担当</th><td>東都建設 伊藤 翔</td><th>場所</th><td>現場事務所 2F 会議室</td></tr>
  </table>
  <h2>教育内容</h2>
  <p style="margin:0 0 3mm">現場概要・工程／立入禁止区域／墜落・転落防止（安全帯フルハーネス）／脚立・可搬式作業台の使用ルール／重機・揚重作業の合図／火気使用手続き／緊急時連絡体制・避難経路／喫煙所・休憩所</p>
  <table class="t">
    <tr><th>受講日</th><th>会社名</th><th>氏名</th><th>職種</th><th>年齢</th><th>血圧測定</th><th>本人署名</th></tr>
    ${ppl.map((p) => `<tr><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td><td>${p[3]}</td><td class="c">${p[4]}</td><td class="c">${p[5]}</td><td style="font-family:'UD デジタル 教科書体 N-R','UD Digi Kyokasho N-R';color:#1f2a4a;font-size:12pt">${p[2].split(" ")[0]}</td></tr>`).join("")}
    ${Array.from({ length: 6 }, () => `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("")}
  </table>
  <div style="display:flex;justify-content:flex-end;gap:4mm;margin-top:6mm">
    <table class="t" style="width:auto"><tr><th>所長</th><th>安全担当</th></tr><tr><td style="width:22mm;height:20mm" class="c"><span class="stamp">山本</span></td><td style="width:22mm" class="c"><span class="stamp">伊藤</span></td></tr></table>
  </div>
</div>`;
  await pdf(body, out);
}

// ---------------------------------------------------------------- 週間工程表（schedule.json から作る）
export async function weeklySchedule(out, schedule, site) {
  const days = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"];
  const wd = ["月", "火", "水", "木", "金", "土"];
  const cn = Object.fromEntries(site.companies.map((c) => [c.id, c.shortName]));
  const an = Object.fromEntries(site.areas.map((a) => [a.id, a.name]));
  const tasks = (schedule?.tasks ?? [])
    .filter((t) => t.companyId && t.start <= days[5] && t.end >= days[0])
    .sort((a, b) => (a.areaId + a.start).localeCompare(b.areaId + b.start));
  const ms = (schedule?.milestones ?? []).filter((m) => m.date >= "2026-11-09" && m.date <= "2026-11-22");
  const body = `<div class="page" style="padding:10mm 12mm">
  <div class="meta"><span>（仮称）港南三丁目オフィスビル新築工事</span><span>作成：2026/11/09 東都建設 佐藤</span></div>
  <h1 style="margin-bottom:4mm">週間工程表　2026年 第46週（11/9〜11/14）</h1>
  <table class="t" style="font-size:9pt">
    <tr><th style="width:22mm">工区</th><th style="width:18mm">階</th><th>作業</th><th style="width:32mm">会社</th><th style="width:12mm">人数</th>${days.map((d, i) => `<th style="width:20mm">${+d.slice(5, 7)}/${+d.slice(8)}（${wd[i]}）</th>`).join("")}<th style="width:24mm">備考</th></tr>
    ${tasks.map((t) => `<tr><td>${esc(an[t.areaId] ?? "")}</td><td>${esc(t.floor ?? "")}</td><td>${esc(t.name)}</td><td>${esc(cn[t.companyId] ?? "")}</td><td class="c">${t.workers ?? ""}</td>${days.map((d) => `<td style="padding:4px 0">${t.start <= d && t.end >= d ? `<div style="height:10px;background:${t.outdoor ? "#e67e22" : "#2e86c1"}"></div>` : ""}</td>`).join("")}<td style="font-size:8pt">${t.outdoor ? "屋外" : ""}</td></tr>`).join("")}
  </table>
  <p class="small">凡例：<span style="display:inline-block;width:20px;height:8px;background:#2e86c1"></span> 屋内作業　<span style="display:inline-block;width:20px;height:8px;background:#e67e22"></span> 屋外作業（雨天時は要調整）</p>
  <h2>主要予定</h2>
  <ul style="margin:0">${ms.map((m) => `<li>${+m.date.slice(5, 7)}/${+m.date.slice(8)}　${esc(m.name)}</li>`).join("")}</ul>
</div>`;
  await pdf(body, out, { format: "A3", landscape: true });
}

// ---------------------------------------------------------------- 打合せ資料
export async function shiryoSeshuTeirei(out) {
  const body = `<div class="page">
  <div class="meta"><span>港南不動産開発株式会社 御中</span><span>2026年11月4日　東都建設株式会社</span></div>
  <h1>施主定例 資料（第24回）</h1>
  <h2>1. 全体工程</h2>
  <table class="t">
    <tr><th>項目</th><th>計画</th><th>実績・見込み</th><th>状況</th></tr>
    ${rows([
      ["躯体工事", "〜2026/08", "完了", "完了"],
      ["1工区 仕上・設備", "〜2026/12/04", "進捗 約75%", "予定どおり"],
      ["2工区 仕上・設備", "〜2026/12/11", "進捗 約68%", "6F 石膏ボード納期 確認中"],
      ["3工区 仕上・設備", "〜2026/12/11", "進捗 約60%", "予定どおり"],
      ["外構", "〜2026/12/11", "進捗 約35%", "北側通路 11/4 着手"],
    ])}
  </table>
  <h2>2. 今後の主要予定</h2>
  <table class="t">
    ${rows([
      ["11/15（日）", "受変電設備 切替（調整中）"],
      ["11/19（木）", "1工区 施主検査（ご立会いのお願い）"],
      ["11/20（金）〜", "外部足場 東面 一部解体"],
      ["12/15（火）", "本受電"],
    ])}
  </table>
  <h2>3. 協議事項</h2>
  <ol>
    <li>3F 会議室A 天井高さ変更（CH2,700→CH2,600）：設計者より変更案提示済み。ご判断をお願いします。</li>
    <li>1F エントランス 床石の色味サンプル：次回定例にて提示予定。</li>
    <li>11/19 施主検査の範囲：1工区（B1F〜4F）とする。</li>
  </ol>
</div>`;
  await pdf(body, out);
}

export async function shiryoTenjo3F(out) {
  const body = `<div class="page">
  <div class="meta"><span>森田設計事務所 / 東都建設 打合せ用</span><span>2026年11月6日</span></div>
  <h1>3F 会議室A 天井高さ変更 検討資料</h1>
  <h2>1. 変更概要</h2>
  <table class="t">
    ${rows([["対象", "3F 会議室A（X1〜X3 / Y1〜Y2）"], ["変更内容", "天井高さ CH2,700 → CH2,600"], ["理由", "天井内の空調ダクト・ケーブルラックの納まり確保（梁下有効寸法の不足）"], ["影響", "天井下地（東邦内装）、照明器具配置（三光電設）、吹出口位置（富士空調）"]])}
  </table>
  <h2>2. 断面比較</h2>
  <svg viewBox="0 0 700 260" width="100%" font-family="Yu Gothic">
    <rect x="20" y="20" width="300" height="20" fill="#aaa"/><rect x="380" y="20" width="300" height="20" fill="#aaa"/>
    <rect x="40" y="40" width="120" height="50" fill="#d6eaf8" stroke="#2e86c1"/><text x="100" y="70" font-size="11" text-anchor="middle">ダクト</text>
    <line x1="20" y1="95" x2="320" y2="95" stroke="#c0392b" stroke-width="3"/><text x="170" y="115" font-size="12" text-anchor="middle" fill="#c0392b">現計画 CH2,700（ダクト干渉）</text>
    <rect x="400" y="40" width="120" height="50" fill="#d6eaf8" stroke="#2e86c1"/><text x="460" y="70" font-size="11" text-anchor="middle">ダクト</text>
    <line x1="380" y1="125" x2="680" y2="125" stroke="#27ae60" stroke-width="3"/><text x="530" y="145" font-size="12" text-anchor="middle" fill="#27ae60">変更案 CH2,600（納まり可）</text>
    <line x1="20" y1="240" x2="320" y2="240" stroke="#111" stroke-width="3"/><line x1="380" y1="240" x2="680" y2="240" stroke="#111" stroke-width="3"/><text x="350" y="255" font-size="11" text-anchor="middle">FL</text>
  </svg>
  <h2>3. 今後の流れ</h2>
  <ol><li>施主承認 → 承認書の取り交わし（森田設計）</li><li>施工図修正（東邦内装）※図面元データは東都建設より提供</li><li>3F 天井下地 着手</li></ol>
</div>`;
  await pdf(body, out);
}

// ---------------------------------------------------------------- メール添付（フィラー）
export async function anzenTaikai(out) {
  const body = `<div class="page">
  <div class="meta"><span>安環発第2026-118号</span><span>2026年10月30日</span></div>
  <p>各作業所 所長・工事主任 殿<br>協力会社 各位</p>
  <p class="r">東都建設株式会社<br>本社 安全環境部 部長<br>（担当：斎藤 学）</p>
  <h1 style="margin-top:8mm">2026年 年末安全大会 開催のご案内</h1>
  <p>日頃より安全衛生活動にご協力いただき、誠にありがとうございます。<br>年末年始の繁忙期を無災害で乗り切るため、下記のとおり年末安全大会を開催いたします。</p>
  <p class="c" style="margin:6mm 0">記</p>
  <table class="t">
    ${rows([["日時", "2026年12月4日（金）13:30〜16:00（受付 13:00〜）"], ["場所", "東都建設 本社 3F 大会議室（オンライン併用）"], ["対象", "各作業所の所長・工事主任、協力会社 職長代表（各社1名）"], ["内容", "1. 社長挨拶<br>2. 本年の災害発生状況と来年度の重点施策<br>3. 優良作業所・優良職長 表彰<br>4. 講演「墜落・転落災害ゼロへの取り組み」<br>5. 安全宣言"], ["出欠回答", "<b>11月11日（水）まで</b>に、作業所ごとに参加人数（協力会社分を含む）をメールでご回答ください"], ["服装", "作業服可"]])}
  </table>
  <p class="r" style="margin-top:6mm">以上</p>
</div>`;
  await pdf(body, out);
}

export async function shoninsho3F(out) {
  const body = `<div class="page">
  <div class="meta"><span>森設発 第2026-0412号</span><span>2026年11月11日</span></div>
  <h1 style="margin-top:4mm">設計変更 承認書</h1>
  <p>東都建設株式会社　港南三丁目作業所　御中</p>
  <p>下記の設計変更について、建築主の承認を得ましたので通知します。施工者欄に記名・押印のうえご返送ください。</p>
  <table class="t" style="margin-top:4mm">
    ${rows([["工事名", "（仮称）港南三丁目オフィスビル新築工事"], ["変更箇所", "3階 会議室A（X1〜X3 / Y1〜Y2）"], ["変更内容", "天井高さ　CH2,700 → <b>CH2,600</b><br>（天井下地・照明器具・空調吹出口の位置は施工図にて調整）"], ["変更理由", "天井内 空調ダクト・ケーブルラックの納まり確保のため"], ["関連図面", "A-103 3階平面図（Rev.3）、A-503 天井伏図（Rev.2）"], ["工期・金額への影響", "工期影響なし。金額は別途協議（軽微）"]])}
  </table>
  <h2>承認欄</h2>
  <table class="t">
    <tr><th style="width:30%">建築主</th><th style="width:30%">設計監理者</th><th>施工者</th></tr>
    <tr>
      <td style="height:36mm">港南不動産開発株式会社<br>開発推進部 課長　上田 直樹<div class="c" style="margin-top:4mm"><span class="stamp">上田</span></div><div class="small">2026/11/10</div></td>
      <td>森田設計事務所<br>監理担当　森田 亮<div class="c" style="margin-top:4mm"><span class="stamp">森田</span></div><div class="small">2026/11/11</div></td>
      <td>東都建設株式会社<br>氏名：<span style="display:inline-block;width:40mm;border-bottom:1px solid #333">&nbsp;</span><div style="margin:4mm auto 0;width:20mm;height:20mm;border:1px dashed #888;text-align:center;line-height:20mm;color:#999;font-size:9pt">印</div><div class="small">日付：&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;/</div></td>
    </tr>
  </table>
  <p class="small" style="margin-top:4mm">※ 本書は PDF にてご返送ください（返送先：r.morita@morita-sekkei.example）。</p>
</div>`;
  await pdf(body, out);
}

// ---------------------------------------------------------------- 手書き日報スキャン（東邦内装）
export async function naisoScan(out) {
  const r = rng(20261110);
  // 手書き風：1文字ずつ少し傾け・上下にずらす
  const hw = (text, { size = 30, w = 400 } = {}) =>
    [...text].map((ch) => ch === " " ? `<span style="display:inline-block;width:${size * 0.4}px"></span>` :
      `<span style="display:inline-block;transform:translate(${((r() - 0.5) * 3).toFixed(1)}px,${((r() - 0.5) * 5).toFixed(1)}px) rotate(${((r() - 0.5) * 9).toFixed(1)}deg) skewX(-4deg);margin-right:${(r() * 2 - 0.5).toFixed(1)}px;font-size:${(size * (0.9 + r() * 0.2)).toFixed(1)}px;font-weight:${w}">${esc(ch)}</span>`).join("");
  const H = (t, o) => `<span class="ink">${hw(t, o)}</span>`;
  const workRows = [
    ["6F", "LGS下地（ボード待ち）", "3"],
    ["5F", "天井ボード張り", "3"],
    ["", "", ""], ["", "", ""], ["", "", ""],
  ];
  const specks = Array.from({ length: 60 }, () => `<i style="left:${(r() * 1240).toFixed(0)}px;top:${(r() * 1754).toFixed(0)}px;width:${(1 + r() * 3).toFixed(1)}px;height:${(1 + r() * 2.5).toFixed(1)}px;opacity:${(0.25 + r() * 0.5).toFixed(2)}"></i>`).join("");
  const css = `
    .scan { position: relative; width: 1240px; height: 1754px; background: #d9d8d3; overflow: hidden; }
    .paper { position: absolute; left: 22px; top: 18px; width: 1200px; height: 1716px; background: #f6f5f1; transform: rotate(-0.7deg); box-shadow: 0 0 6px rgba(0,0,0,.35); padding: 70px 80px; font-family: "BIZ UDGothic", "Yu Gothic", sans-serif; color: #3a3a3a; }
    .ink { font-family: "UD デジタル 教科書体 N-R", "UD Digi Kyokasho N-R", serif; color: #202a44; text-shadow: 0 0 .7px rgba(20,30,60,.7); }
    .title { text-align: center; font-size: 46px; letter-spacing: 30px; font-weight: 700; margin: 0 0 10px; color: #333; }
    .sub { display: flex; justify-content: space-between; font-size: 20px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1.6px solid #555; padding: 8px 12px; font-size: 21px; height: 64px; vertical-align: middle; }
    th { background: rgba(0,0,0,.04); font-weight: 400; white-space: nowrap; width: 150px; }
    .lbl { font-size: 18px; color: #444; }
    .co { font-size: 26px; font-weight: 700; color: #333; }
    .hanko { display: inline-flex; width: 70px; height: 70px; border: 3px solid #c0392b; border-radius: 50%; color: #c0392b; align-items: center; justify-content: center; font-family: "Yu Mincho", serif; font-size: 22px; font-weight: 700; transform: rotate(-12deg); opacity: .85; }
    .specks i { position: absolute; background: #555; border-radius: 50%; }
    .shadow { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.18), rgba(0,0,0,0) 3%), linear-gradient(0deg, rgba(0,0,0,.08), rgba(0,0,0,0) 2%); pointer-events: none; }
    .fold { position: absolute; left: 0; right: 0; top: 860px; height: 2px; background: linear-gradient(90deg, rgba(0,0,0,.05), rgba(0,0,0,.12), rgba(0,0,0,.04)); }
  `;
  const body = `<div class="scan"><div class="paper">
    <div class="sub"><span>東都建設株式会社　御中</span><span>No.&nbsp;${H("1110", { size: 24 })}</span></div>
    <div class="title">作業日報</div>
    <div style="text-align:right;margin-bottom:16px"><span class="co">東邦内装株式会社</span></div>
    <table>
      <tr><th>工 事 名</th><td colspan="3">${H("港南三丁目オフィスビル新築工事")}</td></tr>
      <tr><th>日　　付</th><td>${H("2026")} 年 ${H("11")} 月 ${H("10")} 日（${H("火")}）</td><th style="width:110px">天 候</th><td style="width:200px">${H("晴")}</td></tr>
      <tr><th>職 長 名</th><td>${H("清水 隆")}</td><th>作業時間</th><td>${H("8:00 〜 17:00", { size: 27 })}</td></tr>
    </table>
    <table style="margin-top:22px">
      <tr><th style="width:150px">作業場所</th><th style="width:auto">作 業 内 容</th><th style="width:110px">人 数</th></tr>
      ${workRows.map(([a, b, c]) => `<tr><td style="text-align:center">${a ? H(a, { size: 32 }) : ""}</td><td>${b ? H(b, { size: 32 }) : ""}</td><td style="text-align:center">${c ? H(c, { size: 32 }) + " 名" : ""}</td></tr>`).join("")}
      <tr><th colspan="2" style="text-align:right;padding-right:24px">合　計</th><td style="text-align:center">${H("6", { size: 34, w: 700 })} 名</td></tr>
    </table>
    <table style="margin-top:22px">
      <tr><th>作 業 員</th><td>${H("清水、大野、川口、吉田、石川、森下", { size: 28 })}</td></tr>
      <tr><th>明日の予定</th><td style="height:110px">${H("6F LGS下地（ボード待ち）", { size: 29 })}<br>${H("5F 手直し・片付け　計6名", { size: 29 })}</td></tr>
      <tr><th>特記事項</th><td style="height:150px">${H("6Fボード 欠品分 11/12 10:00 西ゲート搬入予定", { size: 28 })}<br>${H("3F会議室 天井変更の施工図 → 図面データ待ち", { size: 28 })}<br>${H("KY実施済　ケガなし", { size: 28 })}</td></tr>
    </table>
    <div style="display:flex;justify-content:flex-end;gap:0;margin-top:30px">
      <table style="width:auto"><tr><th style="width:150px;text-align:center" class="lbl">職長印</th><th style="width:150px;text-align:center" class="lbl">元請確認欄</th></tr>
      <tr><td style="height:130px;text-align:center"><span class="hanko">清水</span></td><td></td></tr></table>
    </div>
    <div class="fold"></div>
  </div><div class="specks">${specks}</div><div class="shadow"></div></div>`;
  await renderPng(body, css, 1240, 1754, out, { quant: 8, gray: true });
}

// ---------------------------------------------------------------- 受変電設備 切替作業 要領書（案）（三光電設 → 07_打合せ資料）
export async function youryouJuhenden(out) {
  const body = `<div class="page">
  <div class="meta"><span>三光電設株式会社　港南三丁目作業所</span><span>2026年11月5日　（案）</span></div>
  <h1>受変電設備 切替作業 要領書（案）</h1>
  <table class="t">
    ${rows([
      ["工事名", "（仮称）港南三丁目オフィスビル新築工事　電気設備工事"],
      ["作業内容", "仮設受電（低圧）から本設受変電設備（1F 電気室）への切替、送り出し確認"],
      ["実施日時", "2026年11月15日（日）8:00〜12:00 を候補（<b>日時は次回 工程定例で決定</b>）"],
      ["停電範囲", "全館（仮設分電盤・仮設照明・仮設EVを含む）"],
      ["作業責任者", "三光電設 井上 拓也（職長）／立会い：東都建設 中村"],
    ])}
  </table>
  <h2>1. 前提条件</h2>
  <ul>
    <li>6F〜8F 幹線ケーブルの入線・端末処理が完了していること（切替後の送り出し確認のため）</li>
    <li>各社へ停電時間を事前周知（電動工具・仮設照明の段取り）</li>
  </ul>
  <h2>2. 作業手順</h2>
  <table class="t">
    <tr><th style="width:24mm">時刻</th><th>作業</th><th style="width:32mm">担当</th></tr>
    ${rows([
      ["7:45", "KY・作業前ミーティング、検電器・接地器具の確認", "三光電設"],
      ["8:00", "仮設受電 遮断、全館停電の確認（館内巡回）", "三光電設／東都建設"],
      ["8:15〜10:30", "仮設幹線 切離し、本設盤への接続替え", "三光電設"],
      ["10:30〜11:30", "絶縁抵抗測定、相回転確認、本設受電", "三光電設"],
      ["11:30〜12:00", "各階分電盤への送り出し確認（6〜8F 幹線含む）", "三光電設"],
      ["12:00〜", "順次復旧、仮設EV・仮設照明の点灯確認", "東都建設"],
    ])}
  </table>
  <h2>3. 安全対策</h2>
  <ul>
    <li>電気室出入口に立入禁止表示、操作中の盤には「操作禁止」札を掛ける</li>
    <li>停電中の高所作業・EV使用は禁止</li>
  </ul>
  <p class="small r">作成：三光電設 井上　／　確認：東都建設 中村（未）</p>
</div>`;
  await pdf(body, out);
}

// ---------------------------------------------------------------- EV 据付工程表（改訂）（ミツワ昇降機 → 01_図面）
export async function evKoutei(out) {
  const weeks = ["9/14", "9/21", "9/28", "10/5", "10/12", "10/19", "10/26", "11/2", "11/9", "11/16", "11/23", "11/30", "12/7"];
  const bar = (s, e, color, label = "") => weeks.map((_, i) => `<td style="padding:3px 0">${i >= s && i <= e ? `<div style="height:12px;background:${color};font-size:7pt;color:#fff;padding-left:2px;white-space:nowrap;overflow:hidden">${i === s ? label : ""}</div>` : ""}</td>`).join("");
  const body = `<div class="page" style="padding:12mm">
  <div class="meta"><span>東都建設株式会社 御中</span><span>2026年10月30日　ミツワ昇降機株式会社 工事部</span></div>
  <h1 style="font-size:16pt">EV 据付工程表（改訂版）</h1>
  <p class="small">対象：乗用エレベーター 2基（1号機・2号機）　改訂理由：2号機 ガイドレール建込みを受変電設備 切替後に変更</p>
  <table class="t" style="font-size:9pt">
    <tr><th style="width:18mm">号機</th><th style="width:50mm">作業</th>${weeks.map((w) => `<th style="width:13mm">${w}</th>`).join("")}</tr>
    <tr><td>1号機</td><td>据付</td>${bar(0, 7, "#2e86c1", "据付")}</tr>
    <tr><td>1号機</td><td>調整・試運転</td>${bar(10, 11, "#27ae60", "調整")}</tr>
    <tr><td>2号機</td><td>ガイドレール建込み</td>${bar(9, 10, "#d35400", "11/16〜")}</tr>
    <tr><td>2号機</td><td>かご組立</td>${bar(11, 12, "#d35400", "11/30〜")}</tr>
  </table>
  <h2>変更点</h2>
  <ul>
    <li>2号機 ガイドレール建込み：11/13〜 → <b>11/16〜</b>（受変電切替後に変更）</li>
    <li>2号機 かご組立：<b>11/30〜</b></li>
    <li>竣工検査日への影響なし</li>
  </ul>
  <p class="small r">作成：ミツワ昇降機 阿部</p>
</div>`;
  await pdf(body, out, { landscape: true });
}

// ---------------------------------------------------------------- 新規入場者教育 案内（事務 高橋 → 07_打合せ資料）
export async function kyoikuAnnai(out) {
  const body = `<div class="page">
  <div class="meta"><span>協力会社 職長 各位</span><span>2026年11月10日</span></div>
  <p class="r">東都建設株式会社 港南三丁目作業所<br>事務担当 高橋 由紀／安全担当 伊藤 翔</p>
  <h1 style="margin-top:6mm">新規入場者教育 実施のご案内</h1>
  <p>標記の件、下記のとおり新規入場者教育を実施します。<br>新たに入場される作業員の方は、作業開始前に必ず受講してください。</p>
  <p class="c" style="margin:5mm 0">記</p>
  <table class="t">
    ${rows([
      ["日時", "2026年11月12日（木）13:00〜14:00"],
      ["場所", "現場事務所 2F 会議室"],
      ["講師", "東都建設 伊藤（安全担当）"],
      ["対象", "11/12以降に新規入場する作業員"],
      ["持ち物", "ヘルメット・フルハーネス、筆記用具、健康診断結果の写し、資格証の写し"],
      ["提出物", "作業員名簿（追加分）・新規入場者アンケートを <b>前日 17:00まで</b> に事務 高橋へ（チャット「事務連絡」ルーム、またはメール）"],
      ["その他", "当日は受付で血圧測定を行います。受講後、ヘルメットシールをお渡しします。"],
    ])}
  </table>
  <h2>教育内容</h2>
  <p style="margin:0">現場概要・工程／立入禁止区域／墜落・転落防止／脚立・可搬式作業台の使用ルール／重機・揚重作業の合図／火気使用手続き／緊急時連絡体制・避難経路／喫煙所・休憩所</p>
  <p class="r" style="margin-top:6mm">以上</p>
  <p class="small">問合せ：事務 高橋（y.takahashi@toto-kensetsu.example）</p>
</div>`;
  await pdf(body, out);
}
