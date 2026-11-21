import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";

const opts = { defaultSettings: {}, watermark: false };
const run = (src) => compile(src, opts);
const ok = (src) => {
  const r = run(src);
  assert.deepEqual(r.errors, [], JSON.stringify(r.errors));
  const [{ diagnostics }] = textToRaw(buildConfig({}), r.tmc);
  assert.deepEqual(diagnostics.filter((d) => d.severity === "error").map((d) => d.message), [], r.tmc);
  return r.tmc;
};
const errs = (src) => run(src).errors.map((e) => e.message).join(" | ");
const warns = (src) => run(src).warnings.map((e) => e.message).join(" | ");

const SPRING = `component Spring(A, B, coils = 8) {
  d = B - A
  (1 - t) * A + t * B + sin(2 * pi * coils * t) * (-d.y, d.x) * 0.1
}`;

test("an instance becomes a folder; parameters are substituted, locals renamed", () => {
  assert.equal(ok(`${SPRING}\nnew Spring((0, 0), (4, 1)) as s1`), [
    'folder "s1" {',
    "d_s1 = (4, 1) - (0, 0);",
    "(1 - t) * (0, 0) + t * (4, 1) + sin(2 * pi * 8 * t) * (-d_s1.y, d_s1.x) * 0.1;",
    "};",
  ].join("\n"));
});

test("a definition alone draws nothing", () => {
  assert.equal(ok(SPRING), "");
});

