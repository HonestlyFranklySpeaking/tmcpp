#!/usr/bin/env node
// Validate compiled TMC with DesModder's real parser (text-mode-core).
// Usage: node tools/check.js file.tmcpp   (compiles first)  or  file.tmc
// Note: the npm release can lag the extension (e.g. it rejects |x|, which the extension accepts).
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { restoreGreek } from "../src/greek.js";
import { readFileSync } from "node:fs";
import { compile } from "../src/compile.js";
import { decodeSource } from "../src/decode.js";
import { resolveImports } from "../src/imports.js";
import { loadNode } from "../src/load-node.js";

const path = process.argv[2];
let tmc = decodeSource(readFileSync(path));
if (path.endsWith(".tmcpp")) {
  const from = path.replace(/\\/g, "/");
  const r = compile(tmc, { libraries: await resolveImports(tmc, loadNode, from), from });
  for (const e of r.errors) console.error(`${path}:${e.line}: tmc++ error: ${e.message}`);
  if (r.errors.length) process.exit(1);
  tmc = r.tmc;
}
const [{ diagnostics }, state] = textToRaw(buildConfig({}), tmc);
restoreGreek(state);
const lineOf = (pos) => tmc.slice(0, pos).split("\n").length;
const lines = tmc.split("\n");
const seen = new Set();
for (const d of diagnostics) {
  const n = lineOf(d.from);
  if (seen.has(n)) continue; // first problem per line is the useful one
  seen.add(n);
  console.error(`TMC line ${n}: ${d.severity}: ${d.message}\n    ${lines[n - 1]}`);
}
const count = state?.expressions?.list?.length ?? 0;
console.log(`${diagnostics.length} diagnostic(s), ${count} item(s) in the graph state`);
process.exit(diagnostics.some((d) => d.severity === "error") ? 1 : 0);
