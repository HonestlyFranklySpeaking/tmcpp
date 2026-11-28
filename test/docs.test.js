// Every js example in the README and the syntax reference compiles and passes DesModder's parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { checkSource } from "../src/check.js";

const files = ["README.md", ...readdirSync("docs/syntax").map((f) => `docs/syntax/${f}`)];
for (const f of files) {
  test(`docs: the examples in ${f} compile and parse`, async () => {
    const blocks = [...readFileSync(f, "utf8").replace(/\r\n/g, "\n").matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
    for (const [i, b] of blocks.entries()) {
      if (/^import "\.\//m.test(b)) continue; // relative imports point at files next to an example, not the docs
      const r = await checkSource(b, { path: f.replace(/[^/]+$/, "example.tmcpp") });
      const problems = [...r.errors.map((e) => `line ${e.line}: ${e.message}`), ...r.diagnostics.filter((d) => d.severity === "error").map((d) => `TMC line ${d.line}: ${d.message}`)];
      assert.deepEqual(problems, [], `${f}, example ${i + 1}:\n${b}`);
    }
  });
}

test("docs: every page of the syntax reference is linked from its index", () => {
  const index = readFileSync("docs/syntax/README.md", "utf8");
  for (const f of readdirSync("docs/syntax")) if (f !== "README.md") assert.ok(index.includes(`](${f})`), f);
});

// The contents list in docs/syntax/README.md, and every #anchor link in the docs.
import { readFileSync as readDoc, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { contents, headings } from "../tools/syntax-contents.js";

test("docs/syntax/README.md lists every section (run npm run build:docs after adding a heading)", () => {
  const readme = readDoc("docs/syntax/README.md", "utf8").replace(/\r\n/g, "\n");
  const list = readme.slice(readme.indexOf("<!-- contents:start -->") + 23, readme.indexOf("<!-- contents:end -->")).trim();
  assert.equal(list, contents());
});

test("every link to a #heading in the docs lands on one", () => {
  const files = ["README.md", "CONTRIBUTING.md", "vscode/README.md", ...["README", "basics", "logic", "styles", "components", "macros", "libraries", "blocks", "round-trip", "errors"].map((p) => `docs/syntax/${p}.md`)];
  const broken = [];
  for (const file of files) {
    const text = readDoc(file, "utf8");
    for (const [, target, anchor] of text.matchAll(/\]\(([^)#\s]*\.md|)#([^)\s]+)\)/g)) {
      const to = target ? normalize(join(dirname(file), target)) : file;
      if (!existsSync(to)) { broken.push(`${file}: ${target} doesn't exist`); continue; }
      if (!headings(readDoc(to, "utf8")).some((h) => h.anchor === anchor)) broken.push(`${file}: ${target || "(itself)"}#${anchor}`);
    }
  }
  assert.deepEqual(broken, []);
});
