import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";
import { normalizeId, ghUrl, findImports, resolveImports, parseImport } from "../src/imports.js";

const SPRINGS = `color steel #6b7b8c
class spring { #steel width 2 }
lerp(a, b, t) = a + (b - a) * t
unused(q) = q^2
half = lerp(0, 1, 0.5)
component Spring(A, B, coils = 8) {
  d = B - A
  w = (-d.y, d.x) / distance(A, B) * 0.3
  lerp(A, B, t) + sin(2 * pi * coils * t) * w  .spring
  A  . point 6
  B  . point 6
}`;

function build(source, libraries = { springs: SPRINGS }) {
  const result = compile(source, { watermark: false, defaultSettings: {}, libraries });
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), result.tmc);
  assert.deepEqual(diagnostics.filter((d) => d.severity === "error"), []);
  return { ...result, graph: state.expressions.list };
}
const clean = (r) => { assert.deepEqual(r.errors, []); return r; };
const errorsOf = (source, libraries) => compile(source, { watermark: false, defaultSettings: {}, libraries }).errors.map((e) => e.message);

test("acceptance: a component moved into a library compiles to the same graph", () => {
  const single = clean(build(`${SPRINGS}\nnew Spring((0, 0), (4, 1)) as s1\nnew Spring((0, 2), (3, 3), coils = 12) as s2`));
  const imported = clean(build(`import "springs"\nnew Spring((0, 0), (4, 1)) as s1\nnew Spring((0, 2), (3, 3), coils = 12) as s2`));
  // Unstyled lines take Desmos's rotating default colours, which shift with the line count,
  // so compare the math plus the colours the source set.
  const math = (g) => g.filter((e) => e.type === "expression").map((e) => [e.latex, e.color === "#6b7b8c" ? e.color : "", e.lineWidth]);
  // The library's lerp moves into its own folder; half and unused are left out because nothing uses them.
  const lerp = (g) => g.filter((e) => (e.latex ?? "").startsWith("l_{erp}\\left(a,b,t\\right)="));
  assert.equal(lerp(imported.graph).length, 1);
  assert.deepEqual(math(imported.graph), math(single.graph).filter((m) => !/^(u_{nused}|h_{alf})/.test(m[0])));
  const folder = imported.graph.find((e) => e.type === "folder" && e.title === "springs");
  assert.equal(folder.collapsed, true);
  assert.equal(folder.hidden, true); // a helper of x mustn't draw
});

test("namespaced import: members, classes and colours behind the name, clashes renamed", () => {
  const { tmc } = clean(build(`import "springs" as sp
lerp = 3
new sp.Spring((0, 0), (4, 1)) as s1
z = sp.lerp(1, 2, 0.5)
P = (1, 1) .sp-spring
Q = (2, 2) #sp-steel`));
  assert.match(tmc, /^l_erp = 3;$/m);              // the file keeps its own lerp
  assert.match(tmc, /l_erp2\(a, b, t\) = /);       // the library's moves aside
  assert.match(tmc, /z = l_erp2\(1, 2, 0\.5\)/);
  assert.match(tmc, /P = \(1, 1\) @\{ color: "#6b7b8c", lines: @\{ width: 2 \} \}/);
  assert.match(tmc, /Q = \(2, 2\) @\{ color: "#6b7b8c" \}/);
  assert.doesNotMatch(tmc, /h_alf|u_nused/);
});

