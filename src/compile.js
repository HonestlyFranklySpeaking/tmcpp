// TMC++ v1 compiler: TMC++ source -> DesModder Text Mode (TMC) text.
// Covers spec milestones M1 (lines, notes, folders, sliders) and M2 (classes, inline styles).

import { implicitMultiply } from "./implicit.js";
import { parseTmcObject, mergeTmc, writeTmcObject } from "./tmcobject.js";
import { rewriteDoubleInequality, rewriteRedefinition, rewriteSegments, functionDefs } from "./rewrite.js";
import { fnv1a } from "./meta.js";

const NAMED_COLORS = {
  red: "RED", blue: "BLUE", green: "GREEN",
  purple: "PURPLE", orange: "ORANGE", black: "BLACK",
};
const LINE_STYLES = { solid: "SOLID", dashed: "DASHED", dotted: "DOTTED" };
const DRAG_MODES = { x: "X", y: "Y", xy: "XY", none: "NONE", auto: "AUTO" };
const ORIENTATIONS = [
  "default", "center", "center-auto", "auto-center", "above", "above-left",
  "above-right", "above-auto", "below", "below-left", "below-right", "below-auto",
  "left", "auto-left", "right", "auto-right",
];
const EDITABLE = { editable: "TEXT", "editable-math": "MATH" };
const LOOP_MODES = {
  loop: "LOOP_FORWARD", bounce: "LOOP_FORWARD_REVERSE",
  once: "PLAY_ONCE", forever: "PLAY_INDEFINITELY",
};
const VOCAB = [
  "solid", "dashed", "dotted", "width", "opacity", "fill",
  "point", "drag", "hidden", "label", "label-size", "label-angle",
  "no-outline", "hover", ...Object.keys(EDITABLE), ...ORIENTATIONS,
  "play", "reverse", ...Object.keys(LOOP_MODES),
  "open", "cross", "point-opacity", "pinned", "secret", "fraction",
];
const OPEN = "([{", CLOSE = ")]}";

// ---------- small helpers ----------

/** Remove a // comment that is outside string literals. Returns [code, comment]. */
function splitComment(line) {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && inStr) { i++; continue; }
    if (c === '"') inStr = !inStr;
    else if (!inStr && c === "/" && line[i + 1] === "/") {
      return [line.slice(0, i), line.slice(i + 2).trim()];
    }
  }
  return [line, null];
}

/** Net bracket depth of a string, ignoring brackets inside strings. */
function bracketDepth(s) {
  let d = 0, inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && inStr) { i++; continue; }
    if (c === '"') inStr = !inStr;
    else if (!inStr && OPEN.includes(c)) d++;
    else if (!inStr && CLOSE.includes(c)) d--;
  }
  return d;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length][b.length];
}

function closest(word, list) {
  let best = null, bestD = Infinity;
  for (const w of list) {
    const d = levenshtein(word, w);
    if (d < bestD) { bestD = d; best = w; }
  }
  return bestD <= 2 ? best : null;
}

const isHeader = (s) => /^(folder|class|table)\b/.test(s);
const endsWithOperator = (s) => /([+\-*/^=,<>]|\\le|\\ge)\s*$/.test(s);

// ---------- pass 1: join physical lines into logical statements ----------

/**
 * @returns {{text: string, line: number, comments: string[]}[]}
 * `line` is the 1-based source line where the statement starts.
 */
