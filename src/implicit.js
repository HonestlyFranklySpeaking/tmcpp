// Normalise math for TMC (see DesModder docs, text-mode/expressions.md):
//  - juxtaposed multiplication is not allowed, so insert `*`:
//      4p -> 4 * p,  k sin(x) -> k * sin(x),  (a)(b) -> (a) * (b)
//  - a decimal needs its leading zero: .5 -> 0.5
// Left alone: function calls f(x), multi-letter names (quack42), keywords (for),
// big operators `sum n=(1...5) n` / `integral x=(0...5) x^2`, and derivatives `(d/d x) f(x)`.

import { buildConfig } from "@desmodder/text-mode-core";
import { greekPlaceholder } from "./greek.js";

const BIG_OPS = new Set(["sum", "product", "integral"]);
const BIG_OPS_SET = BIG_OPS;
const KEYWORDS = new Set(["for", "with", "in", "else", "if", "and", "or", "from", "to", "of", "true", "false"]);

// Desmos only accepts one-letter names, optionally with a subscript (s_core, X_1). Its built-in
// functions (sin, total, length...) are reserved, and so are Greek letters and constants.
const TM = buildConfig({});
const BUILTIN = new Set([...TM.operatorNames]);
const COMMANDS = new Set([...TM.commandNames, "e", "infinity", "infty"]);
const greekHead = (n) => COMMANDS.has(n.split("_")[0]);

/**
 * A name as Desmos needs it: "score" -> "s_core", "hello_world" -> "h_elloworld", "total" (as a
 * variable) -> "t_otal". Names Desmos already accepts are returned unchanged.
 * `isCall`: the name is followed by "(" (a call keeps a built-in's name).
 */
export function desmosName(name, isCall = false) {
  if (name.length === 1) return name;
  const greek = greekPlaceholder(name); // gamma -> z_ZGRgamma, turned into \gamma after parsing
  if (greek) return greek;
  if (KEYWORDS.has(name) || BIG_OPS_SET.has(name)) return name;
  if (greekHead(name) && /^[A-Za-z]+(_[A-Za-z0-9]+)?$/.test(name)) return name;
  if (isCall && BUILTIN.has(name)) return name;
  if (/^[A-Za-z]_[A-Za-z0-9]+$/.test(name)) return name;       // already a subscript: X_1, s_core
  if (/^[A-Za-z][0-9]+$/.test(name)) return name;              // a1: TMC makes it a_1
  if (!BUILTIN.has(name) && !/_/.test(name) && /^[A-Za-z][A-Za-z0-9]*$/.test(name) && !isCall) {
    return `${name[0]}_${name.slice(1)}`;                      // score -> s_core (what TMC does, made explicit)
  }
  const rest = name.slice(1).replace(/_/g, "");
  return rest ? `${name[0]}_${rest}` : name[0];
}

const TOKEN = /"(?:[^"\\]|\\.)*"|\.\.\.|\d+(?:\.\d+)?|\.\d+|[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*|\s+|./g;

const kind = (t) =>
  /^"/.test(t) ? "str" :
  /\d/.test(t) && /^[\d.]/.test(t) ? "num" :
  /^[A-Za-z]/.test(t) ? (KEYWORDS.has(t) || BIG_OPS.has(t) ? "kw" : "id") :
  /^\s+$/.test(t) ? "ws" : t;

/** Rename multi-letter identifiers to names Desmos accepts (see desmosName). */
export function desmosNames(math, seen = null) {
  const toks = math.match(TOKEN) ?? [];
  let out = "";
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!/^[A-Za-z]/.test(t)) { out += t; continue; }
    // Only the head of a dotted name (P.x, L.random) is a variable; and nothing right after a dot.
    let j = out.length - 1; while (j >= 0 && /\s/.test(out[j])) j--;
    if (out[j] === ".") { out += t; continue; }
    const [head, ...props] = t.split(".");
    let k = i + 1; while (k < toks.length && /^\s+$/.test(toks[k])) k++;
    const isCall = !props.length && toks[k] === "(";
    const name = desmosName(head, isCall);
    if (seen && name !== head) {
      if (!seen.has(name)) seen.set(name, new Set());
      seen.get(name).add(head);
    }
    out += [name, ...props].join(".");
  }
  return out;
}

export function implicitMultiply(math, seen = null) {
  math = desmosNames(math, seen);
  const toks = math.match(TOKEN) ?? [];
  let out = "", gap = false;
  const sig = [];            // recent significant tokens: { t, k }
  let depth = 0;
  let boundDepth = null;     // depth of the "(...)" bounds after a big operator
  let noMulAfterClose = false;

  for (let tok of toks) {
    let k = kind(tok);
    if (k === "ws") { gap = true; out += tok; continue; }
    if (k === "num" && tok.startsWith(".")) tok = "0" + tok;

    const p1 = sig.at(-1), p2 = sig.at(-2), p3 = sig.at(-3);
    const prev = p1?.k;
    const operand = k === "num" || k === "id" || k === "(";
    let mul = false;
    if (prev && operand) {
      const afterBounds = prev === ")" && noMulAfterClose;
      const derivative = p1?.t === "d" && p2?.t === "/" && p3?.t === "d";
      if (prev === "num" && (k === "id" || k === "(")) mul = true;                  // 4p, 2(x)
      else if (prev === ")" && !afterBounds) mul = true;                            // (a)(b), (a)x
      else if (prev === "id" && gap && (k === "id" || k === "num") && !derivative) mul = true; // k sin(x)
    }
    if (mul) out = out.trimEnd() + " * ";
    out += tok;

    // Track the bracket after `sum n=` / `integral x=` so the body that follows is not multiplied in.
    if (k === "(") {
      depth++;
      if (boundDepth === null && sig.some((s) => s.boundPending)) {
        boundDepth = depth;
        for (const s of sig) s.boundPending = false;
      }
    }
    noMulAfterClose = false;
    if (k === ")") {
      if (depth === boundDepth) { noMulAfterClose = true; boundDepth = null; }
      // (d/d x) applies to what follows; it is not a factor
      if (p1?.k === "id" && p2?.t === "d" && p3?.t === "/" && sig.at(-4)?.t === "d") noMulAfterClose = true;
      depth--;
    }
    sig.push({ t: tok, k, boundPending: k === "kw" && BIG_OPS.has(tok) });
    if (sig.length > 8) sig.shift();
    gap = false;
  }
  return out;
}
