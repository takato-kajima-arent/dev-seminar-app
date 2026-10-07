// data/mail.json を生成する（全員分のメールを1つの messages[] に入れる）
//   受信トレイ＝ to/cc の personId、送信済み＝ from.personId（labelIds に inbox/sent は使わない）
//   既読・スターは readBy[] / starredBy[]（差出人は自分のメールを既読扱い）
//   既存の mail-001〜040 は ID を固定。追加分（加藤・高橋の目線）は mail-101〜
// 使い方: node scripts/build-mail.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(root, 'data/site.json'), 'utf8'));
const people = Object.fromEntries(site.people.map((p) => [p.id, p]));
const companies = Object.fromEntries(site.companies.map((c) => [c.id, c]));

const ME = 'u-sato';
const KATO = 'u-kato';
const TAKA = 'u-takahashi';
const GC_ORG = {
  'u-kato': '東都建設 本社工務部',
  'u-saito': '東都建設 本社安全環境部',
  'u-nishida': '東都建設 本社経理部',
  'u-ogawa': '東都建設 大井町作業所',
  'u-ono': '東都建設 工務部長',
  'u-tamura': '東都建設 品川駅前作業所',
};

// 人物 ID → {name, email, personId}
function who(id, suffix) {
  const p = people[id];
  if (!p) throw new Error(`unknown personId ${id}`);
  const c = companies[p.companyId];
  const org = suffix ?? (p.companyId === 'c-gc' ? (GC_ORG[id] ?? '東都建設') : c.shortName);
  const name = `${p.name}（${org}）`;
  return { name, email: p.email, personId: id };
}
// 人物 ID を持たない送信者（メルマガ・システム通知）
const ext = (name, email) => ({ name, email, personId: null });

const SIG_SATO = `\n\n--\n東都建設株式会社\n（仮称）港南三丁目オフィスビル新築工事 作業所\n工事主任 佐藤 健一\nTEL 03-0000-1234 / k.sato@toto-kensetsu.example`;

