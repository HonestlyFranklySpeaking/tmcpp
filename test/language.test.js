// M16: the language service behind hover, member completion, go to definition, rename and fmt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { hover, completeMembers, definition, rename, format } from "../src/language.js";
import { compile } from "../src/compile.js";

const SRC = `import "std/easing" as ez
color sea #2d70b3
class curve { #sea dashed width 3 }
mode = enum(idle, flying)
component Spring(A, B, coils = 8) {
  d = B - A . hidden
  (1 - t) * A + t * B + sin(2pi coils t) * d  .curve
}
new Spring((0, 0), (4, 1), coils = 12) as s1
k = 2 [0 : 5]
f(x) = k x^2
y = f(x) + s1.d.x + ez.lerp(0, 1, k) .curve
z = if mode = flying then 1 else 0`;
const lines = SRC.split("\n");
const at = (line, word, n = 0) => { let c = -1; for (let i = 0; i <= n; i++) c = lines[line].indexOf(word, c + 1); return { line, col: c + 1 }; };
const apply = (text, edits) => {
  const ls = text.split("\n");
  for (const e of [...edits].sort((a, b) => b.line - a.line || b.col - a.col)) ls[e.line] = ls[e.line].slice(0, e.col) + e.text + ls[e.line].slice(e.end);
  return ls.join("\n");
};

test("hover explains functions, members, instances, imports, classes, colours, style words and enums", () => {
  assert.match(hover(SRC, at(11, "f(")), /Function, line 11:[\s\S]*f\(x\) = k x\^2/);
  assert.match(hover(SRC, at(11, ".d")), /Variable of s1[\s\S]*d = B - A/);
  assert.match(hover(SRC, at(8, "s1")), /Instance of[\s\S]*Spring\(A, B, coils = 8\)[\s\S]*`s1.coils`/);
  assert.match(hover(SRC, at(11, "lerp")), /from "std\/easing"[\s\S]*lerp\(a, b, t\)/);
  assert.match(hover(SRC, at(11, "curve")), /class curve \{ #sea dashed width 3 \}/);
  assert.match(hover(SRC, at(2, "sea")), /color sea #2d70b3/);
  assert.match(hover(SRC, at(2, "dashed")), /Line style: dashed/);
  assert.match(hover(SRC, at(6, "coils")), /Parameter `coils` \(default `8`\)/);
  assert.match(hover(SRC, at(12, "flying")), /`flying` = 2, a member of enum `mode`/);
  assert.match(hover(SRC, at(9, "k")), /Slider/);
});

test("members after a dot: an instance's, a namespaced import's, a point's", () => {
  const withDot = SRC.replace("s1.d.x", "s1.");
  const l = withDot.split("\n")[11];
  assert.deepEqual(completeMembers(withDot, { line: 11, col: l.indexOf("s1.") + 3 }).options.map((o) => o.label), ["A", "B", "coils", "d"]);
  const ez = completeMembers(SRC, { line: 11, col: lines[11].indexOf("ez.") + 3 }).options.map((o) => o.label);
  assert.ok(ez.includes("lerp") && ez.includes("smoothstep"));
  assert.ok(!ez.some((n) => n.startsWith("_")));
  assert.deepEqual(completeMembers("P = (1, 2)\nq = P.", { line: 1, col: 6 }).options.map((o) => o.label), ["x", "y"]);
});

test("go to definition, in the file and into a library", () => {
  assert.deepEqual(definition(SRC, at(11, "f(")), { line: 10, col: 0, end: 1 });
  assert.deepEqual(definition(SRC, at(11, ".d")), { line: 5, col: 2, end: 3 });
  assert.deepEqual(definition(SRC, at(8, "coils")), { line: 4, col: 23, end: 28 });
  assert.equal(definition(SRC, at(11, "lerp")).lib, "std/easing");
  assert.deepEqual(definition(SRC, at(11, "curve")), { line: 2, col: 6, end: 11 });
});

test("rename changes every use and nothing else", () => {
  const cases = [[at(4, "coils"), "turns", 3], [at(5, "d"), "delta", 3], [at(2, "curve"), "wave", 3], [at(1, "sea"), "ocean", 2], [at(9, "k"), "gain", 3]];
  const items = (t) => compile(t, { watermark: false }).tmc.split("\n").length;
  for (const [pos, name, n] of cases) {
    const r = rename(SRC, pos, name);
    assert.equal(r.edits.length, n, name);
    const out = apply(SRC, r.edits);
    assert.deepEqual(compile(out, { watermark: false }).errors, [], name);
    assert.equal(items(out), items(SRC), name);
  }
  // A component's parameter is renamed in its body, in named arguments and in member paths.
  const withMember = SRC + "\nw = s1.coils";
  const r = rename(withMember, at(4, "coils"), "turns");
  assert.match(apply(withMember, r.edits), /component Spring\(A, B, turns = 8\)[\s\S]*2pi turns t[\s\S]*turns = 12\)[\s\S]*w = s1\.turns/);
  assert.match(rename(SRC, at(11, "lerp"), "x").error, /comes from a library/);
  assert.match(rename(SRC, at(9, "k"), "f").error, /already defined/);
  assert.match(rename(SRC, at(9, "k"), "2bad").error, /isn't a valid/);
});

test("fmt only changes indentation and blank lines, and every example compiles the same after it", () => {
  const messy = 'class glow {   \n#red\n      opacity 0\n}\nfolder "A" {\ny = x   \n     a = 1 [0 : 5]\n\n\n\n}\ncomponent Dot(P) {\nP . point 5\nif P.x > 0 {\ny = 1\n} else {\ny = 2\n}\n}\n"note line one\n   keep this indent"\nL = [1,\n2, 3]\n';
  assert.equal(format(messy), 'class glow {\n  #red\n  opacity 0\n}\nfolder "A" {\n  y = x\n  a = 1 [0 : 5]\n}\ncomponent Dot(P) {\n  P . point 5\n  if P.x > 0 {\n    y = 1\n  } else {\n    y = 2\n  }\n}\n"note line one\n   keep this indent"\nL = [1,\n  2, 3]\n');
  const libs = Object.fromEntries(readdirSync("examples/lib").map((f) => [`examples/lib/${f}`, readFileSync(`examples/lib/${f}`, "utf8")]));
  const files = [...readdirSync("examples").filter((f) => f.endsWith(".tmcpp")).map((f) => "examples/" + f), ...readdirSync("library/std").map((f) => "library/std/" + f)];
  const strip = (t) => t.split("\n").filter((l) => !l.startsWith("settings")).join("\n");
  for (const f of files) {
    const src = readFileSync(f, "utf8"), out = format(src);
    assert.equal(format(out), out, `${f}: fmt is stable`);
    assert.equal(strip(compile(out, { libraries: libs, from: f, watermark: false }).tmc), strip(compile(src, { libraries: libs, from: f, watermark: false }).tmc), `${f}: same TMC`);
  }
});
