// ファイル共有（ストレージ）画面
//   URL: /storage?folder=fo-nippo-202611&file=<fileId>   … フォルダー表示＋プレビュー
//        /storage?view=recent                            … 最近使用したファイル（updatedAt 降順）
//        /storage?view=mine                              … 自分が更新したファイル
//        /storage?q=日報                                  … 検索
import { watchState, lookup, fmt, escapeHtml, fileUrl, currentActor } from "/shared/api.js";

const $ = (s) => document.querySelector(s);
const els = {
  tree: $("#tree"), crumbs: $("#crumbs"), title: $("#title"), content: $("#content"), count: $("#count"),
  search: $("#search"), siteName: $("#site-name"), me: $("#me"),
  preview: $("#preview"), pvName: $("#pv-name"), pvIcon: $("#pv-icon"), pvStage: $("#pv-stage"), pvInfo: $("#pv-info"),
  pvDownload: $("#pv-download"), pvPrev: $("#pv-prev"), pvNext: $("#pv-next"), toasts: $("#toasts"),
};

let storage = null;
let site = null;
let L = lookup(null);
let knownIds = null;           // 初回ロード時点のファイル ID（以降に増えたものを NEW 扱い）
const newIds = new Set();
const flashIds = new Set();    // 次の描画でアニメーションさせるもの
const expanded = new Set();
let mode = readLS("storage.mode") || "list";
let sort = { key: "name", dir: 1 };
let previewKey = null;         // 表示中プレビューの fileId（再描画抑止用）
let navList = [];              // プレビューの前後移動用（現在の一覧のファイル順）
let actor = currentActor(null);  // 現在のアクター（目線）
let actorKey = null;           // 前回描画時の personaId（切替検知用）
// アクターごとの「最初に開くフォルダー」（URL に folder 指定がないときだけ使う）
const DEFAULT_FOLDER = { field: "fo-root", honsha: "fo-koutei", jimu: "fo-nippo-202611" };
const meId = () => actor.personId;
const defaultFolderId = () => {
  const id = DEFAULT_FOLDER[actor.personaId];
  return folderById(id) ? id : rootFolder()?.id;
};
const isList = (v) => v === "recent" || v === "mine";

function readLS(k) { try { return localStorage.getItem(k); } catch { return null; } }
function writeLS(k, v) { try { localStorage.setItem(k, v); } catch { /* noop */ } }

/* ---------------- URL state ---------------- */
function getParams() {
  const p = new URLSearchParams(location.search);
  return { folder: p.get("folder"), view: p.get("view"), q: p.get("q") || "", file: p.get("file") };
}
function setParams(next, push = true) {
  const cur = getParams();
  const merged = { ...cur, ...next };
  const p = new URLSearchParams();
  if (merged.q) p.set("q", merged.q);
  else if (isList(merged.view)) p.set("view", merged.view);
  else if (merged.folder) p.set("folder", merged.folder);
  if (merged.file) p.set("file", merged.file);
  const url = `${location.pathname}${p.toString() ? "?" + p : ""}`;
  if (url === location.pathname + location.search) return render();
  history[push ? "pushState" : "replaceState"](null, "", url);
  render();
}
window.addEventListener("popstate", render);

/* ---------------- data helpers ---------------- */
const folders = () => storage?.folders ?? [];
const visibleFiles = () => (storage?.files ?? []).filter((f) => f.folderId != null);
const rootFolder = () => folders().find((f) => f.parentId == null);
const folderById = (id) => folders().find((f) => f.id === id);
const childFolders = (id) => folders().filter((f) => f.parentId === id).sort((a, b) => a.name.localeCompare(b.name, "ja"));
const filesIn = (id) => visibleFiles().filter((f) => f.folderId === id);
function ancestors(id) {
  const out = [];
  let f = folderById(id);
  while (f) { out.unshift(f); f = f.parentId ? folderById(f.parentId) : null; }
  return out;
}
function descendantFiles(id) {
  let out = filesIn(id);
  for (const c of childFolders(id)) out = out.concat(descendantFiles(c.id));
  return out;
}
const folderPath = (id) => ancestors(id).map((f) => f.name).join(" / ");
const hasNewInside = (id) => descendantFiles(id).some((f) => newIds.has(f.id));

