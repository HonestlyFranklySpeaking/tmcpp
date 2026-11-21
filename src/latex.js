// Desmos LaTeX -> TMC math text. Covers the LaTeX Desmos itself produces for graphs:
// \left( \right), \cdot, \frac, powers, subscripts, \operatorname, \sqrt, |x|, piecewise braces,
// lists and ranges, comparisons, ->, Greek letters. Unknown commands throw, so callers can fall back.

const GREEK = new Set(["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda",
  "mu", "nu", "xi", "pi", "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega", "Gamma", "Delta", "Theta",
  "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega", "varphi", "vartheta", "varepsilon"]);
const FUNCS = new Set(["sin", "cos", "tan", "csc", "sec", "cot", "sinh", "cosh", "tanh", "arcsin", "arccos", "arctan",
  "ln", "log", "exp", "max", "min", "det"]);
const KEYWORDS = new Set(["for", "with", "and", "or", "in"]);
const SYMBOLS = { cdot: " * ", times: " * ", le: " <= ", ge: " >= ", leq: " <= ", geq: " >= ", to: " -> ",
  ldots: "...", cdots: "...", infty: "infinity", div: " / " };

export function latexToTmc(src) {
  let i = 0;
  let glue = 0; // > 0 inside a subscript or \operatorname, where letters form one name
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
      if (c === "|") return name === "left" ? " abs(" : ")";
      return c === "." ? "" : c;
    }
    if (name === "frac") {
      // Only a single number, name (P_1) or call keeps no brackets: "1.2a" in a denominator does not.
      const wrap = (x) => (/^(-?\d*\.?\d+|[A-Za-z]+(_[A-Za-z0-9]+)?)(\^[\w.]+)?$/.test(x) || /^\w+\([^()]*\)$/.test(x) ? x : `(${x})`);
      const a = arg(), b = arg();
      const frac = `${wrap(a.trim())} / ${wrap(b.trim())}`;
      let j = i; while (src[j] === " ") j++;
      // Bracket the fraction when something follows that would bind to the denominator:
      // \frac{a}{b}^{2} squares the whole fraction, and \frac{1}{\pi}\left(y\right) multiplies it.
      const rest = src.slice(j);
      const ends = rest === "" || /^([+\-=<>,:)\]}]|\\(cdot|times|div|le|ge|leq|geq|to|right|ldots|cdots)\b|\\[,;: !])/.test(rest);
      return ends ? ` ${frac}` : ` (${frac})`;
    }
    if (name === "sqrt") {
      // A leading space keeps a\sqrt{x} from gluing into "asqrt".
      if (peek() === "[") { i++; const n = seq("]"); i++; const a = arg(); return ` nthroot(${a}, ${n})`; }
      return ` sqrt(${arg()})`;
    }
    // A function call. Its name must not glue onto what is before it (x\cos -> "x cos"). Desmos also
    // allows \sin^{2}\left(x\right) (-> sin(x)^2), \sin^{-1} (-> arcsin) and a bare argument,
    // \cos\theta or \sin 2x, which runs to the next + - = , : or bracket at the same level.
    const fn = (n) => {
      const skip = () => { while (src[i] === " ") i++; };
      skip();
      let exp = null;
      if (src[i] === "^") { i++; exp = arg().trim(); skip(); }
      if (exp === "-1" && FUNCS.has(n) && !n.startsWith("arc")) { n = "arc" + n; exp = null; }
      let inner;
      if (src.startsWith("\\left(", i)) {
        let depth = 0, j = i;
        for (; j < src.length; j++) {
          if (src.startsWith("\\left", j)) depth++;
          else if (src.startsWith("\\right", j) && --depth === 0) break;
        }
        if (j >= src.length) fail("unclosed \\left(");
        inner = latexToTmc(src.slice(i + 6, j));
        i = j + 7; // past \right)
      } else if (src[i] === "(") {
        return exp === null ? ` ${n}` : fail(`${n}^ with a plain bracket`);
      } else {
        let depth = 0, j = i;
        for (; j < src.length; j++) {
          const c = src[j];
          if (src.startsWith("\\left", j) || c === "{") depth++;
          else if (src.startsWith("\\right", j) || c === "}") { if (depth === 0) break; depth--; }
          else if (depth === 0 && /[+\-=<>,:]/.test(c)) break;
          else if (depth === 0 && j > i && /^\\(operatorname|sin|cos|tan|ln|log|cdot)\b/.test(src.slice(j))) break;
        }
        if (j === i) fail(`${n} without an argument`);
        inner = latexToTmc(src.slice(i, j));
        i = j;
      }
      return exp === null ? ` ${n}(${inner})` : ` ${n}(${inner})^(${exp})`;
    };
    if (name === "operatorname") {
      glue++; const word = arg().trim(); glue--;
      return KEYWORDS.has(word) ? ` ${word} ` : fn(word);
    }
    if (name === "mathrm" || name === "text") { glue++; const w = arg(); glue--; return w; }
    if (FUNCS.has(name)) return fn(name);
    if (GREEK.has(name)) return ` ${name} `;
    if (name in SYMBOLS) return SYMBOLS[name];
    fail(`unsupported \\${name}`);
  }
  /** Read until `end` (not consumed). */
  function seq(end) {
    let out = "";
    while (!eof() && peek() !== end) {
      const c = peek();
      if (c === "\\") out += command();
      else if (c === "^") { i++; const a = arg().trim(); out += /^[\w.]+$/.test(a) ? `^${a}` : `^(${a})`; }
      else if (c === "_") { i++; glue++; const a = arg().trim(); glue--; out += `_${a}`; }
      else if (c === "{") { i++; out += seq("}"); i++; }
      else if (c === "}") { fail("unbalanced }"); }
      else if (c === "=" || c === "<" || c === ">" || c === "+" || c === "~") { i++; out += ` ${c} `; }
      else if (c === "-") { i++; out += /[\w)\]}]\s*$/.test(out) ? " - " : "-"; }
      else if (c === ",") { i++; out += ", "; }
      else if (c === ":") { i++; out += ": "; }
      else {
        if (/[A-Za-z]/.test(c) && !glue && /[A-Za-z]$/.test(out)) out += " ";
        out += c; i++;
      }
    }
    return out;
  }
  const out = seq(undefined);
  return out.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ,/g, ",").replace(/\[ /g, "[").replace(/ \]/g, "]").trim();
}
