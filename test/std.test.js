// The built-in libraries (import "std/ui"): bundled up to date, and every definition usable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildConfig, textToRaw } from "../src/tmc-core.js";
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

/** A placeholder for a macro argument: a style tail where the name says so, else as for components. */
const macroArg = (param, i) => (/^(look|tail|style|tails?)$/i.test(param.trim()) ? "#red" : arg(param, i));

/** A file that imports `id` (whose source is `src`) and uses every definition in it once. */
function usesOf(id, src) {
  const use = [`import "${id}"`, "n = 0"];
  [...src.matchAll(/^component\s+(\w+)\s*\(([^)]*)\)/gm)].forEach(([, name, params], i) => {
    const req = params.split(",").map((p) => p.trim()).filter((p) => p && !p.includes("="));
    use.push(`new ${name}(${req.map(arg).join(", ")}) as c${i}`);
  });
  // A macro is used on a line of its own; its lines are only checked once they're written out.
  [...src.matchAll(/^macro\s+(\w+)\s*\(([^)]*)\)/gm)].forEach(([, name, params]) => {
    use.push(`${name}(${params.split(",").map((p) => p.trim()).filter(Boolean).map(macroArg).join(", ")})`);
  });
  [...src.matchAll(/^class\s+([\w-]+)/gm)].forEach(([, c], i) => use.push(`(${i}, -5) .${c}`));
  [...src.matchAll(/^color\s+([\w-]+)/gm)].forEach(([, c], i) => use.push(`(${i}, -6) #${c}`));
  [...src.matchAll(/^([A-Za-z]\w*)\(([^)]*)\)\s*=/gm)].forEach(([, f, a], i) => use.push(`u${i} = ${f}(${a.split(",").map(() => "0.5").join(", ")})`));
  return use;
}

/** Compile the uses and parse the result: every error, from the compiler or Text Mode's parser. */
function problems(use, options = {}) {
  const r = compile(use.join("\n"), { watermark: false, ...options });
  const compileErrors = r.errors.map((e) => `${use[e.line - 1]}: ${e.message}`);
  if (compileErrors.length) return compileErrors;
  return textToRaw(buildConfig({}), r.tmc)[0].diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
}

for (const [id, src] of Object.entries(STD)) {
  test(`${id}: imports cleanly, and every definition compiles and parses when used`, () => {
    assert.deepEqual(compile(`import "${id}"`).errors, [], "as a library");
    assert.deepEqual(problems(usesOf(id, src)), []);
  });
}

test("the std check writes out macros too, and catches a broken one", () => {
  const good = "glowAlpha = 0.3\nmacro Glow(shape, look) {\n  shape  look fill glowAlpha opacity 0\n}";
  const use = usesOf("glows", good);
  assert.ok(use.includes("Glow(1, #red)"), use.join("\n"));
  assert.deepEqual(problems(use, { libraries: { glows: good } }), []);
  // A macro whose lines don't compile once written out fails the check.
  const bad = "macro Bad(a) {\n  y = a  . dashd\n}";
  assert.notDeepEqual(problems(usesOf("bad", bad), { libraries: { bad } }), []);
});