// key はレポート用の目印（出力には含めない）
const mails = [
  // ---------------- 10/28〜10/31 ----------------
  {
    key: 'dekidaka-req', thread: 'dekidaka',
    from: who('u-kato'), to: [ME], cc: [],
    subject: '10月分 出来高報告のご提出について（11/11 17時締切）',
    body: `各作業所 工事主任各位\n\nお疲れ様です。本社工務部の加藤です。\n\n10月分の出来高報告について、下記のとおりご提出をお願いいたします。\n\n・提出物：出来高報告書（所定様式）、出来高査定根拠資料\n・提出先：工務部 加藤\n・締切：11月11日（水）17:00\n・今月から、査定根拠として各工種の進捗写真を1枚ずつ添付\n\n様式は前月から変更ありません。\nご不明点があればご連絡ください。\n\n本社 工務部 加藤 恵子`,
    at: '2026-10-28T09:12', labels: ['lbl-honsha'], read: true,
  },
  {
    key: 'ueda-yukaishi', thread: 'ueda-yukaishi',
    from: who('u-ueda'), to: [ME], cc: ['u-yamamoto'],
    subject: '1Fエントランス 床石の見本について',
    body: `佐藤様\n\nいつもお世話になっております。港南不動産開発の上田です。\n\n先日ご提示いただいた1Fエントランスの床石（グレー系 本磨き）ですが、\n社内で確認したところ、滑りにくさを心配する声がありました。\n\n・雨の日に濡れた靴で歩いた場合の滑り抵抗値は分かりますでしょうか\n・水磨き仕上げの見本も比較のため見せていただくことは可能でしょうか\n\nお手数ですがご確認をお願いいたします。\n\n港南不動産開発株式会社 開発推進部\n上田 直樹`,
    at: '2026-10-28T14:30', labels: ['lbl-site'], read: true,
  },
  {
    key: 'ueda-yukaishi-re', thread: 'ueda-yukaishi',
    from: who(ME), to: ['u-ueda'], cc: ['u-yamamoto', 'u-kobayashi'],
    subject: 'Re: 1Fエントランス 床石の見本について',
    body: `上田様\n\nお世話になっております。東都建設の佐藤です。\n\nご質問の件、承知しました。\n・本磨きの滑り抵抗値（C.S.R値）はメーカーに確認中です。分かり次第ご連絡します。\n・水磨き仕上げの見本はメーカーに手配しました。11月中旬には現場に届く見込みです。\n\n届きましたら施主定例の際に並べてご確認いただけるようにします。\nよろしくお願いいたします。${SIG_SATO}`,
    at: '2026-10-28T18:05', labels: [], read: true,
  },
  {
    key: 'news-1029', thread: 'news-1029',
    from: ext('週刊 建設ジャーナル', 'news@kensetsu-journal.example'), to: [ME], cc: [],
    subject: '【週刊 建設ジャーナル】10/29号 ― 改正労働安全衛生規則のポイント／資材価格の動向',
    body: `週刊 建設ジャーナル 10/29号\n\n■ 今週のトピック\n・改正労働安全衛生規則、来年4月施行分のポイント解説\n・鋼材・石膏ボード価格 10月の動向（前月比 +1.2%）\n・現場のDX事例：タブレット日報の導入で事務時間を3割削減\n\n■ セミナーのご案内\n「現場監督のための工程管理 実践講座」12/3（木）オンライン開催\n\n配信停止はこちら：https://kensetsu-journal.example/unsubscribe`,
    at: '2026-10-29T07:00', labels: [], read: true,
  },
  {
    key: 'ev-koutei', thread: 'ev-koutei',
    from: who('u-abe'), to: [ME], cc: ['u-nakamura'],
    subject: 'EV据付 工程表（改訂版）の送付',
    body: `東都建設 佐藤様\n中村様\n\nお世話になっております。ミツワ昇降機の阿部です。\n\nEV（乗用2基）の据付工程表を改訂しましたので、共有フォルダに格納しました。\n主な変更点は以下です。\n・2号機 ガイドレール建込み：11/13〜 → 11/16〜（受変電切替後に変更）\n・かご組立：11/30〜\n\n全体の竣工検査日には影響ありません。\nよろしくお願いいたします。\n\nミツワ昇降機株式会社 工事部\n阿部 誠司`,
    at: '2026-10-30T11:20', labels: ['lbl-site'], read: true,
  },
  {
    key: 'anzen-taikai', thread: 'anzen-taikai',
    from: who('u-saito'), to: [ME], cc: [],
    subject: '年末安全大会 出欠のご回答（11/11まで）',
    body: `各作業所 ご担当者様\n\nお疲れ様です。本社 安全環境部の斎藤です。\n\n本年も年末安全大会を下記のとおり開催します。\n\n・日時：12月4日（金）13:30〜16:00\n・場所：本社 3F 大会議室（オンライン併用）\n・対象：各作業所の所長・工事主任、協力会社 職長代表\n\n出欠と参加人数（協力会社分を含む）を、\n**11月11日（水）まで** にこのメールへの返信でご回答ください。\n\n詳細は添付の開催案内をご覧ください。\n\n本社 安全環境部 斎藤 学`,
    at: '2026-10-30T16:00', labels: ['lbl-honsha'], read: true,
    attachments: ['f-mail-anzentaikai-pdf'],
  },
  {
    key: 'kintai', thread: 'kintai',
    from: ext('東都建設 社内ポータル', 'noreply@portal.toto-kensetsu.example'), to: [ME], cc: [],
    subject: '【勤怠】10月度 勤怠締めのお知らせ',
    body: `佐藤 健一 さん\n\n10月度の勤怠締めは 11月2日（月）12:00 です。\n未申請の残業・休日出勤がある場合は、締め日までに申請してください。\n\n※本メールは送信専用です。`,
    at: '2026-10-31T09:00', labels: ['lbl-honsha'], read: true,
  },
  // ---------------- 11/2〜11/7 ----------------
  {
    key: 'crane-haisha', thread: 'crane-haisha',
    from: who('u-fujita'), to: [ME], cc: ['u-ito'],
    subject: '11月 クレーン配車予定のご案内',
    body: `東都建設 佐藤様\n\nいつもお世話になっております。大江戸クレーンの藤田です。\n\n11月の配車状況をお知らせします。\n25tラフターは中旬以降が混み合っております。\nご利用予定がありましたら、お早めに仮押さえのご連絡をお願いします。\n\n大江戸クレーン株式会社\n藤田 茂`,
    at: '2026-11-02T13:15', labels: ['lbl-site'], read: true,
  },
  {
    key: 'promo-1103', thread: 'promo-1103',
    from: ext('ケンザイ商事 オンラインストア', 'info@kenzai-shoji.example'), to: [ME], cc: [],
    subject: '【11月限定】養生材・安全用品 まとめ買いキャンペーン',
    body: `いつもご利用ありがとうございます。\n\n11月限定で、養生シート・ノンスリップテープ・安全帯（フルハーネス）を対象に\nまとめ買い割引を実施中です。\n\n・3ケース以上で 10% OFF\n・法人様は請求書払い対応\n\nキャンペーン期間：11/1〜11/30\nhttps://kenzai-shoji.example/campaign`,
    at: '2026-11-03T10:00', labels: [], read: false,
  },
  {
    key: 'ueda-photo', thread: 'ueda-photo',
    from: who('u-ueda'), to: [ME], cc: [],
    subject: '工事進捗写真（10月分）のご送付依頼',
    body: `佐藤様\n\nお世話になっております。上田です。\n\n社内の月次報告で使用したいので、10月分の工事進捗写真（10枚程度）を\nお送りいただけますでしょうか。\n外観全景と、内装が進んでいるフロアの写真があるとありがたいです。\n\n来週中で構いません。よろしくお願いいたします。\n\n上田`,
    at: '2026-11-04T10:05', labels: ['lbl-site'], read: true,
  },
  {
    key: 'ueda-photo-re', thread: 'ueda-photo',
    from: who(ME), to: ['u-ueda'], cc: [],
    subject: 'Re: 工事進捗写真（10月分）のご送付依頼',
    body: `上田様\n\nお世話になっております。佐藤です。\n\n10月分の進捗写真12枚を、共有フォルダ「05_工事写真」に格納しました。\n外観全景（東面・南面）と、2工区の内装写真を中心に選んでいます。\n\n不足があればお知らせください。${SIG_SATO}`,
    at: '2026-11-04T17:40', labels: [], read: true,
  },
  {
    key: 'shobo-kensa', thread: 'shobo-kensa',
    from: who('u-maeda'), to: [ME], cc: ['u-nakamura'],
    subject: '消防中間検査の日程候補について',
    body: `佐藤様\n中村様\n\nお疲れ様です。関東消防設備の前田です。\n\n所轄消防署の中間検査（1〜4F スプリンクラー配管）の日程候補をいただきました。\n・11/25（水）午後\n・11/27（金）午前\n\nどちらがよろしいか、11/16（月）までにご回答いただければ消防署に回答します。\nよろしくお願いします。\n\n関東消防設備 前田`,
    at: '2026-11-05T14:00', labels: ['lbl-site'], read: true,
  },
  {
    key: 'denki-kirikae', thread: 'denki-kirikae',
    from: who('u-inoue'), to: [ME], cc: ['u-nakamura'],
    subject: '受変電設備 切替作業 要領書（案）の送付',
    body: `佐藤さん 中村さん\n\nお疲れ様です。三光電設 井上です。\n\n受変電設備の切替作業の要領書（案）を作成しました。共有フォルダの07_打合せ資料に入れてあります。\n停電の日時は次回の定例で決めさせてください。\n\n以上よろしくお願いします。\n\n三光電設 井上`,
    at: '2026-11-05T17:00', labels: ['lbl-site'], read: true,
  },
  {
    key: 'nippo-kucho-1105', thread: 'nippo-kucho-1105',
    from: who('u-kimura'), to: [ME], cc: ['u-nakamura', 'u-takahashi'], readBy: ['u-takahashi'],
    subject: '【日報】11/5分 富士空調システム',
    body: `佐藤様\n\nお疲れ様です。富士空調の木村です。\n11/5分の作業日報を送付します。\n\nよろしくお願いします。\n\n富士空調システム 木村`,
    at: '2026-11-06T08:15', labels: ['lbl-nippo'], read: true,
    attachments: ['f-nippo-kucho-1105-xlsx'],
  },
  {
    key: 'yoju-soudan', thread: 'yoju',
    from: who('u-kimura'), to: [ME], cc: ['u-nakamura'],
    subject: '屋上室外機 揚重方法のご相談',
    body: `佐藤様\n\nお世話になっております。富士空調の木村です。\n\n屋上室外機（計8台）の揚重について、ご相談です。\n・最大重量は1台あたり約1.2tです\n・タワークレーン解体後のため、移動式クレーン（25tラフター）での揚重を考えています\n・据付は11/18（水）を希望しています\n\nクレーンの手配と、設置位置（北側道路の占用）について\nご意見をいただけますでしょうか。\n\n富士空調システム株式会社\n木村 聡`,
    at: '2026-11-06T15:00', labels: ['lbl-site'], read: true,
  },
  {
    key: 'yoju-soudan-re', thread: 'yoju',
    from: who(ME), to: ['u-kimura'], cc: ['u-nakamura', 'u-ito'],
    subject: 'Re: 屋上室外機 揚重方法のご相談',
    body: `木村さん\n\nお疲れ様です。佐藤です。\n\n11/18 を軸に、大江戸クレーンに25tラフターの仮押さえを依頼しました（まだ確定ではありません）。\n道路占用は伊藤のほうで警察・区への確認を進めます。\n\n揚重計画書の提出期限は、次回の工程定例で決めさせてください。\nよろしくお願いします。${SIG_SATO}`,
    at: '2026-11-06T18:20', labels: [], read: true,
  },
  {
    key: 'nippo-tosou-1106', thread: 'nippo-tosou-1106',
    from: who('u-yamaguchi'), to: [ME], cc: ['u-takahashi'], readBy: ['u-takahashi'],
    subject: '日報送付（11月6日分）光陽塗装',
    body: `東都建設 佐藤様\n\nいつもお世話になっております。\n光陽塗装の山口でございます。\n\n11月6日分の作業日報をPDFにて送付いたします。\nご査収のほどよろしくお願い申し上げます。\n\n光陽塗装株式会社\n山口 誠`,
    at: '2026-11-07T08:20', labels: ['lbl-nippo'], read: true,
    attachments: ['f-nippo-tosou-1106-pdf'],
  },
  {
    key: 'kyogikai', thread: 'kyogikai',
    from: who('u-saito'), to: [ME], cc: ['u-ito'],
    subject: '11月度 安全衛生協議会 資料提出のお願い（11/20まで）',
    body: `各作業所 ご担当者様\n\nお疲れ様です。安全環境部の斎藤です。\n\n11月度の安全衛生協議会の資料について、下記をご提出ください。\n・今月のヒヤリハット事例（1件以上）\n・安全パトロールの指摘と是正状況\n\n締切：11月20日（金）\n\n本社 安全環境部 斎藤`,
    at: '2026-11-07T10:00', labels: ['lbl-honsha'], read: true,
  },
  {
    key: 'news-anzen-1108', thread: 'news-anzen-1108',
    from: ext('労働安全ニュース', 'mail@anzen-news.example'), to: [ME], cc: [],
    subject: '【労働安全ニュース】年末に向けた墜落・転落災害の防止について',
    body: `労働安全ニュース 第312号\n\n■ 年末は工程が詰まり、墜落・転落災害が増える時期です\n・脚立の天板での作業禁止の再徹底\n・足場の手すり・中さんの点検（盛替え後は特に）\n・開口部養生の確認\n\n■ 事例紹介：仮設ケーブルにつまずいての転倒\n\n配信停止：https://anzen-news.example/stop`,
    at: '2026-11-08T10:00', labels: [], read: false,
  },
  // ---------------- 11/9〜11/10 ----------------
  {
    key: 'ev-hannyu-decoy', thread: 'ev-hannyu',
    from: who('u-abe'), to: [ME], cc: ['u-ito'],
    subject: 'EVかご内装材 搬入のご連絡（11/17）',
    body: `東都建設 佐藤様\n\nお世話になっております。ミツワ昇降機の阿部です。\n\n下記のとおり、EVかご内装材の搬入をお願いいたします。\n\n・日時：11月17日（火）10:00\n・車両：2t車 1台\n・搬入口：西ゲート\n・荷下ろし場所：1F EVホール前（仮置き 半日程度）\n\nよろしくお願いいたします。\n\nミツワ昇降機 阿部`,
    at: '2026-11-09T09:10', labels: ['lbl-site'], read: true,
  },
  {
    key: 'zangyo-yoshiki', thread: 'zangyo-yoshiki',
    from: who('u-kato'), to: [ME], cc: [],
    subject: '【工務部】残業申請様式の変更について',
    body: `各作業所 ご担当者様\n\nお疲れ様です。工務部の加藤です。\n\n来週分の残業申請から、申請様式が新しくなります。\n作業所ごとにまとめて、前週のうちに加藤宛てにお送りください。\n新様式は社内ポータルの「様式集」に掲載しています。\n\n本社 工務部 加藤`,
    at: '2026-11-09T11:30', labels: ['lbl-honsha'], read: true,
  },
  {
    key: 'drain-sato', thread: 'drain',
    from: who(ME), to: ['u-morita'], cc: ['u-yamamoto'],
    subject: '北側通路 既設排水管の位置ずれについて（ご確認のお願い）',
    body: `森田設計 森田様\n\nお世話になっております。東都建設の佐藤です。\n\n外構 北側通路の舗装下地工事で掘削したところ、\n既設の排水管が図面の位置から約50cmずれていることが分かりました。\n\n・ずれの方向：道路側（北側）へ約50cm\n・管径：φ150（図面どおり）\n・既設桝との接続：図面どおり\n\nこのままでは計画の新設排水ルートと干渉します。\nルートの変更が必要か、ご判断をお願いできますでしょうか。\n現場写真は共有フォルダ「05_工事写真/2026-11」に入れています。\n\n回答をいただくまで、新栄外構の当該部分の作業は止めています。\nお手数ですが、よろしくお願いいたします。${SIG_SATO}`,
    at: '2026-11-09T16:45', labels: [], read: true,
  },
  {
    key: 'drain-morita', thread: 'drain',
    from: who('u-morita'), to: [ME], cc: ['u-yamamoto'],
    subject: 'Re: 北側通路 既設排水管の位置ずれについて（ご確認のお願い）',
    body: `佐藤様\n\nお世話になっております。森田設計の森田です。\n\nご連絡と写真をありがとうございました。\n確認した結果、次のとおりルートを変更して進めてください。\n\n・新設排水管のルートを建物側（南側）へ約40cm振り、既設管との離隔を確保する\n・勾配は 1/100 以上を確保する（既設桝への接続高さは変更なし）\n・変更後のルートは、竣工図に反映をお願いします\n\n変更図（スケッチ）は追って共有フォルダにお送りします。\n設計変更の扱いにはしませんので、工事はこのまま再開していただいて構いません。\n\n森田設計事務所\n森田 亮`,
    at: '2026-11-10T09:40', labels: ['lbl-site'], read: true,
  },
  {
    key: 'shukensa-ueda', thread: 'shukensa',
    from: who('u-ueda'), to: [ME], cc: ['u-yamamoto'],
    subject: '11/19 施主検査の立会者と確認事項について',
    body: `佐藤様\n\nお世話になっております。上田です。\n\n11/19（木）の施主検査について、いくつか確認させてください。\n\n1. 開始時刻と集合場所はどちらになりますでしょうか\n2. 検査の範囲は1工区（B1F〜4F）のみでよいでしょうか\n3. 当社からは3名（上田、ほか2名）が立ち会う予定です。\n   ヘルメット等の保護具はお借りできますか\n\nまた、当日の立会者名簿を **11/13（金）まで** にお送りいただけますと助かります。\n\nよろしくお願いいたします。\n\n上田`,
    at: '2026-11-10T11:00', labels: ['lbl-site'], read: true, starred: true,
  },
  {
    key: 'koutei-kaigi-12', thread: 'koutei-kaigi-12',
    from: who('u-kato'), to: [ME], cc: [],
    subject: '12月度 工程会議 資料のご提出（11/18まで）',
    body: `各作業所 ご担当者様\n\nお疲れ様です。工務部の加藤です。\n\n12月度の本社工程会議の資料として、下記をご提出ください。\n・12月〜1月の主要工程（工程表の該当部分で可）\n・遅れている工程と、その対策\n\n締切：11月18日（水）\n\n本社 工務部 加藤`,
    at: '2026-11-10T13:20', labels: ['lbl-honsha'], read: true,
  },
  {
    key: 'hannyu-kucho', thread: 'hannyu-kucho',
    from: who('u-kimura'), to: [ME], cc: ['u-nakamura', 'u-ito'],
    subject: '【搬入連絡】屋上室外機の搬入について',
    body: `佐藤様\n\nお世話になっております。富士空調の木村です。\n\n屋上室外機の搬入を、下記のとおりお願いいたします。\n\n・日時：明後日 11月12日（木）8:30〜\n・物品：屋上室外機（8台）、架台部材\n・車両：4tユニック 2台\n・搬入口：北側搬入口\n・荷下ろし後、1F 北側の仮置きヤードに養生して保管します\n\n誘導員はこちらで1名手配します。\nよろしくお願いいたします。\n\n富士空調システム株式会社\n木村 聡`,
    at: '2026-11-10T16:20', labels: ['lbl-site'], read: true,
  },
  {
    key: 'drain-thanks', thread: 'drain',
    from: who(ME), to: ['u-morita'], cc: ['u-yamamoto'],
    subject: 'Re: 北側通路 既設排水管の位置ずれについて（ご確認のお願い）',
    body: `森田様\n\nお世話になっております。佐藤です。\n\n早々のご回答ありがとうございました。\nいただいた内容で新栄外構に指示し、11/13から作業を再開します。\n変更図のスケッチもお待ちしております。\n\n引き続きよろしくお願いいたします。${SIG_SATO}`,
    at: '2026-11-10T17:05', labels: [], read: true,
  },
  {
    key: 'weather-alert', thread: 'weather-alert',
    from: ext('ウェザーリンク 現場向け気象情報', 'alert@weatherlink.example'), to: [ME], cc: [],
    subject: '【気象情報】港区：11/12（木）は終日雨の予報（降水確率90%）',
    body: `登録地点：東京都港区\n\n■ 週間予報（抜粋）\n・11/11（水）くもり　降水確率 30%\n・11/12（木）雨　　　降水確率 90%　午後は北寄りの風がやや強まる見込み\n・11/13（金）晴れ　　降水確率 10%\n\n屋外作業・クレーン作業のご計画にご注意ください。\n\n※本メールは自動配信です。`,
    at: '2026-11-10T17:30', labels: [], read: true,
  },
  {
    key: 'crane-kariosae', thread: 'crane-kariosae',
    from: who('u-fujita'), to: [ME], cc: ['u-kimura'],
    subject: '11/18 25tラフター 仮押さえの件',
    body: `東都建設 佐藤様\n\nお世話になっております。大江戸クレーンの藤田です。\n\n11/18（水）8:00〜17:00 で、25tラフター1台を仮押さえしております。\n他のお客様からも問い合わせが入っておりますので、\n**明日 11/11（水）中** に確定かキャンセルのご連絡をいただけますでしょうか。\n（本手配の締めが11/11のため、富士空調の木村様にも同じ内容をお伝えしております）\n\nよろしくお願いいたします。\n\n大江戸クレーン 藤田`,
    at: '2026-11-10T18:10', labels: ['lbl-site'], read: true,
  },
  // ---------------- 11/11（今日）〜13:00 ----------------
  {
    key: 'nippo-naiso-1110', thread: 'nippo-naiso-1110',
    from: who('u-shimizu'), to: [ME], cc: ['u-kobayashi', 'u-takahashi'], readBy: ['u-takahashi'],
    subject: '日報 11/10',
    body: `佐藤さん\n\nお疲れ様です。東邦内装 清水です。\n昨日の日報です。写真で失礼します。\n\n清水`,
    at: '2026-11-11T07:30', labels: ['lbl-nippo'], read: false,
    attachments: ['f-nippo-naiso-1110-png'],
  },
  {
    key: 'nippo-kucho-1110', thread: 'nippo-kucho-1110',
    from: who('u-kimura'), to: [ME], cc: ['u-nakamura', 'u-takahashi'], readBy: ['u-takahashi'],
    subject: '【日報】11/10分 富士空調システム',
    body: `佐藤様\n\nお疲れ様です。富士空調の木村です。\n11/10分の作業日報を送付します。\n\nよろしくお願いします。\n\n富士空調システム 木村`,
    at: '2026-11-11T08:10', labels: ['lbl-nippo'], read: false,
    attachments: ['f-nippo-kucho-1110-xlsx'],
  },
  {
    key: 'nippo-tosou-1110', thread: 'nippo-tosou-1110',
    from: who('u-yamaguchi'), to: [ME], cc: ['u-takahashi'], readBy: ['u-takahashi'],
    subject: '日報送付（11月10日分）光陽塗装',
    body: `東都建設 佐藤様\n\nいつもお世話になっております。\n光陽塗装の山口でございます。\n\n11月10日分の作業日報をPDFにて送付いたします。\nご査収のほどよろしくお願い申し上げます。\n\n光陽塗装株式会社\n山口 誠`,
    at: '2026-11-11T08:25', labels: ['lbl-nippo'], read: false,
    attachments: ['f-nippo-tosou-1110-pdf'],
  },
  {
    key: 'dekidaka-today', thread: 'dekidaka',
    from: who('u-kato'), to: [ME], cc: [],
    subject: '【本日17時締切】10月分 出来高報告のご提出',
    body: `佐藤さん\n\nお疲れ様です。工務部の加藤です。\n\n10月分の出来高報告、本日17:00が締切です。\n港南三丁目作業所の分がまだ届いておりませんので、\n本日17時までにご提出をお願いいたします。\n\n本社 工務部 加藤`,
    at: '2026-11-11T08:45', labels: ['important', 'lbl-honsha'], read: false, starred: true,
  },
  {
    key: 'hannyu-namacon', thread: 'hannyu-namacon',
    from: who('u-goto'), to: [ME], cc: ['u-ito'],
    subject: '11/13 生コン 出荷予定のご連絡',
    body: `東都建設 佐藤様\n\nいつもお世話になっております。城南生コンの後藤です。\n\n金曜日の生コン出荷について、下記のとおりご連絡いたします。\n\n・日時：11月13日（金）8:00 現着（1台目）\n・打設箇所：南側駐輪場 土間\n・配合：21-18-20N\n・台数：生コン車（4.25㎥）延べ6台\n・進入：東ゲートから\n\n天候による変更がある場合は、前日15時までにご連絡ください。\nよろしくお願いいたします。\n\n城南生コン株式会社 出荷課\n後藤 英樹`,
    at: '2026-11-11T09:15', labels: ['lbl-site'], read: false,
  },
  {
    key: 'portal-maint', thread: 'portal-maint',
    from: ext('東都建設 社内ポータル', 'noreply@portal.toto-kensetsu.example'), to: [ME], cc: [],
    subject: '【システム】11/14（土）22:00〜 社内ポータル メンテナンスのお知らせ',
    body: `社員各位\n\n下記の時間帯、社内ポータル（勤怠・ワークフロー）が利用できません。\n\n・11月14日（土）22:00 〜 11月15日（日）6:00\n\nご不便をおかけしますが、ご理解のほどお願いいたします。\n\n※本メールは送信専用です。`,
    at: '2026-11-11T09:20', labels: ['lbl-honsha'], read: true,
  },
  {
    key: 'shoninsho-morita', thread: 'shoninsho',
    from: who('u-morita'), to: [ME], cc: ['u-kobayashi'],
    subject: '3F会議室 天井高変更の承認書 ご返送のお願い（本日中）',
    body: `佐藤様\n\nお世話になっております。森田設計の森田です。\n\n3F会議室の天井高さ変更（CH2700→CH2600）について、\n施主の了承が得られましたので、承認書を添付いたします。\n\n内容をご確認のうえ、施工者欄にご記名・押印いただき、\n**本日中** にPDFでご返送をお願いいたします。\n（明日、施主へまとめて提出する予定です）\n\n本日13:30からの打合せでも、念のため内容を確認させてください。\n\n森田設計事務所\n森田 亮`,
    at: '2026-11-11T09:50', labels: ['important', 'lbl-site'], read: false, starred: true,
    attachments: ['f-mail-shoninsho-3f-pdf'],
  },
  {
    key: 'hannyu-floor', thread: 'hannyu-floor',
    from: who('u-nakajima'), to: [ME], cc: ['u-kobayashi'],
    subject: '床材・クロス材 搬入のお願い（11/13 14時）',
    body: `佐藤様\n\nお世話になっております😊 山王インテリアの中島です。\n\n床材とクロス材の搬入をお願いしたく、ご連絡いたしました。\n\n・日時：11/13（金）14:00〜\n・物品：タイルカーペット、ビニルクロス（1工区 3F・4F分）\n・車両：2t 1台\n・搬入口：西ゲート\n\n荷揚げは仮設エレベーターをお借りできると助かります🙏\nどうぞよろしくお願いいたします！\n\n山王インテリア株式会社\n中島 由美`,
    at: '2026-11-11T10:40', labels: ['lbl-site'], read: false,
  },
  {
    key: 'teiden-ito', thread: 'teiden',
    from: who('u-ito'), to: [ME], cc: ['u-nakamura'],
    subject: '11/15 全館停電の周知文（案）確認のお願い',
    body: `佐藤さん\n\nお疲れ様です。伊藤です。\n\n昨日の定例で決まった11/15（日）の全館停電について、\n各社向けの周知文（案）を作りました。下に貼ります。\n\n----\n【全館停電のお知らせ】\n11月15日（日）8:00〜12:00 は、受変電設備の切替のため全館停電となります。\n電動工具・仮設照明をご使用の会社は、段取りをお願いします。\n----\n\n掲示板には明日貼りたいので、11/12（木）の朝までに見てもらえると助かります。\n\n伊藤`,
    at: '2026-11-11T11:10', labels: [], read: false,
  },
  {
    key: 'ueda-yukaishi-2', thread: 'ueda-yukaishi',
    from: who('u-ueda'), to: [ME], cc: ['u-yamamoto'],
    subject: 'Re: 1Fエントランス 床石の見本について',
    body: `佐藤様\n\n本日の施主定例ではありがとうございました。上田です。\n\n床石の件で1点だけ確認させてください。\n水磨き仕上げの見本は、いつ頃現場に届きますでしょうか。\n社内の役員確認を11/24の週に予定しているため、それまでに一度見ておきたいと考えています。\n\nなお、来週の定例は 11/16（月）に振替とのこと、承知しました。\n\nお忙しいところ恐れ入りますが、よろしくお願いいたします。\n\n上田`,
    at: '2026-11-11T11:45', labels: ['lbl-site'], read: false,
  },
  {
    key: 'news-1111', thread: 'news-1111',
    from: ext('週刊 建設ジャーナル', 'news@kensetsu-journal.example'), to: [ME], cc: [],
    subject: '【週刊 建設ジャーナル】11/11号 ― 年末の工程管理、雨天時の段取り替えのコツ',
    body: `週刊 建設ジャーナル 11/11号\n\n■ 今週のトピック\n・年末の工程管理：雨天時の段取り替えのコツ\n・2027年度 公共工事設計労務単価の見通し\n・BIM連携の施工図チェック、現場での使いどころ\n\n配信停止はこちら：https://kensetsu-journal.example/unsubscribe`,
    at: '2026-11-11T12:10', labels: [], read: false,
  },
];

