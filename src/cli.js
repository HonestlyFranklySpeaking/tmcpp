#!/usr/bin/env node
// tmcpp: compile, check and preview TMC++ files. Run `tmcpp --help` for the commands.
// Imports resolve before compiling: ./relative files from disk, gh:user/repo/path@ref and
// https:// URLs from the network, std/... from the bundled libraries.
import { readFileSync } from "node:fs";
import { decodeSource } from "./decode.js";
import { compileFile } from "./load-node.js";

function version() {
  return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
}

const HELP = `tmcpp ${version()}: compile TMC++ to DesModder Text Mode (TMC)

  tmcpp graph.tmcpp                 print the compiled TMC, or errors with line numbers
  tmcpp compile graph.tmcpp         the same, spelled out
  tmcpp < graph.tmcpp               read the source from standard input
  tmcpp check graph.tmcpp           compile, then validate with DesModder's own parser
  tmcpp check graph.tmcpp --runtime also load it in real Desmos and report what Desmos rejects
                                    (--at a=1 b=2 sets sliders first; --json for tools)
  tmcpp preview graph.tmcpp [opts]  render a PNG in real Desmos (needs playwright-core)
  tmcpp fmt graph.tmcpp [--write]   tidy indentation and blank lines (prints, or --write saves; --check for CI)
  tmcpp describe graph.tmcpp        list sliders, functions, components, classes and imports (--json)
  tmcpp mcp                         run an MCP server on stdio (compile, check, describe, preview, and the Desmos link)
  tmcpp pair                        show the code that links the browser extension to tmcpp mcp
  tmcpp --version

preview options:
  --at a=1 b=pi/2         slider values for every frame
  --sweep a=0..2pi/9      9 frames as a contact sheet (..= includes the end)
  --out frame.png         output file (default: graph.preview.png)
  --width 1600  --cols 3  image width and sheet columns
  --show                  open a visible browser window

Preview drives your installed Chrome or Edge through playwright-core, an optional extra:
  npm install -g playwright-core      (next to a global tmcpp)
  npx -p @ikeasourpatches/tmcpp -p playwright-core tmcpp preview graph.tmcpp

Paste the output into DesModder's Text Mode, or use the browser extension.
Syntax: https://github.com/IkeaSourPatches/tmcpp/tree/main/docs/syntax`;

const argv = process.argv.slice(2);
const cmd = argv[0];

async function compileCmd(path) {
  if (path === undefined && process.stdin.isTTY) {
    console.error("tmcpp: give a .tmcpp file, or pipe one in (tmcpp --help)");
    return 1;
  }
  const source = decodeSource(readFileSync(path ?? 0));
  const { tmc, errors, warnings } = await compileFile(source, path ?? "");
  const name = path ?? "<stdin>";
  for (const w of warnings) console.error(`${name}:${w.line}: warning: ${w.message}`);
  for (const e of errors) console.error(`${name}:${e.line}: error: ${e.message}`);
  if (errors.length) return 1;
  console.log(tmc);
  return 0;
}

if (cmd === "--help" || cmd === "-h" || cmd === "help") { console.log(HELP); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { console.log(version()); process.exit(0); }

if (cmd === "check") {
  const { runCheck } = await import("./check.js");
  process.exit(await runCheck(argv.slice(1)));
} else if (cmd === "preview") {
  const { runPreview } = await import("./preview.js");
  await runPreview(argv.slice(1));
} else if (cmd === "fmt") {
  const { format } = await import("./language.js");
  const { writeFileSync } = await import("node:fs");
  const files = argv.slice(1).filter((a) => !a.startsWith("--"));
  const write = argv.includes("--write"), checkOnly = argv.includes("--check");
  if (!files.length) {
    if (process.stdin.isTTY) { console.error("tmcpp fmt: give .tmcpp files, or pipe one in"); process.exit(1); }
    process.stdout.write(format(decodeSource(readFileSync(0))));
    process.exit(0);
  }
  let unformatted = 0;
  for (const f of files) {
    const text = decodeSource(readFileSync(f)), out = format(text);
    if (out === text) continue;
    unformatted++;
    if (checkOnly) console.error(`${f}: not formatted`);
    else if (write) { writeFileSync(f, out); console.error(`formatted ${f}`); }
    else process.stdout.write(out);
  }
  process.exit(checkOnly && unformatted ? 1 : 0);
} else if (cmd === "describe") {
  const { describe, describeText } = await import("./describe.js");
  const path = argv.slice(1).find((a) => !a.startsWith("--"));
  const d = await describe(decodeSource(readFileSync(path ?? 0)), { path: path ?? "" });
  console.log(argv.includes("--json") ? JSON.stringify(d, null, 2) : describeText(d));
  process.exit(d.errors.length ? 1 : 0);
} else if (cmd === "mcp") {
  const { runMcp } = await import("./mcp.js");
  await runMcp();
} else if (cmd === "pair") {
  const { pairing } = await import("./link.js");
  const { code, file } = pairing();
  console.log(`${code}\n\nIn Desmos: open the TMC++ panel, choose ⋯ > Link AI or VS Code, paste the code, press Link.\nThe code is kept in ${file}; delete that file to make a new one.`);
} else if (cmd === "compile") {
  process.exit(await compileCmd(argv[1]));
} else if (cmd?.startsWith("-")) {
  console.error(`tmcpp: unknown option '${cmd}' (tmcpp --help)`);
  process.exit(1);
} else {
  process.exit(await compileCmd(cmd));
}
