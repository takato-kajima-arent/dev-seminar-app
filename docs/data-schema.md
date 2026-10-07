# データ形式（全ワーカー共通の契約）

- すべて `data/<section>.json` に置く。サーバーは起動時にメモリへ読み込み、`GET /api/state?only=<section>` で返す。
- 日時は ISO 8601（`+09:00` 付き）、日付は `YYYY-MM-DD`。
- 人物 ID（`u-*`）・会社 ID（`c-*`）・工区 ID（`area-*`）は **`data/site.json` に定義済みのものだけ** を使う。新しい ID を作らない。
- 「デモ上の今日」は `2026-11-11（水）`。「いま」は `2026-11-11T13:00+09:00`（`site.demoNow`）。**過去のデータ（メッセージ・メール・日報）は demoNow より前の日時にする**（カレンダー・工程表の予定は未来でもよい）。
- ファイル本体（画像・PDF・Excel・テキスト）は `files/` に置き、`storage.json` の `files[]` に登録する。メール添付・チャット添付もこの `fileId` で参照する。

## site.json（作成済み）
`today`, `demoNow`, `site{...}`, `areas[] {id,name,floors}`, `companies[] {id,name,shortName,role,trade,emailDomain}`, `people[] {id,name,kana,companyId,title,email,color,isProtagonist?,isBot?}`

## chat.json
```jsonc
{
  "rooms": [
    {
      "id": "room-all",               // room-* 形式
      "name": "全体連絡",
      "category": "全体",              // "全体" | "工区" | "テーマ" | "会社" | "社内"
      "areaId": null,                 // 工区ルームなら area-*
      "companyId": null,              // 会社ルームなら c-*
      "memberIds": ["u-sato", "..."],
      "description": "現場全体へのお知らせ"
    }
  ],
  "messages": [
    {
      "id": "m-0001",                 // m-連番（4桁）。sentAt 昇順で振る
      "roomId": "room-all",
      "senderId": "u-sato",
      "text": "本文（改行は \n）",
      "sentAt": "2026-11-10T08:12:00+09:00",
      "replyToId": null,              // 返信先メッセージ ID（任意）
      "mentionIds": [],               // @メンションした人物 ID（任意）
      "attachments": [                // 任意
        { "fileId": "f-patrol-1106-01", "kind": "image" }   // kind: "image" | "file"
      ],
      "reactions": [ { "emoji": "👍", "userIds": ["u-ito"] } ]  // 任意
    }
  ],
  "todos": [
    {
      "id": "t-001",
      "title": "6F EPS スリーブ位置の確認",
      "detail": "三光電設 井上さんから依頼（2工区ルーム 11/5）",
      "assigneeId": "u-sato",
      "requesterId": "u-inoue",
      "roomId": "room-area2",
      "sourceMessageId": "m-0123",
      "dueDate": "2026-11-12",
      "status": "open",               // "open" | "done"
      "createdById": "u-sato",
      "createdAt": "2026-11-05T10:00:00+09:00"
    }
  ]
}
```

## mail.json（佐藤さんの受信箱）
```jsonc
{
  "mailbox": { "ownerId": "u-sato", "address": "k.sato@toto-kensetsu.example" },
  "labels": [ { "id": "inbox", "name": "受信トレイ" }, { "id": "important", "name": "重要" }, { "id": "sent", "name": "送信済み" }, { "id": "lbl-site", "name": "現場" }, { "id": "lbl-nippo", "name": "日報" }, { "id": "lbl-honsha", "name": "本社" } ],
  "messages": [
    {
      "id": "mail-001",
      "threadId": "th-001",
      "from": { "name": "木村 聡（富士空調システム）", "email": "kimura@fuji-kucho.example", "personId": "u-kimura" },
      "to":   [ { "name": "佐藤 健一", "email": "k.sato@toto-kensetsu.example", "personId": "u-sato" } ],
      "cc":   [],
      "subject": "件名",
      "body": "本文（プレーンテキスト、改行は \n）",
      "receivedAt": "2026-11-10T16:20:00+09:00",
      "labelIds": ["inbox", "lbl-site"],
      "read": false,
      "starred": false,
      "attachments": [ { "fileId": "f-nippo-kucho-1110-xlsx" } ]   // ファイル名・サイズは storage.json 側
    }
  ]
}
```

## calendar.json
```jsonc
{
  "workingHours": { "start": "08:00", "end": "18:00" },
  "calendars": [ { "userId": "u-sato", "color": "#2f7d6d" }, { "userId": "u-nakamura", "color": "#c26a2e" }, { "userId": "u-kobayashi", "color": "#b5487a" } ],
  "events": [
    {
      "id": "ev-001",
      "title": "朝礼",
      "start": "2026-11-11T08:00:00+09:00",
      "end":   "2026-11-11T08:30:00+09:00",
      "allDay": false,
      "location": "1F 朝礼広場",
      "organizerId": "u-sato",
      "attendeeIds": ["u-sato", "u-nakamura", "u-kobayashi"],   // この人たちのカレンダーに表示される
      "description": ""
    }
  ]
}
```

