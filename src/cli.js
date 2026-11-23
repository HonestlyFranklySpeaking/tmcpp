#!/usr/bin/env node
// Usage: node src/cli.js graph.tmcpp   (or pipe source on stdin)
// Imports resolve before compiling: ./relative files from disk, gh:user/repo/path@ref and
// https:// URLs from the network, std/... from the bundled libraries.
import { readFileSync } from "node:fs";
import { decodeSource } from "./decode.js";
import { compileFile } from "./load-node.js";

function version() {
  return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
}

const arg = process.argv[2];
if (arg === "--help" || arg === "-h") {
  console.log(`tmcpp ${version()}: compile TMC++ to DesModder Text Mode (TMC)

  tmcpp graph.tmcpp          print the compiled TMC, or errors with line numbers
  tmcpp < graph.tmcpp        read the source from standard input
  tmcpp --version

Paste the output into DesModder's Text Mode, or use the browser extension.
Syntax: https://github.com/IkeaSourPatches/tmcpp/blob/main/docs/syntax.md`);
  process.exit(0);
}
if (arg === "--version" || arg === "-v") { console.log(version()); process.exit(0); }
if (arg === undefined && process.stdin.isTTY) {
  console.error("tmcpp: give a .tmcpp file, or pipe one in (tmcpp --help)");
  process.exit(1);
}
const path = arg;
const source = decodeSource(readFileSync(path ?? 0));
const { tmc, errors, warnings } = await compileFile(source, path ?? "");
const name = path ?? "<stdin>";

for (const w of warnings) console.error(`${name}:${w.line}: warning: ${w.message}`);
for (const e of errors) console.error(`${name}:${e.line}: error: ${e.message}`);
if (errors.length) process.exit(1);
console.log(tmc);
