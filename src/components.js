// v2 components (docs/v2 spec, M5 and M6).
//
//   component Spring(A, B, coils = 8) { ...body lines... }
//   new Spring((0, 0), (4, 1)) as s1  . dashed #red
//
// Expansion is the first pass of the compiler: every instance becomes a folder of ordinary
// TMC++ lines, so classes, renaming and rewrites all run on the result unchanged.
//   - parameters are substituted as (bracketed) text; they are not Desmos variables
//   - locals (`d = B - A`, `f(u) = ...`) get one Desmos name per instance, from an allocator
//     that never reuses a name the file already uses (`d` in `s1` -> d_s1, or d_s1x if taken)
//   - the instance tail is appended after each line's own tail, so the instance wins
//   - `s1.d` anywhere in the file reads a local or a parameter of an instance; `s1.a.d` reaches
//     into instance `a` nested inside `s1`. Nested instances share the outer instance's folder.
import { desmosName } from "./implicit.js";

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
// x and y on the left of `=` draw a curve (y = x^2); they are never locals. `r = ...` is a polar
// curve (r = 5 is a circle) unless another line of the same body uses r, as in
// `r = s` + `x^2 + y^2 = r^2`: then r is a local, a radius. With theta it is always polar.
const CURVE_VARS = new Set(["x", "y"]);
const isCurve = (a, b, body) => {
  if (CURVE_VARS.has(a.name)) return true;
  if (a.name !== "r" || a.args.length) return false;
  if (/\btheta\b/.test(b.text.slice(b.text.indexOf("=") + 1))) return true;
  return !body.some((o) => o !== b && identifiers(o.text).includes("r"));
};
const MISSPELT = /^(compoment|componet|compnent|componnet|comp)\s+[A-Za-z]/;
const FORBIDDEN_IN_BODY = /^(component|folder|table|class|color|settings|ticker|image)\b/;

export function matchClose(s, open) {
  let depth = 0, inStr = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c) && --depth === 0) return i;
  }
  return -1;
}

export function splitArgs(s, separator = ",") {
  const out = [];
  let depth = 0, inStr = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === separator && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  const last = s.slice(start).trim();
  if (last || out.length) out.push(last);
  return out;
}

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
export const closest = (w, list) => {
  let best = null, score = Infinity;
  for (const c of list) { const s = levenshtein(w.toLowerCase(), c.toLowerCase()); if (s < score) { best = c; score = s; } }
  return score <= Math.max(1, Math.floor(w.length / 3)) ? best : null;
};

/** An argument as text that can be dropped in anywhere: bracketed unless it is one atom. */
function wrap(arg) {
  if (/^[A-Za-z0-9_.]+$/.test(arg) || /^"(?:[^"\\]|\\.)*"$/.test(arg)) return arg;
  if (/^[(\[]/.test(arg) && matchClose(arg, 0) === arg.length - 1) return arg;
  return `(${arg})`;
}

/**
 * Replace identifiers using `lookup(name) -> text | undefined`. Strings are left alone except
 * inside `${...}`; names right after `.` (P.x, .class) or `#` (#colour) are never touched.
 * `member(head, props) -> text | undefined` handles a path like `s1.a.d` first.
 */
/** A string parameter used inside another string, "${text}: ${v}", is spliced in as its text. */
const spliceStrings = (text) => text.replace(/\$\{\s*"((?:[^"\\]|\\.)*)"\s*\}/g, (all, body) => body.replace(/\\"/g, '"'));

