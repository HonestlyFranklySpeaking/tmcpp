// M4: rebuild TMC++ source from a Desmos graph state.
//
// Items with metadata come back as written when nothing changed (math via a LaTeX hash, styles via
// a recompiled comparison), and as classes + inline overrides when they were restyled in Desmos.
// Items without metadata (added in the Desmos UI) come back as plain math + inline tokens.
//
// latexToText(latex) -> TMC math text is injected: it needs Desmos's own LaTeX parser,
// which only exists on desmos.com (the extension passes one built from text-mode-core).

import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile, isWatermarkSeed } from "./compile.js";
import { readMeta, fnv1a, itemHash, META_ID } from "./meta.js";

const AUTO_COLORS = new Set(["#c74440", "#2d70b3", "#388c46", "#6042a6", "#fa7e19", "#000000"]);
const BUILTIN = { "#c74440": "red", "#2d70b3": "blue", "#388c46": "green", "#6042a6": "purple", "#fa7e19": "orange", "#000000": "black" };
const ORIENT = (o) => o.replace(/_/g, "-");

// Style keys we compare and turn back into tokens. Everything else is identity, content or slider.
const STYLE_KEYS = [
  "color", "colorLatex", "hidden", "secret", "lines", "lineStyle", "lineWidth", "lineOpacity", "fill", "fillOpacity",
  "points", "pointSize", "pointOpacity", "pointStyle", "dragMode",
  "label", "showLabel", "labelSize", "labelOrientation", "labelAngle", "suppressTextOutline",
  "interactiveLabel", "editableLabelMode", "displayEvaluationAsFraction",
];
// Values Desmos drops on load, so missing == these.
const DEFAULTS = {
  hidden: false, secret: false, suppressTextOutline: false, interactiveLabel: false,
  displayEvaluationAsFraction: false, lineStyle: "SOLID", pointStyle: "POINT",
  labelOrientation: "default", labelSize: "1", labelAngle: "0",
};

/** The comparable style of a raw item, with Desmos's dropped defaults filled back in. */
export function styleView(item) {
  const v = {};
  for (const k of STYLE_KEYS) {
    const val = item[k] ?? DEFAULTS[k];
    if (val !== undefined) v[k] = typeof val === "number" ? String(val) : val;
  }
  if (v.lines === false) { delete v.lineWidth; delete v.lineOpacity; delete v.lineStyle; }
  if (v.fill === false) delete v.fillOpacity;
  if (!v.showLabel) { delete v.labelSize; delete v.labelOrientation; delete v.labelAngle; delete v.suppressTextOutline; delete v.interactiveLabel; delete v.editableLabelMode; if (!v.label) delete v.label; delete v.showLabel; }
  if (v.points === false) { delete v.pointSize; delete v.pointOpacity; delete v.pointStyle; }
  if (item.clickableInfo?.enabled && item.clickableInfo.latex) {
    v.onClick = item.clickableInfo.latex;
    if (item.clickableInfo.description) v.clickDescription = item.clickableInfo.description;
  }
  return v;
}

const cfgNode = buildConfig({});

/**
 * The raw item TMC++ would produce for one statement (with the given classes and colours),
 * and whether that statement sets a colour itself (otherwise Desmos picks one automatically).
 */
function probe(header, statement) {
  const r = compile(`${header}\n${statement}`, { defaultSettings: {}, watermark: false });
  if (r.errors.length) return null;
  const [{ diagnostics }, state] = textToRaw(cfgNode, r.tmc);
  if (diagnostics.some((d) => d.severity === "error")) return null;
  const item = state.expressions.list.at(-1);
  if (!item) return null;
  const lastLine = r.tmc.trim().split("\n").at(-1);
  return { item, explicitColor: /\bcolor:/.test(lastLine) };
}

/** Compare two style views; colour only counts when the source set one or the graph's isn't automatic. */
function sameStyle(p, actualView) {
  const a = { ...styleView(p.item) }, b = { ...actualView };
  if (!p.explicitColor && AUTO_COLORS.has((b.color ?? "").toLowerCase())) { delete a.color; delete b.color; }
  return JSON.stringify(a) === JSON.stringify(b);
}

const SLIDER_DEFAULTS = { loopMode: "LOOP_FORWARD_REVERSE", animationPeriod: 4000, playDirection: 1 };
/** Slider settings that matter for the source (the play/pause state and the value don't). */
function sliderView(s) {
  if (!s || s.min === undefined) return null;
  const v = { ...SLIDER_DEFAULTS, ...s };
  return JSON.stringify([v.min, v.max, v.step ?? "", v.loopMode, v.animationPeriod, v.playDirection]);
}

