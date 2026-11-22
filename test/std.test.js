// The built-in libraries (import "std/ui"): bundled up to date, and every definition usable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";
import { STD } from "../src/std/index.js";

test("src/std/index.js matches library/std (run npm run build:std after editing it)", () => {
  const files = readdirSync("library/std").filter((f) => f.endsWith(".tmcpp")).sort();
  assert.deepEqual(Object.keys(STD).sort(), files.map((f) => `std/${f.replace(/\.tmcpp$/, "")}`));
  for (const f of files) assert.equal(STD[`std/${f.replace(/\.tmcpp$/, "")}`], readFileSync(`library/std/${f}`, "utf8").replace(/\r\n/g, "\n"), f);
});

/** A placeholder argument from a parameter's name. */
function arg(param, i) {
  const p = param.replace(/^abstract\s+/, "").trim();
  if (/text|title|label|caption/i.test(p)) return '"T"';
  if (/^action$/i.test(p)) return "n -> n + 1";
  if (/^v$/i.test(p)) return "n";
  if (/^([A-Z]|[A-Z]\w*C|center|tip|tail|origin|pos|at|corner)$/.test(p)) return `(${i + 1}, 1)`;
  return "1";
}

for (const [id, src] of Object.entries(STD)) {
  test(`${id}: imports cleanly, and every definition compiles and parses when used`, () => {
    assert.deepEqual(compile(`import "${id}"`).errors, [], "as a library");
    const use = [`import "${id}"`, "n = 0"];
    [...src.matchAll(/^component\s+(\w+)\s*\(([^)]*)\)/gm)].forEach(([, name, params], i) => {
      const req = params.split(",").map((p) => p.trim()).filter((p) => p && !p.includes("="));
      use.push(`new ${name}(${req.map(arg).join(", ")}) as c${i}`);
    });
    [...src.matchAll(/^class\s+([\w-]+)/gm)].forEach(([, c], i) => use.push(`(${i}, -5) .${c}`));
    [...src.matchAll(/^color\s+([\w-]+)/gm)].forEach(([, c], i) => use.push(`(${i}, -6) #${c}`));
    [...src.matchAll(/^([A-Za-z]\w*)\(([^)]*)\)\s*=/gm)].forEach(([, f, a], i) => use.push(`u${i} = ${f}(${a.split(",").map(() => "0.5").join(", ")})`));
    const r = compile(use.join("\n"), { watermark: false });
    assert.deepEqual(r.errors.map((e) => `${use[e.line - 1]}: ${e.message}`), []);
    const errors = textToRaw(buildConfig({}), r.tmc)[0].diagnostics.filter((d) => d.severity === "error");
    assert.deepEqual(errors.map((d) => d.message), []);
  });
}