// ================================================================
// 追加分：本社 加藤／事務 高橋の目線（mail-101〜）
//   ※ストーリー #4/#5/#10 を変えないため、佐藤さんの受信トレイ（to/cc）には一切入れない。
//     11/12〜11/13 の搬入連絡・11/10 分の日報・佐藤さん宛ての「本日期限」の依頼は書かない。
//     光陽塗装・明和サッシの 11/12 の人数にも触れない。
// readBy：差出人以外で既読の人。starredBy：スターを付けた人
// ================================================================
const SIG_KATO = `\n\n--\n東都建設株式会社 本社 工務部 工事管理課\n課長 加藤 恵子\nTEL 03-0000-5000 / k.kato@toto-kensetsu.example`;
const SIG_TAKA = `\n\n--\n東都建設株式会社\n（仮称）港南三丁目オフィスビル新築工事 作業所\n事務担当 高橋 由紀\nTEL 03-0000-1234 / y.takahashi@toto-kensetsu.example`;
const SIG_OGAWA = `\n\n--\n東都建設株式会社\n（仮称）大井町二丁目共同住宅新築工事 作業所\n所長 小川 隆司`;
const SIG_NISHIDA = `\n\n--\n東都建設株式会社 本社 経理部\n西田 綾（内線 3120）`;
const KEIKI = ext('東都建設 経営企画部', 'keiei-kikaku@toto-kensetsu.example');
const PORTAL = ext('東都建設 社内ポータル', 'noreply@portal.toto-kensetsu.example');
const ONO = who('u-ono', '東都建設 工務部長');

