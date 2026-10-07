// data/chat.json を生成するスクリプト
//   node scripts/build-chat.mjs
// 内容（ルーム・メッセージ・ToDo）はこのファイルで定義する。docs/scenario.md の仕込みを反映。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(root, 'data/site.json'), 'utf8'));

// ---------------------------------------------------------------- 人・会社
const GC = ['u-sato', 'u-yamamoto', 'u-nakamura', 'u-kobayashi', 'u-ito', 'u-kato', 'u-saito'];
const BOT = 'u-ai';
const JIMU = 'u-takahashi'; // 作業所 事務（高橋）。本社 加藤は GC に含まれる
const SUB_COMPANIES = site.companies.filter((c) => c.role === '協力会社');
const personOf = (companyId) => site.people.find((p) => p.companyId === companyId).id;
const SUBS = SUB_COMPANIES.map((c) => personOf(c.id)); // 職長・担当（各社1名）
const P = {
  tekkin: 'u-okada', katawaku: 'u-ishii', tobi: 'u-matsumoto', denki: 'u-inoue', kucho: 'u-kimura',
  eisei: 'u-hayashi', naiso: 'u-shimizu', tosou: 'u-yamaguchi', bousui: 'u-mori', sash: 'u-ikeda',
  ev: 'u-abe', gaiko: 'u-yamashita', floor: 'u-nakajima', shobo: 'u-maeda', crane: 'u-fujita', concrete: 'u-goto',
};

// ---------------------------------------------------------------- ルーム
const rooms = [
  { id: 'room-all', name: '全体連絡', category: '全体', areaId: null, companyId: null,
    memberIds: [...GC, JIMU, ...SUBS, BOT], description: '現場全体へのお知らせ（朝礼・休工・全館停電など）' },
  { id: 'room-area1', name: '1工区（B1F〜4F）', category: '工区', areaId: 'area-1', companyId: null,
    memberIds: ['u-sato', 'u-kobayashi', 'u-nakamura', 'u-ito', P.eisei, P.naiso, P.tosou, P.denki, P.shobo, P.floor, JIMU, BOT],
    description: '1工区（B1F〜4F）の作業連絡・質疑' },
  { id: 'room-area2', name: '2工区（5F〜8F）', category: '工区', areaId: 'area-2', companyId: null,
    memberIds: ['u-sato', 'u-kobayashi', 'u-nakamura', P.naiso, P.denki, P.kucho, P.sash, P.tosou, JIMU, BOT],
    description: '2工区（5F〜8F）の作業連絡・質疑' },
  { id: 'room-area3', name: '3工区（9F〜屋上）', category: '工区', areaId: 'area-3', companyId: null,
    memberIds: ['u-sato', 'u-nakamura', P.kucho, P.denki, P.bousui, P.ev, P.naiso, JIMU, BOT],
    description: '3工区（9F〜12F・屋上）の作業連絡・質疑' },
  { id: 'room-ext', name: '外構・外部', category: '工区', areaId: 'area-ext', companyId: null,
    memberIds: ['u-sato', 'u-ito', P.tobi, P.gaiko, P.tosou, P.crane, JIMU, BOT],
    description: '外部足場・外構工事の連絡' },
  { id: 'room-patrol', name: '安全パトロール', category: 'テーマ', areaId: null, companyId: null,
    memberIds: [...GC, ...SUBS, BOT], description: '安全パトロールの指摘と是正報告（是正は写真付きで返信）' },
  { id: 'room-delivery', name: '搬入調整', category: 'テーマ', areaId: null, companyId: null,
    memberIds: ['u-sato', 'u-ito', JIMU, ...SUBS, BOT], description: '資材搬入・揚重・ゲートの予約調整' },
  { id: 'room-headcount', name: '翌日作業・人員連絡', category: 'テーマ', areaId: null, companyId: null,
    memberIds: ['u-sato', 'u-ito', JIMU, ...SUBS, BOT], description: '翌日の作業内容と入場人数を各社から連絡' },
  { id: 'room-gc', name: '東都建設 作業所内', category: '社内', areaId: null, companyId: null,
    memberIds: [...GC, JIMU, BOT], description: '東都建設の社内連絡（元請メンバーのみ）' },
  { id: 'room-honsha', name: '本社工務部 ⇔ 港南作業所', category: '社内', areaId: null, companyId: null,
    memberIds: ['u-kato', 'u-yamamoto', 'u-sato', JIMU, 'u-saito', BOT], description: '本社（工務部・安全環境部）と港南作業所の連絡（出来高・月次報告・届出など）' },
  { id: 'room-jimu', name: '事務連絡（書類・提出物）', category: 'テーマ', areaId: null, companyId: null,
    memberIds: [JIMU, 'u-sato', 'u-ito', ...SUBS, BOT], description: '安全書類・作業員名簿・請求書・駐車場申請・日報提出などの事務連絡' },
  ...SUB_COMPANIES.map((c) => ({
    id: `room-co-${c.id.replace(/^c-/, '')}`, name: `「${c.shortName}」連絡`, category: '会社', areaId: null,
    companyId: c.id, memberIds: ['u-sato', personOf(c.id), BOT], description: `${c.shortName}との個別連絡`,
  })),
];

// ---------------------------------------------------------------- メッセージ定義
const raw = [];
const t = (s) => `2026-${s.slice(0, 5)}T${s.slice(6)}:00+09:00`; // 'MM-DD HH:MM'
/** M(label|null, 'MM-DD HH:MM', room, sender, text, {reply, mentions, att, react}) */
function M(label, when, room, sender, text, o = {}) {
  raw.push({ label, sentAt: t(when), roomId: room, senderId: sender, text, ...o });
}
const img = (id) => ({ fileId: id, kind: 'image' });
const fil = (id) => ({ fileId: id, kind: 'file' });
const thumbs = (...u) => [{ emoji: '👍', userIds: u }];

// ===== 10/28（水）
M(null, '10-28 07:42', 'room-all', 'u-ito', 'おはようございます。本日の朝礼は8:00から1F朝礼広場です。KYシートの記入をお願いします。', { react: thumbs('u-sato', 'u-matsumoto') });
M(null, '10-28 08:52', 'room-delivery', P.crane, '明日10/29 9:00〜 25tラフター 北側に据えます。富士空調さんの架台材揚重です。');
M(null, '10-28 09:05', 'room-delivery', 'u-ito', '了解です。北側搬入口、9時〜12時は立入禁止区画にします。');
M(null, '10-28 10:15', 'room-area2', P.naiso, '@小林 さん お疲れ様です。6F LGS下地、11/2から入ります。墨出しの確認お願いできますか。', { mentions: ['u-kobayashi'] });
M('kob-sumi', '10-28 10:40', 'room-area2', 'u-kobayashi', '了解です。10/30（金）の13時に6Fで墨確認しましょう。');
M(null, '10-28 13:30', 'room-gc', 'u-yamamoto', '今週末の10/31（土）は通常稼働、11/3（祝）は休工でいきます。');
M(null, '10-28 13:34', 'room-gc', 'u-sato', '了解です。');
M(null, '10-28 14:10', 'room-area3', P.ev, 'お疲れ様でございます。1号機 かご組立、本日完了いたしました。明日より機器の取付に入ります。');
M(null, '10-28 16:40', 'room-co-tekkin', P.tekkin, 'お疲れさまです。B1F の残材、明日10時に回収入ります。2tで1台です。');
M('tekkin-ok', '10-28 16:52', 'room-co-tekkin', 'u-sato', '了解です。西ゲートからでお願いします。');
M(null, '10-28 17:20', 'room-co-crane', P.crane, '明日のラフター、7:30に現着します。');
M(null, '10-28 17:25', 'room-co-crane', 'u-sato', 'よろしくお願いします。');

// ===== 10/29（木）
M(null, '10-29 07:45', 'room-all', 'u-ito', 'おはようございます。本日9時〜12時、北側搬入口でラフター作業あります。通行注意でお願いします。');
M(null, '10-29 07:50', 'room-area3', P.kucho, 'おはようございます。本日9時より屋上へ架台材の揚重を行います。北側搬入口付近に立入禁止区画を設けますので、ご協力をお願いいたします。');
M(null, '10-29 08:40', 'room-ext', P.crane, 'ラフター据付完了。9時から吊ります');
M(null, '10-29 10:05', 'room-area1', P.shobo, '@中村 さん 2F スプリンクラーヘッドの位置、天井割付と少し合わない所があります。確認お願いします。', { mentions: ['u-nakamura'] });
M(null, '10-29 10:20', 'room-area1', 'u-nakamura', '午後見に行きます。');
M(null, '10-29 11:20', 'room-gc', 'u-nakamura', '受変電の切替日程、電力会社と調整中です。決まったら共有します。');
M(null, '10-29 11:50', 'room-ext', P.crane, '揚重 完了です。片付けして13時に撤収します');
M(null, '10-29 13:10', 'room-co-katawaku', P.katawaku, 'お疲れ様です。型枠材の返却、明日10/30の午後にトラック1台入れさせてください。');
M(null, '10-29 13:22', 'room-co-katawaku', 'u-sato', '了解です。東ゲートでお願いします。');
M(null, '10-29 14:30', 'room-area1', 'u-nakamura', '前田さん、2F確認しました。設備図どおりで割付側を少し振ります。ヘッド位置はそのままでOKです。');
M(null, '10-29 14:35', 'room-area1', P.shobo, '了解です。ありがとうございます。');
M(null, '10-29 15:45', 'room-delivery', P.floor, 'お疲れ様です。11/2（月）9:00 山王インテリア 4F床材 2t 1台、西ゲートで搬入お願いします。');
M(null, '10-29 15:58', 'room-delivery', 'u-ito', '了解です、予約入れました。');
M(null, '10-29 16:10', 'room-co-denki', P.denki, 'お疲れっす。受変電の切替の段取り、中村さんと詰めてます。日程出たら教えてください');
M(null, '10-29 16:18', 'room-co-denki', 'u-sato', '了解。中村から連絡いくと思います。');
M(null, '10-29 17:10', 'room-co-gaiko', P.gaiko, '北側通路 11/4から掘削入ります');
M(null, '10-29 17:22', 'room-co-gaiko', 'u-sato', '了解です。埋設物の図面は先日渡したものでお願いします。');
M(null, '10-29 17:30', 'room-co-ev', P.ev, 'お世話になっております。1号機の仮使用につきまして、11/2以降で手続きを進めさせていただきます。');
M(null, '10-29 17:41', 'room-co-ev', 'u-sato', 'よろしくお願いします。');
M(null, '10-29 17:45', 'room-co-naiso', P.naiso, '5F天井ボード、北側から張り進めてます。来週いっぱいかかります。');