function kindOf(f) {
  if (!f) return "other";
  if (f.isFolder) return "folder";
  const n = (f.name || "").toLowerCase();
  const m = (f.mime || "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/sheet|excel/.test(m) || /\.(xlsx?|csv)$/.test(n)) return "xlsx";
  if (/word|officedocument\.wordprocessing/.test(m) || /\.docx?$/.test(n)) return "docx";
  if (m.startsWith("text/") || /\.(txt|md|log)$/.test(n)) return "txt";
  return "other";
}
const KIND_LABEL = { folder: "フォルダー", image: "画像", pdf: "PDF", xlsx: "Excel ブック", docx: "Word 文書", txt: "テキスト", other: "ファイル" };

/* ---------------- icons ---------------- */
function docSvg(color, label, glyph = "") {
  return `<svg viewBox="0 0 32 32"><path d="M7 2.5h12.5L26 9v20.5H7z" fill="#fff" stroke="#c9ced6" stroke-width="1"/>
    <path d="M19.5 2.5V9H26" fill="#eef0f3" stroke="#c9ced6" stroke-width="1" stroke-linejoin="round"/>
    ${glyph}
    <rect x="3" y="15" width="20" height="10" rx="1.5" fill="${color}"/>
    <text x="13" y="22.6" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="${label.length > 3 ? 6.2 : 7}" font-weight="700" fill="#fff">${label}</text></svg>`;
}
const ICONS = {
  folder: `<svg viewBox="0 0 32 32"><path d="M3 8a2 2 0 0 1 2-2h7.2l2.6 2.6H27a2 2 0 0 1 2 2V25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#e8a93a"/><path d="M3 11.5a2 2 0 0 1 2-2h22a2 2 0 0 1 2 2V25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#f6c453"/></svg>`,
  pdf: docSvg("#d93025", "PDF"),
  xlsx: docSvg("#188038", "XLSX", `<path d="M10 5.5h7v1.4h-7zm0 2.6h7v1.4h-7zm0 2.6h12v1.4H10z" fill="#c8e6d0"/>`),
  docx: docSvg("#1a5fd0", "DOCX", `<path d="M10 5.5h7v1.4h-7zm0 2.6h12v1.4H10zm0 2.6h12v1.4H10z" fill="#cfdcf5"/>`),
  txt: docSvg("#6b7280", "TXT", `<path d="M10 5.5h7v1.2h-7zm0 2.4h12v1.2H10zm0 2.4h12v1.2H10z" fill="#d6d9de"/>`),
  image: `<svg viewBox="0 0 32 32"><rect x="3.5" y="5.5" width="25" height="21" rx="2.5" fill="#fff" stroke="#c9ced6"/><rect x="6" y="8" width="20" height="16" rx="1" fill="#e6efff"/><circle cx="12" cy="13" r="2.2" fill="#f6b73c"/><path d="M6 24l6.5-7 4.5 4.5 3.5-3.5L26 23.5V24z" fill="#3f8cff"/></svg>`,
  other: docSvg("#8a94a6", "FILE"),
};
const icon = (kind, cls = "") => `<span class="ficon ${cls}">${ICONS[kind] || ICONS.other}</span>`;

function avatar(personId, cls = "") {
  const p = L.person(personId);
  const name = p?.name ?? personId ?? "";
  const ch = p?.isBot ? "AI" : name.trim().charAt(0);
  return `<span class="av ${cls}" style="background:${p?.color || "#8a94a6"}">${escapeHtml(ch)}</span>`;
}
const userName = (id) => (id && id === meId() ? "自分" : L.personName(id));
const userCell = (id) => (id ? `<span class="usercell ${id === meId() ? "is-me" : ""}">${avatar(id)}<span>${escapeHtml(userName(id))}</span></span>` : `<span class="dim">—</span>`);

/* ---------------- formatting ---------------- */
function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const ymd = fmt.ymd(d);
  const t = fmt.time(iso);
  if (site?.today) {
    const today = new Date(site.today + "T00:00:00");
    const diff = Math.round((new Date(ymd + "T00:00:00") - today) / 86400000);
    if (diff === 0) return `今日 ${t}`;
    if (diff === -1) return `昨日 ${t}`;
  }
  return `${ymd.replace(/-/g, "/")} ${t}`;
}
const fullWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${fmt.weekday(iso)}) ${fmt.time(iso)}`;
};

/* ---------------- render ---------------- */
function render() {
  if (!storage) {
    els.title.textContent = "ファイル共有";
    els.crumbs.innerHTML = "";
    els.tree.innerHTML = "";
    els.count.textContent = "";
    els.content.innerHTML = `<div class="empty">${icon("folder", "lg")}<div>共有フォルダーのデータを読み込めませんでした</div></div>`;
    return;
  }
  const prm = getParams();
  const root = rootFolder();
  const folderId = prm.q || isList(prm.view) ? null : (folderById(prm.folder) ? prm.folder : defaultFolderId());
  if (folderId) for (const a of ancestors(folderId)) expanded.add(a.id);
  if (root) expanded.add(root.id);

  els.search.value !== prm.q && document.activeElement !== els.search && (els.search.value = prm.q);
  renderNav(prm, folderId);
  renderTree(folderId);
  renderHeader(prm, folderId);
  renderContent(prm, folderId);
  renderPreview(prm.file);
  flashIds.clear();
}

function renderNav(prm, folderId) {
  for (const a of document.querySelectorAll(".nav-item")) {
    const v = a.dataset.view;
    a.classList.toggle("on", !prm.q && ((isList(v) && prm.view === v) || (v === "all" && !isList(prm.view) && folderId === rootFolder()?.id)));
  }
}

function renderTree(currentId) {
  const root = rootFolder();
  if (!root) { els.tree.innerHTML = ""; return; }
  const row = (f, depth) => {
    const kids = childFolders(f.id);
    const open = expanded.has(f.id);
    let h = `<div class="tree-row ${f.id === currentId ? "on" : ""}" data-folder="${f.id}" style="padding-left:${8 + depth * 18}px">
      <span class="tw ${kids.length ? "" : "none"} ${open ? "open" : ""}" data-toggle="${f.id}"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 6l6 6-6 6-1.4-1.4 4.6-4.6-4.6-4.6z"/></svg></span>
      ${icon("folder").replace('class="ficon ', 'style="width:20px;height:20px" class="ficon ')}
      <span class="tn">${escapeHtml(f.name)}</span>${hasNewInside(f.id) ? `<span class="dot" title="新しいファイル"></span>` : ""}
    </div>`;
    if (open) for (const k of kids) h += row(k, depth + 1);
    return h;
  };
  els.tree.innerHTML = row(root, 0);
}

function renderHeader(prm, folderId) {
  if (prm.q) {
    els.crumbs.innerHTML = `<a href="?" data-folder="${rootFolder()?.id}">すべてのファイル</a><span class="sep">›</span><span class="cur">検索</span>`;
    els.title.textContent = `「${prm.q}」の検索結果`;
  } else if (prm.view === "recent") {
    els.crumbs.innerHTML = `<a href="?" data-folder="${rootFolder()?.id}">すべてのファイル</a><span class="sep">›</span><span class="cur">最近使用したファイル</span>`;
    els.title.textContent = "最近使用したファイル";
  } else if (prm.view === "mine") {
    els.crumbs.innerHTML = `<a href="?" data-folder="${rootFolder()?.id}">すべてのファイル</a><span class="sep">›</span><span class="cur">自分が更新したファイル</span>`;
    els.title.textContent = `自分が更新したファイル（${L.personName(meId())}）`;
  } else {
    const chain = ancestors(folderId);
    els.crumbs.innerHTML = chain.map((f, i) =>
      i === chain.length - 1 ? `<span class="cur">${escapeHtml(f.name)}</span>` : `<a href="?folder=${f.id}" data-folder="${f.id}">${escapeHtml(f.name)}</a><span class="sep">›</span>`
    ).join("");
    els.title.innerHTML = `${icon("folder")}${escapeHtml(folderById(folderId)?.name ?? "")}`;
  }
  document.title = `${els.title.textContent} - ファイル共有`;
}

function folderItem(fo) {
  const files = descendantFiles(fo.id);
  const latest = files.reduce((a, b) => (!a || b.updatedAt > a.updatedAt ? b : a), null);
  const n = childFolders(fo.id).length + filesIn(fo.id).length;
  return { isFolder: true, id: fo.id, name: fo.name, folderId: fo.parentId, updatedAt: latest?.updatedAt, updatedById: latest?.updatedById, count: n };
}

function sortItems(items) {
  const k = sort.key, d = sort.dir;
  return items.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    let r = 0;
    if (k === "name") r = a.name.localeCompare(b.name, "ja", { numeric: true });
    else if (k === "date") r = String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? ""));
    else if (k === "size") r = (a.isFolder ? a.count : a.size ?? 0) - (b.isFolder ? b.count : b.size ?? 0);
    else if (k === "user") r = userName(a.updatedById ?? "").localeCompare(userName(b.updatedById ?? ""), "ja");
    return r * d;
  });
}

function listItems(prm, folderId) {
  if (prm.q) {
    const q = prm.q.toLowerCase();
    const fos = folders().filter((f) => f.parentId && f.name.toLowerCase().includes(q)).map(folderItem);
    const fis = visibleFiles().filter((f) => f.name.toLowerCase().includes(q) || (f.description || "").toLowerCase().includes(q));
    return { items: sortItems([...fos, ...fis]), showLoc: true };
  }
  if (prm.view === "recent") {
    const items = [...visibleFiles()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return { items, showLoc: true };
  }
  if (prm.view === "mine") {
    const items = visibleFiles().filter((f) => f.updatedById === meId()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return { items, showLoc: true };
  }
  return { items: sortItems([...childFolders(folderId).map(folderItem), ...filesIn(folderId)]), showLoc: false };
}

function renderContent(prm, folderId) {
  const { items, showLoc } = listItems(prm, folderId);
  navList = items.filter((i) => !i.isFolder).map((i) => i.id);
  const nf = items.filter((i) => i.isFolder).length;
  els.count.textContent = items.length ? `${nf ? `フォルダー ${nf} 件・` : ""}ファイル ${items.length - nf} 件` : "";
  for (const b of document.querySelectorAll(".seg button")) b.classList.toggle("on", b.dataset.mode === mode);

  if (!items.length) {
    els.content.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24" width="80" height="80"><path fill="currentColor" d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2h7A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>
      <div>${prm.q ? "該当するファイルはありません" : prm.view === "mine" ? "自分が更新したファイルはまだありません" : "このフォルダーは空です"}</div></div>`;
    return;
  }
  const sel = prm.file;
  const isRecent = isList(prm.view) && !prm.q;
  if (mode === "grid") {
    els.content.innerHTML = `<div class="grid">${items.map((it) => {
      const k = kindOf(it);
      const isNew = newIds.has(it.id);
      const thumb = k === "image" ? `<img loading="lazy" src="${fileUrl(it.id)}" alt="">` : icon(k, "lg");
      const sub = it.isFolder ? `${it.count} 項目` : `${when(it.updatedAt)}・${escapeHtml(userName(it.updatedById))}`;
      return `<div class="card ${isNew ? "is-new" : ""} ${flashIds.has(it.id) ? "flash" : ""}" ${it.isFolder ? `data-folder="${it.id}"` : `data-file="${it.id}"`}>
        ${isNew ? `<span class="badge-new">NEW</span>` : ""}
        <div class="thumb">${thumb}</div>
        <div class="meta"><div class="cn">${icon(k)}<span class="t" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span></div><div class="cs">${sub}</div></div>
      </div>`;
    }).join("")}</div>`;
    return;
  }
  const th = (key, label, cls) => {
    const sortable = !isRecent && key;
    const ar = sortable && sort.key === key ? `<span class="ar">${sort.dir > 0 ? "▲" : "▼"}</span>` : isRecent && key === "date" ? `<span class="ar">▼</span>` : "";
    return `<th class="${cls}" ${sortable ? `data-sort="${key}"` : ""}>${label}${ar}</th>`;
  };
  els.content.innerHTML = `<table class="files"><thead><tr>
      ${th("name", "名前", "c-name")}${showLoc ? th(null, "場所", "c-loc") : ""}${th("date", "更新日時", "c-date")}${th("user", "更新者", "c-user")}${th("size", "サイズ", "c-size")}
    </tr></thead><tbody>${items.map((it) => {
      const k = kindOf(it);
      const isNew = newIds.has(it.id);
      const cls = [isNew && "is-new", flashIds.has(it.id) && "flash", sel === it.id && "sel"].filter(Boolean).join(" ");
      return `<tr class="${cls}" ${it.isFolder ? `data-folder="${it.id}"` : `data-file="${it.id}"`}>
        <td><div class="namecell">${icon(k)}<span class="nm" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>${isNew ? `<span class="badge-new">NEW</span>` : ""}</div></td>
        ${showLoc ? `<td class="loc" title="${escapeHtml(folderPath(it.folderId))}">${escapeHtml(folderPath(it.folderId))}</td>` : ""}
        <td>${it.updatedAt ? when(it.updatedAt) : `<span class="dim">—</span>`}</td>
        <td>${userCell(it.updatedById)}</td>
        <td class="c-size dim">${it.isFolder ? `${it.count} 項目` : fmt.size(it.size)}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

