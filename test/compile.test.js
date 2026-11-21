import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.js";

// Most tests check statements only, so they switch the default settings header off.
const ok = (src, opts = { defaultSettings: {}, watermark: false }) => {
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
    ok("y = x", { watermark: false }),
    "settings @{ viewport: @{ xmin: -10, xmax: 10, ymin: -10, ymax: 10 } };\n\ny = x;",
  );
});

test("TMC++ settings shorthand overrides defaults", () => {
  assert.match(ok("settings y [-6 : 6] degrees\ny = x", { watermark: false }),
    /^settings @\{ viewport: @\{ xmin: -10, xmax: 10, ymin: -6, ymax: 6 \}, degreeMode: true \}/);
});

test("raw TMC settings merge over defaults", () => {
  assert.match(ok('settings @{ viewport: @{ xmax: 20 }, randomSeed: "abc" }\ny = x', { watermark: false }),
    /^settings @\{ viewport: @\{ xmin: -10, xmax: 20, ymin: -10, ymax: 10 \}, randomSeed: "abc" \}/);
});

test("multi-line raw settings block", () => {
  assert.match(ok("settings @{\n  viewport: @{ xmin: 0 },\n}\ny = x", { watermark: false }), /xmin: 0, xmax: 10/);
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
  assert.equal(ok("total = width * 2"), "t_otal = w_idth * 2;");
});

test("slider playback tokens merge with bounds", () => {
  assert.equal(ok("t = 0 [0 : 24 : 0.05] . play loop 40s"),
    't = 0 @{ slider: @{ min: 0, max: 24, step: 0.05, playing: true, loopMode: "LOOP_FORWARD", period: 40000 } };');
});

test("other loop modes, reverse and ms durations", () => {
  assert.equal(ok("a = 1 [0 : 5] . bounce reverse 500ms"),
    'a = 1 @{ slider: @{ min: 0, max: 5, step: 0, loopMode: "LOOP_FORWARD_REVERSE", reversed: true, period: 500 } };');
  assert.match(ok("a = 1 . once 1.5s"), /loopMode: "PLAY_ONCE", period: 1500/);
  assert.match(ok("a = 1 . forever"), /PLAY_INDEFINITELY/);
});

test("playback settings in a class", () => {
  assert.match(ok("class anim { play loop 10s }\nt = 0 [0 : 1] .anim"), /playing: true, loopMode: "LOOP_FORWARD", period: 10000/);
});

test("a forgotten tail before play is caught", () => {
  assert.match(errs("t = 0 [0 : 1] play"), /Style word 'play' is inside the math/);
});

test("tables compile as blocks", () => {
  assert.equal(ok('table {\n  X = [1, 2, 3]\n  Y = [4, 5, 6] . drag xy open\n}'),
    'table {\nX = [1, 2, 3];\nY = [4, 5, 6] @{ points: @{ drag: "XY", style: "OPEN" } };\n};');
});

test("table flags, table inside folder, and nesting errors", () => {
  assert.equal(ok('table pinned {\n  x1 = [1]\n}'), 'table {\nx1 = [1];\n} @{ pinned: true };');
  assert.equal(ok('folder "F" {\ntable {\nx1 = [1]\n}\n}'), 'folder "F" {\ntable {\nx1 = [1];\n};\n};');
  assert.match(errs('table {\nfolder "F" {\n}\n}'), /cannot go inside a table/);
  assert.match(errs('table {\nx1 = [1]'), /Table is never closed/);
});

test("ticker with play and step time", () => {
  assert.equal(ok("ticker a -> a + 1 . play 2s"), "ticker a -> a + 1 @{ playing: true, minStep: 2000 };");
  assert.equal(ok("ticker a -> 2a"), "ticker a -> 2 * a;");
  assert.match(errs("ticker a -> a + 1 . loop"), /Unknown ticker token 'loop'/);
});

test("image lines get their semicolon", () => {
  assert.equal(ok('image "pic" @{ width: 5 }'), 'image "pic" @{ width: 5 };');
});

