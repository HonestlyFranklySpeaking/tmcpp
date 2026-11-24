// tmcpp check --runtime: load the compiled graph in real Desmos and report what Desmos itself
// rejects (wrong argument counts, constants as parameters, undefined results the parser can't
// see), mapped back to TMC++ lines, with the slider values it was checked at.
import { buildConfig, textToRaw } from "./tmc-core.js";
import { restoreGreek } from "./greek.js";
import { compileFile } from "./load-node.js";
import { assignIds } from "./meta.js";
import { analyzeGraph } from "./preview-page.js";
import { withDesmos } from "./preview.js";

const DRAWS_POINTS = new Set(["POINT", "POINT_LIST"]);

/**
 * Returns { ok, errors: [{ line, where, message, math }], warnings: [...], sliders, missing } or,
 * when it doesn't get as far as Desmos, { ok: false, stage: "compile" | "parse", errors }.
 */
export async function runtimeCheck(source, { path = "", isTmc = /\.tmc$/i.test(path), at = {}, show = false } = {}) {
  let tmc = source, r = null;
  if (!isTmc) {
    r = await compileFile(source, path);
    if (r.errors.length) return { ok: false, stage: "compile", errors: r.errors, warnings: r.warnings };
    tmc = r.tmc;
  }
  const [{ diagnostics }, state] = textToRaw(buildConfig({}), tmc);
  const bad = diagnostics.filter((d) => d.severity === "error");
  if (bad.length || !state) return { ok: false, stage: "parse", errors: bad.map((d) => ({ line: tmc.slice(0, d.from).split("\n").length, message: d.message, where: "TMC" })) };
  restoreGreek(state);
  for (const e of state.expressions.list) if (e.slider) e.slider.isPlaying = false;
  if (state.expressions.ticker) state.expressions.ticker.playing = false;

  // Stable ids (t1, t2, ...) tie each Desmos item to the TMC++ line it came from.
  const origin = new Map();
  const pairs = r ? assignIds(state, r.items) : null;
  for (const [e, it] of pairs ?? []) {
    origin.set(e.id, { line: it.line, where: it.block?.startsWith("lib:") ? `library ${it.block.slice(4)}` : it.block?.startsWith("i:") ? `instance ${it.block.slice(2)}` : null, styled: !!(it.tail ?? "").trim() || !!it.tags?.length });
  }

  const res = await withDesmos((page) => page.evaluate(analyzeGraph, { state, at }), { show });
  const errors = [], warnings = [];
  // Which names other lines use. Desmos doesn't list dependencies in its public API, so look
  // for the name as a whole token in the other lines' LaTeX.
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const usedElsewhere = (it) => {
    const re = new RegExp(`(^|[^A-Za-z\\\\_{])${esc(it.name)}(?![A-Za-z0-9_{])`);
    return res.items.some((o) => o !== it && re.test(o.latex.replace(/^[^=]*=/, (h) => (o.name && h.startsWith(o.name) ? "" : h))));
  };
  for (const it of res.items) {
    const o = origin.get(it.id) ?? {};
    const at = { line: o.line ?? 0, where: o.where ?? null, math: it.latex };
    if (it.error) errors.push({ ...at, message: it.error });
    // A helper point (list) that other lines use, drawn with no style of its own: usually a
    // forgotten `. hidden` (or `let`), the classic stray layer of dots.
    else if (!it.hidden && it.name && DRAWS_POINTS.has(it.type) && o.styled === false && usedElsewhere(it)) {
      warnings.push({ ...at, message: `${it.name} is drawn as ${it.type === "POINT" ? "a point" : "points"} and also used by other lines; if it's only a helper, add '. hidden' or write 'let ${it.name} = ...'` });
    }
  }
  if (!res.settled) warnings.push({ line: 0, where: null, message: "Desmos was still evaluating after 20s; results may be incomplete" });
  for (const m of res.missing) warnings.push({ line: 0, where: null, message: `no slider named '${m}'` });
  return { ok: errors.length === 0, stage: "runtime", errors, warnings, sliders: res.sliders, missing: res.missing };
}