/* ---------------- preview ---------------- */
function renderPreview(fileId) {
  const f = fileId ? (storage?.files ?? []).find((x) => x.id === fileId) : null;
  if (!f) {
    els.preview.hidden = true;
    previewKey = null;
    return;
  }
  els.preview.hidden = false;
  const k = kindOf(f);
  els.pvIcon.innerHTML = icon(k);
  els.pvName.textContent = f.name;
  els.pvDownload.href = fileUrl(f.id, true);
  els.pvDownload.setAttribute("download", f.name);
  const idx = navList.indexOf(f.id);
  els.pvPrev.disabled = idx <= 0;
  els.pvNext.disabled = idx < 0 || idx >= navList.length - 1;
  renderInfo(f);
  if (previewKey === f.id) return;   // 本体は再読込しない（ポーリング時のちらつき防止）
  previewKey = f.id;
  const stage = els.pvStage;
  stage.innerHTML = `<div class="pv-center"><div class="spinner"></div></div>`;
  if (k === "image") {
    stage.innerHTML = `<div class="pv-center"><img src="${fileUrl(f.id)}" alt="${escapeHtml(f.name)}"></div>`;
  } else if (k === "pdf") {
    stage.innerHTML = `<iframe class="pv-pdf" src="${fileUrl(f.id)}#view=FitH" title="${escapeHtml(f.name)}"></iframe>`;
  } else if (k === "txt") {
    loadText(f);
  } else if (k === "xlsx") {
    loadSheet(f);
  } else {
    stage.innerHTML = `<div class="pv-center"><div class="pv-msg">${icon(k, "lg")}<div>このファイル形式はプレビューできません</div></div></div>`;
  }
}

