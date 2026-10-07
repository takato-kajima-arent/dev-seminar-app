// カレンダー（デモ用ハリボテ）
//   ?date=2026-11-12&view=week|day|people
//   データは /api/state?only=calendar,site をポーリング（watchState）。新規予定はハイライト＋トースト。
import { watchState, lookup, escapeHtml, currentActor } from "/shared/api.js";

const H_START = 7; // 07:00
const H_END = 20; // 20:00
const RANGE_MIN = (H_END - H_START) * 60;
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const VIEWS = ["day", "week", "people"];

const $ = (id) => document.getElementById(id);
const S = {
  site: null,
  L: lookup(null),
  cal: { calendars: [], events: [] },
  view: "week",
  date: null, // "YYYY-MM-DD"
  miniMonth: null, // Date (1st of month)
  actor: null, // currentActor(state)
  hiddenBy: new Map(), // personaId -> Set(userId)  表示切替はアクターごとに持つ
  get hidden() {
    const k = this.actor?.personaId ?? "_";
    if (!this.hiddenBy.has(k)) this.hiddenBy.set(k, new Set());
    return this.hiddenBy.get(k);
  },
  known: null, // Map id -> signature
  fresh: new Map(), // id -> expiry ms
  loaded: false,
};

// ---------------- date utils ----------------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return ymd(d); };
const weekStart = (s) => { const d = toDate(s); d.setDate(d.getDate() - d.getDay()); return ymd(d); };
const hm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

/** ISO を「書かれている現地時刻」のまま解釈（+09:00 前提、ブラウザのTZに依存させない） */
function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso || "");
  if (!m) {
    const d = new Date(iso);
    return { date: ymd(d), min: d.getHours() * 60 + d.getMinutes(), hasTime: true };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, min: m[4] ? +m[4] * 60 + +m[5] : 0, hasTime: !!m[4] };
}
function hmToMin(s, def) {
  const m = /^(\d{1,2}):(\d{2})/.exec(s || "");
  return m ? +m[1] * 60 + +m[2] : def;
}
const jpDate = (s) => { const d = toDate(s); return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };

// ---------------- data helpers ----------------
/** マイカレンダー＝アクターの calendarUserIds（先頭が自分）。色は calendar.json の calendars[] → 人物色 */
const calColor = (uid) => (S.cal.calendars || []).find((c) => c.userId === uid)?.color ?? S.L.person(uid)?.color ?? "#1a73e8";
function calendars() {
  const ids = S.actor?.calendarUserIds?.length ? S.actor.calendarUserIds : S.actor?.personId ? [S.actor.personId] : (S.cal.calendars || []).map((c) => c.userId);
  return [...new Set(ids)].map((userId) => ({ userId, color: calColor(userId) }));
}
const visibleCals = () => calendars().filter((c) => !S.hidden.has(c.userId));
const surname = (uid) => (S.L.personName(uid) || "").split(/\s/)[0];

/** 正規化した予定（日付範囲・分） */
function norm(ev) {
  const s = parseIso(ev.start);
  const e = parseIso(ev.end || ev.start);
  const allDay = !!ev.allDay || (!s.hasTime && !e.hasTime);
  let endDate = e.date;
  if (allDay) {
    // 終了が "YYYY-MM-DD" なら当日を含む／T00:00 で開始より後なら排他的とみなす
    if (e.hasTime && e.min === 0 && e.date > s.date) endDate = addDays(e.date, -1);
    if (endDate < s.date) endDate = s.date;
  }
  const users = new Set([...(ev.attendeeIds || []), ev.organizerId].filter(Boolean));
  return { ev, allDay, sDate: s.date, sMin: s.min, eDate: endDate, eMin: e.min, users };
}
function owners(n) {
  // この予定が表示されるカレンダー（表示中のもの・カレンダー順）
  return visibleCals().map((c) => c.userId).filter((u) => n.users.has(u));
}
function colorFor(n) {
  const own = owners(n);
  if (own.includes(n.ev.organizerId)) return calColor(n.ev.organizerId);
  return calColor(own[0]);
}
const allNorm = () => (S.cal.events || []).map(norm);
const sig = (ev) => JSON.stringify([ev.title, ev.start, ev.end, ev.allDay, ev.attendeeIds, ev.location, ev.description]);

