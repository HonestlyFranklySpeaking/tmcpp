// TMC++ for VS Code: compile errors and warnings as you type, and the compiled TMC on demand.
// Imports resolve like the CLI: ./files next to this one, gh: and https: from the network, std/... built in.
const vscode = require("vscode");
const { compileFile, loadNode } = require("../../src/load-node.js");
const { resolveImports } = require("../../src/imports.js");
const lang = require("../../src/language.js");
const { Link, pairing } = require("../../src/link.js");

let diagnostics;
const timers = new Map();

async function compileDoc(doc) {
  const path = doc.uri.scheme === "file" ? doc.uri.fsPath : "";
  return compileFile(doc.getText(), path, { watermark: false });
}

async function check(doc) {
  if (doc.languageId !== "tmcpp") return;
  let r;
  try { r = await compileDoc(doc); } catch (e) { r = { errors: [{ line: 1, message: `TMC++ crashed: ${e.message}` }], warnings: [] }; }
  const at = (item, severity) => {
    const line = doc.lineAt(Math.min(Math.max(item.line, 1), doc.lineCount) - 1);
    const range = new vscode.Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex, line.lineNumber, line.text.length);
    const d = new vscode.Diagnostic(range, item.message, severity);
    d.source = "TMC++";
    return d;
  };
  diagnostics.set(doc.uri, [...r.errors.map((e) => at(e, vscode.DiagnosticSeverity.Error)),
    ...r.warnings.map((w) => at(w, vscode.DiagnosticSeverity.Warning))]);
}

function soon(doc) {
  clearTimeout(timers.get(doc.uri.toString()));
  timers.set(doc.uri.toString(), setTimeout(() => check(doc), 300));
}

async function compiledText() {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc || doc.languageId !== "tmcpp") { vscode.window.showWarningMessage("Open a .tmcpp file first."); return null; }
  const r = await compileDoc(doc);
  if (r.errors.length) vscode.window.showWarningMessage(`${r.errors.length} error(s); the TMC may be incomplete.`);
  return r.tmc;
}

// ---------- language features: hover, members after a dot, go to definition, rename, format ----------

const libCache = new Map(); // uri -> { version, libraries }
async function langOpts(doc) {
  const path = doc.uri.scheme === "file" ? doc.uri.fsPath.replace(/\\/g, "/") : "";
  const hit = libCache.get(doc.uri.toString());
  if (hit && hit.version === doc.version) return { libraries: hit.libraries, from: path };
  let libraries = {};
  try { libraries = Object.fromEntries(await resolveImports(doc.getText(), loadNode, path)); } catch {}
  libCache.set(doc.uri.toString(), { version: doc.version, libraries });
  return { libraries, from: path };
}
const lc = (p) => ({ line: p.line, col: p.character });
const range = (r) => new vscode.Range(r.line, r.col, r.line, r.end);

const features = (selector) => [
  vscode.languages.registerHoverProvider(selector, {
    async provideHover(doc, pos) {
      const md = lang.hover(doc.getText(), lc(pos), await langOpts(doc));
      return md ? new vscode.Hover(new vscode.MarkdownString(md)) : null;
    },
  }),
  vscode.languages.registerCompletionItemProvider(selector, {
    async provideCompletionItems(doc, pos) {
      const m = lang.completeMembers(doc.getText(), lc(pos), await langOpts(doc));
      if (!m) return [];
      const kinds = { function: vscode.CompletionItemKind.Function, class: vscode.CompletionItemKind.Class, property: vscode.CompletionItemKind.Property, variable: vscode.CompletionItemKind.Variable };
      return m.options.map((o) => Object.assign(new vscode.CompletionItem(o.label, kinds[o.kind] ?? vscode.CompletionItemKind.Field), { detail: o.detail }));
    },
  }, "."),
  vscode.languages.registerDefinitionProvider(selector, {
    async provideDefinition(doc, pos) {
      const opts = await langOpts(doc);
      const d = lang.definition(doc.getText(), lc(pos), opts);
      if (!d) return null;
      if (!d.lib) return new vscode.Location(doc.uri, range(d));
      // A library on disk opens at the definition; built-in and GitHub libraries have no file here.
      if (/^(std\/|gh:|https?:)/.test(d.lib)) return null;
      return new vscode.Location(vscode.Uri.file(d.lib), range(d));
    },
  }),
  vscode.languages.registerRenameProvider(selector, {
    async prepareRename(doc, pos) {
      const refs = lang.references(doc.getText(), lc(pos), await langOpts(doc));
      if (!refs || refs.kind === "external" || !refs.at.length) throw new Error(refs?.kind === "external" ? "This name comes from a library; rename it there." : "Nothing to rename here.");
      const here = refs.at.find((r) => r.line === pos.line && r.col <= pos.character && pos.character <= r.end) ?? refs.at[0];
      return { range: range(here), placeholder: refs.name };
    },
    async provideRenameEdits(doc, pos, newName) {
      const r = lang.rename(doc.getText(), lc(pos), newName, await langOpts(doc));
      if (r.error) throw new Error(r.error);
      const edit = new vscode.WorkspaceEdit();
      for (const e of r.edits) edit.replace(doc.uri, range(e), e.text);
      return edit;
    },
  }),
  vscode.languages.registerDocumentFormattingEditProvider(selector, {
    provideDocumentFormattingEdits(doc) {
      const text = doc.getText(), out = lang.format(text);
      if (out === text) return [];
      return [vscode.TextEdit.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)), out)];
    },
  }),
];

