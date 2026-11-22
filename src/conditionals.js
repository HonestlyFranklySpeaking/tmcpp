// Lower TMC++ conditionals while expressions still use their source-level names.
import { rewriteRestrictions, rewriteSegments } from "./rewrite.js";

const blockHead = /^if\s+(.+?)\s*\{$/;
const elseIfHead = /^(?:}\s*)?else\s+if\s+(.+?)\s*\{$/;
const elseHead = /^(?:}\s*)?else\s*\{$/;
export const isConditionalHeader = text => /^(?:(?:}\s*)?else\s+)?if\b.*\{$|^(?:}\s*)?else\s*\{$/.test(text);

// Math stays opaque. Only delimiters, quoted strings and the conditional keywords
// matter here. An unparenthesized branch ends at the enclosing argument/list boundary.
function inline(text) {
  if (!/\bif\b/.test(text)) return text;
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[.#]?[A-Za-z_][\w]*|\.\.\.|\s+|./gs) ?? [];
  if (!tokens.includes("if")) return text;
  let pos = 0;
  const stops = new Set(["then", "else", ",", ":", "for", "with", "...", ")", "]", "}"]);
  const closes = new Map([["(", ")"], ["[", "]"], ["{", "}"]]);

  function sequence(branch, close) {
    let out = "";
    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token === close || (branch && stops.has(token))) break;
      pos++;
      if (token === "if") {
        out += "{" + conditional() + "}";
        if (tokens[pos] === "for" || tokens[pos] === "with") out += " ";
      } else if (token === "then" || token === "else") {
        throw Error("Unexpected '" + token + "' in inline if");
      } else if (closes.has(token)) {
        const end = closes.get(token);
        out += token + sequence(false, end);
        if (tokens[pos] === end) out += tokens[pos++];
      } else {
        out += token;
      }
    }
    return out;
  }

  function required(part) {
    const value = sequence(true).trim();
    if (!value) throw Error("Missing " + part + " in inline if");
    return value;
  }
  function keyword(word) {
    if (tokens[pos] !== word) throw Error("Expected '" + word + "' in inline if");
    pos++;
  }
  function conditional() {
    const condition = required("condition");
    keyword("then");
    const yes = required("then expression");
    keyword("else");
    if (/^\s+$/.test(tokens[pos])) pos++;
    // Flatten a chain of alternatives, but keep a conditional inside a then arm nested.
    let no;
    if (tokens[pos] === "if") { pos++; no = conditional(); }
    else no = required("else expression");
    for (const arm of [yes, no]) if (/^"(?:\\.|[^"\\])*"$/.test(arm))
      throw Error("An if can't give text: Desmos piecewise values must be numbers, points or lists");
    return condition + ": " + yes + ", " + no;
  }
  return sequence(false);
}

