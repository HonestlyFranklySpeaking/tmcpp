// End-to-end: everything we emit must parse with DesModder's real Text Mode parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildConfig, textToRaw } from "../src/tmc-core.js";
import { compile } from "../src/compile.js";

const cfg = buildConfig({});
const parse = (tmc) => textToRaw(cfg, tmc)[0].diagnostics.map((d) => d.message);

// Libraries the examples import, by the id they resolve to.
const exampleLibs = Object.fromEntries(readdirSync("examples/lib").map((f) => [`examples/lib/${f}`, readFileSync(`examples/lib/${f}`, "utf8")]));
for (const f of readdirSync("examples").filter((f) => f.endsWith(".tmcpp"))) {
  test(`examples/${f} parses in TMC`, () => {
    const r = compile(readFileSync(`examples/${f}`, "utf8"), { libraries: exampleLibs, from: `examples/${f}` });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(parse(r.tmc), []);
  });
}

test("blocks and items parse in TMC", () => {
  const src = `
settings no-grid lock degrees
folder "Data" {
  table pinned {
    X = [1, 2, 3]
    Y = [4, 5, 6] . drag xy open
  }
}
ticker a -> a + 1 . play 500ms
a = 0
image "pic" @{ width: 5, height: 5, center: (0, 0) }
(1, 2) . cross point-opacity 0.5 secret
1 + 7/2 . fraction
`;
  const r = compile(src);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(parse(r.tmc), []);
});