// ===== 10/30（金）
M(null, '10-30 07:40', 'room-all', 'u-ito', 'おはようございます。本日10時〜 本社安全パトロール（斎藤さん来場）です。通路・開口部の整理をお願いします。');
M(null, '10-30 08:10', 'room-co-eisei', P.eisei, 'お疲れ様です。衛生器具の承認図、本日提出します。');
M(null, '10-30 08:25', 'room-co-eisei', 'u-sato', 'ありがとうございます。中村に回します。');
M('p1030-a', '10-30 10:45', 'room-patrol', 'u-ito', '10/30 本社パトロール指摘：B1F 階段室 照明不足。三光電設さん、仮設照明の増設お願いします。', { mentions: [P.denki] });
M('p1030-b', '10-30 10:50', 'room-patrol', 'u-ito', '10/30 本社パトロール指摘：外部西面 養生ネットのたるみ。北斗鳶さん、張り直しお願いします。', { mentions: [P.tobi] });
M(null, '10-30 11:30', 'room-gc', 'u-saito', '本日はありがとうございました。指摘2件以外は良好でした。引き続きよろしくお願いします。');
M(null, '10-30 13:05', 'room-area2', 'u-kobayashi', '清水さん、6Fに来てます。墨確認お願いします。');
M(null, '10-30 13:08', 'room-area2', P.naiso, '今向かいます。');
M(null, '10-30 14:00', 'room-patrol', P.denki, 'B1F 階段室、仮設照明2灯増設しました', { reply: 'p1030-a' });
M(null, '10-30 14:30', 'room-gc', 'u-yamamoto', '伊藤くん、10月分の安全日誌、確認印もらえる？');
M(null, '10-30 14:55', 'room-gc', 'u-ito', '押印して所長の机に置きました。');
M(null, '10-30 15:20', 'room-patrol', P.tobi, '西面ネット 張り直し完了っす👍', { reply: 'p1030-b' });
M(null, '10-30 15:30', 'room-patrol', 'u-ito', 'お二人ともありがとうございます。確認しました。');
M(null, '10-30 15:40', 'room-co-katawaku', P.katawaku, 'トラック 東ゲートから出ました。ありがとうございました。');
M(null, '10-30 16:20', 'room-all', 'u-ito', '明日10/31は土曜稼働です。午後から雨予報なので、外部作業の会社は早めの片付けをお願いします。');
M(null, '10-30 16:30', 'room-co-sash', P.sash, '5Fガラス、11/12搬入予定。確定したら搬入調整に流します');
M(null, '10-30 16:35', 'room-co-sash', 'u-sato', '了解です');
M(null, '10-30 17:00', 'room-co-bousui', P.bousui, 'お疲れ様です。屋上防水の着工は11/16予定で材料手配を進めております。');
M(null, '10-30 17:05', 'room-co-floor', P.floor, 'お疲れ様です。4F床の長尺シート、品番最終確定版で発注かけました✨');

// ===== 10/31（土）
M(null, '10-31 07:45', 'room-all', 'u-ito', 'おはようございます。本日土曜稼働です。午後は雨予報、足場上の作業は風に注意してください。');
M(null, '10-31 10:30', 'room-area2', P.sash, '5F北面サッシ 取付完了。シーリング待ちです');
M(null, '10-31 10:42', 'room-area2', P.tosou, '了解です😊 2工区の外壁と一緒に12日から入ります！');
M(null, '10-31 11:10', 'room-co-tosou', P.tosou, 'お疲れ様です！共用廊下の色見本、来週作りますね🎨');
M(null, '10-31 14:00', 'room-gc', 'u-yamamoto', '11/3休工の連絡、全体に流しといて。');
M(null, '10-31 14:05', 'room-gc', 'u-ito', '了解です。');
M(null, '10-31 14:20', 'room-all', 'u-ito', '【休工連絡】11/3（火・祝）は作業休工です。15時からの工程定例のみ実施します（2F会議室）。ゲートは閉鎖します。急ぎの作業がある場合は事前に伊藤まで連絡ください。', { react: thumbs('u-shimizu', 'u-inoue', 'u-hayashi') });

// ===== 11/2（月）
M(null, '11-02 07:40', 'room-all', 'u-ito', 'おはようございます。本日の朝礼8:00です。今週は金曜（11/6）に安全パトロールがあります。');
M(null, '11-02 08:55', 'room-delivery', P.floor, '床材、到着しました。西ゲート前です');
M(null, '11-02 09:00', 'room-delivery', 'u-ito', '開けます。');
M(null, '11-02 09:30', 'room-area2', P.naiso, '6F LGS下地、本日から入りました。');
M(null, '11-02 10:40', 'room-co-kucho', P.kucho, 'お世話になっております。9Fのダクト材、11/4（水）午前の搬入で予定しております。');
M(null, '11-02 10:52', 'room-co-kucho', 'u-sato', '了解です。西ゲートで伊藤に予約入れてください。');
M(null, '11-02 11:00', 'room-gc', 'u-kobayashi', '佐藤さん、6F内装の中間検査、11/11（水）15時で入れておきました。');
M(null, '11-02 11:06', 'room-gc', 'u-sato', '了解、ありがとう。');
M(null, '11-02 11:30', 'room-delivery', P.kucho, '11/4（水）9:30 富士空調 9Fダクト材 4t 1台 西ゲートでお願いいたします。');
M(null, '11-02 11:41', 'room-delivery', 'u-ito', '了解です。');
M(null, '11-02 13:30', 'room-ext', P.tobi, '東面足場の盛替え、11/12〜13でやる予定で材料準備しときます');
M(null, '11-02 13:40', 'room-ext', 'u-ito', '了解です。盛替え範囲の図、あとで送ります。');
M(null, '11-02 14:15', 'room-area1', P.floor, '4F 長尺シート 搬入完了です。明日休工なので水曜から張ります！');
M(null, '11-02 15:00', 'room-co-naiso', P.naiso, '5F天井ボード、北側終わりました。残り南側です。');
M(null, '11-02 15:10', 'room-co-naiso', 'u-sato', 'お疲れ様です。了解です。');
M(null, '11-02 17:00', 'room-co-ev', P.ev, '1号機 仮使用の申請書類、本日提出いたしました。');

// ===== 11/3（祝）
M(null, '11-03 08:10', 'room-co-tobi', P.tobi, '休工日にすいません。東面ネットの点検だけ2名で入らせてもらえますか');
M(null, '11-03 08:30', 'room-co-tobi', 'u-sato', 'OKです。伊藤に鍵頼んでおきます。');

// ===== 11/4（水）
M(null, '11-04 07:40', 'room-all', 'u-ito', 'おはようございます。本日の朝礼8:00です。新栄外構さん、本日から北側通路の掘削に入ります。');
M(null, '11-04 08:30', 'room-ext', P.gaiko, '北側通路 掘削開始します');
M('R1', '11-04 09:15', 'room-area3', P.kucho, '@佐藤 さん お疲れ様です。屋上機器の搬入ルート図いただけますか。揚重計画の検討に使いたいと思います。', { mentions: ['u-sato'] });
M(null, '11-04 09:40', 'room-delivery', P.kucho, '9Fダクト材、搬入完了しました。');
M(null, '11-04 10:20', 'room-area1', P.eisei, '@中村 さん 2Fの衛生器具の品番、承認図と発注書で一部違うので確認お願いします。', { mentions: ['u-nakamura'] });
M('R1-reply', '11-04 11:45', 'room-area3', 'u-sato', '送りました、ご確認ください', { reply: 'R1', att: [fil('f-route-okujo-pdf')] });
M(null, '11-04 12:10', 'room-area3', P.kucho, 'ありがとうございます。確認いたします。', { reply: 'R1-reply' });
M(null, '11-04 13:00', 'room-area1', 'u-nakamura', '林さん、メーカー回答来ました。承認図どおりでOKです。発注書の方を直してもらいました。');
M(null, '11-04 13:05', 'room-area1', P.eisei, '了解です。ありがとうございます。');
M(null, '11-04 15:00', 'room-gc', 'u-ito', '11/6の安全パトロール、10:30〜で私が回ります。');
M(null, '11-04 15:02', 'room-gc', 'u-yamamoto', 'よろしく。');
M(null, '11-04 17:10', 'room-co-shobo', P.shobo, '3F 感知器の取付、24日の週からで良いですか');
M(null, '11-04 17:25', 'room-co-shobo', 'u-sato', 'OKです。天井ボードの進み具合は小林に確認してください。');

