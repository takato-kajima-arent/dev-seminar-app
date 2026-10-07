# AI秘書デモ モック環境

戸田建設 利友会セミナー（2026/11/11）で使う、AI秘書デモ用のモック環境です。架空の現場「（仮称）港南三丁目オフィスビル新築工事」のチャット・メール・カレンダー・ストレージ・工程表を、ハリボテの画面とJSONデータで再現しています。

- ストーリー：`docs/scenario.md`（ストーリー1〜10用の仕込みデータの正本）
- データ形式：`docs/data-schema.md`

## 起動（ローカル）

```bash
npm install
npm start          # http://localhost:3000
```

| URL | 内容 |
| --- | --- |
| `/` | アプリ一覧と、データを初期状態に戻すボタン |
| `/chat` | 現場チャット（Direct風） |
| `/mail` | メール（佐藤さんの受信箱） |
| `/calendar` | カレンダー（佐藤・中村・小林） |
| `/storage` | ファイル共有 |
| `/schedule` | 工程表 |

## 仕組み

- `data/*.json` を起動時にメモリへ読み込みます。DBは使いません。
- 書き込み（今後実装するMCPツールから行う）はメモリ上にだけ反映されます。再起動するか `POST /admin/reset` を呼ぶと、初期状態に戻ります。
- 画面は `/api/version` を2.5秒ごとに確認し、変化があったときだけ再描画します。
- ファイル本体は `files/` に置き、台帳は `data/storage.json` です。生成し直すときは `npm run gen:files` を実行します（ローカルのChromeとpuppeteer-coreを使います）。

## Replit

GitHubからインポートすると、`.replit` の設定で `npm start` が実行されます。サーバーは `PORT` 環境変数で指定されたポートを使い、`0.0.0.0` で待ち受けます。

## AI秘書との接続（MCP）

`POST /mcp` に MCP サーバー（Streamable HTTP、ステートレス）があります。実装は `src/mcp.js` です。

- AI は、トップページで選ばれているアクター（現場管理者・本社・事務）の秘書として動きます。
- 書き込みはメモリ上にだけ反映され、各画面に数秒で表示されます。投稿・ToDo・予定・ファイルの作成者は「AI秘書」（`u-ai`）になります。
- 元に戻すときは、トップページの「デモデータを初期状態に戻す」を押します。

| 種類 | ツール |
| --- | --- |
| 前提 | `get_context`（今日・自分・現場・人物） |
| チャット | `list_chat_rooms` / `get_chat_messages` / `post_chat_message` / `add_todo` |
| メール | `search_mail` / `read_mail` |
| カレンダー | `get_calendar_events` / `find_free_slots` / `create_calendar_event` |
| ファイル | `list_files` / `read_file`（テキスト・Excel・PDF をテキストで、画像は画像で返す） / `create_excel` |
| 工程・天気 | `get_schedule` / `get_weather` |

### 動作確認

```bash
npm start
npm run test:mcp            # 全ツールを呼んで確認し、最後に初期状態へ戻す
# MCP Inspector で手動確認する場合: npx @modelcontextprotocol/inspector → http://localhost:3000/mcp
```

### ローカルから AI につなぐ（トンネル）

Grok などの AI は自社のサーバーから接続してくるため、`localhost` には届きません。トンネルで公開 URL を出して使います。

```bash
cloudflared tunnel --url http://localhost:3000
```

表示された `https://xxxx.trycloudflare.com` の末尾に `/mcp` を付けて、コネクタに登録します。

- この URL は、トンネルを起動するたびに変わります。
- URL を知っている人なら誰でもアクセスできるので、試し終わったらトンネルを閉じてください。
- 本番では Replit にデプロイし、`https://<アプリ名>.replit.app/mcp` を登録します。
