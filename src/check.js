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

/** The `tmcpp check` command. argv: the arguments after `check`. Returns the exit code. */
export async function runCheck(argv = []) {
  if (typeof argv === "string" || argv === undefined) argv = argv ? [argv] : [];
  let path, runtime = false, json = false, show = false;
  const at = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--runtime") runtime = true;
    else if (a === "--json") json = true;
    else if (a === "--show") show = true;
    else if (a === "--at") {
      runtime = true;
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        const [k, v] = argv[++i].split("=");
        if (!v) { console.error(`check: --at expects name=value, got '${argv[i]}'`); return 1; }
        const { parseNumber } = await import("./preview.js");
        try { at[k] = parseNumber(v); } catch (e) { console.error(`check: ${e.message}`); return 1; }
      }
    } else if (a.startsWith("--")) { console.error(`check: unknown option '${a}'`); return 1; }
    else path = a;
  }
  const name = path ?? "<stdin>";
  const source = decodeSource(readFileSync(path ?? 0));
  const r = await checkSource(source, { path: path ?? "" });
  let rt = null;
  if (runtime && r.ok && !r.errors.length) {
    const { runtimeCheck } = await import("./runtime.js");
    try { rt = await runtimeCheck(source, { path: path ?? "", at, show }); }
    catch (e) { rt = { ok: false, stage: "runtime", errors: [{ line: 0, where: null, message: e.message }], warnings: [] }; }
  }
  const ok = r.ok && !r.errors.length && (!rt || rt.ok);
  if (json) {
    console.log(JSON.stringify({ ok, file: name, compile: { errors: r.errors, warnings: r.warnings }, parser: r.diagnostics, items: r.items,
      ...(rt && { runtime: { errors: rt.errors, warnings: rt.warnings, sliders: rt.sliders } }) }, null, 2));
    return ok ? 0 : 1;
  }
  for (const w of r.warnings) console.error(`${name}:${w.line}: warning: ${w.message}`);
  for (const e of r.errors) console.error(`${name}:${e.line}: error: ${e.message}`);
  if (r.errors.length) return 1;
  for (const d of r.diagnostics) console.error(`TMC line ${d.line}: ${d.severity}: ${d.message}\n    ${d.text}`);
  console.log(`${r.diagnostics.length} diagnostic(s), ${r.items} item(s) in the graph state`);
  if (rt) {
    const loc = (x) => `${name}:${x.line}${x.where ? ` (${x.where})` : ""}`;
    for (const w of rt.warnings) console.error(`${loc(w)}: warning: ${w.message}`);
    for (const e of rt.errors) console.error(`${loc(e)}: error: ${e.message}\n    ${e.math ?? ""}`);
    const sl = Object.entries(rt.sliders ?? {}).map(([k, v]) => `${k}=${v}`).join(" ");
    console.log(`runtime: ${rt.errors.length} error(s) in Desmos${sl ? `, at ${sl}` : ""}`);
  }
  return ok ? 0 : 1;
}
