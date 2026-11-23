// TMC++ for VS Code: compile errors and warnings as you type, and the compiled TMC on demand.
// Imports resolve like the CLI: ./files next to this one, gh: and https: from the network, std/... built in.
const vscode = require("vscode");
const { compileFile } = require("../../src/load-node.js");

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

function activate(context) {
  diagnostics = vscode.languages.createDiagnosticCollection("tmcpp");
  context.subscriptions.push(
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
