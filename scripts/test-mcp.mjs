// MCP の動作確認（MCP Inspector の代わりに SDK のクライアントで全ツールを叩く）
// 使い方: サーバー起動後に  node scripts/test-mcp.mjs [http://localhost:3000/mcp]
// 書き込み系も実行し、最後に /admin/reset で初期状態に戻す（--keep を付けると書き込みを残す）。
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const keep = process.argv.includes("--keep");
const url = process.argv.slice(2).find((a) => a.startsWith("http")) ?? "http://localhost:3000/mcp";
const base = url.replace(/\/mcp$/, "");
const client = new Client({ name: "test-mcp", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

let ng = 0;
const ok = (cond, label) => { console.log(`${cond ? "OK " : "NG "} ${label}`); if (!cond) ng++; };
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content.find((c) => c.type === "text")?.text ?? "";
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { r, data, text };
};

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));
ok(tools.length >= 15, `ツール数 ${tools.length}`);

const ctx = (await call("get_context")).data;
ok(ctx.today.startsWith("2026-11-11") && ctx.you_are_secretary_of.id === "u-sato", `get_context: ${ctx.today} / ${ctx.you_are_secretary_of.name}`);

const rooms = (await call("list_chat_rooms")).data;
ok(rooms.length > 20, `list_chat_rooms: ${rooms.length} ルーム`);

const hc = (await call("get_chat_messages", { room_id: "room-headcount", date_from: "2026-11-11", date_to: "2026-11-11" })).data;
ok(hc.count >= 6, `#7 翌日人員ルーム 11/11: ${hc.count} 件`);

const tomorrow = (await call("get_schedule", { active_on: "2026-11-12" })).data;
const cos = [...new Set(tomorrow.tasks.map((t) => t.company))];
ok(cos.length === 8, `#7 11/12 作業会社: ${cos.join("、")}`);

const free = (await call("find_free_slots", { user_ids: ["u-sato", "u-nakamura", "u-kobayashi"], date_from: "2026-11-11", date_to: "2026-11-13", duration_minutes: 30 })).data;
ok(free.slots.length === 2 && free.slots[0].start === "15:30", `#2 共通の空き: ${free.slots.map((s) => `${s.date} ${s.start}-${s.end}`).join(" / ")}`);

const mails = (await call("search_mail", { date_from: "2026-11-11" })).data;
ok(mails.count > 0, `search_mail 今日: ${mails.count} 通`);

const png = (await call("read_file", { file_id: "f-nippo-naiso-1110-png" })).r;
ok(png.content.some((c) => c.type === "image"), "#10 手書き日報（画像）を返す");
const pdf = (await call("read_file", { file_id: "f-nippo-tosou-1110-pdf" })).data;
ok(/中塗/.test(pdf?.text ?? ""), `#10 PDF 日報のテキスト抽出（${(pdf?.text ?? "").length} 文字）`);
const xlsx = (await call("read_file", { file_id: "f-nippo-kucho-1110-xlsx" })).data;
ok(xlsx?.sheets?.[0]?.rows?.length > 3, "#10 Excel 日報を表で返す");
const txt = (await call("read_file", { file_id: "f-teirei-1110-txt" })).data;
ok((txt?.text ?? "").length > 5000, `#3 定例の文字起こし（${(txt?.text ?? "").length} 文字）`);

const w = (await call("get_weather", { date_from: "2026-11-12", date_to: "2026-11-12" })).data;
ok(w.forecasts[0]?.weather === "雨", "#8 11/12 は雨");

// --- 書き込み ---
const v0 = (await (await fetch(`${base}/api/version`)).json()).version;
const ev = (await call("create_calendar_event", { title: "設備・内装 打合せ", start: "2026-11-12T15:30:00+09:00", end: "2026-11-12T16:00:00+09:00", attendee_ids: ["u-sato", "u-nakamura", "u-kobayashi"], location: "現場事務所" })).data;
ok(ev?.ok, `#2 予定登録 ${ev?.event?.id}`);
const post = (await call("post_chat_message", { room_id: "room-co-denki", text: "【11/10 工程定例の決定事項】6〜8F 幹線ケーブル入線を 11/14 までに完了してください。" })).data;
ok(post?.ok, `#3 チャット投稿 ${post?.posted?.id}`);
const todo = (await call("add_todo", { title: "6F EPS スリーブ位置の確認", requester_id: "u-inoue", room_id: "room-area2", due_date: "2026-11-12" })).data;
ok(todo?.ok, `#1 ToDo 登録 ${todo?.todo?.id}`);
const xl = (await call("create_excel", { file_name: "日報まとめ_2026-11-10", folder_id: "fo-nippo-202611", columns: ["日付", "会社", "作業内容", "人数"], rows: [["2026-11-10", "三光電設", "7F 幹線ケーブル入線", 5]] })).data;
ok(xl?.ok, `#10 Excel 保存 ${xl?.file_id}`);
const v1 = (await (await fetch(`${base}/api/version`)).json()).version;
ok(v1 >= v0 + 4, `書き込みで version が進む（${v0} → ${v1}）＝画面に反映される`);

const bad = await call("post_chat_message", { room_id: "room-nope", text: "x" });
ok(bad.r.isError, "存在しないルームはエラーになる");

if (!keep) await fetch(`${base}/admin/reset`, { method: "POST" });
console.log(ng ? `\n${ng} 件 NG` : `\nすべて OK${keep ? "（書き込みは残しています）" : "（データは初期状態に戻しました）"}`);
await client.close();
process.exit(ng ? 1 : 0);