export function substitute(text, lookup, member = null) {
  let out = "";
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1, body = "";
      for (; j < text.length && text[j] !== '"'; j++) {
        if (text[j] === "\\") { body += text[j] + (text[j + 1] ?? ""); j++; continue; }
        if (text.startsWith("${", j)) {
          const end = text.indexOf("}", j);
          if (end !== -1) { body += "${" + substitute(text.slice(j + 2, end), lookup, member) + "}"; j = end; continue; }
        }
        body += text[j];
      }
      out += `"${body}"`;
      i = j + 1;
      continue;
    }
    const m = /[A-Za-z]/.test(c) && text.slice(i).match(/^[A-Za-z][A-Za-z0-9_]*/);
    if (m) {
      const name = m[0];
      const prev = text[i - 1];
      if (prev === "." || prev === "#" || (prev && /[A-Za-z0-9_]/.test(prev) && !/[0-9]/.test(prev))) {
        out += name; i += name.length; continue;
      }
      if (member) {
        const mm = text.slice(i).match(/^([A-Za-z][A-Za-z0-9_]*)((?:\.[A-Za-z][A-Za-z0-9_]*)+)/);
        if (mm) {
          const r = member(mm[1], mm[2].slice(1).split("."));
          if (r !== undefined) { out += r; i += mm[0].length; continue; }
        }
      }
      const r = lookup(name);
      out += r === undefined ? name : r;
      i += name.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export const identifiers = (text) =>
  (text.replace(/"(?:[^"\\]|\\.)*"/g, " ").match(/(?<![.#\w])[A-Za-z][A-Za-z0-9_]*/g) ?? []);

/** Name on the left of `=`: `d = ...` -> {name:"d"}, `f(u, v) = ...` -> {name:"f", args:["u","v"]}. */
export function assigned(text) {
  const m = text.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(?:\(([^()]*)\))?\s*=(?!=)/);
  if (!m) return null;
  return { name: m[1], args: m[2] ? m[2].split(",").map((s) => s.trim()) : [] };
}

