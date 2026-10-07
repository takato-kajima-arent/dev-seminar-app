// 現場チャット画面（ビジネスチャット風）
// データ: chat.json（rooms / messages / todos）、storage.json（添付ファイル名・サイズ）、site.json（人物・会社）
import { watchState, lookup, fmt, escapeHtml, fileUrl, currentActor } from "/shared/api.js";

// 「自分」＝現在のアクター（トップページで切替）。state 更新のたびに currentActor(state) で再評価する
let ME = null;
let ACTOR = null;
const lsRoomKey = () => `chat.lastRoom.${ACTOR?.personaId ?? "default"}`;
const CAT_ORDER = ["全体", "工区", "テーマ", "会社", "社内"];
const CAT_COLOR = { 全体: "#16324a", 工区: "#2e7cb3", テーマ: "#3e7a76", 会社: "#a9825f", 社内: "#5b6abf" };

const $ = (id) => document.getElementById(id);
const esc = escapeHtml;

const ICON = {
  bot: `<svg viewBox="0 0 24 24"><path d="M11 2h2v3h4a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h4zM8.5 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8 15.5v1.5h8v-1.5z"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>`,
  task: `<svg viewBox="0 0 24 24"><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm2.3 8.2 3 3 6.4-6.4-1.4-1.4-5 5-1.6-1.6z"/></svg>`,
  panel: `<svg viewBox="0 0 24 24"><path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm10 2v12h5V6z"/></svg>`,
};

// ---------- 状態 ----------
const st = {
  site: null,
  L: lookup(null),
  chat: { rooms: [], messages: [], todos: [] },
  files: new Map(),
  view: "talk",
  roomId: null,
  cat: "all",
  query: "",
  side: "tasks",
  sideOpen: true,
  taskFilter: "open",
  taskScope: "all",
  unread: new Map(), // roomId -> count
  freshRooms: new Set(),
  newMsgIds: new Set(),
  newTodoIds: new Set(),
  newTaskCount: 0,
  knownMsgIds: null,
  knownTodos: null, // id -> status
  lastSig: "",
};

// ---------- ユーティリティ ----------
const dayKey = (iso) => fmt.ymd(new Date(iso));
function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return fmt.ymd(d);
}
function dateLabel(iso) {
  const k = dayKey(iso);
  const today = st.site?.today;
  if (k === today) return `今日 ${fmt.date(iso)}`;
  if (today && k === addDays(today, -1)) return `昨日 ${fmt.date(iso)}`;
  return fmt.date(iso);
}
function listTime(iso) {
  if (!iso) return "";
  const k = dayKey(iso);
  const today = st.site?.today;
  if (k === today) return fmt.time(iso);
  if (today && k === addDays(today, -1)) return "昨日";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
const person = (id) => st.L.person(id) ?? { id, name: id, color: "#8896a6" };
const isBot = (id) => !!st.L.person(id)?.isBot;
const surname = (p) => (p?.name ?? "").split(/[\s　]/)[0];
const initial = (p) => (p?.name ?? "?").trim().charAt(0);

function avatar(id, cls = "") {
  const p = person(id);
  if (p.isBot) return `<span class="av bot ${cls}" title="${esc(p.name)}">${ICON.bot}</span>`;
  return `<span class="av ${cls}" style="background:${esc(p.color || "#8896a6")}" title="${esc(p.name)}">${esc(initial(p))}</span>`;
}

function roomAvatarText(r) {
  if (r.category === "工区") {
    const m = r.name.match(/^(\d)/);
    return m ? m[1] : r.name.charAt(0);
  }
  if (r.category === "会社" && r.companyId) {
    const c = st.L.company(r.companyId);
    if (c) return c.shortName.charAt(0);
  }
  return r.name.replace(/^[「『]/, "").charAt(0);
}
function roomAvatar(r, cls = "") {
  return `<span class="room-av ${cls}" style="background:${CAT_COLOR[r.category] ?? "#5e7a99"}">${esc(roomAvatarText(r))}</span>`;
}

// 自分がメンバーのルームだけが見える
const canSee = (r) => !!ME && (r?.memberIds ?? []).includes(ME);
const myRooms = () => st.chat.rooms.filter(canSee);
const roomById = (id) => st.chat.rooms.find((r) => r.id === id && canSee(r));
const defaultRoomId = () => { const rs = myRooms(); return rs.find((r) => r.id === "room-all")?.id ?? rs[0]?.id ?? null; };
const msgsOf = (roomId) => st.chat.messages.filter((m) => m.roomId === roomId);
const msgById = (id) => st.chat.messages.find((m) => m.id === id);

function previewText(m) {
  if (!m) return "";
  let t = (m.text ?? "").replace(/\s+/g, " ").trim();
  if (!t && m.attachments?.length) t = m.attachments.some((a) => a.kind === "image") ? "[写真]" : "[ファイル]";
  const who = m.senderId === ME ? "あなた" : surname(person(m.senderId));
  return `${who}: ${t}`;
}

// メンション表記（@佐藤さん 等）をハイライトするための正規表現
let mentionRe = null;
let meNames = new Set();
function buildMentionRe() {
  const names = new Set(["全員", "all", "ALL", "各位"]);
  for (const p of st.L.people) {
    const full = p.name ?? "";
    names.add(full);
    names.add(full.replace(/[\s　]/g, ""));
    names.add(surname(p));
  }
  const meP = st.L.person(ME);
  meNames = new Set([meP?.name, meP?.name?.replace(/[\s　]/g, ""), surname(meP)].filter(Boolean));
  const list = [...names].filter(Boolean).sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  mentionRe = new RegExp(`[@＠](${list.join("|")})(?:[ 　]?(?:さん|様|殿|くん))?`, "g");
}
function richText(text) {
  let h = esc(text ?? "");
  if (mentionRe) {
    h = h.replace(mentionRe, (all, name) => `<span class="mention${meNames.has(name) ? " me-m" : ""}">${all}</span>`);
  }
  return h;
}

function fileInfo(fileId) {
  return st.files.get(fileId) ?? { id: fileId, name: fileId };
}
function fileKind(name = "", mime = "") {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf" || mime.includes("pdf")) return ["pdf", "PDF"];
  if (["xlsx", "xls", "csv"].includes(ext)) return ["xls", ext.toUpperCase()];
  if (["doc", "docx"].includes(ext)) return ["doc", "DOC"];
  if (["txt", "md"].includes(ext)) return ["txt", "TXT"];
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) || mime.startsWith("image/")) return ["img", "IMG"];
  return ["etc", ext ? ext.slice(0, 4).toUpperCase() : "FILE"];
}

