// 工事写真（パトロール指摘・是正・進捗）を「それっぽく」描画する。
// 実写の代わりに SVG で場面を描き、左下に工事黒板、右上に日付スタンプを入れる。
import { renderPng, esc, rng } from "./render.mjs";

const W = 1280, H = 960;
const VPY = 400; // 消失点の高さ

// ---- 室内の一点透視ヘルパー ----
// 床：u = -1(左)〜1(右)、v = 0(手前)〜1(奥の壁)
const fp = (u, v) => [640 + u * (640 - v * 220), 960 - v * 400];
// 左右の壁：h = 0(床)〜1(天井)、v = 奥行
const lw = (h, v) => [v * 420, 960 - v * 400 + h * (v * 250 - (960 - v * 400))];
const rw = (h, v) => [1280 - v * 420, 960 - v * 400 + h * (v * 250 - (960 - v * 400))];
const pts = (arr) => arr.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");

const DEFS = `
<defs>
  <linearGradient id="gCeil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e8e8e"/><stop offset="1" stop-color="#aaaaaa"/></linearGradient>
  <linearGradient id="gWallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a4a4a4"/><stop offset="1" stop-color="#c4c4c4"/></linearGradient>
  <linearGradient id="gWallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#9a9a9a"/><stop offset="1" stop-color="#bcbcbc"/></linearGradient>
  <linearGradient id="gBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cccccc"/><stop offset="1" stop-color="#bababa"/></linearGradient>
  <linearGradient id="gFloor" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#767676"/><stop offset="1" stop-color="#a0a0a0"/></linearGradient>
  <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa7cf"/><stop offset="1" stop-color="#d4e1ea"/></linearGradient>
  <linearGradient id="gRoof" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#707070"/><stop offset="1" stop-color="#9e9e9e"/></linearGradient>
  <linearGradient id="gSoil" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#6b5a45"/><stop offset="1" stop-color="#9a8a72"/></linearGradient>
  <linearGradient id="gPipe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e3dd"/><stop offset=".5" stop-color="#b9bab4"/><stop offset="1" stop-color="#7d7e78"/></linearGradient>
  <linearGradient id="gRed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8e1414"/><stop offset=".35" stop-color="#e03a2c"/><stop offset="1" stop-color="#7a1010"/></linearGradient>
  <linearGradient id="gBlack" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#111"/><stop offset=".35" stop-color="#4a4a4a"/><stop offset="1" stop-color="#0c0c0c"/></linearGradient>
  <linearGradient id="gBrown" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b2e17"/><stop offset=".35" stop-color="#8b5a2b"/><stop offset="1" stop-color="#3d2412"/></linearGradient>
  <linearGradient id="gAlu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9ea3a6"/><stop offset=".5" stop-color="#e8ecee"/><stop offset="1" stop-color="#8a8f92"/></linearGradient>
  <linearGradient id="gWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7aa6c"/><stop offset="1" stop-color="#b98a4e"/></linearGradient>
  <radialGradient id="gVig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
  <pattern id="pTiger" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" fill="#f2c80f"/><rect width="20" height="40" fill="#1a1a1a"/></pattern>
  <filter id="fBlot" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.02" numOctaves="3" seed="7"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.24  0 0 0 0 0.22  0 0 0 -1.6 1.05"/>
  </filter>
  <filter id="fSoft"><feGaussianBlur stdDeviation="6"/></filter>
</defs>`;

function room({ back = "", lights = true, ceilRibs = true } = {}) {
  let s = "";
  s += `<polygon points="${pts([[0, 0], [1280, 0], [860, 250], [420, 250]])}" fill="url(#gCeil)"/>`;
  if (ceilRibs) {
    for (let i = 0; i <= 16; i++) {
      const x0 = (i * 1280) / 16, x1 = 420 + (i * 440) / 16;
      s += `<line x1="${x0}" y1="0" x2="${x1}" y2="250" stroke="#6f7271" stroke-width="${3 - i * 0.05}" opacity=".55"/>`;
    }
  }
  s += `<polygon points="${pts([[0, 0], [420, 250], [420, 560], [0, 960]])}" fill="url(#gWallL)"/>`;
  s += `<polygon points="${pts([[1280, 0], [860, 250], [860, 560], [1280, 960]])}" fill="url(#gWallR)"/>`;
  s += `<rect x="420" y="250" width="440" height="310" fill="url(#gBack)"/>`;
  s += back;
  s += `<polygon points="${pts([[0, 960], [420, 560], [860, 560], [1280, 960]])}" fill="url(#gFloor)"/>`;
  // 床の汚れ・墨出し線
  s += `${stains(560, 960, 1)}`;
  s += `<line x1="${fp(-0.62, 0)[0]}" y1="960" x2="${fp(-0.62, 1)[0]}" y2="560" stroke="#3c4e7a" stroke-width="2" opacity=".45"/>`;
  s += `<line x1="${fp(0.15, 0.0)[0]}" y1="960" x2="${fp(0.15, 1)[0]}" y2="560" stroke="#3c4e7a" stroke-width="1.5" opacity=".35"/>`;
  if (lights) {
    for (const v of [0.18, 0.5, 0.78]) {
      const y = v * 250, hw = 70 - v * 40;
      s += `<rect x="${640 - hw}" y="${y + 6}" width="${hw * 2}" height="${10 - v * 6}" rx="3" fill="#fbfbf3"/>`;
      s += `<ellipse cx="640" cy="${y + 12}" rx="${hw * 2.2}" ry="${30 - v * 15}" fill="#fff" opacity=".18"/>`;
    }
  }
  return s;
}

