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
