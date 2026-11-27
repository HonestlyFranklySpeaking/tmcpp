// M20: lambdas, macros, compile-time for loops and while loops.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.js";
import { buildConfig, textToRaw } from "../src/tmc-core.js";

const ok = (src) => {
  const r = compile(src, { defaultSettings: {}, watermark: false });
  assert.deepEqual(r.errors, [], src);
  assert.deepEqual(textToRaw(buildConfig({}), r.tmc)[0].diagnostics.map((d) => d.message), [], r.tmc);
  return r.tmc.split("\n").filter(Boolean);
};
const errs = (src) => compile(src, { defaultSettings: {}, watermark: false }).errors.map((e) => e.message);

test("lambdas: map, filter, and a lambda passed to a component", () => {
  assert.deepEqual(ok("L = [1, -2, 3]\nM = map(L, (x) => x^2)\nF = filter(L, v => v > 0)").slice(1), ["M = [x^2 for x = L];", "F = L[L > 0];"]);
  const t = ok("component Plot(f) {\n  (t, f(t))\n}\nnew Plot((x) => sin(2x)) as p\nnew Plot(f = (u) => u^2 / 4) as q").join("\n");
  assert.match(t, /\(t, \(sin\(2 \* t\)\)\)/);
  assert.match(t, /\(t, \(t\^2 \/ 4\)\)/);
  assert.match(errs("g = (x) => x^2")[0], /only works where it's used straight away/);
  assert.match(errs("M = map([1, 2], (a, b) => a)")[0], /one-parameter lambda/);
});

test("macros: lines written where they're used, with math and tails as arguments", () => {
  const t = ok("macro Glow(shape, look) {\n  shape  look opacity 0\n}\nGlow(x^2 + y^2 < 4, #fa7e19 fill 0.3)\nGlow(y < sin(x), #2d70b3)");
  assert.deepEqual(t, ['(x^2 + y^2 < 4) @{ color: "#fa7e19", fill: 0.3, lines: @{ opacity: 0 } };', '(y < sin(x)) @{ color: "#2d70b3", lines: @{ opacity: 0 } };']);
  assert.match(errs("macro M(a) {\n  y = a\n}\nM(1, 2)")[0], /M takes 1 argument, but this gives 2/);
  // A macro may use another.
  assert.equal(ok("macro A(v) {\n  y = v\n}\nmacro B(v) {\n  A(v + 1)\n}\nB(2)")[0], "y = (2 + 1);");
});

test("for loops write their body once per value, with _{i} in names", () => {
  assert.deepEqual(ok("for i in [1...3] {\n  P_{i} = (i, 0)\n}"), ["P_1 = (1, 0);", "P_2 = (2, 0);", "P_3 = (3, 0);"]);
  assert.deepEqual(ok("for c in [0, 0.5 ... 1] {\n  y = c x\n}"), ["y = 0 * x;", "y = 0.5 * x;", "y = 1 * x;"]);
  assert.match(errs("for i in L {\n  y = i\n}")[0], /needs a list written out/);
});

test("while loops join the ticker", () => {
  assert.equal(ok("n = 0\nwhile n < 10 {\n  n++\n}").at(-1), "ticker ({n < 10: (n -> n + 1)}) @{ playing: true };");
  const merged = ok("n = 0\nm = 0\nticker m -> m + 1 . play 100ms\nwhile n < 3 {\n  n++\n}").join("\n");
  assert.match(merged, /ticker \(m -> m \+ 1, \{n < 3: \(n -> n \+ 1\)\}\)/);
});

test("a line ending in n++ or n-- doesn't swallow the next line", () => {
  assert.deepEqual(ok("n = 0\nstep = n++\ny = x"), ["n = 0;", "s_tep = n -> n + 1;", "y = x;"]);
});

test("a for loop's range must be numbers, with a clear error otherwise", () => {
  assert.match(errs("n = 3\nfor i in [0...n] {\n  a_{i} = i\n}")[0], /needs numbers in its range/);
  assert.match(errs("n = 3\nfor i in [0...id(n)] {\n  a_{i} = i\n}")[0], /list comprehension/);
  assert.deepEqual(errs("for v in [1, 4] {\n  y = v x\n}"), []);
});

test("a loop variable in a style tail: #c takes a colour, .c a class", () => {
  const t = ok("class thick { width 5 }\nfor c in [red, #2d70b3] {\n  y = 1 . #c\n}\nfor k in [thick] {\n  y = 2 .k\n}\nP = (1, 2)\nfor q in [3] {\n  y = P.x + q . #red\n}");
  assert.deepEqual(t, ["y = 1 @{ color: RED };", 'y = 1 @{ color: "#2d70b3" };', "y = 2 @{ lines: @{ width: 5 } };", "P = (1, 2);", "y = P.x + 3 @{ color: RED };"]);
});
