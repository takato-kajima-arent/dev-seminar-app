// メール画面（現在のアクター＝「自分」の受信箱。currentActor(state).personId）
//   URL: /mail?label=lbl-nippo  … ラベルで絞り込み
//        /mail?id=mail-001      … そのメールを含むスレッドを開く
//        /mail?q=日報           … 検索
import { watchState, lookup, escapeHtml, fileUrl, fmt, currentActor } from "/shared/api.js";

/* ---------- アイコン ---------- */
const P = {
  inbox: "M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z",
  star: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  starO: "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z",
  important: "M3.5 18.99l11 .01c.67 0 1.27-.33 1.63-.84L20.5 12l-4.37-6.16c-.36-.51-.96-.84-1.63-.84l-11 .01L8.34 12 3.5 18.99z",
  send: "M2.01 21 23 12 2.01 3 2 10l15 2-15 2z",
  all: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  label: "M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z",
  refresh: "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 19 17.59 13.41 12z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  reply: "M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
  replyAll: "M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
  forward: "M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z",
  more: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  prev: "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z",
  next: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
  attach: "M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z",
  archive: "M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5 6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z",
  trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  unread: "M20 6H10v6H8V4h6V0H6v6H4v2h2v2h2V8h2v6h10V6zm-2 6h-6V8h6v4z",
  open: "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
};
const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name]}"/></svg>`;

/* ---------- 定数 ---------- */
const SYSTEM_VIEWS = [
  { id: "inbox", name: "受信トレイ", icon: "inbox", count: "unread" },
  { id: "starred", name: "スター付き", icon: "star" },
  { id: "important", name: "重要", icon: "important" },
  { id: "sent", name: "送信済み", icon: "send" },
  { id: "all", name: "すべてのメール", icon: "all" },
];
const SYSTEM_IDS = new Set(SYSTEM_VIEWS.map((v) => v.id));
const LABEL_COLORS = {
  "lbl-site": { dot: "#16a765", bg: "#c9ecd6", fg: "#0b5a36" },
  "lbl-nippo": { dot: "#f2a600", bg: "#fde6b3", fg: "#7a4a00" },
  "lbl-honsha": { dot: "#4a86e8", bg: "#d3e3fd", fg: "#0b3f91" },
};
const PALETTE = [
  { dot: "#a479e2", bg: "#e8dcfb", fg: "#4a1f8c" },
  { dot: "#e66550", bg: "#fbd3cc", fg: "#8a1c0c" },
  { dot: "#2da2bb", bg: "#c8eaf2", fg: "#0b5566" },
  { dot: "#b65775", bg: "#f5d0dc", fg: "#6e1934" },
  { dot: "#7a8b28", bg: "#e4ebc4", fg: "#3d4710" },
];

/* ---------- 状態 ---------- */
let S = null; // { mail, storage, site }
let L = lookup(null);
const ui = {
  view: "inbox",
  q: "",
  thread: null, // 開いているスレッド ID
  focusId: null, // スレッド内でフォーカスするメール
  expanded: new Set(),
  localRead: new Map(), // "personId|mailId" -> bool（アクターごと）
  localStar: new Map(), // "personId|mailId" -> bool（アクターごと）
  actor: null, // 直近に描画したアクターの personId
  known: null, // 既知のメール ID
  fresh: new Set(), // 新着（強調表示）
  navCollapsed: false,
};
const tableCache = new Map();