function dueInfo(due, done) {
  if (!due) return { cls: "", label: "期限なし" };
  const today = st.site?.today;
  const label = `期限 ${fmt.date(`${due}T00:00:00`)}`;
  if (done) return { cls: "", label };
  if (today && due < today) return { cls: "over", label: `${label} 期限切れ` };
  if (due === today) return { cls: "today", label: `${label} 今日` };
  if (today && due === addDays(today, 1)) return { cls: "today", label: `${label} 明日` };
  return { cls: "", label };
}

// ---------- トーク一覧 ----------
function roomStats(r) {
  const ms = msgsOf(r.id);
  const last = ms[ms.length - 1];
  return { last, lastAt: last?.sentAt ?? "" };
}

function renderRoomList() {
  const ul = $("room-list");
  const q = st.query.trim().toLowerCase();
  const visible = myRooms();
  let rooms = visible.map((r) => ({ r, ...roomStats(r) }));
  if (st.cat !== "all") rooms = rooms.filter((x) => x.r.category === st.cat);
  if (q) {
    rooms = rooms.filter(
      (x) =>
        x.r.name.toLowerCase().includes(q) ||
        msgsOf(x.r.id).some((m) => (m.text ?? "").toLowerCase().includes(q)),
    );
  }
  const lastIdx = new Map();
  st.chat.messages.forEach((m, i) => lastIdx.set(m.roomId, i));
  rooms.sort((a, b) => (lastIdx.get(b.r.id) ?? -1) - (lastIdx.get(a.r.id) ?? -1));

  if (!rooms.length) {
    ul.innerHTML = `<li class="empty">${!st.chat.rooms.length ? "チャットデータを読み込み中…" : !visible.length ? `${esc(ACTOR?.person?.name ?? "このユーザー")}さんが参加しているトークはまだありません` : "該当するトークはありません"}</li>`;
    return;
  }
  const row = ({ r, last, lastAt }) => {
    const n = st.unread.get(r.id) ?? 0;
    const cls = ["room", r.id === st.roomId && st.view === "talk" ? "on" : "", n ? "unread" : "", st.freshRooms.has(r.id) ? "fresh" : ""].join(" ");
    return `<li class="${cls}" data-room="${esc(r.id)}">
      ${st.freshRooms.has(r.id) ? `<i class="new-dot"></i>` : ""}
      ${roomAvatar(r)}
      <div class="room-main">
        <div class="room-top"><span class="room-name">${esc(r.name)}</span><span class="room-time">${esc(listTime(lastAt))}</span></div>
        <div class="room-bottom"><span class="room-prev">${esc(previewText(last) || r.description || "")}</span>${n ? `<span class="room-badge">${n > 99 ? "99+" : n}</span>` : ""}</div>
      </div>
    </li>`;
  };
  ul.innerHTML = rooms.map(row).join("");
  const sel = ul.querySelector(".room.on");
  if (sel && st._scrollSelIntoView) {
    sel.scrollIntoView({ block: "nearest" });
    st._scrollSelIntoView = false;
  }
}