// ===== 11/5（木）
M(null, '11-05 07:40', 'room-all', 'u-ito', 'おはようございます。朝礼8:00です。本日は風が強めです。資材の飛散防止をお願いします。');
M('delay-6f', '11-05 08:50', 'room-area2', P.naiso, '6Fのボード、メーカー欠品で入荷が11/12にずれ込みます。それまでは下地のみ進めます');
M(null, '11-05 09:00', 'room-area2', 'u-kobayashi', '了解です。工程表の方は修正しておきます。');
M(null, '11-05 09:05', 'room-area2', 'u-sato', '了解。メーカーの回答書があれば送ってください。', { reply: 'delay-6f' });
M(null, '11-05 09:12', 'room-area2', P.naiso, '了解です。');
M('U1', '11-05 09:40', 'room-area2', P.denki, '@佐藤 さん、6F EPSの床開口とスリーブ位置、図面と現場で20mmほどズレてます。確認お願いできますか', { mentions: ['u-sato'] });
M(null, '11-05 11:00', 'room-co-floor', P.floor, '5Fのクロス品番、承認済みのもので発注かけて大丈夫でしょうか？');
M(null, '11-05 11:08', 'room-co-floor', 'u-sato', 'はい、それでお願いします。');
M(null, '11-05 11:10', 'room-co-floor', P.floor, 'ありがとうございます🙇‍♀️');
M(null, '11-05 13:20', 'room-area3', P.bousui, '屋上の下地、確認しました。勾配問題ありません。');
M(null, '11-05 14:30', 'room-gc', 'u-nakamura', '受変電の切替、11/15（日）で電力会社と確定しそうです。来週の定例で正式に周知します。');
M(null, '11-05 14:33', 'room-gc', 'u-yamamoto', '了解。');
M(null, '11-05 15:30', 'room-area1', 'u-kobayashi', '@清水 さん 3F会議室の天井高さ、設計から CH2600 に変更の指示が来ました。詳細は追って連絡します。', { mentions: [P.naiso] });
M(null, '11-05 15:38', 'room-area1', P.naiso, '了解です。');
M(null, '11-05 16:00', 'room-co-katawaku', P.katawaku, '返却分の数量確認書、メールで送りました。');
M(null, '11-05 16:12', 'room-co-katawaku', 'u-sato', '確認しました。ありがとうございます。');
M(null, '11-05 17:00', 'room-delivery', P.naiso, '6Fボード欠品分、入荷日が確定したらここで連絡します。');
M(null, '11-05 17:15', 'room-co-concrete', P.concrete, 'お世話になっております。11/13の南側駐輪場 土間打設の配合計画書、メールにてお送りいたしました。');
M(null, '11-05 17:30', 'room-co-concrete', 'u-sato', '受領しました。よろしくお願いします。');

// ===== 11/6（金） 安全パトロール
M(null, '11-06 07:40', 'room-all', 'u-ito', 'おはようございます。本日10:30から安全パトロールです。各社職長は持ち場にいてください。');
M(null, '11-06 09:30', 'room-area2', 'u-nakamura', '7F天井内、ダクトと電気ラックが干渉してます。三光さん、富士空調さん確認お願いします。', { mentions: [P.denki, P.kucho] });
M(null, '11-06 09:50', 'room-area2', P.denki, '見ました。ラック100下げで逃げます');
M(null, '11-06 10:02', 'room-area2', P.kucho, '承知しました。ダクトはそのままで進めます。');
M(null, '11-06 10:30', 'room-patrol', 'u-ito', '本日の安全パトロールの指摘事項を上げます。是正したら写真付きでこの投稿に返信してください。');
M('P1', '11-06 10:34', 'room-patrol', 'u-ito', '【指摘①】2F 東側　床開口部の養生不足　北斗鳶工業', { mentions: [P.tobi], att: [img('f-patrol-1106-01')] });
M('P2', '11-06 10:41', 'room-patrol', 'u-ito', '【指摘②】3F 廊下　消火器の前に資材を仮置き　東邦内装', { mentions: [P.naiso], att: [img('f-patrol-1106-02')] });
M('P3', '11-06 10:49', 'room-patrol', 'u-ito', '【指摘③】6F　脚立の天板に乗って作業　三光電設', { mentions: [P.denki], att: [img('f-patrol-1106-03')] });
M('P4', '11-06 10:56', 'room-patrol', 'u-ito', '【指摘④】外部 東面 5層目　足場の手すりが外れている　北斗鳶工業', { mentions: [P.tobi], att: [img('f-patrol-1106-04')] });
M('P5', '11-06 11:04', 'room-patrol', 'u-ito', '【指摘⑤】1F 電気室前　通路に仮設ケーブルが散乱　三光電設', { mentions: [P.denki], att: [img('f-patrol-1106-05')] });
M('P6', '11-06 11:12', 'room-patrol', 'u-ito', '【指摘⑥】屋上　ガスボンベの転倒防止なし　富士空調システム', { mentions: [P.kucho], att: [img('f-patrol-1106-06')] });
M('R2', '11-06 11:30', 'room-co-tosou', P.tosou, '佐藤さん お疲れ様です！共用廊下の塗装色見本、承認いただけますか🙏 見本は現場事務所の棚に置いてあります！');
M('C2', '11-06 13:05', 'room-patrol', P.naiso, '【是正②】是正しました。資材は3F倉庫へ移動済みです。', { reply: 'P2', att: [img('f-zesei-1106-02')] });
M(null, '11-06 13:40', 'room-delivery', P.concrete, '11/13（金）の打設、生コン車の台数と時間は改めてメールでご連絡いたします。');
M('C1', '11-06 14:20', 'room-patrol', P.tobi, '【是正①】是正しました', { reply: 'P1', att: [img('f-zesei-1106-01')] });
M('U2', '11-06 15:10', 'room-area1', P.naiso, '@佐藤 さん 3F会議室の天井高さ変更（CH2700→2600）の施工図、最新版いただけますか？', { mentions: ['u-sato'] });
M(null, '11-06 15:30', 'room-co-sash', P.sash, '5Fガラス 工場出荷 11/11です');
M(null, '11-06 16:00', 'room-gc', 'u-ito', 'パトロール指摘6件、安全パトロールのルームに上げました。');
M(null, '11-06 16:05', 'room-gc', 'u-yamamoto', '是正の確認、頼むね。');
M(null, '11-06 17:10', 'room-co-denki', P.denki, '幹線ケーブルのドラム、追加分発注しました。入る日決まったら言います');

// ===== 11/7（土）
M('R2-reply', '11-07 08:15', 'room-co-tosou', 'u-sato', '承認済みです。このまま進めてください', { reply: 'R2' });
M(null, '11-07 08:20', 'room-co-tosou', P.tosou, 'ありがとうございます😊 この色で上塗りの準備進めます！');
M('C3', '11-07 08:40', 'room-patrol', P.denki, '【是正③】朝礼で周知しました。脚立は可搬式作業台に切り替えてます', { reply: 'P3' });
M('R3', '11-07 09:10', 'room-area1', P.eisei, '@佐藤 さん お疲れ様です。2-3F給水管の耐圧試験、立会いの日時を決めたいです。来週前半でご都合いかがでしょうか。', { mentions: ['u-sato'] });
M('C5', '11-07 10:15', 'room-patrol', P.denki, '【是正⑤】是正しました。ケーブルは壁際に寄せて養生してます', { reply: 'P5', att: [img('f-zesei-1107-05')] });
M('R3-reply', '11-07 11:30', 'room-area1', 'u-sato', '11/10 14時でお願いします', { reply: 'R3' });
M(null, '11-07 11:40', 'room-area1', P.eisei, '了解です', { reply: 'R3-reply' });
M(null, '11-07 13:00', 'room-gc', 'u-kobayashi', '6F内装のボード欠品の件、工程表に反映しました（終わり11/18）。');
M(null, '11-07 13:10', 'room-gc', 'u-sato', 'ありがとう。');
M(null, '11-07 14:30', 'room-area2', P.tosou, '5F北面のサッシ廻り、シーリングの取り合い確認しました😊 外壁は12日から入ります！');

// ===== 11/9（月）
M(null, '11-09 07:45', 'room-all', 'u-ito', 'おはようございます。朝礼8:00です。明日11/10の15時から工程定例です（2F会議室）。');
M('U3', '11-09 08:05', 'room-gc', 'u-yamamoto', '@佐藤 さん、来週の施主検査（11/19）の段取り案、まとめておいてもらえる？', { mentions: ['u-sato'] });
M('R4', '11-09 09:30', 'room-area3', P.bousui, '@佐藤 さん お疲れ様です。屋上防水の着工前打合せ、日程いかがでしょう', { mentions: ['u-sato'] });
M('delay-ext', '11-09 10:20', 'room-ext', P.gaiko, '北側通路、掘削したら既設の排水管が図面と50cmズレてました。設計確認待ちで一旦止めます');
M('delay-ext-2', '11-09 10:35', 'room-ext', 'u-sato', '設計に確認します', { reply: 'delay-ext' });
M('R4-reply', '11-09 10:50', 'room-area3', 'u-sato', '11/13 10時で調整済みです', { reply: 'R4' });
M(null, '11-09 10:58', 'room-area3', P.bousui, 'ありがとうございます。承知しました。');
M(null, '11-09 11:00', 'room-patrol', P.tobi, '④は今週中にやります', { reply: 'P4' });
M(null, '11-09 11:30', 'room-co-shobo', P.shobo, '消防検査、2月中旬で日程の調整お願いします');
M(null, '11-09 13:15', 'room-co-shobo', 'u-sato', '2/16（火）で所轄と調整済みです。詳細は後日送ります。');
M(null, '11-09 13:20', 'room-co-shobo', P.shobo, '了解しました');
M(null, '11-09 13:30', 'room-area2', 'u-kobayashi', '6F下地の進捗確認しました。ボード入ればすぐ張れる状態ですね。');
M(null, '11-09 13:36', 'room-area2', P.naiso, 'はい、下地はほぼ終わってます。');
M(null, '11-09 14:00', 'room-co-kucho', P.kucho, 'お世話になっております。11/18の室外機揚重のクレーン、佐藤さん経由で大江戸クレーンさんに仮押さえいただいている件、引き続きよろしくお願いいたします。');
M(null, '11-09 14:12', 'room-co-kucho', 'u-sato', '了解です。確定はもう少し待ってください。');
M(null, '11-09 14:30', 'room-co-crane', P.crane, '11/18 25t 仮押さえ入れました');
M(null, '11-09 14:41', 'room-co-crane', 'u-sato', 'ありがとうございます。');
M(null, '11-09 15:20', 'room-delivery', P.bousui, 'お疲れ様です。11/16（月）8:30 日進防水 防水材 4tユニック1台、北側搬入口でお願いします。');
M(null, '11-09 15:31', 'room-delivery', 'u-ito', '了解です。');
M(null, '11-09 16:00', 'room-gc', 'u-ito', '森田設計に北側通路の排水管の件、図面送っておきました。');
M(null, '11-09 16:05', 'room-gc', 'u-yamamoto', '了解。回答来たら佐藤さんから山下さんに流してもらって。');
M(null, '11-09 17:10', 'room-co-tobi', P.tobi, '盛替え用の材料、11/11の夕方に入れます');
M(null, '11-09 17:18', 'room-co-tobi', 'u-sato', '了解です。');
M(null, '11-09 17:30', 'room-co-tekkin', P.tekkin, '10月分の請求書、郵送しました。');
M(null, '11-09 17:40', 'room-co-tekkin', 'u-sato', '了解です。届いたら確認します。');

