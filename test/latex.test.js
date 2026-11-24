import { test } from "node:test";
import assert from "node:assert/strict";
import { latexToTmc } from "../src/latex.js";
import { compile } from "../src/compile.js";
import { buildConfig, textToRaw } from "../src/tmc-core.js";

// LaTeX exactly as Desmos/TMC produced it earlier in this project.
const CASES = [
  // Found in the 2025 art contest gallery: keywords, functions and Greek must not glue on.
  ["L=\\left[a\\operatorname{for}a=\\left[1...5\\right]\\right]", "L = [a for a = [1...5]]"],
  ["y=a\\operatorname{with}a=3", "y = a with a = 3"],
  ["y=x\\cos\\left(x\\right)", "y = x cos(x)"],
  ["y=x\\cos\\theta", "y = x cos(theta)"],
  ["y=2\\sin x+1", "y = 2 sin(x) + 1"],
  ["y=\\sin^{2}\\left(x\\right)", "y = sin(x)^(2)"],
  ["y=\\sin^{-1}\\left(x\\right)", "y = arcsin(x)"],
  ["y=2\\theta x", "y = 2 theta x"],
  ["a_{\\theta}=1", "a_theta = 1"],
  ["y=a\\cdot \\operatorname{sin}\\left(x\\right)", "y = a * sin(x)"],
  ["y=\\frac{x^{2}}{4\\cdot p}", "y = x^2 / (4 * p)"],
  ["2\\cdot \\pi", "2 * pi"],
  ["0.07\\cdot \\left(1-t\\right)", "0.07 * (1 - t)"],
  ["X_{a}=\\left[-7,-5\\right]", "X_a = [-7, -5]"],
  ["\\left\\{x>0:2\\cdot x,-x\\right\\}", "{x > 0: 2 * x, -x}"],
  ["y<\\left[0,0.5...4\\right]", "y < [0, 0.5...4]"],
  ["\\left(1-t\\right)\\cdot \\left(P\\right)+t\\cdot \\left(Q\\right)", "(1 - t) * (P) + t * (Q)"],
  ["s_{tep}\\to s_{tep}+1", "s_tep -> s_tep + 1"],
  ["q\\left(x,y\\right)=\\sqrt{\\frac{u\\left(x,y\\right)}{7.7}^{2}+\\frac{v\\left(x,y\\right)}{7.7\\cdot b}^{2}}",
    "q(x, y) = sqrt((u(x, y) / 7.7)^2 + (v(x, y) / (7.7 * b))^2)"],
  ["\\left|x-k\\right|", "abs(x - k)"],
  ["F=\\left\\{46\\cdot s-I>0:\\operatorname{min}\\left(1,46\\cdot s-I\\right)\\right\\}", "F = {46 * s - I > 0: min(1, 46 * s - I)}"],
  ["x^{2}+y^{2}\\le4", "x^2 + y^2 <= 4"],
  ["y=e^{-x^{2}}", "y = e^(-x^2)"],
  ["\\theta=\\frac{\\pi}{2}", "theta = pi / 2"],
];

for (const [latex, want] of CASES) {
  test(`latex: ${latex}`, () => assert.equal(latexToTmc(latex), want));
}

test("unknown commands throw so callers can fall back", () => {
  assert.throws(() => latexToTmc("\\int_{0}^{1}x\\ dx"), /unsupported/);
});

test("every converted expression compiles back to the same LaTeX", () => {
  const cfg = buildConfig({});
  for (const [latex] of CASES) {
    if (latex.includes("\\frac{u")) continue; // (a/b)^2 vs \frac{a}{b}^{2}: same value, different LaTeX
    const r = compile(latexToTmc(latex), { defaultSettings: {}, watermark: false });
    assert.deepEqual(r.errors, [], latex);
    const [{ diagnostics }, state] = textToRaw(cfg, r.tmc);
    assert.deepEqual(diagnostics, [], latex);
  }
});

test("converted math compiles back to the same LaTeX Desmos had", () => {
  const cfg = buildConfig({});
  for (const latex of [
    "y=a\\cdot \\operatorname{sin}\\left(x\\right)",
    "0.07\\cdot \\left(1-t\\right)",
    "\\left\\{x>0:2\\cdot x,-x\\right\\}",
    "q\\left(x,y\\right)=\\sqrt{\\frac{u\\left(x,y\\right)}{7.7}^{2}+\\frac{v\\left(x,y\\right)}{7.7\\cdot b}^{2}}",
  ]) {
    const r = compile(latexToTmc(latex), { defaultSettings: {}, watermark: false });
    const [, state] = textToRaw(cfg, r.tmc);
    assert.equal(state.expressions.list[0].latex, latex);
  }
});

test("a fraction followed by a factor keeps its own brackets", () => {
  assert.equal(latexToTmc("x\\le\\frac{1}{\\pi}\\left(y-a\\right)+\\frac{\\pi}{2.5}"), "x <= (1 / pi)(y - a) + pi / 2.5");
  assert.equal(latexToTmc("y=\\frac{1}{2}x"), "y = (1 / 2)x");
  assert.equal(latexToTmc("y=\\frac{1}{2}\\cdot x"), "y = 1 / 2 * x");
});

test("sqrt, fractions and |x| don't glue onto a letter in front", () => {
  assert.equal(latexToTmc("y=a\\sqrt{x}"), "y = a sqrt(x)");
  assert.equal(latexToTmc("y=\\pi\\sqrt{x}"), "y = pi sqrt(x)");
  assert.equal(latexToTmc("y=x\\frac{1}{2}"), "y = x 1 / 2");
  assert.equal(latexToTmc("y=x\\left|y\\right|"), "y = x abs(y)");
});

test("adjacent letters are separate variables, except in subscripts and names", () => {
  assert.equal(latexToTmc("B\\left(P_{10},t\\right)=\\left(1-t\\right)P_{10}+tP_{11}"), "B(P_10, t) = (1 - t)P_10 + t P_11");
  assert.equal(latexToTmc("a_{nim}=1"), "a_nim = 1");
  assert.equal(latexToTmc("\\frac{m}{1.2a}"), "m / (1.2a)");
});
