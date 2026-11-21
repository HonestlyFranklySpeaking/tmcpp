// Math rewrites that keep TMC++ code natural while producing something Desmos accepts.

const OPEN = "([{", CLOSE = ")]}";

/** Split at top-level comparison operators (<, <=, >, >=), skipping brackets, strings and ->. */
export function splitComparisons(s) {
  const parts = [], ops = [];
  let depth = 0, inStr = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && inStr) { i++; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (depth === 0 && (c === "<" || c === ">")) {
      if (c === ">" && s[i - 1] === "-") continue; // -> update rule
      const op = s[i + 1] === "=" ? c + "=" : c;
      parts.push(s.slice(start, i).trim());
      ops.push(op);
      i += op.length - 1;
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return { parts, ops };
}

const wrap = (e) => (/^-?[\w.]+$/.test(e) ? e : `(${e})`);

/**
 * Desmos only draws "solved" double inequalities (middle term x or y).
 * Rewrite a < f < b  ->  max(a - f, f - b) < 0   (and the > direction likewise).
 * Returns { math, note } where note explains a rewrite, or { error }.
 */
export function rewriteDoubleInequality(math) {
  const { parts, ops } = splitComparisons(math);
  if (ops.length !== 2) return { math };
  const [lo, mid, hi] = parts;
  if (/^[xy]$/.test(mid)) return { math }; // solved: Desmos handles it
  const up = ops.every((o) => o[0] === "<"), down = ops.every((o) => o[0] === ">");
  if (!up && !down) return { error: "A double inequality must point one way (a < f < b or a > f > b)" };
  const m = wrap(mid);
  const [a, b] = up ? [wrap(lo), wrap(hi)] : [wrap(hi), wrap(lo)];
  const strict = ops.some((o) => o.length === 1) ? "<" : "<=";
  return { math: `max(${a} - ${m}, ${m} - ${b}) ${strict} 0`, note: "double inequality drawn as max(...) < 0" };
}

/** Collect functions defined as name(args) = ..., keyed by name, first definition wins. */
export function functionDefs(statements) {
  const defs = new Map();
  for (const st of statements) {
    const m = st.text.match(/^([A-Za-z][A-Za-z0-9_]*)\(([^()]*)\)\s*=(?!=)/);
    if (m && !defs.has(m[1])) defs.set(m[1], st.line);
  }
  return defs;
}

/**
 * `q(x,y) = [0.5, 0.6]` after q is defined is read by Desmos as a second definition of q.
 * Rewrite it to `q(x,y) - ([0.5, 0.6]) = 0` so it draws the level curves.
 */
export function rewriteRedefinition(math, line, defs) {
  const m = math.match(/^([A-Za-z][A-Za-z0-9_]*)\(([^()]*)\)\s*=(?!=)(.*)$/);
  if (!m || !defs.has(m[1]) || defs.get(m[1]) === line) return { math };
  return {
    math: `${m[1]}(${m[2]}) - (${m[3].trim()}) = 0`,
    note: `${m[1]} is defined on line ${defs.get(m[1])}, so this is drawn as the curve ${m[1]}(${m[2]}) = ... instead of redefining it`,
  };
}

/** Split a call's argument text on top-level commas. */
function splitArgs(s) {
  const out = [];
  let depth = 0, inStr = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && inStr) { i++; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  out.push(s.slice(start).trim());
  return out.filter((a) => a !== "");
}

/** If `s` is exactly name(...), return the inside of the parentheses. */
function callBody(s, name) {
  if (!s.startsWith(name + "(") || !s.endsWith(")")) return null;
  let depth = 0;
  for (let i = name.length; i < s.length; i++) {
    if (OPEN.includes(s[i])) depth++;
    else if (CLOSE.includes(s[i])) depth--;
    if (depth === 0 && i < s.length - 1) return null; // the call closes before the end
  }
  return s.slice(name.length + 1, -1);
}

/**
 * Desmos's graphing calculator has no segment() (only the Geometry calculator does), so:
 *   segment(A, B)  ->  (1 - t) * (A) + t * (B)          A, B: points or lists of points
 *   path(P)        ->  segments joining P's points in order
 * Returns { math } or { error }.
 */
export function rewriteSegments(math) {
  const seg = callBody(math, "segment");
  const path = seg === null ? callBody(math, "path") : null;
  if (seg === null && path === null) return { math };
  const args = splitArgs(seg ?? path);
  const usesT = args.some((a) => /(^|[^A-Za-z0-9_.])t([^A-Za-z0-9_]|$)/.test(a));
  if (usesT) return { error: `${seg !== null ? "segment" : "path"}() uses t to draw the line, so its points can't use t` };
  if (seg !== null) {
    if (args.length !== 2) return { error: "segment() takes two points (or two lists of points): segment(A, B)" };
    return { math: `(1 - t) * (${args[0]}) + t * (${args[1]})` };
  }
  if (args.length !== 1) return { error: "path() takes one list of points: path([(0,0), (1,2), (2,0)])" };
  const P = /^[A-Za-z][A-Za-z0-9_]*$/.test(args[0]) ? args[0] : `(${args[0]})`;
  return { math: `(1 - t) * (${P}[1...length(${P}) - 1]) + t * (${P}[2...length(${P})])` };
}

/** Index of the bracket that closes the one opening at `open` (strings skipped), or -1. */
function closeOf(s, open) {
  let depth = 0, inStr = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c) && --depth === 0) return i;
  }
  return -1;
}
function openOf(s, close) {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (CLOSE.includes(s[i])) depth++;
    else if (OPEN.includes(s[i]) && --depth === 0) return i;
  }
  return -1;
}
/** Is there a ':' at the top level of this group's inside? (Then it's a piecewise, not a restriction.) */
function hasTopColon(inner) {
  let depth = 0;
  for (const c of inner) {
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (c === ":" && depth === 0) return true;
  }
  return false;
}
/** Position just after the top-level relation (=, <, >, <=, >=; not ->), or 0 if there is none. */
function afterRelation(s) {
  let depth = 0, inStr = false, at = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (depth === 0 && "=<>".includes(c) && !(c === ">" && s[i - 1] === "-")) {
      at = s[i + 1] === "=" ? i + 2 : i + 1;
      if (s[i + 1] === "=") i++;
    }
  }
  return at;
}

