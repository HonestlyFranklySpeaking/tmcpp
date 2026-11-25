// The TMC++ language service: hover docs, member completion, go to definition, rename and
// formatting, shared by the panel's editor, VS Code and `tmcpp fmt`. It works on source text
// alone (plus library sources for imports), line by line, so it answers instantly as you type.
// Positions are { line, col }, both counting from 0.
import { parseImport, normalizeId } from "./imports.js";
import { STD } from "./std/index.js";

// ---------- what each word means ----------

const ORIENTATION = "label position (all 16 Desmos orientations, hyphenated)";
export const STYLE_DOCS = {
  solid: "Line style: solid.", dashed: "Line style: dashed.", dotted: "Line style: dotted.",
  width: "`width N`: line width.", opacity: "`opacity N`: line opacity, 0 to 1.",
  fill: "`fill N`: fill opacity, 0 to 1. `fill 0` stays clickable (an invisible button).",
  point: "`point N`: point size.", "point-opacity": "`point-opacity N`: point opacity, 0 to 1.",
  open: "Point style: open circle.", cross: "Point style: cross.",
  drag: "`drag x|y|xy|none|auto`: how a point can be dragged.",
  hidden: "Hide the item (it still exists; other lines can use it).",
  label: '`label "text"`: show a label; `${p}` shows the live value of p.',
  "label-size": "`label-size N`: label size.", "label-angle": "`label-angle N`: label angle.",
  "no-outline": "Label without its white outline.", hover: "Show the label only on hover.",
  editable: "A label you can type into (text).", "editable-math": "A label you can type into (math).",
  play: "Start the slider playing.", reverse: "Play the slider backwards.",
  loop: "Slider playback: loop.", bounce: "Slider playback: back and forth.",
  once: "Slider playback: play once.", forever: "Slider playback: keep increasing.",
  pinned: "Pin the item to the top of the list.", secret: "Hide the item from viewers of a shared graph.",
  fraction: "Show the result as a fraction.", "click-label": '`click-label "text"`: what screen readers say for a click action.',
};
for (const o of ["default", "center", "center-auto", "auto-center", "above", "above-left", "above-right", "above-auto",
  "below", "below-left", "below-right", "below-auto", "left", "auto-left", "right", "auto-right"]) STYLE_DOCS[o] ??= `Label position: ${o} (${ORIENTATION}).`;

export const KEYWORD_DOCS = {
  component: "`component Name(a, b = 1) { ... }`: lines written once and stamped out with `new`.",
  new: "`new Name(args) as name`: an instance of a component, in its own folder.",
  as: "Names an instance (`new X(...) as s1`) or an import (`import \"lib\" as ns`).",
  class: "`class name { tokens }`: a reusable set of style tokens, applied with `.name`.",
  color: "`color name #rrggbb`: a named colour, used as `#name`.",
  import: "`import \"lib\"`, `import \"lib\" as ns` or `import { A, b } from \"lib\"`.",
  let: "`let P = ...`: a helper other lines use, never drawn.",
  enum: "`mode = enum(a, b, c)`: named states; members count from 1, `mode++` cycles.",
  if: "`if c then a else b`, or a block `if c { ... } else { ... }`.",
  click: "`click(action)`: run an action when the shape is clicked.",
  folder: '`folder "Name" [collapsed] [hidden] { ... }`', table: "`table [pinned] [secret] { ... }`",
  ticker: "`ticker action . play 500ms`: run an action repeatedly.",
  settings: "`settings x [-10 : 10] y [-6 : 6] degrees no-grid lock`",
  abstract: "`abstract p = 1 [0 : 5]`: a component parameter that is a real variable per instance.",
  toggle: "`toggle(on)`: `on -> 1 - on`.", reset: "`reset(a, b)` or `reset()`: back to the values they're defined with.",
};
const BUILTIN_COLORS = { red: "#c74440", blue: "#2d70b3", green: "#388c46", purple: "#6042a6", orange: "#fa7e19", black: "#000000" };

// ---------- the index: what a file defines, and where ----------