export function lowerConditionals(statements, errors, warnings, findTailStart) {
  const result = [], stack = [];
  const current = () => stack.length ? stack.at(-1).branch : result;

  function parts(st) {
    const at = findTailStart(st.text);
    const math = at < 0 ? st.text : st.text.slice(0, at).trimEnd();
    const tail = at < 0 ? "" : st.text.slice(at);
    const assignment = math.match(/^([A-Za-z][\w]*(?:_\{\w+\})?(?:\(\s*[\w]+(?:\s*,\s*[\w]+)*\s*\))?)\s*=\s*(.+)$/);
    return { st, math, tail, lhs: assignment?.[1], value: assignment?.[2] };
  }

  function merge(frame) {
    const yes = frame.yes.map(parts), no = frame.no.map(parts);
    const used = new Set();
    const condition = frame.condition;
    const inverse = "{" + condition + ": 0, 1} = 1";
    function emit(row, guard, other) {
      let math;
      for (const r of [row, other]) if (r?.lhs && /\[[^\[\]]*:[^\[\]]*\]\s*$/.test(r.value))
        errors.push({ line: r.st.line, message: "A slider can't be defined inside an if block; define '" + r.lhs + "' outside it" });
      if (row.lhs) {
        const first = rewriteRestrictions(row.value).math;
        const fallback = other ? ", " + rewriteRestrictions(other.value).math : "";
        math = row.lhs + " = {" + guard + ": " + first + fallback + "}";
      } else {
        const segments = rewriteSegments(row.math);
        if (segments.error) errors.push({ line: row.st.line, message: segments.error });
        math = (segments.math ?? row.math) + " {" + guard + "}";
      }
      if (other && row.tail !== other.tail) warnings.push({
        line: other.st.line, message: "Branches of '" + row.lhs + "' have different styles; using the first branch's style",
      });
      current().push({ ...row.st, text: math + (row.tail ? " " + row.tail : "") });
    }
    for (const row of yes) {
      const other = row.lhs && no.find(r => !used.has(r) && r.lhs?.replace(/\s/g, "") === row.lhs.replace(/\s/g, ""));
      if (other) used.add(other);
      emit(row, condition, other);
    }
    for (const row of no) if (!used.has(row)) emit(row, inverse);
  }

  let skip = 0; // body of a rejected block inside an if, so its `}` doesn't close the if
  for (let i = 0; i < statements.length; i++) {
    const st = statements[i], frame = stack.at(-1);
    if (skip) {
      if (/\{$/.test(st.text)) skip++;
      else if (st.text === "}") skip--;
      continue;
    }
    try {
      if (isConditionalHeader(st.text) && /^if\b/.test(st.text)) {
        const header = st.text.match(blockHead);
        if (!header || !header[1].trim()) throw Error("Missing if block condition");
        const yes = [];
        stack.push({ condition: inline(header[1].trim()), line: st.line, yes, no: [], branch: yes });
      } else if (elseIfHead.test(st.text)) {
        // `} else if c {` is an else block holding one nested if; both close at the final `}`.
        if (!frame || frame.branch === frame.no || !st.text.startsWith("}")) throw Error("Unexpected else");
        frame.branch = frame.no;
        const yes = [];
        stack.push({ condition: inline(st.text.match(elseIfHead)[1].trim()), line: st.line, yes, no: [], branch: yes, chained: true });
      } else if (elseHead.test(st.text)) {
        if (!frame || frame.branch === frame.no || !st.text.startsWith("}")) throw Error("Unexpected else");
        frame.branch = frame.no;
      } else if (frame && st.text === "}") {
        const next = statements[i + 1]?.text ?? "";
        if (frame.branch === frame.yes && elseIfHead.test(next) && !next.startsWith("}")) {
          i++;
          frame.branch = frame.no;
          const yes = [];
          stack.push({ condition: inline(next.match(elseIfHead)[1].trim()), line: statements[i].line, yes, no: [], branch: yes, chained: true });
        } else if (/^else\s*\{$/.test(next) && frame.branch === frame.yes) {
          i++;
          frame.branch = frame.no;
        } else {
          // One `}` closes an else-if chain and every block it hangs from.
          let closing;
          do { closing = stack.pop(); merge(closing); } while (closing.chained && stack.length);
        }
      } else {
        if (frame && /^(?:folder|component|new|class|color|table|ticker|settings|image)\b|^"/.test(st.text)) {
          if (/\{$/.test(st.text)) skip = 1;
          throw Error("An if block accepts math statements and nested if blocks");
        }
        if (/^(?:}\s*)?else\b/.test(st.text)) throw Error("Unexpected else; expected an else block");
        if (!/\bif\b/.test(st.text) || st.orphan) { current().push(st); continue; }
        const at = findTailStart(st.text);
        const text = at < 0 ? inline(st.text) : inline(st.text.slice(0, at)).trimEnd() + " " + inline(st.text.slice(at));
        current().push({ ...st, text });
      }
    } catch (error) {
      errors.push({ line: st.line, message: error.message });
    }
  }
  for (const frame of stack) errors.push({ line: frame.line, message: "If block is never closed" });
  return result;
}
