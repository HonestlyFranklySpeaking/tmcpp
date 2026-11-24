// TMC++ metadata note: the graph remembers what Desmos can't (classes, tags, tails, comments)
// so TMC++ can be rebuilt from the graph later (M4). See the spec, "Hidden metadata note".

export const META_HEADER = "TMC++ meta v1";
export const META_ID = "tmcpp-meta";

// ---------- hashing ----------

/** FNV-1a, 32-bit, as 8 hex chars. Only detects changes; not cryptographic. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** JSON with sorted keys, so equal objects hash equally. */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

// Fields that change without the user restyling anything.
const NOT_STYLE = new Set(["id", "latex", "folderId", "type", "text", "title", "columns"]);
const VOLATILE_SLIDER = new Set(["isPlaying", "playDirection"]);

/** The style part of a Desmos state item: everything except content, identity and play state. */
export function styleOf(item) {
  const out = {};
  for (const [k, v] of Object.entries(item)) {
    if (NOT_STYLE.has(k)) continue;
    if (k === "slider" && v && typeof v === "object") {
      out.slider = Object.fromEntries(Object.entries(v).filter(([sk]) => !VOLATILE_SLIDER.has(sk)));
    } else out[k] = v;
  }
  return out;
}

export const styleHash = (item) => fnv1a(canonical(styleOf(item)));

/** Hash of everything the user could change, slider play state aside. */
export function graphHash(list) {
  return fnv1a(canonical(list.filter((e) => e.id !== META_ID).map((e) => {
    const s = styleOf(e);
    return { id: e.id, latex: e.latex, text: e.text, title: e.title, folderId: e.folderId, columns: e.columns, s };
  })));
}

// ---------- ids ----------

/**
 * Give every state item a stable TMC++ id (t1, t2, ... in source order; table columns t5.1, t5.2)
 * and fix up folder links. `items` is compile()'s item list, in the same order as state.expressions.list.
 * Returns the matched [stateItem, compiledItem] pairs, or null if the two lists don't line up.
 */
export function assignIds(state, items) {
  const list = state.expressions.list;
  const TYPE = { expr: "expression", note: "text", folder: "folder", table: "table", image: "image" };
  // Validate first, so a mismatch leaves the state untouched.
  if (list.length !== items.length || list.some((e, i) => TYPE[items[i].kind] !== e.type)) return null;
  const rename = new Map();
  const pairs = [];
  list.forEach((e, i) => {
    const it = items[i];
    const id = `t${i + 1}`;
    rename.set(e.id, id);
    e.id = id;
    pairs.push([e, it]);
    (e.columns ?? []).forEach((c, j) => {
      c.id = `${id}.${j + 1}`;
      if (it.columns?.[j]) pairs.push([c, it.columns[j]]);
    });
  });
  for (const e of list) if (e.folderId) e.folderId = rename.get(e.folderId) ?? e.folderId;
  return pairs;
}

/** Everything about an item except its id, in a fixed key order: any edit in Desmos changes it. */
export function itemHash(e) {
  const sorted = (v) => Array.isArray(v) ? v.map(sorted)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().filter((k) => k !== "id").map((k) => [k, sorted(v[k])])) : v;
  return fnv1a(JSON.stringify(sorted(e)));
}

// ---------- the note ----------

/**
 * Build the metadata object from a compile result and the state as Desmos holds it
 * (read back with Calc.getState() after setState, so hashes match what M4 will see).
 */
export function buildMeta(compiled, list, ticker = null) {
  const byId = new Map();
  for (const e of list) {
    byId.set(e.id, e);
    for (const c of e.columns ?? []) byId.set(c.id, c);
  }
  const exprs = {};
  const visit = (it, id) => {
    const e = byId.get(id);
    if (!e) return;
    const entry = {};
    // Tail and classes as written; the compiled ones (internal class names after an import) for checking.
    const tags = it.writtenTags ?? it.tags;
    if (tags?.length) entry.tags = tags;
    if (it.writtenTags && it.tags?.length) entry.tagsc = it.tags;
    const tail = it.writtenTail ?? it.tail;
    if (tail || (it.writtenTail === "" && it.tail)) entry.tail = tail; // "": written bare (let P = ...)
    if (it.writtenTail !== undefined && it.tail) entry.tc = it.tail;
    if (it.comments?.length) entry.comments = it.comments;
    if (it.math !== undefined && typeof e.latex === "string") {
      entry.m = it.written ?? it.math;   // the math exactly as written
      if (it.written !== undefined) entry.mc = it.math; // ...and as compiled, for checking styles
      entry.lh = fnv1a(e.latex);  // ...valid while Desmos's LaTeX still hashes to this
    }
    entry.sh = styleHash(e);
    if (it.block) {
      entry.b = it.block;        // the source block it came from (instance, if block, library)
      entry.ih = itemHash(e);    // ...given back as written while every item of it still hashes the same
    }
    exprs[id] = entry;
  };
  compiled.items.forEach((it, i) => {
    const id = `t${i + 1}`;
    visit(it, id);
    (it.columns ?? []).forEach((c, j) => visit(c, `${id}.${j + 1}`));
  });
  const classes = {};
  for (const [name, def] of compiled.classes) classes[name] = def.tokens.join(" ");
  const colors = {};
  for (const [name, def] of compiled.colors ?? []) colors[name] = def.hex;
  const meta = { v: 2, classes, exprs, graph: graphHash(list) };
  // M8: blocks given back as written, and what From graph puts at the top of the file.
  const rt = compiled.roundTrip;
  if (rt) {
    if (rt.components.length) meta.components = rt.components;
    if (rt.imports.length) meta.imports = rt.imports;
    if (Object.keys(rt.blocks).length) meta.blocks = rt.blocks;
  }
  if (compiled.names && Object.keys(compiled.names).length) meta.names = compiled.names;
  const libClasses = [...compiled.classes].filter(([, d]) => d.lib).map(([n]) => n);
  const libColors = [...(compiled.colors ?? [])].filter(([, d]) => d.lib).map(([n]) => n);
  if (libClasses.length) meta.libClasses = libClasses;
  if (libColors.length) meta.libColors = libColors;
  if (Object.keys(colors).length) meta.colors = colors;
  if (compiled.settingsSource?.length) meta.settings = compiled.settingsSource;
  if (compiled.tickerSource && ticker?.handlerLatex) {
    meta.ticker = { src: compiled.tickerSource, lh: fnv1a(`${ticker.handlerLatex}|${ticker.minStepLatex ?? ""}`) };
  }
  return meta;
}

export const metaText = (meta) => `${META_HEADER}\n${JSON.stringify(meta)}`;

/** The metadata note as a Desmos state item. */
export const metaItem = (meta) => ({ id: META_ID, type: "text", secret: true, text: metaText(meta) });

/** Find and parse the metadata note in a state list. Returns { item, meta } or null. */
export function readMeta(list) {
  const item = list.find((e) => e.type === "text" && typeof e.text === "string" && e.text.startsWith(META_HEADER));
  if (!item) return null;
  try {
    const meta = JSON.parse(item.text.slice(META_HEADER.length).trim());
    return meta && (meta.v === 1 || meta.v === 2) ? { item, meta } : { item, meta: null, error: `unsupported version ${meta?.v}` };
  } catch (e) {
    return { item, meta: null, error: `metadata note is not valid JSON (${e.message})` };
  }
}
