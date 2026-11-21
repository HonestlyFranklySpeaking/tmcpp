// v2 components (docs/v2 spec, M5).
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
//   - `s1.d` anywhere in the file reads a local or a parameter of an instance
import { desmosName } from "./implicit.js";

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
// x, y and r on the left of `=` draw a curve (y = x^2, r = 1 + cos(θ)); they are never locals.
const CURVE_VARS = new Set(["x", "y", "r"]);
const FORBIDDEN_IN_BODY = /^(component|folder|table|class|color|settings|ticker|image)\b/;

function matchClose(s, open) {
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

function splitArgs(s) {
  const out = [];
  let depth = 0, inStr = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
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
const closest = (w, list) => {
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
 * `member(inst, prop) -> text | undefined` handles `inst.prop` first.
 */
function substitute(text, lookup, member = null) {
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
        const mm = text.slice(i).match(/^([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)/);
        if (mm) {
          const r = member(mm[1], mm[2]);
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

const identifiers = (text) =>
  (text.replace(/"(?:[^"\\]|\\.)*"/g, " ").match(/(?<![.#\w])[A-Za-z][A-Za-z0-9_]*/g) ?? []);

/** Name on the left of `=`: `d = ...` -> {name:"d"}, `f(u, v) = ...` -> {name:"f", args:["u","v"]}. */
function assigned(text) {
  const m = text.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(?:\(([^()]*)\))?\s*=(?!=)/);
  if (!m) return null;
  return { name: m[1], args: m[2] ? m[2].split(",").map((s) => s.trim()) : [] };
}

/** Where an instance tail may start: a style token, a class, raw @{ }, a label or click. */
const isTail = (s) => s === "" || /^(\.|#|@\{|label\b|click\(|click-label\b)/.test(s);

/**
 * Expand components. Returns { statements, components, instances }. Definitions are removed
 * (they draw nothing); each instance becomes folder-open, body lines, folder-close statements.
 */
export function expandComponents(statements, errors, warnings) {
  const components = new Map();
  const defLines = new Set();

  // 1. Collect and hoist definitions.
  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];
    if (!/^component\b/.test(st.text)) continue;
    defLines.add(i);
    const m = st.text.match(/^component\s+([A-Za-z][A-Za-z0-9_]*)\s*\((.*)\)\s*\{$/);
    const body = [];
    let j = i + 1;
    for (; j < statements.length && statements[j].text !== "}"; j++) {
      if (!statements[j].orphan) body.push(statements[j]);
      defLines.add(j);
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
      const pm = p.match(/^([A-Za-z][A-Za-z0-9_]*)\s*(?:=\s*(.+))?$/);
      if (!pm) { errors.push({ line: st.line, message: `Malformed parameter '${p}'` }); continue; }
      if (pm[1] === "x" || pm[1] === "y") errors.push({ line: st.line, message: `A parameter can't be named '${pm[1]}' (it would clash with P.${pm[1]})` });
      if (params.some((q) => q.name === pm[1])) errors.push({ line: st.line, message: `Parameter '${pm[1]}' is listed twice` });
      params.push({ name: pm[1], default: pm[2]?.trim() });
    }

    const locals = new Map(); // name -> body line
    for (const b of body) {
      if (FORBIDDEN_IN_BODY.test(b.text)) {
        errors.push({ line: b.line, message: `'${b.text.split(/\s/)[0]}' can't go inside a component` });
        b.bad = true;
        continue;
      }
      if (/^new\b/.test(b.text)) {
        errors.push({ line: b.line, message: "Using a component inside another component isn't supported yet (coming in M6)" });
        b.bad = true;
        continue;
      }
      const a = assigned(b.text);
      if (!a || CURVE_VARS.has(a.name)) continue;
      if (params.some((p) => p.name === a.name)) {
        errors.push({ line: b.line, message: `'${a.name}' is a parameter of ${name}; give the local another name` });
        continue;
      }
      if (locals.has(a.name)) {
        errors.push({ line: b.line, message: `'${a.name}' is already defined in ${name} on line ${locals.get(a.name)}` });
        continue;
      }
      b.fnArgs = a.args;
      locals.set(a.name, b.line);
    }
    components.set(name, { name, line: st.line, params, locals, body: body.filter((b) => !b.bad) });
  }

  const rest = statements.filter((_, i) => !defLines.has(i));

  // 2. Find instances.
  const instances = new Map();
  const anonCount = new Map();
  const parsed = new Map(); // statement -> parsed instance
  const assignedNames = new Set(rest.map((s) => assigned(s.text)?.name).filter(Boolean));
  for (const st of rest) {
    if (!/^new\b/.test(st.text)) continue;
    const m = st.text.match(/^new\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/);
    if (!m) { errors.push({ line: st.line, message: "Malformed instance; expected: new Name(args) as name" }); st.bad = true; continue; }
    const open = m[0].length - 1;
    const close = matchClose(st.text, open);
    if (close === -1) { errors.push({ line: st.line, message: "Unclosed '(' in instance" }); st.bad = true; continue; }
    let after = st.text.slice(close + 1).trim();
    let instName = null;
    const am = after.match(/^as\s+([A-Za-z][A-Za-z0-9_]*)\b\s*/);
    if (am) { instName = am[1]; after = after.slice(am[0].length).trim(); }
    else if (/^as\b/.test(after)) { errors.push({ line: st.line, message: "Expected a name after 'as'" }); st.bad = true; continue; }
    if (!isTail(after)) {
      errors.push({ line: st.line, message: `Unexpected '${after.split(/\s/)[0]}' after the instance; a style tail starts with '.'` });
      st.bad = true;
      continue;
    }
    const comp = components.get(m[1]);
    if (!comp) {
      const hint = closest(m[1], [...components.keys()]);
      errors.push({ line: st.line, message: `Unknown component '${m[1]}'` + (hint ? ` (did you mean '${hint}'?)` : "") });
      st.bad = true;
      continue;
    }

    // Bind arguments: positional, then named, then defaults.
    const bound = new Map();
    let sawNamed = false, ok = true;
    const args = splitArgs(st.text.slice(open + 1, close));
    args.forEach((a, k) => {
      const nm = a.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=(?!=)\s*(.+)$/);
      if (nm && comp.params.some((p) => p.name === nm[1])) {
        sawNamed = true;
        if (bound.has(nm[1])) { errors.push({ line: st.line, message: `'${nm[1]}' is given twice` }); ok = false; }
        bound.set(nm[1], nm[2].trim());
        return;
      }
      if (nm && !/[<>]/.test(nm[2])) {
        errors.push({ line: st.line, message: `${comp.name} has no parameter '${nm[1]}'` + (closest(nm[1], comp.params.map((p) => p.name)) ? ` (did you mean '${closest(nm[1], comp.params.map((p) => p.name))}'?)` : "") });
        ok = false;
        return;
      }
      if (sawNamed) { errors.push({ line: st.line, message: "Positional arguments must come before named ones" }); ok = false; return; }
      const p = comp.params[k];
      if (!p) { errors.push({ line: st.line, message: `${comp.name} takes ${comp.params.length} argument${comp.params.length === 1 ? "" : "s"}, got ${args.length}` }); ok = false; return; }
      if (a === "") { errors.push({ line: st.line, message: "Empty argument" }); ok = false; return; }
      bound.set(p.name, a);
    });
    for (const p of comp.params) {
      if (bound.has(p.name)) continue;
      if (p.default !== undefined) bound.set(p.name, p.default);
      else { errors.push({ line: st.line, message: `Missing argument '${p.name}' for ${comp.name}` }); ok = false; }
    }
    if (!ok) { st.bad = true; continue; }

    let key = instName, title = instName;
    if (instName) {
      if (instances.has(instName)) { errors.push({ line: st.line, message: `Instance '${instName}' already exists (line ${instances.get(instName).line})` }); st.bad = true; continue; }
      if (assignedNames.has(instName)) { errors.push({ line: st.line, message: `'${instName}' is already a variable in this file; name the instance something else` }); st.bad = true; continue; }
    } else {
      const n = (anonCount.get(comp.name) ?? 0) + 1;
      anonCount.set(comp.name, n);
      title = `${comp.name} ${n}`;
      key = `${comp.name}${n}`;
    }
    const inst = { comp, name: instName, title, key, bound, tail: after, line: st.line, names: new Map() };
    if (instName) instances.set(instName, inst);
    parsed.set(st, inst);
  }

  // 3. Allocate a Desmos name for every local of every instance, avoiding every name in use.
  const used = new Set();
  for (const st of rest) {
    if (parsed.has(st) || st.bad) continue;
    for (const id of identifiers(st.text)) used.add(desmosName(id));
  }
  for (const comp of components.values()) {
    const own = new Set([...comp.params.map((p) => p.name), ...comp.locals.keys()]);
    for (const b of comp.body) for (const id of identifiers(b.text)) if (!own.has(id)) used.add(desmosName(id));
  }
  for (const st of rest) {
    const inst = parsed.get(st);
    if (!inst) continue;
    const suffix = inst.key.replace(/[^A-Za-z0-9]/g, "");
    for (const local of inst.comp.locals.keys()) {
      const base = `${local[0]}_${local.slice(1).replace(/_/g, "")}${suffix}`;
      let name = base;
      for (let k = 1; used.has(name); k++) name = k === 1 ? `${base}x` : `${base}x${k}`;
      used.add(name);
      inst.names.set(local, name);
    }
  }

  const member = (instName, prop) => {
    const inst = instances.get(instName);
    if (!inst) return undefined;
    if (inst.names.has(prop)) return inst.names.get(prop);
    if (inst.bound.has(prop)) return wrap(inst.bound.get(prop));
    return null; // reported below
  };
  const memberChecked = (line) => (instName, prop) => {
    const r = member(instName, prop);
    if (r === null) {
      const inst = instances.get(instName);
      const all = [...inst.comp.params.map((p) => p.name), ...inst.comp.locals.keys()];
      const hint = closest(prop, all);
      errors.push({ line, message: `${instName} (a ${inst.comp.name}) has no member '${prop}'` + (hint ? ` (did you mean '${hint}'?)` : "") });
      return undefined;
    }
    return r;
  };

  // 4. Emit.
  const out = [];
  const seenDrawn = new Map();
  let depth = 0;
  for (const st of rest) {
    if (/^(folder|table)\b.*\{$/.test(st.text)) depth++;
    else if (st.text === "}") depth--;
    const inst = parsed.get(st);
    if (!inst) {
      if (st.bad) continue;
      out.push(instances.size ? { ...st, text: substitute(st.text, () => undefined, memberChecked(st.line)) } : st);
      continue;
    }
    const lookup = (fnArgs) => (name) => {
      if (fnArgs?.includes(name)) return undefined;
      if (inst.names.has(name)) return inst.names.get(name);
      if (inst.bound.has(name)) return wrap(inst.bound.get(name));
      return undefined;
    };
    if (depth === 0) out.push({ text: `folder ${JSON.stringify(inst.title)} {`, line: st.line, comments: st.comments, instance: inst.key });
    inst.body = [];
    inst.comp.body.forEach((b, k) => {
      let text = substitute(b.text, lookup(b.fnArgs), memberChecked(b.line));
      if (inst.tail) text += " " + inst.tail;
      out.push({ text, line: b.line, comments: [...b.comments], instance: inst.key });
      inst.body.push(text);
      const a = assigned(b.text);
      if (!a || CURVE_VARS.has(a.name)) {
        const key = `${inst.comp.name}#${k}`;
        if (!seenDrawn.has(key)) seenDrawn.set(key, new Map());
        const prev = seenDrawn.get(key).get(text);
        if (prev) warnings.push({ line: b.line, message: `${inst.title} and ${prev} draw this line identically, on top of each other` });
        else seenDrawn.get(key).set(text, inst.title);
      }
    });
    if (depth === 0) out.push({ text: "}", line: st.line, comments: [], instance: inst.key });
  }
  return { statements: out, components, instances: [...parsed.values()] };
}