const extra = [
  // ---------------- 加藤：大井町 小川所長からの相談 ----------------
  {
    key: 'oi-zando', thread: 'oi-zando',
    from: who('u-ogawa'), to: [KATO], cc: [],
    subject: '【大井町二丁目】杭工事 残土処分費の増額について（ご相談）',
    body: `加藤課長\n\nお疲れ様です。大井町の小川です。\n\n杭工事で発生した残土ですが、分析の結果、一部（約120㎥）が\n第二種改良土扱いとなり、受入れ先の変更が必要になりました。\n\n・当初：処分費 約180万円（一般残土）\n・変更後：処分費 約310万円（増額 約130万円）\n\n実行予算の予備費で吸収できるか検討していますが、\n外注契約の変更が必要になりそうです。進め方についてご相談させてください。${SIG_OGAWA}`,
    at: '2026-10-28T09:40', labels: ['lbl-oimachi'], readBy: [KATO],
  },
  {
    key: 'oi-zando-re', thread: 'oi-zando',
    from: who(KATO), to: ['u-ogawa'], cc: [],
    subject: 'Re: 【大井町二丁目】杭工事 残土処分費の増額について（ご相談）',
    body: `小川所長\n\nお疲れ様です。加藤です。\n\n状況承知しました。予備費の残りを考えると、契約変更で進めるのがよいと思います。\n・分析結果の写し\n・受入れ先2〜3社の見積\nをそろえていただければ、ワークフローで外注契約の変更を回してください。\n承認はこちらで急ぎます。${SIG_KATO}`,
    at: '2026-10-29T10:20', labels: ['lbl-oimachi'], readBy: ['u-ogawa'],
  },
  {
    key: 'oi-zando-re2', thread: 'oi-zando',
    from: who('u-ogawa'), to: [KATO], cc: [],
    subject: 'Re: 【大井町二丁目】杭工事 残土処分費の増額について（ご相談）',
    body: `加藤課長\n\nありがとうございます。見積が3社分そろいましたので、\n今週中にワークフローを申請します。最安の1社（約295万円）で進める予定です。\n\n小川`,
    at: '2026-11-02T16:10', labels: ['lbl-oimachi'], readBy: [KATO],
  },
  {
    key: 'oi-naiso', thread: 'oi-naiso',
    from: who('u-ogawa'), to: [KATO], cc: [],
    subject: '【大井町二丁目】内装（LGS）業者の手配が難航しています',
    body: `加藤課長\n\nお疲れ様です。小川です。\n\n12月から予定している住戸内のLGS・ボードについて、\n予定していた業者が他現場との重なりで、12月前半は半分の人数（4名）しか出せないと連絡がありました。\n\n・当初：8名 × 12/1〜12/25\n・業者案：12月前半 4名、後半 8名\n\nこのままだと1週間ほど遅れる見込みです。\n本社で付き合いのある内装業者をご紹介いただけないでしょうか。\n来週どこかで少しお時間をいただけると助かります。${SIG_OGAWA}`,
    at: '2026-11-05T19:20', labels: ['lbl-oimachi'], readBy: [KATO], starredBy: [KATO],
  },
  {
    key: 'oi-naiso-re', thread: 'oi-naiso',
    from: who('u-ogawa'), to: [KATO], cc: [],
    subject: 'Re: 【大井町二丁目】内装（LGS）業者の手配が難航しています',
    body: `加藤課長\n\n昨日はオンラインでお時間をいただき、ありがとうございました。\n\nご紹介いただいた2社に連絡し、今週中に見積と人員の回答をもらうことになりました。\n回答がそろいましたら、またご報告します。\n\n小川`,
    at: '2026-11-10T09:20', labels: ['lbl-oimachi'], readBy: [KATO],
  },
  {
    key: 'oi-naiso-re2', thread: 'oi-naiso',
    from: who(KATO), to: ['u-ogawa'], cc: [],
    subject: 'Re: 【大井町二丁目】内装（LGS）業者の手配が難航しています',
    body: `小川所長\n\nお疲れ様です。加藤です。\n\nご連絡ありがとうございます。\n明日（11/12）の巡回の際に、見積の状況と12月の工程の組み直し案を見せてください。\n2社とも人が出ない場合は、工程の順番（住戸の順序）の入替えも一緒に考えましょう。${SIG_KATO}`,
    at: '2026-11-11T12:30', labels: ['lbl-oimachi'], readBy: [],
  },
  {
    key: 'oi-getsuji', thread: 'oi-getsuji',
    from: who('u-ogawa'), to: [KATO], cc: [],
    subject: '【大井町二丁目】10月 月次工事報告',
    body: `加藤課長\n\nお疲れ様です。大井町の小川です。\n10月の月次工事報告です。\n\n・進捗：躯体 3F床まで完了（計画どおり）\n・安全：無災害（不休災害なし）\n・課題：杭残土の処分費増額（別途ご相談中）、12月の内装業者の人員\n・11月の主な予定：4F〜5F 躯体、外部足場 盛替え\n\n詳細は本社サーバーの月次報告フォルダに格納しました。${SIG_OGAWA}`,
    at: '2026-10-30T18:00', labels: ['lbl-oimachi'], readBy: [KATO],
  },
  {
    key: 'oi-dekidaka', thread: 'oi-dekidaka',
    from: who('u-ogawa'), to: [KATO], cc: ['u-nishida'],
    subject: '【大井町二丁目】10月分 出来高報告の提出',
    body: `加藤課長\n西田さん\n\nお疲れ様です。小川です。\n\n10月分の出来高報告書と査定根拠資料を、本社サーバーの出来高フォルダに格納しました。\n・10月出来高：約8,200万円（累計出来高率 31%）\n・杭残土の増額分は、契約変更の承認後に11月分で計上します。\n\nご確認をお願いします。${SIG_OGAWA}`,
    at: '2026-11-10T16:40', labels: ['lbl-oimachi', 'lbl-honsha'], readBy: [KATO, 'u-nishida'],
  },
  {
    key: 'shinagawa-dekidaka', thread: 'shinagawa-dekidaka',
    from: who('u-tamura', '東都建設 品川駅前作業所'), to: [KATO], cc: [],
    subject: '【品川駅前】10月分 出来高報告の提出',
    body: `加藤課長\n\nお疲れ様です。品川駅前作業所の田村です。\n\n10月分の出来高報告書を提出します。\n資料は本社サーバーの出来高フォルダに格納しました。\n\nよろしくお願いします。\n\n品川駅前作業所 所長 田村`,
    at: '2026-11-11T08:20', labels: ['lbl-honsha'], readBy: [KATO],
  },
  // ---------------- 加藤：港南三丁目（佐藤・山本）からの報告 ----------------
  {
    key: 'konan-getsuji', thread: 'konan-getsuji',
    from: who(ME), to: [KATO], cc: ['u-yamamoto'],
    subject: '【港南三丁目】10月 月次工事報告',
    body: `加藤課長\n\nお疲れ様です。港南三丁目作業所の佐藤です。\n10月の月次工事報告をお送りします。\n\n・進捗：躯体完了済み。内装・設備・外装の仕上げに入っています（全体 おおむね計画どおり）\n・1工区：内装 LGS・ボード 順調、2-3F 給排水配管 進行中\n・2工区：6F 内装は11/2から着手予定\n・外構：北側通路の舗装下地を11/4から着手予定\n・安全：10月 無災害\n\n11月は外部足場の一部解体（11/20〜）と、11/19 の施主検査が山場になります。${SIG_SATO}`,
    at: '2026-10-30T17:30', labels: ['lbl-honsha'], readBy: [KATO, 'u-yamamoto'],
  },
  {
    key: 'konan-drain-report', thread: 'konan-drain-report',
    from: who(ME), to: [KATO], cc: ['u-yamamoto'],
    subject: '【港南三丁目】外構 北側通路 既設排水管の位置ずれ（ご報告）',
    body: `加藤課長\n\nお疲れ様です。佐藤です。\n外構工事で発生した件をご報告します。\n\n・11/9：北側通路の舗装下地で掘削したところ、既設排水管が図面より道路側（北側）へ約50cmずれていることが判明\n・同日、森田設計に確認を依頼し、新栄外構の当該部分は作業を止めています\n・11/10 朝：森田設計から回答あり。新設管のルートを建物側（南側）へ振る対応で、設計変更の扱いにはしない\n・新栄外構は11/13から再開予定です\n\n舗装下地の完了は、当初の11/12から11/17頃にずれる見込みです。\n外構全体の完了時期への影響はありません。${SIG_SATO}`,
    at: '2026-11-10T10:30', labels: ['lbl-honsha'], readBy: [KATO, 'u-yamamoto'],
  },
  {
    key: 'shukensa-honsha', thread: 'shukensa-honsha',
    from: who('u-yamamoto'), to: [KATO], cc: [],
    subject: '11/19 施主検査 本社からのご出席のお願い',
    body: `加藤課長\n\nお疲れ様です。山本です。\n\n11/19（木）10:00から、港南不動産開発様の施主検査があります。\n施主側は上田課長ほか2名（計3名）の予定で、先方から本社の方にも一度お会いしたいとの話がありました。\nご都合がよろしければ、ご出席をお願いできますでしょうか。\n\n検査の範囲・段取りは、作業所で詰めてから改めてご説明します。\n\n山本`,
    at: '2026-11-05T08:45', labels: ['lbl-site'], readBy: [KATO],
  },
  {
    key: 'shukensa-honsha-re', thread: 'shukensa-honsha',
    from: who(KATO), to: ['u-yamamoto'], cc: [],
    subject: 'Re: 11/19 施主検査 本社からのご出席のお願い',
    body: `山本所長\n\nお疲れ様です。加藤です。\n\n11/19 は出席します。予定に入れました。\n事前に段取りを伺いたいので、11/12（木）15:00から30分〜1時間ほどお時間をいただけますか。\nオンラインで構いません。\n\nまた、11/13（金）の午前に港南の現場を一度巡回させてください（同行は不要です）。${SIG_KATO}`,
    at: '2026-11-05T12:10', labels: ['lbl-site'], readBy: ['u-yamamoto'],
  },
  // ---------------- 加藤：経理 西田さん ----------------
  {
    key: 'genka-shokai', thread: 'genka-shokai',
    from: who('u-nishida'), to: [KATO], cc: [],
    subject: '【経理】9月分 工事原価 未計上分の照会（港南三丁目・大井町二丁目）',
    body: `加藤課長\n\nお疲れ様です。経理部の西田です。\n\n9月分の工事原価を締めたところ、下記が未計上のままになっています。\n計上漏れか、10月分での計上予定か、ご確認いただけますでしょうか。\n\n【港南三丁目】\n・仮設電気 使用料（9月分）\n・産廃処理費（9月後半分）\n\n【大井町二丁目】\n・杭工事 残土運搬費（9/28〜9/30分）\n\n11/4（水）までにご回答いただけますと助かります。${SIG_NISHIDA}`,
    at: '2026-10-29T13:00', labels: ['lbl-keiri'], readBy: [KATO],
  },
  {
    key: 'genka-shokai-re', thread: 'genka-shokai',
    from: who(KATO), to: ['u-nishida'], cc: [],
    subject: 'Re: 【経理】9月分 工事原価 未計上分の照会（港南三丁目・大井町二丁目）',
    body: `西田さん\n\nお疲れ様です。加藤です。\n\n大井町の残土運搬費は、小川所長に確認したところ10月分でまとめて計上予定とのことです。\n港南三丁目の2件は、作業所事務の高橋さんに請求書の到着状況を確認してもらっています。\n分かり次第ご連絡します。${SIG_KATO}`,
    at: '2026-10-30T11:00', labels: ['lbl-keiri'], readBy: ['u-nishida'],
  },
  {
    key: 'genka-shokai-re2', thread: 'genka-shokai',
    from: who('u-nishida'), to: [KATO], cc: [TAKA],
    subject: 'Re: 【経理】9月分 工事原価 未計上分の照会（港南三丁目・大井町二丁目）',
    body: `加藤課長\n（cc：高橋さん）\n\nご確認ありがとうございます。\n\n港南三丁目の件、高橋さんから回答をいただきました。\n・産廃処理費：10月分で計上済み（確認できました）\n・仮設電気 使用料：電力会社の請求書が未着とのこと。到着しだい回していただくことになりました\n\n大井町の件も承知しました。${SIG_NISHIDA}`,
    at: '2026-11-02T10:30', labels: ['lbl-keiri'], readBy: [KATO, TAKA],
  },
  {
    key: 'totsugo', thread: 'totsugo',
    from: who('u-nishida'), to: [KATO], cc: [],
    subject: '10月分 出来高と原価の突合スケジュール',
    body: `加藤課長\n\nお疲れ様です。西田です。\n\n10月分の出来高と原価の突合について、今月は次の日程で進めさせてください。\n\n・11/11（水）17:00：各現場の出来高 提出締切（工務部）\n・11/12（木）中：工務部から経理へ 集計表の送付\n・11/16（月）：役員会資料用の数字を確定\n\n11/11 14:00からの原価会議では、9月分の未計上の件と、大井町の残土処分費の扱いを確認したいと思います。${SIG_NISHIDA}`,
    at: '2026-11-09T08:10', labels: ['lbl-keiri', 'lbl-honsha'], readBy: [KATO],
  },
  {
    key: 'dekidaka-mitei', thread: 'dekidaka-mitei',
    from: who('u-nishida'), to: [KATO], cc: [],
    subject: '【確認】10月分 出来高 未提出の現場について（11/11 10時時点）',
    body: `加藤課長\n\nお疲れ様です。西田です。\n\n本日17時締切の10月分 出来高について、10時時点で出来高報告書（本体）がまだ届いていない現場は次のとおりです。\n\n・港南三丁目作業所\n・川崎物流センター作業所\n\n明日、集計表をいただく前提で準備していますので、\n念のため状況をご確認いただけますでしょうか。${SIG_NISHIDA}`,
    at: '2026-11-11T10:15', labels: ['important', 'lbl-keiri'], readBy: [],
  },
  // ---------------- 加藤：本社の通知・役員会・安全大会 ----------------
  {
    key: 'yakuin-shiryo', thread: 'yakuin-shiryo',
    from: KEIKI, to: [KATO], cc: [],
    subject: '【経営企画】11月度 役員会 資料ご提出のお願い（11/16 12:00締切）',
    body: `各部 ご担当者様\n\n経営企画部です。\n\n11月度の役員会（11/17（火）10:00〜）の資料について、下記のとおりご提出をお願いいたします。\n\n・工務部：各現場の進捗・出来高（10月分）、主要リスクと対策\n・様式：前月と同じ（A4横 2枚以内）\n・締切：11月16日（月）12:00\n\nよろしくお願いいたします。\n\n東都建設株式会社 経営企画部`,
    at: '2026-10-29T17:00', labels: ['important', 'lbl-honsha'], readBy: [KATO], starredBy: [KATO],
  },
  {
    key: 'yakuin-shiryo-remind', thread: 'yakuin-shiryo',
    from: KEIKI, to: [KATO], cc: [],
    subject: 'Re: 【経営企画】11月度 役員会 資料ご提出のお願い（11/16 12:00締切）',
    body: `各部 ご担当者様\n\n経営企画部です。\n役員会資料の締切（11/16（月）12:00）が近づいてまいりましたので、念のためご連絡いたします。\n\n今回は「年末に向けた工程上のリスク」について、各部1枚追加をお願いしております。\n\n東都建設株式会社 経営企画部`,
    at: '2026-11-10T09:00', labels: ['lbl-honsha'], readBy: [KATO],
  },
  {
    key: 'bukai-gidai', thread: 'bukai-gidai',
    from: ONO, to: [KATO], cc: [],
    subject: '11/9 工務部会 議題',
    body: `加藤さん\n\nお疲れ様です。大野です。\n11/9（月）の工務部会の議題です。\n\n1. 各現場の10月出来高の見込み（11/11締切分）\n2. 年末に向けた工程上のリスク（港南三丁目の内装、大井町の内装業者）\n3. 年末安全大会の運営分担\n\n2の資料をお願いします。\n\n工務部長 大野`,
    at: '2026-11-02T08:30', labels: ['lbl-honsha'], readBy: [KATO],
  },
  {
    key: 'taikai-staff', thread: 'taikai-staff',
    from: who('u-saito'), to: [KATO], cc: [],
    subject: '年末安全大会 運営スタッフ（工務部から2名）のお願い',
    body: `加藤課長\n\nお疲れ様です。安全環境部の斎藤です。\n\n12/4（金）の年末安全大会について、今年も工務部から運営スタッフを2名お願いできますでしょうか。\n（受付と、表彰の進行補助をお願いする予定です）\n\nお名前は11/20（金）の準備会議までにいただければ大丈夫です。\n\n安全環境部 斎藤`,
    at: '2026-11-04T11:00', labels: ['lbl-honsha'], readBy: [KATO],
  },
  {
    key: 'taikai-mikaito', thread: 'taikai-mikaito',
    from: who('u-saito'), to: [KATO], cc: [],
    subject: '年末安全大会 出欠 未回答の作業所（11/11 11時時点）',
    body: `加藤課長\n\n先ほどの打合せではありがとうございました。斎藤です。\n\n年末安全大会の出欠ですが、11時時点で回答がまだの作業所は次のとおりです（回答期限は本日です）。\n\n・港南三丁目作業所\n・品川駅前作業所\n\n工務部からも一声かけていただけると助かります。\n\n安全環境部 斎藤`,
    at: '2026-11-11T11:30', labels: ['lbl-honsha'], readBy: [],
  },
  {
    key: 'wf-zando', thread: 'wf-zando',
    from: PORTAL, to: [KATO], cc: [],
    subject: '【ワークフロー】承認依頼：大井町二丁目 外注契約変更（杭工事 残土処分費）',
    body: `加藤 恵子 さん\n\n承認依頼が届いています。\n\n・申請者：小川 隆司（大井町作業所）\n・件名：外注契約変更（杭工事 残土処分費の増額）\n・金額：+1,150,000円（税抜）\n\n社内ポータルの「ワークフロー」から内容を確認してください。\n\n※本メールは送信専用です。`,
    at: '2026-11-09T09:00', labels: ['lbl-oimachi'], readBy: [KATO],
  },
  // ---------------- 加藤 ⇔ 高橋：出来高資料の取りまとめ・停電の届出 ----------------
  {
    key: 'dk-taka-req', thread: 'dk-taka',
    from: who(KATO), to: [TAKA], cc: [],
    subject: '港南三丁目 10月分 出来高資料の取りまとめのお願い（11/11 17時締切）',
    body: `高橋さん\n\nお疲れ様です。本社工務部の加藤です。\n\n10月分の出来高報告（11/11（水）17:00締切）について、\n佐藤さんの報告書づくりの補助として、次の資料の取りまとめをお願いできますか。\n\n・協力会社16社の10月分 請求書（写し）と注文書の金額一覧\n・出来高査定の根拠写真（工区ごとに数枚）\n・前月からの増減が大きい会社のメモ\n\n報告書本体は佐藤さんにお願いしています。\n資料は本社サーバーの出来高フォルダ（港南三丁目）に入れてください。${SIG_KATO}`,
    at: '2026-11-09T10:00', labels: ['lbl-honsha'], readBy: [TAKA], starredBy: [TAKA],
  },
  {
    key: 'dk-taka-interim', thread: 'dk-taka',
    from: who(TAKA), to: [KATO], cc: [],
    subject: 'Re: 港南三丁目 10月分 出来高資料の取りまとめのお願い（11/11 17時締切）',
    body: `加藤課長\n\nお疲れ様です。港南三丁目作業所の高橋です。\n\nご依頼の件、承知いたしました。途中経過をご報告いたします。\n\n・請求書の写しと注文書の金額一覧：16社中14社分 作成済み\n　（富士空調システム様は宛名の誤りで再発行依頼中、三光電設様は金額を経理の西田さんと確認中）\n・根拠写真：1工区・2工区分は格納済み。3工区・外構は本日夕方に格納します\n\n明日中にそろえて、佐藤さんにお渡しします。${SIG_TAKA}`,
    at: '2026-11-10T12:00', labels: ['lbl-honsha'], readBy: [KATO],
  },
  {
    key: 'dk-taka-check', thread: 'dk-taka',
    from: who(KATO), to: [TAKA], cc: [],
    subject: 'Re: 港南三丁目 10月分 出来高資料の取りまとめのお願い（11/11 17時締切）',
    body: `高橋さん\n\nお疲れ様です。加藤です。\n途中経過ありがとうございます。\n\n本日17時が締切ですので、資料のほうの状況を教えてください。\n報告書本体は佐藤さんから届く予定で待っています。${SIG_KATO}`,
    at: '2026-11-11T09:40', labels: ['lbl-honsha'], readBy: [TAKA],
  },
  {
    key: 'dk-taka-status', thread: 'dk-taka',
    from: who(TAKA), to: [KATO], cc: [],
    subject: 'Re: 港南三丁目 10月分 出来高資料の取りまとめのお願い（11/11 17時締切）',
    body: `加藤課長\n\nお疲れ様です。高橋です。\n\n資料の状況をご報告いたします。\n・請求書・注文書の金額一覧：16社分 そろいました（富士空調システム様は再発行前の金額で仮置きしています）\n・根拠写真：全工区分 格納済みです\n\n本社サーバーの出来高フォルダ（港南三丁目）に格納いたしました。\n報告書の体裁と添付の確認は、本日午後に佐藤さんと進めます。${SIG_TAKA}`,
    at: '2026-11-11T11:50', labels: ['lbl-honsha'], readBy: [],
  },
  {
    key: 'teiden-todokede', thread: 'teiden-todokede',
    from: who(TAKA), to: [KATO], cc: ['u-yamamoto'],
    subject: '11/15（日）全館停電に伴う本社への届出（案）の送付',
    body: `加藤課長\n（cc：山本所長）\n\nお疲れ様です。港南三丁目作業所の高橋です。\n\n昨日の工程定例で、11/15（日）8:00〜12:00 に受変電設備の切替のため全館停電とすることが決まりました。\n本社への届出（休日作業・停電作業）の案を下に記載いたします。\n\n----\n・日時：11月15日（日）8:00〜12:00\n・内容：受変電設備の切替（三光電設）\n・影響：全館停電。仮設照明・仮設エレベーターは停止\n・休日作業：三光電設 6名、元請 2名（佐藤、中村）\n----\n\n内容に問題がなければ、所長の確認後に正式に提出いたします。${SIG_TAKA}`,
    at: '2026-11-11T09:30', labels: ['lbl-honsha'], readBy: [KATO, 'u-yamamoto'],
  },
  // ---------------- 高橋：協力会社からの安全書類・請求書 ----------------
  {
    key: 'meibo-aoba', thread: 'meibo-aoba',
    from: who('u-hayashi'), to: [TAKA], cc: [],
    subject: '作業員名簿（更新版）の提出について',
    body: `東都建設 高橋様\n\nお疲れ様です。青葉設備工業の林です。\n\n作業員名簿を更新しました。配管工を1名追加しています（計3名）。\n更新版はグリーンサイトに登録済みです。\n\nご確認よろしくお願いします。\n\n青葉設備工業 林`,
    at: '2026-10-29T09:30', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'meibo-tobi', thread: 'meibo-tobi',
    from: who('u-matsumoto'), to: [TAKA], cc: [],
    subject: '名簿更新',
    body: `高橋さん\n\nお疲れ様です。北斗鳶の松本です。\n名簿、1名追加で更新しました。システムに上げてあります。\n\n松本`,
    at: '2026-11-11T12:05', labels: ['lbl-shorui'], readBy: [],
  },
  {
    key: 'shinki-floor', thread: 'shinki-floor',
    from: who('u-nakajima'), to: [TAKA], cc: [],
    subject: '新規入場者の書類について（2名）',
    body: `高橋様\n\nお世話になっております😊 山王インテリアの中島です。\n\n11/16（月）から 5F のクロス・床仕上げで、新しく2名が入場する予定です。\n新規入場者の書類（作業員名簿・健康診断の写し・資格証）は、どちらにお送りすればよいでしょうか？\nまた、新規入場者教育の日程も教えていただけると助かります🙏\n\nどうぞよろしくお願いいたします！\n\n山王インテリア株式会社\n中島 由美`,
    at: '2026-11-04T13:30', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'shinki-floor-re', thread: 'shinki-floor',
    from: who(TAKA), to: ['u-nakajima'], cc: [],
    subject: 'Re: 新規入場者の書類について（2名）',
    body: `山王インテリア 中島様\n\nお世話になっております。東都建設 港南三丁目作業所の高橋です。\n\n書類は、このメールアドレス宛てにPDFでお送りください（原本は不要です）。\n新規入場者教育は、11/12（木）13:00〜14:00、現場事務所2Fで実施する予定です。\n正式なご案内は来週お送りいたします。\n\nどうぞよろしくお願いいたします。${SIG_TAKA}`,
    at: '2026-11-04T16:00', labels: ['lbl-shorui'], readBy: ['u-nakajima'],
  },
  {
    key: 'shinki-bousui', thread: 'shinki-bousui',
    from: who('u-mori'), to: [TAKA], cc: [],
    subject: '屋上防水 着工に伴う作業員名簿・資格証の提出',
    body: `東都建設 高橋様\n\nお世話になっております。日進防水の森です。\n\n屋上防水の着工（11/16（月）〜 下地調整）に伴い、作業員4名分の書類を提出します。\n・作業員名簿（4名）\n・有機溶剤作業主任者 技能講習 修了証の写し（1名）\n・健康診断の結果（4名）\n\nグリーンサイトにも登録しました。\n4名とも初めての入場になりますので、新規入場者教育の受講をお願いいたします。\n\n日進防水株式会社\n森 健太`,
    at: '2026-11-05T10:20', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'shinki-crane', thread: 'shinki-crane',
    from: who('u-fujita'), to: [TAKA], cc: [],
    subject: 'オペレーター・玉掛け者の入場書類（11/18 仮押さえ分）',
    body: `東都建設 高橋様\n\nお世話になっております。大江戸クレーンの藤田です。\n\n11/18（水）の25tラフター（現在は仮押さえ中）について、\n確定した場合に備えて、オペレーター1名・玉掛け者2名の書類を先にお送りします。\n・移動式クレーン運転士免許証の写し\n・玉掛け技能講習 修了証の写し\n・作業員名簿\n\n新規入場者教育は事前に受けておいたほうがよろしいでしょうか。\n\n大江戸クレーン 藤田`,
    at: '2026-11-06T10:40', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'kyoiku-annai', thread: 'kyoiku-annai',
    from: who(TAKA), to: ['u-mori', 'u-nakajima', 'u-fujita'], cc: ['u-ito'],
    subject: '新規入場者教育のご案内（11/12（木）13:00〜 現場事務所2F）',
    body: `協力会社 ご担当者様\n\nお世話になっております。東都建設 港南三丁目作業所の高橋です。\n\n来週以降に新しく入場される方を対象に、新規入場者教育を下記のとおり実施いたします。\n\n・日時：11月12日（木）13:00〜14:00\n・場所：現場事務所 2F 会議室\n・講師：東都建設 伊藤（工事担当・安全）\n・持ち物：ヘルメット、筆記用具、資格証の原本（お持ちの方）\n\n受講される方のお名前を、11/11（水）中に返信でお知らせください。\n当日は西ゲートからお入りいただき、事務所1Fの受付にお声がけください。\n\nどうぞよろしくお願いいたします。${SIG_TAKA}`,
    at: '2026-11-09T16:30', labels: ['lbl-shorui'], readBy: ['u-ito', 'u-mori', 'u-nakajima'],
  },
  {
    key: 'kyoiku-junbi', thread: 'kyoiku-junbi',
    from: who('u-ito'), to: [TAKA], cc: [],
    subject: '11/12 新規入場者教育の準備のお願い',
    body: `高橋さん\n\nお疲れ様です。伊藤です。\n\n明後日の新規入場者教育の準備をお願いします。\n・受講者：現時点で12名（日進防水 4名、山王インテリア 2名、大江戸クレーン 3名、東邦内装 2名、三光電設 1名）\n・資料：現場ルール説明資料（最新版）、受講者アンケート、ヘルメット用シール\n・会議室のプロジェクター確認\n\n11/15 の全館停電のことも説明に入れたいので、周知文が固まったら資料の最後に1枚足してください。\n\n伊藤`,
    at: '2026-11-10T09:15', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'seikyu-tosou', thread: 'seikyu-tosou',
    from: who('u-yamaguchi'), to: [TAKA], cc: [],
    subject: '10月分 ご請求書送付のご案内',
    body: `東都建設株式会社\n港南三丁目作業所 高橋様\n\nいつも大変お世話になっております。\n光陽塗装の山口でございます。\n\n10月分のご請求書を、本日郵送にてお送りいたしました。\n出来高明細も同封しております。\nお手数をおかけいたしますが、ご査収のほどよろしくお願い申し上げます。\n\n光陽塗装株式会社\n山口 誠`,
    at: '2026-10-30T14:00', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'seikyu-denki', thread: 'seikyu-denki',
    from: who('u-inoue'), to: [TAKA], cc: [],
    subject: '10月分 請求書',
    body: `高橋さん\n\nお疲れ様です。三光電設 井上です。\n10月分の請求書、郵送しました。\n7F 幹線のケーブルラック追加分も入れてあります。\n\nよろしくお願いします。\n\n三光電設 井上`,
    at: '2026-11-02T09:10', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'seikyu-kucho', thread: 'seikyu-kucho',
    from: who('u-kimura'), to: [TAKA], cc: [],
    subject: '10月分 請求書 再発行のお願い（宛名の誤り）',
    body: `東都建設 高橋様\n\nお世話になっております。富士空調の木村です。\n\nご指摘いただいた10月分の請求書の宛名（作業所名の誤り）の件、\n大変失礼いたしました。再発行したものを本日郵送いたします。\n金額は変更ございません。\n\n誤った請求書は、お手数ですが破棄していただけますでしょうか。\n\n富士空調システム株式会社\n木村 聡`,
    at: '2026-11-11T10:30', labels: ['lbl-shorui'], readBy: [],
  },
  {
    key: 'parking-naiso', thread: 'parking-naiso',
    from: who('u-shimizu'), to: [TAKA], cc: [],
    subject: '駐車場の利用申請（来週から1台追加）',
    body: `高橋さん\n\nお疲れ様です。東邦内装 清水です。\n来週（11/16〜）から応援が入るので、駐車場をもう1台お願いしたいです。\n・期間：11/16〜11/27\n・車両：ハイエース（品川 400 さ 56-78）\n\n申請書いりますか？\n\n清水`,
    at: '2026-11-10T13:40', labels: ['lbl-shorui'], readBy: [TAKA],
  },
  {
    key: 'taikai-meibo', thread: 'taikai-meibo',
    from: who('u-saito'), to: [TAKA], cc: [],
    subject: '年末安全大会 協力会社 参加者名簿の取りまとめのお願い（11/20まで）',
    body: `港南三丁目作業所 高橋様\n\nお疲れ様です。安全環境部の斎藤です。\n\n12/4（金）の年末安全大会について、作業所としての出欠は佐藤さんからご回答いただく予定と伺っております。\nそれとは別に、協力会社の職長代表の参加者名簿（会社名・氏名・オンライン/会場）を、\n11/20（金）までに取りまとめていただけますでしょうか。\n\n様式は社内ポータルの「安全環境部」のページにあります。\n\n安全環境部 斎藤`,
    at: '2026-11-11T11:20', labels: ['lbl-shorui'], readBy: [],
  },
  // ---------------- 高橋：経理 西田さん ----------------
  {
    key: 'shiharai-10', thread: 'shiharai-10',
    from: who('u-nishida'), to: [TAKA], cc: [],
    subject: '10月分 支払い処理のスケジュール（作業所分）',
    body: `港南三丁目作業所 高橋さん\n\nお疲れ様です。経理部の西田です。\n\n10月分（10/25締め）の協力会社への支払いについて、今月のスケジュールです。\n\n・11/4（水）：作業所の検収済み請求書を経理へ回付\n・11/17（火）：支払い明細の確認（作業所と経理）\n・11/30（月）：支払日\n\n請求書が届いていない会社があれば、早めに教えてください。${SIG_NISHIDA}`,
    at: '2026-10-28T10:00', labels: ['lbl-keiri'], readBy: [TAKA],
  },
  {
    key: 'soui-denki', thread: 'soui-denki',
    from: who('u-nishida'), to: [TAKA], cc: [],
    subject: '三光電設様 10月分 請求額と注文書の相違について',
    body: `高橋さん\n\nお疲れ様です。西田です。\n\n三光電設様の10月分の請求書ですが、注文書の金額より 286,000円（税抜）多くなっています。\n明細を見ると「7F 幹線 ケーブルラック 追加」とあるのですが、これに対応する追加の注文書が見当たりません。\n\n追加注文の手続きがどうなっているか、ご確認いただけますでしょうか。${SIG_NISHIDA}`,
    at: '2026-11-09T10:30', labels: ['lbl-keiri'], readBy: [TAKA],
  },
  {
    key: 'soui-denki-re', thread: 'soui-denki',
    from: who(TAKA), to: ['u-nishida'], cc: [],
    subject: 'Re: 三光電設様 10月分 請求額と注文書の相違について',
    body: `西田さん\n\nお疲れ様です。高橋です。\n\n三光電設の井上さんに確認いたしました。\n7F 幹線のケーブルラックの追加は、現場で口頭で指示を受けて施工したものとのことです。\n追加の注文書は、作業所で発行の手続き中です（今週中に回付いたします）。\n\nそれまでは、注文書の金額の分だけ先に支払い処理をお願いできますでしょうか。${SIG_TAKA}`,
    at: '2026-11-10T11:00', labels: ['lbl-keiri'], readBy: ['u-nishida'],
  },
  {
    key: 'seikyu-11', thread: 'seikyu-11',
    from: who('u-nishida'), to: [TAKA], cc: [],
    subject: '11月分 請求書の締め（11/25）と支払いスケジュール',
    body: `高橋さん\n\nお疲れ様です。西田です。\n\n11月分の請求書の締めは、11/25（水）です。\n協力会社への受付案内は、例月どおり作業所からお送りください（11/16頃を目安に）。\n\n・11/25（水）：請求書 締め（作業所必着）\n・12/2（水）：検収済み請求書を経理へ回付\n・12/30（水）：支払日（年末のため前倒し）\n\n年末は経理も混み合いますので、遅れそうな会社があれば早めにお知らせください。${SIG_NISHIDA}`,
    at: '2026-11-11T08:50', labels: ['lbl-keiri'], readBy: [TAKA],
  },
  // ---------------- 高橋：備品・事務所 ----------------
  {
    key: 'office-supply', thread: 'office-supply',
    from: ext('オフィスサプライ東京', 'order@office-supply.example'), to: [TAKA], cc: [],
    subject: '【ご注文確認】コピー用紙ほか 3点（お届け予定 11/2）',
    body: `東都建設株式会社 港南三丁目作業所\n高橋 由紀 様\n\nご注文ありがとうございます。\n\n・コピー用紙 A4（5箱）\n・トナー（複合機用 ブラック 2本）\n・ファイルボックス（10個）\n\nお届け予定：11月2日（月）午前\n\n※本メールは送信専用です。`,
    at: '2026-10-30T16:00', labels: [], readBy: [TAKA],
  },
  {
    key: 'parking-kanri', thread: 'parking-kanri',
    from: ext('港南パーキング 管理事務所', 'info@konan-parking.example'), to: [TAKA], cc: [],
    subject: '月極駐車場 12月分 契約台数のご確認（11/20まで）',
    body: `東都建設株式会社 港南三丁目作業所 ご担当者様\n\nいつもご利用ありがとうございます。\n12月分の契約台数（現在 12台）について、変更がある場合は11月20日（金）までにご連絡ください。\nご連絡がない場合は、同じ台数で更新いたします。\n\n港南パーキング 管理事務所`,
    at: '2026-11-05T15:00', labels: [], readBy: [TAKA],
  },
  {
    key: 'fukugoki', thread: 'fukugoki',
    from: ext('トーヨー事務機 サービス課', 'service@toyo-jimuki.example'), to: [TAKA], cc: [],
    subject: '複合機 定期保守点検のご案内（11/24）',
    body: `東都建設株式会社 港南三丁目作業所\n高橋 様\n\nいつもお世話になっております。\n複合機の定期保守点検を、11月24日（火）10:00〜11:00 に予定しております。\n点検中（約30分）はコピー・FAXがご利用いただけません。\n\nご都合が悪い場合はご連絡ください。\n\nトーヨー事務機 サービス課`,
    at: '2026-11-10T17:20', labels: [], readBy: [],
  },
];
mails.push(...extra.map((m) => ({ ...m, isNew: true })));

