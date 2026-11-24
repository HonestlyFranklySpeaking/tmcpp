// Runs INSIDE desmos.com (via the browser), so it must be self-contained: no imports, no outer variables.
// Loads a graph state, renders one frame per entry in `frames` (each a map of slider -> value),
// and returns a PNG data URL: the frame itself, or a labelled contact sheet when there are several.
export async function renderFrames({ state, frames, width = 1600, cols = 3 }) {
  const Calc = window.Calc;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  Calc.setState(state);
  await sleep(300);

  const vp = state.graph?.viewport ?? { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
  const height = Math.round(width * (vp.ymax - vp.ymin) / (vp.xmax - vp.xmin));
  const mathBounds = { left: vp.xmin, right: vp.xmax, bottom: vp.ymin, top: vp.ymax };

  // Slider name as written in TMC++ (a, X_1, total) -> how it appears in Desmos LaTeX.
  const latexNames = (n) => {
    const out = [n];
    if (n.includes("_")) { const [h, ...rest] = n.split("_"); out.push(`${h}_{${rest.join("_")}}`); }
    else if (n.length > 1) out.push(`${n[0]}_{${n.slice(1)}}`);
    return out;
  };
  const exprs = Calc.getState().expressions.list;
  const findSlider = (name) => {
    for (const ln of latexNames(name)) {
      const e = exprs.find((x) => typeof x.latex === "string" && x.latex.startsWith(ln + "="));
      if (e) return { id: e.id, ln };
    }
    return null;
  };

  const missing = new Set();
  const shots = [];
  for (const frame of frames) {
    for (const [name, value] of Object.entries(frame)) {
      const s = findSlider(name);
      if (!s) { missing.add(name); continue; }
      Calc.setExpression({ id: s.id, latex: `${s.ln}=${value}` });
    }
    await sleep(150);
    const png = await new Promise((resolve) =>
      Calc.asyncScreenshot({ width, height, targetPixelRatio: 1, mathBounds, showLabels: true }, resolve));
    shots.push({ png, frame });
  }
  if (shots.length === 1) return { png: shots[0].png, missing: [...missing] };

  // Contact sheet: frames in a grid, each captioned with its slider values.
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const imgs = await Promise.all(shots.map((s) => load(s.png)));
  const n = imgs.length, c = Math.min(cols, n), r = Math.ceil(n / c);
  const cw = Math.round(width / c), ch = Math.round(height / c), cap = 26, gap = 6;
  const canvas = document.createElement("canvas");
  canvas.width = c * cw + (c + 1) * gap;
  canvas.height = r * (ch + cap) + (r + 1) * gap;
  const g = canvas.getContext("2d");
  g.fillStyle = "#1b1b1f"; g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = "14px system-ui, sans-serif"; g.fillStyle = "#e8e8ea"; g.textBaseline = "middle";
  imgs.forEach((img, i) => {
    const x = gap + (i % c) * (cw + gap), y = gap + Math.floor(i / c) * (ch + cap + gap);
    g.drawImage(img, x, y, cw, ch);
    const label = Object.entries(shots[i].frame).map(([k, v]) => `${k} = ${(+v).toFixed(3).replace(/\.?0+$/, "")}`).join("   ");
    g.fillText(label, x + 6, y + ch + cap / 2);
  });
  return { png: canvas.toDataURL("image/png"), missing: [...missing] };
}

// Runs INSIDE desmos.com too. Loads a state, sets sliders, waits for Desmos to evaluate, and
// reports every expression's error (Calc.expressionAnalysis, the public API) plus, where the
// calculator exposes it, what the expression draws and which names it uses.
export async function analyzeGraph({ state, at = {} }) {
  const Calc = window.Calc;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  Calc.setState(state);
  const exprs = state.expressions.list.filter((e) => e.type === "expression" && typeof e.latex === "string" && e.latex.trim());
  const hiddenFolders = new Set(state.expressions.list.filter((e) => e.type === "folder" && e.hidden).map((e) => e.id));
  const latexNames = (n) => {
    const out = [n];
    if (n.includes("_")) { const [h, ...rest] = n.split("_"); out.push(`${h}_{${rest.join("_")}}`); }
    else if (n.length > 1) out.push(`${n[0]}_{${n.slice(1)}}`);
    return out;
  };
  const missing = [];
  for (const [name, value] of Object.entries(at)) {
    let hit = null;
    for (const ln of latexNames(name)) { hit = exprs.find((x) => x.latex.startsWith(ln + "=")); if (hit) { Calc.setExpression({ id: hit.id, latex: `${ln}=${value}` }); break; } }
    if (!hit) missing.push(name);
  }
  // Wait until Desmos has analysed every expression, then a little longer for it to settle.
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && exprs.some((e) => !Calc.expressionAnalysis[e.id])) await sleep(200);
  await sleep(600);
  const items = exprs.map((e) => {
    const a = Calc.expressionAnalysis[e.id] ?? {};
    let type = null, name = null, uses = [];
    try {
      const f = Calc.controller.getItemModel(e.id)?.formula;
      type = f?.expression_type ?? null;
      name = f?.assignment ?? f?.defined_name ?? null;
      uses = Array.isArray(f?.variables) ? f.variables : [];
    } catch {}
    return { id: e.id, latex: e.latex, hidden: !!e.hidden || hiddenFolders.has(e.folderId), error: a.isError ? a.errorMessage : null, graphable: !!a.isGraphable, type, name, uses };
  });
  const sliders = {};
  for (const e of Calc.getState().expressions.list) {
    const m = e.type === "expression" && e.slider && /^([^=]+)=(.+)$/.exec(e.latex ?? "");
    if (m) sliders[m[1].replace(/[{}]/g, "")] = m[2];
  }
  return { items, sliders, missing, settled: Date.now() - t0 < 20000 };
}
