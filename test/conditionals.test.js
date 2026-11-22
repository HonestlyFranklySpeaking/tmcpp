import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";

function check(source) {
  const result = compile(source, { watermark: false, defaultSettings: {} });
  assert.deepEqual(result.errors, []);
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), result.tmc);
  assert.deepEqual(diagnostics, []);
  return { ...result, graph: state.expressions.list };
}

test("nested inline values, else-if chains and argument boundaries", () => {
  const { tmc } = check([
    "y = if x < 0 then -x else if x < 2 then x else 2",
    "a = max(if s = 1 then if t = 1 then 3 else 4 else 5, 6)",
    "L = [if i < 2 then i else 0 for i = [1...3]]",
    'P = (1, if s = 0 then 2 else 3) . label "if then else" // if',
  ].join("\n"));
  assert.match(tmc, /y = \{x < 0: -x, x < 2: x, 2\}/);
  assert.match(tmc, /max\(\{s = 1: \{t = 1: 3, 4\}, 5\}, 6\)/);
  assert.match(tmc, /\{i < 2: i, 0\} for/);
  assert.match(tmc, /"if then else"/);
});

test("interactive fixture emits one curve, guarded point, restricted region and clickable action", () => {
  const source = readFileSync(new URL("./fixtures/if-switch.tmcpp", import.meta.url), "utf8");
  const { tmc, graph, lineMap } = check(source);
  assert.equal(graph.length, 5);
  assert.match(tmc, /y = \{m = 1: x\^2, -x\}/);
  assert.match(tmc, /P = \{m = 1: \(2, 4\)\}/);
  assert.match(tmc, /x > 0: \{\{m = 1: 0, 1\} = 1: 4\}/);
  assert.deepEqual(lineMap, [2, 4, 5, 8, 10]);
  assert.equal(graph.at(-1).clickableInfo.latex, "\\left\\{m=0:m\\to 1,m\\to 0\\right\\}");
});

test("nested blocks merge definitions by left side and warn at the later style", () => {
  const { tmc, warnings } = check(`folder "test" {
if a > 0 {
  if b > 0 {
    f(x) = x {x > 1} . #red
  }
} else {
  Q = (3,4)
  f(x) = 0 . #blue
}
}`);
  assert.match(tmc, /f\(x\) = \{a > 0: \{b > 0: \{x > 1: x\}\}, 0\} @\{ color: RED/);
  assert.match(tmc, /Q = \{\{a > 0: 0, 1\} = 1: \(3,4\)\}/);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].line, 8);
});

test("component block locals, external members and list-instance conditional clicks", () => {
  const { tmc } = check(`component Cell(n) {
  if n > 0 {
    v = 2
  }
  else {
    v = 3
  }
  (n,v) . click(if m = 0 then m -> 1 else m -> 0)
  m = 0
}
new Cell(1) as solo
z = solo.v
new Cell(i) for i = [1...3] as row`);
  assert.match(tmc, /v_solo = \{1 > 0: 2, 3\}/);
  assert.match(tmc, /z = v_solo/);
  assert.match(tmc, /m_row\[index\] = 0: m_row -> \[\{/);
  assert.match(tmc, /, m_row -> \[\{/);
});

test("block else-if chains nest, and sliders are refused inside blocks", () => {
  const { tmc } = check("m = 1\nif m = 1 {\n  y = x\n} else if m = 2 {\n  y = 2x\n} else {\n  y = 3x\n}\nP = (1, 1)");
  assert.match(tmc, /y = \{m = 1: x, \{m = 2: 2 \* x, 3 \* x\}\}/);
  assert.match(tmc, /P = \(1, 1\)/);
  const split = check("m = 1\nif m = 1 {\n  y = x\n}\nelse if m = 2 {\n  y = 2x\n}");
  assert.match(split.tmc, /y = \{m = 1: x, \{m = 2: 2 \* x\}\}/);
  const [error] = compile("c = 1\nif c = 1 {\n  a = 2 [0 : 5]\n}").errors;
  assert.match(error.message, /slider/);
  assert.equal(error.line, 3);
});

test("malformed conditionals report the original source line", () => {
  for (const [source, message] of [
    ["p = if then 1 else 0", /condition/],
    ["p = if n > 0 else 0", /then/],
    ["p = if n > 0 then 1", /else/],
    ["p = if n > 0 then 1 else", /expression/],
    ["p = if n > 0 then 1 else 2 else 3", /Unexpected/],
    ["if {", /condition/],
    ["if n > 0 {\np = 0", /closed/],
    ["} else {", /Unexpected/],
  ]) {
    const [error] = compile("// first line\n" + source).errors;
    assert.match(error.message, message);
    assert.equal(error.line, 2);
  }
});