// ---- 組み立て ----
// 既存分（mail-001〜040・th-001〜033）は従来の並び順で番号を振り、追加分は mail-101〜・th-101〜
const byTime = (a, b) => a.at.localeCompare(b.at);
const oldMails = mails.filter((m) => !m.isNew).sort(byTime);
const newMails = mails.filter((m) => m.isNew).sort(byTime);
const threadIds = new Map();
let newThreadNo = 101;
const threadOf = (m) => {
  if (!threadIds.has(m.thread)) threadIds.set(m.thread, `th-${String(m.isNew ? newThreadNo++ : threadIds.size + 1).padStart(3, '0')}`);
  return threadIds.get(m.thread);
};
const uniq = (a) => [...new Set(a)];
function build(m, id) {
  const recipients = [...m.to, ...m.cc];
  // 旧データの read/starred は佐藤さん分。差出人は自分のメールを既読扱い
  const readBy = uniq([m.from.personId, ...(m.read && recipients.includes(ME) ? [ME] : []), ...(m.readBy ?? [])].filter(Boolean));
  const starredBy = uniq([...(m.starred ? [ME] : []), ...(m.starredBy ?? [])]);
  return {
    id,
    threadId: threadOf(m),
    from: m.from,
    to: m.to.map((x) => who(x)),
    cc: m.cc.map((x) => who(x)),
    subject: m.subject,
    body: m.body,
    receivedAt: `${m.at}:00+09:00`,
    labelIds: m.labels,
    readBy,
    starredBy,
    attachments: (m.attachments || []).map((fileId) => ({ fileId })),
  };
}
const out = [
  ...oldMails.map((m, i) => build(m, `mail-${String(i + 1).padStart(3, '0')}`)),
  ...newMails.map((m, i) => build(m, `mail-${String(i + 101).padStart(3, '0')}`)),
].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
const keyOf = new Map([...oldMails.map((m, i) => [`mail-${String(i + 1).padStart(3, '0')}`, m.key]), ...newMails.map((m, i) => [`mail-${String(i + 101).padStart(3, '0')}`, m.key])]);

