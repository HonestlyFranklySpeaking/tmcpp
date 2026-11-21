// Desmos LaTeX -> TMC math text. Covers the LaTeX Desmos itself produces for graphs:
// \left( \right), \cdot, \frac, powers, subscripts, \operatorname, \sqrt, |x|, piecewise braces,
// lists and ranges, comparisons, ->, Greek letters. Unknown commands throw, so callers can fall back.

const GREEK = new Set(["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda",
  "mu", "nu", "xi", "pi", "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega", "Gamma", "Delta", "Theta",
  "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega", "varphi", "vartheta", "varepsilon"]);
const FUNCS = new Set(["sin", "cos", "tan", "csc", "sec", "cot", "sinh", "cosh", "tanh", "arcsin", "arccos", "arctan",
  "ln", "log", "exp", "max", "min", "det"]);
const SYMBOLS = { cdot: " * ", times: " * ", le: " <= ", ge: " >= ", leq: " <= ", geq: " >= ", to: " -> ",
  ldots: "...", cdots: "...", infty: "infinity", div: " / " };

export function latexToTmc(src) {
  let i = 0;
  const peek = () => src[i];
  const eof = () => i >= src.length;
  const fail = (m) => { throw new Error(`${m} at ${i} in ${src}`); };

  /** A {group} or a single character/command as an argument. */
  function arg() {
    while (peek() === " ") i++;
    if (peek() === "{") { i++; const s = seq("}"); i++; return s; }
    if (peek() === "\\") return command();
    return src[i++];
  }
  function command() {
    i++; // backslash
    if (/[{}|,: ;!]/.test(peek())) {
      const c = src[i++];
      if (c === "{" ) return "{";
      if (c === "}") return "}";
      if (c === "|") return "|";
      return c === "," || c === ":" || c === ";" || c === " " || c === "!" ? " " : c;
    }
    let name = "";
    while (!eof() && /[A-Za-z]/.test(peek())) name += src[i++];
    if (name === "left" || name === "right") {
      // \left( \right) \left[ \left\{ \left|
      if (peek() === "\\") { i++; const c = src[i++]; return c === "{" ? (name === "left" ? "{" : "}") : c === "}" ? "}" : c === "|" ? "|" : fail("bad delimiter"); }
      const c = src[i++];
      if (c === "|") return name === "left" ? "abs(" : ")";
      return c === "." ? "" : c;
    }
    if (name === "frac") {
      const wrap = (x) => (/^[\w.^]+$/.test(x) || /^\w+\([^()]*\)$/.test(x) ? x : `(${x})`);
      const a = arg(), b = arg();
      const frac = `${wrap(a.trim())} / ${wrap(b.trim())}`;
      let j = i; while (src[j] === " ") j++;
      return src[j] === "^" ? `(${frac})` : frac; // \frac{a}{b}^{2} squares the whole fraction
    }
    if (name === "sqrt") {
      if (peek() === "[") { i++; const n = seq("]"); i++; const a = arg(); return `nthroot(${a}, ${n})`; }
      return `sqrt(${arg()})`;
    }
    if (name === "operatorname") return arg();
    if (name === "mathrm" || name === "text") return arg();
    if (FUNCS.has(name) || GREEK.has(name)) return name;
    if (name in SYMBOLS) return SYMBOLS[name];
    fail(`unsupported \\${name}`);
  }
  /** Read until `end` (not consumed). */
  function seq(end) {
    let out = "";
    while (!eof() && peek() !== end) {
      const c = peek();
      if (c === "\\") out += command();
      else if (c === "^") { i++; const a = arg(); out += /^[\w.]+$/.test(a) ? `^${a}` : `^(${a})`; }
      else if (c === "_") { i++; const a = arg(); out += `_${a}`; }
      else if (c === "{") { i++; out += seq("}"); i++; }
      else if (c === "}") { fail("unbalanced }"); }
      else if (c === "=" || c === "<" || c === ">" || c === "+" || c === "~") { i++; out += ` ${c} `; }
      else if (c === "-") { i++; out += /[\w)\]}]\s*$/.test(out) ? " - " : "-"; }
      else if (c === ",") { i++; out += ", "; }
      else if (c === ":") { i++; out += ": "; }
      else { out += c; i++; }
    }
    return out;
  }
  const out = seq(undefined);
  return out.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ,/g, ",").replace(/\[ /g, "[").replace(/ \]/g, "]").trim();
}
