// tmcpp preview: render a TMC++ (or TMC) file in real Desmos and save a PNG.
//
//   tmcpp preview examples/glass-choir.tmcpp --at a=4.03 d=0 --out frame.png
//   tmcpp preview examples/glass-choir.tmcpp --sweep a=0..2pi/9 --out sheet.png
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
import { restoreGreek } from "./greek.js";
import { compileFile } from "./load-node.js";
import { decodeSource } from "./decode.js";
import { renderFrames } from "./preview-page.js";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/** playwright-core is optional: found next to tmcpp (npx -p, a global install, a project), or else in the current folder's project. */
async function loadPlaywright() {
  try { return await import("playwright-core"); }
  catch {
    const at = createRequire(pathToFileURL(process.cwd() + "/").href).resolve("playwright-core");
    return import(pathToFileURL(at).href);
  }
}

/** Numbers with optional pi: 2, -1.5, pi, 2pi, pi/2, 3pi/4. Throws on anything else. */
export function parseNumber(s) {
  if (typeof s === "number") return s;
  const m = String(s).trim().match(/^(-?\d*\.?\d*)\s*\*?\s*(pi)?\s*(?:\/\s*(\d*\.?\d+))?$/);
  if (!m || (m[1] === "" && !m[2]) || m[1] === "-" && !m[2]) {
    const n = Number(s); if (s !== "" && Number.isFinite(n)) return n;
    throw new Error(`can't read the number '${s}' (use forms like 1.5, 2pi, pi/2)`);
  }
  const k = m[1] === "" ? 1 : m[1] === "-" ? -1 : Number(m[1]);
  return (m[2] ? k * Math.PI : k) / (m[3] ? Number(m[3]) : 1);
}

/** "a=0..2pi/9" -> { name, lo, hi, n, inclusive }. */
export function parseSweep(text) {
  const m = String(text).match(/^([A-Za-z][\w]*)=(.+?)\.\.(=?)(.+)\/(\d+)$/);
  if (!m) throw new Error("--sweep looks like a=0..2pi/9 (name=from..to/frames; ..= includes the end)");
  const sweep = { name: m[1], lo: parseNumber(m[2]), inclusive: m[3] === "=", hi: parseNumber(m[4]), n: Number(m[5]) };
  if (sweep.n < 1) throw new Error("--sweep needs at least 1 frame");
  return sweep;
}

/**
 * Render a TMC++ (or TMC, with isTmc) source in real Desmos.
 * Returns { png: Buffer, frames, missing, warnings }; throws an Error with a readable message.
 * at: { slider: number }, sweep: { name, lo, hi, n, inclusive } or null.
 */
export async function renderPreview(source, { path = "", isTmc = /\.tmc$/i.test(path), at = {}, sweep = null, width = 1600, cols = 3, show = false } = {}) {
  let tmc = source;
  const warnings = [];
  if (!isTmc) {
    const r = await compileFile(source, path); // imports: ./files from disk, gh: and https from the network
    if (r.errors.length) {
      const e = new Error(r.errors.map((x) => `${path || "<source>"}:${x.line}: error: ${x.message}`).join("\n"));
      e.compileErrors = r.errors;
      throw e;
    }
    warnings.push(...r.warnings);
    tmc = r.tmc;
  }
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), tmc);
  const errs = diagnostics.filter((d) => d.severity === "error");
  if (errs.length || !state) throw new Error(`TMC rejected the file: ${errs[0]?.message ?? "no state"} (run tmcpp check for details)`);
  restoreGreek(state);

  // Freeze animation so every frame is exactly the values asked for.
  for (const e of state.expressions.list) if (e.slider) e.slider.isPlaying = false;
  if (state.expressions.ticker) state.expressions.ticker.playing = false;

  const frames = sweep
    ? Array.from({ length: sweep.n }, (_, i) => {
        const steps = sweep.inclusive ? Math.max(1, sweep.n - 1) : sweep.n;
        return { ...at, [sweep.name]: sweep.lo + (sweep.hi - sweep.lo) * i / steps };
      })
    : [at];

  let chromium;
  try { ({ chromium } = await loadPlaywright()); }
  catch {
    throw new Error("previews need playwright-core, which drives your installed Chrome or Edge.\n  Installed tmcpp globally?  npm install -g playwright-core\n  Using npx?                 npx -p @ikeasourpatches/tmcpp -p playwright-core tmcpp preview FILE");
  }
  let browser;
  for (const channel of ["chrome", "msedge"]) {
    try { browser = await chromium.launch({ channel, headless: !show }); break; } catch {}
  }
  if (!browser) throw new Error("couldn't start Chrome or Edge; install one of them");

  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    try {
      await page.goto("https://www.desmos.com/calculator", { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch { throw new Error("couldn't open desmos.com (are you online?)"); }
    await page.waitForFunction(() => window.Calc && window.Calc.asyncScreenshot, null, { timeout: 60000 });
    const { png, missing } = await page.evaluate(renderFrames, { state, frames, width, cols });
    return { png: Buffer.from(png.split(",")[1], "base64"), frames: frames.length, missing, warnings };
  } finally {
    await browser.close();
  }
}

/** argv: the arguments after `preview`. Exits the process on errors, like a command. */
export async function runPreview(argv) {
  const die = (msg) => { console.error(`preview: ${msg}`); process.exit(1); };
  const opt = { at: {}, sweep: null, out: null, width: 1600, cols: 3, show: false };
  let file = null;
  try {
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      const next = () => argv[++i] ?? die(`${a} needs a value`);
      if (a === "--out") opt.out = next();
      else if (a === "--width") opt.width = Number(next());
      else if (a === "--cols") opt.cols = Number(next());
      else if (a === "--show") opt.show = true;
      else if (a === "--sweep") opt.sweep = parseSweep(next());
      else if (a === "--at") {
        while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
          const [k, v] = argv[++i].split("=");
          if (!v) die(`--at expects name=value, got '${argv[i]}'`);
          opt.at[k] = parseNumber(v);
        }
      } else if (!a.startsWith("--")) {
        if (file) die(`unexpected '${a}' (one file at a time)`);
        file = a;
      } else die(`unknown option '${a}'`);
    }
  } catch (e) { die(e.message); }
  if (!file) die("usage: tmcpp preview FILE [--at a=1 b=2] [--sweep a=0..2pi/9] [--out out.png]");
  opt.out ??= file.replace(/\.(tmcpp|tmc|txt)$/i, "") + ".preview.png";

  let r;
  try {
    r = await renderPreview(decodeSource(readFileSync(file)), { path: file, ...opt });
  } catch (e) {
    if (e.compileErrors) { console.error(e.message); process.exit(1); }
    die(e.message);
  }
  for (const m of r.missing) console.error(`preview: warning: no slider named '${m}'`);
  writeFileSync(opt.out, r.png);
  console.log(`preview: wrote ${opt.out} (${r.frames} frame${r.frames > 1 ? "s" : ""})`);
}
