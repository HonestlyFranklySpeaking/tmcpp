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

// ---------- the note ----------

/**
 * Build the metadata object from a compile result and the state as Desmos holds it
 * (read back with Calc.getState() after setState, so hashes match what M4 will see).
 */
export function buildMeta(compiled, list) {
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
    if (it.tags?.length) entry.tags = it.tags;
    if (it.tail) entry.tail = it.tail;
    if (it.comments?.length) entry.comments = it.comments;
    entry.sh = styleHash(e);
    exprs[id] = entry;
  };
  compiled.items.forEach((it, i) => {
    const id = `t${i + 1}`;
    visit(it, id);
    (it.columns ?? []).forEach((c, j) => visit(c, `${id}.${j + 1}`));
  });
  const classes = {};
  for (const [name, def] of compiled.classes) classes[name] = def.tokens.join(" ");
  return { v: 1, classes, exprs, graph: graphHash(list) };
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
    return meta && meta.v === 1 ? { item, meta } : { item, meta: null, error: `unsupported version ${meta?.v}` };
  } catch (e) {
    return { item, meta: null, error: `metadata note is not valid JSON (${e.message})` };
  }
}