/* ---------- ユーティリティ ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const today = () => S?.site?.today ?? fmt.ymd(new Date());
const demoNow = () => new Date(S?.site?.demoNow ?? Date.now());
// 「自分」＝ 現在のアクター（トップページで切替）。mailbox.ownerId は使わない
const LEGACY_OWNER = "u-sato"; // 旧データの read/starred は佐藤さん分として扱う
const ownerId = () => currentActor(S).personId;
const ownerAddr = () => L.person(ownerId())?.email ?? "";
const files = () => new Map((S?.storage?.files ?? []).map((f) => [f.id, f]));
/** 宛先・差出人から personId を得る（personId が無ければ email で site.people を引く） */
function personIdOf(who) {
  if (!who) return null;
  if (who.personId) return who.personId;
  const em = String(who.email ?? "").toLowerCase();
  if (!em) return null;
  return (S?.site?.people ?? []).find((p) => String(p.email ?? "").toLowerCase() === em)?.id ?? null;
}
const isOwner = (who) => !!who && personIdOf(who) === ownerId();
const inMyInbox = (m) => [...(m.to ?? []), ...(m.cc ?? [])].some(isOwner);
const sentByMe = (m) => isOwner(m.from);
const visibleToMe = (m) => inMyInbox(m) || sentByMe(m);
const localKey = (id) => `${ownerId()}|${id}`;
function serverFlag(m, listKey, legacyKey) {
  const me = ownerId();
  if (Array.isArray(m[listKey])) return m[listKey].includes(me);
  return me === LEGACY_OWNER ? !!m[legacyKey] : false;
}
const isRead = (m) => {
  const k = localKey(m.id);
  if (ui.localRead.has(k)) return ui.localRead.get(k);
  return sentByMe(m) || serverFlag(m, "readBy", "read"); // 自分が送ったメールは既読扱い
};
const isStarred = (m) => {
  const k = localKey(m.id);
  return ui.localStar.has(k) ? ui.localStar.get(k) : serverFlag(m, "starredBy", "starred");
};
const shortName = (n) => String(n ?? "").split(/[（(]/)[0].trim();
const labelsById = () => new Map((S?.mail?.labels ?? []).map((l) => [l.id, l]));
const customLabels = () => (S?.mail?.labels ?? []).filter((l) => !SYSTEM_IDS.has(l.id));
function labelColor(id) {
  if (LABEL_COLORS[id]) return LABEL_COLORS[id];
  const idx = customLabels().findIndex((l) => l.id === id);
  return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
}
const ymdOf = (iso) => String(iso ?? "").slice(0, 10);
function listDate(iso) {
  const d = new Date(iso);
  if (ymdOf(iso) === today()) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (ymdOf(iso).slice(0, 4) === today().slice(0, 4)) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
function fullDate(iso) {
  const d = new Date(iso);
  const diff = (demoNow() - d) / 60000;
  let rel = "";
  if (diff >= 0) {
    if (diff < 60) rel = `${Math.max(1, Math.round(diff))} 分前`;
    else if (diff < 60 * 24) rel = `${Math.floor(diff / 60)} 時間前`;
    else rel = `${Math.floor(diff / 1440)} 日前`;
  }
  const s = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${fmt.weekday(iso)}) ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return rel ? `${s}（${rel}）` : s;
}
const snippet = (body, n = 160) => String(body ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function fileKind(f) {
  const mime = f?.mime ?? "";
  const name = (f?.name ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/sheet|excel/.test(mime) || /\.xlsx?$/.test(name)) return "xlsx";
  if (/word/.test(mime) || /\.docx?$/.test(name)) return "doc";
  if (mime.startsWith("text/") || /\.(txt|csv|md)$/.test(name)) return "text";
  return "file";
}
const KIND_LABEL = { image: "IMG", pdf: "PDF", xlsx: "XLS", doc: "DOC", text: "TXT", file: "FILE" };
const kindBadge = (kind, cls = "") => `<span class="ftype ft-${kind} ${cls}">${KIND_LABEL[kind]}</span>`;

function avatar(who, size = "") {
  const p = who?.personId ? L.person(who.personId) : null;
  const name = p?.name ?? who?.name ?? who?.email ?? "?";
  const color = p?.color ?? "#5f6368";
  const ch = p?.isBot ? "AI" : shortName(name).charAt(0);
  return `<span class="avatar ${size}" style="background:${escapeHtml(color)}" title="${escapeHtml(name)}">${escapeHtml(ch)}</span>`;
}

/* 検索 */
const tokens = () => ui.q.toLowerCase().split(/[\s　]+/).filter(Boolean);
function haystack(m, fm) {
  return [m.subject, m.body, m.from?.name, m.from?.email, ...(m.to ?? []).map((x) => `${x.name} ${x.email}`), ...(m.cc ?? []).map((x) => `${x.name} ${x.email}`), ...(m.attachments ?? []).map((a) => fm.get(a.fileId)?.name)]
    .join("\n")
    .toLowerCase();
}
function hl(text) {
  let h = escapeHtml(text);
  const t = tokens();
  if (!t.length) return h;
  const re = new RegExp(`(${t.map((x) => escapeHtml(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return h.replace(re, "<mark>$1</mark>");
}

// labelIds の "inbox"/"sent" は使わない（宛先・差出人から決まる）
function matchesView(m, view) {
  if (!visibleToMe(m)) return false;
  switch (view) {
    case "all": return true;
    case "starred": return isStarred(m);
    case "sent": return sentByMe(m);
    case "inbox": return inMyInbox(m);
    default: return (m.labelIds ?? []).includes(view);
  }
}

/* スレッド */
function allThreads() {
  const map = new Map();
  for (const m of S?.mail?.messages ?? []) {
    if (!visibleToMe(m)) continue; // 自分が送受信していないメールは出さない
    const k = m.threadId || m.id;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  return [...map.entries()].map(([id, msgs]) => {
    msgs.sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
    return { id, msgs, latest: msgs[msgs.length - 1] };
  });
}
function visibleThreads() {
  const fm = files();
  const t = tokens();
  return allThreads()
    .filter((th) => (t.length ? th.msgs.some((m) => t.every((x) => haystack(m, fm).includes(x))) : th.msgs.some((m) => matchesView(m, ui.view))))
    .sort((a, b) => new Date(b.latest.receivedAt) - new Date(a.latest.receivedAt));
}
const unreadThreadCount = (view) => allThreads().filter((th) => th.msgs.some((m) => matchesView(m, view) && !isRead(m))).length;
const threadOfMail = (id) => allThreads().find((th) => th.msgs.some((m) => m.id === id));

/* ---------- URL ---------- */
function readUrl() {
  const u = new URL(location.href);
  ui.view = u.searchParams.get("label") || "inbox";
  ui.q = u.searchParams.get("q") || "";
  const id = u.searchParams.get("id");
  ui.focusId = id;
  ui.thread = null;
  ui.pendingId = id;
  $("#search").value = ui.q;
  $("#search-clear").hidden = !ui.q;
}
function writeUrl(push = true) {
  const u = new URL(location.href);
  u.search = "";
  if (ui.view !== "inbox") u.searchParams.set("label", ui.view);
  if (ui.q) u.searchParams.set("q", ui.q);
  if (ui.thread) {
    const th = allThreads().find((t) => t.id === ui.thread);
    const id = ui.focusId && th?.msgs.some((m) => m.id === ui.focusId) ? ui.focusId : th?.latest.id;
    if (id) u.searchParams.set("id", id);
  }
  if (u.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", u);
}

/* ---------- 描画: サイドナビ ---------- */
function renderNav() {
  const item = (id, name, iconHtml, count, extra = "") =>
    `<a href="?label=${encodeURIComponent(id)}" class="nav-item ${!ui.q && ui.view === id ? "on" : ""} ${count ? "has-unread" : ""}" data-view="${escapeHtml(id)}" title="${escapeHtml(name)}" ${extra}>
      ${iconHtml}<span class="nav-name">${escapeHtml(name)}</span><span class="nav-count">${count || ""}</span></a>`;
  const sys = SYSTEM_VIEWS.map((v) => item(v.id, labelsById().get(v.id)?.name ?? v.name, icon(v.icon), v.count === "unread" ? unreadThreadCount(v.id) : 0)).join("");
  const labs = customLabels()
    .map((l) => item(l.id, l.name, `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="${labelColor(l.id).dot}" d="${P.label}"/></svg>`, unreadThreadCount(l.id)))
    .join("");
  $("#nav").innerHTML = sys + (labs ? `<div class="nav-head">ラベル</div>${labs}` : "");
}

/* ---------- 描画: 一覧 ---------- */
function viewTitle() {
  if (ui.q) return `「${ui.q}」の検索結果`;
  const sv = SYSTEM_VIEWS.find((v) => v.id === ui.view);
  return labelsById().get(ui.view)?.name ?? sv?.name ?? ui.view;
}
function labelChips(ids, exclude = [], big = false) {
  const lm = labelsById();
  return (ids ?? [])
    .filter((id) => !SYSTEM_IDS.has(id) && !exclude.includes(id))
    .map((id) => {
      const c = labelColor(id);
      return `<span class="chip ${big ? "chip-lg" : ""}" style="background:${c.bg};color:${c.fg}">${escapeHtml(lm.get(id)?.name ?? id)}</span>`;
    })
    .join("");
}
function senderCell(th) {
  const seen = [];
  for (const m of th.msgs) {
    const nm = isOwner(m.from) ? "自分" : th.msgs.length > 1 ? shortName(m.from?.name || m.from?.email) : m.from?.name || m.from?.email;
    const unread = !isRead(m);
    const ex = seen.find((s) => s.nm === nm);
    if (ex) ex.unread ||= unread;
    else seen.push({ nm, unread });
  }
  // 送信済みビューでは宛先を表示
  if (ui.view === "sent" && !ui.q && th.msgs.every((m) => isOwner(m.from))) {
    const to = th.latest.to?.map((x) => shortName(x.name || x.email)).join(", ");
    return `<span class="sender-name">宛先: ${escapeHtml(to)}</span>`;
  }
  const names = seen.map((s) => `<span class="${s.unread ? "u" : ""}">${escapeHtml(s.nm)}</span>`).join(", ");
  const cnt = th.msgs.length > 1 ? `<span class="tcount">${th.msgs.length}</span>` : "";
  return `<span class="sender-name">${names}</span>${cnt}`;
}
function renderList(scroll = 0) {
  const fm = files();
  const threads = visibleThreads();
  const exclude = ui.q ? [] : [ui.view];
  const rows = threads
    .map((th) => {
      const unread = th.msgs.some((m) => !isRead(m));
      const starred = th.msgs.some(isStarred);
      const important = th.msgs.some((m) => (m.labelIds ?? []).includes("important"));
      const labelIds = [...new Set(th.msgs.flatMap((m) => m.labelIds ?? []))];
      const atts = th.msgs.flatMap((m) => (m.attachments ?? []).map((a) => ({ ...a, mailId: m.id })));
      const fresh = th.msgs.some((m) => ui.fresh.has(m.id));
      const attHtml = atts.length
        ? `<div class="row-atts">${atts
            .slice(0, 3)
            .map((a) => {
              const f = fm.get(a.fileId);
              const k = fileKind(f);
              return `<button class="att-chip" data-preview="${escapeHtml(a.fileId)}" data-mail="${escapeHtml(a.mailId)}" title="${escapeHtml(f?.name ?? a.fileId)}">${kindBadge(k, "sm")}<span class="att-chip-name">${escapeHtml(f?.name ?? a.fileId)}</span></button>`;
            })
            .join("")}${atts.length > 3 ? `<span class="att-more">+${atts.length - 3}</span>` : ""}</div>`
        : "";
      return `<div class="row ${unread ? "unread" : "read"} ${fresh ? "fresh" : ""}" data-thread="${escapeHtml(th.id)}" tabindex="0">
        <span class="row-ctl">
          <span class="cb" aria-hidden="true"></span>
          <button class="star ${starred ? "on" : ""}" data-star="${escapeHtml(th.latest.id)}" title="${starred ? "スターを外す" : "スターを付ける"}">${icon(starred ? "star" : "starO")}</button>
          <span class="imp ${important ? "on" : ""}" title="${important ? "重要" : ""}">${icon("important")}</span>
        </span>
        <span class="row-from">${senderCell(th)}</span>
        <span class="row-main">
          <span class="row-line">${fresh ? `<span class="new-badge">新着</span>` : ""}${labelChips(labelIds, exclude)}<span class="subj">${hl(th.latest.subject || "（件名なし）")}</span><span class="snip"> - ${hl(snippet(th.latest.body))}</span></span>
          ${attHtml}
        </span>
        <span class="row-date" title="${escapeHtml(fullDate(th.latest.receivedAt))}">${atts.length ? icon("attach", "clip") : ""}${escapeHtml(listDate(th.latest.receivedAt))}</span>
      </div>`;
    })
    .join("");
  const total = threads.length;
  $("#panel").innerHTML = `
    <div class="toolbar">
      <span class="cb big" aria-hidden="true"></span>
      <button class="icon-btn" data-act="refresh" title="更新">${icon("refresh")}</button>
      <button class="icon-btn" title="その他">${icon("more")}</button>
      <span class="tb-title">${escapeHtml(viewTitle())}</span>
      <span class="sp"></span>
      <span class="pager">${total ? `1–${total} / ${total} 件` : "0 件"}</span>
      <button class="icon-btn" disabled>${icon("prev")}</button>
      <button class="icon-btn" disabled>${icon("next")}</button>
    </div>
    ${!ui.q && ui.view === "inbox" ? `<div class="tabs"><span class="tab on">${icon("inbox")}メイン</span></div>` : ""}
    <div class="scroll" id="scroll">
      ${rows || `<div class="empty">${S?.mail ? (ui.q ? "検索条件に一致するメールはありません" : "このラベルにはメールがありません") : "メールデータを読み込み中…"}</div>`}
    </div>`;
  $("#scroll").scrollTop = scroll;
}

/* ---------- 描画: 閲覧 ---------- */
function recipients(list) {
  return (list ?? []).map((x) => (isOwner(x) ? "自分" : escapeHtml(x.name || x.email))).join("、");
}
function renderMessage(m, th) {
  const fm = files();
  const open = ui.expanded.has(m.id);
  const fromName = m.from?.name || m.from?.email;
  if (!open) {
    return `<div class="msg collapsed ${isRead(m) ? "" : "unread"}" data-toggle="${escapeHtml(m.id)}" id="msg-${escapeHtml(m.id)}">
      ${avatar(m.from)}
      <div class="msg-cbody"><div class="msg-from"><b>${escapeHtml(isOwner(m.from) ? `${fromName}（自分）` : fromName)}</b></div><div class="msg-snip">${escapeHtml(snippet(m.body, 200))}</div></div>
      <div class="msg-date">${(m.attachments ?? []).length ? icon("attach", "clip") : ""}${escapeHtml(listDate(m.receivedAt))}</div>
    </div>`;
  }
  const atts = m.attachments ?? [];
  const attHtml = atts.length
    ? `<div class="atts">
        <div class="atts-head">添付ファイル ${atts.length} 件</div>
        <div class="atts-grid">${atts
          .map((a) => {
            const f = fm.get(a.fileId);
            const k = fileKind(f);
            const name = f?.name ?? a.fileId;
            const thumb =
              k === "image" && f
                ? `<img src="${fileUrl(a.fileId)}" alt="" loading="lazy" />`
                : `<span class="thumb-icon">${kindBadge(k, "xl")}</span>`;
            return `<div class="att-card k-${k}" data-preview="${escapeHtml(a.fileId)}" data-mail="${escapeHtml(m.id)}" tabindex="0" title="${escapeHtml(name)}">
              <div class="att-thumb">${thumb}</div>
              <div class="att-foot">${kindBadge(k, "sm")}<span class="att-name">${escapeHtml(name)}</span></div>
              <div class="att-hover">
                <div class="att-hover-name">${escapeHtml(name)}</div>
                <div class="att-hover-size">${escapeHtml(f ? fmt.size(f.size) : "ファイルが見つかりません")}</div>
                <div class="att-hover-btns">
                  <a class="round-btn" href="${fileUrl(a.fileId, true)}" data-nopreview title="ダウンロード">${icon("download")}</a>
                </div>
              </div>
            </div>`;
          })
          .join("")}</div></div>`
    : "";
  return `<div class="msg ${ui.fresh.has(m.id) ? "fresh" : ""}" id="msg-${escapeHtml(m.id)}">
    <div class="msg-head" data-toggle="${escapeHtml(m.id)}">
      ${avatar(m.from, "lg")}
      <div class="msg-who">
        <div class="msg-from"><b>${escapeHtml(fromName)}</b> <span class="addr">&lt;${escapeHtml(m.from?.email ?? "")}&gt;</span></div>
        <div class="msg-to">To: ${recipients(m.to)}${m.cc?.length ? `　Cc: ${recipients(m.cc)}` : ""}</div>
      </div>
      <div class="msg-meta">
        <span class="msg-date">${escapeHtml(fullDate(m.receivedAt))}</span>
        <button class="icon-btn star ${isStarred(m) ? "on" : ""}" data-star="${escapeHtml(m.id)}" title="スター">${icon(isStarred(m) ? "star" : "starO")}</button>
        <button class="icon-btn" data-act="reply" title="返信">${icon("reply")}</button>
        <button class="icon-btn" title="その他">${icon("more")}</button>
      </div>
    </div>
    <div class="msg-body">${hl(m.body ?? "")}</div>
    ${attHtml}
  </div>`;
}
function renderThread(scroll = 0) {
  const th = allThreads().find((t) => t.id === ui.thread);
  if (!th) {
    ui.thread = null;
    return renderList();
  }
  const list = visibleThreads();
  const idx = list.findIndex((t) => t.id === th.id);
  const labelIds = [...new Set(th.msgs.flatMap((m) => m.labelIds ?? []))];
  const important = labelIds.includes("important");
  $("#panel").innerHTML = `
    <div class="toolbar">
      <button class="icon-btn" data-act="back" title="${escapeHtml(viewTitle())}に戻る">${icon("back")}</button>
      <button class="icon-btn" title="アーカイブ">${icon("archive")}</button>
      <button class="icon-btn" title="削除">${icon("trash")}</button>
      <button class="icon-btn" data-act="mark-unread" title="未読にする">${icon("all")}</button>
      <button class="icon-btn" title="その他">${icon("more")}</button>
      <span class="sp"></span>
      <span class="pager">${idx >= 0 ? `${idx + 1} / ${list.length} 件` : ""}</span>
      <button class="icon-btn" data-act="newer" title="新しいメール" ${idx > 0 ? "" : "disabled"}>${icon("prev")}</button>
      <button class="icon-btn" data-act="older" title="古いメール" ${idx >= 0 && idx < list.length - 1 ? "" : "disabled"}>${icon("next")}</button>
    </div>
    <div class="scroll" id="scroll">
      <div class="thread">
        <div class="thread-head">
          <h1 class="thread-subj">${hl(th.latest.subject || th.msgs[0].subject || "（件名なし）")}</h1>
          ${important ? `<span class="imp on big" title="重要">${icon("important")}</span>` : ""}
          ${labelChips(labelIds, [], true)}
          ${th.msgs.some(inMyInbox) ? `<span class="chip chip-lg chip-sys">受信トレイ</span>` : ""}
        </div>
        ${th.msgs.length > 1 ? `<div class="thread-count">${th.msgs.length} 件のメッセージ</div>` : ""}
        ${th.msgs.map((m) => renderMessage(m, th)).join("")}
        <div class="reply-bar">
          <button class="pill-btn" data-act="reply">${icon("reply")}返信</button>
          <button class="pill-btn" data-act="reply">${icon("replyAll")}全員に返信</button>
          <button class="pill-btn" data-act="reply">${icon("forward")}転送</button>
        </div>
      </div>
    </div>`;
  $("#scroll").scrollTop = scroll;
}

function render({ keepScroll = false } = {}) {
  const sc = keepScroll ? $("#scroll")?.scrollTop ?? 0 : 0;
  renderNav();
  if (ui.thread) renderThread(sc);
  else renderList(sc);
  $("#app").classList.toggle("nav-collapsed", ui.navCollapsed);
  const unread = unreadThreadCount("inbox");
  document.title = `${unread ? `受信トレイ (${unread}) - ` : ""}メール`;
}

/* ---------- 操作 ---------- */
function openThread(threadId, focusId = null, push = true) {
  const th = allThreads().find((t) => t.id === threadId);
  if (!th) return;
  ui.thread = threadId;
  ui.focusId = focusId;
  ui.expanded = new Set(th.msgs.filter((m) => !isRead(m) || m.id === focusId).map((m) => m.id));
  ui.expanded.add(th.latest.id);
  for (const m of th.msgs) {
    ui.localRead.set(localKey(m.id), true);
    ui.fresh.delete(m.id);
  }
  writeUrl(push);
  render();
  if (focusId && focusId !== th.latest.id) {
    const el = document.getElementById(`msg-${focusId}`);
    if (el) {
      el.scrollIntoView({ block: "start" });
      el.classList.add("focus");
    }
  }
}
function closeThread(push = true) {
  ui.thread = null;
  ui.focusId = null;
  writeUrl(push);
  render();
}
function setView(view) {
  ui.view = view;
  ui.q = "";
  $("#search").value = "";
  $("#search-clear").hidden = true;
  ui.thread = null;
  writeUrl(true);
  render();
}

let toastTimer;
function toast(msg, ms = 3500) {
  const t = $("#toast");
  t.innerHTML = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

/* ---------- 添付プレビュー ---------- */
const pv = { list: [], idx: 0, sheet: 0 };
function openPreview(fileId, mailId) {
  const m = (S?.mail?.messages ?? []).find((x) => x.id === mailId);
  pv.list = (m?.attachments ?? []).map((a) => a.fileId);
  if (!pv.list.includes(fileId)) pv.list = [fileId];
  pv.idx = pv.list.indexOf(fileId);
  pv.sheet = 0;
  renderPreview();
}
function closePreview() {
  const o = $("#preview");
  o.hidden = true;
  o.innerHTML = "";
}
async function renderPreview() {
  const o = $("#preview");
  const id = pv.list[pv.idx];
  const f = files().get(id);
  const k = fileKind(f);
  const name = f?.name ?? id;
  o.hidden = false;
  o.innerHTML = `
    <div class="pv-bar">
      <button class="icon-btn light" data-pv="close" title="閉じる (Esc)">${icon("back")}</button>
      ${kindBadge(k)}
      <span class="pv-name">${escapeHtml(name)}</span>
      <span class="pv-size">${escapeHtml(f ? fmt.size(f.size) : "")}</span>
      <span class="sp"></span>
      <a class="icon-btn light" href="${fileUrl(id)}" target="_blank" rel="noopener" title="新しいタブで開く">${icon("open")}</a>
      <a class="icon-btn light" href="${fileUrl(id, true)}" title="ダウンロード">${icon("download")}</a>
      <button class="icon-btn light" data-pv="close" title="閉じる">${icon("close")}</button>
    </div>
    <div class="pv-stage k-${k}" data-pv="bg">
      ${pv.list.length > 1 ? `<button class="pv-nav prev" data-pv="prev" ${pv.idx > 0 ? "" : "disabled"} title="前へ">${icon("prev")}</button><button class="pv-nav next" data-pv="next" ${pv.idx < pv.list.length - 1 ? "" : "disabled"} title="次へ">${icon("next")}</button>` : ""}
      <div class="pv-content" id="pv-content"><div class="pv-loading">読み込み中…</div></div>
    </div>
    ${pv.list.length > 1 ? `<div class="pv-counter">${pv.idx + 1} / ${pv.list.length}</div>` : ""}`;
  const c = $("#pv-content");
  if (!f) {
    c.innerHTML = `<div class="pv-msg">ファイルが見つかりません（${escapeHtml(id)}）</div>`;
    return;
  }
  if (k === "image") {
    c.innerHTML = `<img class="pv-img" src="${fileUrl(id)}" alt="${escapeHtml(name)}" />`;
  } else if (k === "pdf") {
    c.innerHTML = `<iframe class="pv-pdf" src="${fileUrl(id)}#view=FitH" title="${escapeHtml(name)}"></iframe>`;
  } else if (k === "xlsx") {
    try {
      let data = tableCache.get(id);
      if (!data) {
        const res = await fetch(`/api/files/${encodeURIComponent(id)}/table`);
        data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || res.statusText);
        tableCache.set(id, data);
      }
      if (pv.list[pv.idx] !== id) return;
      renderSheet(c, data);
    } catch (e) {
      c.innerHTML = `<div class="pv-msg">プレビューを表示できません：${escapeHtml(e.message)}</div>`;
    }
  } else if (k === "text") {
    try {
      const txt = await (await fetch(fileUrl(id))).text();
      if (pv.list[pv.idx] !== id) return;
      c.innerHTML = `<pre class="pv-text">${escapeHtml(txt)}</pre>`;
    } catch (e) {
      c.innerHTML = `<div class="pv-msg">読み込みに失敗しました</div>`;
    }
  } else {
    c.innerHTML = `<div class="pv-msg">${kindBadge(k, "xl")}<p>このファイル形式はプレビューできません</p><a class="pill-btn" href="${fileUrl(id, true)}">${icon("download")}ダウンロード</a></div>`;
  }
}
const colName = (i) => {
  let s = "";
  i++;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};
function renderSheet(c, data) {
  const sheets = data.sheets ?? [];
  const sh = sheets[pv.sheet] ?? sheets[0];
  if (!sh) {
    c.innerHTML = `<div class="pv-msg">シートがありません</div>`;
    return;
  }
  const rows = sh.rows ?? [];
  let ncol = 0;
  for (const r of rows) {
    let last = r.length;
    while (last > 0 && (r[last - 1] === "" || r[last - 1] == null)) last--;
    ncol = Math.max(ncol, last);
  }
  ncol = Math.max(ncol, 1);
  const isNum = (v) => typeof v === "number";
  const body = rows
    .map(
      (r, ri) =>
        `<tr><th class="rh">${ri + 1}</th>${(() => {
          // /api/files/:id/table は結合セルの値を各セルに複製して返すため、
          // 横に同じ文字列が並ぶものは結合セルとみなして colspan でまとめる
          let html = "";
          for (let ci = 0; ci < ncol; ) {
            const v = r[ci] ?? "";
            let span = 1;
            if (typeof v === "string" && v !== "") while (ci + span < ncol && r[ci + span] === v) span++;
            html += `<td class="${isNum(v) ? "num" : ""}"${span > 1 ? ` colspan="${span}"` : ""}>${escapeHtml(isNum(v) ? v.toLocaleString("ja-JP") : v)}</td>`;
            ci += span;
          }
          return html;
        })()}</tr>`
    )
    .join("");
  c.innerHTML = `<div class="sheet">
    <div class="sheet-scroll"><table class="grid"><thead><tr><th class="corner"></th>${Array.from({ length: ncol }, (_, i) => `<th>${colName(i)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>
    <div class="sheet-tabs">${sheets.map((s, i) => `<button class="sheet-tab ${i === pv.sheet ? "on" : ""}" data-sheet="${i}">${escapeHtml(s.name)}</button>`).join("")}</div>
  </div>`;
}

/* ---------- イベント ---------- */
document.addEventListener("click", (e) => {
  const t = e.target;
  // プレビュー内
  if (t.closest("#preview")) {
    const b = t.closest("[data-pv],[data-sheet]");
    if (!b) return;
    if (b.dataset.sheet != null) {
      pv.sheet = Number(b.dataset.sheet);
      const data = tableCache.get(pv.list[pv.idx]);
      if (data) renderSheet($("#pv-content"), data);
      return;
    }
    const a = b.dataset.pv;
    if (a === "close" || (a === "bg" && t === b)) closePreview();
    else if (a === "prev" && pv.idx > 0) (pv.idx--, (pv.sheet = 0), renderPreview());
    else if (a === "next" && pv.idx < pv.list.length - 1) (pv.idx++, (pv.sheet = 0), renderPreview());
    return;
  }
  if (t.closest("[data-nopreview]")) return;
  const star = t.closest("[data-star]");
  if (star) {
    e.preventDefault();
    e.stopPropagation();
    const id = star.dataset.star;
    const m = S.mail.messages.find((x) => x.id === id);
    if (m) {
      const th = threadOfMail(id);
      const on = !(th ? th.msgs.some(isStarred) : isStarred(m));
      if (on) ui.localStar.set(localKey(id), true);
      else for (const x of th?.msgs ?? [m]) ui.localStar.set(localKey(x.id), false);
      render({ keepScroll: true });
    }
    return;
  }
  const pvBtn = t.closest("[data-preview]");
  if (pvBtn) {
    e.preventDefault();
    e.stopPropagation();
    openPreview(pvBtn.dataset.preview, pvBtn.dataset.mail);
    return;
  }
  const nav = t.closest("[data-view]");
  if (nav) {
    e.preventDefault();
    setView(nav.dataset.view);
    return;
  }
  const row = t.closest(".row[data-thread]");
  if (row) {
    openThread(row.dataset.thread);
    return;
  }
  const tg = t.closest("[data-toggle]");
  if (tg && !t.closest("button,a")) {
    const id = tg.dataset.toggle;
    const th = allThreads().find((x) => x.id === ui.thread);
    if (ui.expanded.has(id) && th && th.msgs.length > 1) ui.expanded.delete(id);
    else ui.expanded.add(id);
    render({ keepScroll: true });
    return;
  }
  const act = t.closest("[data-act]")?.dataset.act;
  if (!act) return;
  const list = visibleThreads();
  const idx = list.findIndex((x) => x.id === ui.thread);
  switch (act) {
    case "back": closeThread(); break;
    case "newer": if (idx > 0) openThread(list[idx - 1].id); break;
    case "older": if (idx >= 0 && idx < list.length - 1) openThread(list[idx + 1].id); break;
    case "refresh": render({ keepScroll: true }); toast("受信トレイを更新しました", 1800); break;
    case "toggle-nav": ui.navCollapsed = !ui.navCollapsed; render({ keepScroll: true }); break;
    case "mark-unread": {
      const th = allThreads().find((x) => x.id === ui.thread);
      if (th) ui.localRead.set(localKey(th.latest.id), false);
      closeThread();
      break;
    }
    case "compose":
    case "reply": toast("デモ環境のため、この画面からは送信できません"); break;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!$("#preview").hidden) closePreview();
    else if (ui.thread) closeThread();
  } else if (!$("#preview").hidden && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    const d = e.key === "ArrowLeft" ? -1 : 1;
    const n = pv.idx + d;
    if (n >= 0 && n < pv.list.length) (pv.idx = n, (pv.sheet = 0), renderPreview());
  } else if (e.key === "Enter" && e.target.matches?.(".row[data-thread]")) {
    openThread(e.target.dataset.thread);
  } else if (e.key === "Enter" && e.target.matches?.(".att-card")) {
    openPreview(e.target.dataset.preview, e.target.dataset.mail);
  }
});
const searchInput = $("#search");
searchInput.addEventListener("input", () => {
  ui.q = searchInput.value.trim();
  $("#search-clear").hidden = !ui.q;
  ui.thread = null;
  writeUrl(false);
  render();
});
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  writeUrl(true);
});
$("#search-clear").addEventListener("click", () => {
  searchInput.value = "";
  ui.q = "";
  $("#search-clear").hidden = true;
  writeUrl(false);
  render();
  searchInput.focus();
});
window.addEventListener("popstate", () => {
  readUrl();
  applyPending(false);
  render();
});

function applyPending(push) {
  if (!ui.pendingId || !S?.mail) return false;
  const th = threadOfMail(ui.pendingId);
  const id = ui.pendingId;
  ui.pendingId = null;
  if (th) {
    openThread(th.id, id, push);
    return true;
  }
  return false;
}

/* ---------- 起動 ---------- */
readUrl();
watchState(["mail", "storage"], (state, { initial }) => {
  S = state;
  L = lookup(state.site);
  const owner = L.person(ownerId());
  $("#owner").innerHTML = owner
    ? `<span class="owner-text"><b>${escapeHtml(owner.name)}</b><small>${escapeHtml(ownerAddr())}</small></span>${avatar({ personId: owner.id, name: owner.name }, "md")}`
    : "";
  // アクター切替：新着扱い・トーストは出さず、見えなくなったスレッドは閉じる
  const me = ownerId();
  const switched = ui.actor !== null && ui.actor !== me;
  ui.actor = me;
  if (switched) {
    ui.fresh.clear();
    ui.known = null;
    closePreview();
    if (ui.thread && !allThreads().some((t) => t.id === ui.thread)) {
      ui.thread = null;
      ui.focusId = null;
      ui.expanded = new Set();
      writeUrl(false);
    }
  }
  const ids = (S.mail?.messages ?? []).map((m) => m.id);
  if (ui.known && S.mail) {
    const added = (S.mail.messages ?? []).filter((m) => !ui.known.has(m.id) && visibleToMe(m) && !isOwner(m.from));
    for (const m of added) ui.fresh.add(m.id);
    if (added.length) {
      const m = added[added.length - 1];
      toast(`${icon("all")}<span>新着メール ${added.length} 件：<b>${escapeHtml(shortName(m.from?.name))}</b>「${escapeHtml(m.subject)}」</span>`, 6000);
    }
  }
  if (S.mail) ui.known = new Set(ids);
  // 初回 or データ到着後に ?id= を開く
  if (applyPending(false)) return;
  render({ keepScroll: !initial && !switched });
});

// ---------- ペイン幅のドラッグ変更（左ナビ） ----------
import { addSplitter } from "/shared/resize.js";
addSplitter({ container: document.getElementById("app"), side: "left", cssVar: "--nav-w-user", pos: "var(--nav-w)", top: "var(--top-h)", min: 180, max: 520, key: "mail-nav" });