function renderInfo(f) {
  const isNew = newIds.has(f.id);
  els.pvInfo.innerHTML = `<h3>詳細</h3><dl>
    <div><dt>種類</dt><dd>${KIND_LABEL[kindOf(f)]}${isNew ? `<span class="badge-new">NEW</span>` : ""}</dd></div>
    <div><dt>更新者</dt><dd>${f.updatedById ? `<span class="usercell">${avatar(f.updatedById, "lg")}<span>${escapeHtml(L.personName(f.updatedById))}${f.updatedById === meId() ? `<span class="me-tag">自分</span>` : ""}<br><span class="dim" style="font-size:12.5px">${escapeHtml(L.companyOf(f.updatedById)?.shortName ?? "")}</span></span></span>` : "—"}</dd></div>
    <div><dt>更新日時</dt><dd>${fullWhen(f.updatedAt)}</dd></div>
    <div><dt>サイズ</dt><dd>${fmt.size(f.size)}${f.size != null ? ` <span class="dim">(${Number(f.size).toLocaleString()} バイト)</span>` : ""}</dd></div>
    <div><dt>場所</dt><dd>${f.folderId ? `<a href="?folder=${f.folderId}" data-folder="${f.folderId}">${escapeHtml(folderPath(f.folderId))}</a>` : "—"}</dd></div>
    ${f.description ? `<div><dt>説明</dt><dd class="desc">${escapeHtml(f.description)}</dd></div>` : ""}
  </dl>`;
}

