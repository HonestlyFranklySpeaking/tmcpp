// The TMC++ editor in the panel: CodeMirror 6 with TMC++ highlighting, compile errors as
// squiggles, and autocomplete. createEditor returns an object shaped like the old <textarea>
// (value, focus, setSelectionRange, addEventListener...) so the rest of the panel is unchanged.
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { StreamLanguage, HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { linter, lintGutter } from "@codemirror/lint";
import { search, searchKeymap } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { STYLE_WORDS, NAMED_COLORS } from "../../src/compile.js";
import { findImports, parseImport } from "../../src/imports.js";
import { STD } from "../../src/std/index.js";

// ---------- highlighting ----------

const KEYWORDS = new Set(["component", "new", "as", "class", "color", "folder", "table", "settings", "ticker", "import",
  "from", "if", "then", "else", "abstract", "for", "with", "click"]);
const STYLE = new Set(STYLE_WORDS);
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

const tmcpp = StreamLanguage.define({
  name: "tmcpp",
  startState: () => ({ str: false, interp: 0, tail: false, expectType: false }),
  token(stream, s) {
    if (stream.sol()) { s.tail = false; s.expectType = false; }
    if (s.str) {
      if (s.interp) {
        if (stream.eat("}")) { s.interp = 0; return "interp"; }
        stream.next();
        return "interp";
      }
      if (stream.match("${")) { s.interp = 1; return "interp"; }
      if (stream.eat("\\")) { stream.next(); return "string"; }
      if (stream.eat('"')) { s.str = false; return "string"; }
      while (!stream.eol() && !/["\\$]/.test(stream.peek())) stream.next();
      if (!stream.eol() && stream.peek() === "$" && !stream.string.startsWith("${", stream.pos)) stream.next();
      return "string";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) { stream.skipToEnd(); return "comment"; }
    if (stream.eat('"')) { s.str = true; return "string"; }
    const prev = stream.pos === 0 ? " " : stream.string[stream.pos - 1];
    if (/\s|\{|\(|,/.test(prev)) {
      // A class (.glow) or the tail start (a lone ". ") after a space: the rest of the line is styles.
      if (stream.match(/^\.[A-Za-z_][\w-]*/)) { s.tail = true; return "cls"; }
      if (stream.match(/^\.(?=\s|$)/)) { s.tail = true; return "tailStart"; }
      if (stream.match(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/) || stream.match(/^#[A-Za-z_][\w-]*/)) { s.tail = true; return "color"; }
    }
    if (stream.match("@{")) return "meta";
    if (stream.match("->")) return "arrow";
    if (stream.match(NUMBER)) return "number";
    const word = stream.match(/^[A-Za-z_][\w-]*/);
    if (word) {
      const w = word[0];
      if (s.expectType) { s.expectType = false; return "type"; }
      if (KEYWORDS.has(w)) { if (w === "component" || w === "new") s.expectType = true; return "keyword"; }
      if (s.tail && STYLE.has(w)) return "style";
      if (stream.peek() === "(") return "fn";
      return /^[A-Z]/.test(w) && w.length > 1 ? "type" : "variable";
    }
    stream.next();
    return /[=<>+\-*/^:]/.test(stream.current()) ? "operator" : null;
  },
  languageData: { commentTokens: { line: "//" }, closeBrackets: { brackets: ["(", "[", "{", '"'] } },
  tokenTable: {
    interp: t.special(t.string), cls: t.className, tailStart: t.meta, color: t.color, arrow: t.controlOperator,
    type: t.typeName, fn: t.function(t.variableName), style: t.attributeName, variable: t.variableName,
  },
});

const highlight = HighlightStyle.define([
  { tag: t.comment, color: "#8a8f98", fontStyle: "italic" },
  { tag: t.string, color: "#388c46" },
  { tag: t.special(t.string), color: "#0b7a75", fontWeight: "600" },
  { tag: t.keyword, color: "#6042a6", fontWeight: "600" },
  { tag: t.number, color: "#c74440" },
  { tag: t.className, color: "#2d70b3", fontWeight: "600" },
  { tag: t.color, color: "#d16a00" },
  { tag: t.attributeName, color: "#b06d00" },
  { tag: t.typeName, color: "#6042a6" },
  { tag: t.function(t.variableName), color: "#1f5f99" },
  { tag: t.controlOperator, color: "#6042a6", fontWeight: "600" },
  { tag: [t.meta, t.operator], color: "#7a7f87" },
]);

const theme = EditorView.theme({
  "&": { flex: "1", minHeight: "0", fontSize: "13px", background: "#fff" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "ui-monospace, Consolas, monospace", lineHeight: "1.5" },
  ".cm-content": { padding: "8px 0" },
  ".cm-gutters": { background: "#fafafa", border: "none", color: "#b0b4ba" },
  ".cm-activeLine": { background: "#f5f9fd" },
  ".cm-activeLineGutter": { background: "#eef4fb", color: "#5a6270" },
  ".cm-tooltip-autocomplete": { fontSize: "12px" },
  ".cm-diagnostic": { fontSize: "12px" },
});

// ---------- autocomplete ----------

/** Names a source defines: components, classes, colours, and assigned variables. */
function defines(text) {
  const all = (re) => [...text.matchAll(re)].map((m) => m[1]);
  return {
    comps: all(/^\s*component\s+([A-Za-z]\w*)/gm),
    classes: all(/^\s*class\s+([A-Za-z_][\w-]*)/gm),
    colors: all(/^\s*color\s+([A-Za-z_][\w-]*)/gm),
    vars: all(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:\([^)]*\))?\s*=(?!=)/gm),
    instances: all(/^\s*new\s+.*?\bas\s+([A-Za-z]\w*)/gm),
  };
}

function completionsFor(text, libraries) {
  const own = defines(text);
  const out = { comps: [...own.comps], classes: [...own.classes], colors: [...own.colors, ...Object.keys(NAMED_COLORS)], vars: [...own.vars, ...own.instances] };
  for (const line of text.split("\n")) {
    if (!/^\s*import\b/.test(line)) continue;
    const imp = parseImport(line.replace(/\/\/.*$/, "").trim());
    const src = imp.spec && (libraries[imp.spec] ?? STD[imp.spec]);
    if (!src) continue;
    const d = defines(src);
    const pick = (names) => (imp.names ? names.filter((n) => imp.names.some((m) => m.replace(/^[.#]/, "") === n)) : names);
    const pre = imp.ns ? `${imp.ns}.` : "", dash = imp.ns ? `${imp.ns}-` : "";
    out.comps.push(...pick(d.comps).map((n) => pre + n));
    out.vars.push(...pick(d.vars).map((n) => pre + n));
    out.classes.push(...pick(d.classes).map((n) => dash + n));
    out.colors.push(...pick(d.colors).map((n) => dash + n));
  }
  return out;
}

function completer(getLibraries) {
  return (ctx) => {
    const text = ctx.state.doc.toString();
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);
    const libs = getLibraries();
    const uniq = (xs) => [...new Set(xs)];
    // import "|  -> built-in and saved libraries
    const imp = before.match(/^\s*import\b.*"([^"]*)$/);
    if (imp) {
      return { from: ctx.pos - imp[1].length, options: uniq([...Object.keys(STD), ...Object.keys(libs)]).map((l) => ({ label: l, type: "namespace" })) };
    }
    const c = completionsFor(text, libs);
    const after = before.match(/\bnew\s+([\w.]*)$/);
    if (after) return { from: ctx.pos - after[1].length, options: uniq(c.comps).map((n) => ({ label: n, type: "class", apply: n + "(" })) };
    const cls = before.match(/(?:^|[\s{(,])\.([\w-]*)$/);
    if (cls) return { from: ctx.pos - cls[1].length, options: uniq(c.classes).map((n) => ({ label: n, type: "type", detail: "class" })) };
    const col = before.match(/(?:^|[\s{(,:])#([A-Za-z_][\w-]*|)$/);
    if (col) return { from: ctx.pos - col[1].length, options: uniq(c.colors).map((n) => ({ label: n, type: "constant", detail: "colour" })) };
    const word = ctx.matchBefore(/[A-Za-z_][\w.-]*/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    const inTail = /(^|\s)(\.\s|\.[A-Za-z_]|#\w)/.test(before);
    const options = [
      ...[...KEYWORDS].map((k) => ({ label: k, type: "keyword" })),
      ...(inTail ? STYLE_WORDS.map((w) => ({ label: w, type: "property", detail: "style", boost: 2 })) : []),
      ...uniq(c.vars).map((v) => ({ label: v, type: "variable" })),
    ];
    return { from: word.from, options, validFor: /^[\w.-]*$/ };
  };
}

// ---------- the editor ----------

/**
 * parent: where to put it. options.run(): Ctrl+Enter. options.check(text) -> [{ line, message,
 * kind: "err" | "warn" }] for squiggles. options.libraries() -> { id: source } for completions.
 */
export function createEditor(parent, { value = "", run, check, libraries = () => ({}) }) {
  const inputs = new Set();
  let silent = false;
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(),
        bracketMatching(), closeBrackets(), indentOnInput(), search({ top: true }),
        tmcpp, syntaxHighlighting(highlight), theme, EditorState.tabSize.of(2),
        autocompletion({ override: [completer(libraries)], icons: false }),
        lintGutter(),
        linter((v) => {
          const doc = v.state.doc;
          return (check?.(doc.toString()) ?? []).filter((d) => d.line >= 1 && d.line <= doc.lines).map((d) => {
            const l = doc.line(d.line);
            return { from: l.from, to: Math.max(l.from, l.to), severity: d.kind === "warn" ? "warning" : "error", message: d.message };
          });
        }, { delay: 400 }),
        Prec.highest(keymap.of([
          { key: "Mod-Enter", run: () => { run?.(); return true; } },
          { key: "Mod-/", run: toggleComment },
        ])),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => { if (u.docChanged && !silent) for (const fn of inputs) fn(new Event("input")); }),
        // A dropped file is opened by the panel, not pasted in as text.
        EditorView.domEventHandlers({ drop: (e) => !!e.dataTransfer?.files?.length }),
      ],
    }),
  });
  view.dom.id = "tmcpp-src";

  const doc = () => view.state.doc;
  return {
    view,
    get value() { return doc().toString(); },
    set value(text) {
      silent = true; // like a textarea: setting the value isn't an input event
      view.dispatch({ changes: { from: 0, to: doc().length, insert: text } });
      silent = false;
    },
    get selectionStart() { return view.state.selection.main.from; },
    get selectionEnd() { return view.state.selection.main.to; },
    focus() { view.focus(); },
    setSelectionRange(a, b) { view.dispatch({ selection: { anchor: a, head: b }, scrollIntoView: true }); },
    classList: view.dom.classList,
    addEventListener(type, fn) { type === "input" ? inputs.add(fn) : view.dom.addEventListener(type, fn); },
    dispatchEvent(e) { if (e.type === "input") for (const fn of inputs) fn(e); else view.dom.dispatchEvent(e); },
  };
}
