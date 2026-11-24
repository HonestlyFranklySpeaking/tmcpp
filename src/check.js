// tmcpp check: compile, then validate the TMC with DesModder's own parser (text-mode-core).
import { readFileSync } from "node:fs";
import { buildConfig, textToRaw } from "./tmc-core.js";
import { restoreGreek } from "./greek.js";
import { compileFile } from "./load-node.js";
import { decodeSource } from "./decode.js";

/**
 * Compile (unless isTmc) and parse with text-mode-core. Returns
 * { ok, tmc, errors, warnings, diagnostics: [{ line, severity, message, text }], items, state }.
 * errors/warnings are compile problems (TMC++ source lines); diagnostics are parser problems (TMC lines).
 */
export async function checkSource(source, { path = "", isTmc = /\.tmc$/i.test(path) } = {}) {
  let tmc = source, errors = [], warnings = [];
  if (!isTmc) {
    ({ tmc, errors, warnings } = await compileFile(source, path));
    if (errors.length) return { ok: false, tmc: "", errors, warnings, diagnostics: [], items: 0, state: null };
  }
  let raw, state;
  try { [{ diagnostics: raw }, state] = textToRaw(buildConfig({}), tmc); }
  catch (e) { // text-mode-core throws on a few inputs instead of reporting them
    return { ok: false, tmc, errors, warnings, diagnostics: [{ line: 1, severity: "error", message: `Text Mode crashed: ${e.message}`, text: "" }], items: 0, state: null };
  }
  if (state) restoreGreek(state);
  const lines = tmc.split("\n");
  const lineOf = (pos) => tmc.slice(0, pos).split("\n").length;
  const seen = new Set();
  const diagnostics = [];
  for (const d of raw) {
    const line = lineOf(d.from);
    if (seen.has(line)) continue; // the first problem on a line is the useful one
    seen.add(line);
    diagnostics.push({ line, severity: d.severity, message: d.message, text: lines[line - 1] });
  }
  const items = state?.expressions?.list?.length ?? 0;
  return { ok: !raw.some((d) => d.severity === "error"), tmc, errors, warnings, diagnostics, items, state };
}

/** The `tmcpp check` command: prints problems like a compiler and returns the exit code. */
export async function runCheck(path, { quiet = false } = {}) {
  const name = path ?? "<stdin>";
  const r = await checkSource(decodeSource(readFileSync(path ?? 0)), { path: path ?? "" });
  for (const w of r.warnings) console.error(`${name}:${w.line}: warning: ${w.message}`);
  for (const e of r.errors) console.error(`${name}:${e.line}: error: ${e.message}`);
  if (r.errors.length) return 1;
  for (const d of r.diagnostics) console.error(`TMC line ${d.line}: ${d.severity}: ${d.message}\n    ${d.text}`);
  if (!quiet) console.log(`${r.diagnostics.length} diagnostic(s), ${r.items} item(s) in the graph state`);
  return r.ok ? 0 : 1;
}