/** Where an instance tail may start: a style token, a class, raw @{ }, a label or click. */
const isTail = (s) => s === "" || /^(\.|#|@\{|label\b|click\(|click-label\b)/.test(s);

/** Parse `new Name(args) [as name] [tail]`. Returns { comp, args, name, tail } or { error }. */
function parseNew(text) {
  const m = text.match(/^new\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/);
  if (!m) return { error: "Malformed instance; expected: new Name(args) as name" };
  const open = m[0].length - 1;
  const close = matchClose(text, open);
  if (close === -1) return { error: "Unclosed '(' in instance" };
  let after = text.slice(close + 1).trim();
  // A list instance: new Cell(i, j) for i = [1...9], j = [1...9] as cells
  let forText = null;
  if (/^for\s/.test(after)) {
    let depth = 0, end = after.length;
    for (let k = 4; k < after.length; k++) {
      const c = after[k];
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (depth === 0 && /\s/.test(c) && /^\s+(as\b|\.[\sA-Za-z]|#|@\{|label\b|click\()/.test(after.slice(k))) { end = k; break; }
    }
    forText = after.slice(4, end).trim();
    after = after.slice(end).trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*\s*=/.test(forText)) return { error: "Expected 'for name = [list]' after the instance" };
  }
  let name = null;
  const am = after.match(/^as\s+([A-Za-z][A-Za-z0-9_]*)\b\s*/);
  if (am) { name = am[1]; after = after.slice(am[0].length).trim(); }
  else if (/^as\b/.test(after)) return { error: "Expected a name after 'as'" };
  if (!isTail(after)) return { error: `Unexpected '${after.split(/\s/)[0]}' after the instance; a style tail starts with '.'` };
  return { comp: m[1], args: splitArgs(text.slice(open + 1, close)), name, tail: after, forText };
}

/** Split a line into math and style tail (the tail starts at " . ", " .class", " #", " @{", label, click). */
function splitTail(text) {
  let depth = 0, inStr = false;
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (inStr) { if (c === "\\") k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (depth === 0 && k > 0 && /\s/.test(text[k - 1]) &&
      (/^\.(\s|[A-Za-z]|$)/.test(text.slice(k)) || /^(#|@\{|label\s|click\()/.test(text.slice(k)))) {
      return [text.slice(0, k).trimEnd(), text.slice(k)];
    }
  }
  return [text, ""];
}

/** Bind arguments: positional, then named, then defaults. Returns a Map, or null after errors. */
function bindArgs(comp, args, report) {
  const bound = new Map();
  let sawNamed = false, ok = true;
  const fail = (message) => { report(message); ok = false; };
  args.forEach((a, k) => {
    const nm = a.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=(?!=)\s*(.+)$/);
    if (nm && comp.params.some((p) => p.name === nm[1])) {
      sawNamed = true;
      if (bound.has(nm[1])) fail(`'${nm[1]}' is given twice`);
      bound.set(nm[1], nm[2].trim());
      return;
    }
    if (nm && !/[<>]/.test(nm[2])) {
      const hint = closest(nm[1], comp.params.map((p) => p.name));
      return fail(`${comp.name} has no parameter '${nm[1]}'` + (hint ? ` (did you mean '${hint}'?)` : ""));
    }
    if (sawNamed) return fail("Positional arguments must come before named ones");
    const p = comp.params[k];
    if (!p) return fail(`${comp.name} takes ${comp.params.length} argument${comp.params.length === 1 ? "" : "s"}, got ${args.length}`);
    if (a === "") return fail("Empty argument");
    bound.set(p.name, a);
  });
  for (const p of comp.params) {
    if (bound.has(p.name)) continue;
    if (p.default !== undefined) bound.set(p.name, p.default);
    else fail(`Missing argument '${p.name}' for ${comp.name}`);
  }
  return ok ? bound : null;
}

/**
 * Expand components. Returns { statements, components, instances }. Definitions are removed
 * (they draw nothing); each top-level instance becomes folder-open, body lines, folder-close.
 * Instances inside a body (nesting) put their lines straight into the outer instance's folder.
 */
export function expandComponents(statements, errors, warnings) {
  const components = new Map();
  const defLines = new Set();

  // 1. Collect and hoist definitions.
  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];
    if (!/^component\b/.test(st.text) && !MISSPELT.test(st.text)) continue;
    defLines.add(i);
    if (MISSPELT.test(st.text)) {
      errors.push({ line: st.line, message: `Unknown keyword '${st.text.split(/\s/)[0]}' (did you mean 'component'?)` });
    }
    const m = st.text.match(/^[A-Za-z]+\s+([A-Za-z][A-Za-z0-9_]*)\s*\((.*)\)\s*\{$/);
    const body = [];
    let j = i + 1, depth = 0, skipTo = -1;
    for (; j < statements.length && !(statements[j].text.startsWith("}") && depth === 0); j++) {
      const t = statements[j].text;
      defLines.add(j);
      if (t.startsWith("}")) depth--;
      // A block that can't go in a body (another component, a folder...): one error at its header,
      // and its lines and closing } are left out, so the outer component still closes properly.
      if (depth === 0 && t.endsWith("{") && FORBIDDEN_IN_BODY.test(t)) {
        const what = t.split(/\s/)[0];
        if (!statements[j].lib) errors.push({ line: statements[j].line, message: what === "component"
          ? "A component can't be defined inside another component; define it at the top level and use 'new' inside instead"
          : `'${what}' can't go inside a component` });
        skipTo = depth;
      } else if (skipTo === -1 && !statements[j].orphan) body.push(statements[j]);
      if (t.endsWith("{")) depth++;
      if (skipTo !== -1 && depth === skipTo && t.startsWith("}")) skipTo = -1;
    }
    if (j < statements.length) defLines.add(j);
    else errors.push({ line: st.line, message: "Component is never closed; end it with '}'" });
    i = j;
    if (!m) { errors.push({ line: st.line, message: "Malformed component; expected: component Name(a, b = 1) {" }); continue; }
    const [, name, paramText] = m;
    if (components.has(name)) {
      errors.push({ line: st.line, message: `Component '${name}' is already defined on line ${components.get(name).line}` });
      continue;
    }
    if (/^[a-z]/.test(name)) warnings.push({ line: st.line, message: `Component names usually start with a capital letter ('${name[0].toUpperCase() + name.slice(1)}')` });

    const params = [];
    for (const p of splitArgs(paramText)) {
      // `abstract coils = 8`: a real Desmos variable per instance, not text pasted into the body.
      const abstract = /^abstract\s+/.test(p);
      const pm = p.replace(/^abstract\s+/, "").match(/^([A-Za-z][A-Za-z0-9_]*)\s*(?:=\s*(.+))?$/);
      if (!pm) { errors.push({ line: st.line, message: `Malformed parameter '${p}'` }); continue; }
      if (pm[1] === "x" || pm[1] === "y") errors.push({ line: st.line, message: `A parameter can't be named '${pm[1]}' (it would clash with P.${pm[1]})` });
      if (params.some((q) => q.name === pm[1])) errors.push({ line: st.line, message: `Parameter '${pm[1]}' is listed twice` });
      // abstract coils = 8 [1 : 20]: the bounds belong to the parameter, whatever value is passed.
      let def = pm[2]?.trim(), bounds = "";
      const bm = abstract && def?.match(/^(.*\S)\s+(\[[^\[\],]*:[^\[\],]*\])$/);
      if (bm) { def = bm[1]; bounds = ` ${bm[2]}`; }
      params.push({ name: pm[1], default: def, abstract, bounds });
    }

    const locals = new Map();   // name -> body line
    const children = new Map(); // instance name inside the body -> body line
    const owned = (n) => params.some((p) => p.name === n) ? "a parameter" : locals.has(n) ? "a local" : children.has(n) ? "an instance" : null;
    for (const b of body) {
      if (FORBIDDEN_IN_BODY.test(b.text)) {
        errors.push({ line: b.line, message: `'${b.text.split(/\s/)[0]}' can't go inside a component` });
        b.bad = true;
        continue;
      }
      if (/^new\b/.test(b.text)) {
        const n = parseNew(b.text);
        if (n.error) { errors.push({ line: b.line, message: n.error }); b.bad = true; continue; }
        if (n.forText) { errors.push({ line: b.line, message: "A list instance (new ... for ...) can't go inside a component yet" }); b.bad = true; continue; }
        if (n.name && owned(n.name)) { errors.push({ line: b.line, message: `'${n.name}' is already ${owned(n.name)} in ${name}` }); b.bad = true; continue; }
        b.nested = n;
        if (n.name) children.set(n.name, b.line);
        continue;
      }
      const a = assigned(b.text);
      if (!a || isCurve(a, b, body)) continue;
      if (owned(a.name)) {
        errors.push({ line: b.line, message: owned(a.name) === "a parameter"
          ? `'${a.name}' is a parameter of ${name}; give the local another name`
          : `'${a.name}' is already defined in ${name} on line ${locals.get(a.name) ?? children.get(a.name)}` });
        continue;
      }
      b.fnArgs = a.args;
      locals.set(a.name, b.line);
    }
    components.set(name, { name, line: st.line, params, locals, body: body.filter((b) => !b.bad) });
  }

  // 2. Check nested instances once, at their definition: the component exists, the arguments
  //    bind, and no component contains itself (directly or through others).
  for (const comp of components.values()) {
    for (const b of comp.body) {
      if (!b.nested) continue;
      const inner = components.get(b.nested.comp);
      if (!inner) {
        const hint = closest(b.nested.comp, [...components.keys()]);
        errors.push({ line: b.line, message: `Unknown component '${b.nested.comp}'` + (hint ? ` (did you mean '${hint}'?)` : "") });
        b.bad = true;
      } else if (!bindArgs(inner, b.nested.args, (message) => errors.push({ line: b.line, message }))) b.bad = true;
    }
    comp.body = comp.body.filter((b) => !b.bad);
  }
  const cyclic = new Set();
  const visit = (name, path) => {
    if (path.includes(name)) {
      const loop = [...path.slice(path.indexOf(name)), name];
      if (!cyclic.has(loop[0])) {
        errors.push({ line: components.get(loop[0]).line, message: `${loop.join(" uses ")}: a component can't contain itself` });
      }
      loop.forEach((n) => cyclic.add(n));
      return;
    }
    for (const b of components.get(name)?.body ?? []) if (b.nested) visit(b.nested.comp, [...path, name]);
  };
  for (const name of components.keys()) visit(name, []);

  const rest = statements.filter((_, i) => !defLines.has(i));

  // 3. Every name already in use: the allocator never hands these out.
  const used = new Set();
  for (const st of rest) {
    if (/^new\b/.test(st.text)) continue;
    for (const id of identifiers(st.text)) used.add(desmosName(id));
  }
  for (const comp of components.values()) {
    const own = new Set([...comp.params.map((p) => p.name), ...comp.locals.keys()]);
    for (const b of comp.body) {
      if (b.nested) continue;
      for (const id of identifiers(b.text)) if (!own.has(id)) used.add(desmosName(id));
    }
  }
  const allocate = (local, suffix) => {
    const base = `${local[0]}_${local.slice(1).replace(/_/g, "")}${suffix}`;
    let name = base;
    for (let k = 1; used.has(name); k++) name = k === 1 ? `${base}x` : `${base}x${k}`;
    used.add(name);
    return name;
  };

  // 4. Plan instances (top-level first, in source order, each with its nested children), so
  //    `s1.a.d` resolves even on a line above the instance.
  const instances = new Map();          // top-level named instances
  const plans = new Map();              // statement -> top-level plan
  const anonCount = new Map();
  const assignedNames = new Set(rest.map((s) => assigned(s.text)?.name).filter(Boolean));

  // Resolve `head.p1.p2...` from a scope: an instance's children first, then top-level instances.
  // Returns text, undefined (not an instance path), or null (an instance without that member).
  const resolve = (scope, head, props, line, report = true) => {
    let inst = scope?.children.get(head) ?? instances.get(head);
    if (!inst) return undefined;
    let path = head;
    for (let k = 0; k < props.length; k++) {
      const p = props[k];
      const restProps = props.slice(k + 1).map((q) => "." + q).join("");
      if (inst.children.has(p)) { inst = inst.children.get(p); path += "." + p; continue; }
      if (inst.names.has(p)) return inst.names.get(p) + restProps;
      if (inst.bound.has(p)) return wrap(inst.bound.get(p)) + restProps;
      if (report) {
        const all = [...inst.comp.params.map((q) => q.name), ...inst.comp.locals.keys(), ...inst.children.keys()];
        const hint = closest(p, all);
        errors.push({ line, message: `${path} (a ${inst.comp.name}) has no member '${p}'` + (hint ? ` (did you mean '${hint}'?)` : "") });
      }
      return null;
    }
    return undefined; // a bare instance path is not a value
  };
  const memberFor = (scope, line) => (head, props) => {
    const r = resolve(scope, head, props, line);
    return r === null ? undefined : r;
  };
  // Text in an instance's body, written in terms of its parameters, locals and children.
  const inScope = (inst, text, fnArgs) => spliceStrings(substitute(text, (name) => {
    if (fnArgs?.includes(name)) return undefined;
    if (inst.names.has(name)) return inst.names.get(name);
    if (inst.bound.has(name)) return wrap(argText(inst, inst.bound.get(name)));
    return undefined;
  }, memberFor(inst, null)));
  // An argument of a top-level instance is written at file level, so another instance's member
  // in it (new ProgressBar(..., sl.val / 100)) resolves the way it would on a line of its own.
  const argText = (inst, arg) => (inst.key.includes(".") || !/[A-Za-z]\.[A-Za-z]/.test(arg) ? arg
    : substitute(arg, () => undefined, (head, props) => (instances.has(head) && instances.get(head) !== inst ? memberFor(null, inst.line)(head, props) : undefined)));

  const plan = (comp, bound, key, title, tail, line, forText = null) => {
    const inst = { comp, name: null, title, key, bound, tail, line, names: new Map(), children: new Map(), nested: new Map() };
    const suffix = key.replace(/[^A-Za-z0-9]/g, "");
    if (forText) {
      // List instance: every argument that uses a loop variable becomes one hidden list, and every
      // local becomes a list too (one entry per copy), so each copy has its own state.
      const loopVars = splitArgs(forText).map((b) => b.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=/)?.[1]).filter(Boolean);
      inst.list = { forText, defs: [], names: new Set() };
      for (const [p, arg] of bound) {
        if (!identifiers(arg).some((id) => loopVars.includes(id))) continue;
        const name = allocate(p, suffix);
        inst.names.set(p, name);
        inst.list.names.add(name);
        inst.list.defs.push(`${name} = [${arg} for ${forText}]`);
      }
    }
    // Abstract parameters become one variable per instance: c_oilss1 = 8. (In a list instance, one
    // that uses the loop is already a hidden list above.)
    inst.abstractDefs = [];
    for (const p of comp.params) {
      if (!p.abstract || inst.names.has(p.name)) continue;
      const name = allocate(p.name, suffix);
      inst.names.set(p.name, name);
      const value = bound.get(p.name);
      if (inst.list) {
        // In a list instance every copy gets its own value, like a local.
        inst.abstractDefs.push(`${name} = [${value} for ${inst.list.forText}]`);
        inst.list.names.add(name);
        continue;
      }
      inst.abstractDefs.push(`${name} = ${value}` + (/^-?\d*\.?\d+$/.test(value.trim()) ? p.bounds : " . hidden"));
    }
    for (const local of comp.locals.keys()) inst.names.set(local, allocate(local, suffix));
    if (inst.list) {
      // Desmos definitions can be forward-referenced, including from an earlier click.
      for (const b of comp.body) {
        if (b.fnArgs?.length === 0) inst.list.names.add(inst.names.get(assigned(b.text).name));
      }
    }
    const anon = new Map();
    comp.body.forEach((b, k) => {
      if (!b.nested || cyclic.has(comp.name)) return;
      const inner = components.get(b.nested.comp);
      // Arguments and the tail are written in the outer instance's terms.
      const args = b.nested.args.map((a) => inScope(inst, a));
      const childBound = bindArgs(inner, args, () => {});
      if (!childBound) return;
      const n = (anon.get(inner.name) ?? 0) + 1;
      if (!b.nested.name) anon.set(inner.name, n);
      const childKey = key + (b.nested.name ?? `${inner.name}${n}`);
      const child = plan(inner, childBound, childKey, title, inScope(inst, b.nested.tail), b.line);
      child.name = b.nested.name;
      if (b.nested.name) inst.children.set(b.nested.name, child);
      inst.nested.set(k, child);
    });
    return inst;
  };

  for (const st of rest) {
    if (!/^new\b/.test(st.text)) continue;
    const n = parseNew(st.text);
    if (n.error) { errors.push({ line: st.line, message: n.error }); st.bad = true; continue; }
    const comp = components.get(n.comp);
    if (!comp) {
      const hint = closest(n.comp, [...components.keys()]);
      errors.push({ line: st.line, message: `Unknown component '${n.comp}'` + (hint ? ` (did you mean '${hint}'?)` : "") });
      st.bad = true;
      continue;
    }
    if (cyclic.has(comp.name)) { st.bad = true; continue; }
    const bound = bindArgs(comp, n.args, (message) => errors.push({ line: st.line, message }));
    if (!bound) { st.bad = true; continue; }
    let key = n.name, title = n.name;
    if (n.name) {
      if (instances.has(n.name)) { errors.push({ line: st.line, message: `Instance '${n.name}' already exists (line ${instances.get(n.name).line})` }); st.bad = true; continue; }
      if (assignedNames.has(n.name)) { errors.push({ line: st.line, message: `'${n.name}' is already a variable in this file; name the instance something else` }); st.bad = true; continue; }
    } else {
      const k = (anonCount.get(comp.name) ?? 0) + 1;
      anonCount.set(comp.name, k);
      title = `${comp.name} ${k}`;
      key = `${comp.name}${k}`;
    }
    if (n.forText && comp.body.some((b) => b.nested)) {
      errors.push({ line: st.line, message: `${comp.name} uses other components, so it can't be a list instance yet` });
      st.bad = true;
      continue;
    }
    const inst = plan(comp, bound, key, title, n.tail, st.line, n.forText);
    inst.name = n.name;
    if (n.name) instances.set(n.name, inst);
    plans.set(st, inst);
  }

  // 5. Emit. Tails stack from the inside out: a line's own tokens, then its instance's tail,
  //    then each enclosing instance's tail, so the outermost instance has the last word.
  const out = [];
  const seenDrawn = new Map();
  // A body line of a list instance. A local that doesn't depend on the lists (m = 0) is repeated
  // once per copy; a click action on a list local changes only the clicked copy (Desmos's index).
  const listLine = (inst, b, text) => {
    const L = inst.list;
    const a = assigned(b.text);
    const isList = (t) => identifiers(t).some((id) => L.names.has(id));
    let [math, tail] = splitTail(text);
    if (a && inst.comp.locals.has(a.name) && !b.fnArgs?.length) {
      const name = inst.names.get(a.name);
      const rhs = math.slice(math.indexOf("=") + 1).trim();
      if (!isList(rhs) && !/\[\s*[^\]]*:[^\]]*\]\s*$/.test(rhs)) math = `${name} = [${rhs} for ${L.forText}]`;
      if (/^\s*\[/.test(rhs) && !isList(rhs)) {
        errors.push({ line: b.line, message: `'${a.name}' is a list, and Desmos has no lists of lists, so it can't be part of a list instance` });
      }
    }
    // A conditional action must test the clicked element and update only that element.
    // Walk whole action groups, leaving piecewise expressions on the RHS of an arrow intact.
    function clickBody(body) {
      const k = allocate("k", inst.key.replace(/[^A-Za-z0-9]/g, "") + "i");
      const atIndex = e => substitute(e, id => L.names.has(id) ? `${id}[index]` : undefined);
      function action(act) {
        if (act.startsWith("{") && matchClose(act, 0) === act.length - 1) {
          const arms = splitArgs(act.slice(1, -1)).map(arm => {
            const [guard, value] = splitArgs(arm, ":");
            return value === undefined ? action(guard) : `${atIndex(guard)}: ${action(value)}`;
          });
          return "{" + arms.join(", ") + "}";
        }
        if (act.startsWith("(") && matchClose(act, 0) === act.length - 1)
          return "(" + splitArgs(act.slice(1, -1)).map(action).join(", ") + ")";
        const m = act.match(/^([A-Za-z][A-Za-z0-9_]*)\s*->\s*([\s\S]+)$/);
        if (!m) return act;
        if (!L.names.has(m[1])) return act;
        return `${m[1]} -> [{${k} = index: ${atIndex(m[2])}, ${m[1]}[${k}]} for ${k} = [1...length(${m[1]})]]`;
      }
      return splitArgs(body).map(action).join(", ");
    }
    const clickTokens = /"(?:\\.|[^"\\])*"|\bclick\(/g;
    for (let match; (match = clickTokens.exec(tail));) {
      if (match[0] !== "click(") continue;
      const open = clickTokens.lastIndex - 1, close = matchClose(tail, open);
      if (close < 0) break;
      const body = clickBody(tail.slice(open + 1, close));
      tail = tail.slice(0, open + 1) + body + tail.slice(close);
      clickTokens.lastIndex = open + body.length + 2;
    }
    return tail ? `${math} ${tail}` : math;
  };

  const emitBody = (inst, outer, topKey) => {
    for (const def of inst.abstractDefs ?? []) out.push({ text: def, line: inst.line, comments: [], instance: topKey });
    inst.comp.body.forEach((b, k) => {
      if (b.nested) {
        const child = inst.nested.get(k);
        if (child) emitBody(child, [inst.tail, ...outer], topKey);
        return;
      }
      let text = inScope(inst, b.text, b.fnArgs);
      if (inst.list) text = listLine(inst, b, text);
      const tails = [inst.tail, ...outer].filter(Boolean);
      if (tails.length) text += " " + tails.join(" ");
      out.push({ text, line: b.line, comments: [...b.comments], instance: topKey });
      const a = assigned(b.text);
      if (!a || !inst.comp.locals.has(a.name)) {
        const key = `${inst.comp.name}#${k}`;
        if (!seenDrawn.has(key)) seenDrawn.set(key, new Map());
        const label = inst.key === topKey ? inst.title : `${inst.title} (${inst.key})`;
        const prev = seenDrawn.get(key).get(text);
        if (prev) warnings.push({ line: b.line, message: `${label} and ${prev} draw this line identically, on top of each other` });
        else seenDrawn.get(key).set(text, label);
      }
    });
  };
  let depth = 0;
  for (const st of rest) {
    if (/^(folder|table)\b.*\{$/.test(st.text)) depth++;
    else if (st.text === "}") depth--;
    const inst = plans.get(st);
    if (!inst) {
      if (st.bad) continue;
      out.push(instances.size ? { ...st, text: substitute(st.text, () => undefined, memberFor(null, st.line)) } : st);
      continue;
    }
    if (depth === 0) out.push({ text: `folder ${JSON.stringify(inst.title)} {`, line: st.line, comments: st.comments, instance: inst.key });
    for (const def of inst.list?.defs ?? []) out.push({ text: `${def} . hidden`, line: st.line, comments: [], instance: inst.key });
    emitBody(inst, [], inst.key);
    if (depth === 0) out.push({ text: "}", line: st.line, comments: [], instance: inst.key });
  }
  return { statements: out, components, instances: [...plans.values()] };
}
