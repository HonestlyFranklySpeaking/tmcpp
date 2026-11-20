// Normalise math for TMC (see DesModder docs, text-mode/expressions.md):
//  - juxtaposed multiplication is not allowed, so insert `*`:
//      4p -> 4 * p,  k sin(x) -> k * sin(x),  (a)(b) -> (a) * (b)
//  - a decimal needs its leading zero: .5 -> 0.5
// Left alone: function calls f(x), multi-letter names (quack42), keywords (for),
// big operators `sum n=(1...5) n` / `integral x=(0...5) x^2`, and derivatives `(d/d x) f(x)`.

const KEYWORDS = new Set(["for", "with", "in", "else", "if", "and", "or", "from", "to", "of"]);
const BIG_OPS = new Set(["sum", "product", "integral"]);
const TOKEN = /"(?:[^"\\]|\\.)*"|\.\.\.|\d+(?:\.\d+)?|\.\d+|[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*|\s+|./g;

const kind = (t) =>
  /^"/.test(t) ? "str" :
  /\d/.test(t) && /^[\d.]/.test(t) ? "num" :
  /^[A-Za-z]/.test(t) ? (KEYWORDS.has(t) || BIG_OPS.has(t) ? "kw" : "id") :
  /^\s+$/.test(t) ? "ws" : t;

export function implicitMultiply(math) {
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