/**
 * Math as one tail token. Spaces next to symbols can go (a + b -> a+b), but a space between two
 * words is meaningful (2 pi, x for i), so then the whole value is bracketed instead: (a pi).
 */
export function oneToken(text) {
  const t = text.trim().replace(/\s*([^\w\s.])\s*/g, "$1");
  return /\s/.test(t) ? `(${t.replace(/\s+/g, " ")})` : t;
}

/** A value as a token argument: numbers as-is, LaTeX expressions as one token. */
function valueText(v, latexToText) {
  const s = String(v);
  if (/^-?\d*\.?\d+$/.test(s)) return s.replace(/^(-?)\./, "$10"); // .95 -> 0.95
  try { return oneToken(latexToText(s)); } catch { return s; }
}

const balanced = (s) => {
  let d = 0;
  for (const c of s) { if (c === "(") d++; else if (c === ")" && --d < 0) return false; }
  return d === 0;
};

/** Tokens that turn `from` (style view) into `to`, for the keys where they differ. */
function overrideTokens(from, to, ctx) {
  const t = [], raw = [];
  const diff = (k) => JSON.stringify(from[k]) !== JSON.stringify(to[k]);
  const hexName = (hex) => ctx.colorNames.get(hex) ?? BUILTIN[hex] ?? null;
  if (to.colorLatex) {
    // A colour set by an expression (c_1, rgb(...)) wins over the plain colour in Desmos.
    if (diff("colorLatex")) t.push(`#(${ctx.latexToText(to.colorLatex)})`);
  } else if (diff("color") && to.color) { const n = hexName(to.color.toLowerCase()); t.push(n ? `#${n}` : to.color.toLowerCase()); }
  if (diff("lines") && to.lines === false) t.push("opacity", "0");
  if (to.lines !== false) {
    if (diff("lineStyle") && to.lineStyle) t.push(to.lineStyle.toLowerCase());
    if (diff("lineWidth") && to.lineWidth !== undefined) t.push("width", valueText(to.lineWidth, ctx.latexToText));
    if (diff("lineOpacity") && to.lineOpacity !== undefined) t.push("opacity", valueText(to.lineOpacity, ctx.latexToText));
  }
  if (diff("fill") && to.fill === false) t.push("fill", "0");
  if (to.fill !== false && diff("fillOpacity") && to.fillOpacity !== undefined) t.push("fill", valueText(to.fillOpacity, ctx.latexToText));
  if (to.points !== false) {
    if (diff("pointSize") && to.pointSize !== undefined) t.push("point", valueText(to.pointSize, ctx.latexToText));
    if (diff("pointOpacity") && to.pointOpacity !== undefined) t.push("point-opacity", valueText(to.pointOpacity, ctx.latexToText));
    if (diff("pointStyle")) to.pointStyle === "POINT" ? raw.push('points: @{ style: "POINT" }') : t.push(to.pointStyle.toLowerCase());
  } else if (diff("points")) raw.push("points: false");
  if (diff("dragMode") && to.dragMode) t.push("drag", to.dragMode.toLowerCase());
  if (diff("hidden")) to.hidden ? t.push("hidden") : raw.push("hidden: false");
  if (diff("secret")) to.secret ? t.push("secret") : raw.push("secret: false");
  if (diff("displayEvaluationAsFraction") && to.displayEvaluationAsFraction) t.push("fraction");
  if ((diff("label") || diff("showLabel")) && to.label) t.push("label", JSON.stringify(to.label));
  if (to.label) {
    if (diff("labelOrientation") && to.labelOrientation) t.push(ORIENT(to.labelOrientation));
    if (diff("labelSize") && to.labelSize !== undefined) t.push("label-size", valueText(to.labelSize, ctx.latexToText));
    if (diff("labelAngle") && to.labelAngle !== undefined) t.push("label-angle", valueText(to.labelAngle, ctx.latexToText));
    if (diff("suppressTextOutline") && to.suppressTextOutline) t.push("no-outline");
    if (diff("interactiveLabel") && to.interactiveLabel) t.push("hover");
    if (diff("editableLabelMode") && to.editableLabelMode) t.push(to.editableLabelMode === "MATH" ? "editable-math" : "editable");
  }
  if (diff("onClick") && to.onClick) {
    let action = ctx.latexToText(to.onClick).trim();
    if (/^\(.*\)$/.test(action) && balanced(action.slice(1, -1))) action = action.slice(1, -1); // (a -> 1, b -> 2)
    t.push(`click(${action})`);
  }
  if (diff("clickDescription") && to.clickDescription) t.push("click-label", JSON.stringify(to.clickDescription));
  raw.push(...(ctx.extraRaw ?? []));
  if (raw.length) t.push(`@{ ${raw.join(", ")} }`);
  return t;
}