async function loadText(f) {
  const key = f.id;
  try {
    const res = await fetch(fileUrl(f.id), { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    const text = await res.text();
    if (previewKey !== key) return;
    const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
    const html = lines.map((ln) => {
      // [00:01:44] 山本所長：本文  /  井上（三光電設）：本文
      const m = ln.match(/^(\s*\[[\d:]+\]\s*)?([^\s：「」\[]{1,24}?：)(.*)$/);
      const body = m
        ? `${m[1] ? `<span class="ts">${escapeHtml(m[1])}</span>` : ""}<span class="spk">${escapeHtml(m[2])}</span>${escapeHtml(m[3])}`
        : escapeHtml(ln);
      return `<span class="ln">${body || "&nbsp;"}</span>`;
    }).join("");
    els.pvStage.innerHTML = `<div class="pv-textwrap"><div class="pv-text">${html}</div></div>`;
  } catch {
    if (previewKey === key) els.pvStage.innerHTML = `<div class="pv-center"><div class="pv-msg">ファイルを読み込めませんでした</div></div>`;
  }
}

function colName(i) {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}
function cellText(v) {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v ?? "");
}

async function loadSheet(f) {
  const key = f.id;
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(f.id)}/table`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.status);
    if (previewKey !== key) return;
    const sheets = data.sheets?.length ? data.sheets : [{ name: "Sheet1", rows: [] }];
    let active = 0;
    const draw = () => {
      const rows = sheets[active].rows || [];
      const nCols = Math.max(8, ...rows.map((r) => r.length));
      const nRows = Math.max(rows.length + 4, 30);
      // 見出し行の推定：先頭 6 行のうち、文字列セルが 3 つ以上並ぶ最初の行
      let hdr = -1;
      for (let i = 0; i < Math.min(6, rows.length); i++) {
        const cells = (rows[i] || []).filter((c) => c !== "" && c != null);
        if (cells.length >= 3 && cells.every((c) => typeof c === "string")) { hdr = i; break; }
      }
      let body = "";
      for (let r = 0; r < nRows; r++) {
        const row = rows[r] || [];
        const filled = row.filter((c) => c !== "" && c != null).length;
        const cls = r === hdr ? "hdr" : r === 0 && filled === 1 && hdr !== 0 ? "title" : "";
        body += `<tr class="${cls}"><th>${r + 1}</th>`;
        for (let c = 0; c < nCols; c++) {
          const v = row[c];
          body += `<td class="${typeof v === "number" ? "num" : ""}">${escapeHtml(cellText(v))}</td>`;
        }
        body += `</tr>`;
      }
      const head = `<tr><th class="corner"></th>${Array.from({ length: nCols }, (_, i) => `<th>${colName(i)}</th>`).join("")}</tr>`;
      els.pvStage.innerHTML = `<div class="sheet-wrap"><table class="sheet"><thead>${head}</thead><tbody>${body}</tbody></table></div>
        <div class="sheet-tabs">${sheets.map((s, i) => `<button type="button" data-sheet="${i}" class="${i === active ? "on" : ""}">${escapeHtml(s.name)}</button>`).join("")}</div>`;
      for (const b of els.pvStage.querySelectorAll("[data-sheet]")) b.onclick = () => { active = Number(b.dataset.sheet); draw(); };
    };
    draw();
  } catch (e) {
    if (previewKey === key) els.pvStage.innerHTML = `<div class="pv-center"><div class="pv-msg">${icon("xlsx", "lg")}<div>Excel を読み込めませんでした（${escapeHtml(e.message)}）</div></div></div>`;
  }
}

/* ---------------- toast ---------------- */
function toast(f) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="ok"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>
    <span>ファイルが追加されました: <b>${escapeHtml(f.name)}</b></span><span class="open">開く</span>`;
  el.onclick = () => { el.remove(); setParams({ file: f.id }); };
  els.toasts.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 9000);
}

