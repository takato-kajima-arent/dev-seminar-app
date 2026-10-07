// puppeteer-core で HTML → PNG / PDF を描画する小さなヘルパー
import puppeteer from "puppeteer-core";
import { existsSync, writeFileSync } from "node:fs";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

let browser = null;

export async function openBrowser() {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) throw new Error("Chrome / Edge が見つかりません（CHROME_PATH で指定可）");
  browser = await puppeteer.launch({ executablePath, headless: true, args: ["--font-render-hinting=none"] });
  return browser;
}

export async function closeBrowser() {
  if (browser) await browser.close();
  browser = null;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Yu Gothic", "YuGothic", "Meiryo", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

function wrap(body, css = "") {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

/** HTML を width×height の PNG にする。
 *  グラデーションのディザでPNGが重くなるので、キャンバスで各色を量子化してから再エンコードする */
export async function renderPng(body, css, width, height, outPath, { quant = 8, gray = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setContent(wrap(body, css), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height }, encoding: "base64" });
  const b64 = await page.evaluate(async (src, w, h, q, g) => {
    const img = new Image();
    img.src = "data:image/png;base64," + src;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      if (g) {
        // 赤（印鑑）以外はグレースケールに寄せる（スキャン風・PNG を軽く）
        const y = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
        if (!(a[i] > a[i + 1] + 40 && a[i] > a[i + 2] + 40)) { a[i] = a[i + 1] = a[i + 2] = y; }
      }
      a[i] = Math.min(255, Math.round(a[i] / q) * q);
      a[i + 1] = Math.min(255, Math.round(a[i + 1] / q) * q);
      a[i + 2] = Math.min(255, Math.round(a[i + 2] / q) * q);
      a[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    return cv.toDataURL("image/png").split(",")[1];
  }, shot, width, height, quant, gray);
  writeFileSync(outPath, Buffer.from(b64, "base64"));
  await page.close();
}

/** HTML を PDF にする（format: "A4" | "A3", landscape） */
export async function renderPdf(body, css, outPath, { format = "A4", landscape = false } = {}) {
  const page = await browser.newPage();
  await page.setContent(wrap(body, css), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: outPath, format, landscape, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.close();
}

/** 再現性のある乱数 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
