// M21 live editing: which compiles can be patched in place, and what a reload keeps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.js";
import { buildConfig, textToRaw } from "../src/tmc-core.js";
import { restoreGreek } from "../src/greek.js";
import { assignIds } from "../src/meta.js";
import { planUpdate, keepUserState, snapshot } from "../src/live.js";

const state = (src) => {
  const r = compile(src, { watermark: false });
  const [, st] = textToRaw(buildConfig({}), r.tmc);
  restoreGreek(st);
  assignIds(st, r.items);
  return st;
};
const plan = (a, b) => planUpdate(snapshot(state(a)), snapshot(state(b)));
const BASE = 'a = 2 [0 : 5]\ny = a sin(x) #red dashed\n(1, 2) #blue point 10 label "P"\nfolder "F" {\n  y = x\n}';

test("live: math and style edits on existing lines are patched in place", () => {
  assert.deepEqual(plan(BASE, BASE), { kind: "none" });
  const p = plan(BASE, BASE.replace("a sin(x) #red dashed", "a cos(x) #green dotted width 4"));
  assert.equal(p.kind, "patch");
  assert.equal(p.updates.length, 1);
  assert.match(p.updates[0].latex, /cos/);
  assert.equal(p.updates[0].lineStyle, "DOTTED");
  assert.equal(plan(BASE, BASE.replace('label "P"', 'label "Q" below')).kind, "patch");
  const s = plan(BASE, BASE.replace("[0 : 5]", "[0 : 9 : 0.5]"));
  assert.deepEqual(s.updates[0].sliderBounds, { min: "0", max: "9", step: "0.5" });
});

test("live: structural changes reload", () => {
  assert.equal(plan(BASE, BASE + "\ny = 2").kind, "reload");
  assert.equal(plan(BASE, BASE.replace('folder "F"', 'folder "G"')).kind, "reload");
  assert.equal(plan(BASE, "settings x [-5 : 5]\n" + BASE).kind, "reload");
  assert.equal(plan(BASE, BASE.replace("[0 : 5]", "[0 : 5] . play")).kind, "reload");
});

test("live: a reload keeps dragged sliders and the viewport unless the source changed them", () => {
  const prev = snapshot(state(BASE));
  const current = state(BASE);
  current.expressions.list.find((e) => e.latex === "a=2").latex = "a=4.3";   // dragged in Desmos
  current.graph.viewport = { xmin: -3, xmax: 3, ymin: -2, ymax: 2 };       // panned
  const kept = keepUserState(state(BASE + "\ny = 2"), current, prev);
  assert.ok(kept.expressions.list.some((e) => e.latex === "a=4.3"));
  assert.deepEqual(kept.graph.viewport, { xmin: -3, xmax: 3, ymin: -2, ymax: 2 });
  const changed = keepUserState(state(BASE.replace("a = 2", "a = 1") + "\ny = 2"), current, prev);
  assert.ok(changed.expressions.list.some((e) => e.latex === "a=1"));     // the source wins when it changed
});
