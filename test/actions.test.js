import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";

function tmcOf(src) {
  const r = compile(src, { watermark: false, defaultSettings: {} });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(textToRaw(buildConfig({}), r.tmc)[0].diagnostics.map((d) => d.message), []);
  return { ...r, tmc: r.tmc };
}
const head = "score = 0\nlives = 3\nmode = 0\non = 0\nL = [0, 0, 0]\n";

test("++, --, compound assignment, wrap-around and set", () => {
  const { tmc } = tmcOf(head + "P = (0, 0) click(score++, lives--, mode++ % 3)\nQ = (1, 0) click(score += 10 * mode, on = 1)\nR = (2, 0) click(score *= 2, lives /= 2, mode ^= 2, score -= 1 + lives)");
  assert.match(tmc, /onClick: \(s_core -> s_core \+ 1, l_ives -> l_ives - 1, m_ode -> mod\(m_ode \+ 1, 3\)\)/);
  assert.match(tmc, /onClick: \(s_core -> s_core \+ \(10 \* m_ode\), o_n -> 1\)/);
  assert.match(tmc, /s_core -> s_core \* 2, l_ives -> l_ives \/ 2, m_ode -> m_ode \^ 2, s_core -> s_core - \(1 \+ l_ives\)/);
});

test("toggle, list elements (merged into one update), push and pop", () => {
  const { tmc } = tmcOf(head + "P = (0, 0) click(toggle(on), L[2] = 5, L[1] += 2, L[3]++)\nQ = (1, 0) click(L.push(score))\nR = (2, 0) click(toggle(L[1]))\nstep = (L.pop())");
  assert.match(tmc, /o_n -> 1 - o_n, L -> \[\{k_upd = 2: 5, k_upd = 1: L\[k_upd\] \+ 2, k_upd = 3: L\[k_upd\] \+ 1, L\[k_upd\]\} for k_upd = \[1\.\.\.length\(L\)\]\]/);
  assert.match(tmc, /onClick: L -> join\(L, s_core\) \}/);
  assert.match(tmc, /onClick: L -> \[\{k_upd = 1: 1 - L\[k_upd\], L\[k_upd\]\}/);
  assert.match(tmc, /s_tep = L -> L\[1\.\.\.length\(L\) - 1\]/);
});

test("reset() and reset(names) go back to the values as defined", () => {
  const { tmc } = tmcOf(head + "k = 2 [0 : 5]\nrestart = reset()\nP = (0, 0) click(reset(score, lives))\nQ = (1, 0) click(if lives > 1 then lives-- else reset(score, lives))");
  assert.match(tmc, /onClick: \{l_ives > 1: l_ives -> l_ives - 1, \(s_core -> 0, l_ives -> 3\)\}/);
  assert.match(tmc, /r_estart = \(s_core -> 0, l_ives -> 3, m_ode -> 0, o_n -> 0, L -> \[0, 0, 0\], k -> 2, P -> \(0, 0\), Q -> \(1, 0\)\)/); // points too: Start over puts dragged points back
  assert.match(tmc, /onClick: \(s_core -> 0, l_ives -> 3\)/);
  assert.match(compile("x1 = y\nP = (0,0) click(reset(x1))").errors[0].message, /reset: 'x1' isn't defined as a plain value/);
});

test("actions work in the ticker, on their own line, in if branches and in components", () => {
  const { tmc } = tmcOf(head + "ticker score++ . play 1s\nscore ^= 2\nP = (0, 0) click(if on = 1 then score++ else score--)\n" +
    "component Counter(P) {\n  n = 0\n  P . point 9 click(n++, reset(n2))\n  n2 = 5\n}\nnew Counter((6, 0)) as c\nnew Counter((i, 0)) for i = [7...9] as row");
  assert.match(tmc, /ticker s_core -> s_core \+ 1/);
  assert.match(tmc, /^s_core -> s_core \^ 2;$/m);
  assert.match(tmc, /onClick: \{o_n = 1: s_core -> s_core \+ 1, s_core -> s_core - 1\}/);
  assert.match(tmc, /onClick: \(n_c -> n_c \+ 1, n_2c -> 5\)/);
  assert.match(tmc, /n_row -> \[\{k_rowi = index: n_row\[index\] \+ 1/); // a list instance: only the clicked copy
});

test("comparisons and math are left alone; double updates warn", () => {
  const { tmc } = tmcOf(head + "y = {L[2] = 5: 1, 0}\nz = x - -3\nP = (0, 0) click({L[1] = 0: score++, score--})");
  assert.match(tmc, /y = \{L\[2\] = 5: 1, 0\}/);
  assert.match(tmc, /onClick: \{L\[1\] = 0: s_core -> s_core \+ 1, s_core -> s_core - 1\}/);
  const w = compile(head + "P = (0, 0) click(score++, score += 2)").warnings;
  assert.match(w[0].message, /'score' is updated twice in one action/);
});

test("an action passed as a component argument is lowered too", () => {
  const { tmc } = tmcOf('n = 0\ncomponent B(P, act) {\n  P . point 9 click(act)\n}\nnew B((0, 0), n++) as b\nnew B((1, 0), n += 2) as c');
  assert.match(tmc, /onClick: \(n -> n \+ 1\)/);
  assert.match(tmc, /onClick: \(n -> n \+ 2\)/);
});