test("regression parameter block is not a colour", () => {
  assert.equal(ok("y1 ~ m * x1 + b # { m = 2 }"), "y1 ~ m * x1 + b # { m = 2 };");
});

test("point style, point opacity and item flags", () => {
  assert.equal(ok("(1, 2) . cross point-opacity 0.5 pinned secret"),
    '(1, 2) @{ points: @{ style: "CROSS", opacity: 0.5 }, pinned: true, secret: true };');
  assert.equal(ok("1 + 7/2 . fraction"), "1 + 7/2 @{ displayEvaluationAsFraction: true };");
});

test("settings no-grid and lock", () => {
  assert.match(ok("settings no-grid lock\ny = x", { watermark: false }), /showGrid: false, lockViewport: true \};/);
});

test("slider bounds take natural math like 2pi", () => {
  assert.equal(ok("a = 0.7 [0 : 2pi : 0.01]"), "a = 0.7 @{ slider: @{ min: 0, max: 2 * pi, step: 0.01 } };");
  assert.equal(ok("a = 1 [-pi : pi]"), "a = 1 @{ slider: @{ min: -pi, max: pi, step: 0 } };");
});

test("unsolved double inequalities become max(...) < 0", () => {
  assert.equal(ok("2.49 < r(x,y) < 2.98"), "max(2.49 - (r(x,y)), (r(x,y)) - 2.98) < 0;");
  assert.equal(ok("1 <= x^2 + y^2 <= 4"), "max(1 - (x^2 + y^2), (x^2 + y^2) - 4) <= 0;");
  assert.equal(ok("4 > r > 1"), "max(1 - r, r - 4) < 0;");
  assert.equal(ok("0.34 < q(x,y) < {v(x,y) < 0: 1.03, 0}"),
    "max(0.34 - (q(x,y)), (q(x,y)) - ({v(x,y) < 0: 1.03, 0})) < 0;");
});

test("solved double inequalities are left for Desmos", () => {
  assert.equal(ok("-x < y < x"), "-x < y < x;");
  assert.equal(ok("1 < x < 4"), "1 < x < 4;");
});

test("mixed-direction double inequality is an error", () => {
  assert.match(errs("1 < r > 2"), /must point one way/);
});

test("f(x,y) = list after f is defined draws curves instead of redefining", () => {
  const r = compile("q(x,y) = x^2 + y^2\nq(x,y) = [1, 4]", { defaultSettings: {}, watermark: false });
  assert.deepEqual(r.errors, []);
  assert.equal(r.tmc, "q(x,y) = x^2 + y^2;\nq(x,y) - ([1, 4]) = 0;");
  assert.match(r.warnings[0].message, /q is defined on line 1/);
});

test("update rules are not comparisons", () => {
  assert.equal(ok("a -> a + 1"), "a -> a + 1;");
});

