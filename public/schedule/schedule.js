// 工程表（ガントチャート）画面
import { watchState, lookup, escapeHtml as h, currentActor } from "/shared/api.js";

const STATUS_LABEL = { done: "完了", in_progress: "進行中", not_started: "未着手", delayed: "遅延" };
const CATEGORY_ORDER = ["仮設", "躯体", "外装", "内装", "電気", "空調", "衛生", "昇降機", "防災", "外構", "検査"];
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const WX_ICON = { sunny: "☀️", cloudy: "☁️", rain: "☔", partly_cloudy: "⛅" };
const FLAG_ALIAS = { tomorrow: "tomorrow", tmr: "tomorrow", delayed: "delayed", delay: "delayed", late: "delayed", outdoor: "outdoor", outside: "outdoor" };
const FIELD_LABEL = {
  name: "作業名", start: "開始", end: "終了", baselineStart: "当初開始", baselineEnd: "当初終了", workers: "人数",
  progress: "進捗", status: "状態", outdoor: "屋外", canAdvance: "前倒し可", companyId: "担当会社", areaId: "工区",
  floor: "階", category: "工種", dependsOn: "先行作業", note: "備考", wbs: "WBS",
};
const DAY = 86400000;
// アクター（目線）ごとの既定ビュー。URL にパラメータがない初回表示と、目線の切替時に適用する
const PERSONA_VIEW = {
  field: { group: "wbs", range: "all", flags: [], badge: "", hint: "" },
  honsha: { group: "area", range: "focus", flags: [], badge: "本社ビュー", hint: "工区別・直近3週。全体進捗と遅延を重点表示" },
  jimu: { group: "wbs", range: "all", flags: ["tomorrow"], badge: "事務ビュー", hint: "明日の作業（入場人数・作業届）を中心に表示" },
};

