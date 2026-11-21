import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";
import { restoreGreek, unicodeToTmc } from "../src/greek.js";
import { latexToTmc } from "../src/latex.js";

const load = (src) => {
  const r = compile(src, { defaultSettings: {}, watermark: false });
  assert.deepEqual(r.errors, []);
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), r.tmc);
  assert.deepEqual(diagnostics.map((d) => d.message), [], r.tmc);
  return restoreGreek(state).expressions.list;
};

test("every Greek letter reaches Desmos as real LaTeX, with subscripts", () => {
  const [a, b, c] = load("y = gamma x + lambda_1\nk = Delta + omega\nm = theta + pi");
  assert.equal(a.latex, "y=\\gamma \\cdot x+\\lambda_{1}");
  assert.equal(b.latex, "k=\\Delta +\\omega");
  assert.equal(c.latex, "m=\\theta+\\pi");
});

test("Greek in labels: ${gamma} becomes ${\\gamma}", () => {
  const [p] = load('(1, 2) . label "g = ${gamma}, ${lambda_1}"');
  assert.equal(p.label, "g = ${\\gamma}, ${\\lambda_{1}}");
});

test("Unicode letters and symbols, but not inside strings", () => {
  assert.equal(unicodeToTmc("r = 2θ"), "r = 2 theta");
  assert.equal(unicodeToTmc("θ_1 = π/2"), "theta_1 = pi/2");
  assert.equal(unicodeToTmc("a ≤ b × c ÷ d"), "a <= b * c / d");
  assert.equal(unicodeToTmc('P . label "θ ≤ π"'), 'P . label "θ ≤ π"');
  const [e] = load("k = Δ + ω ≤ 3");
  assert.equal(e.latex, "k=\\Delta +\\omega \\le 3");
});

test("From graph: Greek and subscripts don't glue onto what follows", () => {
  assert.equal(latexToTmc("y=\\gamma_{1}x"), "y = gamma_1 x");
  assert.equal(latexToTmc("y=a_{1}x+b_{2}\\cos\\left(x\\right)"), "y = a_1 x + b_2 cos(x)");
  assert.equal(latexToTmc("f_{1}\\left(x\\right)=2"), "f_1(x) = 2");
});
