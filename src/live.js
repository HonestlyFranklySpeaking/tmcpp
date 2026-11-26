// Live editing (M21): apply a new compile to the graph by changing only what changed, so sliders
// you've dragged, the viewport you've panned to and Desmos's undo history survive typing.
//
// Items are matched by their stable ids (t1, t2... in emission order). When the list has the same
// shape as last time and every change is one Desmos's setExpression can make, the changed items are
// patched in place. Anything else (a line added or removed, a folder or ticker change, a setting)
// reloads the whole state, still keeping slider values and the viewport the source didn't change.

/** State keys Calc.setExpression applies reliably (checked on desmos.com). */
export const PATCHABLE = new Set([
  "latex", "color", "hidden", "secret", "lines", "lineStyle", "lineWidth", "lineOpacity", "fill", "fillOpacity",
  "points", "pointStyle", "pointSize", "movablePointSize", "pointOpacity", "dragMode",
  "label", "showLabel", "labelSize", "labelOrientation", "labelAngle", "suppressTextOutline",
  "interactiveLabel", "editableLabelMode", "parametricDomain", "polarDomain",
]);

/** Equal as JSON, whatever the key order. */
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const sliderName = (e) => (e?.type === "expression" && typeof e.latex === "string" && /^([^=]+)=/.exec(e.latex)?.[1]) || null;

/**
 * prev, next: { graph, ticker, list } from two compiles (list without the metadata note).
 * Returns { kind: "none" } | { kind: "patch", updates } | { kind: "reload", reason }.
 */
export function planUpdate(prev, next) {
  if (!prev) return { kind: "reload", reason: "first compile" };
  if (!same(prev.graph, next.graph)) return { kind: "reload", reason: "settings changed" };
  if (!same(prev.ticker, next.ticker)) return { kind: "reload", reason: "the ticker changed" };
  if (prev.list.length !== next.list.length) return { kind: "reload", reason: "lines were added or removed" };
  const updates = [];
  for (let i = 0; i < next.list.length; i++) {
    const a = prev.list[i], b = next.list[i];
    if (a.id !== b.id || a.type !== b.type || (a.folderId ?? null) !== (b.folderId ?? null)) return { kind: "reload", reason: "lines moved" };
    if (same(a, b)) continue;
    if (b.type !== "expression") return { kind: "reload", reason: `a ${b.type} changed` };
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const patch = { id: b.id, type: "expression" };
    for (const k of keys) {
      if (same(a[k], b[k])) continue;
      if (k === "slider") {
        // Bounds can be patched; playback settings need a reload.
        const { min, max, step, ...restB } = b.slider ?? {}, { min: _1, max: _2, step: _3, ...restA } = a.slider ?? {};
        if (!same(restA, restB) || !b.slider) return { kind: "reload", reason: "a slider's playback changed" };
        patch.sliderBounds = { min: min ?? "", max: max ?? "", step: step ?? "" };
        continue;
      }
      if (!PATCHABLE.has(k) || !(k in b)) return { kind: "reload", reason: `'${k}' changed on a line` };
      patch[k] = b[k];
    }
    updates.push(patch);
  }
  return updates.length ? { kind: "patch", updates } : { kind: "none" };
}

/**
 * Before a full reload: keep what the user changed in Desmos that the source didn't. A slider keeps
 * its dragged value when its line compiles the same as last time; the viewport stays where it was
 * when the settings didn't change. Mutates and returns next (a full graph state).
 */
export function keepUserState(next, current, prev) {
  if (prev && current) {
    if (same(prev.graph, next.graph) && current.graph?.viewport) next.graph = { ...next.graph, viewport: current.graph.viewport };
    const prevByName = new Map(prev.list.map((e) => [sliderName(e), e]).filter(([n]) => n));
    const nowByName = new Map((current.expressions?.list ?? []).map((e) => [sliderName(e), e]).filter(([n]) => n));
    for (const e of next.expressions.list) {
      const n = sliderName(e);
      if (!n || !e.slider) continue;
      const was = prevByName.get(n), now = nowByName.get(n);
      if (was && now && was.latex === e.latex && now.latex !== e.latex) e.latex = now.latex;
    }
  }
  return next;
}

/** The part of a compiled state live editing compares: settings, ticker, items without the note. */
export function snapshot(state, metaId) {
  const { viewport, ...graph } = state.graph ?? {};
  return JSON.parse(JSON.stringify({ graph: { ...graph, viewport }, ticker: state.expressions.ticker ?? null, list: state.expressions.list.filter((e) => e.id !== metaId) }));
}
