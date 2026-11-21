#!/usr/bin/env node
// Render a TMC++ (or TMC) file in real Desmos and save a PNG.
//
//   npm run preview -- examples/glass-choir.tmcpp --at a=4.03 d=0 --out frame.png
//   npm run preview -- examples/glass-choir.tmcpp --sweep a=0..2pi/9 --out sheet.png
//
// --at NAME=VALUE ...      set sliders for every frame (values may use pi: 2pi, pi/2)
// --sweep NAME=LO..HI/N    N frames from LO up to (not including) HI, as a contact sheet: right for loops
// --sweep NAME=LO..=HI/N   the same, but the last frame is HI: right for play-once sliders
// --out FILE               output PNG (default: <file>.preview.png)
// --width PX               image width (default 1600)   --cols N   sheet columns (default 3)
// --show                   open a visible browser window instead of running headless
//
// Uses your installed Chrome, or Edge, through playwright-core. Needs internet access to desmos.com.
import { readFileSync, writeFileSync } from "node:fs";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";
import { decodeSource } from "../src/decode.js";
import { renderFrames } from "../src/preview-page.js";

const die = (msg) => { console.error(`preview: ${msg}`); process.exit(1); };

// ---- arguments ----
const argv = process.argv.slice(2);
let file = null;
const opt = { at: {}, sweep: null, out: null, width: 1600, cols: 3, show: false };

/** Numbers with optional pi: 2, -1.5, pi, 2pi, pi/2, 3pi/4. */
function num(s) {
  const m = String(s).trim().match(/^(-?\d*\.?\d*)\s*\*?\s*(pi)?\s*(?:\/\s*(\d*\.?\d+))?$/);
  if (!m || (m[1] === "" && !m[2]) || m[1] === "-" && !m[2]) {
    const n = Number(s); if (Number.isFinite(n)) return n;
    die(`can't read the number '${s}' (use forms like 1.5, 2pi, pi/2)`);
  }
  const k = m[1] === "" ? 1 : m[1] === "-" ? -1 : Number(m[1]);
  return (m[2] ? k * Math.PI : k) / (m[3] ? Number(m[3]) : 1);
}

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i] ?? die(`${a} needs a value`);
  if (a === "--out") opt.out = next();
  else if (a === "--width") opt.width = Number(next());
  else if (a === "--cols") opt.cols = Number(next());
  else if (a === "--show") opt.show = true;
  else if (a === "--sweep") {
    const m = next().match(/^([A-Za-z][\w]*)=(.+?)\.\.(=?)(.+)\/(\d+)$/);
    if (!m) die("--sweep looks like a=0..2pi/9 (name=from..to/frames; ..= includes the end)");
    opt.sweep = { name: m[1], lo: num(m[2]), inclusive: m[3] === "=", hi: num(m[4]), n: Number(m[5]) };
    if (opt.sweep.n < 1) die("--sweep needs at least 1 frame");
  } else if (!a.startsWith("--")) {
    if (file) die(`unexpected '${a}' (one file at a time)`);
    file = a;
  } else if (a === "--at") {
    while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      const [k, v] = argv[++i].split("=");
      if (!v) die(`--at expects name=value, got '${argv[i]}'`);
      opt.at[k] = num(v);
    }
  }
}
if (!file) die("usage: npm run preview -- FILE [--at a=1 b=2] [--sweep a=0..2pi/9] [--out out.png]");
opt.out ??= file.replace(/\.(tmcpp|tmc|txt)$/i, "") + ".preview.png";

// ---- compile to a Desmos state ----
let tmc = decodeSource(readFileSync(file));
if (!/\.tmc$/i.test(file)) {
  const r = compile(tmc);
  for (const e of r.errors) console.error(`${file}:${e.line}: error: ${e.message}`);
  if (r.errors.length) process.exit(1);
  tmc = r.tmc;
}
const [{ diagnostics }, state] = textToRaw(buildConfig({}), tmc);
const errs = diagnostics.filter((d) => d.severity === "error");
if (errs.length || !state) die(`TMC rejected the file: ${errs[0]?.message ?? "no state"} (run tools/check.js for details)`);

// Freeze animation so every frame is exactly the values asked for.
for (const e of state.expressions.list) if (e.slider) e.slider.isPlaying = false;
if (state.expressions.ticker) state.expressions.ticker.playing = false;

const frames = opt.sweep
  ? Array.from({ length: opt.sweep.n }, (_, i) => {
      const steps = opt.sweep.inclusive ? Math.max(1, opt.sweep.n - 1) : opt.sweep.n;
      return { ...opt.at, [opt.sweep.name]: opt.sweep.lo + (opt.sweep.hi - opt.sweep.lo) * i / steps };
    })
  : [opt.at];

// ---- render in real Desmos ----
let chromium;
try { ({ chromium } = await import("playwright-core")); }
catch { die("playwright-core is missing: run npm install"); }

let browser;
for (const channel of ["chrome", "msedge"]) {
  try { browser = await chromium.launch({ channel, headless: !opt.show }); break; } catch {}
}
if (!browser) die("couldn't start Chrome or Edge; install one of them");

try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto("https://www.desmos.com/calculator", { waitUntil: "domcontentloaded", timeout: 60000 })
    .catch(() => die("couldn't open desmos.com (are you online?)"));
  await page.waitForFunction(() => window.Calc && window.Calc.asyncScreenshot, null, { timeout: 60000 });
  const { png, missing } = await page.evaluate(renderFrames, { state, frames, width: opt.width, cols: opt.cols });
  for (const m of missing) console.error(`preview: warning: no slider named '${m}'`);
  writeFileSync(opt.out, Buffer.from(png.split(",")[1], "base64"));
  console.log(`preview: wrote ${opt.out} (${frames.length} frame${frames.length > 1 ? "s" : ""})`);
} finally {
  await browser.close();
}
