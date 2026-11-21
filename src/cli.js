#!/usr/bin/env node
// Usage: node src/cli.js graph.tmcpp   (or pipe source on stdin)
import { readFileSync } from "node:fs";
import { compile } from "./compile.js";
import { decodeSource } from "./decode.js";

const path = process.argv[2];
const source = decodeSource(readFileSync(path ?? 0));
const { tmc, errors, warnings } = compile(source);
const name = path ?? "<stdin>";

for (const w of warnings) console.error(`${name}:${w.line}: warning: ${w.message}`);
for (const e of errors) console.error(`${name}:${e.line}: error: ${e.message}`);
if (errors.length) process.exit(1);
console.log(tmc);