// ---------- メッセージ ----------
function renderHead() {
  const r = roomById(st.roomId);
  const head = $("room-head");
  if (!r) {
    head.innerHTML = `<div class="titles"><h2>${st.chat.rooms.length && !myRooms().length ? "参加中のトークはありません" : "トークを選択してください"}</h2></div>`;
    return;
  }
  const mem = r.memberIds ?? [];
  const avs = mem.slice(0, 5).map((id) => avatar(id, "sm")).join("");
  head.innerHTML = `
    ${roomAvatar(r, "lg")}
    <div class="titles">
      <h2>${esc(r.name)}</h2>
      <div class="sub">メンバー ${mem.length}人${r.description ? `　|　${esc(r.description)}` : ""}</div>
    </div>
    <div class="head-avs">${avs}${mem.length > 5 ? `<span class="more">+${mem.length - 5}</span>` : ""}</div>
    <button class="head-btn ${st.sideOpen ? "on" : ""}" id="toggle-side" type="button">${ICON.panel}タスク・メンバー</button>`;
}

function readCount(m, room) {
  // 既読数（それらしく見せるだけ）：メンバー数から送信者を引き、メッセージ ID でばらつかせる
  const n = Math.max(0, (room?.memberIds?.length ?? 1) - 1);
  const seed = parseInt(String(m.id).replace(/\D/g, ""), 10) || 0;
  const today = st.site?.today;
  if (dayKey(m.sentAt) !== today) return n;
  return Math.max(1, n - (seed % Math.max(1, Math.min(4, n))));
}

function renderMessage(m, room, todosBySrc) {
  const me = m.senderId === ME;
  const bot = isBot(m.senderId);
  const p = person(m.senderId);
  const co = st.L.companyOf(m.senderId);
  const toMe = (m.mentionIds ?? []).includes(ME);
  const cls = ["msg", me ? "me" : "", bot ? "bot" : "", toMe ? "to-me" : "", st.newMsgIds.has(m.id) ? "is-new" : ""].join(" ");

  let quote = "";
  if (m.replyToId) {
    const pm = msgById(m.replyToId);
    if (pm) {
      const pt = (pm.text ?? "").trim() || (pm.attachments?.length ? "[添付ファイル]" : "");
      quote = `<span class="quote" data-jump="${esc(pm.id)}"><b>${esc(person(pm.senderId).name)}</b><span class="qt">${esc(pt)}</span></span>`;
    }
  }
  const text = (m.text ?? "").trim();
  const bubble = text || quote ? `<div class="bubble">${quote}${richText(m.text ?? "")}</div>` : "";

  const atts = (m.attachments ?? [])
    .map((a) => {
      const f = fileInfo(a.fileId);
      const isImg = a.kind === "image" || (f.mime ?? "").startsWith("image/");
      if (isImg) {
        return `<a class="thumb" data-img="${esc(a.fileId)}" href="${fileUrl(a.fileId)}" title="${esc(f.name)}"><img src="${fileUrl(a.fileId)}" alt="${esc(f.name)}" loading="lazy" onerror="this.parentNode.classList.add('broken');this.remove()"></a>`;
      }
      const [k, label] = fileKind(f.name, f.mime ?? "");
      return `<a class="file-chip" href="${fileUrl(a.fileId)}" target="_blank" rel="noopener">
        <span class="file-ic ${k}">${esc(label)}</span>
        <span class="file-meta"><div class="file-name">${esc(f.name)}</div><div class="file-size">${esc(fmt.size(f.size))}</div></span></a>`;
    })
    .join("");

  const reacts = (m.reactions ?? [])
    .filter((r) => r.userIds?.length)
    .map((r) => `<span class="react ${r.userIds.includes(ME) ? "mine" : ""}" title="${esc(r.userIds.map((u) => person(u).name).join("、"))}">${esc(r.emoji)}<b>${r.userIds.length}</b></span>`)
    .join("");

  const tds = todosBySrc.get(m.id) ?? [];
  const tags = tds
    .map((t) => `<span class="task-tag ${t.status === "done" ? "" : "open"}" data-task="${esc(t.id)}">${ICON.task}${t.status === "done" ? "完了" : "タスク"}：${esc(t.title)}</span>`)
    .join("");

  const side = `<div class="msg-side">${me ? `<span>既読 ${readCount(m, room)}</span>` : ""}<span>${fmt.time(m.sentAt)}</span></div>`;
  return `<div class="${cls}" data-id="${esc(m.id)}">
    ${avatar(m.senderId)}
    <div class="msg-body">
      <div class="msg-meta"><span class="who">${esc(p.name)}</span>${bot ? `<span class="badge-ai">AI秘書</span>` : co ? `<span class="co">${esc(co.shortName)}</span>` : ""}</div>
      ${bubble ? `<div class="msg-row">${bubble}${side}</div>` : ""}
      ${atts ? `<div class="msg-row"><div class="atts">${atts}</div>${bubble ? "" : side}</div>` : ""}
      ${reacts ? `<div class="reacts">${reacts}</div>` : ""}
      ${tags}
    </div>
  </div>`;
}