/**
 * Desmos restrictions: `y = 2x {0 < x < 1}` (one or more {condition} groups after the math).
 * The parser we ship can't read them, so they become a piecewise around the right-hand side:
 *   y = {0 < x < 1: 2x}      x^2 + y^2 < {y > 0: {x > 0: 4}}      (P) {t > 0} -> {t > 0: P}
 * When a condition is false the side is undefined, so nothing is drawn there, exactly as before.
 */
export function rewriteRestrictions(math) {
  let s = math.trimEnd();
  const conds = [];
  while (s.endsWith("}")) {
    const open = openOf(s, s.length - 1);
    if (open <= 0) break;
    const inner = s.slice(open + 1, -1);
    const before = s.slice(0, open).trimEnd();
    if (hasTopColon(inner) || !/[\w)\]}.]$/.test(before)) break; // a piecewise value, not a restriction
    conds.unshift(inner.trim());
    s = before;
  }
  if (!conds.length) return { math };
  const at = afterRelation(s);
  const head = s.slice(0, at), body = s.slice(at).trim();
  const wrapped = conds.reduceRight((v, c) => `{${c}: ${v}}`, body);
  return { math: at ? `${head.trimEnd()} ${wrapped}` : wrapped };
}

/**
 * Desmos lets a list comprehension go without brackets: `L = f(i) for i = [1...5]` or as a call
 * argument, `join(g(a) for a = [1, 2])`. The parser needs `[f(i) for i = [1...5]]`, so add them.
 */
export function bracketComprehensions(math) {
  let s = math;
  for (let guard = 0; guard < 50; guard++) {
    // Find a ` for ` whose innermost enclosing bracket is not `[`.
    let depth = 0, inStr = false, found = -1;
    const stack = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; continue; }
      if (OPEN.includes(c)) stack.push(i);
      else if (CLOSE.includes(c)) stack.pop();
      else if (/\s/.test(c) && s.startsWith("for ", i + 1) && s[stack.at(-1)] !== "[") { found = i; break; }
    }
    if (found === -1) return s;
    const encl = stack.at(-1);
    let start, end;
    if (encl === undefined) { start = afterRelation(s.slice(0, found)); end = s.length; }
    else {
      end = closeOf(s, encl);
      start = encl + 1;
      // The comprehension is one argument: it starts after the last top-level comma before `for`.
      let d = 0;
      for (let i = found; i > encl; i--) {
        if (CLOSE.includes(s[i])) d++;
        else if (OPEN.includes(s[i])) d--;
        else if (s[i] === "," && d === 0) { start = i + 1; break; }
      }
    }
    const piece = s.slice(start, end);
    const lead = piece.match(/^\s*/)[0];
    s = `${s.slice(0, start)}${lead}[${piece.trim()}]${s.slice(end)}`;
  }
  return s;
}
