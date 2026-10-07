// AI秘書（Grok など）向けの MCP サーバー。Streamable HTTP（ステートレス）で /mcp に生やす。
// 読み取りは data/*.json 由来のメモリ上の状態から返し、書き込みはメモリに反映する（画面はポーリングで即反映）。
// 「自分」＝トップページで選ばれているアクター（現場管理者・本社・事務）。AI はその人の秘書として振る舞う。
// AI による書き込みは送信者・作成者を "u-ai"（AI秘書）にする（各画面で AI バッジが付く）。
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import ExcelJS from "exceljs";
import { extractText, getDocumentProxy } from "unpdf";
import { readFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import * as store from "./store.js";

const AI = "u-ai";
const ROOT = join(store.DATA_DIR, "..");

// ---------- 共通ヘルパー ----------
const S = () => store.getState();
const json = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 1) }] });
const fail = (msg) => ({ content: [{ type: "text", text: `エラー: ${msg}` }], isError: true });
const day = (iso) => String(iso).slice(0, 10);
const inRange = (iso, from, to) => (!from || day(iso) >= from) && (!to || day(iso) <= to);
const WD = "日月火水木金土";
const wd = (ymd) => WD[new Date(`${ymd}T00:00:00+09:00`).getDay()];

function L() {
  const s = S().site;
  const people = new Map(s.people.map((p) => [p.id, p]));
  const companies = new Map(s.companies.map((c) => [c.id, c]));
  const nameOf = (id) => people.get(id)?.name ?? id;
  const coOf = (id) => companies.get(people.get(id)?.companyId)?.shortName ?? "";
  const who = (id) => (id ? `${nameOf(id)}（${coOf(id)}）` : null);
  return { s, people, companies, nameOf, coOf, who };
}

function me() {
  const p = store.getPersona();
  return p ? { id: p.personId, persona: p } : { id: "u-sato", persona: null };
}

function nextId(list, prefix, width = 3) {
  let n = list.length + 1;
  const ids = new Set(list.map((x) => x.id));
  while (ids.has(`${prefix}${String(n).padStart(width, "0")}`)) n++;
  return `${prefix}${String(n).padStart(width, "0")}`;
}

const nowIso = () => S().site.demoNow;

// 「今」以降に書き込むメッセージ等の時刻：demoNow を基準に、実時間の経過分だけ進める（同時刻が並ばないように）
const BOOT = Date.now();
function stampNow() {
  const base = new Date(nowIso()).getTime() + (Date.now() - BOOT);
  const d = new Date(base + 9 * 3600e3);
  return d.toISOString().replace("Z", "+09:00").replace(/\.\d{3}/, "");
}