// ===== 11/10（火）
M(null, '11-10 07:45', 'room-all', 'u-ito', 'おはようございます。朝礼8:00です。本日15時から工程定例、主要協力会社の方は2F会議室へお願いします。');
M(null, '11-10 08:40', 'room-area1', P.floor, '4F 長尺シート、張り終わりました！養生してあります✨');
M(null, '11-10 08:52', 'room-area1', 'u-kobayashi', 'ありがとうございます。午後確認します。');
M('dlv-naiso', '11-10 09:30', 'room-delivery', P.naiso, 'お疲れ様です。6Fボード欠品分、入荷確定しました。11/12（木）10:00に西ゲートから、10t平車1台で入れます。石膏ボードです。荷揚げは仮設EVでお願いしたいです。');
M(null, '11-10 09:41', 'room-delivery', 'u-ito', '了解です。西ゲートと仮設EV、10時〜押さえました。', { reply: 'dlv-naiso' });
M('delay-ext-3', '11-10 10:15', 'room-ext', 'u-sato', '森田設計から回答あり、ルート変更で進めてください', { reply: 'delay-ext' });
M('delay-ext-4', '11-10 10:25', 'room-ext', P.gaiko, '了解、11/13から再開します', { reply: 'delay-ext-3' });
M('U4', '11-10 11:30', 'room-ext', P.gaiko, '北側通路の仮囲い移設、日程決まりましたら連絡ください');
M(null, '11-10 13:00', 'room-co-concrete', P.concrete, '11/13の出荷時間につきましては、明日メールにてご連絡いたします。');
M(null, '11-10 13:55', 'room-area1', P.eisei, 'これから耐圧試験の準備入ります。');
M(null, '11-10 14:50', 'room-area1', P.eisei, '耐圧試験、完了しました。立会いありがとうございました。');
M(null, '11-10 16:20', 'room-delivery', P.ev, 'お世話になっております。11/14（土）9:00 ミツワ昇降機 EV部材 2t 1台、西ゲートでお願いいたします。');
M(null, '11-10 16:28', 'room-delivery', 'u-ito', '了解です。');
M(null, '11-10 16:30', 'room-gc', 'u-yamamoto', '定例おつかれ。議事録用に文字起こしをストレージに上げといて。');
M(null, '11-10 16:35', 'room-gc', 'u-ito', '18時半くらいに上げます。');
M(null, '11-10 16:45', 'room-delivery', P.floor, 'お疲れ様です！来週11/17（火）9:00 山王インテリア 6F用床材 2t 1台、西ゲートで予約お願いします🙇‍♀️');
M(null, '11-10 16:52', 'room-delivery', 'u-ito', '了解です。予約入れました。');

// ===== 11/11（水） 〜13:00
M(null, '11-11 07:30', 'room-all', 'u-ito', 'おはようございます。朝礼8:00です。本日は曇り、風は弱めです。');
M('dlv-sanko', '11-11 11:40', 'room-area2', P.denki, '明後日9時半くらいに4tユニックでケーブルドラム入れます。西からで');
M('T1', '11-11 08:20', 'room-gc', 'u-yamamoto', '@佐藤 さん 今日中に来週の残業申請まとめて加藤さんに送っといて', { mentions: ['u-sato'] });
M('decoy-kob', '11-11 08:45', 'room-gc', 'u-kobayashi', '@佐藤 さん 5F天井 完了検査のチェックリスト、11/13（金）までに目を通してもらえますか？', { mentions: ['u-sato'] });
M('decoy-ev', '11-11 09:50', 'room-co-ev', P.ev, 'お世話になっております。12/4のEV性能検査につきまして、立会いの方のお名前を11/27（金）までにご連絡いただけますでしょうか。');
M('dlv-sash', '11-11 10:20', 'room-delivery', P.sash, '明日13時 5Fガラス 4t1台 北側搬入口から入ります。よろしく');
M(null, '11-11 10:31', 'room-delivery', 'u-ito', '了解です。北側、13時〜押さえました。', { reply: 'dlv-sash' });
M('T2', '11-11 11:05', 'room-co-kucho', P.kucho, '佐藤さん お世話になっております。本日中にクレーン使用日（11/18）の確定回答をいただけますと助かります。大江戸クレーンさんへの本手配の締めが本日とのことです。', { mentions: ['u-sato'] });
M(null, '11-11 11:50', 'room-area2', P.tosou, '2工区北面のシーリング材、搬入済みです😊');
M('decoy-naka', '11-11 12:10', 'room-area3', 'u-nakamura', '@佐藤 さん 10Fダクトの施工図チェック、来週月曜（11/16）までに戻してもらえると助かります。', { mentions: ['u-sato'] });
M(null, '11-11 12:50', 'room-co-floor', P.floor, '4F床、小林さんに確認いただきました！ありがとうございます✨');

// ===== 追加の雑多なやりとり（揚重予約・質疑・お礼など）
M(null, '10-28 11:30', 'room-area1', P.tosou, 'おはようございます☀️ 2F共用廊下、明後日から下地入ります！');
M(null, '10-28 15:10', 'room-area3', P.denki, '10F 分電盤の据付、今週中に終わらせます');
M(null, '10-29 09:15', 'room-area2', P.denki, '7F 幹線、東側から入線始めてます。通路にドラム置くんで足元注意で');
M(null, '10-30 09:20', 'room-co-bousui', 'u-sato', '森さん、屋上防水の材料手配の状況、分かったら教えてください。');
M(null, '10-30 11:10', 'room-area3', 'u-nakamura', '9F ダクトの吊りボルト、ピッチ1800以下でお願いします。');
M(null, '10-30 11:25', 'room-area3', P.kucho, '承知いたしました。');
M(null, '11-02 08:20', 'room-area1', P.shobo, '2F SPヘッド、本日から取付入ります。');
M(null, '11-02 09:40', 'room-co-gaiko', P.gaiko, '掘削用のバックホウ 11/4 7:30に回送します');
M(null, '11-02 09:55', 'room-co-gaiko', 'u-sato', '了解です。北側から入れてください。');
M(null, '11-04 11:00', 'room-area2', 'u-kobayashi', '5F 天井ボード、北側の中間検査OKでした。東邦内装さんありがとうございました。');
M(null, '11-04 11:12', 'room-area2', P.naiso, 'ありがとうございます。');
M(null, '11-04 14:20', 'room-area3', P.ev, '1号機 据付、順調に進んでおります。今週中に完了の見込みです。');
M(null, '11-05 10:30', 'room-ext', P.tobi, '東面、強風なんで上の方の作業は午後からにします');
M(null, '11-05 10:41', 'room-ext', 'u-ito', '了解です。無理しないでください。');
M(null, '11-05 13:50', 'room-co-eisei', P.eisei, '3F 排水管の勾配、現場で確認しました。図面どおりで問題ありません。');
M(null, '11-05 14:02', 'room-co-eisei', 'u-sato', 'ありがとうございます。');
M(null, '11-06 08:30', 'room-ext', P.crane, '11月後半の25t、作業半径の図面いただければ機種確定します');
M(null, '11-06 08:45', 'room-ext', 'u-ito', '富士空調さんの揚重計画が出たら送ります。');
M(null, '11-06 12:30', 'room-area1', P.tosou, '2F共用廊下 中塗り（東側）終わりました😊 上塗りの色見本、承認待ちです！');
M(null, '11-07 09:30', 'room-area2', P.sash, '5F 東面 サッシ 調整完了');
M(null, '11-09 09:00', 'room-area1', 'u-kobayashi', '3F 事務室の天井、点検口の位置確認OKです。会議室だけは高さ変更があるので触らないでください。');
M(null, '11-09 09:08', 'room-area1', P.naiso, '了解です。会議室はそのままにしておきます。');
M(null, '11-09 10:10', 'room-area1', P.shobo, '3F 感知器の割付図、小林さんに提出しました。');
M(null, '11-10 09:00', 'room-co-denki', P.denki, '追加のケーブルドラム、今週後半に入る予定っす。日にち決まったらまた言います');
M(null, '11-10 09:10', 'room-co-denki', 'u-sato', '了解。搬入調整にも流しといてください。');
M(null, '11-10 11:00', 'room-area3', P.kucho, '屋上 室外機架台、本日据付開始いたしました。');
M(null, '11-10 13:30', 'room-co-bousui', P.bousui, '11/13の打合せ、防水仕様書と工程案を持参いたします。');
M(null, '11-10 13:42', 'room-co-bousui', 'u-sato', 'よろしくお願いします。');
M(null, '11-11 09:15', 'room-area1', P.floor, '4F 床の養生、明日まで残しておきます！');
M(null, '11-11 10:45', 'room-area3', P.ev, '2号機の据付、11/16（月）から入らせていただきます。');