test("sources decode from UTF-8, UTF-8 with BOM and UTF-16 (PowerShell)", async () => {
  const { decodeSource } = await import("../src/decode.js");
  const text = "y = x // ok\r\nb = 2";
  const want = "y = x // ok\nb = 2";
  assert.equal(decodeSource(Buffer.from(text, "utf8")), want);
  assert.equal(decodeSource(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")])), want);
  assert.equal(decodeSource(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")])), want);
});


test("watermark: seed starts with TMC++ in ASCII hex and looks like a Desmos seed", async () => {
  const { watermarkSeed, isWatermarkSeed, WATERMARK } = await import("../src/compile.js");
  assert.equal(WATERMARK, Buffer.from("TMC++").toString("hex"));
  const seed = watermarkSeed("y = x");
  assert.match(seed, /^544d432b2b01[0-9a-f]{20}$/);
  assert.equal(seed, watermarkSeed("y = x"));       // stable for the same source
  assert.notEqual(seed, watermarkSeed("y = 2x"));   // differs between graphs
  assert.ok(isWatermarkSeed(seed));
  assert.ok(!isWatermarkSeed("ba9f5c1341fffbc57ac9c50540018465"));
});

test("watermark goes into settings unless the source sets a seed", () => {
  const r = compile("y = x", { defaultSettings: {} });
  assert.match(r.tmc, /^settings @\{ randomSeed: "544d432b2b01[0-9a-f]{20}" \};/);
  const own = compile('settings @{ randomSeed: "mine" }\ny = x', { defaultSettings: {} });
  assert.match(own.tmc, /randomSeed: "mine"/);
  const kept = compile("y = x", { defaultSettings: {}, randomSeed: "544d432b2b01aaaaaaaaaaaaaaaaaaaa" });
  assert.match(kept.tmc, /randomSeed: "544d432b2b01aaaaaaaaaaaaaaaaaaaa"/);
});

test("named colours: define once, use as #name in tails and classes", () => {
  assert.equal(ok("color water #092635\ny > 0 #water"), 'y > 0 @{ color: "#092635" };');
  assert.equal(ok("y > 0 #Water .wash\nclass wash { fill 1 }\ncolor water #092635"), 'y > 0 @{ color: "#092635", fill: 1 };');
  assert.equal(ok("color gold #ffd28a\nclass glow { #gold opacity 0 }\ny = x .glow"), 'y = x @{ color: "#ffd28a", lines: @{ opacity: 0 } };');
});

test("named colour errors", () => {
  assert.match(errs("color red #ff0000"), /built-in colour/);
  assert.match(errs("color abc #ff0000"), /looks like a hex code/);
  assert.match(errs("color sea #000\ncolor sea #111"), /already defined on line 1/);
  assert.match(errs("color sea blue"), /Malformed color/);
  assert.match(errs("color water #092635\ny = x #watr"), /did you mean '#water'/);
});

test("a variable called color is still math", () => {
  assert.equal(ok("color = 5"), "c_olor = 5;");
});

test("segment(A, B) draws a line, also between lists of points", () => {
  assert.equal(ok("segment((0,0), (3,2)) #red width 4"), '(1 - t) * ((0,0)) + t * ((3,2)) @{ color: RED, lines: @{ width: 4 } };');
  assert.equal(ok("segment(P, Q)"), "(1 - t) * (P) + t * (Q);");
  assert.equal(ok("segment([(0,0), (1,1)], [(2,0), (2,2)])"), "(1 - t) * ([(0,0), (1,1)]) + t * ([(2,0), (2,2)]);");
});

test("path(P) joins a list of points in order", () => {
  assert.equal(ok("path(C)"), "(1 - t) * (C[1...length(C) - 1]) + t * (C[2...length(C)]);");
  assert.equal(ok("path([(0,0), (1,2), (2,0)])"),
    "(1 - t) * (([(0,0), (1,2), (2,0)])[1...length(([(0,0), (1,2), (2,0)])) - 1]) + t * (([(0,0), (1,2), (2,0)])[2...length(([(0,0), (1,2), (2,0)]))]);");
});

test("segment and path errors", () => {
  assert.match(errs("segment((0,0))"), /takes two points/);
  assert.match(errs("segment((t,0), (1,1))"), /can't use t/);
  assert.match(errs("path(A, B)"), /takes one list/);
});

test("segment only rewrites a whole statement", () => {
  assert.equal(ok("y = segmentation(x)"), "y = s_egmentation(x);");
});

test("multi-letter names become names Desmos accepts", () => {
  assert.equal(ok("score = 1"), "s_core = 1;");
  assert.equal(ok("hello_world = 2"), "h_elloworld = 2;");
  assert.equal(ok("total = 3"), "t_otal = 3;");             // total is a Desmos function
  assert.equal(ok("y = total(L)"), "y = total(L);");        // ...but calling it is fine
  assert.equal(ok("f(x) = score * x"), "f(x) = s_core * x;");
  assert.equal(ok("theta = 1"), "theta = 1;");
  assert.equal(ok("X_1 = 5"), "X_1 = 5;");
  assert.equal(ok("P.x + speed"), "P.x + s_peed;");
});

test("names in slider bounds, style values and tickers are renamed too", () => {
  assert.equal(ok("a = 1 [0 : top]"), "a = 1 @{ slider: @{ min: 0, max: t_op, step: 0 } };");
  assert.equal(ok("y > 0 . fill alpha*level"), "y > 0 @{ fill: alpha*l_evel };");
  assert.equal(ok("ticker score -> score + 1 . play"), "ticker s_core -> s_core + 1 @{ playing: true };");
});

test("label interpolation uses the Desmos name", () => {
  assert.equal(ok('(0, 0) label "score: ${score}"'), '(0, 0) @{ label: @{ text: "score: ${s_core}" } };');
});

test("names that collide in Desmos get a warning", () => {
  const r = compile("hello_world = 1\nhelloworld = 2", { defaultSettings: {}, watermark: false });
  assert.match(r.warnings.map((w) => w.message).join(), /hello_world and helloworld are the same variable in Desmos \(h_elloworld\)/);
});

test("label interpolation already in Desmos form is left alone", () => {
  assert.equal(ok('(0, 0) label "Score ${s_{core}} / ${best}"'), '(0, 0) @{ label: @{ text: "Score ${s_{core}} / ${b_est}" } };');
});

test("colour expressions: #(variable) and #(rgb(...))", () => {
  assert.equal(ok("polygon(A) #(c_1) fill 1"), "polygon(A) @{ color: c_1, fill: 1 };");
  assert.equal(ok("y = x #(rgb(100, 136, 234)) width 3"), "y = x @{ color: rgb(100, 136, 234), lines: @{ width: 3 } };");
  assert.equal(ok("y = x #(tone)"), "y = x @{ color: t_one };");
});

test("click actions: click(...) and click-label", () => {
  assert.equal(ok("polygon(A) #(c_1) click(s -> 1.75)"), "polygon(A) @{ color: c_1, onClick: s -> 1.75 };");
  assert.equal(ok('(x - 30)^2 + (y - 50)^2 <= 50 click(restart) click-label "Restart"'),
    '(x - 30)^2 + (y - 50)^2 <= 50 @{ onClick: r_estart, clickDescription: "Restart" };');
  assert.equal(ok("polygon(B) . click(a -> a + 1, b -> 0)"), "polygon(B) @{ onClick: (a -> a + 1, b -> 0) };");
  assert.match(errs("polygon(B) . click(a -> 1"), /Unclosed click action/);
});

test("a number written without its leading zero (.95) after fill/opacity is a number, not a class", () => {
  assert.equal(ok("y = x . opacity .5 fill .95"), "y = x @{ lines: @{ opacity: 0.5 }, fill: 0.95 };");
});

test("restrictions become a piecewise around the right-hand side", () => {
  assert.equal(ok("y = 2x {0 < x < 1}"), "y = {0 < x < 1: 2 * x};");
  assert.equal(ok("x^2 + y^2 < 4 {y > 0}{x > 0}"), "x^2 + y^2 < {y > 0: {x > 0: 4}};");
  assert.equal(ok("x = 225 {43 <= y <= 47}"), "x = {43 <= y <= 47: 225};");
  assert.equal(ok("f(x) = x^2 {x > 0}"), "f(x) = {x > 0: x^2};");
  assert.equal(ok("(cos(t), sin(t)) {t < 3}"), "{t < 3: (cos(t), sin(t))};");
  assert.equal(ok("y = {x > 0: 1, 2}"), "y = {x > 0: 1, 2};"); // a piecewise value is not a restriction
});

test("list comprehensions without brackets get them", () => {
  assert.equal(ok("P = polygon((a, b), (c, i)) for i = [1...5]"), "P = [polygon((a, b), (c, i)) for i = [1...5]];");
  assert.equal(ok("L = join(g(a) for a = [1, 2], b = [3])"), "L = join([g(a) for a = [1, 2], b = [3]]);");
  assert.equal(ok("L = [i for i = [1...3]]"), "L = [i for i = [1...3]];");
});