// ---------- 日付ユーティリティ（YYYY-MM-DD をローカル日付として扱う） ----------
const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY); // b - a
const md = (s) => { const d = parse(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mdw = (s) => { const d = parse(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
const durDays = (t) => diffDays(t.start, t.end) + 1;
const activeOn = (t, day) => t.start <= day && day <= t.end;

// ---------- 状態 ----------
let S = { site: null, schedule: null, weather: null };
let L = lookup(null);
const ui = { company: "", area: "", flags: new Set(), group: "wbs", range: "all", collapsed: new Set(), selected: null };
let prevTasks = null;            // id -> JSON 文字列
const changes = new Map();       // id -> { fields:[{key,from,to}], prev, added }
let flashIds = new Set();
let updatedAt = null;
let actor = currentActor(null);
let actorKey = null;             // 前回の personaId（切替検知用）
const hadUrlParams = location.search.length > 1;

const $ = (id) => document.getElementById(id);
const els = {
  cards: $("cards"), head: $("sched-head"), body: $("sched-body"), empty: $("empty"), result: $("result-line"),
  company: $("f-company"), area: $("f-area"), clear: $("f-clear"), detail: $("detail"), dBody: $("d-body"),
  dTitle: $("d-title"), dWbs: $("d-wbs"), toast: $("toast"), live: $("live"), updated: $("updated"),
};

// ---------- URL 状態 ----------
function readUrl() {
  const p = new URLSearchParams(location.search);
  ui.flags = new Set((p.get("filter") || "").split(",").map((f) => FLAG_ALIAS[f.trim()]).filter(Boolean));
  ui.company = p.get("company") || "";
  ui.area = p.get("area") || "";
  ui.group = ["area", "category"].includes(p.get("group")) ? p.get("group") : "wbs";
  ui.range = p.get("range") === "focus" ? "focus" : "all";
  ui.selected = p.get("task") || null;
}
function writeUrl() {
  const p = new URLSearchParams();
  if (ui.flags.size) p.set("filter", [...ui.flags].join(","));
  if (ui.company) p.set("company", ui.company);
  if (ui.area) p.set("area", ui.area);
  if (ui.group !== "wbs") p.set("group", ui.group);
  if (ui.range !== "all") p.set("range", ui.range);
  if (ui.selected) p.set("task", ui.selected);
  const q = p.toString();
  history.replaceState(null, "", location.pathname + (q ? `?${q}` : ""));
}

function applyPersonaView() {
  const v = PERSONA_VIEW[actor.personaId] ?? PERSONA_VIEW.field;
  ui.group = v.group;
  ui.range = v.range;
  ui.flags = new Set(v.flags);
  ui.company = "";
  ui.area = "";
  ui.selected = null;
  ui.collapsed.clear();
  writeUrl();
}

function renderActor() {
  const p = actor.person;
  const me = $("me");
  me.textContent = p?.name?.trim().charAt(0) ?? "";
  me.style.background = p?.color || "";
  me.title = p ? `${p.name}（${actor.label}）` : "";
  $("actor-label").textContent = p ? `${p.name}（${actor.label}）で表示中` : "";
  const v = PERSONA_VIEW[actor.personaId] ?? PERSONA_VIEW.field;
  const badge = $("view-badge");
  badge.hidden = !v.badge;
  badge.className = `view-badge ${actor.personaId ?? ""}`;
  badge.innerHTML = v.badge ? `<b>${h(v.badge)}</b>${v.hint ? `<span>${h(v.hint)}</span>` : ""}` : "";
  document.body.dataset.persona = actor.personaId ?? "";
}

// ---------- 派生データ ----------
const today = () => S.site?.today || "2026-11-11";
const tomorrow = () => addDays(today(), 1);
const allRows = () => S.schedule?.tasks ?? [];
const tasks = () => allRows().filter((t) => !t.summary);       // 実作業（サマリー行を除く）
const summaries = () => allRows().filter((t) => t.summary);    // WBS 上位のサマリー行
const taskById = (id) => allRows().find((t) => t.id === id);
const areaName = (id) => S.site?.areas?.find((a) => a.id === id)?.name ?? (id || "全体");
const coShort = (id) => L.company(id)?.shortName ?? L.company(id)?.name ?? id ?? "";
const forecast = (day) => S.weather?.forecasts?.find((f) => f.date === day);
const isRain = (f) => f && (f.icon === "rain" || (f.precipProb ?? 0) >= 60);
const lateDays = (t) => (t.baselineEnd && t.end ? diffDays(t.baselineEnd, t.end) : 0);
const baseDiffers = (t) => t.baselineStart && t.baselineEnd && (t.baselineStart !== t.start || t.baselineEnd !== t.end);

function viewRange() {
  const p = S.schedule?.project ?? {};
  if (ui.range === "focus") {
    const t = parse(today());
    const mon = addDays(today(), -((t.getDay() + 6) % 7)); // その週の月曜
    return { start: mon, end: addDays(mon, 20) };
  }
  return { start: p.viewStart || addDays(today(), -16), end: p.viewEnd || addDays(today(), 32) };
}

function filterTasks() {
  const tmr = tomorrow();
  return tasks().filter((t) =>
    (!ui.company || t.companyId === ui.company) &&
    (!ui.area || t.areaId === ui.area) &&
    (!ui.flags.has("tomorrow") || activeOn(t, tmr)) &&
    (!ui.flags.has("delayed") || t.status === "delayed") &&
    (!ui.flags.has("outdoor") || t.outdoor));
}

function groupTasks(list) {
  if (ui.group === "wbs") return groupByWbs(list);
  const key = ui.group === "category" ? (t) => t.category || "その他" : (t) => t.areaId || "_none";
  const map = new Map();
  for (const t of list) { const k = key(t); if (!map.has(k)) map.set(k, []); map.get(k).push(t); }
  let order;
  if (ui.group === "category") {
    order = [...map.keys()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "ja");
    });
  } else {
    const ids = (S.site?.areas ?? []).map((a) => a.id);
    order = [...map.keys()].sort((a, b) => { const ia = ids.indexOf(a), ib = ids.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  }
  const cmp = (a, b) => (a.start || "").localeCompare(b.start || "") || String(a.wbs).localeCompare(String(b.wbs), "ja", { numeric: true });
  return order.map((k) => ({
    key: k,
    name: ui.group === "category" ? k : k === "_none" ? "全体" : areaName(k),
    sub: ui.group === "category" ? "" : S.site?.areas?.find((a) => a.id === k)?.floors ?? "",
    tasks: map.get(k).sort(cmp),
  }));
}

const wbsCmp = (a, b) => String(a.wbs).localeCompare(String(b.wbs), "ja", { numeric: true });
function parentSummary(t, sums) {
  // 最も深い（WBS が長い）サマリーを親とみなす
  let best = null;
  for (const s of sums) if (String(t.wbs).startsWith(`${s.wbs}.`) && (!best || String(s.wbs).length > String(best.wbs).length)) best = s;
  return best;
}
function groupByWbs(list) {
  const sums = summaries().sort(wbsCmp);
  const groups = sums.map((s) => ({ key: s.id, summary: s, name: s.name, sub: "", tasks: [], all: [] }));
  const other = { key: "_other", name: "その他", sub: "", tasks: [], all: [] };
  const byId = new Map(groups.map((g) => [g.key, g]));
  const parentOf = (t) => { const p = parentSummary(t, sums); return p ? byId.get(p.id) : other; };
  for (const t of tasks()) parentOf(t).all.push(t);
  for (const t of list) parentOf(t).tasks.push(t);
  return [...groups, other].filter((g) => g.tasks.length).map((g) => ({ ...g, tasks: g.tasks.sort(wbsCmp) }));
}

function weightedProgress(list) {
  let w = 0, s = 0;
  for (const t of list) { const ww = Math.max(1, durDays(t)) * Math.max(1, t.workers || 1); w += ww; s += ww * (t.progress || 0); }
  return w ? s / w : 0;
}

// ---------- 変更検知（AI が工程を書き換えたとき） ----------
function detectChanges(isInitial) {
  const cur = new Map(allRows().map((t) => [t.id, t]));
  flashIds = new Set();
  if (prevTasks && !isInitial) {
    for (const [id, t] of cur) {
      const before = prevTasks.get(id);
      if (!before) { changes.set(id, { added: true, fields: [], prev: null }); flashIds.add(id); continue; }
      if (JSON.stringify(before) === JSON.stringify(t)) continue;
      const fields = [];
      for (const k of new Set([...Object.keys(before), ...Object.keys(t)])) {
        if (JSON.stringify(before[k]) !== JSON.stringify(t[k])) fields.push({ key: k, from: before[k], to: t[k] });
      }
      const old = changes.get(id);
      // 最初の変更前の状態を保持する（何度変わっても「元の位置」を表示）
      const orig = old?.prev ?? before;
      const merged = fields.map((f) => ({ ...f, from: old?.fields.find((o) => o.key === f.key)?.from ?? f.from }));
      for (const of of old?.fields ?? []) if (!merged.some((m) => m.key === of.key)) merged.push(of);
      changes.set(id, { added: old?.added ?? false, fields: merged, prev: orig });
      flashIds.add(id);
    }
    const removed = [...prevTasks.keys()].filter((id) => !cur.has(id)).length;
    if (flashIds.size || removed) {
      toast(`AIが工程表を更新しました（変更 ${flashIds.size} 件${removed ? `・削除 ${removed} 件` : ""}）`);
      els.live.classList.add("pulse");
      setTimeout(() => els.live.classList.remove("pulse"), 4000);
    }
  }
  prevTasks = new Map(allRows().map((t) => [t.id, JSON.parse(JSON.stringify(t))]));
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 5000);
}

function fmtVal(key, v) {
  if (v == null || v === "") return "—";
  if (["start", "end", "baselineStart", "baselineEnd"].includes(key)) return mdw(v);
  if (key === "progress") return `${v}%`;
  if (key === "workers") return `${v}名`;
  if (key === "status") return STATUS_LABEL[v] ?? v;
  if (key === "companyId") return coShort(v);
  if (key === "areaId") return areaName(v);
  if (key === "outdoor") return v ? "屋外" : "屋内";
  if (key === "canAdvance") return v ? "可" : "不可";
  if (key === "dependsOn") return (v || []).map((id) => taskById(id)?.name ?? id).join("、") || "なし";
  return String(v);
}

// ---------- 描画：サマリーカード ----------
function ring(pct, color) {
  const r = 22, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<svg class="ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="${r}" fill="none" stroke="#e6e9ed" stroke-width="7"/>
    <circle cx="26" cy="26" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 26 26)" stroke-linecap="butt"/></svg>`;
}

function renderCards() {
  const all = tasks();
  const tmr = tomorrow();
  const pct = weightedProgress(all);
  const cnt = (s) => all.filter((t) => t.status === s).length;
  const delayed = all.filter((t) => t.status === "delayed");
  const maxLate = Math.max(0, ...delayed.map(lateDays));
  const tmrTasks = all.filter((t) => activeOn(t, tmr));
  const tmrCos = [...new Set(tmrTasks.map((t) => t.companyId))];
  const tmrWorkers = tmrTasks.reduce((s, t) => s + (t.workers || 0), 0);
  const outCos = new Set(tmrTasks.filter((t) => t.outdoor).map((t) => t.companyId));
  const f = forecast(tmr);
  const tmrOut = tmrTasks.filter((t) => t.outdoor).length;
  const vb = PERSONA_VIEW[actor.personaId]?.badge;
  const tag = (show) => (show && vb ? `<span class="c-tag">${h(vb)}</span>` : "");
  const pid = actor.personaId;
  const strip = [-1, 0, 1, 2, 3].map((n) => {
    const d = addDays(today(), n), fc = forecast(d);
    if (!fc) return "";
    return `<div class="wx-day ${n === 1 ? "tmr" : ""}"><span class="i">${WX_ICON[fc.icon] ?? "・"}</span>${n === 0 ? "今日" : n === 1 ? "明日" : md(d)}<br>${fc.precipProb ?? "-"}%</div>`;
  }).join("");

  els.cards.innerHTML = `
    <div class="card prog ${pid === "honsha" ? "focus" : ""}">${tag(pid === "honsha")}
      ${ring(pct, "#f47b20")}
      <div class="c-main">
        <div class="c-label">全体進捗（人工加重平均）</div>
        <div class="c-val">${pct.toFixed(1)}<small>%</small></div>
        <div class="c-sub">完了 ${cnt("done")}・進行中 ${cnt("in_progress")}・未着手 ${cnt("not_started")}・遅延 ${cnt("delayed")}（全 ${all.length} 工程）</div>
      </div>
    </div>
    <div class="card late clickable ${pid === "honsha" ? "focus" : ""}" data-flag="delayed" title="クリックで遅延工程のみ表示">${tag(pid === "honsha")}
      <div class="c-main">
        <div class="c-label">遅延工程数</div>
        <div class="c-val">${delayed.length}<small>件</small>${maxLate > 0 ? `<small style="color:#d93025;margin-left:10px">最大 +${maxLate}日</small>` : ""}</div>
        <div class="c-chips">${delayed.map((t) => `<span class="chip">${h(coShort(t.companyId))}：${h(t.name)}</span>`).join("") || '<span class="c-sub">遅延なし</span>'}</div>
      </div>
    </div>
    <div class="card tmr clickable ${pid === "jimu" ? "focus" : ""}" data-flag="tomorrow" title="クリックで明日の作業のみ表示">${tag(pid === "jimu")}
      <div class="c-main">
        <div class="c-label">明日 ${h(mdw(tmr))} の作業</div>
        <div class="c-val">${tmrCos.length}<small>社</small> ${tmrWorkers}<small>人</small> <small style="font-weight:400;color:#7b8794">${tmrTasks.length}作業</small></div>
        <div class="c-chips">${tmrCos.map((c) => `<span class="chip ${outCos.has(c) ? "out" : ""}">${outCos.has(c) ? "☂" : ""}${h(coShort(c))}</span>`).join("")}</div>
      </div>
    </div>
    <div class="card wx ${isRain(f) ? "rainy" : ""}">
      <span class="wx-icon">${f ? WX_ICON[f.icon] ?? "？" : "—"}</span>
      <div class="c-main">
        <div class="c-label">明日の天気${S.weather?.location ? `（${h(S.weather.location)}）` : ""}</div>
        ${f ? `<div class="c-val">${h(f.weather)} <small>降水 ${f.precipProb ?? "-"}%${f.precipMm != null ? ` / ${f.precipMm}mm` : ""}</small></div>
        <div class="c-sub">${f.tempHigh ?? "-"}℃ / ${f.tempLow ?? "-"}℃ ${h(f.note || "")}${tmrOut ? ` ・<b style="color:#1d5fa8">屋外作業 ${tmrOut}件に影響</b>` : ""}</div>` : '<div class="c-sub">予報データなし</div>'}
      </div>
      <div class="wx-days">${strip}</div>
    </div>`;
  els.cards.querySelectorAll(".card.clickable").forEach((c) =>
    c.addEventListener("click", () => { toggleFlag(c.dataset.flag); }));
}

// ---------- 描画：ガント ----------
function geometry() {
  const r = viewRange();
  const n = diffDays(r.start, r.end) + 1;
  const leftW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w")) || 900;
  const avail = Math.max(300, els.body.clientWidth - leftW);
  const dw = avail / n;
  const x = (day) => diffDays(r.start, day) * dw;
  return { ...r, n, dw, leftW, w: n * dw, x };
}

function nowFraction() {
  const m = /T(\d{2}):(\d{2})/.exec(S.site?.demoNow || "");
  return m ? (Number(m[1]) + Number(m[2]) / 60) / 24 : 0.5;
}

function renderHead(G) {
  const days = [...Array(G.n)].map((_, i) => addDays(G.start, i));
  const tmr = tomorrow();
  let weeks = "", wx = "", dnum = "", dwd = "";
  days.forEach((d, i) => {
    const dt = parse(d), wd = dt.getDay(), left = i * G.dw;
    if (wd === 1 || i === 0) {
      const endIdx = Math.min(G.n, i + (wd === 1 ? 7 : (8 - wd) % 7 || 7));
      const width = (endIdx - i) * G.dw;
      weeks += `<div class="gh-week" style="left:${left}px;width:${width}px">${width > 60 ? `${dt.getMonth() + 1}月${dt.getDate()}日〜` : ""}</div>`;
    }
    const fc = forecast(d);
    if (fc) {
      const cls = isRain(fc) ? `rain ${(fc.precipProb ?? 0) >= 80 ? "strong" : ""}` : "";
      wx += `<div class="wxc ${cls}" style="left:${left}px;width:${G.dw}px" title="${h(mdw(d))} ${h(fc.weather)} 降水確率${fc.precipProb}%${fc.note ? `\n${h(fc.note)}` : ""}"><span class="i">${WX_ICON[fc.icon] ?? ""}</span>${fc.precipProb ?? ""}</div>`;
    }
    const cls = [wd === 0 || wd === 6 ? "we" : "", wd === 6 ? "sat" : "", wd === 0 ? "sun" : "", d === today() ? "today" : "", d === tmr && ui.flags.has("tomorrow") ? "tmr" : ""].join(" ");
    dnum += `<div class="dc ${cls}" style="left:${left}px;width:${G.dw}px">${dt.getDate() === 1 ? `${dt.getMonth() + 1}/1` : dt.getDate()}</div>`;
    dwd += `<div class="dc ${cls}" style="left:${left}px;width:${G.dw}px">${WD[wd]}</div>`;
  });
  const ti = diffDays(G.start, today());
  const todayLine = ti >= 0 && ti < G.n ? `<div class="todayl" style="left:${(ti + nowFraction()) * G.dw}px"></div>` : "";
  els.head.innerHTML = `
    <div class="hrow">
      <div style="width:var(--left-w);flex:none;position:relative;border-right:2px solid #c9d0d7">
        <div style="height:24px;border-bottom:1px solid var(--line)"></div>
        <div style="height:40px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:flex-end;padding:0 10px;font-size:12.5px;color:#4a5560;font-weight:700">天気・降水確率（%） ▶</div>
        <div class="hcells" style="height:42px;border-right:0">
          <div>WBS</div><div>作業名</div><div>工区</div><div>階</div><div>担当会社</div><div>開始</div><div>終了</div><div class="r">人数</div><div>進捗</div><div class="c">状態</div>
        </div>
      </div>
      <div class="ghead" style="width:${G.w}px">
        <div class="gh-weeks">${weeks}</div>
        <div class="gh-wx">${wx}</div>
        <div class="gh-days">${dnum}</div>
        <div class="gh-wd">${dwd}</div>
        ${todayLine}
      </div>
    </div>`;
}

function renderBg(G) {
  let s = "";
  for (let i = 0; i < G.n; i++) {
    const d = addDays(G.start, i), wd = parse(d).getDay();
    if (wd === 0 || wd === 6) s += `<div class="we" style="left:${i * G.dw}px;width:${G.dw}px"></div>`;
    if (wd === 1) s += `<div class="wk" style="left:${i * G.dw}px"></div>`;
    if (isRain(forecast(d))) s += `<div class="rainc" style="left:${i * G.dw}px;width:${G.dw}px"></div>`;
  }
  const tmrI = diffDays(G.start, tomorrow());
  if (ui.flags.has("tomorrow") && tmrI >= 0 && tmrI < G.n) s += `<div class="tmrc" style="left:${tmrI * G.dw}px;width:${G.dw}px"></div>`;
  const ti = diffDays(G.start, today());
  if (ti >= 0 && ti < G.n) s += `<div class="todayl" style="left:${(ti + nowFraction()) * G.dw}px"></div>`;
  return `<div class="gbg" style="left:${G.leftW}px;width:${G.w}px">${s}</div>`;
}

function span(G, start, end) {
  const l = Math.max(0, G.x(start)), r = Math.min(G.w, G.x(end) + G.dw);
  return { l, r, w: r - l, visible: r > l, clipL: start < G.start, clipR: end > G.end };
}

function barHtml(G, t) {
  let s = "";
  const ch = changes.get(t.id);
  if (baseDiffers(t)) {
    const b = span(G, t.baselineStart, t.baselineEnd);
    if (b.visible) s += `<div class="bar-base" style="left:${b.l}px;width:${b.w}px" title="当初計画 ${h(mdw(t.baselineStart))}〜${h(mdw(t.baselineEnd))}"></div>`;
  }
  // AI による変更前の位置（ゴースト）
  if (ch?.prev && (ch.prev.start !== t.start || ch.prev.end !== t.end)) {
    const g = span(G, ch.prev.start, ch.prev.end);
    if (g.visible) s += `<div class="gbar" style="left:${g.l}px;width:${g.w}px;background:transparent;border:2px dashed #f47b20;top:5px;height:18px" title="変更前 ${h(mdw(ch.prev.start))}〜${h(mdw(ch.prev.end))}"></div>`;
  }
  const b = span(G, t.start, t.end);
  const late = lateDays(t);
  const label = `${h(coShort(t.companyId))} ${t.workers ? `${t.workers}名` : ""}${t.outdoor ? ' <span class="o">☂</span>' : ""}${late > 0 ? ` <b>+${late}日</b>` : ""}`;
  if (b.visible) {
    const prog = Math.max(0, Math.min(100, t.progress || 0));
    // 進捗の塗りは「全体期間に対する割合」で描く（表示範囲外で切れていても位置がずれないよう換算）
    const fullL = G.x(t.start), fullW = G.x(t.end) + G.dw - fullL;
    const fillW = Math.max(0, Math.min(b.w, fullL + (fullW * prog) / 100 - b.l));
    let rain = "";
    if (t.outdoor) {
      for (let d = t.start > G.start ? t.start : G.start; d <= t.end && d <= G.end; d = addDays(d, 1)) {
        if (isRain(forecast(d))) rain += `<div style="position:absolute;top:0;bottom:0;left:${G.x(d) - b.l}px;width:${G.dw}px;background:repeating-linear-gradient(135deg,rgba(43,123,214,.85) 0 3px,rgba(255,255,255,.6) 3px 6px)" title="雨予報"></div>`;
      }
    }
    s += `<div class="gbar ${h(t.status)} ${b.clipL ? "clipl" : ""} ${b.clipR ? "clipr" : ""}" style="left:${b.l}px;width:${b.w}px" title="${h(t.name)}\n${h(mdw(t.start))}〜${h(mdw(t.end))}（${durDays(t)}日）進捗 ${prog}%"><div class="fill" style="width:${fillW}px"></div>${rain}</div>`;
    const labelW = 130;
    if (b.r + labelW < G.w) s += `<div class="bar-lbl" style="left:${b.r + 6}px">${label}</div>`;
    else if (b.l > labelW) s += `<div class="bar-lbl" style="right:${G.w - b.l + 6}px">${label}</div>`;
  } else {
    const before = t.end < G.start;
    s += `<div class="bar-lbl" style="${before ? "left:4px" : "right:4px"};color:#7b8794">${before ? `◀ 〜${md(t.end)}` : `${md(t.start)}〜 ▶`}</div>`;
  }
  return s;
}

function taskRow(G, t) {
  const ch = changes.get(t.id);
  const late = lateDays(t);
  const prog = Math.max(0, Math.min(100, t.progress || 0));
  const cls = ["row", "task", baseDiffers(t) ? "has-base" : "", ch ? "changed" : "", flashIds.has(t.id) ? "flash" : "", ui.selected === t.id ? "sel" : ""].join(" ");
  const chTitle = ch ? (ch.added ? "AIが追加" : ch.fields.map((f) => `${FIELD_LABEL[f.key] ?? f.key}: ${fmtVal(f.key, f.from)} → ${fmtVal(f.key, f.to)}`).join("\n")) : "";
  return `<div class="${cls}" data-id="${h(t.id)}" ${chTitle ? `title="${h(chTitle)}"` : ""}>
    <div class="cells">
      <div class="wbs">${h(t.wbs)}</div>
      <div class="nm">${ch ? `<span class="chg">${ch.added ? "追加" : "更新"}</span>` : ""}${h(t.name)}${t.outdoor ? '<span class="out" title="屋外作業">☂</span>' : ""}${t.canAdvance && t.status === "not_started" ? '<span class="adv">前倒し可</span>' : ""}</div>
      <div>${h(areaName(t.areaId))}</div>
      <div>${h(t.floor || "")}</div>
      <div title="${h(L.company(t.companyId)?.name ?? "")}">${h(coShort(t.companyId))}</div>
      <div class="num">${h(mdw(t.start))}</div>
      <div class="num ${late > 0 ? "late-d" : ""}" ${late > 0 ? `title="当初 ${h(mdw(t.baselineEnd))}（+${late}日）"` : ""}>${h(mdw(t.end))}</div>
      <div class="num r">${t.workers ?? ""}</div>
      <div class="pg"><span class="bar"><i class="${h(t.status)}" style="width:${prog}%"></i></span><span class="v">${prog}%</span></div>
      <div class="c"><span class="badge ${h(t.status)}">${STATUS_LABEL[t.status] ?? h(t.status)}</span></div>
    </div>
    <div class="gcell" style="width:${G.w}px">${barHtml(G, t)}</div>
  </div>`;
}

function summaryRow(G, g) {
  const sm = g.summary;
  const closed = ui.collapsed.has(g.key);
  const lateN = g.tasks.filter((t) => t.status === "delayed").length;
  const kids = g.all.length ? g.all : g.tasks;
  const s = kids.reduce((m, t) => (t.start < m ? t.start : m), sm.start || "9999");
  const e = kids.reduce((m, t) => (t.end > m ? t.end : m), sm.end || "0000");
  const sp = span(G, s, e);
  const prog = Math.round(kids.length ? weightedProgress(kids) : sm.progress || 0);
  const fullL = G.x(s), fullW = G.x(e) + G.dw - fullL;
  const fillPct = sp.visible ? Math.max(0, Math.min(100, ((fullL + (fullW * prog) / 100 - sp.l) / sp.w) * 100)) : 0;
  const lbl = sp.visible
    ? (sp.r + 120 < G.w ? `<div class="bar-lbl" style="left:${sp.r + 8}px;top:8px;font-weight:700;color:#2d3135">${prog}%</div>` : "")
    : `<div class="bar-lbl" style="${e < G.start ? "left:4px" : "right:4px"};top:8px;color:#7b8794">${e < G.start ? `◀ 〜${md(e)}` : `${md(s)}〜 ▶`}</div>`;
  return `<div class="row group summary ${closed ? "closed" : ""} ${changes.get(sm.id) ? "changed" : ""}" data-group="${h(g.key)}">
    <div class="cells grid">
      <div class="wbs"><span class="caret">▼</span>${h(sm.wbs)}</div>
      <div class="nm" title="${h(sm.name)}">${h(sm.name)}${lateN ? ` <span class="g-late">遅延 ${lateN}</span>` : ""}</div>
      <div>${h(areaName(sm.areaId))}</div>
      <div>${h(sm.floor || "")}</div>
      <div class="muted">${g.tasks.length}作業</div>
      <div class="num">${h(mdw(s))}</div>
      <div class="num">${h(mdw(e))}</div>
      <div></div>
      <div class="pg"><span class="bar"><i style="width:${prog}%;background:#59626b"></i></span><span class="v">${prog}%</span></div>
      <div></div>
    </div>
    <div class="gcell" style="width:${G.w}px">${sp.visible ? `<div class="sumbar" style="left:${sp.l}px;width:${sp.w}px"><i style="width:${fillPct}%"></i></div>` : ""}${lbl}</div>
  </div>`;
}

function groupRow(G, g) {
  if (g.summary) return summaryRow(G, g);
  const closed = ui.collapsed.has(g.key);
  const lateN = g.tasks.filter((t) => t.status === "delayed").length;
  const s = g.tasks.reduce((m, t) => (t.start < m ? t.start : m), "9999");
  const e = g.tasks.reduce((m, t) => (t.end > m ? t.end : m), "0000");
  const sp = span(G, s, e);
  return `<div class="row group ${closed ? "closed" : ""}" data-group="${h(g.key)}">
    <div class="cells">
      <span class="caret">▼</span><span class="g-name">${h(g.name)}</span>
      ${g.sub ? `<span class="g-sub">${h(g.sub)}</span>` : ""}
      <span class="g-sub">${g.tasks.length}作業</span>
      ${lateN ? `<span class="g-late">遅延 ${lateN}</span>` : ""}
      <span class="g-pg">進捗 ${weightedProgress(g.tasks).toFixed(0)}%</span>
    </div>
    <div class="gcell" style="width:${G.w}px">${sp.visible ? `<div class="sumbar" style="left:${sp.l}px;width:${sp.w}px"></div>` : ""}</div>
  </div>`;
}

function milestoneRows(G) {
  // マイルストーンは 1 行（レーン）にまとめて菱形で表示する
  const ms = S.schedule?.milestones ?? [];
  const noFilter = !ui.company && !ui.area && !ui.flags.size;
  const onlyTmr = !ui.company && !ui.area && ui.flags.size === 1 && ui.flags.has("tomorrow");
  const list = ms.filter((m) => noFilter || (onlyTmr && m.date === tomorrow())).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return "";
  const inR = list.filter((m) => m.date >= G.start && m.date <= G.end);
  const after = list.filter((m) => m.date > G.end);
  const next = list.find((m) => m.date >= today());
  const lastX = inR.length ? G.x(inR[inR.length - 1].date) + G.dw / 2 : 0;
  const showAfter = after.length && lastX < G.w - 190;
  let g = "";
  inR.forEach((m, i) => {
    const xx = G.x(m.date) + G.dw / 2;
    const nx = i + 1 < inR.length ? G.x(inR[i + 1].date) + G.dw / 2 : G.w - (showAfter ? 190 : 0);
    const room = nx - xx - 22;
    const past = m.date < today();
    g += `<div class="ms ${past ? "past" : ""}" style="left:${xx}px" title="${h(m.name)} ${h(mdw(m.date))}"></div>`;
    if (room > 30) g += `<div class="ms-lbl" style="left:${xx + 12}px;max-width:${room}px" title="${h(m.name)}">${h(md(m.date))} ${h(m.name)}</div>`;
  });
  if (showAfter) g += `<div class="bar-lbl" style="right:4px;top:10px;color:#7b8794" title="${h(after.map((m) => `${md(m.date)} ${m.name}`).join("\n"))}">${h(md(after[0].date))} ${h(after[0].name)}${after.length > 1 ? ` ほか${after.length - 1}件` : ""} ▶</div>`;
  return `<div class="row ms-lane" title="${h(list.map((m) => `${mdw(m.date)} ${m.name}`).join("\n"))}">
    <div class="cells"><div class="wbs" style="font-size:16px;color:#2d3135">◆</div>
      <div class="nm" style="grid-column: span 5">マイルストーン <span class="ms-next">${list.length}件${next ? ` ／ 次：${h(mdw(next.date))} ${h(next.name)}` : ""}</span></div>
      <div></div><div></div><div></div><div></div></div>
    <div class="gcell" style="width:${G.w}px">${g}</div>
  </div>`;
}

function renderGantt() {
  if (!S.schedule) {
    els.head.innerHTML = "";
    els.body.innerHTML = '<div class="loading">工程データを読み込み中…</div>';
    return;
  }
  const G = geometry();
  renderHead(G);
  const list = filterTasks();
  const groups = groupTasks(list);
  let rows = milestoneRows(G);
  for (const g of groups) {
    rows += groupRow(G, g);
    if (!ui.collapsed.has(g.key)) rows += g.tasks.map((t) => taskRow(G, t)).join("");
  }
  const st = els.body.scrollTop;
  els.body.innerHTML = `<div class="inner">${renderBg(G)}${rows}</div>`;
  els.body.scrollTop = st;
  els.empty.hidden = list.length > 0;

  // 結果行
  const fl = [];
  if (ui.flags.has("tomorrow")) fl.push(`明日 ${mdw(tomorrow())} の作業`);
  if (ui.flags.has("delayed")) fl.push("遅延のみ");
  if (ui.flags.has("outdoor")) fl.push("屋外作業のみ");
  if (ui.company) fl.push(`担当会社：${coShort(ui.company)}`);
  if (ui.area) fl.push(`工区：${areaName(ui.area)}`);
  const cos = new Set(list.map((t) => t.companyId)).size;
  const wk = list.reduce((s, t) => s + (t.workers || 0), 0);
  els.result.innerHTML = `<b>${list.length}</b> 作業 / ${cos} 社 / 計 ${wk} 人${fl.map((f) => `<span class="fl">${h(f)}</span>`).join("")}${changes.size ? `<span class="fl" style="background:#f47b20;color:#fff">AI更新 ${changes.size}件</span>` : ""}`;
  els.clear.hidden = !(ui.flags.size || ui.company || ui.area);

  if (flashIds.size) {
    const first = els.body.querySelector(".row.flash");
    if (first) {
      const br = els.body.getBoundingClientRect(), rr = first.getBoundingClientRect();
      if (rr.top < br.top || rr.bottom > br.bottom) first.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    flashIds = new Set(); // 次の再描画では点滅させない
  }
}

// ---------- 詳細パネル ----------
function renderDetail() {
  const t = ui.selected && taskById(ui.selected);
  if (!t) { els.detail.hidden = true; return; }
  els.detail.hidden = false;
  els.dWbs.textContent = `WBS ${t.wbs ?? ""} ・ ${t.id}`;
  els.dTitle.textContent = t.name;
  const co = L.company(t.companyId);
  const late = lateDays(t);
  const lateStart = t.baselineStart ? diffDays(t.baselineStart, t.start) : 0;
  const prog = Math.max(0, Math.min(100, t.progress || 0));
  const color = { done: "#4e9a5b", in_progress: "#2f74c0", not_started: "#8c99a6", delayed: "#d93025" }[t.status] ?? "#2f74c0";
  const deps = (t.dependsOn ?? []).map(taskById).filter(Boolean);
  const missing = (t.dependsOn ?? []).filter((id) => !taskById(id));
  const succ = tasks().filter((x) => (x.dependsOn ?? []).includes(t.id));
  const link = (x) => `<a class="d-link" data-goto="${h(x.id)}"><span class="badge ${h(x.status)}">${STATUS_LABEL[x.status] ?? ""}</span>${h(x.wbs)} ${h(x.name)}<span class="muted" style="margin-left:auto">${h(md(x.start))}〜${h(md(x.end))}</span></a>`;
  const wxDays = [];
  for (let d = t.start; d <= t.end && wxDays.length < 14; d = addDays(d, 1)) { const f = forecast(d); if (f) wxDays.push([d, f]); }
  const ch = changes.get(t.id);

  els.dBody.innerHTML = `
    <div class="d-tags">
      <span class="badge ${h(t.status)}" style="font-size:13.5px">${STATUS_LABEL[t.status] ?? h(t.status)}</span>
      ${t.category ? `<span class="d-tag">${h(t.category)}</span>` : ""}
      ${t.outdoor ? '<span class="d-tag out">☂ 屋外作業（雨天影響あり）</span>' : '<span class="d-tag in">屋内作業</span>'}
      ${t.canAdvance ? '<span class="d-tag adv">前倒し可</span>' : '<span class="d-tag noadv">前倒し不可</span>'}
    </div>
    ${ch ? `<div class="d-sec"><h3>AIによる変更</h3><div class="d-chg">${ch.added ? "<div>この作業はAIが追加しました</div>" : ""}${ch.fields.map((f) => `<div><b>${h(FIELD_LABEL[f.key] ?? f.key)}</b>：<span class="muted" style="text-decoration:line-through">${h(fmtVal(f.key, f.from))}</span> → <b>${h(fmtVal(f.key, f.to))}</b></div>`).join("")}</div></div>` : ""}
    <div class="d-sec"><h3>進捗</h3>
      <div class="d-prog"><span class="bar"><i style="width:${prog}%;background:${color}"></i></span><b>${prog}%</b></div>
    </div>
    <div class="d-sec"><h3>基本情報</h3>
      <table class="d-table">
        <tr><th>工区</th><td>${h(areaName(t.areaId))}${t.floor ? ` ／ ${h(t.floor)}` : ""}</td></tr>
        <tr><th>担当会社</th><td>${h(co?.name ?? t.companyId)}${co?.trade ? ` <span class="muted">（${h(co.trade)}）</span>` : ""}</td></tr>
        <tr><th>予定人数</th><td>${t.workers ?? "—"} 名／日 <span class="muted">（延べ ${(t.workers || 0) * durDays(t)} 人日）</span></td></tr>
        <tr><th>工種</th><td>${h(t.category ?? "—")}</td></tr>
      </table>
    </div>
    <div class="d-sec"><h3>日程</h3>
      <table class="d-table">
        <tr><th>現在の予定</th><td><b>${h(mdw(t.start))} 〜 ${h(mdw(t.end))}</b>（${durDays(t)}日間）</td></tr>
        <tr><th>当初計画</th><td>${t.baselineStart ? `${h(mdw(t.baselineStart))} 〜 ${h(mdw(t.baselineEnd))}（${diffDays(t.baselineStart, t.baselineEnd) + 1}日間）` : "—"}</td></tr>
        <tr><th>計画との差</th><td>${late > 0 ? `<span class="late-d">終了 +${late}日 遅れ</span>` : late < 0 ? `終了 ${late}日（前倒し）` : "終了日は計画どおり"}${lateStart ? ` ／ 開始 ${lateStart > 0 ? "+" : ""}${lateStart}日` : ""}</td></tr>
      </table>
    </div>
    ${wxDays.length ? `<div class="d-sec"><h3>期間中の天気予報</h3><div class="d-wx">${wxDays.map(([d, f]) => `<span class="${isRain(f) ? "rain" : ""}">${h(md(d))}<br>${WX_ICON[f.icon] ?? ""} ${f.precipProb ?? "-"}%</span>`).join("")}</div></div>` : ""}
    <div class="d-sec"><h3>先行作業（dependsOn）</h3>${deps.map(link).join("") || '<div class="muted">なし</div>'}${missing.map((id) => `<div class="muted">${h(id)}（見つかりません）</div>`).join("")}</div>
    <div class="d-sec"><h3>後続作業</h3>${succ.map(link).join("") || '<div class="muted">なし</div>'}</div>
    <div class="d-sec"><h3>備考</h3>${t.note ? `<div class="d-note">${h(t.note)}</div>` : '<div class="muted">—</div>'}</div>`;
  els.dBody.querySelectorAll("[data-goto]").forEach((a) => a.addEventListener("click", () => select(a.dataset.goto, true)));
}

function select(id, scroll) {
  ui.selected = id;
  writeUrl();
  els.body.querySelectorAll(".row.sel").forEach((r) => r.classList.remove("sel"));
  const row = id && els.body.querySelector(`.row[data-id="${CSS.escape(id)}"]`);
  if (row) { row.classList.add("sel"); if (scroll) row.scrollIntoView({ block: "center", behavior: "smooth" }); }
  renderDetail();
}

// ---------- フィルター UI ----------
function renderFilters() {
  const coIds = [...new Set(tasks().map((t) => t.companyId))];
  const siteOrder = (S.site?.companies ?? []).map((c) => c.id);
  coIds.sort((a, b) => siteOrder.indexOf(a) - siteOrder.indexOf(b));
  els.company.innerHTML = `<option value="">すべて（${coIds.length}社）</option>` +
    coIds.map((id) => `<option value="${h(id)}">${h(coShort(id))}</option>`).join("");
  els.company.value = ui.company;
  const areaIds = [...new Set(tasks().map((t) => t.areaId))];
  const areas = (S.site?.areas ?? []).filter((a) => areaIds.includes(a.id));
  els.area.innerHTML = `<option value="">すべて</option>` + areas.map((a) => `<option value="${h(a.id)}">${h(a.name)}（${h(a.floors)}）</option>`).join("");
  els.area.value = ui.area;
  syncControls();
}
function syncControls() {
  document.querySelectorAll(".tg").forEach((b) => b.classList.toggle("on", ui.flags.has(b.dataset.flag)));
  document.querySelectorAll("#seg-group button").forEach((b) => b.classList.toggle("on", b.dataset.v === ui.group));
  document.querySelectorAll("#seg-range button").forEach((b) => b.classList.toggle("on", b.dataset.v === ui.range));
  els.company.classList.toggle("on", !!ui.company);
  els.area.classList.toggle("on", !!ui.area);
}
function toggleFlag(f) {
  ui.flags.has(f) ? ui.flags.delete(f) : ui.flags.add(f);
  update();
}
function update() { syncControls(); writeUrl(); renderGantt(); }

function renderAll() {
  renderFilters();
  renderCards();
  renderGantt();
  renderDetail();
  if (S.schedule?.project?.name) document.getElementById("project-name").textContent = S.schedule.project.name;
  else if (S.site?.site?.name) document.getElementById("project-name").textContent = S.site.site.name;
  if (updatedAt) els.updated.textContent = `最終更新 ${updatedAt}`;
}

// ---------- イベント ----------
document.querySelectorAll(".tg").forEach((b) => b.addEventListener("click", () => toggleFlag(b.dataset.flag)));
els.company.addEventListener("change", () => { ui.company = els.company.value; update(); });
els.area.addEventListener("change", () => { ui.area = els.area.value; update(); });
els.clear.addEventListener("click", () => { ui.flags.clear(); ui.company = ""; ui.area = ""; update(); });
document.querySelectorAll("#seg-group button").forEach((b) => b.addEventListener("click", () => { ui.group = b.dataset.v; ui.collapsed.clear(); update(); }));
document.querySelectorAll("#seg-range button").forEach((b) => b.addEventListener("click", () => { ui.range = b.dataset.v; update(); }));
$("expand-all").addEventListener("click", () => { ui.collapsed.clear(); renderGantt(); });
$("collapse-all").addEventListener("click", () => {
  els.body.querySelectorAll(".row.group").forEach((r) => { if (r.dataset.group !== "_ms") ui.collapsed.add(r.dataset.group); });
  renderGantt();
});
els.body.addEventListener("click", (e) => {
  const g = e.target.closest(".row.group");
  if (g) { const k = g.dataset.group; ui.collapsed.has(k) ? ui.collapsed.delete(k) : ui.collapsed.add(k); renderGantt(); return; }
  const r = e.target.closest(".row.task");
  if (r) select(ui.selected === r.dataset.id ? null : r.dataset.id);
});
$("d-close").addEventListener("click", () => select(null));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") select(null); });
let rz;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(renderGantt, 80); });

// ---------- 起動 ----------
readUrl();
syncControls();
renderGantt();
watchState(["schedule", "weather"], (state, { initial }) => {
  S = { site: state.site, schedule: state.schedule, weather: state.weather };
  L = lookup(S.site);
  actor = currentActor(state);
  const switched = actorKey != null && actorKey !== actor.personaId;
  if ((actorKey == null && !hadUrlParams) || switched) applyPersonaView();
  actorKey = actor.personaId;
  renderActor();
  // 目線の切替では工程データの差分表示（ハイライト）を出さない
  detectChanges(initial || !prevTasks || switched);
  const n = new Date();
  updatedAt = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}:${String(n.getSeconds()).padStart(2, "0")}`;
  renderAll();
});

// ---------- ペイン幅のドラッグ変更（左の表とガントの境目・詳細パネル） ----------
import { addSplitter } from "/shared/resize.js";
{
  const fire = () => window.dispatchEvent(new Event("resize"));
  addSplitter({ container: document.getElementById("sched"), side: "left", cssVar: "--left-w", min: 860, max: 1500, key: "sch-left", onChange: fire });
  addSplitter({ container: document.getElementById("detail"), side: "right", cssVar: "--detail-w", def: 460, min: 320, max: 900, key: "sch-detail" });
}