// ---------- the Desmos link: this file, live, in your Desmos tab ----------
// The browser extension pairs once (the code in ~/.tmcpp/link.json, shared with tmcpp mcp) and
// connects here on the port after tmcpp mcp's. Each edit is compiled; when there are no errors the
// tab applies it like live editing, changing only what changed. With Live Share, each person links
// their own VS Code to their own tab, and everyone's graph follows the shared file.

let link = null, linkTimer = null, statusItem = null, wasConnected = false, lastSent = "";
const output = () => (output.ch ??= vscode.window.createOutputChannel("TMC++"));

function showLinkStatus(note) {
  if (!statusItem) return;
  if (!link) { statusItem.hide(); return; }
  const on = link.connected;
  statusItem.text = on ? "$(link) Desmos" : "$(debug-disconnect) Desmos";
  statusItem.tooltip = note ?? (on ? "TMC++ is linked to your Desmos tab: edits show up live. Click to unlink."
    : link.busy ? `Another program holds port ${link.port}. Click to unlink.` : "Waiting for the Desmos tab: in the TMC++ panel, Link to AI with the pairing code. Click to unlink.");
  statusItem.show();
}

async function sendLive(doc, force = false) {
  if (!link?.connected || !doc || doc.languageId !== "tmcpp") return;
  const text = doc.getText();
  if (!force && text === lastSent) return;
  const r = await compileDoc(doc);
  if (r.errors.length) { showLinkStatus(`Not sent: ${r.errors.length} error(s) in the file`); return; }
  const { libraries, from } = await langOpts(doc);
  for (const id of Object.keys(libraries)) if (id.startsWith("std/")) delete libraries[id];
  try {
    const res = await link.request("live", { source: text, libraries, from }, 15000);
    lastSent = text;
    showLinkStatus(res.ok ? `Linked: ${res.message || "up to date"}` : `The tab couldn't compile it: ${res.errors?.[0]?.message ?? ""}`);
  } catch (e) { showLinkStatus(`Couldn't reach the tab: ${e.message}`); }
}

async function toggleLink() {
  if (link) {
    await link.stop(); link = null; clearInterval(linkTimer); showLinkStatus();
    vscode.window.showInformationMessage("TMC++: unlinked from Desmos.");
    return;
  }
  const { port, token, code } = pairing();
  link = new Link({ port: port + 1, token, log: (m) => output().appendLine(m) });
  await link.start();
  wasConnected = false;
  linkTimer = setInterval(() => {
    if (!link) return;
    if (link.connected !== wasConnected) {
      wasConnected = link.connected;
      lastSent = "";
      if (wasConnected) sendLive(vscode.window.activeTextEditor?.document, true);
    }
    showLinkStatus();
  }, 1000);
  showLinkStatus();
  const pick = await vscode.window.showInformationMessage(`TMC++: linking to Desmos. If the tab isn't paired yet, paste the code ${code} in the TMC++ panel (⋯ > Link to AI).`, "Copy code");
  if (pick) await vscode.env.clipboard.writeText(code);
}

function activate(context) {
  diagnostics = vscode.languages.createDiagnosticCollection("tmcpp");
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = "tmcpp.linkDesmos";
  context.subscriptions.push(
    statusItem,
    ...features({ language: "tmcpp" }),
    vscode.commands.registerCommand("tmcpp.linkDesmos", toggleLink),
    vscode.commands.registerCommand("tmcpp.pairingCode", async () => {
      const { code } = pairing();
      await vscode.env.clipboard.writeText(code);
      vscode.window.showInformationMessage(`TMC++ pairing code ${code} copied. In Desmos: TMC++ panel, ⋯ > Link to AI, paste, Link.`);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!link || e.document !== vscode.window.activeTextEditor?.document) return;
      clearTimeout(sendLive.timer);
      sendLive.timer = setTimeout(() => sendLive(e.document), 500);
    }),
    vscode.window.onDidChangeActiveTextEditor((ed) => { if (link && ed) sendLive(ed.document); }),
    { dispose: () => { link?.stop(); clearInterval(linkTimer); } },
    diagnostics,
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidChangeTextDocument((e) => soon(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri)),
    vscode.commands.registerCommand("tmcpp.showTmc", async () => {
      const tmc = await compiledText();
      if (tmc != null) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: tmc, language: "plaintext" }), { preview: true, viewColumn: vscode.ViewColumn.Beside });
    }),
    vscode.commands.registerCommand("tmcpp.copyTmc", async () => {
      const tmc = await compiledText();
      if (tmc != null) { await vscode.env.clipboard.writeText(tmc); vscode.window.showInformationMessage("Compiled TMC copied: paste it into DesModder's Text Mode."); }
    }),
  );
  vscode.workspace.textDocuments.forEach(check);
}

module.exports = { activate, deactivate: () => {} };
