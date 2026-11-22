import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";
import { sciNotation } from "../src/implicit.js";
import { latexToTmc } from "../src/latex.js";

const latexOf = (src) => {
  const r = compile(src, { watermark: false, defaultSettings: {} });
  assert.deepEqual(r.errors, []);
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), r.tmc);
  assert.deepEqual(diagnostics, []);
  return state.expressions.list[0];
};

test("glued e or E with an integer exponent is scientific notation", () => {
  assert.equal(sciNotation("5e-3"), "0.005");
  assert.equal(sciNotation("1.5E8"), "150000000");
  assert.equal(sciNotation("4.2e-7"), "0.00000042");
  assert.equal(sciNotation("12.5e-1"), "1.25");
  assert.equal(sciNotation("1e13"), "10^13");
  assert.equal(sciNotation("2.5e-13"), "2.5 * 10^(-13)");
  assert.equal(sciNotation("x/2.5e-13"), "x/(2.5 * 10^(-13))");
});

test("Euler's e, names and strings are left alone", () => {
  for (const s of ["2e", "3 e - 3", "e^x", "2.5e^x", "x1e5", "e2", 'label "3e-3 m"', "a_1e3"]) assert.equal(sciNotation(s), s);
  assert.equal(latexOf("b = 2e").latex, "b=2\\cdot e");
  assert.equal(latexOf("d = 3 e - 3").latex, "d=3\\cdot e-3");
});

test("in math, slider bounds and steps", () => {
  const k = latexOf("k = 5e-3 [0 : 1e-2 : 1e-4]");
  assert.equal(k.latex, "k=0.005");
  assert.deepEqual([k.slider.min, k.slider.max, k.slider.step], ["0", "0.01", "0.0001"]);
  assert.equal(latexOf("q = -4.2e-3 x").latex, "q=-0.0042\\cdot x");
  assert.equal(latexOf("L = [1...3e2]").latex, "L=\\left[1...300\\right]");
});

test("From graph: 10 powers come back as e notation, and Euler's e keeps a gap", () => {
  assert.equal(latexToTmc("3\\cdot10^{-13}"), "3e-13");
  assert.equal(latexToTmc("2.5\\times10^{14}"), "2.5e14");
  assert.equal(latexToTmc("2e-1"), "2e - 1");
  assert.equal(latexToTmc("2e1"), "2 e1");
  assert.equal(latexToTmc("x^{2}\\cdot10^{3}"), "x^2 * 10^3"); // not a plain number times a power of 10
});
