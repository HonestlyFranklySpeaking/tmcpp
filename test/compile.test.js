import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.js";

// Most tests check statements only, so they switch the default settings header off.
const ok = (src, opts = { defaultSettings: {} }) => {
  const r = compile(src, opts);
  assert.deepEqual(r.errors, [], JSON.stringify(r.errors));
  return r.tmc;
};
const errs = (src) => compile(src).errors.map((e) => e.message).join(" | ");

// Spec test cases (numbers match the spec's table)

test("1: plain expression has no style block", () => {
  assert.equal(ok("y = sin(x)"), "y = sin(x);");
});

test("2: slider with step", () => {
  assert.equal(ok("a = 1 [0 : 10 : 0.5]"), "a = 1 @{ slider: @{ min: 0, max: 10, step: 0.5 } };");
});

test("3: slider without step is continuous", () => {
  assert.equal(ok("a = 1 [0 : 10]"), "a = 1 @{ slider: @{ min: 0, max: 10, step: 0 } };");
});

test("4: list is not a slider", () => {
  assert.equal(ok("a = [1, 2, 3]"), "a = [1, 2, 3];");
});

test("5: class then inline override", () => {
  assert.equal(
    ok("class c { dashed width 3 }\ny = x .c width 5"),
    'y = x @{ lines: @{ style: "DASHED", width: 5 } };',
  );
});

test("6: later class wins", () => {
  assert.equal(
    ok("class a { width 2 }\nclass b { width 7 }\ny = x .a .b"),
    "y = x @{ lines: @{ width: 7 } };",
  );
});

test("7: anonymous tail", () => {
  assert.equal(ok("y = x . hidden"), "y = x @{ hidden: true };");
});

test("8: decimals are math, not tails", () => {
  assert.equal(ok("y = 1.5x + .5"), "y = 1.5 * x + 0.5;");
});

test("9: line ending in an operator continues", () => {
  assert.equal(ok("y = x +\n  2"), "y = x + 2;");
});

test("10: string line is a note", () => {
  assert.equal(ok('"hello"'), '"hello";');
});

test("11: nested folder is an error", () => {
  assert.match(errs('folder "A" {\nfolder "B" {\n}\n}'), /cannot be nested/);
});

test("12: unknown class is an error with a hint", () => {
  assert.match(errs("class curve { dashed }\ny = x .curv"), /Unknown class '\.curv'.*did you mean '\.curve'/);
});

// Extra behaviour from the Syntax section

test("optional CSS-style semicolons", () => {
  assert.equal(ok("a = 1;\nb = 2"), "a = 1;\nb = 2;");
});

test("class bodies accept ; separators", () => {
  assert.equal(
    ok("class c { #c74440; dashed; width 3 }\ny = x .c"),
    'y = x @{ color: "#c74440", lines: @{ style: "DASHED", width: 3 } };',
  );
});

test("backslash forces continuation", () => {
  assert.equal(ok("y = sin(x) \\\n  .c\nclass c { dotted }"), 'y = sin(x) @{ lines: @{ style: "DOTTED" } };');
});

test("open bracket continues", () => {
  assert.equal(ok("f(x) = (x +\n  1)"), "f(x) = (x + 1);");
});

test("indented operator line continues", () => {
  assert.equal(ok("y = x\n    - 3"), "y = x - 3;");
});

test("classes are hoisted", () => {
  assert.equal(ok("y = x .late\nclass late { hidden }"), "y = x @{ hidden: true };");
});

test("duplicate class is an error", () => {
  assert.match(errs("class a { hidden }\nclass a { dashed }"), /already defined on line 1/);
});

test("unknown token suggests the closest word", () => {
  assert.match(errs("y = x . dashd"), /did you mean 'dashed'/);
});

test("folder flags become folder style", () => {
  assert.equal(
    ok('folder "Controls" collapsed {\n  p = 2 [0 : 10]\n}'),
    'folder "Controls" {\np = 2 @{ slider: @{ min: 0, max: 10, step: 0 } };\n} @{ collapsed: true };',
  );
});

test("named colors and point options", () => {
  assert.equal(
    ok("(0, p) #blue point 12 drag y"),
    '(0, p) @{ color: BLUE, points: @{ size: 12, drag: "Y" } };',
  );
});

test("raw @{} escape hatch is passed through last", () => {
  assert.equal(
    ok('y = x . dashed @{ label: "hi" }'),
    'y = x @{ lines: @{ style: "DASHED" }, label: "hi" };',
  );
});

test("comments never reach TMC", () => {
  assert.equal(ok("// top\ny = x // trailing"), "y = x;");
});

test("# inside a string is not a tail", () => {
  assert.equal(ok('"note with #hash and .dots"'), '"note with #hash and .dots";');
});

test("piecewise braces stay in the math", () => {
  assert.equal(ok("y = {x < 0: -x, x}"), "y = {x < 0: -x, x};");
});

test("errors report the source line", () => {
  const r = compile("a = 1\n\n\ny = x .nope");
  assert.equal(r.errors[0].line, 4);
});

