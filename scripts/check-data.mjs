// data/*.json の横断チェック：ID 参照・ファイル実在・demoNow 以前・ストーリーの仕込み
// 使い方: npm run check:data
import { readFileSync, existsSync, statSync } from "node:fs";

const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const site = load("site"), chat = load("chat"), mail = load("mail"), cal = load("calendar"),
  sch = load("schedule"), weather = load("weather"), storage = load("storage");

const errors = [];
const err = (m) => errors.push(m);
const people = new Set(site.people.map((p) => p.id));
const companies = new Set(site.companies.map((c) => c.id));
const areas = new Set(site.areas.map((a) => a.id));
const files = new Map(storage.files.map((f) => [f.id, f]));
const folders = new Set(storage.folders.map((f) => f.id));
const NOW = new Date(site.demoNow);

for (const p of site.people) if (!companies.has(p.companyId)) err(`person ${p.id}: company ${p.companyId}`);

// chat
const rooms = new Set(chat.rooms.map((r) => r.id));
const msgIds = new Set(chat.messages.map((m) => m.id));
for (const r of chat.rooms) {
  r.memberIds.forEach((u) => people.has(u) || err(`room ${r.id}: member ${u}`));
  if (r.areaId && !areas.has(r.areaId)) err(`room ${r.id}: area ${r.areaId}`);
  if (r.companyId && !companies.has(r.companyId)) err(`room ${r.id}: company ${r.companyId}`);
}
for (const m of chat.messages) {
  if (!rooms.has(m.roomId)) err(`msg ${m.id}: room ${m.roomId}`);
  if (!people.has(m.senderId)) err(`msg ${m.id}: sender ${m.senderId}`);
  if (new Date(m.sentAt) > NOW) err(`msg ${m.id}: after demoNow`);
  if (m.replyToId && !msgIds.has(m.replyToId)) err(`msg ${m.id}: replyTo ${m.replyToId}`);
  (m.attachments ?? []).forEach((a) => files.has(a.fileId) || err(`msg ${m.id}: file ${a.fileId}`));
}
for (const t of chat.todos) {
  [t.assigneeId, t.requesterId, t.createdById].filter(Boolean).forEach((u) => people.has(u) || err(`todo ${t.id}: person ${u}`));
  if (t.roomId && !rooms.has(t.roomId)) err(`todo ${t.id}: room ${t.roomId}`);
}

// mail
for (const m of mail.messages) {
  [m.from, ...m.to, ...(m.cc ?? [])].forEach((a) => a.personId && !people.has(a.personId) && err(`mail ${m.id}: person ${a.personId}`));
  if (new Date(m.receivedAt) > NOW) err(`mail ${m.id}: after demoNow`);
  (m.attachments ?? []).forEach((a) => files.has(a.fileId) || err(`mail ${m.id}: file ${a.fileId}`));
}

// calendar
for (const e of cal.events) {
  e.attendeeIds.forEach((u) => people.has(u) || err(`event ${e.id}: attendee ${u}`));
  if (!e.allDay && new Date(e.end) <= new Date(e.start)) err(`event ${e.id}: end <= start`);
}

// schedule
const taskIds = new Set(sch.tasks.map((t) => t.id));
for (const t of sch.tasks) {
  if (t.companyId && !companies.has(t.companyId)) err(`task ${t.id}: company ${t.companyId}`);
  if (t.areaId && !areas.has(t.areaId)) err(`task ${t.id}: area ${t.areaId}`);
  (t.dependsOn ?? []).forEach((d) => taskIds.has(d) || err(`task ${t.id}: dependsOn ${d}`));
}

// storage
for (const f of storage.files) {
  if (f.folderId && !folders.has(f.folderId)) err(`file ${f.id}: folder ${f.folderId}`);
  const abs = new URL(`../${f.path}`, import.meta.url);
  if (!existsSync(abs)) err(`file ${f.id}: missing ${f.path}`);
  else if (f.size != null && statSync(abs).size !== f.size) err(`file ${f.id}: size mismatch`);
  if (f.updatedById && !people.has(f.updatedById)) err(`file ${f.id}: updatedBy ${f.updatedById}`);
}

// ストーリーの仕込み（要約表示）
const short = (id) => site.companies.find((c) => c.id === id)?.shortName ?? id;
const tomorrow = "2026-11-12";
const active = sch.tasks.filter((t) => !t.summary && t.start <= tomorrow && tomorrow <= t.end);
console.log("#7 明日作業の会社:", [...new Set(active.map((t) => short(t.companyId)))].join("、"));
console.log("#8 明日の屋外作業:", active.filter((t) => t.outdoor).map((t) => `${short(t.companyId)} ${t.name}`).join(" / "));
console.log("#8 前倒し可:", sch.tasks.filter((t) => t.canAdvance).map((t) => `${short(t.companyId)} ${t.name}(${t.workers}名)`).join(" / "));
console.log("#6 遅延:", sch.tasks.filter((t) => t.status === "delayed").map((t) => t.name).join(" / "));
console.log("#8 11/12 天気:", weather.forecasts.find((f) => f.date === tomorrow)?.weather);
console.log("#10 日報添付:", ["f-nippo-naiso-1110-png", "f-nippo-kucho-1110-xlsx", "f-nippo-tosou-1110-pdf"].map((id) => (files.has(id) ? "✓" : "✗") + id).join(" "));
console.log("#3 定例文字起こし:", files.has("f-teirei-1110-txt") ? "✓" : "✗");
console.log(`counts: rooms ${chat.rooms.length}, messages ${chat.messages.length}, mails ${mail.messages.length}, events ${cal.events.length}, tasks ${sch.tasks.length}, files ${storage.files.length}`);

if (errors.length) {
  console.error(`\nNG: ${errors.length} 件`);
  errors.slice(0, 50).forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log("\nOK: 参照エラーなし");
