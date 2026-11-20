// Minimal reader/writer for TMC style objects: @{ key: value, key: @{ ... } }.
// Values stay raw TMC text; nested @{ } become nested JS objects so they can be merged.

const OPEN = "([{", CLOSE = ")]}";

/** Split on top-level commas, ignoring brackets and strings. */
function splitTop(s) {
  const parts = [];
  let depth = 0, inStr = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && inStr) { i++; continue; }
    if (c === '"') inStr = !inStr;
    else if (!inStr && OPEN.includes(c)) depth++;
    else if (!inStr && CLOSE.includes(c)) depth--;
    else if (!inStr && depth === 0 && c === ",") { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Parse the inside of @{ ... } (without the braces). Throws on malformed input. */
export function parseTmcObject(inner) {
  const obj = {};
  for (const part of splitTop(inner)) {
    const m = part.match(/^([A-Za-z_]\w*)\s*:\s*([\s\S]+)$/);
    if (!m) throw new Error(`Cannot read '${part}' in @{ } (expected key: value)`);
    const v = m[2].trim();
    obj[m[1]] = v.startsWith("@{") && v.endsWith("}") ? parseTmcObject(v.slice(2, -1)) : v;
  }
  return obj;
}

/** Deep merge: values in `b` win; nested objects merge key by key. */
export function mergeTmc(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = typeof v === "object" && typeof out[k] === "object" ? mergeTmc(out[k], v) : v;
  }
  return out;
}

/** Serialise to "@{ k: v, ... }", or "" when empty. */
export function writeTmcObject(obj) {
  const body = (o) => Object.entries(o)
    .map(([k, v]) => typeof v === "object" ? `${k}: @{ ${body(v)} }` : `${k}: ${v}`)
    .join(", ");
  const b = body(obj);
  return b ? `@{ ${b} }` : "";
}
