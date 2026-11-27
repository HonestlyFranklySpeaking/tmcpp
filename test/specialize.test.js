// A component whose for loop counts over a parameter gets a copy per value (src/specialize.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.js";
import { buildConfig, textToRaw } from "../src/tmc-core.js";
import { assignIds, buildMeta, metaItem } from "../src/meta.js";
import { decompile } from "../src/decompile.js";
import { latexToTmc } from "../src/latex.js";

const opts = { defaultSettings: {}, watermark: false };
const ok = (src) => {
  const r = compile(src, opts);
  assert.deepEqual(r.errors, [], src);
  assert.deepEqual(textToRaw(buildConfig({}), r.tmc)[0].diagnostics.map((d) => d.message), [], r.tmc);
  return r.tmc.split("\n").filter((l) => l && !l.startsWith("settings"));
};
const errs = (src) => compile(src, opts).errors.map((e) => e.message);

const ROW = "component Row(n, h = 0) {\n  for i in [1...n] {\n    P_{i} = (i, h) . point 6\n  }\n}\n";
const GRID = "component Grid(w, rows) {\n  for j in [1...rows] {\n    new Row(w, h = j) as row_{j}\n  }\n}\n";

test("a loop counted by a parameter is written out per instance", () => {
  const t = ok(ROW + "new Row(3) as r\nnew Row(2, h = 1) as s\nnew Row(n = 1 + 1) as u");
  assert.equal(t.filter((l) => /^P_\dr = /.test(l)).length, 3);
  assert.equal(t.filter((l) => /^P_\ds = /.test(l)).length, 2);
  assert.ok(t.includes("P_1s = (1, 1) @{ points: @{ size: 6 } };"));
  assert.equal(t.filter((l) => /^P_\du = /.test(l)).length, 2);
});

test("nested: a parameter passed on to an inner component's loop, with members reaching in", () => {
  const t = ok(ROW + GRID + "new Grid(2 + 1, 2) as g\ny = g.row_2.P_3.x");
  assert.equal(t.filter((l) => /^P_\dgrow\d = /.test(l)).length, 6);
  assert.ok(t.includes("y = P_3grow2.x;"));
});

test("a count that isn't known when compiling is one clear error, naming the component as written", () => {
  const e = errs("k = 3\n" + ROW + "new Row(k) as a");
  assert.equal(e.length, 1);
  assert.match(e[0], /^Row uses 'n' to count a for loop, so 'n' has to be a number here/);
  assert.match(errs(ROW + "new Row(m) for m = [1, 2] as c")[0], /list instance/);
  assert.match(errs("component R(abstract n = 2) {\n  for i in [1...n] {\n    Q_{i} = (i, 1)\n  }\n}\nnew R() as b")[0], /abstract parameter/);
  assert.match(errs(ROW + GRID + "new Grid(3, 2) as g\ny = g.row_5.P_1.x")[0], /^g \(a Grid\) has no member 'row_5'/);
});

test("ranges take arithmetic on numbers: [1...2*3]", () => {
  assert.equal(ok("for i in [1...2*3] {\n  a_{i} = i\n}").length, 6);
});

test("From graph gives the new lines back as written", () => {
  const src = ROW + "\n" + GRID + "\nnew Grid(2 + 1, 2) as g\ny = g.row_2.P_3.x\n";
  const r = compile(src, {});
  assert.deepEqual(r.errors, []);
  const [, state] = textToRaw(buildConfig({}), r.tmc);
  assert.ok(assignIds(state, r.items));
  state.expressions.list.unshift(metaItem(buildMeta(r, state.expressions.list, state.expressions.ticker)));
  const { source, warnings } = decompile(state, { latexToText: latexToTmc });
  assert.deepEqual(warnings, []);
  assert.match(source, /^new Grid\(2 \+ 1, 2\) as g$/m);
  assert.doesNotMatch(source, /Row_|Grid_/);
  const strip = (t) => t.split("\n").filter((l) => !l.startsWith("settings")).join("\n");
  assert.equal(strip(compile(source, {}).tmc), strip(r.tmc));
});