function toStatements(source) {
  const raw = source.split(/\r?\n/);
  const out = [];
  let pendingComments = [];
  let cur = null; // { text, line, comments, indent }

  const flush = () => {
    if (cur) { out.push(cur); cur = null; }
  };

  for (let i = 0; i < raw.length; i++) {
    const physical = raw[i];
    const [codeRaw, comment] = splitComment(physical);
    const indent = physical.match(/^\s*/)[0].length;
    let code = codeRaw.trim();

    // A deeper-indented line that starts with an operator continues the previous one.
    if (cur && code && indent > cur.indent && /^[+\-*/^=]/.test(code)
        && !isHeader(cur.text)) {
      cur.text += " " + code;
      if (comment) cur.comments.push(comment);
      continue;
    }

    if (cur && cur.open) {
      // Still inside an unfinished statement: append.
      if (code) cur.text += " " + code;
      if (comment) cur.comments.push(comment);
    } else {
      if (!code) {
        if (comment) pendingComments.push(comment);
        continue;
      }
      flush();
      cur = { text: code, line: i + 1, indent, comments: pendingComments, open: false };
      if (comment) cur.comments.push(comment);
      pendingComments = [];
    }

    // Decide whether this statement continues on the next line.
    let t = cur.text;
    let explicit = false;
    if (t.endsWith("\\")) {
      t = t.slice(0, -1).trimEnd();
      explicit = true;
    }
    t = t.replace(/;+\s*$/, "").trimEnd(); // optional CSS-style semicolon
    cur.text = t;

    const folderOpen = /^(folder|table)\b/.test(t) && t.endsWith("{");
    const classUnclosed = /^class\b/.test(t) && bracketDepth(t) > 0;
    const exprUnclosed = !isHeader(t) && bracketDepth(t) > 0;
    cur.open = explicit || classUnclosed ||
      (!folderOpen && (exprUnclosed || endsWithOperator(t)));
  }
  flush();
  if (pendingComments.length) {
    out.push({ text: "", line: raw.length, comments: pendingComments, orphan: true });
  }
  return out;
}

// ---------- style tails ----------

/** Find where the style tail starts in a math statement, or -1. */
function findTailStart(s) {
  let depth = 0, inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && inStr) { i++; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    if (depth !== 0 || i === 0 || !/\s/.test(s[i - 1])) continue;
    const next = s[i + 1] ?? "";
    if (c === "#" && !/^#\s*\{/.test(s.slice(i))) return i;
    if (c === "." && (/[A-Za-z]/.test(next) || next === "" || /\s/.test(next))) return i;
    if (c === "@" && next === "{") return i;
    if (/^label\s+"/.test(s.slice(i))) return i;
  }
  return -1;
}

/** Split off a trailing raw @{ ... } block. Returns [rest, rawInner|null]. */
function splitRaw(tail) {
  const at = tail.indexOf("@{");
  if (at === -1) return [tail, null];
  const block = tail.slice(at);
  if (bracketDepth(block) !== 0 || !block.endsWith("}")) {
    throw new Error("Unclosed @{ } block");
  }
  return [tail.slice(0, at).trim(), block.slice(2, -1).trim()];
}

function tokenizeTail(tail) {
  return tail.match(/"(?:[^"\\]|\\.)*"|[^\s;"]+/g) ?? [];
}

/**
 * Apply style tokens onto a style object (later wins).
 * `classes` maps name -> token list. `seen` guards against cycles.
 */
