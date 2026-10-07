// デモ用のアプリ切替レール（全画面の左端に縦に表示）。
// 各画面の <body> の先頭で <script src="/shared/nav.js"></script> を読み込むだけでよい。
// body に padding-left: var(--demo-rail-w) を入れるので、各画面は残りの幅で描画される。
// （旧仕様の上部バー用 --demo-nav-h は 0 にしてある）
(() => {
  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICONS = {
    home: "M12 3.2 2.5 11h2.7v9.3h5.3v-6h3v6h5.3V11h2.7L12 3.2Z",
    chat: "M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 6.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm5 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm5 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z",
    mail: "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.2 2v.3l7.8 5.4 7.8-5.4V7H4.2Zm15.6 2.7-7.8 5.4-7.8-5.4V17h15.6V9.7Z",
    calendar: "M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2ZM5 9v10h14V9H5Zm2 2h3v3H7v-3Zm5 0h3v3h-3v-3Z",
    storage: "M3 5a1 1 0 0 1 1-1h6l2 2.5h8a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Zm2 4v9h14V9H5Z",
    schedule: "M3 4h2v16H3V4Zm4 2h8v3H7V6Zm4 5h9v3h-9v-3Zm-3 5h7v3H8v-3Z",
  };
  const apps = [
    { path: "/chat", label: "チャット", icon: ICONS.chat },
    { path: "/mail", label: "メール", icon: ICONS.mail },
    { path: "/calendar", label: "カレンダー", icon: ICONS.calendar },
    { path: "/storage", label: "ストレージ", icon: ICONS.storage },
    { path: "/schedule", label: "工程表", icon: ICONS.schedule },
  ];
  const here = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/";

  const style = document.createElement("style");
  style.textContent = `
    :root { --demo-nav-h: 0px; --demo-rail-w: 76px; }
    body { padding-left: var(--demo-rail-w) !important; box-sizing: border-box; }
    #demo-rail { position: fixed; top: 0; left: 0; bottom: 0; width: var(--demo-rail-w); z-index: 1000;
      display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0;
      background: #1b1f24; color: #aeb6bf; box-sizing: border-box;
      font: 11px/1.2 "Yu Gothic UI", "Meiryo", system-ui, sans-serif; }
    #demo-rail a { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px;
      width: 64px; padding: 9px 0 8px; border-radius: 10px; color: inherit; text-decoration: none; letter-spacing: .02em;
      background: transparent; border: 0; margin: 0; box-sizing: border-box; }
    #demo-rail span { font-size: 11px; color: inherit; margin: 0; }
    #demo-rail a svg { width: 26px; height: 26px; fill: currentColor; }
    #demo-rail a:hover { background: #2b3138; color: #fff; }
    #demo-rail a.on { background: #343c45; color: #fff; font-weight: 700; }
    #demo-rail a.on::before { content: ""; position: absolute; left: -6px; top: 10px; bottom: 10px; width: 4px;
      border-radius: 0 4px 4px 0; background: #4da3ff; }
    #demo-rail .sep { width: 40px; height: 1px; background: #343c45; margin: 6px 0; }
    #demo-rail .sp { flex: 1; }
    #demo-rail .today { text-align: center; color: #7d8790; font-size: 10.5px; line-height: 1.4; }
    #demo-rail .today b { display: block; color: #d6dde4; font-size: 13px; }
    #demo-rail a.actor { gap: 3px; padding: 8px 0; margin-top: 6px; }
    #demo-rail a.actor .av { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 15px; font-weight: 700; }
    #demo-rail a.actor .lb { font-size: 10.5px; color: #d6dde4; font-weight: 700; }
    #demo-rail a.actor .nm { font-size: 10px; color: #8d98a3; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement("nav");
  bar.id = "demo-rail";
  bar.innerHTML =
    `<a href="/" class="${here === "/" ? "on" : ""}" title="トップへ戻る">${icon(ICONS.home)}<span>トップ</span></a>` +
    `<div class="sep"></div>` +
    apps.map((a) => `<a href="${a.path}" class="${here === a.path ? "on" : ""}" title="${a.label}">${icon(a.icon)}<span>${a.label}</span></a>`).join("") +
    `<div class="sp"></div><div class="today" id="demo-rail-today"></div>` +
    `<a href="/" class="actor" id="demo-rail-actor" title="目線（アカウント）はトップで切り替え"></a>`;
  const mount = () => document.body.prepend(bar);
  document.body ? mount() : document.addEventListener("DOMContentLoaded", mount);

  fetch("/api/state?only=site").then((r) => r.json()).then((s) => {
    const el = document.getElementById("demo-rail-today");
    const t = s.site?.today;
    if (el && t) {
      const d = new Date(`${t}T00:00:00+09:00`);
      el.innerHTML = `デモ日付<b>${d.getMonth() + 1}/${d.getDate()}(${"日月火水木金土"[d.getDay()]})</b>`;
    }
  }).catch(() => {});

  // 現在のアクター（目線）を表示。トップページでの切替を拾うため定期的に確認する
  let lastActor = "";
  const showActor = () => fetch("/api/session", { cache: "no-store" }).then((r) => r.json()).then(({ persona }) => {
    const el = document.getElementById("demo-rail-actor");
    if (!el || !persona?.person) return;
    const key = persona.id;
    if (key === lastActor) return;
    lastActor = key;
    const u = persona.person;
    el.innerHTML = `<span class="av" style="background:${u.color}">${u.name[0]}</span><span class="lb">${persona.label}</span><span class="nm">${u.name.split(" ")[0]}</span>`;
  }).catch(() => {});
  showActor();
  setInterval(showActor, 3000);
})();
