// tmcpp describe: what a graph offers, for people and AI tools: its sliders (with ranges), and the
// functions, components, classes and colours it defines or imports, with their parameters.
import { buildConfig, textToRaw } from "./tmc-core.js";
import { compileFile, loadNode } from "./load-node.js";
import { resolveImports } from "./imports.js";
import { STD } from "./std/index.js";
import { latexToTmc } from "./latex.js";

const math = (l) => { if (l == null || l === "") return null; try { return latexToTmc(String(l)); } catch { return String(l); } };

const DEF = /^(?:let\s+)?([A-Za-z][A-Za-z0-9_]*)\(([^()]*)\)\s*=(?!=)\s*(.*)$/;
const COMP = /^(?:component|macro)\s+([A-Za-z][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/;
const CLASS = /^class\s+([A-Za-z][\w-]*)/;
const ENUM = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*enum\s*\(([^()]*)\)/;
const COLOR = /^color\s+([A-Za-z][\w-]*)\s+(#[0-9a-fA-F]{3,6})\b/;

/** Definitions in one source file. Function definitions inside component bodies are locals: skipped. */
function definitions(text) {
  const out = { functions: [], components: [], classes: [], colors: [], enums: [] };
  const blocks = []; // "component" or "other", one per open {
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (!line) return;
    if (line.startsWith("}")) blocks.pop();
    const top = blocks.length === 0, inComponent = blocks.includes("component");
    let m;
    if ((m = ENUM.exec(line))) out.enums.push({ name: m[1], members: m[2].split(",").map((p) => p.trim()).filter(Boolean), line: i + 1 });
    else if (top && (m = COMP.exec(line))) out.components.push({ name: m[1], params: m[2].split(",").map((p) => p.trim()).filter(Boolean), line: i + 1 });
    else if (top && (m = CLASS.exec(line))) out.classes.push({ name: m[1], line: i + 1 });
    else if (top && (m = COLOR.exec(line))) out.colors.push({ name: m[1], hex: m[2], line: i + 1 });
    else if (!inComponent && (m = DEF.exec(line))) out.functions.push({ name: m[1], params: m[2].split(",").map((p) => p.trim()).filter(Boolean), line: i + 1 });
    if (line.endsWith("{") && !/^class\b/.test(line)) blocks.push(COMP.test(line) ? "component" : "other");
  });
  return out;
}

/** Desmos LaTeX name (a_{yaw}) to the written one (a_yaw, or score for s_core). */
const writtenName = (latexName, names) => {
  const flat = latexName.replace(/_\{([^}]*)\}/, "_$1").replace(/\\/g, "");
  return names[flat] ?? flat;
};

export async function describe(source, { path = "" } = {}) {
  const r = await compileFile(source, path);
  const from = path.replace(/\\/g, "/");
  const libs = await resolveImports(source, loadNode, from);
  const own = definitions(source);
  const imported = [];
  for (const imp of r.imports ?? []) {
    const text = libs.get(imp.id) ?? STD[imp.id];
    if (typeof text !== "string") continue;
    const d = definitions(text);
    const pre = imp.ns ? `${imp.ns}.` : "";
    imported.push({ import: imp.spec, as: imp.ns ?? null,
      functions: d.functions.map((f) => ({ ...f, name: pre + f.name })),
      components: d.components.map((c) => ({ ...c, name: pre + c.name })),
      classes: d.classes.map((c) => ({ ...c, name: imp.ns ? `${imp.ns}-${c.name}` : c.name })),
      colors: d.colors.map((c) => ({ ...c, name: imp.ns ? `${imp.ns}-${c.name}` : c.name })) });
  }
  const sliders = [];
  if (!r.errors.length) {
    const [, state] = textToRaw(buildConfig({}), r.tmc);
    for (const e of state?.expressions.list ?? []) {
      // A slider is a name set to a plain number.
      const m = e.type === "expression" && /^([A-Za-z](?:_\{[A-Za-z0-9]+\})?)=(-?\d*\.?\d+)$/.exec(e.latex ?? "");
      if (!m) continue;
      const s = e.slider ?? {};
      sliders.push({ name: writtenName(m[1], r.names ?? {}), value: m[2], min: math(s.min), max: math(s.max), step: s.step && s.step !== "0" ? math(s.step) : null,
        ...(s.isPlaying && { playing: true }), ...(s.loopMode && { loop: s.loopMode }) });
    }
  }
  return { errors: r.errors, sliders, enums: own.enums, functions: own.functions, components: own.components, classes: own.classes, colors: own.colors, imports: imported };
}

/** Plain text for people (and the MCP tool). */
export function describeText(d) {
  const sig = (x) => `${x.name}(${x.params.join(", ")})`;
  const out = [];
  if (d.errors.length) out.push(`Compile errors: ${d.errors.length} (the slider list may be incomplete)`);
  const range = (s) => (s.min ?? s.max ?? s.step) == null ? "" : `[${s.min ?? ""} : ${s.max ?? ""}${s.step ? ` : ${s.step}` : ""}]`;
  if (d.sliders.length) out.push("Sliders:", ...d.sliders.map((s) => `  ${s.name} = ${s.value}  ${range(s)}${s.playing ? "  playing" : ""}`));
  if (d.enums?.length) out.push("Enums (members count from 1):", ...d.enums.map((e) => `  ${e.name} = enum(${e.members.join(", ")})    line ${e.line}`));
  if (d.functions.length) out.push("Functions:", ...d.functions.map((f) => `  ${sig(f)}    line ${f.line}`));
  if (d.components.length) out.push("Components:", ...d.components.map((c) => `  ${sig(c)}    line ${c.line}`));
  if (d.classes.length || d.colors.length) out.push(`Classes: ${d.classes.map((c) => "." + c.name).join(" ") || "none"}`, `Colours: ${d.colors.map((c) => `#${c.name} ${c.hex}`).join(", ") || "none"}`);
  for (const imp of d.imports) {
    out.push(`Imported from "${imp.import}"${imp.as ? ` as ${imp.as}` : ""}:`);
    if (imp.components.length) out.push(`  components: ${imp.components.map(sig).join(", ")}`);
    if (imp.functions.length) out.push(`  functions: ${imp.functions.map(sig).join(", ")}`);
    if (imp.classes.length) out.push(`  classes: ${imp.classes.map((c) => "." + c.name).join(" ")}`);
    if (imp.colors.length) out.push(`  colours: ${imp.colors.map((c) => "#" + c.name).join(" ")}`);
  }
  return out.join("\n") || "Nothing to describe.";
}