function applyTokens(tokens, style, ctx, seen = new Set()) {
  const { classes, errors, warnings, line } = ctx;
  const set = (path, value, label) => {
    let o = style;
    for (const k of path.slice(0, -1)) o = o[k] ??= {};
    const key = path.at(-1);
    if (o[key] !== undefined && ctx.localKeys?.has(path.join("."))) {
      warnings.push({ line, message: `'${label}' set twice in one tail; the later value wins` });
    }
    ctx.localKeys?.add(path.join("."));
    o[key] = value;
  };
  // A number, or an expression written without spaces (e.g. 0.9*(1-t)).
  const num = (i, name) => {
    const v = tokens[i + 1];
    const looksLikeToken = v !== undefined && (/^[.#"]/.test(v) || VOCAB.includes(v.toLowerCase()));
    if (v === undefined || looksLikeToken) {
      errors.push({ line, message: `'${name}' needs a number or a no-space expression` });
      return null;
    }
    return isNaN(Number(v)) ? implicitMultiply(v) : Number(v);
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === ".") continue; // anonymous tail marker
    if (t.startsWith(".")) {
      const name = t.slice(1);
      if (!classes.has(name)) {
        const hint = closest(name, [...classes.keys()]);
        errors.push({ line, message: `Unknown class '.${name}'` + (hint ? ` (did you mean '.${hint}'?)` : "") });
        continue;
      }
      if (seen.has(name)) { errors.push({ line, message: `Class '.${name}' refers to itself` }); continue; }
      const saved = ctx.localKeys;
      ctx.localKeys = null; // duplicates across classes are normal overrides
      applyTokens(classes.get(name).tokens, style, ctx, new Set([...seen, name]));
      ctx.localKeys = saved;
      continue;
    }
    if (t.startsWith("#")) {
      const v = t.slice(1);
      const named = ctx.colors?.get(v.toLowerCase());
      if (named) set(["color"], `"${named.hex}"`, "color");
      else if (/^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{3}$/.test(v)) set(["color"], `"#${v.toLowerCase()}"`, "color");
      else if (NAMED_COLORS[v.toLowerCase()]) set(["color"], NAMED_COLORS[v.toLowerCase()], "color");
      else {
        const known = [...Object.keys(NAMED_COLORS), ...(ctx.colors?.keys() ?? [])];
        const hint = closest(v.toLowerCase(), known);
        errors.push({ line, message: `Unknown color '${t}'` + (hint ? ` (did you mean '#${hint}'?)` : ` (use #rrggbb, a built-in like #red, or define one: color name #rrggbb)`) });
      }
      continue;
    }
    const lower = t.toLowerCase();
    if (LINE_STYLES[lower]) { set(["lines", "style"], `"${LINE_STYLES[lower]}"`, "line style"); continue; }
    if (lower === "hidden") { set(["hidden"], "true", "hidden"); continue; }
    if (lower === "width" || lower === "opacity") {
      const n = num(i, lower); if (n !== null) { set(["lines", lower], n, lower); i++; } continue;
    }
    if (lower === "fill") { const n = num(i, "fill"); if (n !== null) { set(["fill"], n, "fill"); i++; } continue; }
    if (lower === "point") { const n = num(i, "point"); if (n !== null) { set(["points", "size"], n, "point size"); i++; } continue; }
    if (lower === "drag") {
      const m = DRAG_MODES[(tokens[i + 1] ?? "").toLowerCase()];
      if (!m) errors.push({ line, message: `'drag' needs one of: ${Object.keys(DRAG_MODES).join(", ")}` });
      else { set(["points", "drag"], `"${m}"`, "drag"); i++; }
      continue;
    }
    if (lower === "label") {
      const v = tokens[i + 1];
      if (!v || !v.startsWith('"')) errors.push({ line, message: "'label' needs a string, e.g. label \"A\"" });
      else { set(["label", "text"], v, "label"); i++; }
      continue;
    }
    if (lower === "label-size" || lower === "label-angle") {
      const v = tokens[i + 1];
      if (v === undefined) errors.push({ line, message: `'${lower}' needs a value` });
      else { set(["label", lower === "label-size" ? "size" : "angle"], v, lower); i++; }
      continue;
    }
    if (ORIENTATIONS.includes(lower)) { set(["label", "orientation"], `"${lower.replace(/-/g, "_")}"`, "label position"); continue; }
    if (lower === "no-outline") { set(["label", "outline"], "false", "no-outline"); continue; }
    if (lower === "hover") { set(["label", "showOnHover"], "true", "hover"); continue; }
    if (EDITABLE[lower]) { set(["label", "editableMode"], `"${EDITABLE[lower]}"`, "editable"); continue; }
    // Point style and opacity
    if (lower === "open" || lower === "cross") { set(["points", "style"], `"${lower.toUpperCase()}"`, "point style"); continue; }
    if (lower === "point-opacity") { const n = num(i, "point-opacity"); if (n !== null) { set(["points", "opacity"], n, "point-opacity"); i++; } continue; }
    // Common item flags
    if (lower === "pinned" || lower === "secret") { set([lower], "true", lower); continue; }
    if (lower === "fraction") { set(["displayEvaluationAsFraction"], "true", "fraction"); continue; }
    // Slider playback
    if (lower === "play") { set(["slider", "playing"], "true", "play"); continue; }
    if (lower === "reverse") { set(["slider", "reversed"], "true", "reverse"); continue; }
    if (LOOP_MODES[lower]) { set(["slider", "loopMode"], `"${LOOP_MODES[lower]}"`, "loop mode"); continue; }
    const dur = lower.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
    if (dur) { set(["slider", "period"], Math.round(Number(dur[1]) * (dur[2] === "s" ? 1000 : 1)), "duration"); continue; }
    const hint = closest(lower, VOCAB);
    errors.push({ line, message: `Unknown style token '${t}'` + (hint ? ` (did you mean '${hint}'?)` : "") });
  }
  return style;
}

/** Serialise a style object to TMC `@{ ... }` syntax. */
function styleToTmc(style, rawInner) {
  const merged = rawInner ? mergeTmc(style, parseTmcObject(rawInner)) : style;
  const w = writeTmcObject(merged);
  return w ? " " + w : "";
}

// Watermark: the graph's randomSeed starts with "TMC++" in ASCII hex, then a version byte.
// It looks like any Desmos seed (32 hex chars) and is never shown in the UI.
export const WATERMARK = "544d432b2b"; // T M C + +
export const WATERMARK_VERSION = "01";
export const isWatermarkSeed = (seed) => typeof seed === "string" && seed.startsWith(WATERMARK);

/** A watermarked seed whose tail is derived from the source, so the same source gives the same seed. */
export function watermarkSeed(source) {
  const tail = (fnv1a(source) + fnv1a("1" + source) + fnv1a("2" + source)).slice(0, 20);
  return WATERMARK + WATERMARK_VERSION + tail;
}

/** Desmos defaults written at the top of every compiled graph; override with `settings`. */
export const DEFAULT_SETTINGS = {
  viewport: { xmin: "-10", xmax: "10", ymin: "-10", ymax: "10" },
};

/**
 * Read a settings statement onto `settings`. Accepts TMC++ shorthand
 * (x [a : b], y [a : b], degrees, radians) and/or a raw TMC @{ } block.
 */
function applySettings(text, settings, errors, line) {
  let rest = text.replace(/^settings\b/, "").trim();
  let raw = null;
  const at = rest.indexOf("@{");
  if (at !== -1) {
    const block = rest.slice(at).trim();
    if (!block.endsWith("}")) { errors.push({ line, message: "Unclosed settings @{ }" }); return settings; }
    raw = block.slice(2, -1);
    rest = rest.slice(0, at).trim();
  }
  const re = /([xy])\s*\[\s*([^:\]]+?)\s*:\s*([^\]]+?)\s*\]|(\S+)/g;
  let m;
  while ((m = re.exec(rest))) {
    if (m[1]) {
      settings = mergeTmc(settings, { viewport: { [m[1] + "min"]: m[2], [m[1] + "max"]: m[3] } });
    } else if (m[4] === "no-grid") {
      settings = mergeTmc(settings, { showGrid: "false" });
    } else if (m[4] === "lock") {
      settings = mergeTmc(settings, { lockViewport: "true" });
    } else if (m[4] === "degrees" || m[4] === "radians") {
      settings = mergeTmc(settings, { degreeMode: m[4] === "degrees" ? "true" : "false" });
    } else {
      errors.push({ line, message: `Unknown settings token '${m[4]}' (use x [min : max], y [min : max], degrees, radians, no-grid, lock, or @{ })` });
    }
  }
  if (raw !== null) {
    try { settings = mergeTmc(settings, parseTmcObject(raw)); }
    catch (e) { errors.push({ line, message: e.message }); }
  }
  return settings;
}

