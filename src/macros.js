// M20: macros, compile-time for loops and while loops.
//
//   macro Glow(shape, look) {          A template: its lines are written where it's used, with no
//     shape  look opacity 0              folder and no renamed names (unlike a component).
//   }
//   Glow(x^2 + y^2 < 4, #fa7e19 fill 0.3)
//
//   for i in [1...3] {                 Written once per value, at compile time. In a name,
//     P_{i} = (i, 0)                    _{i} becomes the value: P_1, P_2, P_3.
//   }
//
//   while n < 10 {                     Runs its body once per tick while the condition holds:
//     n++                               it becomes part of the graph's ticker.
//   }
//
// Errors inside an expansion point at the line that used it. From graph gives back the use (or
// the for/while block) while its lines are untouched, as it does for `new`.
import { substitute, splitArgs, matchClose, wrap } from "./components.js";

const MACRO = /^macro\s+([A-Za-z][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{$/;
const CALL = /^([A-Za-z][A-Za-z0-9_]*)\s*\(([\s\S]*)\)$/;
const FOR = /^for\s+([A-Za-z][A-Za-z0-9_]*)\s+in\s+([\s\S]+?)\s*\{$/;
const WHILE = /^while\s+([\s\S]+?)\s*\{$/;

/** The statements of a block: from the header at i to its closing }, as [body, endIndex]. */
function blockAt(statements, i) {
  const body = [];
  let depth = 0, j = i + 1;
  for (; j < statements.length; j++) {
    const t = statements[j].text;
    if (statements[j].orphan) continue;
    if (t.startsWith("}") && depth === 0) break;
    if (t.startsWith("}")) depth--;
    body.push(statements[j]);
    if (t.endsWith("{")) depth++;
  }
  return [body, j];
}

/** An argument as it goes into a template: tails and strings as written, math bracketed if needed. */
const asArg = (a) => (/^(#|\.|@\{|label\b|click\(|")/.test(a.trim()) ? a.trim() : wrap(a.trim()));

/** Values of a compile-time list: [1...5], [0, 2 ... 10], or [a, "b", 3]. */
function listValues(text, report) {
  const t = text.trim();
  if (!(t.startsWith("[") && matchClose(t, 0) === t.length - 1)) { report("for ... in needs a list written out here, like [1...5] or [red, green]"); return null; }
  const inner = t.slice(1, -1).trim();
  let m;
  if ((m = inner.match(/^(-?\d+(?:\.\d+)?)\s*(?:,\s*(-?\d+(?:\.\d+)?)\s*)?\.\.\.\s*(-?\d+(?:\.\d+)?)$/))) {
    const a = Number(m[1]), b = Number(m[3]), step = m[2] !== undefined ? Number(m[2]) - a : (b >= a ? 1 : -1);
    if (!step || Math.sign(b - a) * Math.sign(step) < 0) { report(`the range ${t} never reaches its end`); return null; }
    const out = [];
    for (let v = a; step > 0 ? v <= b + 1e-9 : v >= b - 1e-9; v += step) { out.push(String(+v.toFixed(10))); if (out.length > 500) { report("a for loop over more than 500 values writes too many lines; use a list comprehension or new ... for ... instead"); return null; } }
    return out;
  }
  return splitArgs(inner).map((s) => s.trim());
}

/** Paste values into body lines: whole names, and _{name} inside other names. */
function instantiate(body, values, line, extra) {
  return body.map((st) => {
    let text = st.text;
    for (const [name, value] of Object.entries(values)) {
      text = text.replace(new RegExp(`_\\{${name}\\}`, "g"), () => (/^-?[A-Za-z0-9.]+$/.test(value) ? "_" + value.replace(/^-/, "m").replace(".", "p") : `_{${name}}`));
    }
    text = substitute(text, (n) => (n in values ? asArg(values[n]) : undefined));
    return { ...st, text, line, ...extra };
  });
}

export function lowerMacros(statements, errors, warnings) {
  const report = (line, message) => errors.push({ line, message });
  // 1. Macro definitions: collected and removed.
  const macros = new Map();
  let rest = [];
  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];
    const m = !st.orphan && MACRO.exec(st.text);
    if (!m) { rest.push(st); continue; }
    const [body, end] = blockAt(statements, i);
    if (end >= statements.length) report(st.line, "macro is never closed; end it with '}'");
    if (macros.has(m[1])) report(st.line, `macro ${m[1]} is defined twice`);
    const params = m[2].split(",").map((p) => p.trim()).filter(Boolean);
    macros.set(m[1], { params, body, line: st.line });
    i = end;
  }
  if (!macros.size && !rest.some((st) => !st.orphan && (FOR.test(st.text) || WHILE.test(st.text)))) return { statements: rest, whiles: [] };

  // 2. Uses and for loops, expanded until none are left (a macro may use another, or a for loop).
  const whiles = [];
  for (let round = 0; round < 20; round++) {
    let changed = false;
    const out = [];
    for (let i = 0; i < rest.length; i++) {
      const st = rest[i];
      if (st.orphan) { out.push(st); continue; }
      let m;
      if ((m = FOR.exec(st.text))) {
        const [body, end] = blockAt(rest, i);
        const values = listValues(m[2], (msg) => report(st.line, msg));
        if (values) {
          const key = st.cond?.key ?? `f:${st.line}`;
          for (const v of values) out.push(...instantiate(body, { [m[1]]: v }, st.line, { cond: st.cond ?? { key, line: st.line, end: rest[end]?.end ?? st.end } }));
        }
        i = end; changed = true; continue;
      }
      if ((m = WHILE.exec(st.text)) && !st.inWhile) {
        const [body, end] = blockAt(rest, i);
        whiles.push({ cond: m[1].trim(), body: body.map((b) => b.text), line: st.line, end: rest[end]?.end ?? st.end });
        i = end; changed = true; continue;
      }
      const c = CALL.exec(st.text);
      if (c && macros.has(c[1]) && matchClose(st.text, st.text.indexOf("(")) === st.text.length - 1) {
        const mac = macros.get(c[1]);
        const args = c[2].trim() ? splitArgs(c[2]).map((a) => a.trim()) : [];
        if (args.length !== mac.params.length) { report(st.line, `${c[1]} takes ${mac.params.length} argument${mac.params.length === 1 ? "" : "s"}, but this gives ${args.length}`); changed = true; continue; }
        const values = Object.fromEntries(mac.params.map((p, k) => [p, args[k]]));
        const key = st.cond?.key ?? `m:${st.line}`;
        out.push(...instantiate(mac.body, values, st.line, { cond: st.cond ?? { key, line: st.line, end: st.end }, macro: c[1] }));
        changed = true; continue;
      }
      out.push(st);
    }
    rest = out;
    if (!changed) break;
  }
  return { statements: rest, whiles, macros };
}

/**
 * While loops become the ticker: each one adds {condition: (body)} to the ticker's actions, and a
 * graph with no ticker gets one that plays. Returns the statements with the ticker updated.
 */
export function lowerWhiles(statements, whiles, source, blockSource, findTailStart) {
  if (!whiles.length) return statements;
  const parts = whiles.map((w) => `{${w.cond}: (${w.body.join(", ")})}`);
  const written = whiles.map((w) => blockSource(source, w.line, w.end));
  const i = statements.findIndex((st) => !st.orphan && /^ticker\b/.test(st.text));
  if (i < 0) {
    const line = whiles[0].line;
    return [...statements, { text: `ticker (${parts.join(", ")}) . play`, line, end: line, comments: [], tickerSrc: written.join("\n\n") }];
  }
  const st = statements[i];
  const body = st.text.replace(/^ticker\b/, "").trim();
  const at = findTailStart(" " + body);
  const action = (at === -1 ? body : body.slice(0, at - 1)).trim(), tail = at === -1 ? "" : body.slice(at - 1).trim();
  const inner = action.startsWith("(") && matchClose(action, 0) === action.length - 1 ? action.slice(1, -1) : action;
  const merged = { ...st, text: `ticker (${[inner, ...parts].join(", ")})${tail ? " " + tail : ""}`, tickerSrc: [st.src ?? st.text, ...written].join("\n\n") };
  return statements.map((s, k) => (k === i ? merged : s));
}