test("selective import brings only the listed names, and dependencies still resolve", () => {
  const { tmc } = clean(build(`import { Spring, .spring } from "springs"\nnew Spring((0, 0), (1, 1)) as s\nR = (0, 1) .spring`));
  assert.match(tmc, /l_erp\(a, b, t\)/);            // Spring needs lerp, so it's emitted
  assert.match(tmc, /R = \(0, 1\) @\{ color: "#6b7b8c"/);
  assert.match(errorsOf(`import { Spring } from "springs"\nz = lerp(1, 2, 3)`, { springs: SPRINGS }).join(), /^$/);
  assert.deepEqual(errorsOf(`import { Foo } from "springs"`, { springs: SPRINGS }), ["'springs' has no 'Foo'"]);
  assert.deepEqual(errorsOf(`import { steal } from "springs"`, { springs: SPRINGS }), ["'springs' has no 'steal' (did you mean 'steel'?)"]);
  assert.deepEqual(errorsOf(`import { .steel } from "springs"`, { springs: SPRINGS }), ["'springs' has no '.steel' (did you mean 'steel'?)"]);
  // A bare name brings a class or colour too: no need to write .spring or #steel.
  const bare = clean(build(`import { spring, steel } from "springs"\nP = (1, 1) .spring\nQ = (2, 2) #steel`));
  assert.match(bare.tmc, /P = \(1, 1\) @\{ color: "#6b7b8c", lines: @\{ width: 2 \} \}/);
  assert.match(bare.tmc, /Q = \(2, 2\) @\{ color: "#6b7b8c" \}/);
});

test("unused classes, colours and components stay out, so the metadata only lists what's used", () => {
  const lib = { s: "color ink #111111\ncolor sea #2266aa\nclass a { #ink }\nclass b { #sea width 2 }\nclass c { .a dashed }\ncomponent Dot(P) {\n  P .b\n}\ncomponent Spare(P) {\n  P\n}" };
  const r = clean(build('import "s"\ny = x .c', lib));
  assert.deepEqual([...r.classes.keys()].sort(), ["a", "c"]);
  assert.deepEqual([...r.colors.keys()], ["ink"]);
  const withDot = clean(build('import "s"\nnew Dot((1, 1))', lib));
  assert.deepEqual([...withDot.classes.keys()], ["b"]);
  assert.deepEqual([...withDot.colors.keys()], ["sea"]);
});

test("parameters, arguments and comprehension variables shadow library names", () => {
  const lib = { l: "a = 5\nf(t) = t + a" };
  const { tmc } = clean(build(`import "l" as l\nimport { a } from "l"\ng(a) = a + 1\nL = [a for a = [1...3]]\nm = a + l.f(1)`, lib));
  assert.match(tmc, /g\(a\) = a \+ 1/);
  assert.match(tmc, /L = \[a for a = \[1\.\.\.3\]\]/);
  assert.match(tmc, /m = a \+ f\(1\)/);
});

test("libraries can import libraries; the same library is emitted once", () => {
  const libs = { "lib/b.tmcpp": "import \"./c.tmcpp\" as c\nk = c.base * 2", "lib/c.tmcpp": "base = 3" };
  const { tmc } = clean(build(`import "./lib/b.tmcpp"\nimport "./lib/c.tmcpp" as c\nm = k + c.base`, libs));
  assert.equal(tmc.match(/b_ase = 3/g).length, 1);
  assert.match(tmc, /k = b_ase \* 2/);
});

test("library errors point at the import line and name the library line", () => {
  const bad = { bad: 'y = x^2\nk = 1 [0 : 5]\nfolder "f" {\n  a = 1\n}\ng = 9.8\ng = 1' };
  const errors = compile('// first\nimport "bad"', { libraries: bad }).errors;
  assert.ok(errors.every((e) => e.line === 2));
  const messages = errors.map((e) => e.message);
  assert.match(messages[0], /In 'bad' line 1: .*would draw/);
  assert.match(messages[1], /In 'bad' line 2: 'k' is a slider/);
  assert.match(messages[2], /In 'bad' line 3: .*would draw/);
  assert.match(messages[3], /In 'bad' line 7: 'g' is defined twice/);
  assert.equal(messages.length, 4);
});

test("missing libraries, cycles, clashes and ambiguity", () => {
  assert.deepEqual(errorsOf('import "nope"'), ["Can't find library 'nope'"]);
  assert.match(errorsOf('import "gh:u/r/x.tmcpp"')[0], /hasn't been fetched yet/);
  assert.match(errorsOf('import "a"', { a: 'import "b"', b: 'import "a"' })[0], /Import cycle: a imports b imports a/);
  assert.match(errorsOf('import "springs"\nlerp = 2', { springs: SPRINGS })[0], /'lerp' is defined in this file and also imported/);
  const two = { p: "v = 1", q: "v = 2" };
  assert.deepEqual(errorsOf('import "p"\nimport "q"', two), []); // unused, so no complaint
  assert.match(errorsOf('import "p"\nimport "q"\nm = v', two)[0], /'v' is imported from both 'p' and 'q'/);
  assert.match(errorsOf('import "p" as p\nm = p.w', two)[0], /'p' has no 'w'/);
  assert.match(errorsOf('folder "f" {\n  import "p"\n}', two)[0], /top level/);
  assert.match(errorsOf('import p', two)[0], /Malformed import/);
});

test("ids, GitHub shorthand and async resolution", async () => {
  assert.equal(normalizeId("./c.tmcpp", "lib/b.tmcpp"), "lib/c.tmcpp");
  assert.equal(normalizeId("../x.tmcpp", "lib/b.tmcpp"), "x.tmcpp");
  assert.equal(normalizeId("./c.tmcpp", "gh:u/r/lib/b.tmcpp@abc123"), "gh:u/r/lib/c.tmcpp@abc123");
  assert.equal(normalizeId("./c.tmcpp", "https://example.com/l/b.tmcpp"), "https://example.com/l/c.tmcpp");
  assert.equal(normalizeId("std/ui", "lib/b.tmcpp"), "std/ui");
  // A github.com page link, as copied from the browser, imports the raw file it shows.
  assert.equal(normalizeId("https://github.com/u/r/blob/main/lib/b.tmcpp"), "https://raw.githubusercontent.com/u/r/main/lib/b.tmcpp");
  assert.equal(normalizeId("github.com/u/r/raw/abc123/b.tmcpp?plain=1"), "https://raw.githubusercontent.com/u/r/abc123/b.tmcpp");
  assert.equal(normalizeId("https://github.com/u/r"), "https://github.com/u/r"); // not a file: left alone
  assert.equal(normalizeId("./c.tmcpp", normalizeId("https://github.com/u/r/blob/main/lib/b.tmcpp")), "https://raw.githubusercontent.com/u/r/main/lib/c.tmcpp");
  assert.equal(ghUrl("gh:u/r/lib/b.tmcpp@abc123"), "https://raw.githubusercontent.com/u/r/abc123/lib/b.tmcpp");
  assert.equal(ghUrl("gh:u/r/b.tmcpp"), "https://raw.githubusercontent.com/u/r/HEAD/b.tmcpp");
  assert.deepEqual(parseImport('import { A, .b, #c } from "x"'), { spec: "x", names: ["A", ".b", "#c"] });
  assert.deepEqual(findImports('import "a" // note\nx = 1\nimport "./b" as b', "dir/main.tmcpp"), ["a", "dir/b"]);
  assert.deepEqual(findImports('import "https://github.com/u/r/blob/main/x.tmcpp" as x // a comment'), ["https://raw.githubusercontent.com/u/r/main/x.tmcpp"]);
  const store = { a: 'import "b"\nv = 1', b: "w = 2" };
  const got = await resolveImports('import "a"\nimport "missing"', async (id) => store[id]);
  assert.deepEqual([...got.keys()], ["a", "b"]);
});

test("a file without imports compiles exactly as before", () => {
  const source = "a = 1\ny = a x";
  assert.equal(compile(source, { libraries: { springs: SPRINGS } }).tmc, compile(source).tmc);
});