// ---------------------------------------------------------------- #10 日報（チャット投稿分）
const nippo = [
  // [投稿日時, room, sender, 作業日, 本文]
  ['11-06 07:40', 'room-area2', P.denki, '11/5', '7F 幹線ケーブル入線（東側）\n6F EPS 墨出し・アンカー打ち\n人数：5名\n特記：なし'],
  ['11-06 07:52', 'room-area1', P.eisei, '11/5', '2F 給水管 配管\n3F 排水管 支持金物取付\n人数：3名\n特記事項：特になし'],
  ['11-07 07:40', 'room-area2', P.denki, '11/6', '7F 幹線ケーブル入線（西側）\n7F 天井内ラック 高さ調整（ダクト干渉）\n人数：5名\n特記：パトロール指摘③⑤対応中'],
  ['11-07 07:55', 'room-area1', P.eisei, '11/6', '3F 給水管 配管\n2F 衛生器具 搬入・仮置き\n人数：3名\n特記事項：特になし'],
  ['11-10 07:40', 'room-area2', P.denki, '11/9', '7F 幹線ケーブル入線\n6F EPS 支持金物 墨出し\n人数：5名\n特記：なし'],
  ['11-10 07:52', 'room-area1', P.eisei, '11/9', '2-3F 給水管 耐圧試験 準備（水張り）\n3F 排水管 配管\n人数：3名\n特記事項：本日（11/10）14時 耐圧試験（佐藤さん立会い）'],
  // ↓ 「今日届いた日報」本命（11/10作業分、11/11朝）
  ['11-11 07:40', 'room-area2', P.denki, '11/10', '7F 幹線ケーブル入線\n6F EPS 支持金物取付\n人数：5名\n特記：なし'],
  ['11-11 07:55', 'room-area1', P.eisei, '11/10', '2-3F 給水管 耐圧試験（立会い：佐藤さん）合格\n2-3F 給水管 保温材巻き\n人数：3名\n特記事項：特になし'],
];
for (const [when, room, sender, day, body] of nippo) {
  const head = sender === P.denki ? `【日報 ${day}】三光電設 井上` : `【日報 ${day}】青葉設備工業 林`;
  const label = day === '11/10' ? (sender === P.denki ? 'N-denki' : 'N-eisei') : null;
  M(label, when, room, sender, `${head}\n${body}`);
}

// ---------------------------------------------------------------- #7 翌日人員連絡（room-headcount）
// 書き方は人ごとに個性を出す
const hcStyle = {
  [P.naiso]: (w, n, job) => `${w} 東邦内装 ${n}名 8:00入場 ${job}`,
  [P.denki]: (w, n, job) => `${w} 三光 ${n}名 ${job}`,
  [P.kucho]: (w, n, job) => `お疲れ様です。${w}の富士空調システムは${n}名で入場いたします。作業：${job}`,
  [P.eisei]: (w, n, job) => `${w} 青葉設備 ${n}名 8:00入場 ${job}`,
  [P.tobi]: (w, n, job) => `${w} 北斗鳶 ${n}名 ${job} 👍`,
  [P.gaiko]: (w, n, job) => `${w} 新栄 ${n}名 ${job}`,
  [P.tosou]: (w, n, job) => `${w} 光陽塗装 ${n}名でお願いします🙏 ${job}`,
  [P.sash]: (w, n, job) => `${w} 明和サッシ ${n}名 ${job}`,
  [P.floor]: (w, n, job) => `${w}の山王インテリアは${n}名です。${job}`,
  [P.shobo]: (w, n, job) => `${w} 関東消防 ${n}名 ${job}`,
};
const hcPast = [
  // [投稿日 'MM-DD', 基準の時刻, 対象日の言い方, [[sender, 人数, 作業]...]]
  ['10-28', '16:30', '明日', [[P.naiso, 5, '5F 天井ボード'], [P.denki, 4, '7F 幹線'], [P.tobi, 4, '南面 足場盛替え'], [P.eisei, 3, '2F 給水'], [P.kucho, 3, '屋上 架台材 揚重・荷受け']]],
  ['10-29', '16:20', '明日', [[P.naiso, 5, '5F 天井ボード'], [P.denki, 4, '7F 幹線'], [P.tosou, 3, '2F 共用廊下 下地'], [P.eisei, 3, '2F 給水'], [P.shobo, 2, '2F SPヘッド']]],
  ['10-30', '16:00', '明日（10/31）', [[P.naiso, 4, '5F 天井ボード'], [P.denki, 4, '7F 幹線'], [P.sash, 2, '5F 北面サッシ取付'], [P.kucho, 3, '9F ダクト']]],
  ['10-31', '15:30', '月曜', [[P.naiso, 6, '6F LGS 開始'], [P.denki, 5, '7F 幹線・6F EPS'], [P.floor, 2, '4F 床材 荷受け'], [P.eisei, 3, '2F 給水'], [P.tobi, 4, '東面 足場']]],
  ['11-02', '16:20', '11/4（水）', [[P.kucho, 4, '9F ダクト'], [P.gaiko, 5, '北側通路 掘削'], [P.eisei, 3, '2-3F 給水'], [P.naiso, 6, '6F LGS'], [P.denki, 5, '7F 幹線'], [P.floor, 3, '4F 長尺シート']]],
  ['11-04', '16:30', '明日', [[P.naiso, 6, '6F LGS'], [P.denki, 5, '7F 幹線・6F EPS'], [P.eisei, 3, '2-3F 給水'], [P.gaiko, 5, '北側通路 掘削'], [P.tosou, 3, '2F 共用廊下 中塗り']]],
  ['11-05', '16:30', '明日', [[P.naiso, 6, '6F LGS下地'], [P.denki, 5, '7F 幹線'], [P.tobi, 4, '外部 東面'], [P.tosou, 3, '2F 共用廊下 中塗り'], [P.eisei, 3, '3F 給水'], [P.shobo, 2, '2F SP']]],
  ['11-06', '16:40', '明日（土）', [[P.naiso, 4, '6F LGS下地'], [P.denki, 4, '7F 幹線'], [P.gaiko, 4, '北側通路 掘削'], [P.tobi, 3, '外部 東面']]],
  ['11-07', '15:00', '月曜（11/9）', [[P.naiso, 6, '6F LGS下地'], [P.denki, 5, '7F 幹線'], [P.kucho, 4, '9F ダクト・屋上 架台 墨出し'], [P.eisei, 3, '2-3F 給水 耐圧準備'], [P.gaiko, 5, '北側通路 掘削'], [P.tobi, 4, '東面 足場'], [P.sash, 2, '5F サッシ']]],
  ['11-09', '16:30', '明日', [[P.naiso, 6, '6F LGS・5F 天井'], [P.denki, 5, '7F 幹線・6F EPS'], [P.kucho, 4, '屋上 室外機架台'], [P.eisei, 3, '2-3F 耐圧試験'], [P.tosou, 3, '2F 共用廊下 中塗り'], [P.tobi, 4, '東面 足場'], [P.sash, 2, '5F サッシ調整'], [P.floor, 2, '4F 長尺シート']]],
  ['11-10', '16:55', '明日', [[P.naiso, 6, '6F LGS・5F 天井'], [P.denki, 5, '7F 幹線'], [P.kucho, 4, '屋上 室外機架台'], [P.eisei, 3, '3F 保温'], [P.tosou, null, '明日は光陽塗装はお休みです🙏'], [P.tobi, 4, '盛替え材 荷受け・東面'], [P.sash, 2, '5F ガラス受入準備']]],
];
let k = 0;
for (const [day, base, w, list] of hcPast) {
  const [h, m] = base.split(':').map(Number);
  list.forEach(([sender, n, job], i) => {
    const mins = h * 60 + m + i * 7 + (i % 2) * 3;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    const react = (k++ % 3 === 0) ? thumbs('u-ito') : undefined;
    M(null, `${day} ${hh}:${mm}`, 'room-headcount', sender, n == null ? job : hcStyle[sender](w, n, job), react ? { react } : {});
  });
}
// 本命：11/11 09:30〜12:40 に「明日（11/12）」の人員（6社のみ。光陽塗装・明和サッシは連絡なし）
M('HC-naiso', '11-11 09:32', 'room-headcount', P.naiso, '明日 東邦内装 6名 8:00入場 6F内装（ボード搬入・張り）');
M('HC-denki', '11-11 09:48', 'room-headcount', P.denki, '明日 三光電設 5名 8:00入場 7F・6F 幹線');
M('HC-eisei', '11-11 10:05', 'room-headcount', P.eisei, '明日 青葉設備 3名 8:00入場 3F 給水管 保温');
M('HC-kucho', '11-11 10:30', 'room-headcount', P.kucho, 'お疲れ様です。明日11/12の富士空調システムは4名で入場いたします。作業：屋上 室外機架台据付');
M('HC-tobi', '11-11 11:20', 'room-headcount', P.tobi, '明日 北斗鳶 4名 8:00入場 東面 足場盛替え 👍');
M('HC-gaiko', '11-11 12:35', 'room-headcount', P.gaiko, '明日 新栄外構 5名 8:00入場 北側通路（再開準備・段取り）');

// ---------------------------------------------------------------- アクター別（本社 加藤・事務 高橋）の追加分
// 既存メッセージの ID（m-0001〜）は他の文書から参照されているので変えない。
// 追加分は別系列の ID にする：room-honsha → m-h001〜、room-jimu → m-j001〜、そのほかのルーム → m-x001〜
const LEGACY_COUNT = raw.length; // ここまでが既存分（m-#### の連番対象）
const KATO = 'u-kato';
/** N(label|null, 'MM-DD HH:MM', room, sender, text, opts) … 追加分。prefix はルームで決まる */
function N(label, when, room, sender, text, o = {}) {
  const prefix = room === 'room-honsha' ? 'h' : room === 'room-jimu' ? 'j' : 'x';
  raw.push({ label, sentAt: t(when), roomId: room, senderId: sender, text, prefix, ...o });
}