function renderMessages({ keepScroll = false } = {}) {
  const box = $("msg-scroll");
  const list = $("msg-list");
  const room = roomById(st.roomId);
  if (!room) {
    list.innerHTML = `<div class="empty">${!st.chat.rooms.length ? "チャットデータを読み込み中…" : !myRooms().length ? "参加しているトークはありません。招待されるとここに表示されます。" : "左の一覧からトークを選択してください"}</div>`;
    return;
  }
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const prevTop = box.scrollTop;

  const todosBySrc = new Map();
  for (const t of st.chat.todos ?? []) {
    if (!t.sourceMessageId) continue;
    if (!todosBySrc.has(t.sourceMessageId)) todosBySrc.set(t.sourceMessageId, []);
    todosBySrc.get(t.sourceMessageId).push(t);
  }
  const ms = msgsOf(room.id);
  let lastDay = "";
  const parts = [];
  for (const m of ms) {
    const k = dayKey(m.sentAt);
    if (k !== lastDay) {
      parts.push(`<div class="date-sep"><span>${esc(dateLabel(m.sentAt))}</span></div>`);
      lastDay = k;
    }
    parts.push(renderMessage(m, room, todosBySrc));
  }
  list.innerHTML = parts.join("") || `<div class="empty">まだメッセージはありません</div>`;

  if (!keepScroll || atBottom) {
    box.scrollTop = box.scrollHeight;
    // 画像の読み込みで高さが変わっても最下部を維持
    list.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", () => { if (st._stickBottom) box.scrollTop = box.scrollHeight; }, { once: true });
    });
    st._stickBottom = true;
  } else {
    box.scrollTop = prevTop;
  }
  updateJumpBtn();
}

function updateJumpBtn() {
  const box = $("msg-scroll");
  const far = box.scrollHeight - box.scrollTop - box.clientHeight > 200;
  $("jump-bottom").hidden = !far;
}