/** 指定日にかかる時間指定予定の [開始分, 終了分]（日をまたぐ場合はクリップ） */
function spanOnDay(n, day) {
  if (n.allDay || day < n.sDate || day > (n.eMin === 0 && n.eDate > n.sDate ? addDays(n.eDate, -1) : n.eDate)) return null;
  const s = day === n.sDate ? n.sMin : 0;
  const e = day === n.eDate ? n.eMin : 24 * 60;
  return e > s ? [s, e] : [s, s + 15];
}

// ---------------- layout ----------------
/** 重なる予定を横並びに配置（col / ncols を付与） */
function layoutColumns(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [], colsEnd = [], clusterEnd = -1;
  const flush = () => { cluster.forEach((it) => (it.ncols = colsEnd.length)); cluster = []; colsEnd = []; };
  for (const it of items) {
    if (it.s >= clusterEnd && cluster.length) flush();
    let c = colsEnd.findIndex((end) => end <= it.s);
    if (c < 0) { c = colsEnd.length; colsEnd.push(it.e); } else colsEnd[c] = it.e;
    it.col = c;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  // 右側が空いていれば広げる
  for (const it of items) {
    let span = 1;
    for (let c = it.col + 1; c < it.ncols; c++) {
      if (items.some((o) => o !== it && o.col === c && o.ncols === it.ncols && o.s < it.e && o.e > it.s)) break;
      span++;
    }
    it.span = span;
  }
  return items;
}
const pct = (min) => ((Math.min(Math.max(min, H_START * 60), H_END * 60) - H_START * 60) / RANGE_MIN) * 100;

// ---------------- render ----------------
function render() {
  if (!S.site) return;
  closePopover();
  renderTop();
  renderMini();
  renderCalList();
  const main = $("main");
  if (S.view === "people") renderPeople(main);
  else renderDays(main, S.view === "week" ? [...Array(7)].map((_, i) => addDays(weekStart(S.date), i)) : [S.date]);
  syncUrl();
  const f = main.querySelector(".fresh");
  if (f) f.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function renderTop() {
  const d = toDate(S.date);
  let title;
  if (S.view === "week") {
    const a = toDate(weekStart(S.date)), b = toDate(addDays(weekStart(S.date), 6));
    if (a.getMonth() === b.getMonth()) title = `${a.getFullYear()}年${a.getMonth() + 1}月`;
    else if (a.getFullYear() === b.getFullYear()) title = `${a.getFullYear()}年${a.getMonth() + 1}月～${b.getMonth() + 1}月`;
    else title = `${a.getFullYear()}年${a.getMonth() + 1}月～${b.getFullYear()}年${b.getMonth() + 1}月`;
  } else title = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;
  $("rangeTitle").textContent = title;
  document.querySelectorAll("#viewSwitch button").forEach((b) => b.classList.toggle("on", b.dataset.view === S.view));
  $("brandDay").textContent = toDate(S.site.today).getDate();
  const me = S.actor?.person || S.L.person(S.actor?.personId);
  if (me) {
    const av = $("meAvatar");
    av.textContent = me.name[0];
    av.style.background = me.color;
    av.title = me.name;
  }
}

function renderMini() {
  if (!S.miniMonth) S.miniMonth = new Date(toDate(S.date).getFullYear(), toDate(S.date).getMonth(), 1, 12);
  const m = S.miniMonth;
  const first = new Date(m.getFullYear(), m.getMonth(), 1, 12);
  const start = addDays(ymd(first), -first.getDay());
  const selFrom = S.view === "week" ? weekStart(S.date) : S.date;
  const selTo = S.view === "week" ? addDays(selFrom, 6) : S.date;
  const evs = allNorm().filter((n) => owners(n).length);
  const hasEv = (day) => evs.some((n) => day >= n.sDate && day <= n.eDate);
  let cells = WD.map((w) => `<div class="mini-wd">${w}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const day = addDays(start, i);
    const dd = toDate(day);
    const cls = ["mini-d"];
    if (dd.getMonth() !== m.getMonth()) cls.push("out");
    if (day >= selFrom && day <= selTo) cls.push("sel");
    if (day === S.site.today) cls.push("today");
    if (hasEv(day)) cls.push("has");
    cells += `<div><div class="${cls.join(" ")}" data-day="${day}">${dd.getDate()}</div></div>`;
  }
  $("mini").innerHTML = `
    <div class="mini-head">
      <div class="mini-title">${m.getFullYear()}年${m.getMonth() + 1}月</div>
      <button class="icon-btn" data-mm="-1" aria-label="前の月"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
      <button class="icon-btn" data-mm="1" aria-label="次の月"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg></button>
    </div>
    <div class="mini-grid">${cells}</div>`;
}

function renderCalList() {
  $("calList").innerHTML = calendars()
    .map((c, i) => {
      const p = S.L.person(c.userId);
      const sub = [i === 0 ? "自分" : "", p?.title ?? ""].filter(Boolean).join("・");
      return `<div class="cal-item ${S.hidden.has(c.userId) ? "off" : ""}" data-uid="${escapeHtml(c.userId)}" style="--c:${c.color}">
        <span class="cb"><svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>
        <span><div class="nm">${escapeHtml(p?.name ?? c.userId)}</div><div class="sub">${escapeHtml(sub)}</div></span>
      </div>`;
    })
    .join("");
}

function nowInfo() {
  const n = parseIso(S.site.demoNow || `${S.site.today}T13:00:00+09:00`);
  return { date: n.date, min: n.min };
}

function workMin() {
  const wh = S.cal.workingHours || {};
  return [hmToMin(wh.start, 8 * 60), hmToMin(wh.end, 18 * 60)];
}

function gutterHtml() {
  let h = "";
  for (let i = H_START + 1; i < H_END; i++) h += `<span style="top:${((i - H_START) / (H_END - H_START)) * 100}%">${i}:00</span>`;
  return `<div class="gutter-times">${h}</div>`;
}

function offHoursHtml() {
  const [ws, we] = workMin();
  return `<div class="off-hours" style="top:0;height:${pct(ws)}%"></div><div class="off-hours" style="top:${pct(we)}%;bottom:0"></div>`;
}

function dotsHtml(n) {
  const people = calendars().map((c) => c.userId).filter((u) => n.users.has(u));
  if (people.length < 2) return "";
  return `<span class="dots">${people.map((u) => `<i style="--dc:${calColor(u)}" title="${escapeHtml(S.L.personName(u))}">${escapeHtml(surname(u)[0] || "")}</i>`).join("")}</span>`;
}

function evBlockHtml(it, color, now) {
  const { n } = it;
  const dur = it.e - it.s;
  const short = dur <= 45;
  const past = n.eDate < now.date || (n.eDate === now.date && n.eMin <= now.min);
  const dots = short && it.ncols > 1 ? "" : dotsHtml(n);
  const cls = ["ev", short ? "short" : "", short && it.ncols > 1 ? "narrow" : "", past ? "past" : "", dots ? "has-dots" : "", S.fresh.has(n.ev.id) ? "fresh" : ""].filter(Boolean).join(" ");
  const left = (it.col / it.ncols) * 100;
  const width = (it.span / it.ncols) * 100;
  const ai = n.ev.organizerId === "u-ai" ? `<span class="ai-badge">AI</span>` : "";
  const time = `${hm(n.sDate === it.day ? n.sMin : 0)}～${hm(n.eMin)}`;
  const style = `--c:${color};top:${pct(it.s)}%;height:calc(${pct(it.e) - pct(it.s)}% - 2px);left:calc(${left}% + 1px);width:calc(${width}% - ${it.col + it.span < it.ncols ? 2 : 10}px)`;
  const body = short
    ? `<div class="t">${ai}${escapeHtml(n.ev.title)}</div><div class="tm">${time}</div>`
    : `<div class="t">${ai}${escapeHtml(n.ev.title)}</div><div class="tm">${time}</div>${n.ev.location && dur >= 60 ? `<div class="loc">${escapeHtml(n.ev.location)}</div>` : ""}`;
  return `<div class="${cls}" data-id="${escapeHtml(n.ev.id)}" style="${style}">${body}${dots}</div>`;
}

function colHtml(day, list, colorOf, now, idx) {
  const items = [];
  for (const n of list) {
    const sp = spanOnDay(n, day);
    if (!sp) continue;
    if (sp[1] <= H_START * 60 || sp[0] >= H_END * 60) continue;
    items.push({ n, s: Math.max(sp[0], H_START * 60), e: Math.min(Math.max(sp[1], sp[0] + 20), H_END * 60), day });
  }
  layoutColumns(items);
  let html = `<div class="day-col" data-day="${day}" style="grid-column:${idx + 2}">${offHoursHtml()}`;
  html += items.map((it) => evBlockHtml(it, colorOf(it.n), now)).join("");
  if (day === now.date && now.min >= H_START * 60 && now.min <= H_END * 60) html += `<div class="now-line" style="top:${pct(now.min)}%"></div>`;
  return html + `</div>`;
}

function alldayHtml(days, list, colorOf) {
  const rows = [];
  const placed = [];
  for (const n of list) {
    if (!n.allDay) continue;
    const a = days.indexOf(n.sDate < days[0] ? days[0] : n.sDate);
    const b = days.indexOf(n.eDate > days[days.length - 1] ? days[days.length - 1] : n.eDate);
    if (a < 0 || b < 0 || n.eDate < days[0] || n.sDate > days[days.length - 1]) continue;
    let r = 0;
    while ((rows[r] || []).some(([x, y]) => !(b < x || a > y))) r++;
    (rows[r] = rows[r] || []).push([a, b]);
    placed.push(`<div class="allday-ev ${S.fresh.has(n.ev.id) ? "fresh" : ""}" data-id="${escapeHtml(n.ev.id)}" style="--c:${colorOf(n)};grid-column:${a + 1} / ${b + 2};grid-row:${r + 1}">${escapeHtml(n.ev.title)}</div>`);
  }
  return `<div class="allday"><div class="gutter">終日</div>${days.map((_, i) => `<div class="allday-cell" style="grid-column:${i + 2}"></div>`).join("")}<div class="allday-events">${placed.join("")}</div></div>`;
}

function renderDays(main, days) {
  const now = nowInfo();
  const list = allNorm().filter((n) => owners(n).length);
  main.style.setProperty("--ncols", days.length);
  const head = days
    .map((day) => {
      const d = toDate(day);
      const cls = ["col-head", d.getDay() === 0 ? "sun" : "", d.getDay() === 6 ? "sat" : "", day === now.date ? "today" : "", day < now.date ? "past" : ""].join(" ");
      return `<div class="${cls}"><div class="wd">${WD[d.getDay()]}</div><div class="dn" data-goto="${day}">${d.getDate()}</div></div>`;
    })
    .join("");
  main.innerHTML =
    `<div class="cols-head"><div class="gutter">GMT+09</div>${head}</div>` +
    alldayHtml(days, list, colorFor) +
    `<div class="grid-wrap">${gutterHtml()}${days.map((day, i) => colHtml(day, list, colorFor, now, i)).join("")}</div>`;
}

/** 表示中メンバー全員の共通の空き（勤務時間内・30分以上・いまより後） */
function commonFree(day, cols, list, now) {
  if (cols.length < 2) return [];
  const dow = toDate(day).getDay();
  if (dow === 0 || dow === 6 || day < now.date) return [];
  let [ws, we] = workMin();
  if (day === now.date) ws = Math.max(ws, now.min);
  const busy = [];
  for (const n of list) {
    if (n.allDay || !cols.some((u) => n.users.has(u))) continue;
    const sp = spanOnDay(n, day);
    if (sp) busy.push(sp);
  }
  busy.sort((a, b) => a[0] - b[0]);
  const free = [];
  let t = ws;
  for (const [s, e] of busy) {
    if (s > t) free.push([t, Math.min(s, we)]);
    t = Math.max(t, e);
    if (t >= we) break;
  }
  if (t < we) free.push([t, we]);
  return free.filter(([s, e]) => e - s >= 30);
}

function renderPeople(main) {
  const now = nowInfo();
  const day = S.date;
  const cols = visibleCals().map((c) => c.userId);
  const list = allNorm();
  if (!cols.length) {
    main.innerHTML = `<div class="empty-note">表示するカレンダーを左のマイカレンダーから選んでください。</div>`;
    return;
  }
  main.style.setProperty("--ncols", cols.length);
  const head = cols
    .map((u) => {
      const p = S.L.person(u);
      return `<div class="col-head person"><div class="av" style="background:${calColor(u)}">${escapeHtml(surname(u)[0] || "")}</div>
        <div style="text-align:left"><div class="pname">${escapeHtml(p?.name ?? u)}</div><div class="ptitle">${escapeHtml(p?.title ?? "")}</div></div></div>`;
    })
    .join("");
  const mine = (u) => list.filter((n) => n.users.has(u));
  // 終日行：各人の列に配置（人ごとに列を分けるため、列 index で表現）
  const alldayPlaced = [];
  cols.forEach((u, i) => {
    mine(u).filter((n) => n.allDay && day >= n.sDate && day <= n.eDate).forEach((n, r) => {
      alldayPlaced.push(`<div class="allday-ev ${S.fresh.has(n.ev.id) ? "fresh" : ""}" data-id="${escapeHtml(n.ev.id)}" style="--c:${calColor(u)};grid-column:${i + 1};grid-row:${r + 1}">${escapeHtml(n.ev.title)}</div>`);
    });
  });
  // 共通の空き帯はデモのネタバレになるため、?free=1 のときだけ表示する
  const free = new URLSearchParams(location.search).get("free") === "1" ? commonFree(day, cols, list, now) : [];
  const band = free.length
    ? `<div class="free-band">${free.map(([s, e]) => `<div class="slot" style="top:${pct(s)}%;height:${pct(e) - pct(s)}%"><span>${cols.length === 3 ? "3人" : "全員"}とも空き ${hm(s)}～${hm(e)}</span></div>`).join("")}</div>`
    : "";
  main.innerHTML =
    `<div class="cols-head"><div class="gutter">GMT+09</div>${head}</div>` +
    `<div class="allday"><div class="gutter">終日</div>${cols.map((_, i) => `<div class="allday-cell" style="grid-column:${i + 2}"></div>`).join("")}<div class="allday-events">${alldayPlaced.join("")}</div></div>` +
    `<div class="grid-wrap">${gutterHtml()}${cols.map((u, i) => colHtml(day, mine(u), () => calColor(u), now, i)).join("")}${band}</div>`;
}

// ---------------- popover ----------------
const ICONS = {
  edit: `<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>`,
  del: `<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>`,
  mail: `<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>`,
  more: `<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>`,
  close: `<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>`,
  loc: `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>`,
  people: `<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>`,
  text: `<path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z"/>`,
  cal: `<path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>`,
};
const icon = (k) => `<svg viewBox="0 0 24 24">${ICONS[k]}</svg>`;

function openPopover(id, anchor, colorOverride) {
  const raw = (S.cal.events || []).find((e) => e.id === id);
  if (!raw) return;
  const n = norm(raw);
  const ev = n.ev;
  const color = colorOverride || colorFor(n);
  let when;
  if (n.allDay) when = n.sDate === n.eDate ? `${jpDate(n.sDate)}・終日` : `${jpDate(n.sDate)}～${jpDate(n.eDate)}`;
  else if (n.sDate === n.eDate) when = `${jpDate(n.sDate)}・${hm(n.sMin)}～${hm(n.eMin)}`;
  else when = `${jpDate(n.sDate)} ${hm(n.sMin)}～${jpDate(n.eDate)} ${hm(n.eMin)}`;
  const att = [...new Set([ev.organizerId, ...(ev.attendeeIds || [])].filter(Boolean))];
  const guests = att.filter((u) => u !== "u-ai" || (ev.attendeeIds || []).includes("u-ai"));
  const personRow = (u) => {
    const p = S.L.person(u);
    const co = S.L.companyOf(u);
    const roles = [];
    if (u === ev.organizerId) roles.push("主催者");
    if (co && co.id !== "c-gc") roles.push(co.shortName || co.name);
    return `<div class="p"><div class="av" style="background:${p?.color ?? "#888"}">${escapeHtml((p?.name ?? u)[0])}</div>
      <div>${escapeHtml(p?.name ?? u)}${roles.length ? `<br><small>${escapeHtml(roles.join("・"))}</small>` : ""}</div></div>`;
  };
  const pop = $("popover");
  pop.innerHTML = `
    <div class="pop-tools">
      <button class="icon-btn" title="編集">${icon("edit")}</button>
      <button class="icon-btn" title="削除">${icon("del")}</button>
      <button class="icon-btn" title="メール">${icon("mail")}</button>
      <button class="icon-btn" title="その他">${icon("more")}</button>
      <button class="icon-btn" data-close title="閉じる">${icon("close")}</button>
    </div>
    <div class="pop-row"><div class="sq" style="--c:${color}"></div><div>
      <div class="pop-title">${escapeHtml(ev.title)}</div>
      <div class="pop-sub">${escapeHtml(when)}</div>
      ${ev.organizerId === "u-ai" ? `<div class="pop-ai">✦ AI秘書が作成した予定</div>` : ""}
    </div></div>
    ${ev.location ? `<div class="pop-row"><div class="ic">${icon("loc")}</div><div class="pop-text">${escapeHtml(ev.location)}</div></div>` : ""}
    ${guests.length ? `<div class="pop-row"><div class="ic">${icon("people")}</div><div class="pop-att"><div class="count">${guests.length}人のゲスト</div>${guests.map(personRow).join("")}</div></div>` : ""}
    ${ev.description ? `<div class="pop-row"><div class="ic">${icon("text")}</div><div class="pop-text">${escapeHtml(ev.description)}</div></div>` : ""}
    <div class="pop-row"><div class="ic">${icon("cal")}</div><div class="pop-text">${escapeHtml(owners(n).map((u) => S.L.personName(u)).join("、"))}</div></div>`;
  pop.hidden = false;
  pop.dataset.id = id;
  // 配置：予定の右（入らなければ左）
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.right + 12;
  if (x + pw > innerWidth - 12) x = r.left - pw - 12;
  if (x < 12) x = Math.max(12, Math.min(innerWidth - pw - 12, r.left));
  let y = Math.max(42, Math.min(r.top, innerHeight - ph - 12));
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
}
function closePopover() {
  const pop = $("popover");
  pop.hidden = true;
  delete pop.dataset.id;
}

// ---------------- toast ----------------
function toast(html, color) {
  const el = document.createElement("div");
  el.className = "toast";
  if (color) el.style.setProperty("--c", color);
  el.innerHTML = `<span class="dot"></span><span>${html}</span>`;
  $("toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 6000);
}

// ---------------- navigation / url ----------------
function setDate(day, { keepMini = false } = {}) {
  S.date = day;
  if (!keepMini) S.miniMonth = null;
  render();
}
function shift(dir) {
  const step = S.view === "week" ? 7 : 1;
  setDate(addDays(S.date, dir * step));
}
function syncUrl() {
  const q = new URLSearchParams(location.search);
  q.set("date", S.date);
  q.set("view", S.view);
  history.replaceState(null, "", `${location.pathname}?${q}`);
}
function isVisibleInView(n) {
  if (S.view === "week") {
    const a = weekStart(S.date), b = addDays(a, 6);
    return !(n.eDate < a || n.sDate > b);
  }
  return S.date >= n.sDate && S.date <= n.eDate;
}

// ---------------- events ----------------
$("btnToday").onclick = () => setDate(S.site.today);
$("btnPrev").onclick = () => shift(-1);
$("btnNext").onclick = () => shift(1);
$("viewSwitch").onclick = (e) => {
  const v = e.target.closest("button")?.dataset.view;
  if (v && v !== S.view) { S.view = v; render(); }
};
$("mini").onclick = (e) => {
  const mm = e.target.closest("[data-mm]");
  if (mm) {
    S.miniMonth = new Date(S.miniMonth.getFullYear(), S.miniMonth.getMonth() + Number(mm.dataset.mm), 1, 12);
    renderMini();
    return;
  }
  const d = e.target.closest("[data-day]");
  if (d) setDate(d.dataset.day, { keepMini: true });
};
$("calList").onclick = (e) => {
  const it = e.target.closest("[data-uid]");
  if (!it) return;
  const u = it.dataset.uid;
  S.hidden.has(u) ? S.hidden.delete(u) : S.hidden.add(u);
  render();
};
$("main").onclick = (e) => {
  const g = e.target.closest("[data-goto]");
  if (g) { S.view = "day"; setDate(g.dataset.goto); return; }
  const evEl = e.target.closest("[data-id]");
  if (evEl) {
    e.stopPropagation();
    const id = evEl.dataset.id;
    if ($("popover").dataset.id === id) return closePopover();
    openPopover(id, evEl, evEl.style.getPropertyValue("--c") || null);
  }
};
document.addEventListener("click", (e) => {
  const pop = $("popover");
  if (pop.hidden) return;
  if (e.target.closest("[data-close]") || !e.target.closest("#popover")) closePopover();
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches?.("input,textarea")) return;
  if (e.key === "Escape") closePopover();
  else if (e.key === "ArrowLeft") shift(-1);
  else if (e.key === "ArrowRight") shift(1);
  else if (e.key === "t") setDate(S.site.today);
  else if (e.key === "d") { S.view = "day"; render(); }
  else if (e.key === "w") { S.view = "week"; render(); }
  else if (e.key === "p") { S.view = "people"; render(); }
});

// ---------------- data ----------------
const params = new URLSearchParams(location.search);
if (VIEWS.includes(params.get("view"))) S.view = params.get("view");
if (isDateStr(params.get("date"))) S.date = params.get("date");

watchState(["calendar", "site"], (state, { initial }) => {
  if (state.site) {
    S.site = state.site;
    S.L = lookup(state.site);
  }
  if (!S.site) return;
  if (!S.date) S.date = S.site.today;
  const actor = currentActor({ site: S.site, session: state.session });
  const switched = !!S.actor && S.actor.personaId !== actor.personaId;
  S.actor = actor;
  if (switched) S.hiddenBy.set(actor.personaId, new Set()); // 切替時は新しいアクターのカレンダーを全部表示に戻す
  const cal = state.calendar || { calendars: [], events: [] };
  // 他セクション（チャット等）だけの更新なら再描画しない（ポップオーバーを閉じないため）
  const calKey = JSON.stringify(cal) + JSON.stringify(state.site ?? null) + (actor.personaId ?? "");
  if (!initial && calKey === S.lastKey) return;
  S.lastKey = calKey;
  const prev = S.known;
  S.known = new Map((cal.events || []).map((e) => [e.id, sig(e)]));
  S.cal = cal;

  // アクター切替だけのときはトーストやハイライトを出さない
  if (prev && !initial && !switched) {
    const added = (cal.events || []).filter((e) => !prev.has(e.id));
    const changed = (cal.events || []).filter((e) => prev.has(e.id) && prev.get(e.id) !== sig(e));
    const now = Date.now();
    [...added, ...changed].forEach((e) => S.fresh.set(e.id, now + 5000));
    const target = added[added.length - 1] || changed[changed.length - 1];
    if (target) {
      const n = norm(target);
      // 非表示カレンダーだけの予定なら、関係するカレンダーを表示に戻す
      if (!owners(n).length) calendars().forEach((c) => n.users.has(c.userId) && S.hidden.delete(c.userId));
      if (!isVisibleInView(n)) { S.date = n.sDate; S.miniMonth = null; }
    }
    added.forEach((e) => toast(`予定が追加されました: <b>${escapeHtml(e.title)}</b>`, colorFor(norm(e))));
    changed.forEach((e) => toast(`予定が変更されました: <b>${escapeHtml(e.title)}</b>`, colorFor(norm(e))));
    setTimeout(() => {
      const t = Date.now();
      for (const [id, exp] of S.fresh) if (exp <= t) S.fresh.delete(id);
      document.querySelectorAll(".fresh").forEach((el) => el.classList.remove("fresh"));
    }, 5200);
  }
  render();
});

// ---------- ペイン幅のドラッグ変更（左サイドバー） ----------
import { addSplitter } from "/shared/resize.js";
addSplitter({ container: document.querySelector(".app"), side: "left", cssVar: "--side-w", top: "var(--top-h)", min: 200, max: 520, key: "cal-side", onChange: () => window.dispatchEvent(new Event("resize")) });
