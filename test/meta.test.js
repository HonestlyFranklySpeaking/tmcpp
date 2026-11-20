import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../src/compile.js";
import { assignIds, buildMeta, readMeta, metaItem, styleHash, graphHash, META_ID } from "../src/meta.js";

const SRC = `
class curve { #c74440 dashed }
"A note"                        // about the note
folder "F" collapsed {
  // the slider
  a = 1  [0 : 5]
  y = a x  .curve width 4       // main curve
}
table {
  x1 = [1, 2]
  y1 = [3, 4]  . drag xy
}
`;

function build(src = SRC) {
  const r = compile(src, { defaultSettings: {} });
  assert.deepEqual(r.errors, []);
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), r.tmc);
  assert.deepEqual(diagnostics, []);
  return { r, state };
}

test("compile records one item per graph item, in order", () => {
  const { r } = build();
  assert.deepEqual(r.items.map((i) => i.kind), ["note", "folder", "expr", "expr", "table"]);
  assert.deepEqual(r.items[4].columns.map((c) => c.kind), ["expr", "expr"]);
  assert.deepEqual(r.items[3].tags, ["curve"]);
  assert.equal(r.items[3].tail, ".curve width 4");
  assert.equal(r.items[2].tail, "[0 : 5]");
  assert.deepEqual(r.items[0].comments, ["about the note"]);
  assert.deepEqual(r.items[2].comments, ["the slider"]);
});

test("assignIds gives stable ids and fixes folder links", () => {
  const { r, state } = build();
  assert.ok(assignIds(state, r.items));
  const list = state.expressions.list;
  assert.deepEqual(list.map((e) => e.id), ["t1", "t2", "t3", "t4", "t5"]);
  assert.equal(list[2].folderId, "t2");
  assert.equal(list[3].folderId, "t2");
  assert.deepEqual(list[4].columns.map((c) => c.id), ["t5.1", "t5.2"]);
});

test("assignIds refuses lists that don't line up", () => {
  const { r, state } = build();
  assert.equal(assignIds(state, r.items.slice(1)), null);
  assert.equal(state.expressions.list[0].id === "t1", false);
});

test("metadata note round-trips and records classes, tags, tails, comments", () => {
  const { r, state } = build();
  assignIds(state, r.items);
  const meta = buildMeta(r, state.expressions.list);
  assert.equal(meta.classes.curve, "#c74440 dashed");
  assert.deepEqual(meta.exprs.t4.tags, ["curve"]);
  assert.equal(meta.exprs.t4.tail, ".curve width 4");
  assert.deepEqual(meta.exprs.t4.comments, ["main curve"]);
  assert.equal(meta.exprs["t5.2"].tail, ". drag xy");
  const list = [metaItem(meta), ...state.expressions.list];
  const found = readMeta(list);
  assert.equal(found.item.id, META_ID);
  assert.equal(found.item.secret, true);
  assert.deepEqual(found.meta, meta);
});

test("style hash ignores content and play state, catches restyling", () => {
  const { state } = build();
  const e = structuredClone(state.expressions.list[3]);
  const h = styleHash(e);
  assert.equal(styleHash({ ...e, latex: "y=2x", id: "zz" }), h);
  assert.equal(styleHash({ ...e, slider: { ...e.slider, isPlaying: true } }), h);
  assert.notEqual(styleHash({ ...e, color: "#000000" }), h);
  assert.notEqual(styleHash({ ...e, lineWidth: "9" }), h);
});

test("graph hash ignores the metadata note but sees content edits", () => {
  const { state } = build();
  const list = state.expressions.list;
  const h = graphHash(list);
  assert.equal(graphHash([{ id: META_ID, type: "text", text: "x" }, ...list]), h);
  const edited = structuredClone(list);
  edited[2].latex = "a=3";
  assert.notEqual(graphHash(edited), h);
});

test("readMeta reports a broken note instead of throwing", () => {
  const r = readMeta([{ id: "m", type: "text", text: "TMC++ meta v1\n{oops" }]);
  assert.equal(r.meta, null);
  assert.match(r.error, /not valid JSON/);
  assert.equal(readMeta([{ id: "x", type: "text", text: "hello" }]), null);
});