/* ---------------- events ---------------- */
document.addEventListener("click", (e) => {
  const tog = e.target.closest("[data-toggle]");
  if (tog && !tog.classList.contains("none")) {
    const id = tog.dataset.toggle;
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    renderTree(isList(getParams().view) || getParams().q ? null : (folderById(getParams().folder) ? getParams().folder : defaultFolderId()));
    return;
  }
  const sortTh = e.target.closest("[data-sort]");
  if (sortTh) {
    const k = sortTh.dataset.sort;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === "date" ? -1 : 1 };
    render();
    return;
  }
  const nav = e.target.closest(".nav-item");
  if (nav) {
    e.preventDefault();
    els.search.value = "";
    if (isList(nav.dataset.view)) setParams({ view: nav.dataset.view, folder: null, q: "", file: null });
    else setParams({ view: null, folder: rootFolder()?.id, q: "", file: null });
    return;
  }
  const fo = e.target.closest("[data-folder]");
  if (fo) {
    e.preventDefault();
    expanded.add(fo.dataset.folder);
    els.search.value = "";
    setParams({ folder: fo.dataset.folder, view: null, q: "", file: null });
    return;
  }
  const fi = e.target.closest("[data-file]");
  if (fi) setParams({ file: fi.dataset.file });
});

for (const b of document.querySelectorAll(".seg button")) {
  b.onclick = () => { mode = b.dataset.mode; writeLS("storage.mode", mode); render(); };
}
$("#pv-close").onclick = () => setParams({ file: null });
els.pvPrev.onclick = () => step(-1);
els.pvNext.onclick = () => step(1);
function step(d) {
  const i = navList.indexOf(getParams().file);
  const next = navList[i + d];
  if (i >= 0 && next) setParams({ file: next }, false);
}
document.addEventListener("keydown", (e) => {
  if (els.preview.hidden) return;
  if (e.key === "Escape") setParams({ file: null });
  else if (e.key === "ArrowLeft" && document.activeElement?.tagName !== "INPUT") step(-1);
  else if (e.key === "ArrowRight" && document.activeElement?.tagName !== "INPUT") step(1);
});

