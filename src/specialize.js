// Specialisation: a component whose for loop counts over one of its parameters gets one copy per
// value it's used with, like a C++ template. `component Row(n) { for i in [1...n] { ... } }` and
// `new Row(4) as r` become a private copy of Row with 4 written into its body, used by that line.
// for loops are written out when compiling, before components, so without this the loop would
// only ever see the name n. Runs right before lowerMacros; nothing after it changes.
import { splitArgs, matchClose, substitute } from "./components.js";
import { constant as number } from "./macros.js";
const constant = (t) => { const v = number(t); return v === null ? null : String(v); };

const COMP = /^component\s+([A-Za-z][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*\{$/;
const FOR = /^for\s+[A-Za-z][A-Za-z0-9_]*\s+in\s+([\s\S]+?)\s*\{$/;
const NEW = /^new\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/;

// The values go in as numbers. A range's ... is hidden first, or [1...n] would read as a member .n.
const paste = (text, values) => substitute(text.replace(/\.\.\./g, "\u0001"), (n) => (n in values ? `(${values[n]})` : undefined)).replace(/\u0001/g, "...");

const names = (text) => new Set(text.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? []);

/** Component definitions: name -> { start, end, params: [{ name, default, abstract }], body }. */
function definitions(statements) {
  const defs = new Map();
  for (let i = 0; i < statements.length; i++) {
    const m = !statements[i].orphan && COMP.exec(statements[i].text);
    if (!m) continue;
    let j = i + 1, depth = 0;
    for (; j < statements.length; j++) {
      const t = statements[j].text;
      if (statements[j].orphan) continue;
      if (t.startsWith("}") && depth === 0) break;
      if (t.startsWith("}")) depth--;
      if (t.endsWith("{")) depth++;
    }
    const params = splitArgs(m[2]).map((p) => p.trim()).filter(Boolean).map((p) => {
      const abstract = /^abstract\s+/.test(p);
      const pm = p.replace(/^abstract\s+/, "").match(/^([A-Za-z][A-Za-z0-9_]*)\s*(?:=\s*(.+))?$/);
      return pm && { name: pm[1], default: pm[2]?.trim(), abstract };
    }).filter(Boolean);
    if (!defs.has(m[1])) defs.set(m[1], { name: m[1], start: i, end: j, params, body: statements.slice(i + 1, j) });
    i = j;
  }
  return defs;
}

/** Bind a new line's arguments to parameters: positional, then named, then defaults. */
function bind(def, argText) {
  const bound = new Map();
  splitArgs(argText).map((a) => a.trim()).filter(Boolean).forEach((a, k) => {
    const nm = a.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=(?!=)\s*([\s\S]+)$/);
    if (nm && def.params.some((p) => p.name === nm[1])) bound.set(nm[1], nm[2].trim());
    else if (def.params[k]) bound.set(def.params[k].name, a);
  });
  for (const p of def.params) if (!bound.has(p.name) && p.default !== undefined) bound.set(p.name, p.default);
  return bound;
}

/**
 * Returns { statements, names }: names maps each copy's name back to the component it copies, so
 * messages can say "a Grid", not "a Grid_2_3".
 */
export function specializeLoops(statements, errors) {
  let out = statements;
  const made = new Map(); // "Row|n=4" -> specialised name
  const names_ = new Map();
  for (let round = 0; round < 20; round++) {
    const defs = definitions(out);
    // Which parameters set a loop's count: used in a for range, or passed on to a nested new whose
    // own count depends on them.
    const counting = new Map([...defs.values()].map((d) => [d.name, new Set()]));
    for (let pass = 0; pass < 20; pass++) {
      let grew = false;
      for (const d of defs.values()) {
        const own = new Set(d.params.map((p) => p.name)), set = counting.get(d.name);
        const add = (n) => { if (own.has(n) && !set.has(n)) { set.add(n); grew = true; } };
        for (const st of d.body) {
          const f = FOR.exec(st.text);
          if (f) names(f[1]).forEach(add);
          const nw = NEW.exec(st.text), inner = nw && defs.get(nw[1]);
          if (inner && counting.get(inner.name).size) {
            const close = matchClose(st.text, st.text.indexOf("("));
            const args = bind(inner, st.text.slice(st.text.indexOf("(") + 1, close));
            for (const p of counting.get(inner.name)) names(args.get(p) ?? "").forEach(add);
          }
        }
      }
      if (!grew) break;
    }
    const todo = new Set([...counting].filter(([, s]) => s.size).map(([n]) => n));
    const inside = new Set();
    for (const n of todo) { const d = defs.get(n); for (let k = d.start; k <= d.end; k++) inside.add(k); }

    // Rewrite each `new` of such a component (outside their own definitions, which go at the end)
    // to a specialised copy, made once per set of values.
    const copies = new Map(); // specialised name -> { of, lines }
    let changed = false;
    const rewritten = out.map((st, k) => {
      const nw = !st.orphan && !inside.has(k) && NEW.exec(st.text);
      if (!nw || !todo.has(nw[1])) return st;
      changed = true;
      const def = defs.get(nw[1]);
      const open = st.text.indexOf("("), close = matchClose(st.text, open);
      const args = bind(def, st.text.slice(open + 1, close));
      const values = {};
      for (const p of [...counting.get(def.name)].sort()) {
        const param = def.params.find((q) => q.name === p);
        const v = constant(args.get(p) ?? "");
        if (param.abstract || v === null || /^\s*for\s/.test(st.text.slice(close + 1))) {
          errors.push({ line: st.line, message: `${def.name} uses '${p}' to count a for loop, so '${p}' has to be a number here (like ${def.name}(4)). A loop is written out when compiling, so a slider, a variable${param.abstract ? ", an abstract parameter" : ""} or a list instance can't set it` });
          return null; // one clear error; the line is left out
        }
        values[p] = v;
      }
      const key = `${def.name}|${Object.entries(values).map(([p, v]) => `${p}=${v}`).join(",")}`;
      if (!made.has(key)) {
        let spec = `${def.name}_${Object.values(values).join("_").replace(/-/g, "m").replace(/\./g, "p")}`;
        while (defs.has(spec) || [...made.values()].includes(spec)) spec += "x";
        made.set(key, spec);
        names_.set(spec, names_.get(def.name) ?? def.name);
        const header = out[def.start];
        copies.set(spec, { of: def.name, lines: [
          { ...header, text: header.text.replace(/^component\s+[A-Za-z][A-Za-z0-9_]*/, `component ${spec}`) },
          ...def.body.map((b) => b.orphan ? b : { ...b, text: paste(b.text, values) }),
          out[def.end],
        ] });
      }
      return { ...st, text: st.text.replace(NEW, `new ${made.get(key)}(`) };
    }).filter(Boolean);
    if (!changed) {
      // Nothing left uses the originals: they go (their loops can't be written out).
      const keep = [];
      out.forEach((st, k) => { if (!inside.has(k)) keep.push(st); });
      return { statements: keep, names: names_ };
    }
    // Copies go right after the definition they copy.
    const next = [];
    rewritten.forEach((st) => {
      next.push(st);
      const m = COMP.exec(st.text);
      if (m && todo.has(m[1]) && !st.orphan) {
        // the original header: its copies follow its closing }, found below
        st._copiesOf = m[1];
      }
    });
    const final = [];
    let pending = null, depth = 0;
    for (const st of next) {
      final.push(st);
      if (st._copiesOf) { pending = st._copiesOf; depth = 0; delete st._copiesOf; continue; }
      if (pending && !st.orphan) {
        if (st.text.startsWith("}") && depth === 0) {
          for (const c of copies.values()) if (c.of === pending) final.push(...c.lines);
          pending = null; continue;
        }
        if (st.text.startsWith("}")) depth--;
        if (st.text.endsWith("{")) depth++;
      }
    }
    out = final;
  }
  return { statements: out, names: names_ };
}
