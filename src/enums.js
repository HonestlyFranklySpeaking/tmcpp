// Enums: `mode = enum(idle, flying, landed)` names the states of a variable.
//
//   mode = enum(idle, flying, landed)   ->  mode = 1          (it starts at the first member)
//   if mode = flying then ...           ->  if mode = 2 then ...
//   click(mode = landed)                ->  click(mode -> 3)  (the actions pass does the rest)
//   click(mode++)                       ->  mode -> mod(mode, 3) + 1: idle, flying, landed, idle...
//   labels[mode]                        ->  works as is: members count from 1, like Desmos lists
//
// Members are numbers pasted in at compile time, so they cost no Desmos variables. A line you
// haven't edited in Desmos comes back from From graph exactly as written.
import { substitute, assigned } from "./components.js";

const ENUM = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*enum\s*\(([^()]*)\)\s*(.*)$/;
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

export function lowerEnums(statements, errors) {
  const enums = new Map();   // variable -> members
  const members = new Map(); // member -> { value, of, line }
  for (const st of statements) {
    if (st.orphan) continue;
    const m = ENUM.exec(st.text);
    if (!m) continue;
    const list = m[2].split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length < 2) { errors.push({ line: st.line, message: `enum needs at least two members, like ${m[1]} = enum(off, on)` }); continue; }
    list.forEach((name, i) => {
      if (!NAME.test(name)) errors.push({ line: st.line, message: `'${name}' isn't a name; enum members are plain names like idle or flying` });
      else if (members.has(name)) errors.push({ line: st.line, message: `'${name}' is already a member of ${members.get(name).of} (line ${members.get(name).line})` });
      else members.set(name, { value: String(i + 1), of: m[1], line: st.line });
    });
    enums.set(m[1], list);
  }
  if (!enums.size) return { statements, enums };

  // A member can't also be a variable or function of its own.
  for (const st of statements) {
    if (st.orphan) continue;
    const a = assigned(st.text);
    if (a && members.has(a.name) && !ENUM.test(st.text)) {
      errors.push({ line: st.line, message: `'${a.name}' is an enum member of ${members.get(a.name).of}, so it can't also be defined here` });
    }
  }

  const out = statements.map((st) => {
    if (st.orphan) return st;
    let text = st.text;
    const m = ENUM.exec(text);
    if (m) text = `${m[1]} = 1${m[3] ? " " + m[3] : ""}`;
    // mode++ / mode-- on an enum cycle through its members (and mode++ % k means the same).
    for (const [name, list] of enums) {
      const n = list.length;
      text = text.replace(new RegExp(`(?<![A-Za-z0-9_.])${name}\\s*\\+\\+(?:\\s*%\\s*[A-Za-z0-9_]+)?`, "g"), `${name} -> mod(${name}, ${n}) + 1`)
        .replace(new RegExp(`(?<![A-Za-z0-9_.])${name}\\s*--`, "g"), `${name} -> mod(${name} - 2, ${n}) + 1`);
    }
    text = substitute(text, (name) => members.get(name)?.value);
    return text === st.text ? st : { ...st, text };
  });
  return { statements: out, enums };
}