test("definitions are hoisted: use above the definition", () => {
  assert.match(ok(`new Spring((0, 0), (1, 1)) as s1\n${SPRING}`), /^folder "s1" \{/);
});

test("named arguments and defaults", () => {
  const tmc = ok(`${SPRING}\nnew Spring((0, 0), B = (2, 2), coils = 3) as s1`);
  assert.match(tmc, /d_s1 = \(2, 2\) - \(0, 0\)/);
  assert.match(tmc, /sin\(2 \* pi \* 3 \* t\)/);
});

test("non-atomic arguments are bracketed", () => {
  assert.match(ok(`${SPRING}\nnew Spring((0, 0), (1, 1), coils = a + 1) as s1\na = 2`), /2 \* pi \* \(a \+ 1\) \* t/);
});

test("each instance gets its own names; members resolve from anywhere", () => {
  const tmc = ok(`${SPRING}\nnew Spring((0, 0), (1, 1)) as s1\nnew Spring((0, 1), (1, 2)) as s2\nL = s1.d + s2.d + s1.B`);
  assert.match(tmc, /d_s1 = /);
  assert.match(tmc, /d_s2 = /);
  assert.match(tmc, /L = d_s1 \+ d_s2 \+ \(1, 1\);/);
});

test("allocated names never collide with names in the file", () => {
  const tmc = ok(`${SPRING}\nd_s1 = 5\nnew Spring((0, 0), (1, 1)) as s1\nk = s1.d`);
  assert.match(tmc, /^d_s1 = 5;/m);
  assert.match(tmc, /^d_s1x = \(1, 1\) - \(0, 0\);/m);
  assert.match(tmc, /^k = d_s1x;/m);
});

test("allocated names avoid names v1 renaming produces (ds1 -> d_s1)", () => {
  const tmc = ok(`${SPRING}\nds1 = 5\nnew Spring((0, 0), (1, 1)) as s1`);
  assert.match(tmc, /^d_s1 = 5;/m);
  assert.match(tmc, /^d_s1x = /m);
});

test("multi-letter locals get a Desmos-legal name", () => {
  const tmc = ok(`component Ring(c) {\n  coil = c * 2\n  y = coil\n}\nnew Ring(3) as r1`);
  assert.match(tmc, /^c_oilr1 = 3 \* 2;/m);
  assert.match(tmc, /^y = c_oilr1;/m);
});

test("x and y on the left draw curves; they are not locals", () => {
  const tmc = ok(`component Wave(a) {\n  y = a * sin(x)\n}\nnew Wave(2) as w1\nnew Wave(3) as w2`);
  assert.match(tmc, /^y = 2 \* sin\(x\);/m);
  assert.match(tmc, /^y = 3 \* sin\(x\);/m);
});

test("local functions keep their own arguments", () => {
  const tmc = ok(`component Bump(k) {\n  f(u) = k * u^2\n  y = f(x)\n}\nnew Bump(2) as b`);
  assert.match(tmc, /^f_b\(u\) = 2 \* u\^2;/m);
  assert.match(tmc, /^y = f_b\(x\);/m);
});

test("anonymous instances get numbered folders", () => {
  const tmc = ok(`${SPRING}\nnew Spring((0, 0), (1, 1))\nnew Spring((0, 1), (1, 2))`);
  assert.match(tmc, /folder "Spring 1" \{\nd_Spring1 = /);
  assert.match(tmc, /folder "Spring 2" \{\nd_Spring2 = /);
});

test("the instance tail wins over a line's own tokens", () => {
  const tmc = ok(`component Dot(P) {\n  P . #blue point 6\n}\nnew Dot((1, 2)) as a . #red`);
  assert.match(tmc, /\(1, 2\) @\{ color: RED, points: @\{ size: 6 \} \};/);
});

test("classes inside a body and on the instance", () => {
  const tmc = ok(`class thin { width 1 }\nclass thick { width 5 }\ncomponent Seg(A, B) {\n  segment(A, B) .thin\n}\nnew Seg((0, 0), (1, 1)) as s .thick`);
  assert.match(tmc, /width: 5/);
});

test("string parameters fill labels; ${local} in a label follows the rename", () => {
  const tmc = ok(`component Tag(P, text) {\n  n = 3\n  P . label text\n  P . label "n = \${n}"\n}\nnew Tag((1, 1), "hi") as t`);
  assert.match(tmc, /text: "hi"/);
  assert.match(tmc, /text: "n = \$\{n_t\}"/);
});

test("click actions update the instance's own locals", () => {
  const tmc = ok(`component Btn(P) {\n  n = 0\n  P . point 9 click(n -> n + 1)\n}\nnew Btn((0, 0)) as b1\nnew Btn((1, 0)) as b2`);
  assert.match(tmc, /onClick: n_b1 -> n_b1 \+ 1/);
  assert.match(tmc, /onClick: n_b2 -> n_b2 \+ 1/);
});

test("sliders in a body: one per instance", () => {
  const tmc = ok(`component K(c) {\n  k = c [0 : 10]\n}\nnew K(1) as a\nnew K(2) as b`);
  assert.match(tmc, /^k_a = 1 @\{ slider/m);
  assert.match(tmc, /^k_b = 2 @\{ slider/m);
});

test("an instance inside a folder puts its lines straight into that folder", () => {
  const tmc = ok(`${SPRING}\nfolder "All" {\n  new Spring((0, 0), (1, 1)) as s1\n}`);
  assert.equal((tmc.match(/folder/g) ?? []).length, 1);
  assert.match(tmc, /d_s1 = /);
});

test("errors: unknown component, arguments", () => {
  assert.match(errs(`${SPRING}\nnew Sprin((0, 0), (1, 1))`), /Unknown component 'Sprin' \(did you mean 'Spring'\?\)/);
  assert.match(errs(`${SPRING}\nnew Spring((0, 0))`), /Missing argument 'B'/);
  assert.match(errs(`${SPRING}\nnew Spring(1, 2, 3, 4)`), /takes 3 arguments, got 4/);
  assert.match(errs(`${SPRING}\nnew Spring(1, 2, coil = 3)`), /no parameter 'coil' \(did you mean 'coils'\?\)/);
  assert.match(errs(`${SPRING}\nnew Spring(1, 2, coils = 3, coils = 4)`), /'coils' is given twice/);
  assert.match(errs(`${SPRING}\nnew Spring(A = 1, 2)`), /Positional arguments must come before named ones/);
  assert.match(errs(`${SPRING}\nnew Spring(1, 2) as`), /Expected a name after 'as'/);
  assert.match(errs(`${SPRING}\nnew Spring(1, 2) foo`), /Unexpected 'foo'/);
});

test("errors: instance names and members", () => {
  assert.match(errs(`${SPRING}\nnew Spring(1, 2) as s\nnew Spring(1, 2) as s`), /Instance 's' already exists/);
  assert.match(errs(`${SPRING}\ns = 1\nnew Spring(1, 2) as s`), /'s' is already a variable/);
  assert.match(errs(`${SPRING}\nnew Spring(1, 2) as s\nk = s.dd`), /s \(a Spring\) has no member 'dd' \(did you mean 'd'\?\)/);
});

test("errors: definitions", () => {
  assert.match(errs(`component P(x) {\n  y = x\n}`), /can't be named 'x'/);
  assert.match(errs(`component P(a) {\n  a = 1\n}`), /'a' is a parameter of P/);
  assert.match(errs(`component P(a) {\n  b = 1\n  b = 2\n}`), /'b' is already defined in P/);
  assert.match(errs(`component P(a) {\n  folder "x" {\n}`), /'folder' can't go inside a component/);
  assert.match(errs(`component P(a) {\n  y = a`), /never closed/);
  assert.match(errs(`${SPRING}\n${SPRING}`), /already defined/);
});

test("warnings: case conventions are only warnings", () => {
  assert.match(warns(`component spring(a) {\n  y = a\n}\nnew spring(1)`), /Component names usually start with a capital letter/);
  assert.match(warns(`class Big { width 5 }\ny = x .Big`), /Class names usually start with a lowercase letter/);
  assert.equal(errs(`class Big { width 5 }\ny = x .Big`), "");
});

test("warning: two instances drawing the same thing on top of each other", () => {
  assert.match(warns(`component W(a) {\n  y = sin(x)\n}\nnew W(1) as p\nnew W(2) as q`), /draw this line identically/);
  assert.equal(warns(`component C(i) {\n  m = 0\n  y = i\n}\nnew C(1) as p\nnew C(2) as q`), "");
});

test("r is a polar curve unless another line of the body uses it", () => {
  const tmc = ok(`component Ring(s) {\n  r = s\n  x^2 + y^2 = r^2\n}\nnew Ring(1) as inner\nnew Ring(2) as outer`);
  assert.match(tmc, /^r_inner = 1;\nx\^2 \+ y\^2 = r_inner\^2;/m);
  assert.match(tmc, /^r_outer = 2;/m);
  assert.match(ok(`component Rose(k) {\n  r = cos(k * theta)\n}\nnew Rose(3) as a`), /^r = cos\(3 \* theta\);/m);
  assert.match(ok(`component Circle(s) {\n  r = s\n}\nnew Circle(5) as c`), /^r = 5;/m);
});

test("a misspelt keyword is reported, and the body still parses as a component", () => {
  const r = run(`compoment Ring(s) {\n  r = s\n}\nnew Ring(1) as a`);
  assert.deepEqual(r.errors.map((e) => e.message), ["Unknown keyword 'compoment' (did you mean 'component'?)"]);
});

// ---------- M6: nesting ----------

const DOT = `component Dot(P, c = 0) {
  n = c
  P . point 6 click(n -> n + 1)
}`;
const PAIR = `${DOT}
component Pair(A, B) {
  gap = distance(A, B)
  new Dot(A) as a
  new Dot(B, c = gap) as b
  segment(a.P, b.P)
}`;

test("nested instances share the outer folder and get path-based names", () => {
  const tmc = ok(`${PAIR}\nnew Pair((0, 0), (3, 4)) as p`);
  assert.equal((tmc.match(/folder/g) ?? []).length, 1);
  assert.match(tmc, /^g_app = distance\(\(0, 0\), \(3, 4\)\);/m);
  assert.match(tmc, /^n_pa = 0;/m);
  assert.match(tmc, /^n_pb = g_app;/m);          // an outer local passed in as an argument
  assert.match(tmc, /onClick: n_pa -> n_pa \+ 1/);
  assert.match(tmc, /onClick: n_pb -> n_pb \+ 1/);
  assert.match(tmc, /^\(1 - t\) \* \(\(0, 0\)\) \+ t \* \(\(3, 4\)\);/m); // segment(a.P, b.P) inside the body
});

test("two outer instances get separate nested names", () => {
  const tmc = ok(`${PAIR}\nnew Pair((0, 0), (1, 0)) as p\nnew Pair((0, 1), (1, 1)) as q`);
  for (const n of ["n_pa", "n_pb", "n_qa", "n_qb"]) assert.match(tmc, new RegExp(`^${n} = `, "m"));
});

test("paths reach into nested instances from anywhere", () => {
  const tmc = ok(`total = p.a.n + p.b.n + p.gap + p.b.P.x\n${PAIR}\nnew Pair((0, 0), (3, 4)) as p`);
  assert.match(tmc, /^t_otal = n_pa \+ n_pb \+ g_app \+ \(3, 4\)\.x;/m);
});

test("anonymous nested instances", () => {
  const tmc = ok(`${DOT}\ncomponent Two(A) {\n  new Dot(A)\n  new Dot(A, c = 1)\n}\nnew Two((1, 1)) as t`);
  assert.match(tmc, /^n_tDot1 = 0;/m);
  assert.match(tmc, /^n_tDot2 = 1;/m);
});

test("three levels deep", () => {
  const tmc = ok(`${PAIR}\ncomponent Quad(A) {\n  new Pair(A, A + (1, 0)) as top\n  new Pair(A + (0, 1), A + (1, 1)) as bottom\n}\nnew Quad((0, 0)) as q\nk = q.top.a.n`);
  assert.match(tmc, /^n_qtopa = 0;/m);
  assert.match(tmc, /^n_qbottomb = g_apqbottom;/m);
  assert.match(tmc, /^k = n_qtopa;/m);
});

test("tails stack from the inside out: the outermost instance wins", () => {
  const src = `component In(P) {\n  P . #blue point 5\n}\ncomponent Out(P) {\n  new In(P) as i . #green\n}`;
  assert.match(ok(`${src}\nnew Out((1, 1)) as o`), /color: GREEN/);
  assert.match(ok(`${src}\nnew Out((1, 1)) as o . #red`), /color: RED/);
  assert.doesNotMatch(ok(`${src}\nnew Out((1, 1)) as o . #red`), /GREEN|BLUE/);
});

test("nested names still avoid every name in the file", () => {
  const tmc = ok(`n_pa = 7\n${PAIR}\nnew Pair((0, 0), (1, 0)) as p\nk = p.a.n`);
  assert.match(tmc, /^n_pa = 7;/m);
  assert.match(tmc, /^n_pax = 0;/m);
  assert.match(tmc, /^k = n_pax;/m);
});

test("errors: recursion, nested names, nested arguments", () => {
  assert.match(errs(`component A(p) {\n  new A(p)\n}`), /A uses A: a component can't contain itself/);
  assert.match(errs(`component A(p) {\n  new B(p)\n}\ncomponent B(p) {\n  new A(p)\n}\nnew A(1) as a`), /A uses B uses A/);
  assert.match(errs(`${DOT}\ncomponent P(A) {\n  k = 1\n  new Dot(A) as k\n}`), /'k' is already a local in P/);
  assert.match(errs(`component P(A) {\n  new Dott(A) as d\n}`), /Unknown component 'Dott'/);
  // A bad nested call is reported once, at the definition, however many instances there are.
  const r = run(`${DOT}\ncomponent P(A) {\n  new Dot() as d\n}\nnew P(1) as a\nnew P(2) as b`);
  assert.deepEqual(r.errors.map((e) => e.message), ["Missing argument 'P' for Dot"]);
  assert.match(errs(`${PAIR}\nnew Pair(1, 2) as p\nk = p.a.zz`), /p\.a \(a Dot\) has no member 'zz'/);
});

// ---------- M7: list instances ----------

const CELL = `component Cell(i, j) {
  m = 0
  polygon((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)) . click(m -> 1)
}`;

test("a list instance is one folder of lists, not one folder per copy", () => {
  const tmc = ok(`${CELL}\nnew Cell(i, j) for i = [1...9], j = [1...9] as cells\nmines = total(cells.m)`);
  assert.equal((tmc.match(/folder/g) ?? []).length, 1);
  assert.match(tmc, /^i_cells = \[i for i = \[1\.\.\.9\], j = \[1\.\.\.9\]\] @\{ hidden: true \};/m);
  assert.match(tmc, /^j_cells = \[j for i = \[1\.\.\.9\], j = \[1\.\.\.9\]\] @\{ hidden: true \};/m);
  assert.match(tmc, /^m_cells = \[0 for i = \[1\.\.\.9\], j = \[1\.\.\.9\]\];/m); // one flag per cell
  assert.match(tmc, /^polygon\(\(i_cells, j_cells\)/m);
  assert.match(tmc, /^m_ines = total\(m_cells\);/m);
});

test("a click changes only the clicked copy, through Desmos's index", () => {
  const tmc = ok(`${CELL}\nnew Cell(i, j) for i = [1...3], j = [1...3] as cells`);
  assert.match(tmc, /onClick: m_cells -> \[\{k_cellsi = index: 1, m_cells\[k_cellsi\]\} for k_cellsi = \[1\.\.\.length\(m_cells\)\]\]/);
  // ...and an action that reads list locals reads the clicked copy's value
  const t2 = ok(`component C(i) {\n  m = 0\n  (i, 0) . point 9 click(m -> m + i)\n}\nnew C(i) for i = [1...5] as cs`);
  assert.match(t2, /m_cs -> \[\{k_csi = index: m_cs\[index\] \+ i_cs\[index\], m_cs\[k_csi\]\}/);
});

test("arguments that don't use the loop stay as they are; locals built from lists stay lists", () => {
  const tmc = ok(`component D(i, r) {\n  c = (i, 0)\n  (x - c.x)^2 + y^2 < r^2\n}\nnew D(i, 0.4) for i = [1...5] as ds`);
  assert.match(tmc, /^i_ds = \[i for i = \[1\.\.\.5\]\] @\{ hidden: true \};/m);
  assert.doesNotMatch(tmc, /r_ds/);                     // r = 0.4 is the same for every copy
  assert.match(tmc, /^c_ds = \(i_ds, 0\);/m);           // already a list: not wrapped again
});

test("errors: list instances inside components, of nesting components, and list locals", () => {
  assert.match(errs(`${CELL}\ncomponent G(n) {\n  new Cell(i, 1) for i = [1...n]\n}`), /can't go inside a component yet/);
  assert.match(errs(`${CELL}\ncomponent P(i) {\n  new Cell(i, 0) as c\n}\nnew P(i) for i = [1...3]`), /uses other components, so it can't be a list instance yet/);
  assert.match(errs(`component L(i) {\n  q = [1, 2, 3]\n  y = i\n}\nnew L(i) for i = [1...3]`), /no lists of lists/);
  assert.match(errs(`${CELL}\nnew Cell(1, 2) for as c`), /Expected 'for name = \[list\]'/);
});

// ---------- abstract parameters ----------

test("an abstract parameter is a real variable per instance, not pasted text", () => {
  const tmc = ok(`component Spring(A, B, abstract coils = 8 [1 : 20], abstract w = (0, 1)) {
  (1 - t) * A + t * B + sin(2 * pi * coils * t) * w * 0.1
}
new Spring((0, 0), (4, 1)) as s1
new Spring((0, 2), (4, 3), coils = 12) as s2
k = s1.coils + s2.coils`);
  assert.match(tmc, /^c_oilss1 = 8 @\{ slider: @\{ min: 1, max: 20, step: 0 \} \};/m); // a slider with its bounds
  assert.match(tmc, /^c_oilss2 = 12 @\{ slider: @\{ min: 1, max: 20/m);                // the passed value, same bounds
  assert.match(tmc, /^w_s1 = \(0, 1\) @\{ hidden: true \};/m);                         // not a number: hidden
  assert.match(tmc, /sin\(2 \* pi \* c_oilss1 \* t\) \* w_s1/);
  assert.match(tmc, /^k = c_oilss1 \+ c_oilss2;/m);
});

test("abstract parameters work in list instances and nested components", () => {
  const list = ok(`component D(i, abstract r = 0.4) {\n  (x - i)^2 + y^2 < r^2\n}\nnew D(i) for i = [1...5] as ds`);
  assert.match(list, /^r_ds = 0\.4;/m);
  assert.match(list, /< r_ds\^2/);
  const nested = ok(`component In(abstract a = 1) {\n  y = a\n}\ncomponent Out(b) {\n  new In(b + 1) as i\n}\nnew Out(2) as o\nq = o.i.a`);
  assert.match(nested, /^a_oi = 2 \+ 1 @\{ hidden: true \};/m);
  assert.match(nested, /^q = a_oi;/m);
});
