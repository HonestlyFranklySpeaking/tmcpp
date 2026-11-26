// M20: lambdas. Desmos has no function values, so a lambda is pasted in where it's used:
//
//   map(L, (x) => x^2)          ->  [x^2 for x = L]
//   filter(L, (x) => x > 0)     ->  L[L > 0]
//   new Plot(f = (x) => sin(2x))    and in Plot's body f(t)  ->  sin(2t)
//
// A lambda the compiler can't paste in (stored in a variable, say) is an error.
import { substitute, splitArgs, matchClose, wrap } from "./components.js";

const LAMBDA = /^\s*(?:\(([^()]*)\)|([A-Za-z][A-Za-z0-9_]*))\s*=>\s*([\s\S]+?)\s*$/;

/** (x, y) => body  ->  { params, body }, or null. */
export function parseLambda(text) {
  const m = LAMBDA.exec(text);
  if (!m) return null;
  const params = (m[1] ?? m[2]).split(",").map((p) => p.trim()).filter(Boolean);
  if (!params.every((p) => /^[A-Za-z][A-Za-z0-9_]*$/.test(p))) return null;
  return { params, body: m[3] };
}

const apply = (lam, args) => wrap(substitute(lam.body, (n) => {
  const k = lam.params.indexOf(n);
  return k >= 0 ? wrap(args[k]) : undefined;
}));

/** Lower the lambdas in one statement. Returns { text, error }. */
export function lowerLambdas(text) {
  if (!/=>/.test(outsideStrings(text))) return { text };
  let out = text, guard = 0, error = null;
  // map(L, f) and filter(L, f)
  for (let i = findCall(out, ["map", "filter"]); i >= 0 && guard++ < 200; i = findCall(out, ["map", "filter"])) {
    const name = out.startsWith("map", i) ? "map" : "filter";
    const open = i + name.length, close = matchClose(out, open);
    if (close < 0) break;
    const args = splitArgs(out.slice(open + 1, close));
    const lam = args.length === 2 && parseLambda(args[1]);
    if (!lam || lam.params.length !== 1) { error = `${name}(list, (x) => ...) takes a list and a one-parameter lambda`; break; }
    const L = wrap(args[0].trim()), x = lam.params[0];
    const repl = name === "map"
      ? `[${lam.body} for ${x} = ${L}]`
      : `${L}[${substitute(lam.body, (n) => (n === x ? L : undefined))}]`;
    out = out.slice(0, i) + repl + out.slice(close + 1);
  }
  // ((x) => body)(args): pasted in, as a component argument called in its body becomes
  for (let i = 0; i < out.length && guard++ < 1000; i++) {
    if (out[i] !== "(") continue;
    if (inString(out, i)) continue;
    const close = matchClose(out, i);
    if (close < 0) continue;
    const lam = parseLambda(out.slice(i + 1, close));
    if (!lam || out[close + 1] !== "(") continue;
    const argClose = matchClose(out, close + 1);
    if (argClose < 0) continue;
    const args = splitArgs(out.slice(close + 2, argClose)).map((a) => a.trim());
    if (args.length !== lam.params.length) { error = `this lambda takes ${lam.params.length} argument${lam.params.length === 1 ? "" : "s"}, but is called with ${args.length}`; break; }
    out = out.slice(0, i) + apply(lam, args) + out.slice(argClose + 1);
    i = -1; // start over: pasting may reveal another
  }
  if (!error && /=>/.test(outsideStrings(out))) error = "a lambda only works where it's used straight away: in map or filter, or as a component argument the component calls. Desmos can't store one in a variable";
  return { text: out, error };
}

function findCall(text, names) {
  let best = -1;
  for (const n of names) {
    const re = new RegExp(`(^|[^A-Za-z0-9_.])${n}\\s*\\(`, "g");
    for (const m of text.matchAll(re)) {
      const at = m.index + m[1].length;
      if (inString(text, at)) continue;
      const open = text.indexOf("(", at);
      const close = matchClose(text, open);
      if (close > 0 && /=>/.test(text.slice(open, close))) { if (best < 0 || at < best) best = at; break; }
    }
  }
  if (best >= 0) { const name = names.find((n) => text.startsWith(n, best)); const open = text.indexOf("(", best); if (open !== best + name.length) return -1; }
  return best;
}
function inString(s, at) {
  let q = false;
  for (let i = 0; i < at; i++) { if (s[i] === "\\" && q) { i++; continue; } if (s[i] === '"') q = !q; }
  return q;
}
const outsideStrings = (s) => s.replace(/"(?:[^"\\]|\\.)*"/g, '""');