## schedule.json（工程表）
```jsonc
{
  "project": { "name": "（仮称）港南三丁目オフィスビル新築工事", "start": "2025-10-01", "end": "2027-03-31", "viewStart": "2026-10-26", "viewEnd": "2026-12-13" },
  "tasks": [
    {
      "id": "sch-001",
      "wbs": "2.3.1",
      "name": "6F 内装 LGS下地・ボード張り",
      "category": "内装",             // 躯体 / 外装 / 内装 / 電気 / 空調 / 衛生 / 昇降機 / 防災 / 外構 / 仮設 / 検査
      "areaId": "area-2",
      "floor": "6F",
      "companyId": "c-naiso",
      "baselineStart": "2026-11-02", "baselineEnd": "2026-11-13",   // 当初計画
      "start": "2026-11-02", "end": "2026-11-18",                   // 現在の予定（遅れていれば end が後ろ）
      "workers": 6,                    // 1日あたりの予定人数
      "outdoor": false,                // 屋外作業か（雨天影響あり）
      "canAdvance": false,             // 前倒し可能か（先行作業が終わっていて、人さえいれば着手できる）
      "progress": 55,                  // 0〜100（%）
      "status": "delayed",             // "done" | "in_progress" | "not_started" | "delayed"
      "dependsOn": ["sch-000"],
      "summary": false,                // true の行は WBS の集計行（companyId null・workers 0）。集計・絞り込みの対象外
      "note": "ボード欠品により遅れ"     // 任意。遅延理由はここに書かず、チャット側に書くこと（AI が突き合わせるため）。ここは空でもよい
    }
  ],
  "milestones": [ { "id": "ms-001", "name": "外部足場 解体開始", "date": "2026-11-20" } ]
}
```

## weather.json
```jsonc
{ "location": "東京都港区", "forecasts": [ { "date": "2026-11-12", "weather": "雨", "icon": "rain", "precipProb": 90, "precipMm": 18, "tempHigh": 14, "tempLow": 10, "note": "終日雨。午後は風もやや強い" } ] }
```
`icon`: `"sunny" | "cloudy" | "rain" | "partly_cloudy"`

## storage.json（ファイル置き場。全ファイルの台帳を兼ねる）
```jsonc
{
  "rootName": "港南三丁目現場 共有フォルダ",
  "folders": [ { "id": "fo-root", "name": "港南三丁目現場", "parentId": null }, { "id": "fo-teirei", "name": "02_定例会議", "parentId": "fo-root" } ],
  "files": [
    {
      "id": "f-teirei-1110-txt",
      "name": "2026-11-10_工程定例_文字起こし.txt",
      "folderId": "fo-teirei",        // null の場合はストレージ画面に出さない（メール添付・チャット添付専用）
      "path": "files/teirei/2026-11-10_工程定例_文字起こし.txt",   // リポジトリルートからの相対パス。実在すること
      "mime": "text/plain",
      "size": 8123,                   // バイト数（実ファイルに合わせる）
      "updatedAt": "2026-11-10T18:30:00+09:00",
      "updatedById": "u-ito",
      "description": ""
    }
  ]
}
```
プレビュー：画像は `<img src="/files/:id">`、PDF は `<iframe>`、テキストは fetch、xlsx は `GET /api/files/:id/table`（`{sheets:[{name, rows:[[...]]}]}`）。

## アクター（目線）の切替 ― 2026-10-06 追加
- `site.json` の `personas[]`：`{ id: "field"|"honsha"|"jimu", label, personId, summary, calendarUserIds[] }`、`defaultPersonaId`
  - field＝現場管理者 佐藤 健一（u-sato）／ honsha＝本社 加藤 恵子（u-kato）／ jimu＝事務 高橋 由紀（u-takahashi・作業所 事務担当）
- 現在のアクターはサーバー側のセッションに持つ。`GET /api/session` → `{ persona: {...persona, person}, personas }`、`POST /api/session {personaId}` で切替（version が進むので全画面が再描画される）
- `/api/state` の応答には常に `session: { personaId }` が入る。画面側は `currentActor(state)`（public/shared/api.js）で「自分」を得る
- **画面は "u-sato" を決め打ちしないこと**。「自分」＝ `currentActor(state).personId`

### 各アプリでの「自分」の扱い
| アプリ | 自分による違い |
| --- | --- |
| チャット | 自分がメンバーのルームだけ表示。自分の発言を右側に。タスクは自分の担当・依頼分 |
| メール | 自分の受信箱：`to`/`cc` に自分の personId を含むもの＝受信トレイ、`from.personId` が自分＝送信済み |
| カレンダー | 表示するカレンダー＝ `persona.calendarUserIds`（先頭が自分） |
| ストレージ・工程表 | 同じデータ。ヘッダーの利用者表示などが自分になる |

### mail.json の変更（複数人の受信箱）
- `mailbox` は廃止（残っていても無視）。メッセージは全員分を 1 つの `messages[]` に入れる
- 受信トレイ・送信済みは `to`/`cc`/`from` の personId から決まる。`labelIds` の `inbox`/`sent` は使わない（独自ラベル `lbl-*`・`important` だけ使う）
- 既読は `readBy: [personId...]`、スターは `starredBy: [personId...]`（旧 `read`/`starred` は佐藤さん分として移行）
