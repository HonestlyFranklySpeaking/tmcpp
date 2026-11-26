#!/usr/bin/env node
// Make the Chrome Web Store images: node tools/store-assets.js
//   store/store-icon-128.png                 the listing's icon: the tile at 96 px with 16 px transparent padding
//   store/promo-440x280.png                  the small promo tile, with the reversed wordmark
//   store/marquee-1400x560.png               the marquee, used if the store features the extension
//   store/screenshot-<example>.png           1280x800: the panel open in real Desmos, the example compiled
// The icons come from the logo kit (design/logo, rebuilt by design/logo/render.sh): extension/icons/ and
// vscode/icon.png are copies of design/logo/kit/extension/ and design/logo/kit/vscode/icon.png.
// Run `npm run build:ext` first. Uses playwright-core with your installed Chrome or Edge, like tmcpp preview.
import { readFileSync, mkdirSync } from "node:fs";

const root = new URL("..", import.meta.url);
const path = (p) => decodeURIComponent(new URL(p, root).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const kit = (f, w, h) => readFileSync(path(`design/logo/kit/svg/${f}`), "utf8").replace(/ width="\d+" height="\d+"/, ` width="${w}" height="${h}"`);
const wordmark = kit("tmcpp-wordmark-reversed.svg", 250, 80);
const tagline = (px) => `<div style="color:#fff;opacity:.85;font-size:${px}px;line-height:1.4;text-align:center">Desmos graphs as code, with classes.<br>Live, and AI-ready.</div>`;
mkdirSync(path("store"), { recursive: true });

const { chromium } = await import("playwright-core");
let browser;
for (const channel of ["chrome", "msedge"]) { try { browser = await chromium.launch({ channel }); break; } catch {} }
if (!browser) { console.error("store-assets needs Chrome or Edge installed"); process.exit(1); }

try {
  const icon = await browser.newPage({ viewport: { width: 128, height: 128 } });
  await icon.setContent(`<body style="margin:0;background:transparent;padding:16px">${kit("tmcpp-icon.svg", 96, 96)}</body>`);
  await icon.screenshot({ path: path("store/store-icon-128.png"), omitBackground: true });

  const marquee = await browser.newPage({ viewport: { width: 1400, height: 560 } });
  await marquee.setContent(`<body style="margin:0;width:1400px;height:560px;background:#1d3557;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;font-family:system-ui,sans-serif">
    ${kit("tmcpp-wordmark-reversed.svg", 640, 204)}${tagline(32)}</body>`);
  await marquee.screenshot({ path: path("store/marquee-1400x560.png") });

  // The promo tile: the wordmark alone (the guidelines say icon or wordmark, not both), and the tagline.
  const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
  await page.setContent(`<body style="margin:0;width:440px;height:280px;background:#1d3557;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;font-family:system-ui,sans-serif">
    ${wordmark}
    ${tagline(15)}</body>`);
  await page.screenshot({ path: path("store/promo-440x280.png") });

  // Screenshots: what someone sees after installing, with a real example compiled.
  const tmcpp = readFileSync(path("extension/dist/tmcpp.js"), "utf8");
  for (const name of ["solar-system", "event-horizon", "night-net"]) {
    const shot = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const source = readFileSync(path(`examples/${name}.tmcpp`), "utf8");
    await shot.addInitScript((s) => localStorage.setItem("tmcpp:source:/calculator", s), source);
    await shot.goto("https://www.desmos.com/calculator", { waitUntil: "load" });
    await shot.waitForFunction(() => window.Calc);
    await shot.addScriptTag({ content: tmcpp });
    await shot.click("#tmcpp-toggle");
    await shot.click("#tmcpp-run");
    await shot.waitForTimeout(3000);
    // Collapse Desmos's list and widen the view to the right, so the graph sits beside the panel, not under it.
    await shot.evaluate(() => {
      Calc.updateSettings({ expressionsCollapsed: true });
      const b = Calc.graphpaperBounds.mathCoordinates, panel = document.querySelector("#tmcpp-panel").getBoundingClientRect();
      const f = (panel.left - 16) / window.innerWidth, w = b.right - b.left, h = b.top - b.bottom, cy = (b.top + b.bottom) / 2;
      Calc.setMathBounds({ left: b.left, right: b.left + w / f, bottom: cy - h / f / 2, top: cy + h / f / 2 });
    });
    await shot.waitForTimeout(2500);
    await shot.screenshot({ path: path(`store/screenshot-${name}.png`) });
    await shot.close();
  }
  console.log("wrote store/*.png");
} finally {
  await browser.close();
}