// ===== room-honsha（本社工務部 ⇔ 港南作業所）
N('h-open', '10-28 09:10', 'room-honsha', KATO, '港南作業所の皆さん、お疲れ様です。本社工務部の加藤です。本社とのやりとり用にこのルームを作りました。出来高・月次報告・本社への届出関係はこちらでお願いします。');
N(null, '10-28 09:25', 'room-honsha', 'u-yamamoto', 'ありがとうございます。よろしくお願いします。');
N(null, '10-28 09:40', 'room-honsha', JIMU, '作業所事務の高橋です。本社への提出物は私の方でも取りまとめ・確認いたします。よろしくお願いいたします。');
N(null, '10-28 09:52', 'room-honsha', 'u-sato', '佐藤です。よろしくお願いします。');
N(null, '10-30 09:15', 'room-honsha', 'u-saito', '安全環境部の斎藤です。本日10時から本社パトロールで伺います。よろしくお願いします。');
N(null, '10-30 09:20', 'room-honsha', 'u-yamamoto', 'お待ちしております。');
N('h-dekidaka', '10-30 17:20', 'room-honsha', KATO, '10月分の出来高報告、例月どおり11/11（水）17時締切です。今月から、査定根拠として各工種の進捗写真を1枚ずつ添付してください。詳細は10/28のメールのとおりです。');
N('h-dekidaka-2', '10-30 17:35', 'room-honsha', 'u-yamamoto', '了解です。佐藤さん中心でまとめます。高橋さん、協力会社の出来高確認書の回収と数量の集計をお願いします。', { mentions: [JIMU] });
N(null, '10-30 17:42', 'room-honsha', JIMU, '承知いたしました。各社の出来高確認書を集めて、11/9（月）までに集計表にまとめます。', { reply: 'h-dekidaka-2' });
N(null, '11-02 10:15', 'room-honsha', KATO, '10月の月次報告、港南（10/30 佐藤さん）・大井町とも受領しました。遅れている項目は 11/9 の工務部会で確認します。');
N(null, '11-02 10:30', 'room-honsha', JIMU, '承知いたしました。山本所長にお伝えいたします。');
N(null, '11-04 09:30', 'room-honsha', 'u-yamamoto', 'ありがとうございます。補足があれば佐藤からメールします。');
N(null, '11-04 10:05', 'room-honsha', KATO, 'よろしくお願いします。');
N(null, '11-04 14:00', 'room-honsha', 'u-saito', '10/30の本社パトロール、指摘2件とも当日中に是正済みと伺いました。報告書に反映しておきます。');
N(null, '11-04 14:12', 'room-honsha', 'u-yamamoto', 'ありがとうございました。引き続き徹底します。');
N('h-teiden', '11-05 15:00', 'room-honsha', 'u-yamamoto', '受変電設備の切替のため、11/15（日）8:00〜12:00 に全館停電となる見込みです（電力会社と最終調整中）。本社への届出が必要でしたら教えてください。');
N('h-teiden-2', '11-05 15:20', 'room-honsha', KATO, '停電を伴う作業は、工務部と安全環境部への事前届出が必要です。様式はポータルの『様式集』にあります。11/12（木）までに提出をお願いします。', { reply: 'h-teiden' });
N('h-teiden-req', '11-05 15:28', 'room-honsha', 'u-yamamoto', '高橋さん、届出の作成をお願いします。停電の範囲と時間は中村さんに確認してください。', { mentions: [JIMU] });
N(null, '11-05 15:35', 'room-honsha', JIMU, '承知いたしました。中村さんに確認のうえ作成いたします。', { reply: 'h-teiden-req' });
N('h-delay', '11-07 14:00', 'room-honsha', 'u-yamamoto', '【報告】2工区 6F 内装（東邦内装）のボードがメーカー欠品で、入荷が11/12にずれ込みました。それまでは下地を先行しています。6F 内装の終わりは 11/13 → 11/18 の見込みで、工程表に反映済みです。');
N('h-delay-q', '11-07 14:30', 'room-honsha', KATO, '報告ありがとうございます。11/19の施主検査には影響なさそうですか？', { reply: 'h-delay' });
N(null, '11-07 14:45', 'room-honsha', 'u-yamamoto', '6Fは11/18に終わる見込みなので、検査には間に合わせます。メーカーの回答書が届いたら共有します。', { reply: 'h-delay-q' });
N('h-kensa', '11-09 09:30', 'room-honsha', KATO, '@山本 さん 11/19（木）の施主検査、メールでお伝えしたとおり私も立ち会います。準備状況を来週前半に一度共有いただけますか。', { mentions: ['u-yamamoto'] });
N(null, '11-09 09:45', 'room-honsha', 'u-yamamoto', '承知しました。段取り案は今、佐藤さんにまとめてもらっています。まとまり次第こちらで共有します。', { reply: 'h-kensa' });
N('h-taikai', '11-09 10:00', 'room-honsha', 'u-saito', '年末安全大会（12/4）で、港南作業所に無災害の取り組みの事例発表（10分程度）をお願いできないでしょうか。');
N(null, '11-09 10:20', 'room-honsha', 'u-yamamoto', '承知しました。伊藤に準備させます。', { reply: 'h-taikai' });
N(null, '11-09 10:24', 'room-honsha', 'u-saito', 'ありがとうございます。出欠のご回答は、別途メールの方でお願いします。');
N(null, '11-09 11:35', 'room-honsha', KATO, '残業申請の様式変更、先ほどメールでご案内しました。来週分の申請から新様式でお願いします。新様式はポータルの「様式集」にあります。');
N(null, '11-09 11:50', 'room-honsha', JIMU, '承知いたしました。作業所内に周知いたします。');
N('h-shukei', '11-09 17:40', 'room-honsha', JIMU, '10月分 出来高の数量集計表と、協力会社各社の出来高確認書がそろいました。佐藤さんにお渡ししております。', { reply: 'h-dekidaka-2' });
N('h-junkai', '11-10 11:20', 'room-honsha', KATO, '11/13（金）9:00〜11:30 で港南の現場を巡回させてください。案内は不要です。事務所に寄ってから回ります。');
N(null, '11-10 11:35', 'room-honsha', 'u-yamamoto', '承知しました。当日は同行できませんが、事務所に高橋がおりますので声をかけてください。', { reply: 'h-junkai' });
N(null, '11-10 11:42', 'room-honsha', JIMU, '承知いたしました。ヘルメットと入場者カードをご用意しておきます。');
N(null, '11-11 08:50', 'room-honsha', JIMU, '11/15の全館停電の届出、下書きを中村さんに確認いただいています。明日中に提出いたします。', { reply: 'h-teiden-2' });
N(null, '11-11 09:05', 'room-honsha', KATO, 'ありがとうございます。様式の「影響範囲」の欄に、仮設照明と仮設EVの停止も書いておいてください。');
N(null, '11-11 09:10', 'room-honsha', JIMU, '承知いたしました。');
N('h-board', '11-11 10:30', 'room-honsha', KATO, '6Fのボード、予定どおり明日入荷で変わりないですか？');
N(null, '11-11 10:45', 'room-honsha', 'u-yamamoto', '明日10時に搬入予定で、変更ありません。', { reply: 'h-board' });

// ===== room-jimu（事務連絡）
N('j-open', '10-28 09:00', 'room-jimu', JIMU, '協力会社の皆様、お疲れ様です。作業所事務の高橋です。安全書類・作業員名簿・請求書などの書類や提出物の連絡は、こちらのルームでお願いいたします。');
N(null, '10-28 09:20', 'room-jimu', 'u-ito', 'よろしくお願いします。安全書類の関係もここで流します。');
N(null, '10-28 10:10', 'room-jimu', P.floor, 'よろしくお願いします🙇‍♀️');
N('j-parking', '10-29 10:00', 'room-jimu', JIMU, '【駐車場の利用申請】11月分の現場駐車場（南側）の利用申請を受け付けます。台数と車両ナンバーを、10/30（金）までにこちらでお知らせください。');
N(null, '10-29 10:40', 'room-jimu', P.denki, '三光 2台です。ナンバーはあとで写真送ります', { reply: 'j-parking' });
N(null, '10-29 11:15', 'room-jimu', P.kucho, 'お世話になっております。富士空調システムは1台でお願いいたします。品川 400 さ 12-34 です。', { reply: 'j-parking' });
N(null, '10-29 13:20', 'room-jimu', P.tobi, '北斗鳶 1台 👍', { reply: 'j-parking' });
N(null, '10-29 15:30', 'room-jimu', P.naiso, '東邦内装 2台お願いします。ナンバーはメールで送りました。', { reply: 'j-parking' });
N(null, '10-30 09:30', 'room-jimu', JIMU, '駐車場、11月分の割り当て表を事務所前に掲示いたしました。ご確認をお願いいたします。');
N('j-meibo', '11-02 09:10', 'room-jimu', 'u-ito', '11月から、新規入場の方は前日までに作業員名簿と新規入場者アンケートを高橋さんへ提出してください。');
N(null, '11-02 09:20', 'room-jimu', JIMU, '様式は事務所のカウンターと、共有フォルダの「04_安全書類」にございます。', { reply: 'j-meibo' });
N(null, '11-02 11:00', 'room-jimu', P.gaiko, '新栄 名簿 本日中に出します');
N(null, '11-02 16:30', 'room-jimu', JIMU, '新栄外構様、作業員名簿を受領いたしました。ありがとうございます。');
N(null, '11-04 07:50', 'room-jimu', P.tosou, '高橋さん おはようございます！新しく入る福田の名簿とアンケート、事務所に出しておきました😊');
N(null, '11-04 08:05', 'room-jimu', JIMU, '山口様、受領いたしました。新規入場者教育を受けてから作業に入っていただくよう、お願いいたします。');
N('j-nippo', '11-05 10:00', 'room-jimu', JIMU, '【日報提出のお願い】日報は翌朝9時までに、各工区ルームへの投稿かメールでご提出ください。様式は自由ですが、作業内容・人数・特記事項の記載をお願いいたします。');
N(null, '11-05 10:20', 'room-jimu', P.eisei, '了解です。工区ルームに上げます。', { reply: 'j-nippo' });
N(null, '11-05 10:40', 'room-jimu', P.kucho, '承知いたしました。弊社はExcelでメール送付いたします。', { reply: 'j-nippo' });
N('j-seikyu', '11-06 14:00', 'room-jimu', JIMU, '【請求書の締めについて】11月分の請求書は11/25（水）必着でお願いいたします。出来高確認書の写しを添付してください。');
N(null, '11-06 14:30', 'room-jimu', P.katawaku, '承知しました。郵送でも大丈夫でしょうか。', { reply: 'j-seikyu' });
N(null, '11-06 14:42', 'room-jimu', JIMU, '石井様、郵送でも問題ございません。25日必着でお願いいたします。');
N(null, '11-06 15:00', 'room-jimu', P.concrete, '承知いたしました。納品書の写しも同封いたします。', { reply: 'j-seikyu' });
N('j-kyoiku', '11-09 09:00', 'room-jimu', JIMU, '【新規入場者教育のご案内】11/12（木）13:00〜14:00、事務所2Fで新規入場者教育を行います（講師：伊藤）。受講される方は、前日（11/11）17時までに作業員名簿と健康診断書の写しをご提出ください。');
N(null, '11-09 09:10', 'room-jimu', 'u-ito', 'よろしくお願いします。保護具は各自持参でお願いします。', { reply: 'j-kyoiku' });
N('j-kyoiku-naiso', '11-09 13:40', 'room-jimu', P.naiso, '東邦内装から2名受講させてください。6Fボード張りの応援です。書類は明日出します。', { reply: 'j-kyoiku' });
N(null, '11-09 13:50', 'room-jimu', JIMU, '清水様、承知いたしました。');
N('j-kyoiku-denki', '11-09 15:10', 'room-jimu', P.denki, '三光も1名お願いします', { reply: 'j-kyoiku' });
N(null, '11-09 15:20', 'room-jimu', JIMU, '井上様、承知いたしました。書類のご提出をお願いいたします。');
N(null, '11-10 10:30', 'room-jimu', P.naiso, '新規2名分の名簿と健康診断書、事務所に提出しました。');
N(null, '11-10 10:45', 'room-jimu', JIMU, '清水様、受領いたしました。ありがとうございます。');
N(null, '11-10 14:00', 'room-jimu', JIMU, '【安全書類】資格証の写しの有効期限が10月末で切れている会社様には、個別にご連絡しております。お手数ですが、差し替えをお願いいたします。');
N(null, '11-10 16:00', 'room-jimu', P.ev, 'お世話になっております。ミツワ昇降機の作業員名簿の更新版を、本日メールにてお送りいたしました。');
N(null, '11-10 16:15', 'room-jimu', JIMU, '阿部様、受領いたしました。ありがとうございます。');
N('j-remind', '11-11 08:40', 'room-jimu', JIMU, '三光電設 井上様、明日の新規入場者教育を受講される方の書類を、本日17時までにご提出をお願いいたします。', { mentions: [P.denki] });
N(null, '11-11 09:20', 'room-jimu', P.denki, 'すいません、昼までに出します', { reply: 'j-remind' });
N(null, '11-11 11:30', 'room-jimu', P.denki, '名簿と健診の写し、事務所に置きました');
N(null, '11-11 11:40', 'room-jimu', JIMU, '井上様、受領いたしました。明日13時に事務所2Fへお越しください。');