/** Slider bounds and playback from a raw item, as TMC++ (or "" when it isn't a bounded slider). */
function sliderText(item, latexToText) {
  const s = item.slider;
  if (!s) return "";
  // Desmos keeps old slider settings on expressions that are no longer sliders: only `name = number` is one.
  if (!/^[A-Za-z](_\{?[A-Za-z0-9]+\}?)?=-?\d*\.?\d+$/.test(item.latex ?? "")) return "";
  const v = (x) => (x === undefined || x === "" ? "" : latexToText(String(x)).trim());
  const step = v(s.step);
  // Desmos may keep only one bound (a max with the default min): write [ : 3532.91].
  const bounded = s.min !== undefined || s.max !== undefined;
  let out = bounded ? `[${v(s.min)} : ${v(s.max)}${step && step !== "0" ? ` : ${step}` : ""}]` : "";
  const play = [];
  if (s.isPlaying) play.push("play");
  const mode = { LOOP_FORWARD: "loop", LOOP_FORWARD_REVERSE: "bounce", PLAY_ONCE: "once", PLAY_INDEFINITELY: "forever" }[s.loopMode];
  if (mode && mode !== "bounce") play.push(mode); // bounce is Desmos's default
  if (s.playDirection === -1) play.push("reverse");
  if (s.animationPeriod && s.animationPeriod !== 4000) {
    const ms = s.animationPeriod;
    play.push(ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`);
  }
  return play.length ? `${out} . ${play.join(" ")}`.trim() : out;
}

const q = (s) => JSON.stringify(s);

/**
 * Rebuild TMC++ from a Desmos state.
 * @param {object} state      Calc.getState()
 * @param {object} opts
 * @param {(latex:string)=>string} opts.latexToText  LaTeX -> TMC math text
 * @param {(item:object)=>string} [opts.itemToTmc]   a whole raw item -> TMC text (tables, images)
 * @returns {{ source: string, warnings: string[], fromMeta: boolean }}
 */
export function decompile(state, { latexToText, itemToTmc = null }) {
  const warnings = [];
  const list = state.expressions?.list ?? [];
  const found = readMeta(list);
  const meta = found?.meta ?? null;
  const exprs = meta?.exprs ?? {};
  const classes = meta?.classes ?? {};
  const colors = meta?.colors ?? {};
  const ctx = { latexToText, colorNames: new Map(Object.entries(colors).map(([n, h]) => [h.toLowerCase(), n])) };

  // Header shared by every probe: the palette and classes, so tails mean the same as when written.
  const header = [
    ...Object.entries(colors).map(([n, h]) => `color ${n} ${h}`),
    ...Object.entries(classes).map(([n, toks]) => `class ${n} { ${toks} }`),
  ].join("\n");

  const lines = [];
  if (meta?.settings?.length) lines.push(...meta.settings);
  else {
    const g = state.graph ?? {};
    const vp = g.viewport;
    const parts = [];
    const r = (x) => Math.round(x * 1e4) / 1e4;
    if (vp && !(vp.xmin === -10 && vp.xmax === 10 && vp.ymin === -10 && vp.ymax === 10)) parts.push(`x [${r(vp.xmin)} : ${r(vp.xmax)}] y [${r(vp.ymin)} : ${r(vp.ymax)}]`);
    if (g.degreeMode) parts.push("degrees");
    if (g.showGrid === false) parts.push("no-grid");
    if (g.userLockedViewport) parts.push("lock");
    const raw = [];
    for (const k of ["showXAxis", "showYAxis", "xAxisNumbers", "yAxisNumbers"]) if (g[k] === false) raw.push(`${k}: false`);
    if (g.polarMode) raw.push("polarMode: true");
    if (state.randomSeed && !isWatermarkSeed(state.randomSeed)) raw.push(`randomSeed: ${q(state.randomSeed)}`);
    if (raw.length) parts.push(`@{ ${raw.join(", ")} }`);
    if (parts.length) lines.push(`settings ${parts.join(" ")}`);
  }
  if (lines.length) lines.push("");
  // M8: imports and component definitions go at the top, as written.
  for (const src of meta?.imports ?? []) lines.push(src);
  if (meta?.imports?.length) lines.push("");
  for (const src of meta?.components ?? []) lines.push(src, "");
  // A library's classes and colours come back through its import, not as copies.
  const libClasses = new Set(meta?.libClasses ?? []), libColors = new Set(meta?.libColors ?? []);
  const ownColors = Object.entries(colors).filter(([n]) => !libColors.has(n));
  const ownClasses = Object.entries(classes).filter(([n]) => !libClasses.has(n));
  for (const [n, h] of ownColors) lines.push(`color ${n} ${h}`);
  for (const [n, toks] of ownClasses) lines.push(`class ${n} { ${toks} }`);
  if (ownColors.length || ownClasses.length) lines.push("");

  // Blocks (M8): every item a block produced, and whether all of them are still as compiled.
  const byId = new Map(list.map((e) => [e.id, e]));
  const blockIds = new Map();
  for (const [id, e] of Object.entries(exprs)) if (e.b) (blockIds.get(e.b) ?? blockIds.set(e.b, []).get(e.b)).push(id);
  const intact = new Map();
  for (const [key, ids] of blockIds) intact.set(key, ids.every((id) => byId.has(id) && exprs[id].ih === itemHash(byId.get(id))));
  const warned = new Set(), given = new Set();
  const warnOnce = (key, text) => { if (!warned.has(key)) { warned.add(key); warnings.push(text); } };
  const indented = (src, indent) => src.split("\n").map((l) => (l ? indent + l : l));
  /**
   * An item from a block: the block's source the first time (and nothing after) if it's intact,
   * otherwise null so the item is written out plainly. Library items never come back.
   */
  const fromBlock = (item, indent) => {
    const key = exprs[item.id]?.b;
    if (!key) return null;
    if (key.startsWith("lib:")) {
      if (!intact.get(key)) warnOnce(key, `edits to items from '${key.slice(4)}' were dropped; change the library instead`);
      return [];
    }
    const src = meta.blocks?.[key];
    if (src === undefined) return null;
    if (!intact.get(key)) {
      warnOnce(key, key.startsWith("i:")
        ? `'${key.slice(2)}' was edited in Desmos, so it comes back as plain lines instead of its new line`
        : `the if block on line ${key.slice(2)} was edited in Desmos, so it comes back as piecewise lines`);
      return null;
    }
    if (given.has(key)) return [];
    given.add(key);
    return indented(src, indent);
  };

  const comments = (id, indent) => (exprs[id]?.comments ?? []).map((c) => `${indent}// ${c}`);

  const mathOf = (item) => {
    const e = exprs[item.id];
    if (e?.m !== undefined && e.lh === fnv1a(item.latex)) return { math: e.m, checkMath: e.mc ?? e.m, original: true };
    try { const math = latexToText(item.latex); return { math, checkMath: math, original: false }; }
    catch { warnings.push(`couldn't convert ${item.id}: ${item.latex}`); return { math: `// ${item.latex}`, original: false }; }
  };

  const exprLine = (item, indent) => {
    const e = exprs[item.id];
    // A parametric's t range (0 to 360 in a degree-mode graph, say) or a polar θ range has no
    // token: write it raw, in the shape the bundled Text Mode reads: domain: @{ min, max }.
    // Desmos stores an untouched bound as "" (not missing): that means its default.
    const polar = !item.parametricDomain && item.polarDomain;
    const pd = item.parametricDomain ?? item.polarDomain;
    const [d0, d1] = polar ? ["0", "12 * pi"] : ["0", "1"];
    const bound = (x, d) => (x === undefined || x === null || String(x).trim() === "" ? d : valueText(x, latexToText));
    const lo = pd ? bound(pd.min, d0) : d0, hi = pd ? bound(pd.max, d1) : d1;
    ctx.extraRaw = lo !== d0 || hi !== d1 ? [`domain: @{ min: ${lo}, max: ${hi} }`] : [];
    const { math, checkMath } = mathOf(item);
    const actual = styleView(item);
    const join = (tail) => `${indent}${math}${tail ? "  " + tail : ""}`;

    if (e?.tail !== undefined) {
      // Unchanged since compiling: the tail exactly as written.
      const full = probe(header, `${checkMath} ${e.tc ?? e.tail}`);
      if (full && sameStyle(full, actual) && sliderView(full.item.slider) === sliderView(item.slider)) return join(e.tail);
      // Restyled in Desmos: keep the classes, override only what changed.
      const tags = (e.tags ?? []).map((t) => `.${t}`);
      const base = probe(header, `${checkMath} ${(e.tagsc ?? e.tags ?? []).map((t) => `.${t}`).join(" ")}`.trim());
      const from = base ? styleView(base.item) : {};
      if (!(base?.explicitColor) && AUTO_COLORS.has((actual.color ?? "").toLowerCase())) { delete from.color; delete actual.color; }
      const over = overrideTokens(from, actual, ctx);
      const style = tags.length ? [...tags, ...over].join(" ") : over.length ? ". " + over.join(" ") : "";
      return join([sliderText(item, latexToText), style].filter(Boolean).join(" "));
    }

    // No metadata: math plus what differs from TMC's defaults. On a TMC++ graph this item was added
    // in Desmos, so an automatic colour is noise; on a hand-made graph every colour was chosen.
    const base = probe("", checkMath);
    const from = base ? styleView(base.item) : {};
    if (meta && AUTO_COLORS.has((actual.color ?? "").toLowerCase())) { delete from.color; delete actual.color; }
    else delete from.color; // always state the colour of a hand-made item
    const over = overrideTokens(from, actual, ctx);
    return join([sliderText(item, latexToText), over.length ? ". " + over.join(" ") : ""].filter(Boolean).join(" "));
  };

  const itemLines = (item, indent) => {
    const block = fromBlock(item, indent);
    if (block) return block;
    const out = comments(item.id, indent);
    if (item.type === "text") out.push(`${indent}${q(item.text ?? "")}`);
    else if (item.type === "expression") {
      if (!(item.latex ?? "").trim()) return out; // an empty row in the Desmos list
      // One value that won't convert (a slider bound, a colour, a click action) must not sink the
      // whole rebuild: keep the math and say what was dropped.
      try { out.push(exprLine(item, indent)); }
      catch (e) {
        warnings.push(`couldn't convert the style of ${item.id}: ${e.message}`);
        out.push(`${indent}${mathOf(item).math}`);
      }
    }
    else if (itemToTmc) {
      // Convert the item on its own: its folder is written around it here, not by the converter.
      const { folderId, ...alone } = item;
      try { out.push(...itemToTmc(alone).split("\n").map((l) => indent + l)); }
      catch (e) {
        warnings.push(`couldn't convert ${item.type} ${item.id}: ${e.message}`);
        out.push(`${indent}// (left out: ${item.type} ${item.id}, which couldn't be converted)`);
      }
    }
    else warnings.push(`skipped a ${item.type} (no converter)`);
    return out;
  };

  const top = list.filter((e) => e.id !== META_ID && !e.folderId);
  for (const item of top) {
    const block = item.type === "folder" ? fromBlock(item, "") : null;
    if (block) {
      // An intact instance: its new line. Lines added to its folder in Desmos follow it.
      lines.push(...block);
      for (const child of list.filter((e) => e.folderId === item.id && !exprs[e.id]?.b)) lines.push(...itemLines(child, ""));
      continue;
    }
    if (item.type === "folder") {
      const flags = [item.collapsed && "collapsed", item.hidden && "hidden"].filter(Boolean).join(" ");
      lines.push(...comments(item.id, ""));
      lines.push(`folder ${q(item.title ?? "")}${flags ? " " + flags : ""} {`);
      for (const child of list.filter((e) => e.folderId === item.id)) lines.push(...itemLines(child, "  "));
      lines.push("}", "");
    } else {
      lines.push(...itemLines(item, ""));
    }
  }
  const ticker = state.expressions?.ticker;
  if (ticker?.handlerLatex && meta?.ticker?.lh === fnv1a(`${ticker.handlerLatex}|${ticker.minStepLatex ?? ""}`)) {
    lines.push(meta.ticker.src); // unchanged since compiling: as written
  } else if (ticker?.handlerLatex) {
    const parts = [];
    if (ticker.playing) parts.push("play");
    if (ticker.minStepLatex && ticker.minStepLatex !== "0") parts.push(`${valueText(ticker.minStepLatex, latexToText)}ms`);
    lines.push(`ticker ${latexToText(ticker.handlerLatex)}${parts.length ? " . " + parts.join(" ") : ""}`);
  }
  // Comments whose items were deleted in Desmos.
  const live = new Set(list.map((e) => e.id));
  const orphans = Object.entries(exprs).filter(([id, e]) => !live.has(id) && e.comments?.length);
  if (orphans.length) {
    lines.push("", "// orphaned comments (their items were deleted in Desmos)");
    for (const [, e] of orphans) for (const c of e.comments) lines.push(`// ${c}`);
  }
  return { source: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", warnings, fromMeta: !!meta };
}