const COMP = /^(\s*)component\s+([A-Za-z][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{\s*$/;
const DEF = /^(\s*)(?:let\s+)?([A-Za-z][A-Za-z0-9_]*)\s*(?:\(([^()]*)\))?\s*=(?!=)/;
const CLASS = /^(\s*)class\s+([A-Za-z_][\w-]*)/;
const COLOR = /^(\s*)color\s+([A-Za-z_][\w-]*)\s+(#[0-9a-fA-F]{3,6})/;
const NEW = /^(\s*)new\s+([A-Za-z][\w.]*)\s*\((.*)\)(?:\s+for\s+.*?)?\s+as\s+([A-Za-z][A-Za-z0-9_]*)/;
const ENUM = /^(\s*)([A-Za-z][A-Za-z0-9_]*)\s*=\s*enum\s*\(([^()]*)\)/;

const stripComment = (line) => {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\" && inStr) { i++; continue; }
    if (line[i] === '"') inStr = !inStr;
    else if (!inStr && line.startsWith("//", i)) return line.slice(0, i);
  }
  return line;
};
const params = (text) => text.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
  const m = p.match(/^(abstract\s+)?([A-Za-z][A-Za-z0-9_]*)\s*(?:=\s*(.*))?$/);
  return m ? { name: m[2], abstract: !!m[1], default: m[3]?.trim() } : { name: p };
});

/** Definitions in one source. */
export function index(text) {
  const lines = text.split(/\r?\n/);
  const out = { lines, defs: [], components: new Map(), instances: new Map(), imports: [], enums: new Map(), members: new Map() };
  let comp = null, depth = 0;
  lines.forEach((raw, line) => {
    const l = stripComment(raw);
    const t = l.trim();
    if (!t) return;
    if (t.startsWith("}")) { depth--; if (comp && depth === comp.depth) { comp.end = line; comp = null; } }
    const col = (name, from = 0) => l.indexOf(name, from);
    let m;
    if ((m = COMP.exec(l))) {
      const c = { name: m[2], params: params(m[3]), locals: new Map(), instances: new Map(), line, start: line, end: lines.length - 1, depth, text: t };
      out.components.set(c.name, c);
      out.defs.push({ name: c.name, kind: "component", line, col: col(c.name, m[1].length + 9), text: t.replace(/\s*\{$/, "") });
      comp = c;
    } else if (/^import\b/.test(t)) {
      const p = parseImport(t);
      if (!p.error) out.imports.push({ ...p, line });
    } else if ((m = CLASS.exec(l)) && depth === 0) {
      out.defs.push({ name: m[2], kind: "class", line, col: col(m[2], m[1].length + 5), text: t });
    } else if ((m = COLOR.exec(l)) && depth === 0) {
      out.defs.push({ name: m[2], kind: "color", line, col: col(m[2], m[1].length + 5), text: t, hex: m[3] });
    } else if ((m = NEW.exec(l))) {
      const inst = { name: m[4], comp: m[2], args: m[3], line, scope: comp?.name ?? null };
      (comp ? comp.instances : out.instances).set(inst.name, inst);
      out.defs.push({ name: inst.name, kind: "instance", line, col: l.lastIndexOf(m[4]), text: t, scope: comp?.name ?? null, comp: m[2] });
    } else if ((m = ENUM.exec(l))) {
      const members = m[3].split(",").map((s) => s.trim()).filter(Boolean);
      out.enums.set(m[2], { members, line });
      out.defs.push({ name: m[2], kind: "enum", line, col: col(m[2]), text: t, scope: comp?.name ?? null });
      let from = l.indexOf("(");
      members.forEach((n, i) => {
        const c = l.indexOf(n, from);
        from = c + n.length;
        out.members.set(n, { of: m[2], value: i + 1 });
        out.defs.push({ name: n, kind: "member", line, col: c, text: `${n} = ${i + 1}, a member of ${m[2]}`, of: m[2], value: i + 1 });
      });
    } else if ((m = DEF.exec(l)) && !/^(folder|table|settings|ticker|image|if|else)\b/.test(t)) {
      const name = m[2];
      if (!((name === "x" || name === "y") && !m[3]) && !(name === "r" && !m[3] && !comp)) {
        const kind = m[3] !== undefined ? "function" : /\[[^\[\]]*:[^\[\]]*\]/.test(t) || /^[A-Za-z][\w]*\s*=\s*-?[\d.]+\s*(\.|$|\[)/.test(t) ? "slider" : "variable";
        const d = { name, kind, line, col: col(name, m[1].length), text: t, scope: comp?.name ?? null, params: m[3] !== undefined ? params(m[3]).map((p) => p.name) : null, let: /^\s*let\b/.test(l) };
        if (comp) { if (!comp.locals.has(name)) comp.locals.set(name, d); }
        if (!out.defs.some((x) => x.name === name && x.scope === d.scope && x.kind !== "member")) out.defs.push(d);
      }
    }
    if (t.endsWith("{")) depth++;
  });
  return out;
}

// ---------- tokens ----------

/** The word at a position: an identifier path (s1.d, sp.lerp), a class (.glow) or a colour (#sea). */
export function tokenAt(text, { line, col }) {
  const l = text.split(/\r?\n/)[line] ?? "";
  if (inString(l, col) && !inInterpolation(l, col)) return null;
  let a = col, b = col;
  const word = /[A-Za-z0-9_]/;
  while (a > 0 && /[A-Za-z0-9_.\-#]/.test(l[a - 1])) a--;
  while (b < l.length && word.test(l[b])) b++;
  let s = l.slice(a, b);
  // Back off things that aren't part of this token: a leading number, a stray hyphen.
  const lead = s.match(/^[^A-Za-z.#_]*/)[0].length;
  a += lead; s = s.slice(lead);
  if (!s) return null;
  if (s[0] === "." || s[0] === "#") {
    const prev = l[a - 1];
    // .glow / #sea only as tokens after a space or bracket; otherwise P.x is a member path
    if (a === 0 || /[\s{(,:]/.test(prev)) return { kind: s[0] === "." ? "class" : "color", name: s.slice(1), line, col: a, end: b };
    s = s.slice(1); a++;
  }
  if (s.includes("-")) { const cut = s.lastIndexOf("-", col - a); if (cut >= 0 && !/^[A-Za-z]/.test(s)) { a += cut + 1; s = s.slice(cut + 1); } }
  const parts = s.split(".");
  // The part under the cursor, and the path before it.
  let at = a, i = 0;
  for (; i < parts.length; i++) { if (col <= at + parts[i].length) break; at += parts[i].length + 1; }
  i = Math.min(i, parts.length - 1);
  return { kind: "ident", name: parts[i], path: parts.slice(0, i), line, col: at, end: at + parts[i].length, call: l[b] === "(" && i === parts.length - 1 };
}

function inString(l, col) {
  let inStr = false;
  for (let i = 0; i < col && i < l.length; i++) {
    if (l[i] === "\\" && inStr) { i++; continue; }
    if (l[i] === '"') inStr = !inStr;
  }
  return inStr;
}
function inInterpolation(l, col) {
  const open = l.lastIndexOf("${", col), close = l.lastIndexOf("}", col - 1);
  return open >= 0 && open > close;
}

// ---------- libraries ----------

/** The libraries a file imports, indexed: [{ imp, id, source, idx }]. */
function importsOf(idx, { libraries = {}, from = "" } = {}) {
  return idx.imports.map((imp) => {
    const id = normalizeId(imp.spec, from);
    const source = libraries[id] ?? libraries[imp.spec] ?? STD[id];
    return { imp, id, source, idx: typeof source === "string" ? index(source) : null };
  }).filter((x) => x.idx);
}
const isPrivate = (name) => name.startsWith("_");

/** Where a name comes from, as seen from a line: a component's param or local, the file, or an import. */
function resolve(idx, name, line, path, opts, col = -1) {
  const comp = [...idx.components.values()].find((c) => line >= c.start && line <= c.end);
  if (!path.length) {
    // new Spring(..., coils = 12): a named argument is the component's parameter
    const l = idx.lines[line] ?? "";
    const nm = col >= 0 && l.match(/\bnew\s+([A-Za-z][\w.]*)\s*\(/);
    if (nm && col > nm.index && /^\s*=(?!=)/.test(l.slice(col + name.length)) && /[(,]\s*$/.test(l.slice(0, col))) {
      const c = idx.components.get(nm[1]) ?? libComponent(idx, nm[1], opts)?.comp;
      const p = c?.params.find((x) => x.name === name);
      if (p) return { kind: "param", comp: c, param: p, via: idx.components.has(nm[1]) ? null : { name: nm[1] } };
    }
    if (comp && (line > comp.start || col < 0 || col > (idx.lines[line] ?? "").indexOf("("))) {
      const p = comp.params.find((x) => x.name === name);
      if (p) return { kind: "param", comp, param: p };
      if (comp.locals.has(name)) return { kind: "def", def: comp.locals.get(name) };
      if (comp.instances.has(name)) return { kind: "def", def: idx.defs.find((d) => d.kind === "instance" && d.name === name && d.scope === comp.name) };
    }
    const def = idx.defs.find((d) => d.name === name && !d.scope && d.kind !== "member") ?? idx.defs.find((d) => d.name === name && d.kind === "member");
    if (def) return { kind: "def", def };
    const c = idx.components.get(name);
    if (c) return { kind: "def", def: idx.defs.find((d) => d.kind === "component" && d.name === name) };
    for (const lib of importsOf(idx, opts)) {
      if (lib.imp.ns && lib.imp.ns === name) return { kind: "import", lib };
      if (lib.imp.ns || isPrivate(name)) continue;
      if (lib.imp.names && !lib.imp.names.some((n) => n.replace(/^[.#]/, "") === name)) continue;
      const d = lib.idx.defs.find((x) => x.name === name && !x.scope);
      if (d) return { kind: "lib", lib, def: d };
    }
    return null;
  }
  // a.b: an instance member, or a namespace member
  const base = path[0];
  const inst = (comp && comp.instances.get(base)) ?? idx.instances.get(base);
  if (inst) {
    const c = idx.components.get(inst.comp) ?? libComponent(idx, inst.comp, opts)?.comp;
    if (!c) return null;
    if (path.length > 1) return null;
    const p = c.params.find((x) => x.name === name);
    if (p) return { kind: "param", comp: c, param: p, via: inst };
    const local = c.locals.get(name) ?? (c.instances.has(name) ? { name, kind: "instance", line: c.instances.get(name).line, text: "" } : null);
    if (local) return { kind: "def", def: local, via: inst, lib: libComponent(idx, inst.comp, opts)?.lib };
    return null;
  }
  for (const lib of importsOf(idx, opts)) {
    if (lib.imp.ns !== base || isPrivate(name)) continue;
    const d = lib.idx.defs.find((x) => x.name === name && !x.scope);
    if (d) return { kind: "lib", lib, def: d };
  }
  return null;
}
function libComponent(idx, name, opts) {
  const [ns, n] = name.includes(".") ? name.split(".") : [null, name];
  for (const lib of importsOf(idx, opts)) {
    if ((ns && lib.imp.ns !== ns) || (!ns && lib.imp.ns)) continue;
    const comp = lib.idx.components.get(n);
    if (comp && !isPrivate(n)) return { lib, comp };
  }
  return null;
}

// ---------- hover ----------

const sig = (c) => `${c.name}(${c.params.map((p) => (p.abstract ? "abstract " : "") + p.name + (p.default ? ` = ${p.default}` : "")).join(", ")})`;
const code = (s) => "\n```tmcpp\n" + s + "\n```\n";
const where = (lib) => (lib ? ` (from "${lib.imp.spec}")` : "");

/** Markdown describing the word at pos, or null. */
export function hover(text, pos, opts = {}) {
  const h = hoverRaw(text, pos, opts);
  return h ? h.replace(/\n{3,}/g, "\n\n").trim() : h;
}
function hoverRaw(text, pos, opts) {
  const tok = tokenAt(text, pos);
  if (!tok) return null;
  const idx = index(text);
  const libs = () => importsOf(idx, opts);
  if (tok.kind === "class") {
    const own = idx.defs.find((d) => d.kind === "class" && d.name === tok.name);
    if (own) return code(own.text);
    for (const lib of libs()) {
      const n = lib.imp.ns && tok.name.startsWith(lib.imp.ns + "-") ? tok.name.slice(lib.imp.ns.length + 1) : tok.name;
      const d = lib.idx.defs.find((x) => x.kind === "class" && x.name === n);
      if (d && !isPrivate(n)) return code(d.text) + where(lib);
    }
    return `Unknown class \`.${tok.name}\``;
  }
  if (tok.kind === "color") {
    if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(tok.name)) return `Colour \`#${tok.name}\``;
    if (BUILTIN_COLORS[tok.name.toLowerCase()]) return `Built-in colour \`#${tok.name}\` (${BUILTIN_COLORS[tok.name.toLowerCase()]})`;
    const own = idx.defs.find((d) => d.kind === "color" && d.name.toLowerCase() === tok.name.toLowerCase());
    if (own) return code(own.text);
    for (const lib of libs()) {
      const n = lib.imp.ns && tok.name.startsWith(lib.imp.ns + "-") ? tok.name.slice(lib.imp.ns.length + 1) : tok.name;
      const d = lib.idx.defs.find((x) => x.kind === "color" && x.name === n);
      if (d) return code(d.text) + where(lib);
    }
    return null;
  }
  const { name } = tok;
  if (!tok.path.length) {
    const line = idx.lines[tok.line];
    const before = stripComment(line).slice(0, tok.col);
    const inTail = /(^|\s)(\.\s|\.[A-Za-z_]|#\w|label\s|click\()/.test(before);
    if (inTail && STYLE_DOCS[name]) return `**${name}**: ${STYLE_DOCS[name]}`;
    if (KEYWORD_DOCS[name] && !idx.defs.some((d) => d.name === name)) return `**${name}**: ${KEYWORD_DOCS[name]}`;
  }
  const r = resolve(idx, name, tok.line, tok.path, opts, tok.col);
  if (!r) return null;
  if (r.kind === "param") {
    const p = r.param;
    return `Parameter \`${p.name}\`${p.default ? ` (default \`${p.default}\`)` : ""}${p.abstract ? ", abstract: a real variable per instance" : ""} of ${code(sig(r.comp))}`;
  }
  if (r.kind === "import") return `Import ${code(`import ${JSON.stringify(r.lib.imp.spec)} as ${r.lib.imp.ns}`)}`;
  const d = r.def, lib = r.lib;
  if (d.kind === "component") {
    const c = (lib ? lib.idx : idx).components.get(d.name);
    const members = c ? [...c.params.map((p) => p.name), ...c.locals.keys()] : [];
    return code(sig(c ?? { name: d.name, params: [] })) + where(lib) + (members.length ? `\n\nMembers: ${members.map((m) => `\`${m}\``).join(", ")}` : "");
  }
  if (d.kind === "instance") {
    const c = idx.components.get(d.comp) ?? libComponent(idx, d.comp, opts)?.comp;
    return `Instance of ${code(c ? sig(c) : d.comp)}` + (c ? `\n\nMembers: ${[...c.params.map((p) => p.name), ...c.locals.keys()].map((m) => `\`${d.name}.${m}\``).join(", ")}` : "");
  }
  if (d.kind === "member") return `\`${d.name}\` = ${d.value}, a member of enum \`${d.of}\``;
  if (d.kind === "enum") return code(d.text) + "\n\nMembers count from 1; `++` and `--` cycle through them.";
  const label = d.kind === "function" ? "Function" : d.kind === "slider" ? "Slider" : d.let ? "Helper (let, hidden)" : "Variable";
  return `${label}${r.via ? ` of ${r.via.name}` : ""}${where(lib)}, line ${d.line + 1}:\n${code(d.text)}`;
}

// ---------- completion after a dot ----------

/** Members to offer after `name.`: { from, options: [{ label, detail }] }, or null. */
export function completeMembers(text, pos, opts = {}) {
  const l = text.split(/\r?\n/)[pos.line] ?? "";
  const m = l.slice(0, pos.col).match(/(?:^|[^A-Za-z0-9_.])([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z0-9_]*)$/);
  if (!m) return null;
  const idx = index(text);
  const base = m[1], from = { line: pos.line, col: pos.col - m[2].length };
  const comp = [...idx.components.values()].find((c) => pos.line > c.start && pos.line <= c.end);
  const inst = (comp && comp.instances.get(base)) ?? idx.instances.get(base);
  if (inst) {
    const c = idx.components.get(inst.comp) ?? libComponent(idx, inst.comp, opts)?.comp;
    if (!c) return null;
    return { from, options: [
      ...c.params.map((p) => ({ label: p.name, detail: `parameter of ${c.name}`, kind: "property" })),
      ...[...c.locals.values()].map((d) => ({ label: d.name, detail: d.kind === "function" ? `${d.name}(${(d.params ?? []).join(", ")})` : `local of ${c.name}`, kind: d.kind === "function" ? "function" : "property" })),
      ...[...c.instances.keys()].map((n) => ({ label: n, detail: "instance", kind: "property" })),
    ] };
  }
  for (const lib of importsOf(idx, opts)) {
    if (lib.imp.ns !== base) continue;
    return { from, options: lib.idx.defs.filter((d) => !d.scope && !isPrivate(d.name) && ["function", "variable", "slider", "component", "enum"].includes(d.kind))
      .map((d) => ({ label: d.name, detail: d.kind === "function" ? `${d.name}(${(d.params ?? []).join(", ")})` : d.kind, kind: d.kind === "function" ? "function" : d.kind === "component" ? "class" : "variable" })) };
  }
  // Points have .x and .y
  return { from, options: [{ label: "x", detail: "x coordinate", kind: "property" }, { label: "y", detail: "y coordinate", kind: "property" }] };
}

// ---------- go to definition ----------

/** { line, col, end } in this file, or { lib: id, line, col, end } in an imported one, or null. */
export function definition(text, pos, opts = {}) {
  const tok = tokenAt(text, pos);
  if (!tok) return null;
  const idx = index(text);
  if (tok.kind === "class" || tok.kind === "color") {
    const own = idx.defs.find((d) => d.kind === tok.kind && d.name.toLowerCase() === tok.name.toLowerCase());
    if (own) return { line: own.line, col: own.col, end: own.col + own.name.length };
    for (const lib of importsOf(idx, opts)) {
      const n = lib.imp.ns && tok.name.startsWith(lib.imp.ns + "-") ? tok.name.slice(lib.imp.ns.length + 1) : tok.name;
      const d = lib.idx.defs.find((x) => x.kind === tok.kind && x.name === n);
      if (d) return { lib: lib.id, line: d.line, col: d.col, end: d.col + d.name.length };
    }
    return null;
  }
  const r = resolve(idx, tok.name, tok.line, tok.path, opts, tok.col);
  if (!r) return null;
  if (r.kind === "param") {
    const line = idx.lines[r.comp.line] ?? "";
    const head = r.via ? null : r.comp;
    if (!head && !idx.components.has(r.comp.name)) return null;
    const c = line.indexOf(r.param.name, line.indexOf("("));
    return { line: r.comp.line, col: c, end: c + r.param.name.length };
  }
  if (r.kind === "import") return { line: r.lib.imp.line, col: 0, end: (idx.lines[r.lib.imp.line] ?? "").length };
  const d = r.def;
  const id = r.lib?.id;
  return id ? { lib: id, line: d.line, col: d.col, end: d.col + d.name.length } : { line: d.line, col: d.col, end: d.col + d.name.length };
}

// ---------- rename ----------

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;
const CLASSNAME = /^[A-Za-z_][\w-]*$/;

/** Every place the word at pos is used: [{ line, col, end }], with the symbol it means. */
export function references(text, pos, opts = {}) {
  const tok = tokenAt(text, pos);
  if (!tok) return null;
  const idx = index(text);
  const lines = idx.lines, out = [];
  // The name in `class glow {` or `color sea #...` is the class or colour itself.
  const dm = tok.kind === "ident" && !tok.path.length && (lines[tok.line] ?? "").match(new RegExp(`^\\s*(class|color)\\s+${tok.name}(?![\\w-])`));
  if (dm) tok.kind = dm[1] === "class" ? "class" : "color";
  const scanLine = (l, re, groupOffset = 0) => {
    const hits = [];
    let inStr = false, interp = false;
    // Positions outside strings, or inside ${...}
    const ok = [];
    for (let i = 0; i < l.length; i++) {
      if (inStr && l[i] === "\\") { ok.push(false, false); i++; continue; }
      if (!interp && l[i] === '"') { inStr = !inStr; ok.push(false); continue; }
      if (inStr && l.startsWith("${", i)) { interp = true; ok.push(false, false); i++; continue; }
      if (interp && l[i] === "}") { interp = false; ok.push(false); continue; }
      if (!inStr && l.startsWith("//", i)) { while (ok.length < l.length) ok.push(false); break; }
      ok.push(!inStr || interp);
    }
    for (const m of l.matchAll(re)) { const c = m.index + groupOffset + (m[1]?.length ?? 0); if (ok[c]) hits.push(c); }
    return hits;
  };
  if (tok.kind === "class" || tok.kind === "color") {
    const word = tok.kind === "class" ? "class" : "color", sigil = tok.kind === "class" ? "\\." : "#";
    const esc = tok.name.replace(/[-]/g, "\\-");
    lines.forEach((l, line) => {
      for (const c of scanLine(l, new RegExp(`(^|[\\s{(,:])${sigil}${esc}(?![\\w-])`, "g"), 1)) out.push({ line, col: c, end: c + tok.name.length });
      const m = l.match(new RegExp(`^(\\s*${word}\\s+)${esc}(?![\\w-])`, "i"));
      if (m) out.push({ line, col: m[1].length, end: m[1].length + tok.name.length });
    });
    return { kind: tok.kind, name: tok.name, at: out };
  }
  const r = resolve(idx, tok.name, tok.line, tok.path, opts, tok.col);
  if (!r || r.kind === "lib" || r.kind === "import" || r.lib) return { kind: "external", name: tok.name, at: [] };
  const name = tok.name, word = new RegExp(`(^|[^A-Za-z0-9_.])${name}(?![A-Za-z0-9_])`, "g");
  // A param or local of a component: its uses in the body, plus inst.name for its instances.
  const comp = r.kind === "param" ? r.comp : r.def.scope ? idx.components.get(r.def.scope) : null;
  if (comp) {
    for (let line = comp.line; line <= comp.end; line++) {
      const l = lines[line];
      const hits = line === comp.line && r.kind !== "param" ? [] : scanLine(l, word);
      for (const c of hits) out.push({ line, col: c, end: c + name.length });
    }
    const insts = [...idx.instances.values(), ...[...idx.components.values()].flatMap((c) => [...c.instances.values()])].filter((i) => i.comp === comp.name).map((i) => i.name);
    lines.forEach((l, line) => {
      for (const i of insts) for (const c of scanLine(l, new RegExp(`(^|[^A-Za-z0-9_.])${i}\\.${name}(?![A-Za-z0-9_])`, "g"))) out.push({ line, col: c + i.length + 1, end: c + i.length + 1 + name.length });
    });
    // new Comp(..., name = v): a named argument
    if (r.kind === "param") lines.forEach((l, line) => {
      const m = l.match(new RegExp(`\\bnew\\s+${comp.name}\\s*\\(`));
      if (!m) return;
      for (const c of scanLine(l, new RegExp(`([(,]\\s*)${name}(?=\\s*=(?!=))`, "g"))) if (c > m.index) out.push({ line, col: c, end: c + name.length });
    });
    return { kind: r.kind === "param" ? "param" : "local", name, at: dedupe(out) };
  }
  // A file-level name: every use outside components that define their own of the same name.
  const shadowed = [...idx.components.values()].filter((c) => c.params.some((p) => p.name === name) || c.locals.has(name));
  lines.forEach((l, line) => {
    if (shadowed.some((c) => line > c.start && line <= c.end)) return;
    for (const c of scanLine(l, word)) out.push({ line, col: c, end: c + name.length });
    if (r.def.kind === "instance") for (const c of scanLine(l, new RegExp(`(\\bas\\s+)${name}(?![A-Za-z0-9_])`, "g"))) out.push({ line, col: c, end: c + name.length });
  });
  return { kind: r.def.kind, name, at: dedupe(out) };
}
const dedupe = (xs) => [...new Map(xs.map((x) => [`${x.line}:${x.col}`, x])).values()].sort((a, b) => a.line - b.line || a.col - b.col);

/** Edits that rename the word at pos to newName: { edits: [{ line, col, end, text }] } or { error }. */
export function rename(text, pos, newName, opts = {}) {
  const refs = references(text, pos, opts);
  if (!refs) return { error: "Nothing to rename here" };
  if (refs.kind === "external") return { error: `'${refs.name}' comes from a library; rename it there` };
  const ok = refs.kind === "class" || refs.kind === "color" ? CLASSNAME.test(newName) : IDENT.test(newName);
  if (!ok) return { error: `'${newName}' isn't a valid ${refs.kind === "class" ? "class" : refs.kind === "color" ? "colour" : ""} name`.replace("  ", " ") };
  if (refs.kind !== "class" && refs.kind !== "color") {
    const idx = index(text);
    if (idx.defs.some((d) => d.name === newName && !d.scope)) return { error: `'${newName}' is already defined in this file` };
  }
  return { edits: refs.at.map((r) => ({ ...r, text: newName })) };
}

// ---------- formatting (tmcpp fmt) ----------

/**
 * Indentation by block (2 spaces), continuation lines one step deeper, no trailing spaces, at most
 * one blank line in a row, one newline at the end. Nothing else changes: not the math, not the
 * tails, not the comments, not the text inside multi-line strings.
 */
export function format(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const src = text.split(/\r?\n/);
  const out = [];
  let depth = 0, open = 0, inStr = false, prevCont = false, blank = 0;
  for (const raw of src) {
    if (inStr) { // inside a multi-line string: leave the line exactly as it is
      out.push(raw);
      inStr = quoteOpen(raw, true);
      continue;
    }
    const t = raw.trim();
    if (!t) { blank++; continue; }
    const code = stripComment(t).trim();
    if (blank && out.length && !(code.startsWith("}") && !open)) out.push(""); // no blank line before a closing }
    blank = 0;
    if (code.startsWith("}") && !open) depth = Math.max(0, depth - 1);
    const cont = open > 0 || prevCont || (/^[+\-*/^=]/.test(code) && out.length && /^\s/.test(raw) && raw.match(/^\s*/)[0].length > 0 && !code.startsWith("}"));
    // A continuation line keeps its own indent when it's deeper (lined up under a bracket, say);
    // a line that closes an open bracket goes back to the statement's indent.
    const base = 2 * depth, own = raw.match(/^\s*/)[0].replace(/\t/g, "  ").length;
    const indent = open > 0 && /^[)\]}]/.test(code) ? base : cont ? Math.max(own, base + 2) : base;
    out.push(" ".repeat(indent) + t);
    // Brackets left open, and statements that continue on the next line.
    const balance = bracketBalance(code);
    const header = code.endsWith("{") && !open && /^(folder|table|component|class|if|else|\}\s*else)\b/.test(code);
    if (header) depth++;
    else open = Math.max(0, open + balance - (code.startsWith("}") && !open && balance < 0 ? -1 : 0));
    prevCont = open > 0 || /([+\-*/^=<>,]|\\)$/.test(code);
    if (quoteOpen(t)) inStr = true;
  }
  return out.join(eol) + eol;
}
function bracketBalance(s) {
  let n = 0, inStr = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && inStr) { i++; continue; }
    if (s[i] === '"') inStr = !inStr;
    else if (!inStr && "([{".includes(s[i])) n++;
    else if (!inStr && ")]}".includes(s[i])) n--;
  }
  return n;
}
function quoteOpen(s, startsInside = false) {
  let open = startsInside;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && open) { i++; continue; }
    if (s[i] === '"') open = !open;
    else if (!open && s.startsWith("//", i)) break;
  }
  return open;
}