// ===== 既存ルームへの追加（高橋・加藤）
N(null, '10-30 17:10', 'room-headcount', JIMU, '人員連絡ありがとうございます。月次の延べ人数の集計にも使わせていただきます。');
N('x-gc-teiden', '11-05 14:40', 'room-gc', KATO, '11/15の切替、決まったら本社への届出もお願いします。様式はポータルの様式集にあります。');
N(null, '11-05 14:46', 'room-gc', 'u-yamamoto', '了解です。', { reply: 'x-gc-teiden' });
N(null, '11-06 08:05', 'room-area2', JIMU, '井上様、日報ありがとうございます。');
N(null, '11-06 08:10', 'room-area1', JIMU, '林様、日報ありがとうございます。');
N('x-gc-delay', '11-07 13:20', 'room-gc', KATO, '工程表見ました。6F内装の遅れ、経緯を本社ルームの方に一度上げてもらえますか。');
N(null, '11-07 13:28', 'room-gc', 'u-yamamoto', '了解です。午後に上げます。', { reply: 'x-gc-delay' });
N(null, '11-09 09:05', 'room-all', JIMU, '【新規入場者教育】11/12（木）13:00〜14:00、事務所2Fで行います。受講される方の書類は前日17時までにご提出ください。詳細は「事務連絡」ルームをご覧ください。');
N(null, '11-09 09:30', 'room-gc', JIMU, '伊藤さん、11/12 13時からの新規入場者教育、事務所2Fを押さえました。', { mentions: ['u-ito'] });
N(null, '11-09 09:34', 'room-gc', 'u-ito', 'ありがとうございます。資料はこちらで用意します。');
N(null, '11-10 08:05', 'room-area2', JIMU, '井上様、日報ありがとうございます。');
N(null, '11-11 07:50', 'room-area2', JIMU, '井上様、日報ありがとうございます。');
N(null, '11-11 08:05', 'room-area1', JIMU, '林様、日報ありがとうございます。');
N(null, '11-11 08:20', 'room-area3', JIMU, '木村様、日報（Excel）をメールで受領いたしました。ありがとうございます。');
N(null, '11-11 09:00', 'room-gc', JIMU, '残業申請の新様式、印刷して佐藤さんの机に置いておきました。');

// ---------------------------------------------------------------- 並べ替え・ID付与
raw.forEach((r, i) => (r._i = i));
raw.sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : a._i - b._i));
const labelToId = {};
const seq = { legacy: 0, h: 0, j: 0, x: 0 };
raw.forEach((r) => {
  // 既存分は m-0001〜（時刻順の連番。追加分を足しても変わらない）、追加分は m-h001 / m-j001 / m-x001〜
  r.id = r.prefix ? `m-${r.prefix}${String(++seq[r.prefix]).padStart(3, '0')}` : `m-${String(++seq.legacy).padStart(4, '0')}`;
  if (r.label) {
    if (labelToId[r.label]) throw new Error(`duplicate label ${r.label}`);
    labelToId[r.label] = r.id;
  }
});
const ref = (l) => {
  if (!labelToId[l]) throw new Error(`unknown label ${l}`);
  return labelToId[l];
};
const messages = raw.map((r) => {
  const msg = {
    id: r.id, roomId: r.roomId, senderId: r.senderId, text: r.text, sentAt: r.sentAt,
    replyToId: r.reply ? ref(r.reply) : null, mentionIds: r.mentions || [],
  };
  if (r.att) msg.attachments = r.att;
  if (r.react) msg.reactions = r.react;
  return msg;
});

// ---------------------------------------------------------------- ToDo（既存分。U1〜U4 とは別）
const todos = [
  { id: 't-001', title: '港南鉄筋 B1F残材回収の立会い', detail: '港南鉄筋工業 岡田さんから連絡（10/28）。10/29 10時 西ゲート',
    assigneeId: 'u-sato', requesterId: P.tekkin, roomId: 'room-co-tekkin', sourceMessageId: ref('tekkin-ok'),
    dueDate: '2026-10-29', status: 'done', createdById: 'u-sato', createdAt: '2026-10-28T16:55:00+09:00' },
  { id: 't-002', title: '富士空調へ屋上機器の搬入ルート図を送付', detail: '富士空調 木村さんから依頼（3工区ルーム 11/4）',
    assigneeId: 'u-sato', requesterId: P.kucho, roomId: 'room-area3', sourceMessageId: ref('R1'),
    dueDate: '2026-11-04', status: 'done', createdById: 'u-sato', createdAt: '2026-11-04T09:30:00+09:00' },
  { id: 't-003', title: '6Fボード欠品のメーカー回答書を受け取る', detail: '東邦内装 清水さんに依頼済み（2工区ルーム 11/5）。工程遅れの根拠資料として保管',
    assigneeId: 'u-sato', requesterId: 'u-sato', roomId: 'room-area2', sourceMessageId: ref('delay-6f'),
    dueDate: '2026-11-12', status: 'open', createdById: 'u-sato', createdAt: '2026-11-05T09:06:00+09:00' },
  { id: 't-004', title: '消防検査（2/16）の日程を所轄と調整', detail: '関東消防設備 前田さんから依頼（11/9）',
    assigneeId: 'u-sato', requesterId: P.shobo, roomId: 'room-co-shobo', sourceMessageId: null,
    dueDate: '2026-11-10', status: 'done', createdById: 'u-sato', createdAt: '2026-11-09T11:35:00+09:00' },
  { id: 't-005', title: '屋上防水 着工前打合せの資料準備', detail: '日進防水 森さんと 11/13 10時に打合せ（3工区ルーム 11/9）',
    assigneeId: 'u-sato', requesterId: P.bousui, roomId: 'room-area3', sourceMessageId: ref('R4-reply'),
    dueDate: '2026-11-13', status: 'open', createdById: 'u-sato', createdAt: '2026-11-09T10:52:00+09:00' },
];
todos[3].sourceMessageId = messages.find((m) => m.roomId === 'room-co-shobo' && m.text.startsWith('消防検査')).id;

// ToDo（アクター別：事務 高橋・本社 加藤。担当／依頼の両方で各自の画面が空にならないようにする）
todos.push(
  { id: 't-006', title: '11/15 全館停電の本社届出を作成・提出', detail: '山本所長から依頼（本社工務部ルーム 11/5）。停電の範囲・時間は中村さんに確認。影響範囲に仮設照明・仮設EVの停止も記載（加藤さん 11/11）',
    assigneeId: JIMU, requesterId: 'u-yamamoto', roomId: 'room-honsha', sourceMessageId: ref('h-teiden-req'),
    dueDate: '2026-11-12', status: 'open', createdById: JIMU, createdAt: '2026-11-05T15:36:00+09:00' },
  { id: 't-007', title: '10月分 出来高の数量集計表・出来高確認書の取りまとめ', detail: '山本所長から依頼（本社工務部ルーム 10/30）。11/9 に佐藤さんへ引き渡し済み',
    assigneeId: JIMU, requesterId: 'u-yamamoto', roomId: 'room-honsha', sourceMessageId: ref('h-dekidaka-2'),
    dueDate: '2026-11-09', status: 'done', createdById: JIMU, createdAt: '2026-10-30T17:43:00+09:00' },
  { id: 't-008', title: '11/12 新規入場者教育の受講者書類チェック', detail: '東邦内装 2名・三光電設 1名（ほかにメール受付分：日進防水4・山王2・大江戸3、計12名）。作業員名簿と健康診断書の写し（締切 11/11 17時）。会場は事務所2F（講師：伊藤さん）',
    assigneeId: JIMU, requesterId: 'u-ito', roomId: 'room-jimu', sourceMessageId: ref('j-kyoiku'),
    dueDate: '2026-11-11', status: 'open', createdById: JIMU, createdAt: '2026-11-09T09:05:00+09:00' },
  { id: 't-009', title: '港南三丁目 10月分 出来高報告の受領・査定', detail: '締切 11/11（水）17:00。査定根拠として各工種の進捗写真を添付してもらう（本社工務部ルーム 10/30）',
    assigneeId: KATO, requesterId: KATO, roomId: 'room-honsha', sourceMessageId: ref('h-dekidaka'),
    dueDate: '2026-11-11', status: 'open', createdById: KATO, createdAt: '2026-10-30T17:25:00+09:00' },
  { id: 't-010', title: '港南三丁目 現場巡回（11/13 9:00〜11:30）', detail: '山本所長・佐藤さんは同行なし。事務所で高橋さんに声をかけてから回る',
    assigneeId: KATO, requesterId: KATO, roomId: 'room-honsha', sourceMessageId: ref('h-junkai'),
    dueDate: '2026-11-13', status: 'open', createdById: KATO, createdAt: '2026-11-10T11:25:00+09:00' },
  { id: 't-011', title: '11/19 施主検査の準備状況を本社に共有', detail: '加藤さんから依頼（本社工務部ルーム 11/9）。来週前半に共有',
    assigneeId: 'u-yamamoto', requesterId: KATO, roomId: 'room-honsha', sourceMessageId: ref('h-kensa'),
    dueDate: '2026-11-17', status: 'open', createdById: KATO, createdAt: '2026-11-09T09:32:00+09:00' },
);

