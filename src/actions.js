// Action shortcuts. Desmos writes every update as `n -> n + 1`; TMC++ also takes
//
//   n++   n--   n += e   n -= e   n *= e   n /= e   n ^= e     mode++ % 3   (wraps round)
//   toggle(on)                      on -> 1 - on
//   L[i] = v   L[i] += v   L[i]++   change one element of a list
//   L.push(x)   L.pop()             add to the end, drop the last
//   reset(score, lives)   reset()   back to the values they're defined with
//
// wherever an action goes: click(...), the ticker, a named action (step = (n++, m += 2)), a line
// that is only an action, and the branches of an inline if. Updates in one Desmos action all
// happen at once, so updating the same variable twice in one action gets a warning.
import { splitArgs, matchClose, identifiers, assigned } from "./components.js";

const NAME = "[A-Za-z][A-Za-z0-9_]*";
const OP = /^([+\-*/^])=(?!=)/;
// Something in a piece of math that only an action can mean.
const ACTION_HINT = new RegExp(`->|${NAME}(?:\\[[^\\]]*\\])?\\s*(?:\\+\\+|--(?![\\d.]))|[+\\-*/^]=(?!=)|\\b(?:toggle|reset)\\s*\\(|\\.(?:push|pop)\\s*\\(`);
const outsideStrings = (text) => text.replace(/"(?:[^"\\]|\\.)*"/g, '""');

/** An expression wrapped in brackets unless it is one atom. */
const atom = (e) => (/^(?:[A-Za-z0-9_.]+|\((?:[^()]|\([^()]*\))*\))$/.test(e.trim()) ? e.trim() : `(${e.trim()})`);

/** `L[i]` at the start of an action: { list, index, rest } */
function indexed(text) {
  const m = text.match(new RegExp(`^(${NAME})\\s*\\[`));
  if (!m) return null;
  const open = m[0].length - 1, close = matchClose(text, open);
  if (close < 0) return null;
  return { list: m[1], index: text.slice(open + 1, close).trim(), rest: text.slice(close + 1).trim() };
}

