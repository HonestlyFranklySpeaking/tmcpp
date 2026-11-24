// tmcpp check: compile, then validate the TMC with DesModder's own parser (text-mode-core).
import { readFileSync } from "node:fs";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { restoreGreek } from "./greek.js";
import { compileFile } from "./load-node.js";
import { decodeSource } from "./decode.js";

/**
 * Check one file (.tmcpp is compiled first; .tmc is parsed as is). Prints problems the way a
 * compiler does (file:line: error: ...) and returns the exit code: 0 clean, 1 errors.
 */
export async function runCheck(path, { quiet = false } = {}) {
  const name = path ?? "<stdin>";
  let tmc = decodeSource(readFileSync(path ?? 0));
  if (!path || !/\.tmc$/i.test(path)) {
    const r = await compileFile(tmc, path ?? "");
    for (const w of r.warnings) console.error(`${name}:${w.line}: warning: ${w.message}`);
    for (const e of r.errors) console.error(`${name}:${e.line}: error: ${e.message}`);
    if (r.errors.length) return 1;
    tmc = r.tmc;
  }
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), tmc);
  if (state) restoreGreek(state);
  const lineOf = (pos) => tmc.slice(0, pos).split("\n").length;
  const lines = tmc.split("\n");
  const seen = new Set();
  for (const d of diagnostics) {
    const n = lineOf(d.from);
    if (seen.has(n)) continue; // the first problem on a line is the useful one
    seen.add(n);
    console.error(`TMC line ${n}: ${d.severity}: ${d.message}\n    ${lines[n - 1]}`);
  }
  const count = state?.expressions?.list?.length ?? 0;
  if (!quiet) console.log(`${diagnostics.length} diagnostic(s), ${count} item(s) in the graph state`);
  return diagnostics.some((d) => d.severity === "error") ? 1 : 0;
}