// ---- 検証 ----
const demoNow = new Date(site.demoNow).getTime();
const start = new Date('2026-10-28T00:00:00+09:00').getTime();
const WD = '日月火水木金土';
const problems = [];
for (const m of out) {
  const t = new Date(m.receivedAt).getTime();
  if (Number.isNaN(t)) problems.push(`invalid date ${m.id}`);
  if (t > demoNow || t < start) problems.push(`out of range ${m.id} ${m.receivedAt}`);
  for (const a of [m.from, ...m.to, ...m.cc]) {
    if (a.personId && !people[a.personId]) problems.push(`${m.id}: bad personId ${a.personId}`);
    const byMail = site.people.find((p) => p.email === a.email);
    if (byMail && a.personId !== byMail.id) problems.push(`${m.id}: ${a.email} should carry personId ${byMail.id}`);
  }
  for (const u of [...m.readBy, ...m.starredBy]) if (!people[u]) problems.push(`${m.id}: bad readBy/starredBy ${u}`);
  if (m.labelIds.some((l) => l === 'inbox' || l === 'sent')) problems.push(`${m.id}: inbox/sent label`);
  // 曜日表記（11/18（水）・11月18日(水)・11/18 水曜 など）を 2026年のカレンダーで照合
  const text = `${m.subject}\n${m.body}`;
  const re = /(\d{1,2})(?:\/|月)(\d{1,2})日?\s*(?:[（(]\s*([日月火水木金土])\s*[）)]|([日月火水木金土])曜)/g;
  for (const x of text.matchAll(re)) {
    const [mo, d, w] = [Number(x[1]), Number(x[2]), x[3] ?? x[4]];
    const y = 2026; // データ期間は 2026-10〜12
    const real = WD[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
    if (real !== w) problems.push(`${m.id}: 「${x[0]}」→ 2026-${mo}-${d} は ${real}曜`);
  }
}
// ストーリーの防護：追加分は佐藤さんの受信トレイに入れない
for (const m of out.filter((x) => x.id >= 'mail-101')) {
  if ([...m.to, ...m.cc].some((a) => a.personId === ME)) problems.push(`${m.id}: 追加分が佐藤さんの受信トレイに入っている`);
}
// 日報メールの cc に高橋
for (const id of ['mail-014', 'mail-017', 'mail-030', 'mail-031', 'mail-032']) {
  const m = out.find((x) => x.id === id);
  if (!m.cc.some((a) => a.personId === TAKA)) problems.push(`${id}: cc に高橋がいない`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const data = {
  labels: [
    { id: 'important', name: '重要' },
    { id: 'lbl-site', name: '現場' },
    { id: 'lbl-nippo', name: '日報' },
    { id: 'lbl-honsha', name: '本社' },
    { id: 'lbl-oimachi', name: '大井町' },
    { id: 'lbl-keiri', name: '経理' },
    { id: 'lbl-shorui', name: '書類・請求' },
  ],
  messages: out,
};
writeFileSync(join(root, 'data/mail.json'), JSON.stringify(data, null, 2) + '\n');

const boxes = [ME, KATO, TAKA].map((u) => {
  const inbox = out.filter((m) => [...m.to, ...m.cc].some((a) => a.personId === u));
  const sent = out.filter((m) => m.from.personId === u);
  return `${people[u].name}: inbox ${inbox.length}（未読 ${inbox.filter((m) => !m.readBy.includes(u)).length}）, sent ${sent.length}`;
});
console.log(`mail.json: ${out.length} messages, ${threadIds.size} threads\n  ${boxes.join('\n  ')}`);
out.forEach((m) => console.log(`${m.id}  ${m.threadId}  ${m.receivedAt.slice(5, 16)}  ${keyOf.get(m.id)}  ${m.attachments.map((a) => a.fileId).join(',')}`));