export function lowerActions(statements, errors, warnings, findTailStart) {
  const all = statements.map((st) => st.text).join("\n");
  let k = "k_upd";
  for (let n = 2; new RegExp(`\\b${k}\\b`).test(all); n++) k = `k_upd${n}`;

  // reset(): the plain values each name is defined with, per component body and for the file.
  const fileValues = new Map(), bodyValues = new Map(); // body: header index -> Map
  let body = null, depth = 0;
  statements.forEach((st, i) => {
    if (st.orphan) return;
    if (st.text.startsWith("}")) depth--;
    if (!body && /^component\s/.test(st.text) && st.text.endsWith("{")) { body = { at: i, depth, values: new Map() }; bodyValues.set(i, body.values); }
    else if (body && depth === body.depth && st.text === "}") body = null;
    else {
      const a = assigned(st.text);
      if (a && !a.args.length) {
        const at = findTailStart(st.text);
        const rhs = (at < 0 ? st.text : st.text.slice(0, at)).replace(/^[^=]*=/, "").replace(/\s*\[[^\[\]]*:[^\[\]]*\]\s*$/, "").trim();
        if (rhs && !identifiers(rhs).filter((id) => id !== "e").length && !/->/.test(rhs)) (body ? body.values : fileValues).set(a.name, rhs);
      }
    }
    st.scope = body?.values ?? null;
    if (st.text.endsWith("{")) depth++;
  });

  function rewriteStatement(st) {
    const report = (message, kind = errors) => kind.push({ line: st.line, message });
    const values = st.scope ? new Map([...fileValues, ...st.scope]) : fileValues;

    /** One action, returned as plain Desmos updates. */
    function action(raw) {
      const a = raw.trim();
      if (!a) return a;
      if (a.startsWith("{") && matchClose(a, 0) === a.length - 1) {
        return "{" + splitArgs(a.slice(1, -1)).map((arm) => {
          const parts = splitArgs(arm, ":");
          // A branch with several updates (else reset()) needs its own brackets.
          const branch = (x) => { const out = action(x); return splitArgs(out).length > 1 ? `(${out})` : out; };
          return parts.length > 1 ? `${parts[0]}: ${branch(parts.slice(1).join(":"))}` : branch(arm);
        }).join(", ") + "}";
      }
      if (a.startsWith("(") && matchClose(a, 0) === a.length - 1) return "(" + list(a.slice(1, -1)) + ")";
      let m;
      if ((m = a.match(/^toggle\s*\(([\s\S]*)\)$/))) {
        const target = m[1].trim(), el = indexed(target);
        return el && !el.rest ? element(el.list, el.index, `1 - ${el.list}[${k}]`) : `${target} -> 1 - ${target}`;
      }
      if ((m = a.match(/^reset\s*\(([\s\S]*)\)$/))) {
        const names = m[1].trim() ? splitArgs(m[1]) : [...values.keys()];
        if (!names.length) { report("reset() has nothing to reset: no name here is defined as a plain value (score = 0)"); return a; }
        return names.map((n) => {
          if (!values.has(n)) { report(`reset: '${n}' isn't defined as a plain value here (write ${n} = 0 somewhere)`); return `${n} -> ${n}`; }
          return `${n} -> ${values.get(n)}`;
        }).join(", ");
      }
      if ((m = a.match(new RegExp(`^(${NAME})\\.push\\s*\\(([\\s\\S]*)\\)$`)))) return `${m[1]} -> join(${m[1]}, ${m[2].trim()})`;
      if ((m = a.match(new RegExp(`^(${NAME})\\.pop\\s*\\(\\s*\\)$`)))) return `${m[1]} -> ${m[1]}[1...length(${m[1]}) - 1]`;
      const el = indexed(a);
      if (el) {
        const { list: L, index, rest } = el;
        if ((m = rest.match(/^(\+\+|--)$/))) return element(L, index, `${L}[${k}] ${m[1][0]} 1`);
        if ((m = rest.match(OP))) return element(L, index, `${L}[${k}] ${m[1]} ${atom(rest.slice(2))}`);
        if ((m = rest.match(/^=(?!=)([\s\S]+)$/))) return element(L, index, m[1].trim());
        return a;
      }
      if ((m = a.match(new RegExp(`^(${NAME})\\s*(\\+\\+|--)\\s*(?:%\\s*([\\s\\S]+))?$`)))) {
        const step = `${m[1]} ${m[2][0]} 1`;
        return m[3] ? `${m[1]} -> mod(${step}, ${m[3].trim()})` : `${m[1]} -> ${step}`;
      }
      if ((m = a.match(new RegExp(`^(${NAME})\\s*([+\\-*/^])=(?!=)\\s*([\\s\\S]+)$`)))) return `${m[1]} -> ${m[1]} ${m[2]} ${atom(m[3])}`;
      // on = 1 inside an action sets it (comparisons only happen in an if's condition)
      if ((m = a.match(new RegExp(`^(${NAME})\\s*=(?!=)\\s*([\\s\\S]+)$`)))) return `${m[1]} -> ${m[2].trim()}`;
      return a;
    }
    /** The new value of an element change (L[i]++, L[i] op= v, L[i] = v), or null. */
    function elementValue({ list: L, rest }) {
      let m;
      if ((m = rest.match(/^(\+\+|--)$/))) return `${L}[${k}] ${m[1][0]} 1`;
      if ((m = rest.match(OP))) return `${L}[${k}] ${m[1]} ${atom(rest.slice(2))}`;
      if ((m = rest.match(/^=(?!=)([\s\S]+)$/))) return m[1].trim();
      return null;
    }
    /** Change element `index` of list L to `value` (which may use L[k]). */
    const element = (L, index, value) => `${L} -> [{${k} = ${index}: ${value}, ${L}[${k}]} for ${k} = [1...length(${L})]]`;

    /** A comma list of actions; warns when two of them update the same variable. */
    function list(text) {
      // Several element changes to one list (L[1] = 0, L[3] += 2) become a single update of L.
      const merged = new Map(), keep = [];
      for (const item of splitArgs(text)) {
        const el = indexed(item.trim());
        const arm = el && elementValue(el);
        if (!arm) { keep.push(item); continue; }
        if (!merged.has(el.list)) { merged.set(el.list, []); keep.push({ list: el.list }); }
        merged.get(el.list).push(`${k} = ${el.index}: ${arm}`);
      }
      const items = keep.map((item) => typeof item === "string" ? action(item)
        : `${item.list} -> [{${merged.get(item.list).join(", ")}, ${item.list}[${k}]} for ${k} = [1...length(${item.list})]]`);
      const seen = new Map();
      for (const item of items) {
        const targets = new Set([...outsideStrings(item).matchAll(new RegExp(`(${NAME})\\s*->`, "g"))].map((x) => x[1]));
        for (const t of targets) {
          if (seen.has(t)) report(`'${t}' is updated twice in one action; Desmos does every update at once, so only one of them counts`, warnings);
          seen.set(t, true);
        }
      }
      return items.join(", ");
    }

    /** A list of actions, bracketed when it holds more than one update. */
    const group = (text) => { const out = list(text); return splitArgs(out).length > 1 ? `(${out})` : out; };

    let text = st.text;
    // Everything inside click(...) is an action, so `on = 1` there sets even with no ++ or += around.
    if (!ACTION_HINT.test(outsideStrings(text)) && !/\bclick\(/.test(outsideStrings(text))) return st;
    // click(...) anywhere on the line
    for (let i = text.search(/\bclick\(/); i >= 0; i = text.indexOf("click(", i + 6)) {
      const open = i + 5, close = matchClose(text, open);
      if (close < 0) break;
      const inner = list(text.slice(open + 1, close));
      text = text.slice(0, open + 1) + inner + text.slice(close);
    }
    const at = findTailStart(text);
    let math = at < 0 ? text : text.slice(0, at).trimEnd();
    const tail = at < 0 ? "" : text.slice(at);
    const hint = (s) => ACTION_HINT.test(outsideStrings(s));
    let m;
    if ((m = math.match(/^ticker\s+([\s\S]+)$/)) && hint(m[1])) math = `ticker ${list(m[1])}`;
    else if ((m = math.match(new RegExp(`^(${NAME})\\s*=(?!=)\\s*([\\s\\S]+)$`))) && hint(m[2])) {
      // A named action: step = (n++, m += 2)
      const rhs = m[2].trim();
      math = `${m[1]} = ${group(rhs.startsWith("(") && matchClose(rhs, 0) === rhs.length - 1 ? rhs.slice(1, -1) : rhs)}`;
    } else if (!/^(?:folder|table|class|color|settings|component|new|import|if|else|ticker|\})\b/.test(math) && hint(math)) {
      // A line that is only an action: score += 10, toggle(on), L[2] = 5
      math = group(math);
    }
    const out = tail ? `${math} ${tail}` : math;
    return out === st.text ? st : { ...st, text: out };
  }

  return statements.map((st) => (st.orphan ? st : rewriteStatement(st)));
}