let searchTimer;
els.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = els.search.value.trim();
    if (q) setParams({ q, file: null }, !getParams().q);
    else setParams({ q: "" }, false);
  }, 200);
});
els.search.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { els.search.value = ""; setParams({ q: "" }, false); els.search.blur(); }
});

/* ---------------- live data ---------------- */
watchState(["storage"], (state, { initial }) => {
  site = state.site;
  L = lookup(site);
  storage = state.storage;
  els.siteName.textContent = site?.site?.shortName ?? "";
  actor = currentActor(state);
  const me = actor.person;
  if (me) els.me.innerHTML = `${avatar(me.id, "lg")}<span class="me-name">${escapeHtml(me.name)}${actor.label ? `<small>${escapeHtml(actor.label)}</small>` : ""}</span>`;
  const switched = actorKey != null && actorKey !== actor.personaId;
  actorKey = actor.personaId;

  if (!storage) return render();
  const ids = new Set(visibleFiles().map((f) => f.id));
  if (knownIds && !initial) {
    const added = visibleFiles().filter((f) => !knownIds.has(f.id));
    for (const f of added) {
      newIds.add(f.id);
      flashIds.add(f.id);
      // 追加先フォルダーをツリーで見えるように展開（表示中のフォルダーは変えない）
      for (const a of ancestors(f.folderId)) expanded.add(a.id);
    }
    added.forEach((f, i) => setTimeout(() => toast(f), i * 400));
  }
  knownIds = new Set([...(knownIds ?? []), ...ids]);
  if (switched) {
    // 目線が切り替わった：そのアクターの既定フォルダーへ（プレビューは閉じる）
    els.search.value = "";
    const fid = defaultFolderId();
    for (const a of ancestors(fid)) expanded.add(a.id);
    return setParams({ folder: fid, view: null, q: "", file: null }, false);
  }
  render();
});

// ---------- ペイン幅のドラッグ変更（左ナビ・プレビューの詳細欄） ----------
import { addSplitter } from "/shared/resize.js";
addSplitter({ container: document.querySelector(".layout"), side: "left", cssVar: "--st-nav-w", def: 300, min: 200, max: 560, key: "st-nav" });
addSplitter({ container: document.querySelector(".pv-body"), side: "right", cssVar: "--st-info-w", def: 360, min: 260, max: 760, key: "st-info" });