// ---------- 右パネル ----------
function taskCard(t, { showRoom = false } = {}) {
  const done = t.status === "done";
  const due = dueInfo(t.dueDate, done);
  const room = roomById(t.roomId);
  const assignee = t.assigneeId ? person(t.assigneeId) : null;
  const byAi = t.createdById && isBot(t.createdById);
  return `<div class="task ${done ? "done" : ""} ${st.newTodoIds.has(t.id) ? "is-new" : ""}" data-tid="${esc(t.id)}">
    <span class="chk">${done ? ICON.check : ""}</span>
    <div class="task-main">
      <div class="t-title">${esc(t.title)}${byAi ? ` <span class="t-by-ai">AI秘書が追加</span>` : ""}</div>
      ${t.detail ? `<div class="t-detail">${esc(t.detail)}</div>` : ""}
      <div class="t-meta">
        <span class="due ${due.cls}">${esc(due.label)}</span>
        ${assignee ? `<span class="who">${avatar(t.assigneeId, "xs")}担当 ${esc(assignee.name)}</span>` : ""}
        ${t.requesterId ? `<span>依頼 ${esc(person(t.requesterId).name)}</span>` : ""}
        ${showRoom && room ? `<span class="t-link" data-goto-room="${esc(room.id)}" data-goto-msg="${esc(t.sourceMessageId ?? "")}"># ${esc(room.name)}</span>` : ""}
        ${!showRoom && t.sourceMessageId && msgById(t.sourceMessageId) ? `<span class="t-link" data-jump="${esc(t.sourceMessageId)}">元のメッセージ</span>` : ""}
      </div>
    </div>
  </div>`;
}

function sortTasks(list) {
  return [...list].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || String(a.createdAt).localeCompare(String(b.createdAt)));
}

function renderSide() {
  const col = $("side-col");
  col.hidden = !st.sideOpen && window.innerWidth > 1200;
  col.classList.toggle("force", st.sideOpen && window.innerWidth <= 1200);
  document.querySelectorAll(".side-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.side === st.side));
  const room = roomById(st.roomId);
  const body = $("side-body");
  const todos = room ? (st.chat.todos ?? []).filter((t) => t.roomId === room.id) : [];
  $("side-task-count").textContent = todos.filter((t) => t.status !== "done").length;
  $("side-member-count").textContent = room?.memberIds?.length ?? 0;
  if (!room) { body.innerHTML = ""; return; }

  if (st.side === "tasks") {
    const open = sortTasks(todos.filter((t) => t.status !== "done"));
    const done = sortTasks(todos.filter((t) => t.status === "done"));
    body.innerHTML =
      (todos.length ? "" : `<div class="empty">このトークのタスクはありません</div>`) +
      (open.length ? `<div class="side-sec">未完了 ${open.length}</div>${open.map((t) => taskCard(t)).join("")}` : "") +
      (done.length ? `<div class="side-sec">完了 ${done.length}</div>${done.map((t) => taskCard(t)).join("")}` : "");
  } else {
    const mem = [...(room.memberIds ?? [])];
    const byCo = new Map();
    for (const id of mem) {
      const c = st.L.companyOf(id);
      const key = c?.shortName ?? "その他";
      if (!byCo.has(key)) byCo.set(key, []);
      byCo.get(key).push(id);
    }
    body.innerHTML = [...byCo]
      .map(([co, ids]) => `<div class="side-sec">${esc(co)}（${ids.length}）</div>` +
        ids.map((id) => { const p = person(id); return `<div class="member">${avatar(id, "sm")}<div><div class="nm">${esc(p.name)}${p.isBot ? ` <span class="badge-ai">AI秘書</span>` : ""}</div><div class="tt">${esc(p.title ?? "")}</div></div></div>`; }).join(""))
      .join("");
  }
}

// ---------- 全体タスク画面 ----------
function renderTasksView() {
  const all = st.chat.todos ?? [];
  const mine = (t) => t.assigneeId === ME;
  const requested = (t) => t.requesterId === ME || t.createdById === ME;
  // 「全員」は自分が見えるルームのタスク＋自分が担当・依頼したもの
  const visibleTask = (t) => mine(t) || requested(t) || !!roomById(t.roomId);
  const scoped = st.taskScope === "mine" ? all.filter(mine) : st.taskScope === "req" ? all.filter(requested) : all.filter(visibleTask);
  const counts = { open: scoped.filter((t) => t.status !== "done").length, done: scoped.filter((t) => t.status === "done").length, all: scoped.length };
  document.querySelectorAll("#task-filter button").forEach((b) => {
    b.classList.toggle("on", b.dataset.f === st.taskFilter);
    b.querySelector("b").textContent = counts[b.dataset.f];
  });
  document.querySelectorAll("#task-scope button").forEach((b) => b.classList.toggle("on", b.dataset.s === st.taskScope));
  const list = scoped.filter((t) => st.taskFilter === "all" || (st.taskFilter === "done" ? t.status === "done" : t.status !== "done"));
  const today = st.site?.today ?? "";
  const groups = [
    ["over", "期限切れ", (t) => t.status !== "done" && t.dueDate && t.dueDate < today],
    ["today", "今日", (t) => t.status !== "done" && t.dueDate === today],
    ["tmr", "明日", (t) => t.status !== "done" && t.dueDate === addDays(today, 1)],
    ["later", "それ以降", (t) => t.status !== "done" && t.dueDate > addDays(today, 1)],
    ["none", "期限なし", (t) => t.status !== "done" && !t.dueDate],
    ["done", "完了", (t) => t.status === "done"],
  ];
  const html = groups
    .map(([k, label, fn]) => {
      const ts = sortTasks(list.filter(fn));
      if (!ts.length) return "";
      return `<div class="grp ${k}"><h3>${label}<i>${ts.length}</i></h3><div class="grid">${ts.map((t) => taskCard(t, { showRoom: true })).join("")}</div></div>`;
    })
    .join("");
  const emptyMsg = st.taskScope === "mine" ? "あなたが担当のタスクはありません" : st.taskScope === "req" ? "あなたが依頼したタスクはありません" : "タスクはありません";
  $("tasks-body").innerHTML = html || `<div class="empty">${emptyMsg}</div>`;
}

// ---------- バッジ ----------
function renderBadges() {
  const total = [...st.unread.values()].reduce((a, b) => a + b, 0);
  const tb = $("rail-badge-talk");
  tb.hidden = !total;
  tb.textContent = total > 99 ? "99+" : total;
  const kb = $("rail-badge-tasks");
  const open = (st.chat.todos ?? []).filter((t) => t.status !== "done" && t.assigneeId === ME).length;
  kb.hidden = !open;
  kb.textContent = open;
  document.title = total ? `(${total}) 現場チャット` : "現場チャット";
}

function renderAll({ keepScroll = false } = {}) {
  renderRoomList();
  if (st.view === "talk") {
    renderHead();
    renderMessages({ keepScroll });
    renderSide();
  } else {
    renderTasksView();
  }
  renderBadges();
}

// ---------- 操作 ----------
function selectRoom(id, { jumpTo } = {}) {
  if (!roomById(id)) return;
  st.roomId = id;
  st.unread.delete(id);
  st.freshRooms.delete(id);
  try { localStorage.setItem(lsRoomKey(), id); } catch {}
  const u = new URL(location.href);
  u.searchParams.set("room", id);
  u.searchParams.delete("view");
  history.replaceState(null, "", u);
  setView("talk", false);
  renderAll();
  if (jumpTo) jumpToMessage(jumpTo);
}

function setView(v, render = true) {
  st.view = v;
  document.querySelectorAll(".rail-item[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  $("view-talk").hidden = v !== "talk";
  $("view-tasks").hidden = v !== "tasks";
  if (v === "tasks") {
    const u = new URL(location.href);
    u.searchParams.set("view", "tasks");
    history.replaceState(null, "", u);
  }
  if (render) renderAll();
}

function jumpToMessage(id) {
  const el = $("msg-list").querySelector(`.msg[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  st._stickBottom = false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("flash", "is-new");
  void el.offsetWidth;
  el.classList.add("flash");
}

function openLightbox(fileId) {
  const f = fileInfo(fileId);
  $("lb-img").src = fileUrl(fileId);
  $("lb-cap").textContent = f.name ?? "";
  $("lightbox").hidden = false;
}
function closeLightbox() {
  $("lightbox").hidden = true;
  $("lb-img").removeAttribute("src");
}

function toast(kind, title, body, onClick) {
  const el = document.createElement("div");
  el.className = `toast ${kind === "task" ? "task-t" : ""}`;
  el.innerHTML = `<div class="tt">${esc(title)}</div><div class="tb">${esc(body)}</div>`;
  el.addEventListener("click", () => { onClick?.(); el.remove(); });
  const box = $("toasts");
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 7000);
}

