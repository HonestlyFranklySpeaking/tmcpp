// tmcpp mcp: a Model Context Protocol server over stdio, so AI tools can compile, check and
// preview TMC++. No SDK: MCP's stdio transport is one JSON-RPC message per line.
//
// Tools:      compile, check, preview; with the browser extension linked: link_status, push, pull, screenshot
// Resources:  tmcpp://docs/syntax (the syntax reference), tmcpp://std/<name> (built-in libraries)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { decodeSource } from "./decode.js";
import { compileFile } from "./load-node.js";
import { checkSource } from "./check.js";
import { STD } from "./std/index.js";
import { resolveImports } from "./imports.js";
import { loadNode } from "./load-node.js";
import { Link, pairing } from "./link.js";

let link = null; // started by runMcp

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

function version() {
  return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
}

const INSTRUCTIONS = `TMC++ is a preprocessor for DesModder Text Mode (TMC): it adds style tails, classes, named colours,
components, if statements, actions and libraries, and compiles to TMC that pastes into Desmos.
Read tmcpp://docs/syntax before writing TMC++. Write a file, then call check (fast, no browser) until it
reports no problems, then preview to see the graph. compile returns the TMC to paste into Desmos.
If the user's browser extension is linked (link_status), push loads a graph straight into their open Desmos
tab, pull reads it back as TMC++ (with any edits they made in Desmos), and screenshot shows the tab.`;

const SOURCE = {
  source: { type: "string", description: "TMC++ source text. Give this or file." },
  file: { type: "string", description: "Path to a .tmcpp (or .tmc) file; relative imports resolve next to it. Prefer an absolute path." },
};

