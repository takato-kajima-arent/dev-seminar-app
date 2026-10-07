// 全画面共通のデータ取得ヘルパー（ES Module）
// 使い方:
//   import { watchState, lookup, fmt } from "/shared/api.js";
//   watchState(["chat"], (state) => render(state));   // 初回 + 変更があるたびに呼ばれる

const POLL_MS = 2500;

export async function fetchState(only) {
  const q = only?.length ? `?only=${only.join(",")}` : "";
  const res = await fetch(`/api/state${q}`, { cache: "no-store" });
  return res.json();
}

/** 初回取得し、以降は version が変わったときだけ再取得して onChange(state, {initial}) を呼ぶ */
export function watchState(only, onChange) {
  let current = -1;
  const tick = async () => {
    try {
      const { version } = await (await fetch("/api/version", { cache: "no-store" })).json();
      if (version !== current) {
        const state = await fetchState(only);
        const initial = current === -1;
        current = state.version;
        onChange(state, { initial });
      }
    } catch (e) {
      console.warn("poll failed", e);
    }
  };
  tick();
  setInterval(tick, POLL_MS);
}

/**
 * 現在のアクター（目線）。トップページで切り替えると state.session.personaId が変わり、
 * watchState の onChange が再度呼ばれる（version が進むため）。
 * 戻り値: { personaId, label, personId, person, calendarUserIds, summary }
 */
export function currentActor(state) {
  const site = state?.site;
  const id = state?.session?.personaId ?? site?.defaultPersonaId;
  const p = site?.personas?.find((x) => x.id === id) ?? site?.personas?.[0];
  if (!p) return { personaId: null, label: "", personId: "u-sato", person: site?.people?.find((u) => u.id === "u-sato"), calendarUserIds: [] };
  return { personaId: p.id, label: p.label, personId: p.personId, person: site.people.find((u) => u.id === p.personId), calendarUserIds: p.calendarUserIds ?? [], summary: p.summary };
}

/** site.json から人物・会社を引くためのルックアップ */
export function lookup(site) {
  const people = new Map((site?.people ?? []).map((p) => [p.id, p]));
  const companies = new Map((site?.companies ?? []).map((c) => [c.id, c]));
  return {
    person: (id) => people.get(id),
    company: (id) => companies.get(id),
    personName: (id) => people.get(id)?.name ?? id,
    companyOf: (personId) => companies.get(people.get(personId)?.companyId),
    people: [...people.values()],
    companies: [...companies.values()],
  };
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];
export const fmt = {
  date: (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
  },
  time: (iso) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
  dateTime: (iso) => `${fmt.date(iso)} ${fmt.time(iso)}`,
  ymd: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  weekday: (iso) => WD[new Date(iso).getDay()],
  size: (n) => (n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`),
};

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** ファイルの URL（表示用 / ダウンロード用） */
export const fileUrl = (fileId, download = false) => `/files/${encodeURIComponent(fileId)}${download ? "?download=1" : ""}`;
