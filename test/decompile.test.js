import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";
import { assignIds, buildMeta, metaItem } from "../src/meta.js";
import { decompile } from "../src/decompile.js";
import { latexToTmc } from "../src/latex.js";

// What Desmos does on load (measured in live Desmos): drop false/empty defaults.
function desmosLoad(state) {
  for (const e of state.expressions.list) {
    for (const k of ["secret", "hidden", "displayEvaluationAsFraction", "suppressTextOutline", "interactiveLabel"]) if (e[k] === false) delete e[k];
    for (const k of ["regressionParameters", "vizProps"]) if (e[k] && !Object.keys(e[k]).length) delete e[k];
    if (e.slider) {
      delete e.slider.playDirection;
      if (e.slider.hardMin === false && e.slider.hardMax === false && e.slider.min === undefined) delete e.slider;
    }
  }
  return state;
}

/** Compile like the extension does and return the graph state Desmos would hold, plus a LaTeX->text stub. */
function graph(src) {
  const r = compile(src);
  assert.deepEqual(r.errors, []);
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), r.tmc);
  assert.deepEqual(diagnostics, []);
  assert.ok(assignIds(state, r.items));
  desmosLoad(state);
  state.expressions.list.unshift(metaItem(buildMeta(r, state.expressions.list, state.expressions.ticker)));
  const latexToText = latexToTmc;
  return { state, latexToText, item: (latex) => state.expressions.list.find((e) => e.latex === latex) };
}

const SRC = `color sea #2d70b3
class curve { #c74440 dashed width 3 }

"A note"

folder "Controls" collapsed {
  // the amplitude
  a = 2  [0 : 5 : 0.1]
}

y = a sin(x)  .curve
y = cos(x)  #sea width 4   // the second curve
(0, a)  #green point 9 label "top" above
`;

test("an untouched graph comes back as written", () => {
  const { state, latexToText } = graph(SRC);
  const { source, fromMeta, warnings } = decompile(state, { latexToText });
  assert.ok(fromMeta);
  assert.deepEqual(warnings, []);
  for (const line of ["color sea #2d70b3", "class curve { #c74440 dashed width 3 }", '"A note"',
    'folder "Controls" collapsed {', "  // the amplitude", "  a = 2  [0 : 5 : 0.1]",
    "y = a sin(x)  .curve", "y = cos(x)  #sea width 4", '(0, a)  #green point 9 label "top" above']) {
    assert.ok(source.split("\n").includes(line), `missing line: ${line}\n---\n${source}`);
  }
  assert.match(source, /\/\/ the second curve\ny = cos\(x\)/);
});

test("the rebuilt source compiles to the same graph", () => {
  const { state, latexToText } = graph(SRC);
  const { source } = decompile(state, { latexToText });
  const strip = (t) => t.split("\n").filter((l) => !l.startsWith("settings")).join("\n");
  assert.equal(strip(compile(source).tmc), strip(compile(SRC).tmc));
});

test("restyled in Desmos: classes stay, only the change is inline", () => {
  const { state, latexToText, item } = graph(SRC);
  item("y=a\\cdot \\operatorname{sin}\\left(x\\right)").lineWidth = "5";
  assert.match(decompile(state, { latexToText }).source, /^y = a sin\(x\)  \.curve width 5$/m);
});

test("a class property reset to the Desmos default comes back as that default", () => {
  const { state, latexToText, item } = graph(SRC);
  delete item("y=a\\cdot \\operatorname{sin}\\left(x\\right)").lineStyle; // dashed -> solid
  assert.match(decompile(state, { latexToText }).source, /^y = a sin\(x\)  \.curve solid$/m);
});