const TOOLS = [
  {
    name: "compile",
    title: "Compile TMC++",
    description: "Compile TMC++ to DesModder Text Mode (TMC). Returns the TMC, or compile errors with TMC++ line numbers. Imports resolve from disk, gh:user/repo/path@ref, https URLs and std/...",
    inputSchema: { type: "object", properties: { ...SOURCE }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "check",
    title: "Check TMC++",
    description: "Compile, then validate the output with DesModder's own Text Mode parser, without a browser. Reports compile errors and warnings (TMC++ lines), parser diagnostics (TMC lines, with the line text) and the number of graph items. Use this after every edit.",
    inputSchema: { type: "object", properties: { ...SOURCE, tmc: { type: "boolean", description: "Also return the compiled TMC." } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "preview",
    title: "Preview in Desmos",
    description: "Render the graph in real Desmos (headless Chrome or Edge) and return a PNG. Sliders can be set with at, and swept into a contact sheet of frames with sweep. Needs playwright-core and internet access; takes a few seconds.",
    inputSchema: {
      type: "object",
      properties: {
        ...SOURCE,
        at: { type: "object", description: "Slider values for every frame, e.g. {\"a\": 1.5, \"t\": \"pi/2\"}. Values may be numbers or strings using pi.", additionalProperties: { type: ["number", "string"] } },
        sweep: { type: "string", description: "One slider over several frames: name=from..to/frames, e.g. \"a=0..2pi/9\" (end excluded, right for loops) or \"s=0..=1/5\" (end included)." },
        width: { type: "number", description: "Image width in pixels (default 1000)." },
        cols: { type: "number", description: "Contact sheet columns (default 3)." },
        out: { type: "string", description: "Also save the PNG to this path." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "link_status",
    title: "Browser link status",
    description: "Whether the TMC++ browser extension is linked, so push, pull and screenshot can reach the user's open Desmos tab. When it isn't, returns the pairing code and how to pair.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "push",
    title: "Load into Desmos",
    description: "Put TMC++ into the user's linked Desmos tab: it replaces the TMC++ panel's text and compiles into the graph (the user can undo in Desmos; the old panel text is kept as a backup). Returns compile errors and warnings from the page. check first.",
    inputSchema: { type: "object", properties: { ...SOURCE }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: "pull",
    title: "Read from Desmos",
    description: "Read TMC++ from the user's linked Desmos tab: from 'graph' (default) rebuilds it from the graph as it is now, including edits the user made in Desmos; from 'editor' returns the TMC++ panel's text.",
    inputSchema: { type: "object", properties: { from: { type: "string", enum: ["graph", "editor"] }, out: { type: "string", description: "Also save the source to this path." } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "screenshot",
    title: "Screenshot Desmos",
    description: "A PNG of the graph in the user's linked Desmos tab, as it is right now (current slider values and viewport).",
    inputSchema: { type: "object", properties: { width: { type: "number", description: "Image width in pixels (default 1000)." }, out: { type: "string", description: "Also save the PNG to this path." } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
];

function resources() {
  const list = [{ uri: "tmcpp://docs/syntax", name: "syntax", title: "TMC++ syntax reference", description: "Everything TMC++ adds to DesModder Text Mode, with a cheat sheet.", mimeType: "text/markdown" }];
  for (const [id, src] of Object.entries(STD)) {
    const blurb = src.split("\n").map((l) => l.replace(/^\/\/\s?/, "").trim()).filter((l) => l && !l.startsWith(id) && !l.endsWith(".tmcpp"))[0] ?? "";
    list.push({ uri: `tmcpp://${id}`, name: id, title: `import "${id}"`, description: blurb, mimeType: "text/plain" });
  }
  return list;
}

function readResource(uri) {
  if (uri === "tmcpp://docs/syntax") return { uri, mimeType: "text/markdown", text: readFileSync(new URL("../docs/syntax.md", import.meta.url), "utf8") };
  const id = uri.replace(/^tmcpp:\/\//, "");
  if (STD[id] !== undefined) return { uri, mimeType: "text/plain", text: STD[id] };
  throw rpcError(-32002, `no resource ${uri}`);
}

function rpcError(code, message) { return Object.assign(new Error(message), { code }); }

/** { source, path } from tool arguments. */
function input(args) {
  if (typeof args.file === "string" && args.file) {
    const path = resolve(args.file);
    return { source: decodeSource(readFileSync(path)), path };
  }
  if (typeof args.source === "string") return { source: args.source, path: "" };
  throw new Error("give source (TMC++ text) or file (a path)");
}

const where = (path) => path || "<source>";
const text = (t) => ({ type: "text", text: t });

async function callTool(name, args = {}) {
  if (name === "link_status") {
    if (!link) return { content: [text("The browser link is off in this server (TMCPP_LINK=0).")] };
    if (link.connected) {
      let tab = "";
      try { const i = await link.request("info", {}, 8000); tab = `\nDesmos tab: ${i.title} (${i.url})${i.madeWithTmcpp ? ", made with TMC++" : ""}`; }
      catch (e) { tab = `\nNo Desmos tab answered: ${e.message}`; }
      return { content: [text(`Linked to the TMC++ extension ${link.clientInfo?.version ?? ""}.${tab}`)] };
    }
    if (link.busy) return { content: [text(link.notLinkedMessage())], isError: true };
    const { code } = pairing({ port: link.port });
    return { content: [text(`Not linked. Pairing code: ${code}\nAsk the user to open desmos.com/calculator, open the TMC++ panel, choose ⋯ > Link to AI, paste the code and press Link.`)] };
  }
  if (name === "pull" || name === "screenshot") {
    if (!link) throw new Error("the browser link is off in this server (TMCPP_LINK=0)");
    if (name === "pull") {
      const r = await link.request("pull", { from: args.from ?? "graph" });
      if (args.out) writeFileSync(resolve(args.out), r.source);
      return { content: [text(r.source), ...(r.warnings?.length ? [text(r.warnings.map((w) => `warning: ${w}`).join("\n"))] : [])] };
    }
    const r = await link.request("screenshot", { width: args.width ?? 1000 });
    const png = String(r.png ?? "").split(",")[1];
    if (!png) throw new Error("the tab sent no image");
    if (args.out) writeFileSync(resolve(args.out), Buffer.from(png, "base64"));
    return { content: [{ type: "image", data: png, mimeType: "image/png" }, ...(args.out ? [text(`saved to ${resolve(args.out)}`)] : [])] };
  }
  const { source, path } = input(args);
  if (name === "push") {
    if (!link) throw new Error("the browser link is off in this server (TMCPP_LINK=0)");
    // Relative files can't be read from the page, so send every import's text along.
    const from = path.replace(/\\/g, "/");
    const libraries = Object.fromEntries(await resolveImports(source, loadNode, from));
    for (const id of Object.keys(libraries)) if (id.startsWith("std/")) delete libraries[id];
    const r = await link.request("push", { source, libraries, from });
    const lines = [r.ok ? (r.message || "Loaded into the graph.") : "The page couldn't compile it:",
      ...r.errors.map((e) => `line ${e.line}: error: ${e.message}`), ...r.warnings.map((w) => `line ${w.line}: warning: ${w.message}`)];
    return { content: [text(lines.join("\n"))], isError: !r.ok };
  }
  if (name === "compile") {
    const r = await compileFile(source, path);
    const notes = [...r.warnings.map((w) => `${where(path)}:${w.line}: warning: ${w.message}`), ...r.errors.map((e) => `${where(path)}:${e.line}: error: ${e.message}`)];
    if (r.errors.length) return { content: [text(notes.join("\n"))], isError: true };
    return { content: [text(r.tmc), ...(notes.length ? [text(notes.join("\n"))] : [])] };
  }
  if (name === "check") {
    const r = await checkSource(source, { path });
    const out = [
      ...r.warnings.map((w) => `${where(path)}:${w.line}: warning: ${w.message}`),
      ...r.errors.map((e) => `${where(path)}:${e.line}: error: ${e.message}`),
      ...r.diagnostics.map((d) => `TMC line ${d.line}: ${d.severity}: ${d.message}\n    ${d.text}`),
    ];
    out.push(r.errors.length ? `${r.errors.length} compile error(s); the parser did not run.`
      : `${r.ok ? "OK" : "FAILED"}: ${r.diagnostics.length} parser diagnostic(s), ${r.warnings.length} warning(s), ${r.items} item(s) in the graph state.`);
    const content = [text(out.join("\n"))];
    if (args.tmc && r.tmc) content.push(text(r.tmc));
    return { content, isError: !r.ok || r.errors.length > 0 };
  }
  if (name === "preview") {
    const { renderPreview, parseNumber, parseSweep } = await import("./preview.js");
    const at = {};
    for (const [k, v] of Object.entries(args.at ?? {})) at[k] = parseNumber(v);
    const sweep = args.sweep ? parseSweep(args.sweep) : null;
    const r = await renderPreview(source, { path, at, sweep, width: args.width ?? 1000, cols: args.cols ?? 3 });
    if (args.out) writeFileSync(resolve(args.out), r.png);
    const notes = [`${r.frames} frame${r.frames > 1 ? "s" : ""}${args.out ? `, saved to ${resolve(args.out)}` : ""}`,
      ...r.missing.map((m) => `warning: no slider named '${m}'`)];
    return { content: [{ type: "image", data: r.png.toString("base64"), mimeType: "image/png" }, text(notes.join("\n"))] };
  }
  throw rpcError(-32602, `unknown tool ${name}`);
}

async function handle(msg) {
  const { method, params = {} } = msg;
  switch (method) {
    case "initialize":
      return {
        protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "tmcpp", title: "TMC++", version: version() },
        instructions: INSTRUCTIONS,
      };
    case "ping": return {};
    case "tools/list": return { tools: TOOLS };
    case "tools/call":
      try { return await callTool(params.name, params.arguments); }
      catch (e) {
        if (e.code) throw e;
        return { content: [text(e.message)], isError: true }; // tool failures are results, not protocol errors
      }
    case "resources/list": return { resources: resources() };
    case "resources/templates/list": return { resourceTemplates: [] };
    case "resources/read": return { contents: [readResource(params.uri)] };
    case "prompts/list": return { prompts: [] };
    default: throw rpcError(-32601, `method not found: ${method}`);
  }
}

/** For tests: run a tool against a given link. */
export const _test = { callTool, useLink: (l) => { link = l; } };

export async function runMcp() {
  // stdout carries the protocol; anything else printed would corrupt it.
  const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
  console.log = console.info = console.warn = (...a) => console.error(...a);
  if (process.env.TMCPP_LINK !== "0") {
    const { port, token } = pairing();
    link = new Link({ port, token, log: (m) => console.error(`tmcpp mcp: ${m}`) });
    link.start();
  }
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const pending = new Set();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); }
    catch { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }); return; }
    if (msg.id === undefined || msg.id === null) return; // notifications (initialized, cancelled) need no answer
    const p = handle(msg).then(
      (result) => send({ jsonrpc: "2.0", id: msg.id, result }),
      (e) => send({ jsonrpc: "2.0", id: msg.id, error: { code: e.code ?? -32603, message: e.message } }),
    ).finally(() => pending.delete(p));
    pending.add(p);
  });
  await new Promise((r) => rl.on("close", r));
  await Promise.all(pending);
  await link?.stop();
}
