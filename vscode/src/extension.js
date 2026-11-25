// TMC++ for VS Code: compile errors and warnings as you type, and the compiled TMC on demand.
// Imports resolve like the CLI: ./files next to this one, gh: and https: from the network, std/... built in.
const vscode = require("vscode");
const { compileFile, loadNode } = require("../../src/load-node.js");
const { resolveImports } = require("../../src/imports.js");
const lang = require("../../src/language.js");

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

function activate(context) {
  diagnostics = vscode.languages.createDiagnosticCollection("tmcpp");
  context.subscriptions.push(
    ...features({ language: "tmcpp" }),
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
