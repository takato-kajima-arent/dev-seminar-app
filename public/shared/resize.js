// ペイン幅をドラッグで変えるための共通ヘルパー（ES Module）。
// ペインの幅は CSS 変数で決まっている前提。ドラッグでその変数を書き換え、localStorage に覚える。
// ダブルクリックで既定幅に戻す。
//
//   addSplitter({
//     container,          // ハンドルを置く要素（position:relative にする）。幅の計算もこの矩形を基準にする
//     side: "left",       // "left" = container の左端から伸びるペイン / "right" = 右端から伸びるペイン
//     cssVar: "--x-w",    // ペイン幅を表す CSS 変数
//     varEl,              // 変数をセットする要素（既定: document.documentElement）
//     pane,               // 任意。この要素が非表示（幅0）のときはハンドルも隠す
//     top,                // 任意。ハンドルの上端（例: "var(--top-h)"）
//     def,                // 既定幅(px)。CSS 側の既定値と合わせる
//     pos,                // 任意。ハンドル位置の CSS 式（既定: var(cssVar, def px)）
//     min, max, key,      // 最小・最大幅(px)、localStorage のキー
//     onChange,           // 任意。幅が変わったときに呼ぶ
//   });

const STYLE_ID = "demo-splitter-style";
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    .demo-splitter { position: absolute; bottom: 0; width: 10px; z-index: 40; cursor: col-resize; touch-action: none; }
    .demo-splitter.l { transform: translateX(-50%); }
    .demo-splitter.r { transform: translateX(50%); }
    .demo-splitter::after { content: ""; position: absolute; top: 0; bottom: 0; left: 4px; width: 2px; background: transparent; transition: background .15s; }
    .demo-splitter:hover::after, .demo-splitter.drag::after { background: #4da3ff; }
    body.demo-resizing, body.demo-resizing * { cursor: col-resize !important; user-select: none !important; }
  `;
  document.head.appendChild(s);
}

const load = (key) => {
  try { return Number(localStorage.getItem(`split:${key}`)) || null; } catch { return null; }
};
const save = (key, v) => {
  try { v == null ? localStorage.removeItem(`split:${key}`) : localStorage.setItem(`split:${key}`, String(v)); } catch {}
};

export function addSplitter({ container, side = "left", cssVar, varEl = document.documentElement, pane, top = "0px", def, pos, min = 160, max = 900, key, onChange }) {
  if (!container) return;
  ensureStyle();
  if (getComputedStyle(container).position === "static") container.style.position = "relative";

  const h = document.createElement("div");
  h.className = `demo-splitter ${side === "left" ? "l" : "r"}`;
  h.title = "ドラッグで幅を変更（ダブルクリックで元に戻す）";
  h.style.top = top;
  h.style[side] = pos ?? (def != null ? `var(${cssVar}, ${def}px)` : `var(${cssVar})`);
  container.appendChild(h);

  let raf = 0;
  const set = (w) => {
    if (w == null) varEl.style.removeProperty(cssVar);
    else varEl.style.setProperty(cssVar, `${Math.round(w)}px`);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => onChange?.());
  };

  const saved = key && load(key);
  if (saved) set(Math.min(max, Math.max(min, saved)));

  h.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    h.classList.add("drag");
    document.body.classList.add("demo-resizing");
    const move = (ev) => {
      const r = container.getBoundingClientRect();
      const w = side === "left" ? ev.clientX - r.left : r.right - ev.clientX;
      const v = Math.min(max, Math.max(min, w));
      set(v);
      if (key) save(key, Math.round(v));
    };
    const up = () => {
      h.classList.remove("drag");
      document.body.classList.remove("demo-resizing");
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      h.removeEventListener("pointercancel", up);
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  });
  h.addEventListener("dblclick", () => {
    set(null);
    if (key) save(key, null);
  });

  if (pane) {
    const sync = () => { h.hidden = pane.offsetWidth === 0; };
    new ResizeObserver(sync).observe(pane);
    sync();
  }
  return h;
}