// ---------- MCP サーバー定義 ----------
export function buildMcpServer() {
  const server = new McpServer(
    { name: "konan-site-mock", version: "1.0.0" },
    {
      instructions:
        "あなたは建設現場「（仮称）港南三丁目オフィスビル新築工事」で働く人の AI 秘書です。" +
        "まず get_context で『今日の日付・いまの時刻・誰の秘書か』を確認し、日付の計算は必ずその『今日』を基準にしてください（実際の日付ではありません）。" +
        "チャット・メール・カレンダー・ファイル・工程表・天気をツールで確認してから答え、推測で埋めないでください。" +
        "書き込み（チャット投稿・ToDo 登録・予定登録・Excel 作成）は、依頼された場合に行い、結果を簡潔に報告してください。",
    },
  );

  // 全ツールに注釈を付ける。読み取り専用のツールは readOnlyHint=true
  // （ChatGPT などのクライアントは、これがないと読むだけの呼び出しでも毎回確認を求めることがある）
  const WRITE_TOOLS = new Set(["post_chat_message", "add_todo", "create_calendar_event", "create_excel"]);
  const register = server.registerTool.bind(server);
  server.registerTool = (name, cfg, cb) =>
    register(name, { ...cfg, annotations: { readOnlyHint: !WRITE_TOOLS.has(name), destructiveHint: false, idempotentHint: !WRITE_TOOLS.has(name), openWorldHint: false, ...cfg.annotations } }, cb);

  // --- 状況 ---
  server.registerTool(
    "get_context",
    {
      title: "前提情報（今日・自分・現場）",
      description: "デモ上の今日の日付といまの時刻、あなたが秘書として仕えている人（自分）、現場・工区・会社・人物の一覧を返します。最初に必ず呼んでください。",
      inputSchema: {},
    },
    async () => {
      const { s, companies } = L();
      const m = me();
      const u = s.people.find((p) => p.id === m.id);
      return json({
        today: `${s.today}（${wd(s.today)}）`,
        now: s.demoNow,
        you_are_secretary_of: { id: u.id, name: u.name, title: u.title, company: companies.get(u.companyId)?.name, role: m.persona?.label, focus: m.persona?.summary },
        site: s.site,
        areas: s.areas,
        companies: s.companies.map(({ id, name, shortName, role, trade }) => ({ id, name, shortName, role, trade })),
        people: s.people.filter((p) => !p.isBot).map((p) => ({ id: p.id, name: p.name, company: companies.get(p.companyId)?.shortName, title: p.title })),
      });
    },
  );

  // --- チャット ---
  const myRooms = () => {
    const id = me().id;
    return S().chat.rooms.filter((r) => r.memberIds.includes(id));
  };

  server.registerTool(
    "list_chat_rooms",
    {
      title: "トークルーム一覧",
      description: "自分が参加しているチャットのトークルーム一覧（工区・テーマ・会社別・社内）を返します。",
      inputSchema: {},
    },
    async () => {
      const msgs = S().chat.messages;
      return json(myRooms().map((r) => {
        const last = msgs.filter((m) => m.roomId === r.id).at(-1);
        return { id: r.id, name: r.name, category: r.category, description: r.description, members: r.memberIds.length, lastMessageAt: last?.sentAt ?? null };
      }));
    },
  );

  server.registerTool(
    "get_chat_messages",
    {
      title: "チャットのメッセージ取得",
      description: "チャットのメッセージを古い順に返します。room_id を省略すると自分が参加している全ルームを横断します。期間（YYYY-MM-DD）やキーワードで絞り込めます。",
      inputSchema: {
        room_id: z.string().optional().describe("ルーム ID（例: room-area2）。省略で全ルーム"),
        date_from: z.string().optional().describe("この日以降（YYYY-MM-DD）"),
        date_to: z.string().optional().describe("この日以前（YYYY-MM-DD）"),
        keyword: z.string().optional().describe("本文に含む文字列"),
        limit: z.number().int().min(1).max(600).optional().describe("最大件数（既定 400、新しい方から数える）"),
      },
    },
    async ({ room_id, date_from, date_to, keyword, limit = 400 }) => {
      const { who } = L();
      const rooms = new Map(myRooms().map((r) => [r.id, r]));
      if (room_id && !rooms.has(room_id)) return fail(`ルーム ${room_id} は存在しないか、参加していません`);
      const files = new Map(S().storage.files.map((f) => [f.id, f]));
      const list = S().chat.messages
        .filter((m) => rooms.has(m.roomId) && (!room_id || m.roomId === room_id) && inRange(m.sentAt, date_from, date_to) && (!keyword || m.text.includes(keyword)))
        .slice(-limit)
        .map((m) => ({
          id: m.id,
          room: rooms.get(m.roomId).name,
          room_id: m.roomId,
          from: who(m.senderId),
          at: m.sentAt,
          text: m.text,
          ...(m.replyToId ? { reply_to: m.replyToId } : {}),
          ...(m.mentionIds?.length ? { mentions: m.mentionIds.map(who) } : {}),
          ...(m.attachments?.length ? { attachments: m.attachments.map((a) => ({ file_id: a.fileId, name: files.get(a.fileId)?.name, kind: a.kind })) } : {}),
        }));
      return json({ count: list.length, messages: list });
    },
  );

  server.registerTool(
    "post_chat_message",
    {
      title: "チャットに投稿",
      description: "トークルームに AI秘書として投稿します（例: 定例の決定事項を各社のルームに流す）。複数のルームに送る場合はルームごとに呼んでください。",
      inputSchema: {
        room_id: z.string().describe("投稿先のルーム ID"),
        text: z.string().min(1).describe("本文（改行可）"),
        mention_user_ids: z.array(z.string()).optional().describe("メンションする人物 ID"),
      },
      annotations: { destructiveHint: false },
    },
    async ({ room_id, text, mention_user_ids }) => {
      const room = myRooms().find((r) => r.id === room_id);
      if (!room) return fail(`ルーム ${room_id} は存在しないか、参加していません`);
      const msg = store.mutate((st) => {
        const m = { id: nextId(st.chat.messages, "m-ai", 3), roomId: room_id, senderId: AI, text, sentAt: stampNow(), replyToId: null, mentionIds: mention_user_ids ?? [], attachments: [] };
        st.chat.messages.push(m);
        return m;
      });
      return json({ ok: true, posted: { id: msg.id, room: room.name, at: msg.sentAt } });
    },
  );

  server.registerTool(
    "add_todo",
    {
      title: "ToDo を登録",
      description: "チャットのタスク（ToDo）を登録します。担当者を省略すると自分の ToDo になります。元になったメッセージがあれば source_message_id を指定してください。",
      inputSchema: {
        title: z.string().min(1),
        detail: z.string().optional(),
        assignee_id: z.string().optional().describe("担当者の人物 ID（省略で自分）"),
        requester_id: z.string().optional().describe("依頼してきた人の人物 ID"),
        due_date: z.string().optional().describe("期限（YYYY-MM-DD）"),
        room_id: z.string().optional().describe("関連するルーム ID"),
        source_message_id: z.string().optional(),
      },
    },
    async (a) => {
      const { people } = L();
      const assignee = a.assignee_id ?? me().id;
      if (!people.has(assignee)) return fail(`人物 ${assignee} が見つかりません`);
      if (a.requester_id && !people.has(a.requester_id)) return fail(`人物 ${a.requester_id} が見つかりません`);
      if (a.room_id && !S().chat.rooms.some((r) => r.id === a.room_id)) return fail(`ルーム ${a.room_id} が見つかりません`);
      const t = store.mutate((st) => {
        const todo = {
          id: nextId(st.chat.todos, "t-ai", 3), title: a.title, detail: a.detail ?? "", assigneeId: assignee, requesterId: a.requester_id ?? null,
          roomId: a.room_id ?? null, sourceMessageId: a.source_message_id ?? null, dueDate: a.due_date ?? null, status: "open", createdById: AI, createdAt: stampNow(),
        };
        st.chat.todos.push(todo);
        return todo;
      });
      return json({ ok: true, todo: t });
    },
  );

  // --- メール ---
  const myMail = () => {
    const id = me().id;
    const has = (arr) => (arr ?? []).some((a) => a.personId === id);
    return S().mail.messages.map((m) => ({ m, inbox: has(m.to) || has(m.cc), sent: m.from?.personId === id })).filter((x) => x.inbox || x.sent);
  };
  const addr = (a) => (a ? `${a.name} <${a.email}>` : "");

  server.registerTool(
    "search_mail",
    {
      title: "メール検索",
      description: "自分のメール（受信トレイ・送信済み）を新しい順に一覧します。本文は read_mail で取得してください。",
      inputSchema: {
        folder: z.enum(["inbox", "sent", "all"]).optional().describe("既定 inbox"),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        keyword: z.string().optional().describe("件名・本文・差出人に含む文字列"),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ folder = "inbox", date_from, date_to, keyword, limit = 100 }) => {
      const id = me().id;
      const files = new Map(S().storage.files.map((f) => [f.id, f]));
      const list = myMail()
        .filter((x) => (folder === "all" ? true : folder === "sent" ? x.sent : x.inbox))
        .map((x) => x.m)
        .filter((m) => inRange(m.receivedAt, date_from, date_to))
        .filter((m) => !keyword || [m.subject, m.body, m.from?.name].some((v) => String(v ?? "").includes(keyword)))
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .slice(0, limit)
        .map((m) => ({
          id: m.id, from: addr(m.from), to: m.to.map(addr), subject: m.subject, at: m.receivedAt,
          unread: !(m.readBy ?? []).includes(id), snippet: m.body.replace(/\s+/g, " ").slice(0, 90),
          attachments: (m.attachments ?? []).map((a) => files.get(a.fileId)?.name ?? a.fileId),
        }));
      return json({ count: list.length, mails: list });
    },
  );

  server.registerTool(
    "read_mail",
    {
      title: "メールを読む",
      description: "メール 1 通の本文と添付ファイル情報を返します。添付の中身は read_file(file_id) で読めます。",
      inputSchema: { mail_id: z.string() },
    },
    async ({ mail_id }) => {
      const x = myMail().find((y) => y.m.id === mail_id);
      if (!x) return fail(`メール ${mail_id} が見つかりません`);
      const m = x.m;
      const files = new Map(S().storage.files.map((f) => [f.id, f]));
      return json({
        id: m.id, from: addr(m.from), to: m.to.map(addr), cc: (m.cc ?? []).map(addr), subject: m.subject, at: m.receivedAt, body: m.body,
        attachments: (m.attachments ?? []).map((a) => ({ file_id: a.fileId, name: files.get(a.fileId)?.name, mime: files.get(a.fileId)?.mime })),
      });
    },
  );

  // --- カレンダー ---
  const defaultCalUsers = () => me().persona?.calendarUserIds ?? [me().id];

  server.registerTool(
    "get_calendar_events",
    {
      title: "予定の取得",
      description: "指定した人たちの予定を返します。user_ids を省略すると自分と関係者（画面に表示されている人）の予定です。",
      inputSchema: {
        user_ids: z.array(z.string()).optional(),
        date_from: z.string().describe("YYYY-MM-DD"),
        date_to: z.string().describe("YYYY-MM-DD"),
      },
    },
    async ({ user_ids, date_from, date_to }) => {
      const { nameOf } = L();
      const ids = user_ids?.length ? user_ids : defaultCalUsers();
      const ev = S().calendar.events
        .filter((e) => e.attendeeIds.some((a) => ids.includes(a)) && inRange(e.start, date_from, null) && day(e.allDay ? e.end : e.start) <= date_to)
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, all_day: !!e.allDay, location: e.location, attendees: e.attendeeIds.map(nameOf), description: e.description || undefined }));
      return json({ users: ids.map(nameOf), count: ev.length, events: ev });
    },
  );

  server.registerTool(
    "find_free_slots",
    {
      title: "共通の空き時間を探す",
      description: "指定した全員が空いている時間帯を、勤務時間（平日 8:00〜18:00）の中から探します。いまより前の時間は除きます。",
      inputSchema: {
        user_ids: z.array(z.string()).min(1).describe("参加者の人物 ID（自分も含める）"),
        date_from: z.string().describe("YYYY-MM-DD"),
        date_to: z.string().describe("YYYY-MM-DD"),
        duration_minutes: z.number().int().min(5).max(600).describe("必要な長さ（分）"),
      },
    },
    async ({ user_ids, date_from, date_to, duration_minutes }) => {
      const { people, nameOf } = L();
      for (const u of user_ids) if (!people.has(u)) return fail(`人物 ${u} が見つかりません`);
      const wh = S().calendar.workingHours ?? { start: "08:00", end: "18:00" };
      const now = new Date(nowIso()).getTime();
      const busy = S().calendar.events.filter((e) => !e.allDay && e.attendeeIds.some((a) => user_ids.includes(a)))
        .map((e) => [new Date(e.start).getTime(), new Date(e.end).getTime()]);
      const out = [];
      for (let d = new Date(`${date_from}T12:00:00+09:00`); fmtYmd(d) <= date_to; d = new Date(d.getTime() + 864e5)) {
        const ymd = fmtYmd(d);
        const w = new Date(`${ymd}T12:00:00+09:00`).getDay();
        if (w === 0 || w === 6) continue;
        let s = Math.max(new Date(`${ymd}T${wh.start}:00+09:00`).getTime(), now);
        const end = new Date(`${ymd}T${wh.end}:00+09:00`).getTime();
        const dayBusy = busy.filter(([a, b]) => b > s && a < end).sort((x, y) => x[0] - y[0]);
        for (const [a, b] of dayBusy) {
          if (a - s >= duration_minutes * 60e3) out.push([s, a]);
          s = Math.max(s, b);
        }
        if (end - s >= duration_minutes * 60e3) out.push([s, end]);
      }
      const t = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(11, 16);
      const ymdOf = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
      return json({
        participants: user_ids.map(nameOf),
        duration_minutes,
        slots: out.map(([a, b]) => ({ date: `${ymdOf(a)}（${wd(ymdOf(a))}）`, start: t(a), end: t(b) })),
      });
    },
  );

  server.registerTool(
    "create_calendar_event",
    {
      title: "予定を登録",
      description: "予定を登録します（参加者全員のカレンダーに入ります）。日時は ISO 8601（例: 2026-11-12T15:30:00+09:00）。",
      inputSchema: {
        title: z.string().min(1),
        start: z.string(),
        end: z.string(),
        attendee_ids: z.array(z.string()).min(1).describe("参加者の人物 ID（自分を含める）"),
        location: z.string().optional(),
        description: z.string().optional(),
      },
    },
    async (a) => {
      const { people, nameOf } = L();
      for (const u of a.attendee_ids) if (!people.has(u)) return fail(`人物 ${u} が見つかりません`);
      const s = new Date(a.start), e = new Date(a.end);
      if (isNaN(s) || isNaN(e) || e <= s) return fail("開始・終了の日時が正しくありません");
      const norm = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().replace(/\.\d{3}Z$/, "+09:00");
      const ev = store.mutate((st) => {
        const x = { id: nextId(st.calendar.events, "ev-ai", 3), title: a.title, start: norm(s), end: norm(e), allDay: false, location: a.location ?? "", organizerId: AI, attendeeIds: a.attendee_ids, description: a.description ?? "AI秘書が登録した予定" };
        st.calendar.events.push(x);
        return x;
      });
      return json({ ok: true, event: { ...ev, attendees: ev.attendeeIds.map(nameOf) } });
    },
  );

  // --- ファイル ---
  server.registerTool(
    "list_files",
    {
      title: "ファイル一覧",
      description: "現場の共有フォルダのフォルダ構成とファイル一覧を返します。folder_id を指定するとそのフォルダ（配下を含む）だけを返します。",
      inputSchema: { folder_id: z.string().optional() },
    },
    async ({ folder_id }) => {
      const { nameOf } = L();
      const { folders, files } = S().storage;
      const path = (id) => { const p = []; for (let f = folders.find((x) => x.id === id); f; f = folders.find((x) => x.id === f.parentId)) p.unshift(f.name); return p.join("/"); };
      const under = (id) => { if (!folder_id) return true; for (let f = folders.find((x) => x.id === id); f; f = folders.find((x) => x.id === f.parentId)) if (f.id === folder_id) return true; return false; };
      return json({
        folders: folders.filter((f) => under(f.id)).map((f) => ({ id: f.id, path: path(f.id) })),
        files: files.filter((f) => f.folderId && under(f.folderId)).map((f) => ({ file_id: f.id, name: f.name, folder: path(f.folderId), mime: f.mime, updated_at: f.updatedAt, updated_by: nameOf(f.updatedById) })),
      });
    },
  );

  server.registerTool(
    "read_file",
    {
      title: "ファイルを読む",
      description: "ファイルの中身を返します。テキストはそのまま、Excel は表（行の配列）、PDF は抽出したテキスト、画像（写真・手書き書類のスキャンなど）は画像として返します。メールやチャットの添付もこの file_id で読めます。",
      inputSchema: { file_id: z.string() },
    },
    async ({ file_id }) => {
      const f = store.findFile(file_id);
      if (!f?.path) return fail(`ファイル ${file_id} が見つかりません`);
      const abs = join(ROOT, f.path);
      const head = { file_id: f.id, name: f.name, mime: f.mime };
      try {
        if (f.mime?.startsWith("image/")) {
          const b = await readFile(abs);
          return { content: [{ type: "text", text: JSON.stringify(head) }, { type: "image", data: b.toString("base64"), mimeType: f.mime }] };
        }
        if (f.mime === "application/pdf") {
          const pdf = await getDocumentProxy(new Uint8Array(await readFile(abs)));
          const { text } = await extractText(pdf, { mergePages: true });
          return json({ ...head, text });
        }
        if (/sheet|excel/.test(f.mime ?? "") || f.name.endsWith(".xlsx")) {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.readFile(abs);
          const sheets = wb.worksheets.map((ws) => {
            const rows = [];
            ws.eachRow((row) => rows.push(row.values.slice(1).map((v) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "object" ? v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join("") : "") : v))));
            return { name: ws.name, rows };
          });
          return json({ ...head, sheets });
        }
        return json({ ...head, text: await readFile(abs, "utf8") });
      } catch (e) {
        return fail(`読み込みに失敗しました: ${e.message}`);
      }
    },
  );

  server.registerTool(
    "create_excel",
    {
      title: "Excel を作成して保存",
      description: "表データから Excel ファイル（.xlsx）を作り、共有フォルダに保存します（例: 日報を 1 つの表にまとめる）。日報まとめは folder_id に fo-nippo-202611 を指定してください。",
      inputSchema: {
        file_name: z.string().min(1).describe("ファイル名（.xlsx は自動で付きます）"),
        folder_id: z.string().describe("保存先フォルダ ID"),
        sheet_name: z.string().optional(),
        columns: z.array(z.string()).min(1).describe("列見出し"),
        rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).describe("行データ（列見出しと同じ順）"),
      },
    },
    async ({ file_name, folder_id, sheet_name, columns, rows }) => {
      if (!S().storage.folders.some((f) => f.id === folder_id)) return fail(`フォルダ ${folder_id} が見つかりません`);
      const name = file_name.endsWith(".xlsx") ? file_name : `${file_name}.xlsx`;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet((sheet_name || "Sheet1").slice(0, 31));
      ws.addRow(columns);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };
      rows.forEach((r) => ws.addRow(r.map((v) => v ?? "")));
      ws.columns.forEach((c, i) => { c.width = Math.min(60, Math.max(10, ...[columns[i], ...rows.map((r) => r[i])].map((v) => String(v ?? "").length * 2 + 2))); });
      const dir = join(ROOT, "files", "generated");
      await mkdir(dir, { recursive: true });
      const id = `f-ai-${Date.now().toString(36)}`;
      const rel = `files/generated/${id}.xlsx`;
      await wb.xlsx.writeFile(join(ROOT, rel));
      const size = (await stat(join(ROOT, rel))).size;
      store.mutate((st) => {
        st.storage.files.push({ id, name, folderId: folder_id, path: rel, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size, updatedAt: stampNow(), updatedById: AI, description: "AI秘書が作成" });
      });
      return json({ ok: true, file_id: id, name, folder_id, rows: rows.length });
    },
  );

  // --- 工程表・天気 ---
  server.registerTool(
    "get_schedule",
    {
      title: "工程表の取得",
      description: "工程表の作業を返します。active_on（YYYY-MM-DD）でその日に作業がある工程だけ、company_id・area_id・status でも絞り込めます。baseline は当初計画、start/end は現在の予定です。",
      inputSchema: {
        active_on: z.string().optional(),
        date_from: z.string().optional().describe("この日以降に終わる工程"),
        date_to: z.string().optional().describe("この日以前に始まる工程"),
        company_id: z.string().optional(),
        area_id: z.string().optional(),
        status: z.enum(["done", "in_progress", "not_started", "delayed"]).optional(),
      },
    },
    async (q) => {
      const { companies, s } = L();
      const areas = new Map(s.areas.map((a) => [a.id, a.name]));
      const sch = S().schedule;
      const tasks = sch.tasks
        .filter((t) => !t.summary)
        .filter((t) => !q.active_on || (t.start <= q.active_on && q.active_on <= t.end))
        .filter((t) => !q.date_from || t.end >= q.date_from)
        .filter((t) => !q.date_to || t.start <= q.date_to)
        .filter((t) => (!q.company_id || t.companyId === q.company_id) && (!q.area_id || t.areaId === q.area_id) && (!q.status || t.status === q.status))
        .map((t) => ({
          id: t.id, wbs: t.wbs, name: t.name, area: areas.get(t.areaId), floor: t.floor, company: companies.get(t.companyId)?.shortName, company_id: t.companyId,
          start: t.start, end: t.end, baseline: `${t.baselineStart}〜${t.baselineEnd}`, workers_per_day: t.workers, outdoor: t.outdoor, can_advance: t.canAdvance,
          progress: t.progress, status: t.status, depends_on: t.dependsOn?.length ? t.dependsOn : undefined, note: t.note || undefined,
        }));
      return json({ project: sch.project, count: tasks.length, tasks, milestones: q.active_on ? undefined : sch.milestones });
    },
  );

  server.registerTool(
    "get_weather",
    {
      title: "天気予報",
      description: "現場（東京都港区）の日ごとの天気予報を返します。",
      inputSchema: { date_from: z.string().optional(), date_to: z.string().optional() },
    },
    async ({ date_from, date_to }) => {
      const w = S().weather;
      return json({ location: w.location, forecasts: w.forecasts.filter((f) => inRange(f.date, date_from, date_to)) });
    },
  );

  return server;
}

function fmtYmd(d) {
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}

// ---------- Express への組み込み（ステートレス Streamable HTTP） ----------
export function mountMcp(app) {
  app.post("/mcp", async (req, res) => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error("[mcp]", e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  });
  const notAllowed = (_req, res) => res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);
}
