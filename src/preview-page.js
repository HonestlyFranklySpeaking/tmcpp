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
