// M12: import. A library is a .tmcpp file of definitions (components, classes, colours,
// functions, constants) that other files import. Imports are resolved by the compiler, not
// pasted in: every library definition gets one internal name that collides with nothing, and
// each importing file reaches it through its own aliases:
//
//   import "x"                 everything in x, unprefixed
//   import "x" as ui           ui.Button, ui.lerp, .ui-glow, #ui-steel
//   import { Button, lerp, .glow, #steel } from "x"
//
// Components, classes and colours cost nothing until used. Functions and constants reach
// Desmos only if something uses them, in one collapsed folder per library.
import { substitute, identifiers, assigned } from "./components.js";

const STR = /"(?:[^"\\]|\\.)*"/;
const NAME = "[A-Za-z][A-Za-z0-9_]*";
const PLAIN = new RegExp(`^import\\s+(${STR.source})$`);
const AS = new RegExp(`^import\\s+(${STR.source})\\s+as\\s+(${NAME})$`);
const SELECT = new RegExp(`^import\\s*\\{([^}]*)\\}\\s*from\\s+(${STR.source})$`);
const COMPONENT = /^component\s+([A-Za-z][A-Za-z0-9_]*)\s*\((.*)\)\s*\{$/;
const CLASS = /^class\s+([A-Za-z_][\w-]*)/;
const COLOR = /^color\s+([A-Za-z_][\w-]*)/;
const SLIDER = /\[[^\[\]]*:[^\[\]]*\]\s*$/;
const KINDS = ["values", "comps", "classes", "colors"];

export const isImport = (text) => /^import\b/.test(text);

/** `import ...` -> { spec, ns } | { spec, names } | { spec } | { error } */
export function parseImport(text) {
  const t = text.trim();
  let m;
  if ((m = t.match(PLAIN))) return { spec: JSON.parse(m[1]) };
  if ((m = t.match(AS))) return { spec: JSON.parse(m[1]), ns: m[2] };
  if ((m = t.match(SELECT))) {
    const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    const bad = names.find((n) => !/^[.#]?[A-Za-z_][\w-]*$/.test(n));
    if (bad) return { error: `'${bad}' can't be imported; list names like Button, lerp, .glow or #steel` };
    if (!names.length) return { error: "Nothing listed between { }" };
    return { spec: JSON.parse(m[2]), names };
  }
  return { error: 'Malformed import; expected import "lib", import "lib" as name, or import { A, b } from "lib"' };
}

// ---------- library ids ----------

/** `gh:user/repo/path.tmcpp@ref` -> the raw file URL. The ref defaults to HEAD. */
export function ghUrl(id) {
  const m = id.match(/^gh:([^/@]+)\/([^/@]+)\/([^@]+?)(?:@(.+))?$/);
  if (!m) return null;
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[4] ?? "HEAD"}/${m[3]}`;
}
/** Folder title for a library's helpers: std/ui stays, lib/parts/ui.tmcpp@abc becomes ui. */
export const libTitle = (id) => (id.startsWith("std/") ? id : id.replace(/@[^/]*$/, "").split("/").pop().replace(/\.tmcpp$/, "") || id);
export const isRemote = (id) => /^(gh:|https:\/\/)/.test(id);

function joinPath(dir, rel) {
  const parts = dir ? dir.split("/") : [];
  for (const p of rel.split("/")) {
    if (p === "." || p === "") continue;
    if (p === "..") { if (parts.length && parts.at(-1) !== "..") parts.pop(); else parts.push(".."); }
    else parts.push(p);
  }
  return parts.join("/");
}

/** A spec as written, made absolute against the file that imports it. */
export function normalizeId(spec, from = "") {
  if (!/^\.\.?\//.test(spec)) return spec;
  if (/^https:\/\//.test(from)) return new URL(spec, from).href;
  const gh = from.match(/^(gh:[^/@]+\/[^/@]+\/)([^@]*?)(@.+)?$/);
  if (gh) return gh[1] + joinPath(gh[2].split("/").slice(0, -1).join("/"), spec) + (gh[3] ?? "");
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const prefix = from.startsWith("/") ? "/" : "";
  return prefix + joinPath(dir.replace(/^\//, ""), spec);
}

/** Library ids a source imports directly (well-formed lines only). */
export function findImports(source, from = "") {
  const out = [];
  for (const line of source.split(/\r?\n/)) {
    const t = line.replace(/\/\/.*$/, "").trim();
    if (!isImport(t)) continue;
    const p = parseImport(t);
    if (p.spec !== undefined) out.push(normalizeId(p.spec, from));
  }
  return out;
}

/**
 * Fetch every library a file needs, transitively, before compiling. `load(id)` returns the
 * source (or a promise of it), or undefined if there's no such library. The compile step then
 * runs synchronously on the returned Map.
 */
export async function resolveImports(source, load, from = "") {
  const out = new Map(), seen = new Set();
  const queue = findImports(source, from);
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    let text;
    try { text = await load(id); } catch { text = undefined; }
    if (typeof text !== "string") continue;
    out.set(id, text);
    queue.push(...findImports(text, id));
  }
  return out;
}

// ---------- the pass ----------

const AMBIG = Symbol("ambiguous");

/** Walk statements with block depth: `{` at the end opens, `}` at the start closes. */
function walk(statements, fn) {
  let depth = 0;
  statements.forEach((st, i) => {
    if (st.orphan) { fn(st, depth, i); return; }
    if (st.text.startsWith("}")) depth--;
    fn(st, depth, i);
    if (st.text.endsWith("{")) depth++;
  });
}

const paramNames = (text) => text.split(",").map((p) => p.replace(/^\s*abstract\s+/, "").trim().match(/^[A-Za-z][A-Za-z0-9_]*/)?.[0]).filter(Boolean);

/**
 * Names that must not be rewritten in statement i: a component's parameters and locals inside
 * its body, a function's own arguments, and comprehension variables (for i = ...).
 */
function shadows(statements) {
  const out = statements.map(() => new Set());
  for (let i = 0; i < statements.length; i++) {
    const m = statements[i].text.match(COMPONENT);
    if (!m) continue;
    const names = new Set(paramNames(m[2]));
    let depth = 1, j = i + 1;
    for (; j < statements.length && depth > 0; j++) {
      const t = statements[j].text;
      if (t.startsWith("}")) depth--;
      if (depth > 0) { const a = assigned(t); if (a) names.add(a.name); }
      if (t.endsWith("{")) depth++;
    }
    for (let k = i; k < j; k++) for (const n of names) out[k].add(n);
  }
  statements.forEach((st, i) => {
    for (const n of assigned(st.text)?.args ?? []) out[i].add(n);
    for (const m of st.text.matchAll(/\bfor\s+([A-Za-z][A-Za-z0-9_]*)\s*=/g)) out[i].add(m[1]);
    for (const m of st.text.matchAll(/,\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*\[/g)) out[i].add(m[1]);
  });
  return out;
}

/** Apply `fn` to the parts of `text` outside string literals. */
const outsideStrings = (text, fn) => text.split(/("(?:[^"\\]|\\.)*")/).map((part, i) => (i % 2 ? part : fn(part))).join("");

export function lowerImports(statements, { libraries, std = {}, from = "", parse }, errors, warnings) {
  if (!statements.some((st) => !st.orphan && isImport(st.text))) return { statements, imports: [] };
  const get = (id) => (libraries instanceof Map ? libraries.get(id) : libraries?.[id]) ?? std[id];

  // 1. The file's own imports, at the top level only.
  const mainImports = [], main = [];
  walk(statements, (st, depth) => {
    if (st.orphan || !isImport(st.text)) { main.push(st); return; }
    if (depth > 0) { errors.push({ line: st.line, message: "import goes at the top level of the file, not inside a block" }); return; }
    const p = parseImport(st.text);
    if (p.error) { errors.push({ line: st.line, message: p.error }); return; }
    mainImports.push({ ...p, id: normalizeId(p.spec, from), line: st.line });
  });

  // 2. Load libraries, dependencies first, each once.
  const libs = new Map(), loading = [];
  function load(id, at, via) {
    const report = (msg, libLine) => errors.push({ line: at, message:
      libLine ? `In '${id}' line ${libLine}: ${msg}` : via.length ? `In '${via.at(-1)}': ${msg}` : msg });
    if (loading.includes(id)) { report(`Import cycle: ${[...loading.slice(loading.indexOf(id)), id].join(" imports ")}`); return null; }
    if (libs.has(id)) return libs.get(id);
    const source = get(id);
    if (typeof source !== "string") {
      report(isRemote(id) ? `'${id}' hasn't been fetched yet (in the extension: Library, then Fetch)` : `Can't find library '${id}'`);
      return null;
    }
    const lib = { id, at, statements: [], imports: [], defs: Object.fromEntries(KINDS.map((k) => [k, new Map()])), internal: Object.fromEntries(KINDS.map((k) => [k, new Map()])) };
    const bad = (st, msg) => report(msg, st.line);
    const define = (kind, name, st) => {
      if (lib.defs[kind].has(name)) bad(st, `'${name}' is defined twice`);
      else lib.defs[kind].set(name, st);
    };
    let mode = null; // "comp" inside a component body, "skip" inside a rejected block
    walk(parse(source), (st, depth) => {
      if (st.orphan) return;
      const t = st.text;
      if (depth > 0) { if (mode === "comp") lib.statements.push(st); return; }
      if (t === "}") { if (mode === "comp") lib.statements.push(st); mode = null; return; }
      if (isImport(t)) {
        const p = parseImport(t);
        if (p.error) bad(st, p.error);
        else lib.imports.push({ ...p, id: normalizeId(p.spec, id), line: st.line });
        return;
      }
      let m;
      if ((m = t.match(COMPONENT))) { define("comps", m[1], st); mode = "comp"; lib.statements.push(st); return; }
      if ((m = t.match(CLASS))) { define("classes", m[1], st); lib.statements.push(st); return; }
      if ((m = t.match(COLOR))) { define("colors", m[1], st); lib.statements.push(st); return; }
      const a = assigned(t);
      if (a && !(a.name === "x" || a.name === "y" || (a.name === "r" && !a.args.length))) {
        if (SLIDER.test(t)) bad(st, `'${a.name}' is a slider, and a library can't draw one; make it a component parameter instead`);
        else { define("values", a.name, st); st.value = a; lib.statements.push(st); }
        return;
      }
      if (t.endsWith("{")) mode = "skip";
      bad(st, "A library can only define components, classes, colours, functions and constants; this line would draw something. Wrap it in a component");
    });
    loading.push(id);
    for (const imp of lib.imports) imp.lib = load(imp.id, at, [...via, id]);
    loading.pop();
    libs.set(id, lib);
    return lib;
  }
  for (const imp of mainImports) imp.lib = load(imp.id, imp.line, []);

  // 3. Internal names: a definition keeps its own name unless something else already has it.
  const mainShadows = shadows(main);
  const brought = new Set(); // names the file reaches through plain or selective imports
  for (const imp of mainImports) {
    if (!imp.lib) continue;
    if (imp.names) imp.names.forEach((n) => brought.add(n.replace(/^[.#]/, "")));
    else if (!imp.ns) for (const k of KINDS) for (const n of imp.lib.defs[k].keys()) brought.add(n);
  }
  const reserved = { ident: new Set(), classes: new Set(), colors: new Set() };
  const mainDefs = new Map(); // own definitions of the file: name -> line
  for (const st of main) {
    if (st.orphan) continue;
    const a = assigned(st.text);
    if (a) mainDefs.set(a.name, st.line);
    let m;
    if ((m = st.text.match(COMPONENT))) mainDefs.set(m[1], st.line);
    if ((m = st.text.match(/\bas\s+([A-Za-z][A-Za-z0-9_]*)\s*(?:\.|$)/)) && /^new\b/.test(st.text)) mainDefs.set(m[1], st.line);
    if ((m = st.text.match(CLASS))) reserved.classes.add(m[1]);
    if ((m = st.text.match(COLOR))) reserved.colors.add(m[1]);
    for (const id of identifiers(st.text)) if (!brought.has(id) || mainDefs.has(id)) reserved.ident.add(id);
    outsideStrings(st.text, (s) => {
      for (const c of s.matchAll(/(?:^|[\s{(,])\.([A-Za-z_][\w-]*)/g)) if (!brought.has(c[1])) reserved.classes.add(c[1]);
      for (const c of s.matchAll(/(?:^|[\s{(,:])#([A-Za-z_][\w-]*)/g)) if (!brought.has(c[1])) reserved.colors.add(c[1]);
      return s;
    });
  }
  for (const n of mainDefs.keys()) reserved.ident.add(n);
  for (const lib of libs.values()) {
    for (const k of KINDS) {
      const pool = k === "classes" ? reserved.classes : k === "colors" ? reserved.colors : reserved.ident;
      for (const name of lib.defs[k].keys()) {
        let cand = name;
        for (let n = 2; pool.has(cand); n++) cand = name + n;
        pool.add(cand);
        lib.internal[k].set(name, cand);
      }
    }
  }

  // 4. Each file's scope: its own definitions, then what its imports bring.
  function scopeOf(own, imports, reportAt) {
    const scope = { ...Object.fromEntries(KINDS.map((k) => [k, new Map(own[k])])), ns: new Map() };
    const source = new Map(); // alias -> library id that brought it, for messages
    const ownHas = (k, name) => (k === "classes" || k === "colors" ? own[k].has(name) : own.values.has(name) || own.comps.has(name));
    const bring = (k, name, internal, imp) => {
      if (ownHas(k, name)) { reportAt(imp, `'${name}' is defined in this file and also imported from '${imp.id}'`); return; }
      const prev = scope[k].get(name);
      if (prev === undefined) { scope[k].set(name, internal); source.set(k + name, imp.id); return; }
      if (prev === internal || prev === AMBIG) return;
      scope[k].set(name, AMBIG);
      source.set(k + name, `${source.get(k + name)}' and '${imp.id}`);
    };
    for (const imp of imports) {
      if (!imp.lib) continue;
      if (imp.ns) {
        if (scope.ns.has(imp.ns)) reportAt(imp, `Two imports are both named '${imp.ns}'`);
        else if (mainDefs.has(imp.ns) && own === ownMain) reportAt(imp, `'${imp.ns}' is already a name in this file (line ${mainDefs.get(imp.ns)})`);
        else scope.ns.set(imp.ns, imp.lib.internal);
      } else if (imp.names) {
        for (const n of imp.names) {
          const k = n[0] === "." ? "classes" : n[0] === "#" ? "colors" : imp.lib.defs.comps.has(n) ? "comps" : "values";
          const name = n.replace(/^[.#]/, "");
          if (!imp.lib.defs[k].has(name)) { reportAt(imp, `'${imp.id}' has no '${n}'`); continue; }
          bring(k, name, imp.lib.internal[k].get(name), imp);
        }
      } else {
        for (const k of KINDS) for (const [name, internal] of imp.lib.internal[k]) bring(k, name, internal, imp);
      }
    }
    scope.source = source;
    return scope;
  }
  const ownMain = Object.fromEntries(KINDS.map((k) => [k, new Map()]));
  for (const n of mainDefs.keys()) ownMain.values.set(n, n);
  for (const st of main) {
    let m;
    if (st.orphan) continue;
    if ((m = st.text.match(CLASS))) ownMain.classes.set(m[1], m[1]);
    if ((m = st.text.match(COLOR))) ownMain.colors.set(m[1], m[1]);
  }
  const mainScope = scopeOf(ownMain, mainImports, (imp, msg) => errors.push({ line: imp.line, message: msg }));

  // 5. Rewrite names through a scope.
  function rewrite(list, scope, report) {
    const sh = shadows(list);
    const complained = new Set();
    const ambiguous = (k, name, st) => {
      if (complained.has(k + name)) return;
      complained.add(k + name);
      report(st, `'${name}' is imported from both '${scope.source.get(k + name)}'; import one of them with 'as'`);
    };
    const pick = (k, name, st) => {
      const v = scope[k].get(name);
      if (v === AMBIG) { ambiguous(k, name, st); return undefined; }
      return v;
    };
    const token = (k, sep) => (all, lead, name, st) => {
      let v = pick(k, name, st);
      if (v === undefined && name.includes("-")) {
        const ns = scope.ns.get(name.slice(0, name.indexOf("-")));
        if (ns) {
          v = ns[k].get(name.slice(name.indexOf("-") + 1));
          if (v === undefined) report(st, `'${name.slice(0, name.indexOf("-"))}' has no ${sep}${name.slice(name.indexOf("-") + 1)}`);
        }
      }
      return v === undefined ? all : lead + sep + v;
    };
    return list.map((st, i) => {
      if (st.orphan) return st;
      let head = "", text = st.text, m;
      if ((m = text.match(CLASS))) { head = `class ${pick("classes", m[1], st) ?? m[1]}`; text = text.slice(m[0].length); }
      else if ((m = text.match(COLOR))) return { ...st, text: `color ${pick("colors", m[1], st) ?? m[1]}${text.slice(m[0].length)}` };
      text = outsideStrings(text, (s) => s
        .replace(/(^|[\s{(,])\.([A-Za-z_][\w-]*)/g, (all, lead, name) => token("classes", ".")(all, lead, name, st))
        .replace(/(^|[\s{(,:])#([A-Za-z_][\w-]*)/g, (all, lead, name) => token("colors", "#")(all, lead, name, st)));
      text = substitute(text, (name) => {
        if (sh[i].has(name)) return undefined;
        return pick("values", name, st) ?? pick("comps", name, st);
      }, (h, props) => {
        if (sh[i].has(h)) return undefined;
        const ns = scope.ns.get(h);
        if (!ns) return undefined;
        const v = ns.values.get(props[0]) ?? ns.comps.get(props[0]);
        if (v === undefined) { report(st, `'${h}' has no '${props[0]}'`); return undefined; }
        return v + (props.length > 1 ? "." + props.slice(1).join(".") : "");
      });
      return { ...st, text: head + text };
    });
  }
  const mainOut = rewrite(main, mainScope, (st, msg) => errors.push({ line: st.line, message: msg }));
  for (const lib of libs.values()) {
    const scope = scopeOf(lib.internal, lib.imports, (imp, msg) => errors.push({ line: lib.at, message: `In '${lib.id}' line ${imp.line}: ${msg}` }));
    lib.out = rewrite(lib.statements, scope, (st, msg) => errors.push({ line: lib.at, message: `In '${lib.id}' line ${st.line}: ${msg}` }))
      .map((st, k) => ({ ...st, line: lib.at, libLine: lib.statements[k].line, lib: lib.id, value: lib.statements[k].value }));
  }

  // 6. Keep only the functions and constants something reaches.
  const valueDefs = new Map(); // internal name -> { st, lib }
  const compBodies = new Map(); // internal component name -> its statements
  for (const lib of libs.values()) {
    let current = null;
    for (const st of lib.out) {
      const m = st.text.match(COMPONENT);
      if (m) { current = []; compBodies.set(m[1], current); }
      if (current) { current.push(st); if (st.text === "}") current = null; continue; }
      if (st.value) valueDefs.set(assigned(st.text).name, { st, lib });
    }
  }
  const used = new Set(), queue = [];
  const scan = (text, skip = []) => { for (const id of identifiers(text)) if (!skip.includes(id) && !used.has(id)) { used.add(id); queue.push(id); } };
  for (const st of mainOut) if (!st.orphan) scan(st.text);
  for (const lib of libs.values()) for (const st of lib.out) if (CLASS.test(st.text)) scan(st.text);
  while (queue.length) {
    const id = queue.shift();
    if (compBodies.has(id)) for (const st of compBodies.get(id)) scan(st.text);
    if (valueDefs.has(id)) { const { st } = valueDefs.get(id); scan(st.text, assigned(st.text).args); }
  }

  // 7. Emit: definitions first (hoisted anyway), then each library's used helpers in a
  //    collapsed folder, then the file itself.
  const out = [];
  for (const lib of libs.values()) {
    const helpers = [];
    for (const st of lib.out) {
      if (st.value) { if (used.has(assigned(st.text).name)) helpers.push(st); }
      else out.push(st);
    }
    if (helpers.length) {
      out.push({ text: `folder ${JSON.stringify(libTitle(lib.id))} collapsed {`, line: lib.at, comments: [], lib: lib.id });
      out.push(...helpers);
      out.push({ text: "}", line: lib.at, comments: [], lib: lib.id });
    }
  }
  out.push(...mainOut);
  return { statements: out, imports: mainImports.map(({ spec, id, ns, names, line }) => ({ spec, id, ns, names, line })) };
}
