// AI秘書デモ用モックサーバー
//   /                         … アプリ一覧（ポータル）
//   /chat /mail /calendar /storage /schedule … ハリボテ画面（public/ 配下の静的ファイル）
//   GET  /api/state?only=chat,site … 画面がポーリングで読む現在データ（version 付き）
//   GET  /files/:fileId       … 添付・ストレージのファイル本体
//   GET  /api/files/:fileId/table … xlsx をシートごとの 2 次元配列にして返す（プレビュー用）
//   GET/POST /api/session     … アクター（現場管理者・本社・事務）の取得・切替
//   POST /admin/reset         … data/*.json の初期状態に戻す（アクターはそのまま）
//   POST /mcp                 … AI秘書向け MCP（Streamable HTTP・ステートレス）。ツールは src/mcp.js
import express from "express";
import ExcelJS from "exceljs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import * as store from "./src/store.js";
import { mountMcp } from "./src/mcp.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/api/state", (req, res) => {
  const only = req.query.only ? String(req.query.only).split(",") : null;
  res.set("Cache-Control", "no-store");
  res.json(store.getState(only));
});

app.get("/api/version", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ version: store.getVersion() });
});

function resolveFile(fileId) {
  const f = store.findFile(fileId);
  if (!f || !f.path) return null;
  const abs = join(ROOT, f.path);
  return existsSync(abs) ? { meta: f, abs } : null;
}

app.get("/files/:fileId", (req, res) => {
  const r = resolveFile(req.params.fileId);
  if (!r) return res.status(404).send("not found");
  if (r.meta.mime) res.type(r.meta.mime);
  if (req.query.download) res.attachment(r.meta.name);
  else res.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(r.meta.name)}`);
  res.sendFile(r.abs);
});

app.get("/api/files/:fileId/table", async (req, res) => {
  const r = resolveFile(req.params.fileId);
  if (!r) return res.status(404).json({ error: "not found" });
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(r.abs);
    const sheets = wb.worksheets.map((ws) => {
      const rows = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        const vals = row.values.slice(1).map((v) => {
          if (v == null) return "";
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          if (typeof v === "object") return v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join("") : "");
          return v;
        });
        rows.push(vals);
      });
      return { name: ws.name, rows, merges: ws.model.merges ?? [] };
    });
    res.json({ sheets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

mountMcp(app);

// アクター（目線）の取得・切替。切替は全画面にポーリングで伝わる
app.get("/api/session", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ persona: store.getPersona(), personas: store.getState(["site"]).site?.personas ?? [] });
});
app.post("/api/session", (req, res) => {
  if (!store.setPersona(req.body?.personaId)) return res.status(400).json({ error: "unknown personaId" });
  res.json({ ok: true, persona: store.getPersona(), version: store.getVersion() });
});

app.post("/admin/reset", (_req, res) => {
  store.reset();
  res.json({ ok: true, version: store.getVersion() });
});

// /chat?room=… のように末尾スラッシュなしでも、リダイレクトせずに各画面を返す（クエリが落ちないように）
const APPS = ["chat", "mail", "calendar", "storage", "schedule"];
app.get(APPS.map((a) => `/${a}`), (req, res) => {
  res.sendFile(join(ROOT, "public", req.path.slice(1), "index.html"));
});

app.use(express.static(join(ROOT, "public"), { extensions: ["html"] }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`AI秘書デモ モック: http://localhost:${port}`);
});