// 床の汚れ（ぼかした楕円をいくつか。ノイズより PNG が軽い）
function stains(y0, y1, seed) {
  const r = rng(seed * 97 + 13);
  let out = "<g filter=\"url(#fSoft)\">";
  for (let i = 0; i < 9; i++) {
    const y = y0 + r() * (y1 - y0), k = (y - y0) / (y1 - y0);
    out += `<ellipse cx="${(r() * 1280).toFixed(0)}" cy="${y.toFixed(0)}" rx="${(40 + r() * 140 * (0.4 + k)).toFixed(0)}" ry="${(8 + r() * 40 * (0.3 + k)).toFixed(0)}" fill="${r() > 0.5 ? "#3d3a35" : "#d8d4ca"}" opacity="${(0.08 + r() * 0.12).toFixed(2)}"/>`;
  }
  return out + "</g>";
}

const vignette = `<rect width="${W}" height="${H}" fill="url(#gVig)"/>`;

function cone(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <rect x="-34" y="-6" width="68" height="12" rx="2" fill="#c8380f"/>
    <polygon points="-24,-6 24,-6 8,-110 -8,-110" fill="#ee5a1f"/>
    <polygon points="-17,-40 17,-40 13,-60 -13,-60" fill="#f4f4f0"/>
    <polygon points="-12,-80 12,-80 10,-94 -10,-94" fill="#f4f4f0"/>
  </g>`;
}

// ---- 場面 ----
const SCENES = {
  // ① 2F 東側 床開口部の養生不足
  opening() {
    let s = room({ back: `<rect x="560" y="330" width="160" height="230" fill="#b4b0a6"/><rect x="566" y="336" width="148" height="224" fill="#77736b"/>` });
    const D = 0.32; // 黒板に隠れないよう右寄せ
    const hole = [fp(-0.3 + D, 0.22), fp(0.3 + D, 0.22), fp(0.27 + D, 0.5), fp(-0.26 + D, 0.5)];
    s += `<polygon points="${pts(hole)}" fill="#1b1b1a"/>`;
    s += `<polygon points="${pts([fp(-0.26 + D, 0.5), fp(0.27 + D, 0.5), fp(0.275 + D, 0.46), fp(-0.265 + D, 0.46)])}" fill="#5b5953"/>`;
    s += `<polygon points="${pts([fp(-0.22 + D, 0.42), fp(0.15 + D, 0.42), fp(0.15 + D, 0.3), fp(-0.24 + D, 0.3)])}" fill="#3a3936" opacity=".7"/>`;
    // ずれたコンパネ（半分しか覆っていない）
    s += `<polygon points="${pts([fp(0.12 + D, 0.16), fp(0.68 + D, 0.19), fp(0.62 + D, 0.46), fp(0.1 + D, 0.44)])}" fill="url(#gWood)" stroke="#8d6532" stroke-width="2"/>`;
    s += `<polygon points="${pts([fp(0.12 + D, 0.16), fp(0.68 + D, 0.19), fp(0.68 + D, 0.16), fp(0.12 + D, 0.13)])}" fill="#8a6230"/>`;
    s += cone(fp(-0.22, 0.68)[0], fp(-0.22, 0.68)[1], 0.8);
    s += `<g transform="translate(${fp(-0.05, 0.6)[0]},${fp(-0.05, 0.6)[1]}) rotate(-80) scale(.85)"><rect x="-34" y="-6" width="68" height="12" fill="#c8380f"/><polygon points="-24,-6 24,-6 8,-110 -8,-110" fill="#ee5a1f"/><polygon points="-17,-40 17,-40 13,-60 -13,-60" fill="#f4f4f0"/></g>`;
    s += `<rect x="760" y="600" width="140" height="20" fill="#9c9f9b" transform="rotate(-6 830 610)"/>`;
    return s;
  },
  openingFixed() {
    let s = room({ back: `<rect x="560" y="330" width="160" height="230" fill="#b4b0a6"/><rect x="566" y="336" width="148" height="224" fill="#77736b"/>` });
    const D = 0.34;
    s += `<polygon points="${pts([fp(-0.4 + D, 0.19), fp(0.36 + D, 0.19), fp(0.32 + D, 0.53), fp(-0.34 + D, 0.53)])}" fill="url(#gWood)" stroke="#8d6532" stroke-width="3"/>`;
    s += `<polygon points="${pts([fp(-0.4 + D, 0.19), fp(0.36 + D, 0.19), fp(0.36 + D, 0.16), fp(-0.4 + D, 0.16)])}" fill="#8a6230"/>`;
    for (let i = 0; i < 6; i++) for (const v of [0.22, 0.36, 0.5]) {
      const [x, y] = fp(-0.36 + D + i * 0.135, v);
      s += `<circle cx="${x}" cy="${y}" r="2.6" fill="#555"/>`;
    }
    const [tx, ty] = fp(-0.02 + D, 0.36);
    s += `<text x="${tx}" y="${ty / 1.45}" font-family="Meiryo" font-weight="bold" font-size="60" fill="#d21f1f" opacity=".85" text-anchor="middle" transform="scale(1,1.45)" style="letter-spacing:6px">開口注意</text>`;
    // トラ柵
    const posts = [fp(-0.55 + D, 0.12), fp(0.52 + D, 0.12), fp(0.46 + D, 0.6), fp(-0.47 + D, 0.6)];
    const bar = (a, b, w) => `<line x1="${a[0]}" y1="${a[1] - 70 * w}" x2="${b[0]}" y2="${b[1] - 70 * w}" stroke="url(#pTiger)" stroke-width="${16 * w}"/>`;
    s += bar(posts[3], posts[2], 0.75);
    s += cone(posts[3][0], posts[3][1], 0.75) + cone(posts[2][0], posts[2][1], 0.75);
    s += bar(posts[0], posts[3], 0.95) + bar(posts[1], posts[2], 0.95);
    s += bar(posts[0], posts[1], 1.15);
    s += cone(posts[0][0], posts[0][1], 1.15) + cone(posts[1][0], posts[1][1], 1.15);
    return s;
  },
  // ② 3F 廊下 消火器の前に資材仮置き（右側の壁）
  extinguisher(cleared = false) {
    let s = room({ back: `<rect x="600" y="300" width="80" height="260" fill="#8a8c88"/><rect x="420" y="250" width="440" height="20" fill="#9a968e"/>` });
    // 壁の消火器標識
    const [sx, sy] = rw(0.62, 0.42);
    s += `<polygon points="${pts([[sx + 40, sy - 4], [sx - 40, sy + 16], [sx - 40, sy + 66], [sx + 40, sy + 54]])}" fill="#d42222"/>`;
    s += `<text x="${sx}" y="${sy + 46}" font-family="Meiryo" font-weight="bold" font-size="25" fill="#fff" text-anchor="middle" transform="rotate(-12 ${sx} ${sy + 40})">消火器</text>`;
    // 消火器
    const [ex, ey] = rw(0, 0.4);
    const bx = ex - 24, by = ey - 8;
    s += `<ellipse cx="${bx}" cy="${by}" rx="40" ry="9" fill="#000" opacity=".25"/>`;
    s += `<rect x="${bx - 32}" y="${by - 170}" width="64" height="170" rx="20" fill="url(#gRed)"/>`;
    s += `<rect x="${bx - 14}" y="${by - 196}" width="28" height="30" fill="#2b2b2b"/>`;
    s += `<path d="M${bx - 10} ${by - 186} q -50 10 -34 90" stroke="#111" stroke-width="7" fill="none"/>`;
    s += `<rect x="${bx - 24}" y="${by - 120}" width="48" height="50" fill="#f1efe6"/>`;
    s += `<text x="${bx}" y="${by - 88}" font-family="Meiryo" font-size="14" fill="#c11" text-anchor="middle" font-weight="bold">ABC</text>`;
    if (!cleared) {
      // 石膏ボードの束と段ボール（消火器の手前をふさいでいる）
      for (let i = 0; i < 7; i++) {
        const y = 900 - i * 14;
        s += `<polygon points="${pts([[1250, y], [760, y - 70], [760, y - 82], [1250, y - 12]])}" fill="${i % 2 ? "#e8e6df" : "#d9d7cf"}" stroke="#aaa69c" stroke-width="1"/>`;
      }
      s += `<polygon points="${pts([[1250, 818], [760, 748], [760, 736], [1250, 806]])}" fill="#f0eee8"/>`;
      s += `<rect x="920" y="880" width="120" height="22" fill="#3b6fb0" transform="skewY(8)"/>`;
      s += `<rect x="930" y="600" width="180" height="140" fill="#b98b52" stroke="#8e6538" stroke-width="2"/>`;
      s += `<rect x="950" y="515" width="150" height="95" fill="#c69a60" stroke="#8e6538" stroke-width="2"/>`;
      s += `<line x1="930" y1="670" x2="1110" y2="670" stroke="#a87c45" stroke-width="10" opacity=".6"/>`;
      s += `<text x="1020" y="570" font-family="Meiryo" font-size="20" fill="#5b3d1c" text-anchor="middle">ﾗﾝﾅｰ 65</text>`;
    } else {
      // 床に「物置禁止」の区画表示と立て看板
      const z = [fp(0.55, 0.3), fp(0.95, 0.3), fp(0.9, 0.52), fp(0.52, 0.52)];
      s += `<polygon points="${pts(z)}" fill="none" stroke="#f2c80f" stroke-width="10"/>`;
      s += `<polygon points="${pts(z)}" fill="none" stroke="#1a1a1a" stroke-width="10" stroke-dasharray="18 18"/>`;
      const [px, py] = fp(0.35, 0.42);
      s += `<line x1="${px - 40}" y1="${py}" x2="${px - 30}" y2="${py - 150}" stroke="#555" stroke-width="5"/><line x1="${px + 40}" y1="${py}" x2="${px + 30}" y2="${py - 150}" stroke="#555" stroke-width="5"/>`;
      s += `<rect x="${px - 70}" y="${py - 200}" width="140" height="90" fill="#fff" stroke="#c11" stroke-width="5"/>`;
      s += `<text x="${px}" y="${py - 162}" font-family="Meiryo" font-weight="bold" font-size="22" fill="#c11" text-anchor="middle">消火器前</text>`;
      s += `<text x="${px}" y="${py - 130}" font-family="Meiryo" font-weight="bold" font-size="22" fill="#c11" text-anchor="middle">物置禁止</text>`;
    }
    return s;
  },
  // ③ 6F 脚立の天板に乗って作業
  ladder() {
    let s = room({ back: `<rect x="420" y="270" width="440" height="10" fill="#999"/>` });
    // ケーブルラック
    s += `<polygon points="${pts([[0, 120], [1280, 120], [1280, 150], [0, 150]])}" fill="#b8bcbe"/>`;
    for (let x = 20; x < 1280; x += 60) s += `<rect x="${x}" y="120" width="8" height="30" fill="#8c9093"/>`;
    for (let x = 100; x < 1280; x += 300) s += `<rect x="${x}" y="0" width="8" height="125" fill="#7e8285"/>`;
    // 脚立（A型）
    s += `<line x1="540" y1="900" x2="610" y2="520" stroke="url(#gAlu)" stroke-width="16"/>`;
    s += `<line x1="740" y1="900" x2="670" y2="520" stroke="url(#gAlu)" stroke-width="16"/>`;
    s += `<line x1="590" y1="880" x2="625" y2="525" stroke="#9ea3a6" stroke-width="12"/>`;
    s += `<line x1="690" y1="880" x2="655" y2="525" stroke="#9ea3a6" stroke-width="12"/>`;
    for (let i = 1; i < 6; i++) {
      const y = 900 - i * 64, k = (900 - y) / 380;
      s += `<line x1="${540 + 70 * k}" y1="${y}" x2="${740 - 70 * k}" y2="${y}" stroke="#c9cdd0" stroke-width="9"/>`;
    }
    s += `<rect x="596" y="508" width="88" height="18" rx="3" fill="#d84a1e"/>`;
    // 作業員（天板の上に立っている）
    s += `<rect x="606" y="360" width="30" height="150" rx="8" fill="#2c3a5a"/><rect x="644" y="360" width="30" height="150" rx="8" fill="#2c3a5a"/>`;
    s += `<rect x="600" y="500" width="40" height="14" rx="5" fill="#222"/><rect x="642" y="500" width="40" height="14" rx="5" fill="#222"/>`;
    s += `<rect x="592" y="220" width="96" height="150" rx="22" fill="#34466c"/>`;
    s += `<rect x="592" y="300" width="96" height="16" fill="#e6c31c"/>`;
    s += `<path d="M600 240 L560 150" stroke="#34466c" stroke-width="26" stroke-linecap="round"/><path d="M680 240 L700 150" stroke="#34466c" stroke-width="26" stroke-linecap="round"/>`;
    s += `<circle cx="640" cy="196" r="34" fill="#d9b28c"/>`;
    s += `<path d="M600 192 a40 38 0 0 1 80 0 z" fill="#f5f5f0"/><rect x="596" y="188" width="88" height="9" rx="4" fill="#f5f5f0"/>`;
    s += `<text x="640" y="182" font-family="Meiryo" font-size="13" font-weight="bold" fill="#c8a000" text-anchor="middle">三光</text>`;
    return s;
  },
  // ④ 外部 東面 5層目 足場の手すり外れ
  scaffold() {
    let s = `<rect width="${W}" height="${H}" fill="url(#gSky)"/>`;
    s += `<g transform="translate(0,0)">`;
    s += `<rect x="0" y="40" width="1280" height="920" fill="#c9c6bd"/>`;
    for (let y = 40; y < 960; y += 60) s += `<line x1="0" y1="${y}" x2="1280" y2="${y}" stroke="#a9a69e" stroke-width="2"/>`;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s += `<rect x="${60 + c * 320}" y="${90 + r * 230}" width="220" height="130" fill="#46596b"/><rect x="${60 + c * 320}" y="${90 + r * 230}" width="220" height="130" fill="#fff" opacity=".08"/>`;
    // メッシュシート
    s += `<rect x="0" y="40" width="1280" height="920" fill="#5f8a78" opacity=".28"/>`;
    for (let x = 0; x < 1280; x += 14) s += `<line x1="${x}" y1="40" x2="${x}" y2="960" stroke="#355a4b" stroke-width="1" opacity=".18"/>`;
    // 足場（層ごと）
    const layers = [{ y: 920, n: 3 }, { y: 690, n: 4 }, { y: 460, n: 5 }, { y: 230, n: 6 }];
    const cols = [90, 470, 850, 1230];
    for (const L of layers) {
      s += `<rect x="0" y="${L.y}" width="1280" height="18" fill="#7f8487"/><rect x="0" y="${L.y + 18}" width="1280" height="6" fill="#4d5153"/>`;
      s += `<rect x="0" y="${L.y - 8}" width="1280" height="8" fill="#9aa0a2"/>`; // 幅木
      const rail = L.y - 150, mid = L.y - 80;
      for (let i = 0; i < cols.length - 1; i++) {
        const broken = L.n === 5 && i === 1;
        if (!broken) {
          s += `<line x1="${cols[i]}" y1="${rail}" x2="${cols[i + 1]}" y2="${rail}" stroke="#b9bec0" stroke-width="9"/>`;
        } else {
          s += `<line x1="${cols[i]}" y1="${rail}" x2="${cols[i] + 250}" y2="${L.y - 18}" stroke="#b9bec0" stroke-width="9"/>`;
          s += `<rect x="${cols[i] - 10}" y="${rail - 10}" width="22" height="20" fill="#5d6264"/>`;
          s += `<rect x="${cols[i + 1] - 12}" y="${rail - 10}" width="22" height="20" fill="#5d6264"/>`;
        }
        s += `<line x1="${cols[i]}" y1="${mid}" x2="${cols[i + 1]}" y2="${mid}" stroke="#adb2b4" stroke-width="7"/>`;
        // ブレース
        s += `<line x1="${cols[i]}" y1="${L.y}" x2="${cols[i + 1]}" y2="${L.y - 230}" stroke="#8d9294" stroke-width="5" opacity=".7"/>`;
      }
    }
    for (const x of cols) s += `<rect x="${x - 8}" y="0" width="16" height="960" fill="#a3a8aa"/><rect x="${x - 8}" y="0" width="5" height="960" fill="#d6dadb"/>`;
    s += `<rect x="${cols[1] + 14}" y="300" width="56" height="34" fill="#f2c80f"/><text x="${cols[1] + 42}" y="324" font-family="Meiryo" font-weight="bold" font-size="20" text-anchor="middle" fill="#222">5層</text>`;
    s += `</g>`;
    return s;
  },
  // ⑤ 1F 電気室前 通路に仮設ケーブル散乱
  cables(tidy = false) {
    let back = `<rect x="560" y="330" width="170" height="230" fill="#8c9296" stroke="#5f6468" stroke-width="5"/><circle cx="710" cy="450" r="7" fill="#444"/>`;
    back += `<rect x="580" y="290" width="130" height="34" fill="#fff" stroke="#333" stroke-width="2"/><text x="645" y="315" font-family="Meiryo" font-weight="bold" font-size="22" text-anchor="middle" fill="#111">電気室</text>`;
    back += `<rect x="590" y="370" width="110" height="60" fill="#f2c80f"/><text x="645" y="395" font-family="Meiryo" font-weight="bold" font-size="13" text-anchor="middle" fill="#111">関係者以外</text><text x="645" y="417" font-family="Meiryo" font-weight="bold" font-size="13" text-anchor="middle" fill="#111">立入禁止</text>`;
    back += `<rect x="440" y="300" width="70" height="120" fill="#d6d6cf" stroke="#999"/><rect x="452" y="318" width="46" height="18" fill="#2f6e3a"/>`;
    let s = room({ back });
    if (!tidy) {
      const cs = [
        ["#151515", 16, "M -20 820 C 200 760, 300 940, 520 860 S 820 700, 700 640 S 560 600, 640 575"],
        ["#e06a12", 12, "M 1300 760 C 1000 820, 900 700, 700 760 S 380 900, 260 720 S 420 620, 520 590"],
        ["#2c2c2c", 14, "M 1300 900 C 1100 850, 1020 980, 820 900 S 560 720, 760 690 S 900 640, 800 600"],
        ["#3a3a3a", 10, "M 80 960 C 160 820, 420 800, 560 760 S 760 820, 900 760 S 1080 640, 1180 700"],
        ["#e06a12", 9, "M 420 960 C 500 860, 380 780, 520 700 S 700 720, 640 660"],
      ];
      for (const [c, w, d] of cs) s += `<path d="${d}" stroke="#000" stroke-width="${w + 4}" fill="none" opacity=".25" transform="translate(4,6)"/><path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
      // ケーブルドラム
      s += `<ellipse cx="1080" cy="760" rx="90" ry="110" fill="#a8783f" stroke="#7a5426" stroke-width="6"/><ellipse cx="1080" cy="760" rx="34" ry="42" fill="#1c1c1c"/><circle cx="1080" cy="760" r="12" fill="#a8783f"/>`;
    } else {
      // 壁沿いに吊ったケーブル
      for (let k = 0; k < 3; k++) {
        const a = rw(0.62 - k * 0.03, 0.02), b = rw(0.62 - k * 0.03, 0.98);
        s += `<path d="M ${a[0]} ${a[1]} Q ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + 30} ${b[0]} ${b[1]}" stroke="${k === 1 ? "#e06a12" : "#1d1d1d"}" stroke-width="${12 - k * 2}" fill="none"/>`;
      }
      for (const v of [0.1, 0.35, 0.6, 0.85]) {
        const p = rw(0.66, v);
        s += `<path d="M ${p[0]} ${p[1] - 20} v 26 q 0 12 -12 12" stroke="#d8d8d0" stroke-width="5" fill="none"/>`;
      }
      // ケーブルプロテクター
      s += `<polygon points="${pts([fp(-1, 0.55), fp(1, 0.55), fp(1, 0.62), fp(-1, 0.62)])}" fill="#f2c80f"/>`;
      s += `<polygon points="${pts([fp(-1, 0.57), fp(1, 0.57), fp(1, 0.6), fp(-1, 0.6)])}" fill="#1a1a1a" opacity=".55"/>`;
    }
    return s;
  },
  // ⑥ 屋上 ガスボンベの転倒防止なし
  roof({ cylinders = true, frames = 2, fx = 700 } = {}) {
    let s = `<rect width="${W}" height="${H}" fill="url(#gSky)"/>`;
    s += `<g fill="#9aa4ad">` + [[0, 300, 120], [130, 330, 90], [240, 280, 70], [330, 340, 160], [520, 300, 110], [660, 260, 80], [760, 320, 140], [920, 290, 90], [1030, 330, 250]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${460 - y}"/>`).join("") + `</g>`;
    s += `<rect x="0" y="390" width="1280" height="80" fill="#b3b0a8"/><rect x="0" y="390" width="1280" height="10" fill="#d1cec6"/>`;
    s += `<line x1="0" y1="352" x2="1280" y2="352" stroke="#8f9496" stroke-width="7"/>`;
    for (let x = 40; x < 1280; x += 160) s += `<line x1="${x}" y1="352" x2="${x}" y2="392" stroke="#8f9496" stroke-width="6"/>`;
    s += `<polygon points="0,470 1280,470 1280,960 0,960" fill="url(#gRoof)"/>`;
    s += `${stains(480, 960, 2)}`;
    for (let i = -6; i <= 6; i++) s += `<line x1="${640 + i * 60}" y1="470" x2="${640 + i * 260}" y2="960" stroke="#5c5f5d" stroke-width="2" opacity=".35"/>`;
    // 室外機架台（鋼製）
    for (let k = 0; k < frames; k++) {
      const x = fx + k * 260, y = 640 - k * 30, w = 220 - k * 30, h = 70 - k * 8;
      s += `<rect x="${x}" y="${y}" width="${w}" height="12" fill="#8d9599"/><rect x="${x}" y="${y + h}" width="${w}" height="12" fill="#6f777b"/>`;
      for (const dx of [0, w / 2 - 6, w - 12]) s += `<rect x="${x + dx}" y="${y}" width="12" height="${h + 40}" fill="#7d8589"/>`;
      s += `<rect x="${x - 10}" y="${y + h + 40}" width="${w + 20}" height="10" fill="#5d5f5c"/>`;
    }
    if (cylinders) {
      const cyl = (x, y, grad, label) => `
        <ellipse cx="${x}" cy="${y}" rx="44" ry="10" fill="#000" opacity=".3"/>
        <rect x="${x - 34}" y="${y - 330}" width="68" height="330" rx="30" fill="url(#${grad})"/>
        <rect x="${x - 16}" y="${y - 368}" width="32" height="44" rx="6" fill="#5a5a5a"/>
        <rect x="${x - 22}" y="${y - 250}" width="44" height="80" fill="#efece3"/>
        <text x="${x}" y="${y - 218}" font-family="Meiryo" font-size="14" font-weight="bold" fill="#222" text-anchor="middle">${label}</text>`;
      s += cyl(600, 820, "gBlack", "酸素") + cyl(700, 840, "gBrown", "ｱｾﾁﾚﾝ");
      s += `<path d="M600 460 C 560 560, 780 600, 820 760" stroke="#2f7d2f" stroke-width="8" fill="none"/><path d="M700 476 C 690 560, 820 640, 840 780" stroke="#c22" stroke-width="8" fill="none"/>`;
      s += `<rect x="800" y="760" width="90" height="16" fill="#555"/><circle cx="820" cy="800" r="22" fill="#222"/>`;
    }
    return s;
  },
  // 進捗写真：6F LGS 下地
  lgs() {
    let back = "";
    for (let x = 430; x < 860; x += 30) back += `<rect x="${x}" y="255" width="7" height="305" fill="url(#gAlu)"/>`;
    back += `<rect x="420" y="250" width="440" height="10" fill="#c8ccce"/><rect x="420" y="552" width="440" height="10" fill="#c8ccce"/>`;
    let s = room({ back });
    for (let i = 0; i < 12; i++) {
      const v = 0.05 + i * 0.08; const a = rw(0, v), b = rw(1, v);
      s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#d4d8da" stroke-width="${10 - v * 6}"/>`;
    }
    s += `<polygon points="${pts([fp(-0.9, 0.12), fp(-0.35, 0.12), fp(-0.36, 0.36), fp(-0.88, 0.36)])}" fill="#9fa5a8"/>`;
    for (let k = 0; k < 10; k++) s += `<line x1="${fp(-0.88, 0.14 + k * 0.022)[0]}" y1="${fp(-0.88, 0.14 + k * 0.022)[1]}" x2="${fp(-0.37, 0.14 + k * 0.022)[0]}" y2="${fp(-0.37, 0.14 + k * 0.022)[1]}" stroke="#e5e8ea" stroke-width="3"/>`;
    return s;
  },
  // 進捗写真：北側通路 掘削・既設排水管
  trench() {
    let s = `<rect width="${W}" height="${H}" fill="url(#gSky)"/>`;
    s += `<rect x="0" y="120" width="1280" height="340" fill="#c3c0b8"/>`;
    for (let x = 0; x < 1280; x += 90) s += `<rect x="${x}" y="230" width="86" height="230" fill="#ecebe5" stroke="#c9c7bf"/>`;
    s += `<text x="300" y="360" font-family="Meiryo" font-weight="bold" font-size="40" fill="#2f7d6d">東都建設</text>`;
    s += `<polygon points="0,460 1280,460 1280,960 0,960" fill="url(#gSoil)"/>`;
    s += `${stains(470, 960, 3)}`;
    s += `<polygon points="380,520 900,520 1180,960 120,960" fill="#3e3326"/>`;
    s += `<polygon points="380,520 900,520 880,560 400,560" fill="#5a4a37"/>`;
    s += `<path d="M 150 760 L 1150 690" stroke="url(#gPipe)" stroke-width="54" stroke-linecap="butt"/>`;
    s += `<path d="M 150 760 L 1150 690" stroke="#555" stroke-width="54" opacity=".15"/>`;
    s += `<path d="M 420 560 L 860 900" stroke="#f0f0f0" stroke-width="4" stroke-dasharray="20 14" opacity=".9"/>`;
    s += cone(140, 600, 1) + cone(1100, 610, 1);
    s += `<rect x="960" y="840" width="200" height="16" fill="#e6e6e6" transform="rotate(-20 1060 848)"/>`;
    return s;
  },
  // 進捗写真（10月分）：外観全景。足場・メッシュシートに覆われた12階建て
  facade({ side = "東面", seed = 4 } = {}) {
    const r = rng(seed);
    let s = `<rect width="${W}" height="${H}" fill="url(#gSky)"/>`;
    s += `<g fill="#a7b0b8">` + [[0, 520, 140], [150, 560, 110], [1040, 500, 120], [1170, 560, 110]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${800 - y}"/>`).join("") + `</g>`;
    const bx = side === "南面" ? 300 : 340, bw = side === "南面" ? 700 : 600, top = 70, floorH = 58;
    s += `<rect x="${bx}" y="${top}" width="${bw}" height="${800 - top}" fill="#c9c6bd"/>`;
    for (let f = 0; f < 12; f++) {
      const y = 800 - (f + 1) * floorH;
      for (let x = bx + 20; x < bx + bw - 40; x += 70) s += `<rect x="${x}" y="${y + 12}" width="50" height="32" fill="#46596b" opacity="${(0.75 + r() * 0.25).toFixed(2)}"/>`;
    }
    // 足場とメッシュシート（下から10層）
    s += `<rect x="${bx - 30}" y="${800 - 10 * floorH}" width="${bw + 60}" height="${10 * floorH}" fill="#5f8a78" opacity=".45"/>`;
    for (let y = 800 - 10 * floorH; y <= 800; y += floorH) s += `<line x1="${bx - 30}" y1="${y}" x2="${bx + bw + 30}" y2="${y}" stroke="#8d9294" stroke-width="4"/>`;
    for (let x = bx - 30; x <= bx + bw + 30; x += 90) s += `<line x1="${x}" y1="${800 - 10 * floorH}" x2="${x}" y2="800" stroke="#a3a8aa" stroke-width="3"/>`;
    // 屋上のタワークレーン風ジブ
    s += `<rect x="${bx + bw - 120}" y="${top - 40}" width="14" height="60" fill="#d9a400"/><line x1="${bx + bw - 330}" y1="${top - 34}" x2="${bx + bw + 40}" y2="${top - 34}" stroke="#d9a400" stroke-width="8"/>`;
    // 仮囲い
    s += `<rect x="0" y="800" width="1280" height="160" fill="#8f8a80"/><rect x="0" y="760" width="1280" height="70" fill="#ecebe5" stroke="#c9c7bf"/>`;
    for (let x = 0; x < 1280; x += 90) s += `<line x1="${x}" y1="760" x2="${x}" y2="830" stroke="#c9c7bf" stroke-width="2"/>`;
    s += `<text x="760" y="808" font-family="Meiryo" font-weight="bold" font-size="34" fill="#2f7d6d">東都建設</text>`;
    return s;
  },
  // 進捗写真（10月分）：天井ボード張り。done = 張り終わった割合（手前から）
  ceilingBoard({ done = 0.5 } = {}) {
    let s = room({ lights: false, ceilRibs: false });
    // 軽鉄の天井下地（野縁）
    for (let i = 0; i <= 14; i++) {
      const x0 = (i * 1280) / 14, x1 = 420 + (i * 440) / 14;
      s += `<line x1="${x0}" y1="0" x2="${x1}" y2="250" stroke="url(#gAlu)" stroke-width="${6 - i * 0.1}"/>`;
    }
    // 張り終わった部分（手前側）
    const yB = 250 * done, xB = (420 * yB) / 250;
    s += `<polygon points="${pts([[0, 0], [1280, 0], [1280 - xB, yB], [xB, yB]])}" fill="#ecebe4" stroke="#c9c7bd" stroke-width="2"/>`;
    for (let k = 1; k < 5; k++) {
      const y = (yB * k) / 5, x = (420 * y) / 250;
      s += `<line x1="${x}" y1="${y}" x2="${1280 - x}" y2="${y}" stroke="#c9c7bd" stroke-width="2"/>`;
    }
    // ボードの束とローリングタワー
    s += `<polygon points="${pts([fp(-0.85, 0.15), fp(-0.35, 0.15), fp(-0.36, 0.35), fp(-0.84, 0.35)])}" fill="#e8e6df" stroke="#aaa69c" stroke-width="2"/>`;
    for (let k = 0; k < 6; k++) s += `<line x1="${fp(-0.84, 0.17 + k * 0.03)[0]}" y1="${fp(-0.84, 0.17 + k * 0.03)[1]}" x2="${fp(-0.36, 0.17 + k * 0.03)[0]}" y2="${fp(-0.36, 0.17 + k * 0.03)[1]}" stroke="#cfccc2" stroke-width="2"/>`;
    const [tx, ty] = fp(0.45, 0.45);
    s += `<rect x="${tx - 80}" y="${ty - 300}" width="12" height="300" fill="url(#gAlu)"/><rect x="${tx + 68}" y="${ty - 300}" width="12" height="300" fill="url(#gAlu)"/>`;
    for (let k = 0; k < 5; k++) s += `<rect x="${tx - 80}" y="${ty - 300 + k * 70}" width="160" height="8" fill="#b9bec0"/>`;
    s += `<rect x="${tx - 90}" y="${ty - 310}" width="180" height="14" fill="#2f6fb0"/>`;
    return s;
  },
  // 進捗写真（10月分）：天井内ケーブルラックと幹線ケーブル
  rack({ cables = 3 } = {}) {
    let s = room({ back: `<rect x="420" y="250" width="440" height="20" fill="#9a968e"/>` });
    s += `<polygon points="${pts([[0, 110], [1280, 110], [860, 230], [420, 230]])}" fill="none"/>`;
    // 奥へ伸びるラック（左右のレールと横桟）
    s += `<line x1="200" y1="150" x2="560" y2="262" stroke="#b8bcbe" stroke-width="10"/><line x1="1080" y1="150" x2="720" y2="262" stroke="#b8bcbe" stroke-width="10"/>`;
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, y = 150 + t * 112, xl = 200 + t * 360, xr = 1080 - t * 360;
      s += `<line x1="${xl}" y1="${y}" x2="${xr}" y2="${y}" stroke="#8c9093" stroke-width="${7 - t * 4}"/>`;
      if (k % 3 === 0) s += `<line x1="${xl}" y1="0" x2="${xl}" y2="${y}" stroke="#7e8285" stroke-width="${5 - t * 3}"/><line x1="${xr}" y1="0" x2="${xr}" y2="${y}" stroke="#7e8285" stroke-width="${5 - t * 3}"/>`;
    }
    const cols = ["#151515", "#2c2c2c", "#3a3a3a", "#151515"];
    for (let i = 0; i < cables; i++) {
      const d = 120 + i * 90;
      s += `<path d="M ${200 + d} 140 L ${560 + d * 0.45} 255" stroke="${cols[i]}" stroke-width="${16 - i}" stroke-linecap="round"/>`;
    }
    // ケーブルドラム
    s += `<ellipse cx="1040" cy="790" rx="95" ry="115" fill="#a8783f" stroke="#7a5426" stroke-width="6"/><ellipse cx="1040" cy="790" rx="36" ry="44" fill="#1c1c1c"/><circle cx="1040" cy="790" r="12" fill="#a8783f"/>`;
    return s;
  },
  // 進捗写真（10月分）：外周サッシ取付（glass = ガラス入り）
  sash({ glass = false } = {}) {
    let back = `<rect x="420" y="250" width="440" height="310" fill="${glass ? "#9fbcd2" : "#cfe0ec"}"/>`;
    for (let x = 420; x <= 860; x += 110) back += `<rect x="${x - 5}" y="250" width="10" height="310" fill="url(#gAlu)"/>`;
    back += `<rect x="420" y="380" width="440" height="10" fill="url(#gAlu)"/>`;
    if (glass) back += `<polygon points="440,270 520,270 470,370 440,370" fill="#fff" opacity=".35"/><polygon points="660,400 720,400 690,540 660,540" fill="#fff" opacity=".3"/>`;
    else back += `<g fill="#9aa4ad">` + [[430, 430, 120], [570, 400, 90], [690, 450, 160]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${560 - y}"/>`).join("") + `</g>`;
    let s = room({ back });
    // 立てかけたサッシ枠
    if (!glass) for (let k = 0; k < 3; k++) {
      const [x, y] = fp(-0.8 + k * 0.08, 0.25);
      s += `<rect x="${x}" y="${y - 260}" width="120" height="260" fill="none" stroke="url(#gAlu)" stroke-width="12" transform="skewY(-4)"/>`;
    }
    else s += `<rect x="760" y="700" width="200" height="60" fill="#d9d7cf" transform="rotate(-4 860 730)"/>`;
    return s;
  },
  // 進捗写真（10月分）：空調ダクト・配管（pipes = 給排水管）
  duct({ pipes = false } = {}) {
    let s = room({ lights: false });
    if (!pipes) {
      // 角ダクト（手前から奥へ）
      s += `<polygon points="${pts([[380, 40], [900, 40], [700, 235], [580, 235]])}" fill="#d7dadc" stroke="#9ea3a6" stroke-width="3"/>`;
      s += `<polygon points="${pts([[380, 40], [900, 40], [900, 120], [380, 120]])}" fill="#c3c7ca" stroke="#9ea3a6" stroke-width="3"/>`;
      for (let k = 1; k < 6; k++) { const t = k / 6, y = 40 + t * 195; s += `<line x1="${380 + t * 200}" y1="${y}" x2="${900 - t * 200}" y2="${y}" stroke="#9ea3a6" stroke-width="3"/>`; }
      for (const x of [420, 860]) s += `<line x1="${x}" y1="0" x2="${x}" y2="130" stroke="#7e8285" stroke-width="5"/>`;
      // 冷媒管（断熱材巻き）
      s += `<path d="M 0 180 L 520 262" stroke="#f2f2ec" stroke-width="18"/><path d="M 0 210 L 520 268" stroke="#f2f2ec" stroke-width="12"/>`;
    } else {
      // 給水（青）・排水（灰）の配管
      s += `<path d="M 0 140 L 470 255" stroke="#3b6fb0" stroke-width="20"/><path d="M 0 190 L 470 262" stroke="url(#gPipe)" stroke-width="34"/>`;
      s += `<path d="M 1280 160 L 820 258" stroke="url(#gPipe)" stroke-width="28"/>`;
      for (const [x, y] of [[160, 180], [320, 218]]) s += `<line x1="${x}" y1="0" x2="${x}" y2="${y}" stroke="#7e8285" stroke-width="5"/>`;
      s += `<polygon points="${pts([fp(-0.8, 0.2), fp(-0.3, 0.2), fp(-0.3, 0.26), fp(-0.8, 0.26)])}" fill="#ece9e0"/>`;
    }
    // 脚立（作業員なし）
    s += `<line x1="760" y1="900" x2="820" y2="600" stroke="url(#gAlu)" stroke-width="14"/><line x1="900" y1="900" x2="840" y2="600" stroke="url(#gAlu)" stroke-width="14"/><rect x="806" y="588" width="48" height="14" fill="#d84a1e"/>`;
    return s;
  },
};

const BOARD_CSS = `
  .ph { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #777; }
  .ph svg { position: absolute; inset: 0; filter: blur(.6px) sepia(.12) contrast(1.04); }
  .stamp { position: absolute; right: 34px; top: 26px; font: bold 34px "Consolas", monospace; color: #ff8a1c; text-shadow: 0 0 3px #a33d00, 0 0 1px #000; letter-spacing: 2px; }
  .board { position: absolute; left: 30px; bottom: 30px; width: 420px; background: #2f4a3a; border: 12px solid #8b6a43; box-shadow: 6px 8px 18px rgba(0,0,0,.55); transform: rotate(-1.6deg); padding: 6px 8px;
           font-family: "UD デジタル 教科書体 N-R", "UD Digi Kyokasho N-R", "Yu Gothic", sans-serif; color: #f3f3ea; }
  .board table { width: 100%; border-collapse: collapse; }
  .board td { border: 2px solid rgba(240,240,230,.72); padding: 3px 7px; font-size: 18px; line-height: 1.25; text-shadow: 0 0 1px rgba(255,255,255,.6); }
  .board td.k { width: 82px; white-space: nowrap; text-align: center; font-size: 16px; letter-spacing: 3px; }
  .board::after { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 30%, rgba(255,255,255,.08), transparent 60%); }
`;

export async function renderPhoto(outPath, { scene, args, board, stamp }) {
  const body = SCENES[scene](args);
  const rows = Object.entries(board).map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
  const html = `<div class="ph">
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${DEFS}${body}</svg>
    <div class="stamp">${esc(stamp)}</div>
    <div class="board"><table>${rows}</table></div>
  </div>`;
  await renderPng(html, BOARD_CSS, W, H, outPath);
}