// ---------- アクター（目線）表示 ----------
function renderActor() {
  const p = ACTOR?.person ?? (ME ? person(ME) : null);
  $("rail-me").innerHTML = ME ? avatar(ME) : "";
  $("rail-me").title = p?.name ? `${p.name}（${ACTOR?.label ?? ""}）としてログイン中` : "";
  $("list-actor").innerHTML = p?.name
    ? `${avatar(ME, "xs")}<span><b>${esc(p.name)}</b>${ACTOR?.label ? `（${esc(ACTOR.label)}）` : ""}としてログイン中</span>`
    : "";
  buildMentionRe();
}

// ---------- データ更新 ----------
function initialUnread() {
  // 「今日」届いた他人のメッセージを未読として扱う（表示上の演出）
  const today = st.site?.today;
  for (const m of st.chat.messages) {
    if (m.senderId === ME || dayKey(m.sentAt) !== today || !roomById(m.roomId)) continue;
    st.unread.set(m.roomId, (st.unread.get(m.roomId) ?? 0) + 1);
  }
  if (st.roomId) st.unread.delete(st.roomId);
}

function onState(state, { initial }) {
  const chat = state.chat ?? { rooms: [], messages: [], todos: [] };
  chat.rooms ??= []; chat.messages ??= []; chat.todos ??= [];
  const actor = currentActor(state);
  const sig = JSON.stringify([state.chat, state.storage?.files?.length, state.site?.demoNow, actor.personaId]);
  if (!initial && sig === st.lastSig) return;
  st.lastSig = sig;
  const actorChanged = !!ACTOR && (ACTOR.personaId !== actor.personaId || ACTOR.personId !== actor.personId);
  ACTOR = actor;
  ME = actor.personId;

  if (state.site && state.site !== st.site) {
    st.site = state.site;
    st.L = lookup(state.site);
    const s = state.site.site ?? {};
    $("org-name").textContent = s.shortName ?? "現場";
    $("org-sub").textContent = s.name ?? "";
    $("rail-org").textContent = (s.shortName ?? "現").charAt(0);
    $("rail-org").title = s.name ?? "";
  }
  renderActor();
  st.files = new Map((state.storage?.files ?? []).map((f) => [f.id, f]));
  st.chat = chat;

  // 差分検出
  const hadData = st.knownMsgIds && st.knownMsgIds.size > 0;
  const newMsgs = hadData ? chat.messages.filter((m) => !st.knownMsgIds.has(m.id)) : [];
  const newTodos = st.knownTodos && st.knownTodos.size >= 0 && hadData ? chat.todos.filter((t) => !st.knownTodos.has(t.id)) : [];
  const doneTodos = st.knownTodos && hadData ? chat.todos.filter((t) => st.knownTodos.has(t.id) && st.knownTodos.get(t.id) !== "done" && t.status === "done") : [];
  st.knownMsgIds = new Set(chat.messages.map((m) => m.id));
  st.knownTodos = new Map(chat.todos.map((t) => [t.id, t.status]));

  // アクター切替：新着演出・トーストは出さずに、自分目線で即再描画
  if (actorChanged && hadData) {
    st.newMsgIds.clear();
    st.newTodoIds.clear();
    st.freshRooms.clear();
    st.unread.clear();
    $("toasts").innerHTML = "";
    if (!roomById(st.roomId)) {
      let want = null;
      try { want = localStorage.getItem(lsRoomKey()); } catch {}
      if (!want || !roomById(want)) want = defaultRoomId();
      st.roomId = want;
      if (want) { try { localStorage.setItem(lsRoomKey(), want); } catch {} }
      const u = new URL(location.href);
      if (want) u.searchParams.set("room", want); else u.searchParams.delete("room");
      history.replaceState(null, "", u);
    }
    st._scrollSelIntoView = true;
    initialUnread();
    renderAll();
    return;
  }

  // 初回 or データ初到着
  if (!hadData) {
    const params = new URLSearchParams(location.search);
    let want = params.get("room");
    if (!want || !roomById(want)) { try { want = localStorage.getItem(lsRoomKey()); } catch { want = null; } }
    if (!want || !roomById(want)) want = defaultRoomId();
    st.roomId = want;
    if (want) { try { localStorage.setItem(lsRoomKey(), want); } catch {} }
    st._scrollSelIntoView = true;
    initialUnread();
    if (params.get("view") === "tasks") setView("tasks", false);
    renderAll();
    return;
  }

  for (const m of newMsgs) {
    if (!roomById(m.roomId)) continue; // 自分が参加していないルームの新着は無視
    st.newMsgIds.add(m.id);
    setTimeout(() => st.newMsgIds.delete(m.id), 6500);
    const viewing = st.view === "talk" && m.roomId === st.roomId && document.visibilityState !== "hidden";
    if (!viewing && m.senderId !== ME) {
      st.unread.set(m.roomId, (st.unread.get(m.roomId) ?? 0) + 1);
    }
    if (!viewing) {
      st.freshRooms.add(m.roomId);
      setTimeout(() => { st.freshRooms.delete(m.roomId); renderRoomList(); }, 10000);
    }
    const room = roomById(m.roomId);
    const who = person(m.senderId).name;
    toast("msg", `新着: ${room?.name ?? m.roomId}`, `${who}：${(m.text ?? "").replace(/\s+/g, " ") || "[添付ファイル]"}`, () => selectRoom(m.roomId, { jumpTo: m.id }));
  }
  const relevant = (t) => t.assigneeId === ME || t.requesterId === ME || t.createdById === ME || !!roomById(t.roomId);
  for (const t of newTodos) {
    if (!relevant(t)) continue;
    st.newTodoIds.add(t.id);
    setTimeout(() => st.newTodoIds.delete(t.id), 6500);
    const room = roomById(t.roomId);
    toast("task", `タスク追加${room ? `: ${room.name}` : ""}`, t.title, () => {
      if (t.roomId && roomById(t.roomId)) { st.side = "tasks"; st.sideOpen = true; selectRoom(t.roomId, { jumpTo: t.sourceMessageId }); }
      else setView("tasks");
    });
  }
  for (const t of doneTodos) {
    if (!relevant(t)) continue;
    st.newTodoIds.add(t.id);
    setTimeout(() => st.newTodoIds.delete(t.id), 6500);
    toast("task", "タスク完了", t.title, () => setView("tasks"));
  }
  if (!roomById(st.roomId)) st.roomId = defaultRoomId();
  renderAll({ keepScroll: true });
}