test("full example from the spec compiles", () => {
  const src = `
class curve { #c74440 dashed width 3 }

"Parabola demo"                      // a note

folder "Controls" collapsed {
  p = 2  [0.1 : 10 : 0.1]            // slider
  k = 1  [-5 : 5]                    // step optional
}

folder "Curves" {
  y = x^2 / (4p)   .curve
  (0, p)           #blue point 12 drag y
  y < k sin(x)     .curve fill 0.3
  y = |x - k|      . dotted
}`;
  const out = ok(src);
  assert.match(out, /y < k \* sin\(x\) @\{ color: "#c74440", lines: @\{ style: "DASHED", width: 3 \}, fill: 0.3 \};/);
});

test("implicit multiplication becomes explicit", () => {
  assert.equal(ok("y = x^2 / (4p)"), "y = x^2 / (4 * p);");
  assert.equal(ok("y < k sin(x)"), "y < k * sin(x);");
  assert.equal(ok("y = (x + 1)(x - 1)"), "y = (x + 1) * (x - 1);");
  assert.equal(ok("y = 2(x)"), "y = 2 * (x);");
});

test("function calls and keywords are left alone", () => {
  assert.equal(ok("y = f(x)"), "y = f(x);");
  assert.equal(ok("L = [i for i = [1...5]]"), "L = [i for i = [1...5]];");
  assert.equal(ok("y = p.x"), "y = p.x;");
});

test("folders close with a semicolon", () => {
  assert.equal(ok('folder "A" {\ny = x\n}'), 'folder "A" {\ny = x;\n};');
});

test("default settings header is added", () => {
  assert.equal(
    ok("y = x", {}),
    "settings @{ viewport: @{ xmin: -10, xmax: 10, ymin: -10, ymax: 10 } }\n\ny = x;",
  );
});

test("TMC++ settings shorthand overrides defaults", () => {
  assert.match(ok("settings y [-6 : 6] degrees\ny = x", {}),
    /^settings @\{ viewport: @\{ xmin: -10, xmax: 10, ymin: -6, ymax: 6 \}, degreeMode: true \}/);
});

test("raw TMC settings merge over defaults", () => {
  assert.match(ok('settings @{ viewport: @{ xmax: 20 }, randomSeed: "abc" }\ny = x', {}),
    /^settings @\{ viewport: @\{ xmin: -10, xmax: 20, ymin: -10, ymax: 10 \}, randomSeed: "abc" \}/);
});

test("multi-line raw settings block", () => {
  assert.match(ok("settings @{\n  viewport: @{ xmin: 0 },\n}\ny = x", {}), /xmin: 0, xmax: 10/);
});

test("raw @{} on an expression merges instead of duplicating keys", () => {
  assert.equal(ok("y = x . dashed @{ lines: @{ width: 9 } }"),
    'y = x @{ lines: @{ style: "DASHED", width: 9 } };');
});

test("label with text and position", () => {
  assert.equal(ok('(0, p) label "Focus" above'),
    '(0, p) @{ label: @{ text: "Focus", orientation: "above" } };');
});

test("label starts a tail by itself and keeps spaces in the text", () => {
  assert.equal(ok('A = (1, 2) label "point A; here" below-left label-size 1.5 label-angle 30 hover no-outline editable'),
    'A = (1, 2) @{ label: @{ text: "point A; here", orientation: "below_left", size: 1.5, angle: 30, showOnHover: true, outline: false, editableMode: "TEXT" } };');
});

test("label interpolation passes through", () => {
  assert.equal(ok('(0, p) #blue label "p = ${p}"'),
    '(0, p) @{ color: BLUE, label: @{ text: "p = ${p}" } };');
});

test("label position and size in a class", () => {
  assert.equal(ok('class tag { above label-size 1.2 }\n(1, 1) .tag label "T"'),
    '(1, 1) @{ label: @{ orientation: "above", size: 1.2, text: "T" } };');
});

test("label without a string is an error", () => {
  assert.match(errs("(1, 1) . label above"), /needs a string/);
});

test("the word label inside math is not a tail", () => {
  assert.equal(ok('"a note about label stuff"'), '"a note about label stuff";');
});

test("fill and opacity accept no-space expressions", () => {
  assert.equal(ok("y > 0 #black fill 0.9*(1-t) opacity 0"),
    "y > 0 @{ color: BLACK, fill: 0.9*(1-t), lines: @{ opacity: 0 } };");
});

test("style word left in the math is an error", () => {
  assert.match(errs("(1, 2) point 5"), /Style word 'point' is inside the math/);
  assert.equal(ok("(1, 2) . point 5"), "(1, 2) @{ points: @{ size: 5 } };");
});

test("big operators keep their body unmultiplied", () => {
  assert.equal(ok("A = sum n=(1...5) n"), "A = sum n=(1...5) n;");
  assert.equal(ok("A = integral x=(0 ... 5) x^2"), "A = integral x=(0 ... 5) x^2;");
  assert.equal(ok("A = product n=(1...5) 2n"), "A = product n=(1...5) 2 * n;");
});

test("derivative d/d x is left alone", () => {
  assert.equal(ok("g(x) = (d/d x) f(x)"), "g(x) = (d/d x) f(x);");
});

test("piecewise passes through", () => {
  assert.equal(ok("y = {x > 0: 2x, -x}"), "y = {x > 0: 2 * x, -x};");
});

test("multi-letter variable names are not mistaken for style words", () => {
  assert.equal(ok("total = width * 2"), "total = width * 2;");
});
