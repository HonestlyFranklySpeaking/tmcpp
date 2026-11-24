// The Library panel (M12). The panel runs in the page, where chrome.storage doesn't exist, so
// saved libraries live behind the storage bridge (bridge.js) and are mirrored here so that
// compiling stays synchronous.
import { compile } from "../../src/compile.js";
import { findImports, isRemote, ghUrl } from "../../src/imports.js";

let seq = 0;
const waiting = new Map();
const listeners = new Set();
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const m = e.data;
  if (m?.tmcpp === "res" && waiting.has(m.seq)) {
    const w = waiting.get(m.seq);
    waiting.delete(m.seq);
    clearTimeout(w.timer);
    m.ok ? w.resolve(m.data) : w.reject(new Error(m.error));
  } else if (m?.tmcpp === "changed") {
    for (const fn of listeners) fn(m.data);
  }
});
export function ask(op, args = {}, ms = op === "fetch" ? 30000 : 8000) {
  return new Promise((resolve, reject) => {
    const n = ++seq;
    const timer = setTimeout(() => {
      waiting.delete(n);
      reject(new Error(`The TMC++ storage bridge didn't answer '${op}' in ${ms / 1000}s; reload the extension and the page`));
    }, ms);
    waiting.set(n, { resolve, reject, timer });
    // The request number travels as `seq`, apart from the arguments, so an argument can't overwrite it.
    window.postMessage({ tmcpp: "req", seq: n, op, args }, location.origin);
  });
}

const NAME = /^[A-Za-z][\w-]*(\/[A-Za-z][\w-]*)*$/;
const kb = (s) => `${(s.length / 1024).toFixed(1)} KB`;
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

export const libraryCss = `
#tmcpp-lib { border-bottom: 1px solid #eee; padding: 8px 10px; max-height: 40%; overflow: auto; font-size: 12px; }
#tmcpp-lib[hidden] { display: none; }
#tmcpp-lib .row { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
#tmcpp-lib .row .name { flex: 1; font-family: ui-monospace, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#tmcpp-lib .meta { color: #888; }
#tmcpp-lib input { flex: 1; font: 12px ui-monospace, Consolas, monospace; padding: 4px 6px; border: 1px solid #ccc; border-radius: 5px; }
#tmcpp-lib button { font: 600 11px system-ui, sans-serif; padding: 3px 8px; border-radius: 5px; border: 1px solid #2d70b3;
  background: #fff; color: #2d70b3; cursor: pointer; }
#tmcpp-lib button.danger { border-color: #c74440; color: #c74440; }
#tmcpp-lib button.danger.armed { background: #c74440; color: #fff; }
#tmcpp-lib h4 { margin: 8px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
#tmcpp-lib .status { color: #555; margin-top: 4px; }
#tmcpp-lib .status.err { color: #c74440; }
#tmcpp-lib .pending { background: #fff8e6; border-radius: 5px; padding: 4px 6px; }
`;

/**
 * box: the panel section to draw into. src: the editor. report(items, okText): the panel's
 * message list. rerun(): compile again (after a fetch).
 */