writeFileSync(join(root, 'data/chat.json'), JSON.stringify({ rooms, messages, todos }, null, 2) + '\n', 'utf8');

// ---------------------------------------------------------------- 検証
const errs = [];
const people = new Set(site.people.map((p) => p.id));
const companies = new Set(site.companies.map((c) => c.id));
const areas = new Set(site.areas.map((a) => a.id));
const roomMap = new Map(rooms.map((r) => [r.id, r]));
const msgMap = new Map(messages.map((m) => [m.id, m]));
const demoNow = new Date(site.demoNow).getTime();
for (const r of rooms) {
  r.memberIds.forEach((u) => people.has(u) || errs.push(`room ${r.id} bad member ${u}`));
  if (r.companyId && !companies.has(r.companyId)) errs.push(`room ${r.id} bad company`);
  if (r.areaId && !areas.has(r.areaId)) errs.push(`room ${r.id} bad area`);
  if (new Set(r.memberIds).size !== r.memberIds.length) errs.push(`room ${r.id} dup members`);
}
let prev = 0;
for (const m of messages) {
  const room = roomMap.get(m.roomId);
  if (!room) errs.push(`${m.id} bad room ${m.roomId}`);
  else if (!room.memberIds.includes(m.senderId)) errs.push(`${m.id} sender ${m.senderId} not member of ${m.roomId}`);
  if (!people.has(m.senderId)) errs.push(`${m.id} bad sender`);
  m.mentionIds.forEach((u) => people.has(u) || errs.push(`${m.id} bad mention ${u}`));
  const ts = new Date(m.sentAt).getTime();
  if (ts < prev) errs.push(`${m.id} out of order`);
  prev = ts;
  if (ts > demoNow) errs.push(`${m.id} after demoNow`);
  if (ts < new Date('2026-10-28T00:00:00+09:00').getTime()) errs.push(`${m.id} before 10/28`);
  if (m.replyToId) {
    const p = msgMap.get(m.replyToId);
    if (!p) errs.push(`${m.id} reply target missing`);
    else if (p.roomId !== m.roomId || p.sentAt > m.sentAt) errs.push(`${m.id} reply target bad room/time`);
  }
  (m.reactions || []).forEach((rx) => rx.userIds.forEach((u) => people.has(u) || errs.push(`${m.id} bad reaction user`)));
}
for (const td of todos) {
  [td.assigneeId, td.requesterId, td.createdById].forEach((u) => people.has(u) || errs.push(`${td.id} bad person`));
  if (td.sourceMessageId && !msgMap.has(td.sourceMessageId)) errs.push(`${td.id} bad source`);
}
// 光陽塗装・明和サッシは 11/11 に明日の人数を書かない
for (const m of messages) {
  if ([P.tosou, P.sash].includes(m.senderId) && m.sentAt.startsWith('2026-11-11') && /\d+\s*名/.test(m.text)) errs.push(`${m.id} tosou/sash headcount on 11/11`);
}
// U1〜U4 のあとに佐藤さんが同じルームで返信していないか
for (const l of ['U1', 'U2', 'U3', 'U4']) {
  const u = msgMap.get(ref(l));
  const later = messages.filter((m) => m.senderId === 'u-sato' && m.sentAt > u.sentAt && (m.roomId === u.roomId || m.replyToId === u.id));
  if (later.some((m) => m.roomId === u.roomId && ['room-ext', 'room-gc'].includes(m.roomId))) errs.push(`${l}: 佐藤 posts later in ${u.roomId}: ${later.map((x) => x.id)}`);
  if (later.some((m) => m.replyToId === u.id)) errs.push(`${l}: replied`);
}

// ID：既存分は m-0001〜m-<LEGACY_COUNT> の連番のまま、追加分は m-h### / m-j### / m-x###
const idRe = /^m-(\d{4}|[hjx]\d{3})$/;
if (new Set(messages.map((m) => m.id)).size !== messages.length) errs.push('duplicate message ids');
messages.forEach((m) => idRe.test(m.id) || errs.push(`${m.id} bad id format`));
const legacy = messages.filter((m) => /^m-\d{4}$/.test(m.id));
if (legacy.length !== LEGACY_COUNT || legacy.length !== 297) errs.push(`legacy message count changed: ${legacy.length} (expected 297)`);
legacy.forEach((m, i) => m.id === `m-${String(i + 1).padStart(4, '0')}` || errs.push(`${m.id} legacy id not sequential`));
messages.filter((m) => /^m-h/.test(m.id)).forEach((m) => m.roomId === 'room-honsha' || errs.push(`${m.id} h-id outside room-honsha`));
messages.filter((m) => /^m-j/.test(m.id)).forEach((m) => m.roomId === 'room-jimu' || errs.push(`${m.id} j-id outside room-jimu`));
// アクター別：ルームとメンバー
const mustMember = {
  'u-kato': ['room-all', 'room-gc', 'room-honsha'],
  'u-takahashi': ['room-all', 'room-gc', 'room-honsha', 'room-headcount', 'room-delivery', 'room-area1', 'room-area2', 'room-area3', 'room-ext', 'room-jimu'],
};
for (const [u, list] of Object.entries(mustMember)) {
  list.forEach((rid) => roomMap.get(rid)?.memberIds.includes(u) || errs.push(`${u} not member of ${rid}`));
}
const honsha = roomMap.get('room-honsha');
if (!honsha || ['u-kato', 'u-yamamoto', 'u-sato', 'u-takahashi', 'u-saito'].some((u) => !honsha.memberIds.includes(u))) errs.push('room-honsha members');
const jimu = roomMap.get('room-jimu');
if (!jimu || ['u-takahashi', 'u-sato', 'u-ito', ...SUBS].some((u) => !jimu.memberIds.includes(u))) errs.push('room-jimu members');
for (const rid of ['room-honsha', 'room-jimu']) {
  const n = messages.filter((m) => m.roomId === rid).length;
  if (n < 25 || n > 40) errs.push(`${rid} has ${n} messages (want 25-40)`);
}
for (const u of ['u-kato', 'u-takahashi']) {
  if (todos.filter((td) => td.assigneeId === u || td.requesterId === u).length < 2) errs.push(`${u} has fewer than 2 todos`);
}
// #7 高橋さんは光陽塗装・明和サッシに人数を催促しない
for (const m of messages.filter((x) => x.senderId === JIMU)) {
  if (/光陽|明和|山口|池田/.test(m.text) && m.sentAt >= '2026-11-10') errs.push(`${m.id} 高橋 mentions 光陽/明和 on/after 11/10`);
  if (m.mentionIds.some((u) => [P.tosou, P.sash].includes(u))) errs.push(`${m.id} 高橋 mentions tosou/sash`);
}
// #9 ④⑥ の是正報告を書かない（④は m-0220「今週中にやります」のみ）
for (const m of messages) {
  if (/是正[④⑥]/.test(m.text)) errs.push(`${m.id} 是正④⑥ written`);
  if (m.replyToId === ref('P6')) errs.push(`${m.id} reply to 指摘⑥`);
  if (m.replyToId === ref('P4') && !m.text.startsWith('④は今週中にやります')) errs.push(`${m.id} reply to 指摘④`);
}
// #1 U1〜U4 の件に佐藤さんが他ルームで対応報告していない（追加分の本文で確認）
for (const m of messages.filter((x) => x.senderId === 'u-sato' && !/^m-\d{4}$/.test(x.id))) {
  if (/EPS|スリーブ|施工図|段取り|仮囲い/.test(m.text)) errs.push(`${m.id} 佐藤 may answer U1-U4`);
}
// 既存の ToDo 以外に、今日（11/11）期限で佐藤さん担当の ToDo を増やさない（#5）
todos.filter((td) => td.assigneeId === 'u-sato' && !['t-001', 't-002', 't-003', 't-004', 't-005'].includes(td.id)).forEach((td) => errs.push(`${td.id} new todo for 佐藤`));

const hc1112 = messages.filter((m) => m.roomId === 'room-headcount' && m.sentAt >= '2026-11-11T09:30' && m.sentAt <= '2026-11-11T12:40');
console.log('rooms:', rooms.length, 'messages:', messages.length, 'todos:', todos.length);
console.log('headcount for 11/12:', hc1112.map((m) => `${m.id} ${m.text}`));
console.log('labels:', JSON.stringify(labelToId));
console.log('per room:', JSON.stringify(Object.fromEntries(rooms.map((r) => [r.id, messages.filter((m) => m.roomId === r.id).length]))));
if (errs.length) {
  console.error('ERRORS:\n' + errs.join('\n'));
  process.exit(1);
}
console.log('validation OK');