// ---------- pass 2: compile statements ----------

/**
 * Compile TMC++ to TMC.
 * @returns {{ tmc: string, errors: {line:number,message:string}[], warnings: {line:number,message:string}[],
 *             lineMap: number[], classes: Map }}
 * lineMap[i] = TMC++ source line for TMC output line i (0-based).
 */
export function compile(source, { defaultSettings = DEFAULT_SETTINGS, randomSeed, watermark = true } = {}) {
  const errors = [], warnings = [];
  const statements = toStatements(source);
  const classes = new Map();

  // Hoist colour definitions: color water #092635  ->  #water anywhere a colour goes.
  const colors = new Map();
  for (const st of statements) {
    if (!/^color\s+[A-Za-z_]/.test(st.text)) continue;
    st.skip = true;
    const m = st.text.match(/^color\s+([A-Za-z_][\w-]*)\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
    if (!m) { errors.push({ line: st.line, message: "Malformed color; expected: color name #rrggbb" }); continue; }
    const name = m[1].toLowerCase();
    if (NAMED_COLORS[name]) { errors.push({ line: st.line, message: `'${m[1]}' is a built-in colour; pick another name` }); continue; }
    if (/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(name)) { errors.push({ line: st.line, message: `'${m[1]}' looks like a hex code; pick a name that isn't one` }); continue; }
    if (colors.has(name)) { errors.push({ line: st.line, message: `Color '${m[1]}' is already defined on line ${colors.get(name).line}` }); continue; }
    colors.set(name, { hex: "#" + m[2].toLowerCase(), line: st.line });
  }

  // Hoist class definitions.
  for (const st of statements) {
    const m = st.text.match(/^class\s+([A-Za-z_][\w-]*)\s*\{([\s\S]*)\}$/);
    if (/^class\b/.test(st.text) && !m) {
      errors.push({ line: st.line, message: "Malformed class definition; expected: class name { tokens }" });
      st.skip = true;
      continue;
    }
    if (!m) continue;
    st.skip = true;
    if (classes.has(m[1])) {
      errors.push({ line: st.line, message: `Class '${m[1]}' is already defined on line ${classes.get(m[1]).line}` });
      continue;
    }
    classes.set(m[1], { tokens: tokenizeTail(m[2]), line: st.line });
  }
  // Validate class bodies once, at their definition.
  for (const [, def] of classes) {
    applyTokens(def.tokens, {}, { classes, colors, errors, warnings: [], line: def.line });
  }

  const fnDefs = functionDefs(statements.filter((st) => !st.skip));
  const out = [], lineMap = [];
  // One entry per graph item, in emission order: what the metadata note remembers about it.
  const items = [];
  const record = (item) => {
    const table = folderStack.at(-1)?.kind === "table" ? folderStack.at(-1).item : null;
    if (table && item.kind === "expr") table.columns.push(item);
    else items.push(item);
  };
  const push = (text, line) => { out.push(text); lineMap.push(line); };
  const folderStack = [];
  let settings = defaultSettings;

  for (const st of statements) {
    if (st.skip || st.orphan) continue;
    const { text, line } = st;

    // Folder open
    const fm = text.match(/^folder\s+("(?:[^"\\]|\\.)*")\s*([\w\s]*?)\s*\{$/);
    if (fm) {
      if (folderStack.length) {
        errors.push({ line, message: folderStack.at(-1).kind === "table"
          ? "A folder cannot go inside a table"
          : "Folders cannot be nested (Desmos has no folders inside folders)" });
      }
      const flags = fm[2].split(/\s+/).filter(Boolean);
      const style = {};
      for (const f of flags) {
        if (f === "collapsed" || f === "hidden") style[f] = "true";
        else errors.push({ line, message: `Unknown folder flag '${f}' (use collapsed, hidden)` });
      }
      const item = { kind: "folder", line, comments: st.comments };
      items.push(item);
      folderStack.push({ line, style, kind: "folder", item });
      push(`folder ${fm[1]} {`, line);
      continue;
    }

    // Table open: table [pinned] [secret] {
    const tm = text.match(/^table\s*([\w\s]*?)\s*\{$/);
    if (tm) {
      if (folderStack.some((f) => f.kind === "table")) errors.push({ line, message: "Tables cannot be nested" });
      const style = {};
      for (const f of tm[1].split(/\s+/).filter(Boolean)) {
        if (f === "pinned" || f === "secret") style[f] = "true";
        else errors.push({ line, message: `Unknown table flag '${f}' (use pinned, secret)` });
      }
      const item = { kind: "table", line, comments: st.comments, columns: [] };
      items.push(item);
      folderStack.push({ line, style, kind: "table", item });
      push("table {", line);
      continue;
    }
    if (/^table\b/.test(text)) {
      errors.push({ line, message: "Malformed table; expected: table [pinned] [secret] {" });
      continue;
    }
    if (/^folder\b/.test(text)) {
      errors.push({ line, message: 'Malformed folder; expected: folder "Name" [collapsed] [hidden] {' });
      continue;
    }

    // Folder close
    if (text === "}") {
      const f = folderStack.pop();
      if (!f) { errors.push({ line, message: "Unmatched '}'" }); continue; }
      push(`}${styleToTmc(f.style)};`, line);
      continue;
    }

    // Note: a line that is only a string literal
    if (/^"(?:[^"\\]|\\.)*"$/.test(text)) {
      record({ kind: "note", line, comments: st.comments });
      push(`${text};`, line);
      continue;
    }

    // Settings: merged into one block written at the top
    if (/^settings\b/.test(text)) {
      settings = applySettings(text, settings, errors, line);
      continue;
    }

    // Ticker: ticker <action> [play] [2s] [@{ }]
    if (/^ticker\b/.test(text)) {
      let body = text.replace(/^ticker\b/, "").trim(), tail = "";
      const tts = findTailStart(" " + body);
      if (tts !== -1) { tail = body.slice(tts - 1).trim(); body = body.slice(0, tts - 1).trim(); }
      let raw = null;
      try { [tail, raw] = splitRaw(tail); } catch (e) { errors.push({ line, message: e.message }); }
      const style = {};
      for (const t of tokenizeTail(tail)) {
        const d = t.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
        if (t === ".") continue;
        if (t === "play") style.playing = "true";
        else if (d) style.minStep = Math.round(Number(d[1]) * (d[2] === "s" ? 1000 : 1));
        else errors.push({ line, message: `Unknown ticker token '${t}' (use play, a step time like 2s or 500ms, or @{ })` });
      }
      let styled = "";
      try { styled = styleToTmc(style, raw); } catch (e) { errors.push({ line, message: e.message }); }
      push(`ticker ${implicitMultiply(body)}${styled};`, line);
      continue;
    }

    // Images are passed through as plain TMC in v1
    if (/^image\b/.test(text)) {
      record({ kind: "image", line, comments: st.comments });
      push(text.endsWith(";") ? text : `${text};`, line);
      continue;
    }

    // Math statement: [math] [slider bounds] [tail]
    let math = text, tail = "";
    const ts = findTailStart(text);
    if (ts !== -1) { math = text.slice(0, ts).trim(); tail = text.slice(ts).trim(); }
    const tags = tokenizeTail(tail).filter((t) => /^\.[A-Za-z_]/.test(t)).map((t) => t.slice(1));

    const style = {};
    let mathWritten = math;
    const sm = math.match(/^(.*\S)\s+\[([^\[\],]*:[^\[\],]*)\]$/);
    if (sm) {
      math = sm[1];
      mathWritten = sm[1];
      const parts = sm[2].split(":").map((p) => p.trim());
      if (parts.length < 2 || parts.length > 3 || parts.some((p) => p === "")) {
        errors.push({ line, message: "Slider bounds must be [min : max] or [min : max : step]" });
      } else {
        const [lo, hi, step = "0"] = parts.map((p) => implicitMultiply(p));
        style.slider = { min: lo, max: hi, step };
      }
    }

    // A style word left in the math means the tail never started (e.g. "(1, 2) point 5").
    // Multi-letter variable names are legal in TMC, so only flag a style word that sits
    // right after a finished operand, where it could only be a forgotten tail.
    const stray = math.replace(/"(?:[^"\\]|\\.)*"/g, "").match(
      new RegExp(`[\\w)\\]]\\s+(${VOCAB.filter((w) => !w.includes("-")).join("|")})(?=\\s|$)`));
    if (stray) {
      errors.push({ line, message: `Style word '${stray[1]}' is inside the math; start the style tail with '.' (e.g. '. ${stray[1]} ...')` });
    }
    const segs = rewriteSegments(math);
    if (segs.error) errors.push({ line, message: segs.error });
    else math = segs.math;
    const dbl = rewriteDoubleInequality(math);
    if (dbl.error) errors.push({ line, message: dbl.error });
    else math = dbl.math;
    const redef = rewriteRedefinition(math, line, fnDefs);
    if (redef.note) warnings.push({ line, message: redef.note });
    math = redef.math;
    math = implicitMultiply(math);
    let rawInner = null;
    try { [tail, rawInner] = splitRaw(tail); }
    catch (e) { errors.push({ line, message: e.message }); }

    applyTokens(tokenizeTail(tail), style, { classes, colors, errors, warnings, line, localKeys: new Set() });
    let styled = "";
    try { styled = styleToTmc(style, rawInner); }
    catch (e) { errors.push({ line, message: e.message }); }
    record({ kind: "expr", line, comments: st.comments, tags, tail: text.slice(mathWritten.length).trim() });
    push(`${math}${styled};`, line);
  }

  for (const f of folderStack) errors.push({ line: f.line, message: `${f.kind === "table" ? "Table" : "Folder"} is never closed` });
  for (const st of statements) {
    if (st.orphan) warnings.push({ line: st.line, message: "Comments at the end of the file are not attached to any statement" });
  }

  // A seed set in the source always wins; otherwise keep the graph's seed or make a watermarked one.
  if (watermark && settings.randomSeed === undefined) {
    settings = mergeTmc(settings, { randomSeed: JSON.stringify(randomSeed ?? watermarkSeed(source)) });
  }
  const header = writeTmcObject(settings);
  if (header) { out.unshift(`settings ${header};`, ""); lineMap.unshift(0, 0); }

  errors.sort((a, b) => a.line - b.line);
  return { tmc: out.join("\n"), errors, warnings, lineMap, classes, items };
}