export function createLibrary({ box, src, report, rerun, onState = () => {} }) {
  let libs = {};
  let pending = [];
  let available = true;
  const status = el("div", { className: "status" });
  const say = (text, isErr = false) => { status.textContent = text; status.className = isErr ? "status err" : "status"; };

  const sources = () => Object.fromEntries(Object.entries(libs).map(([id, v]) => [id, v.source]));

  /** Remote ids the file needs, directly or through saved libraries, that aren't saved yet. */
  function missingRemote(text) {
    const out = [], seen = new Set();
    const queue = findImports(text, "");
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      if (libs[id]) queue.push(...findImports(libs[id].source, id));
      else if (isRemote(id)) out.push(id);
    }
    return out;
  }

  async function save() {
    const name = nameInput.value.trim();
    if (!NAME.test(name)) return say("Name it with letters, digits, - and /, such as springs or ui/buttons", true);
    if (/^(std|gh)\b/.test(name)) return say("std/ and gh: names are reserved", true);
    // Check it as a library before saving: definitions only, nothing drawn.
    const r = compile(`import ${JSON.stringify(name)}`, { libraries: { ...sources(), [name]: src.value }, watermark: false });
    const problems = r.errors.map((e) => ({ line: Number(e.message.match(/ line (\d+):/)?.[1] ?? 1), kind: "err",
      message: e.message.replace(/^In '[^']*' line \d+: /, "") }));
    if (problems.length) {
      report(problems, "");
      return say(`Not saved: fix the ${problems.length} problem(s) listed below first`, true);
    }
    try {
      libs = await ask("save", { name, source: src.value });
      say(`Saved '${name}' (${kb(src.value)}). Use it with import "${name}".`);
      draw();
    } catch (e) { say(e.message, true); }
  }

  async function fetchOne(id) {
    say(`Fetching ${ghUrl(id) ?? id} ...`);
    try {
      libs = await ask("fetch", { id });
      say(`Fetched ${id} and saved a copy.`);
      draw();
      rerun();
    } catch (e) { say(e.message, true); }
  }

  function remove(id, button) {
    if (!button.classList.contains("armed")) {
      button.classList.add("armed");
      button.textContent = "Really delete?";
      setTimeout(() => { button.classList.remove("armed"); button.textContent = "Delete"; }, 3000);
      return;
    }
    ask("remove", { name: id }).then((data) => { libs = data; say(`Deleted '${id}'.`); draw(); }, (e) => say(e.message, true));
  }

  function insertImport(id) {
    const line = `import ${JSON.stringify(id)}`;
    if (!src.value.split("\n").some((l) => l.trim() === line)) src.value = `${line}\n${src.value}`;
    src.dispatchEvent(new Event("input"));
    say(`Added ${line} at the top.`);
  }

  const nameInput = el("input", { placeholder: "library name, such as springs" });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });

  function draw() {
    onState({ saved: Object.keys(libs).length, pending: pending.length });
    box.replaceChildren();
    if (!available) {
      box.append(el("div", { className: "status err", textContent: "Libraries need the storage bridge. Reload the extension (chrome://extensions) and this page." }));
      return;
    }
    box.append(el("div", { className: "row" }, nameInput, el("button", { textContent: "Save as library", title: "Save the editor's file as a library you can import", onclick: save })));
    if (pending.length) {
      box.append(el("h4", { textContent: "Needs fetching" }));
      for (const id of pending) {
        box.append(el("div", { className: "row pending" },
          el("span", { className: "name", textContent: id, title: ghUrl(id) ?? id }),
          el("button", { textContent: "Fetch", title: `Download ${ghUrl(id) ?? id} once and keep a copy`, onclick: () => fetchOne(id) })));
      }
    }
    const ids = Object.keys(libs).sort();
    box.append(el("h4", { textContent: ids.length ? `Saved (${ids.length})` : "Nothing saved yet" }));
    for (const id of ids) {
      const v = libs[id];
      const del = el("button", { className: "danger", textContent: "Delete" });
      del.onclick = () => remove(id, del);
      const actions = [el("button", { textContent: "Import", title: `Add import "${id}" to the top of the file`, onclick: () => insertImport(id) })];
      if (v.url) actions.push(el("button", { textContent: "Refetch", title: `Download ${v.url} again`, onclick: () => fetchOne(id) }));
      box.append(el("div", { className: "row" },
        el("span", { className: "name", textContent: id, title: v.url ?? id }),
        el("span", { className: "meta", textContent: kb(v.source) }), ...actions, del));
    }
    box.append(status);
  }

  listeners.add((data) => { libs = data; draw(); });
  ask("list").then((data) => { libs = data; draw(); }, () => { available = false; draw(); });
  draw();

  return {
    sources,
    /** After a compile: list the remote libraries still to fetch, and open the section if any. */
    notePending(text) {
      pending = missingRemote(text);
      if (pending.length) { box.hidden = false; box.dispatchEvent(new Event("opened")); }
      draw();
    },
  };
}