// ---------- イベント ----------
function bind() {
  $("room-list").addEventListener("click", (e) => {
    const li = e.target.closest(".room[data-room]");
    if (li) selectRoom(li.dataset.room);
  });
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-cat]");
    if (!b) return;
    st.cat = b.dataset.cat;
    $("tabs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    renderRoomList();
  });
  $("search").addEventListener("input", (e) => { st.query = e.target.value; renderRoomList(); });
  document.querySelectorAll(".rail-item[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  $("room-head").addEventListener("click", (e) => {
    if (e.target.closest("#toggle-side")) { st.sideOpen = !st.sideOpen; renderHead(); renderSide(); }
  });
  document.querySelector(".side-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-side]");
    if (b) { st.side = b.dataset.side; renderSide(); }
  });

  const onJumpClick = (e) => {
    const img = e.target.closest("[data-img]");
    if (img) { e.preventDefault(); openLightbox(img.dataset.img); return true; }
    const j = e.target.closest("[data-jump]");
    if (j) { jumpToMessage(j.dataset.jump); return true; }
    const g = e.target.closest("[data-goto-room]");
    if (g) { selectRoom(g.dataset.gotoRoom, { jumpTo: g.dataset.gotoMsg || undefined }); return true; }
    const tk = e.target.closest("[data-task]");
    if (tk) {
      st.side = "tasks"; st.sideOpen = true; renderHead(); renderSide();
      const card = $("side-body").querySelector(`[data-tid="${CSS.escape(tk.dataset.task)}"]`);
      if (card) { card.scrollIntoView({ block: "center", behavior: "smooth" }); card.classList.remove("is-new"); void card.offsetWidth; card.classList.add("is-new"); }
      return true;
    }
    return false;
  };
  $("msg-list").addEventListener("click", onJumpClick);
  $("side-body").addEventListener("click", onJumpClick);
  $("tasks-body").addEventListener("click", onJumpClick);

  $("task-filter").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { st.taskFilter = b.dataset.f; renderTasksView(); } });
  $("task-scope").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { st.taskScope = b.dataset.s; renderTasksView(); } });

  const box = $("msg-scroll");
  box.addEventListener("scroll", () => {
    st._stickBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    updateJumpBtn();
  });
  $("jump-bottom").addEventListener("click", () => { box.scrollTo({ top: box.scrollHeight, behavior: "smooth" }); });

  $("lightbox").addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
  window.addEventListener("resize", () => { if (st.view === "talk") renderSide(); });
}

bind();
watchState(["chat", "storage"], onState);

// ---------- ペイン幅のドラッグ変更（トーク一覧・右パネル） ----------
import { addSplitter } from "/shared/resize.js";
{
  const c = document.getElementById("view-talk");
  const fire = () => window.dispatchEvent(new Event("resize"));
  addSplitter({ container: c, side: "left", cssVar: "--chat-list-w", def: 360, min: 240, max: 640, key: "chat-list" });
  addSplitter({ container: c, side: "right", cssVar: "--chat-side-w", def: 380, pane: document.getElementById("side-col"), min: 260, max: 720, key: "chat-side", onChange: fire });
}
