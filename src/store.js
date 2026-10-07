// モックデータのインメモリストア。
// 起動時に data/*.json を読み込み、書き込みはメモリ上だけに反映する（再起動・reset で初期状態に戻る）。
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = join(ROOT, "data");
export const FILES_DIR = join(ROOT, "files");

export const SECTIONS = ["site", "chat", "mail", "calendar", "schedule", "weather", "storage"];

let state = {};
let version = 0;
// 閲覧中のアクター（目線）。データの reset では変えない
let session = { personaId: null };

function loadSection(name) {
  const p = join(DATA_DIR, `${name}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`[store] ${name}.json の読み込みに失敗:`, e.message);
    return null;
  }
}

export function reset() {
  state = Object.fromEntries(SECTIONS.map((s) => [s, loadSection(s)]));
  if (!session.personaId) session.personaId = state.site?.defaultPersonaId ?? state.site?.personas?.[0]?.id ?? null;
  version++;
}

/** 現在のアクター（personas の 1 件 + person）を返す */
export function getPersona() {
  const p = state.site?.personas?.find((x) => x.id === session.personaId);
  if (!p) return null;
  return { ...p, person: state.site.people.find((u) => u.id === p.personId) ?? null };
}

export function setPersona(personaId) {
  if (!state.site?.personas?.some((x) => x.id === personaId)) return false;
  session.personaId = personaId;
  version++;
  return true;
}

export function getState(only) {
  if (!only) return { version, session: { ...session }, ...state };
  const picked = { version, session: { ...session }, site: state.site };
  for (const s of only) if (SECTIONS.includes(s)) picked[s] = state[s];
  return picked;
}

/** 書き込み用。mutator(state) で state を直接変更し、version を進める。 */
export function mutate(mutator) {
  const result = mutator(state);
  version++;
  return result;
}

export function getVersion() {
  return version;
}

/** storage.json の files から fileId でファイル情報を引く（メール添付・チャット添付も共通） */
export function findFile(fileId) {
  return state.storage?.files?.find((f) => f.id === fileId) ?? null;
}

reset();