test("a recoloured line uses the palette name when there is one", () => {
  const { state, latexToText, item } = graph(SRC);
  item("y=a\\cdot \\operatorname{sin}\\left(x\\right)").color = "#2d70b3";
  assert.match(decompile(state, { latexToText }).source, /^y = a sin\(x\)  \.curve #sea$/m);
});

test("math edited in Desmos is converted; its style survives", () => {
  const { state, latexToText, item } = graph(SRC);
  item("y=\\operatorname{cos}\\left(x\\right)").latex = "y=\\operatorname{cos}\\left(2\\cdot x\\right)";
  assert.match(decompile(state, { latexToText }).source, /^y = cos\(2 \* x\)  #sea width 4$/m);
});

test("slider bounds changed in Desmos are regenerated", () => {
  const { state, latexToText, item } = graph(SRC);
  Object.assign(item("a=2").slider, { max: "10", step: "" });
  assert.match(decompile(state, { latexToText }).source, /^  a = 2  \[0 : 10\]$/m);
});

test("items added in the Desmos UI come back without their automatic colour", () => {
  const { state, latexToText } = graph(SRC);
  state.expressions.list.push({ id: "77", type: "expression", latex: "y=x^{2}", color: "#388c46" });
  const { source } = decompile(state, { latexToText });
  assert.match(source, /^y = x\^2$/m);
});

test("comments of deleted items are kept at the end", () => {
  const { state, latexToText } = graph(SRC);
  state.expressions.list = state.expressions.list.filter((e) => e.latex !== "y=\\operatorname{cos}\\left(x\\right)");
  const { source } = decompile(state, { latexToText });
  assert.match(source, /orphaned comments[^\n]*\n\/\/ the second curve/);
});

test("a graph without TMC++ metadata still decompiles", () => {
  const state = { version: 9, graph: { viewport: { xmin: -5, xmax: 5, ymin: -3, ymax: 3 }, showGrid: false },
    expressions: { list: [{ id: "1", type: "expression", latex: "y=x", color: "#c74440", lineStyle: "DASHED" }] } };
  const { source, fromMeta } = decompile(state, { latexToText: (l) => l.replace("=", " = ") });
  assert.equal(fromMeta, false);
  assert.match(source, /^settings x \[-5 : 5\] y \[-3 : 3\] no-grid$/m);
  assert.match(source, /^y = x  \. #red dashed$/m);
});

import { readFileSync, readdirSync } from "node:fs";
for (const f of readdirSync("examples").filter((f) => f.endsWith(".tmcpp"))) {
  test(`round trip: examples/${f} decompiles to source that compiles identically`, () => {
    const src = readFileSync(`examples/${f}`, "utf8");
    const { state, latexToText } = graph(src);
    const { source, warnings } = decompile(state, { latexToText });
    assert.deepEqual(warnings, []);
    // Desmos keeps one ticker per graph, so its position in the file doesn't matter: compare it last.
    const strip = (t) => {
      const ls = t.split("\n").filter((l) => !l.startsWith("settings"));
      return [...ls.filter((l) => !l.startsWith("ticker")), ...ls.filter((l) => l.startsWith("ticker"))].join("\n");
    };
    const again = compile(source);
    assert.deepEqual(again.errors, []);
    assert.equal(strip(again.tmc), strip(compile(src).tmc));
  });
}

test("empty rows in the Desmos list are skipped", () => {
  const state = { version: 11, graph: {}, expressions: { list: [
    { id: "1", type: "expression", latex: "y=x" },
    { id: "2", type: "expression", latex: "", color: "#000000", lineStyle: "SOLID" },
    { id: "3", type: "expression", color: "#2d70b3" },
  ] } };
  const { source } = decompile(state, { latexToText: latexToTmc });
  assert.equal(source.trim(), "y = x");
});

test("old slider settings on non-sliders are ignored", () => {
  const state = { version: 11, graph: {}, expressions: { list: [
    { id: "1", type: "expression", latex: "R_{1}=h\\to5", slider: { hardMin: true, hardMax: true, min: "0", max: "5", step: "0.5" } },
    { id: "2", type: "expression", latex: "C=0", slider: { hardMin: true, hardMax: true, min: "0", max: "1" } },
  ] } };
  const { source } = decompile(state, { latexToText: latexToTmc });
  assert.match(source, /^R_1 = h -> 5$/m);
  assert.match(source, /^C = 0  \[0 : 1\]$/m);
});

test("hand-made graphs keep every colour, including variable colours", () => {
  const state = { version: 11, graph: {}, expressions: { list: [
    { id: "1", type: "expression", latex: "c_{1}=\\operatorname{rgb}\\left(100,136,234\\right)" },
    { id: "2", type: "expression", latex: "\\operatorname{polygon}\\left(x_{4},y_{4}\\right)", color: "#c74440", colorLatex: "c_{1}", fill: true, fillOpacity: "1" },
    { id: "3", type: "expression", latex: "\\operatorname{polygon}\\left(x_{5},y_{5}\\right)", color: "#c74440", fill: true, fillOpacity: "0.8" },
    { id: "4", type: "expression", latex: "y=x", color: "#2d70b3" },
  ] } };
  const { source } = decompile(state, { latexToText: latexToTmc });
  assert.match(source, /^polygon\(x_4, y_4\)  \. #\(c_1\) fill 1$/m);
  assert.match(source, /^polygon\(x_5, y_5\)  \. #red fill 0\.8$/m);
  assert.match(source, /^y = x  \. #blue$/m);
  // ...and the rebuilt source compiles back to the same colours
  const r = compile(source, { defaultSettings: {}, watermark: false });
  assert.match(r.tmc, /polygon\(x_4, y_4\) @\{ color: c_1, fill: 1 \}/);
});

test("click actions survive decompiling (game buttons)", () => {
  const state = { version: 11, graph: {}, expressions: { list: [
    { id: "1", type: "expression", latex: "\\operatorname{polygon}\\left(x_{4},y_{4}\\right)", color: "#c74440", colorLatex: "c_{1}",
      clickableInfo: { enabled: true, description: "", latex: "s\\to 1.75" } },
    { id: "2", type: "expression", latex: "\\operatorname{polygon}\\left(x_{2},y_{2}\\right)", color: "#2d70b3", hidden: true,
      clickableInfo: { enabled: true, description: "Up", latex: "U\\left(1\\right)" } },
    { id: "3", type: "expression", latex: "\\operatorname{polygon}\\left(x_{3},y_{3}\\right)", color: "#2d70b3",
      clickableInfo: { enabled: true, description: "", latex: "\\left(a\\to 1,b\\to 2\\right)" } },
  ] } };
  const { source } = decompile(state, { latexToText: latexToTmc });
  assert.match(source, /^polygon\(x_4, y_4\)  \. #\(c_1\) click\(s -> 1\.75\)$/m);
  assert.match(source, /^polygon\(x_2, y_2\)  \. #blue hidden click\(U\(1\)\) click-label "Up"$/m);
  assert.match(source, /^polygon\(x_3, y_3\)  \. #blue click\(a -> 1, b -> 2\)$/m);
  const r = compile(source, { defaultSettings: {}, watermark: false });
  assert.deepEqual(r.errors, []);
  const [{ diagnostics }, back] = textToRaw(buildConfig({}), r.tmc);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(back.expressions.list.map((e) => e.clickableInfo?.latex),
    ["s\\to 1.75", "U\\left(1\\right)", "\\left(a\\to 1,b\\to 2\\right)"]);
});

test("a table inside a folder converts without its folder id; a failing item is skipped, not fatal", () => {
  const seen = [];
  const state = { version: 11, graph: {}, expressions: { list: [
    { type: "folder", id: "f", title: "F" },
    { type: "table", id: "t", folderId: "f", columns: [] },
    { type: "image", id: "i", folderId: "f" },
  ] } };
  const itemToTmc = (item) => {
    seen.push(item.folderId);
    if (item.type === "image") throw new Error("nope");
    return "table {\n}";
  };
  const { source, warnings } = decompile(state, { latexToText: (l) => l, itemToTmc });
  assert.deepEqual(seen, [undefined, undefined]);
  assert.match(source, /folder "F" \{\n  table \{\n  \}\n  \/\/ \(left out: image i, which couldn't be converted\)\n\}/);
  assert.match(warnings.join(" "), /couldn't convert image i/);
});

test("style values keep word spaces by bracketing, instead of gluing words together", async () => {
  const { oneToken } = await import("../src/decompile.js");
  assert.equal(oneToken("0.5 * sqrt(x)"), "0.5*sqrt(x)");
  assert.equal(oneToken("a pi"), "(a pi)");
  assert.equal(oneToken("x for i = [1...3]"), "(x for i=[1...3])");
});

test("a slider with only a max, and a parametric's t range, survive From graph", () => {
  const state = { version: 11, graph: { degreeMode: true }, expressions: { list: [
    { type: "expression", id: "1", latex: "a_{nim}=56.595", color: "#388c46",
      slider: { hardMax: true, max: "3532.91", loopMode: "PLAY_INDEFINITELY" } },
    { type: "expression", id: "2", latex: "\\left(\\cos t,\\sin t\\right)", color: "#000000",
      parametricDomain: { min: "", max: "360" } }, // Desmos writes an untouched min as ""
  ] } };
  const { source } = decompile(state, { latexToText: latexToTmc });
  assert.match(source, /^a_nim = 56\.595  \[ : 3532\.91\] \. forever/m);
  assert.match(source, /domain: @\{ t: @\{ min: 0, max: 360 \} \}/);
  const r = compile(source, { defaultSettings: {}, watermark: false });
  assert.deepEqual(r.errors, []);
  assert.match(r.tmc, /slider: @\{ max: 3532\.91/);
  assert.match(r.tmc, /loopMode: "PLAY_INDEFINITELY"/);
  assert.match(r.tmc, /domain: @\{ t: @\{ min: 0, max: 360 \} \}/);
});
