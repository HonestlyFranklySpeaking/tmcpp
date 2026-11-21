// Greek letters and Unicode math symbols.
//
// The Text Mode parser we bundle (text-mode-core 0.1.1) only knows six Greek letters: alpha, beta,
// theta, phi, pi and tau. Desmos knows the rest. So the compiler writes any other Greek name as a
// placeholder variable that cannot clash with a real one, z_ZGRgamma (or z_ZGRgammaZ1 for gamma_1),
// and restoreGreek() swaps each placeholder for the real LaTeX (\gamma, \gamma_{1}) after parsing.

export const GREEK = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa",
  "lambda", "mu", "nu", "xi", "pi", "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  "varphi", "vartheta", "varepsilon"];
const NATIVE = new Set(["alpha", "beta", "theta", "phi", "pi", "tau"]); // the parser handles these
const PLACEHOLDER = new Set(GREEK.filter((g) => !NATIVE.has(g)));

/** "gamma" -> "z_ZGRgamma", "gamma_1" -> "z_ZGRgammaZ1"; anything else -> null. */
export function greekPlaceholder(name) {
  const m = name.match(/^([A-Za-z]+)(?:_([A-Za-z0-9]+))?$/);
  if (!m || !PLACEHOLDER.has(m[1])) return null;
  return `z_ZGR${m[1]}${m[2] ? `Z${m[2]}` : ""}`;
}

const PLACEHOLDER_LATEX = /z_\{ZGR([A-Za-z]+?)(?:Z([A-Za-z0-9]+))?\}/g;  // in math: z_{ZGRgamma}
const PLACEHOLDER_TEXT = /z_ZGR([A-Za-z]+?)(?:Z([A-Za-z0-9]+))?(?![A-Za-z0-9])/g; // in labels: ${z_ZGRgamma}
const greekLatex = (g, sub) => `\\${g}${sub ? `_{${sub}}` : ""}`;
const restoreLatex = (s) => s.replace(PLACEHOLDER_LATEX, (_, g, sub) => `${greekLatex(g, sub)} `)
  .replace(PLACEHOLDER_TEXT, (_, g, sub) => greekLatex(g, sub));

/** Replace every placeholder in a parsed graph state with real Greek LaTeX (in place). */
export function restoreGreek(state) {
  const walk = (v) => {
    if (typeof v === "string") return v.includes("ZGR") ? restoreLatex(v).trimEnd() : v;
    if (Array.isArray(v)) { v.forEach((x, i) => (v[i] = walk(x))); return v; }
    if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = walk(v[k]); return v; }
    return v;
  };
  if (state?.expressions) walk(state.expressions);
  return state;
}

const UNICODE = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta", "η": "eta",
  "θ": "theta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "π": "pi",
  "ρ": "rho", "σ": "sigma", "τ": "tau", "υ": "upsilon", "φ": "phi", "ϕ": "varphi", "χ": "chi", "ψ": "psi",
  "ω": "omega", "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Ξ": "Xi", "Π": "Pi",
  "Σ": "Sigma", "Υ": "Upsilon", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega", "ϑ": "vartheta", "ϵ": "varepsilon",
};
const SYMBOLS = { "≤": "<=", "≥": ">=", "×": "*", "·": "*", "⋅": "*", "÷": "/", "−": "-", "→": "->", "∞": "infinity" };

/** Unicode letters and symbols -> TMC words, outside "strings". θ_1 -> theta_1, 2θ -> 2 theta. */
export function unicodeToTmc(text) {
  if (!/[^\x00-\x7f]/.test(text)) return text;
  let out = "", inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { out += c; if (c === "\\") out += text[++i] ?? ""; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (UNICODE[c]) {
      const before = /[A-Za-z0-9_]$/.test(out) ? " " : "";
      const after = /[A-Za-z0-9]/.test(text[i + 1] ?? "") ? " " : "";
      out += before + UNICODE[c] + after;
    } else if (SYMBOLS[c]) out += SYMBOLS[c];
    else out += c;
  }
  return out;
}
