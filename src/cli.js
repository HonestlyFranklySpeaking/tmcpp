#!/usr/bin/env node
// Usage: node src/cli.js graph.tmcpp   (or pipe source on stdin)
// Imports resolve before compiling: ./relative files from disk, gh:user/repo/path@ref and
// https:// URLs from the network, std/... from the bundled libraries.
import { readFileSync } from "node:fs";
import { compile } from "./compile.js";
import { decodeSource } from "./decode.js";
import { resolveImports } from "./imports.js";
import { loadNode } from "./load-node.js";

const path = process.argv[2];
const source = decodeSource(readFileSync(path ?? 0));
const from = (path ?? "").replace(/\\/g, "/");
const libraries = await resolveImports(source, loadNode, from);
const { tmc, errors, warnings } = compile(source, { libraries, from });
const name = path ?? "<stdin>";

for (const w of warnings) console.error(`${name}:${w.line}: warning: ${w.message}`);
for (const e of errors) console.error(`${name}:${e.line}: error: ${e.message}`);
if (errors.length) process.exit(1);
console.log(tmc);
