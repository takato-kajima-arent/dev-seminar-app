// calendar.json の検証：佐藤・中村・小林の3人が共通で空いている30分以上の枠を
// 11/9〜11/13 の勤務時間（08:00〜18:00）で列挙する。
// 期待値：2026-11-12 15:30〜16:00 と 2026-11-13 13:30〜14:00 の2枠だけ。
// 使い方: node scripts/check-calendar.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cal = JSON.parse(readFileSync(join(root, 'data/calendar.json'), 'utf8'));
const users = ['u-sato', 'u-nakamura', 'u-kobayashi'];
const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const [wsH, wsM] = cal.workingHours.start.split(':').map(Number);
const [weH, weM] = cal.workingHours.end.split(':').map(Number);
const MIN = 30;

const toMin = (iso) => { const t = iso.slice(11, 16).split(':').map(Number); return t[0] * 60 + t[1]; };
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const found = [];
for (const d of days) {
  const busy = new Array(24 * 60).fill(false);
  for (const e of cal.events) {
    if (!e.attendeeIds.some((u) => users.includes(u))) continue;
    if (e.allDay) { if (e.start === d) busy.fill(true); continue; }
    if (e.start.slice(0, 10) !== d) continue;
    for (let m = toMin(e.start); m < toMin(e.end); m++) busy[m] = true;
  }
  let s = null;
  const ws = wsH * 60 + wsM, we = weH * 60 + weM;
  for (let m = ws; m <= we; m++) {
    const free = m < we && !busy[m];
    if (free && s === null) s = m;
    if (!free && s !== null) {
      if (m - s >= MIN) found.push(`${d} ${fmt(s)}-${fmt(m)} (${m - s}分)`);
      s = null;
    }
  }
}
console.log('3人共通の空き（30分以上, 11/9〜11/13 勤務時間内）:');
found.forEach((f) => console.log('  ' + f));
const expected = ['2026-11-12 15:30-16:00 (30分)', '2026-11-13 13:30-14:00 (30分)'];
const ok = JSON.stringify(found) === JSON.stringify(expected);
console.log(ok ? 'OK: 期待どおり' : 'NG: 期待値と不一致 ' + JSON.stringify(expected));
process.exitCode = ok ? 0 : 1;
