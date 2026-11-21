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

test("x, y and r on the left draw curves; they are not locals", () => {
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
  assert.match(errs(`${SPRING}\ncomponent P(a) {\n  new Spring(1, 2)\n}`), /isn't supported yet/);
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
