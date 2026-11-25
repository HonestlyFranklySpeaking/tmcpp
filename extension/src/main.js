// TMC++ panel for desmos.com/calculator. Runs in the page (MAIN world) so it can use Calc and Desmos.
import { buildConfigFromGlobals, textToRaw, rawToText } from "../../src/tmc-core.js";
import { decompile } from "../../src/decompile.js";
import { latexToTmc } from "../../src/latex.js";
import { compile, isWatermarkSeed } from "../../src/compile.js";
import { decodeSource } from "../../src/decode.js";
import { restoreGreek } from "../../src/greek.js";
import { assignIds, buildMeta, metaItem, metaText, readMeta, META_ID } from "../../src/meta.js";
import { createLibrary, libraryCss, ask } from "./library.js";
import { createEditor } from "./editor.js";

const STORE = () => `tmcpp:source:${location.pathname}`;
import STARTER from "../../examples/hello.tmcpp";

function whenReady(fn) {
  const t = setInterval(() => {
    if (window.Calc && window.Desmos) { clearInterval(t); fn(window.Calc, window.Desmos); }
  }, 200);
}

const css = `
#tmcpp-toggle { position: fixed; right: 16px; bottom: 16px; z-index: 10000; font: 600 13px system-ui, sans-serif;
  padding: 8px 12px; border-radius: 8px; border: 1px solid #2d70b3; background: #fff; color: #2d70b3; cursor: pointer; }
#tmcpp-panel { position: fixed; top: 56px; right: 16px; bottom: 64px; width: 460px; z-index: 10000; display: none;
  flex-direction: column; background: #fff; border: 1px solid #ccc; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.18);
  font: 13px system-ui, sans-serif; overflow: hidden; }
#tmcpp-panel.open { display: flex; }
#tmcpp-head { position: relative; display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid #eee; }
#tmcpp-head b { flex: 1; font-size: 14px; letter-spacing: .02em; }
#tmcpp-head kbd { font: 10px ui-monospace, Consolas, monospace; opacity: .75; margin-left: 4px; }
#tmcpp-libbtn .badge { display: inline-block; min-width: 14px; margin-left: 4px; padding: 0 4px; border-radius: 7px;
  background: #e7f1fb; color: #2d70b3; font-size: 10px; line-height: 14px; text-align: center; }
#tmcpp-libbtn.on { background: #e7f1fb; }
#tmcpp-libbtn.pending .badge { background: #f5a623; color: #fff; }
#tmcpp-more { padding: 5px 9px !important; font-size: 14px !important; line-height: 1; }
#tmcpp-menu { position: absolute; right: 10px; top: 40px; z-index: 2; min-width: 190px; padding: 4px; background: #fff;
  border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.15); }
#tmcpp-menu[hidden] { display: none; }
#tmcpp-menu button { display: flex; width: 100%; justify-content: space-between; gap: 12px; border: 0 !important; border-radius: 5px;
  background: #fff !important; color: #222 !important; font-weight: 500 !important; padding: 7px 10px !important; text-align: left; }
#tmcpp-menu button:hover { background: #f0f5fb !important; }
#tmcpp-menu button span { color: #888; font-size: 11px; }
#tmcpp-menu hr { border: 0; border-top: 1px solid #eee; margin: 4px 2px; }
#tmcpp-head button { font: 600 12px system-ui, sans-serif; padding: 5px 10px; border-radius: 6px; border: 1px solid #2d70b3;
  background: #2d70b3; color: #fff; cursor: pointer; }
#tmcpp-head button.ghost { background: #fff; color: #2d70b3; }
#tmcpp-src.drop { outline: 2px dashed #2d70b3; outline-offset: -6px; background: #f3f8fd; }
#tmcpp-editor { flex: 1; display: flex; min-height: 0; overflow: hidden; }
#tmcpp-editor .cm-editor { width: 100%; }
#tmcpp-info { padding: 6px 10px; border-bottom: 1px solid #eee; color: #555; font-size: 12px; }
#tmcpp-info:empty { display: none; }
#tmcpp-out { max-height: 30%; overflow: auto; border-top: 1px solid #eee; padding: 6px 10px; user-select: text; -webkit-user-select: text; }
#tmcpp-out .copy { float: right; font-size: 11px; color: #2d70b3; cursor: pointer; user-select: none; }
#tmcpp-out .ok { color: #388c46; }
#tmcpp-out .err { color: #c74440; cursor: pointer; }
#tmcpp-out .warn { color: #b06d00; cursor: pointer; }
#tmcpp-link { border-bottom: 1px solid #eee; padding: 8px 10px; font-size: 12px; }
#tmcpp-link p { margin: 0 0 6px; color: #555; }
#tmcpp-link code { font: 11px ui-monospace, Consolas, monospace; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; }
#tmcpp-link .row { display: flex; gap: 6px; }
#tmcpp-link input { flex: 1; font: 12px ui-monospace, Consolas, monospace; padding: 4px 6px; border: 1px solid #ccc; border-radius: 5px; }
#tmcpp-link button { font: 600 12px system-ui, sans-serif; padding: 4px 10px; border-radius: 6px; border: 1px solid #2d70b3; background: #2d70b3; color: #fff; cursor: pointer; }
#tmcpp-link button.ghost { background: #fff; color: #2d70b3; }
#tmcpp-link .state { font-weight: 600; }
#tmcpp-link .state.linked { color: #388c46; } #tmcpp-link .state.denied { color: #c74440; } #tmcpp-link .state.waiting { color: #b06d00; }
#tmcpp-ai { display: none; font: 700 10px system-ui, sans-serif; color: #fff; background: #388c46; border-radius: 4px; padding: 2px 5px; cursor: pointer; }
#tmcpp-ai.on { display: inline-block; }
`;

function mount(Calc, Desmos) {
  const style = document.createElement("style");
  style.textContent = css + libraryCss;
  document.head.append(style);

  const toggle = Object.assign(document.createElement("button"), { id: "tmcpp-toggle", textContent: "TMC++" });
  const panel = document.createElement("div");
  panel.id = "tmcpp-panel";
  panel.innerHTML = `
    <div id="tmcpp-head"><b>TMC++ <span id="tmcpp-ai" title="An AI app is linked through tmcpp mcp and can load graphs here">AI</span></b>
      <button class="ghost" id="tmcpp-fromgraph" title="Rebuild TMC++ from the graph as it is now, including edits made in Desmos">From graph</button>
      <button class="ghost" id="tmcpp-libbtn" title="Libraries you can import: save this file as one, fetch GitHub ones">Library<span class="badge" hidden></span></button>
      <button class="ghost" id="tmcpp-more" title="Open, save, copy and the example" aria-haspopup="true">⋯</button>
      <button id="tmcpp-run" title="Compile into the graph (Ctrl+Enter)">Compile<kbd>⌃↵</kbd></button>
      <div id="tmcpp-menu" role="menu" hidden>
        <button id="tmcpp-open" role="menuitem">Open file… <span>or drop on editor</span></button>
        <button id="tmcpp-save" role="menuitem">Save as .tmcpp</button>
        <button id="tmcpp-tmc" role="menuitem">Copy compiled TMC</button>
        <hr>
        <button id="tmcpp-linkbtn" role="menuitem">Link to AI… <span>tmcpp mcp</span></button>
        <hr>
        <button id="tmcpp-format" role="menuitem">Format <span>Shift+Alt+F</span></button>
        <button id="tmcpp-example" role="menuitem">Load example <span>replaces text</span></button>
      </div>
      <input type="file" id="tmcpp-file" accept=".tmcpp,.txt,text/plain" hidden></div>
    <div id="tmcpp-info"></div>
    <div id="tmcpp-lib" hidden></div>
    <div id="tmcpp-link" hidden>
      <p>Status: <span class="state">Not linked</span></p>
      <p>Lets an AI app running <code>tmcpp mcp</code> on this computer load graphs into this tab, read them back and take screenshots. Run <code>tmcpp pair</code> for the code.</p>
      <div class="row"><input id="tmcpp-code" placeholder="pairing code, like 51324-3f9a…" spellcheck="false" autocomplete="off">
        <button id="tmcpp-linkon">Link</button><button class="ghost" id="tmcpp-linkoff">Unlink</button></div>
    </div>
    <div id="tmcpp-editor"></div>
    <div id="tmcpp-out"></div>`;
  document.body.append(toggle, panel);

  // Libraries that came with a graph from the AI link (its ./relative files), kept for this page.
  let pushed = { libraries: {}, from: "" };
  function allLibraries() { return { ...library.sources(), ...pushed.libraries }; }
  // The editor (CodeMirror): compile errors show as squiggles while you type.
  const src = createEditor(panel.querySelector("#tmcpp-editor"), {
    run: () => run(),
    libraries: () => allLibraries(),
    notify: (message) => report([], message),
    check: (text) => {
      try {
        const r = compile(text, { libraries: allLibraries(), from: pushed.from, watermark: false });
        return [...r.errors.map((e) => ({ ...e, kind: "err" })), ...r.warnings.map((w) => ({ ...w, kind: "warn" }))];
      } catch { return []; }
    },
  });
  const out = panel.querySelector("#tmcpp-out");
  const info = panel.querySelector("#tmcpp-info");
  const libBox = panel.querySelector("#tmcpp-lib");

  // What the open graph says about itself. Checked whenever the panel opens or a compile finishes,
  // because Desmos loads saved graphs after Calc exists and swaps graphs without reloading the page.
  const showGraphInfo = () => {
    const state = Calc.getState();
    const found = readMeta(state.expressions.list);
    const mark = isWatermarkSeed(state.randomSeed) ? " TMC++ watermark ✓" : "";
    if (found?.meta) {
      const tagged = Object.values(found.meta.exprs ?? {}).filter((e) => e.tags?.length).length;
      const classes = Object.keys(found.meta.classes ?? {});
      info.textContent = `This graph was made with TMC++: ${classes.length} class(es)` +
        `${classes.length ? ` (${classes.join(", ")})` : ""}, ${tagged} tagged item(s).${mark}`;
    } else if (found?.error) {
      info.textContent = `TMC++ metadata note found but unreadable: ${found.error}`;
    } else {
      info.textContent = mark
        ? "This graph carries the TMC++ watermark, but its metadata note is gone." + mark
        : "This graph has no TMC++ metadata yet. Compile to add it.";
    }
  };
  src.value = localStorage.getItem(STORE()) ?? STARTER;
  let lastTmc = "";

  const isOpen = () => panel.classList.contains("open");
  const open = (v = !isOpen(), focus = true) => {
    panel.classList.toggle("open", v);
    if (v) { showGraphInfo(); if (focus) src.focus(); }
  };
  toggle.onclick = () => open();
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); open(); }
  });

  const goToLine = (n) => {
    const lines = src.value.split("\n");
    const start = lines.slice(0, n - 1).reduce((a, l) => a + l.length + 1, 0);
    src.focus();
    src.setSelectionRange(start, start + (lines[n - 1] ?? "").length);
  };

  let lastReport = { items: [], okText: "" };
  const report = (items, okText) => {
    lastReport = { items, okText };
    out.replaceChildren();
    if (!items.length) {
      out.append(Object.assign(document.createElement("div"), { className: "ok", textContent: okText }));
      return;
    }
    // Errors can be selected and copied, or all copied at once (with each line's source text).
    const srcLines = src.value.split("\n");
    const all = items.map((it) => `line ${it.line}: ${it.message}` +
      (srcLines[it.line - 1]?.trim() ? `\n    ${srcLines[it.line - 1].trim()}` : "")).join("\n");
    const copy = Object.assign(document.createElement("span"), { className: "copy", textContent: "Copy all" });
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(all); copy.textContent = "Copied"; }
      catch { copy.textContent = "Couldn't copy"; }
      setTimeout(() => (copy.textContent = "Copy all"), 1500);
    };
    out.append(copy);
    for (const it of items) {
      const div = document.createElement("div");
      div.className = it.kind;
      div.textContent = `line ${it.line}: ${it.message}`;
      // A click jumps to the line, unless you were selecting text to copy.
      div.onclick = () => { if (!String(window.getSelection())) goToLine(it.line); };
      out.append(div);
    }
  };

  const library = createLibrary({ box: libBox, src, report: (items, ok) => report(items, ok), rerun: () => run(),
    // The Library button shows how many are saved, in orange when an import still needs fetching.
    onState: ({ saved, pending }) => {
      const badge = panel.querySelector("#tmcpp-libbtn .badge");
      badge.hidden = !saved && !pending;
      badge.textContent = pending ? `${pending} to fetch` : String(saved);
      panel.querySelector("#tmcpp-libbtn").classList.toggle("pending", pending > 0);
    } });
  const libBtn = panel.querySelector("#tmcpp-libbtn");
  libBtn.onclick = () => { libBox.hidden = !libBox.hidden; libBtn.classList.toggle("on", !libBox.hidden); };
  libBox.addEventListener("opened", () => libBtn.classList.add("on"));

  // The ⋯ menu: closes on a choice, a click elsewhere, or Escape.
  const menu = panel.querySelector("#tmcpp-menu"), more = panel.querySelector("#tmcpp-more");
  const closeMenu = () => { menu.hidden = true; more.setAttribute("aria-expanded", "false"); };
  more.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; more.setAttribute("aria-expanded", String(!menu.hidden)); };
  menu.addEventListener("click", (e) => { if (e.target.closest("button")) closeMenu(); });
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== more) closeMenu(); });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { e.stopPropagation(); closeMenu(); more.focus(); } });

  function run() {
    localStorage.setItem(STORE(), src.value);
    hasLocalSource = true;
    // Keep this graph's TMC++ seed so random() results don't reshuffle on every compile.
    const seed = Calc.getState().randomSeed;
    const r = compile(src.value, { randomSeed: isWatermarkSeed(seed) ? seed : undefined, libraries: allLibraries(), from: pushed.from });
    library.notePending(src.value);
    const notes = r.warnings.map((w) => ({ ...w, kind: "warn" }));
    if (r.errors.length) {
      report([...r.errors.map((e) => ({ ...e, kind: "err" })), ...notes], "");
      return;
    }
    lastTmc = r.tmc;
    let analysis, state;
    try {
      [analysis, state] = textToRaw(buildConfigFromGlobals(Desmos, Calc), r.tmc);
      restoreGreek(state); // placeholder names -> \gamma, \lambda... (see src/greek.js)
    } catch (e) {
      report([{ line: 1, kind: "err", message: `Text Mode failed: ${e.message}` }], "");
      return;
    }
    // Map TMC parser positions back to TMC++ source lines.
    const tmcLineOf = (pos) => r.tmc.slice(0, pos).split("\n").length;
    const seen = new Set();
    const tmcErrors = [];
    for (const d of analysis.diagnostics) {
      const line = r.lineMap[tmcLineOf(d.from) - 1] || 1;
      if (seen.has(line)) continue;
      seen.add(line);
      tmcErrors.push({ line, kind: d.severity === "error" ? "err" : "warn", message: `TMC: ${d.message}` });
    }
    if (tmcErrors.some((e) => e.kind === "err") || !state) {
      report([...tmcErrors, ...notes], "");
      return;
    }
    // Stable ids + a placeholder metadata note, then load the graph.
    const pairs = assignIds(state, r.items);
    if (pairs) state.expressions.list.unshift(metaItem({ v: 1 }));
    else notes.push({ line: 1, kind: "warn", message: "Could not match graph items to source lines; metadata note skipped" });
    Calc.setState(state, { allowUndo: true });

    // Hash what Desmos actually holds (it drops defaults on load), then fill in the note.
    let saved = "";
    if (pairs) {
      const loaded = Calc.getState().expressions;
      const list = loaded.list.filter((e) => e.id !== META_ID);
      const text = metaText(buildMeta(r, list, loaded.ticker));
      Calc.setExpression({ id: META_ID, type: "text", text });
      saved = ` Metadata note saved (${(text.length / 1024).toFixed(1)} KB).`;
    }
    const n = state.expressions.list.length - (pairs ? 1 : 0);
    report([...tmcErrors, ...notes], `Compiled ${n} item(s) into the graph.${saved}`);
    showGraphInfo();
  }

  panel.querySelector("#tmcpp-run").onclick = run;
  // ---- graph -> TMC++ (M4) ----
  let tmCfg = null;
  const cfg = () => (tmCfg ??= buildConfigFromGlobals(Desmos, Calc));
  /** TMC text of one raw item, without the settings block rawToText adds. */
  const itemTmc = (item) => {
    // text-mode-core needs a current state version and a viewport, or it refuses everything.
    const base = { version: 11, randomSeed: "", graph: { viewport: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 } } };
    const { folderId, ...alone } = item; // a folder id with no folder makes Text Mode refuse the item
    const [err, text] = rawToText(cfg(), { ...base, expressions: { list: [alone] } });
    if (err) throw new Error("Text Mode couldn't convert this item");
    let t = text.trim();
    if (t.startsWith("settings")) {
      let depth = 0, i = t.indexOf("@{");
      if (i >= 0) {
        for (; i < t.length; i++) { if (t[i] === "{") depth++; else if (t[i] === "}" && --depth === 0) break; }
        t = t.slice(i + 1).replace(/^;?\s*/, "");
      }
    }
    return t.replace(/;\s*$/, "");
  };
  /** TMC math for a LaTeX string: our converter, or text-mode-core for anything it doesn't know. */
  const latexToText = (latex) => {
    try { return latexToTmc(latex); } catch {}
    const t = itemTmc({ type: "expression", id: "tmcpp-probe", latex });
    let depth = 0, inStr = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '"' && t[i - 1] !== "\\") inStr = !inStr;
      if (inStr) continue;
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (c === "@" && t[i + 1] === "{" && depth === 0) return t.slice(0, i).trim();
    }
    return t.trim();
  };
  const rebuild = () => decompile(Calc.getState(), { latexToText, itemToTmc: itemTmc });
  const fromGraph = (why) => {
    const { source, warnings } = rebuild();
    src.value = source;
    localStorage.setItem(STORE(), src.value);
    hasLocalSource = true;
    report(warnings.map((w) => ({ line: 1, kind: "warn", message: w })), why);
  };
  panel.querySelector("#tmcpp-fromgraph").onclick = () => {
    if (src.value.trim() && !confirm("Replace the editor text with TMC++ rebuilt from the graph?")) return;
    try { fromGraph("Rebuilt TMC++ from the graph, including any edits made in Desmos."); }
    catch (e) { report([{ line: 1, kind: "err", message: `Couldn't rebuild from the graph: ${e.message}` }], ""); }
  };

  // ---- .tmcpp files: open (button or drag-and-drop) and save ----
  const fileInput = panel.querySelector("#tmcpp-file");
  const loadFile = async (file) => {
    if (!file) return;
    if (!/\.(tmcpp|txt)$/i.test(file.name)) {
      report([{ line: 1, kind: "err", message: `${file.name} is not a .tmcpp file` }], "");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      report([{ line: 1, kind: "err", message: `${file.name} is over 2 MB; that's too big for a graph source` }], "");
      return;
    }
    src.value = decodeSource(await file.arrayBuffer());
    localStorage.setItem(STORE(), src.value);
    hasLocalSource = true;
    run();
    if (!out.querySelector(".err")) report([], `Opened ${file.name} and compiled it into the graph.`);
  };
  panel.querySelector("#tmcpp-open").onclick = () => fileInput.click();
  fileInput.onchange = () => { loadFile(fileInput.files[0]); fileInput.value = ""; };

  src.addEventListener("dragover", (e) => { e.preventDefault(); src.classList.add("drop"); });
  src.addEventListener("dragleave", () => src.classList.remove("drop"));
  src.addEventListener("drop", (e) => {
    e.preventDefault();
    src.classList.remove("drop");
    loadFile(e.dataTransfer.files[0]);
  });

  panel.querySelector("#tmcpp-save").onclick = () => {
    const title = document.title.replace(/\s*\|\s*Desmos.*$/i, "").trim() || "graph";
    const name = title.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").toLowerCase() + ".tmcpp";
    const url = URL.createObjectURL(new Blob([src.value], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
    report([], `Saved ${name} to your downloads.`);
  };

  panel.querySelector("#tmcpp-format").onclick = () => { src.format(); report([], "Formatted: indentation and spacing only, nothing else changed."); };
  panel.querySelector("#tmcpp-example").onclick = () => {
    src.value = STARTER;
    localStorage.setItem(STORE(), src.value);
    run();
  };
  panel.querySelector("#tmcpp-tmc").onclick = async () => {
    const seed = Calc.getState().randomSeed;
    const r = compile(src.value, { randomSeed: isWatermarkSeed(seed) ? seed : undefined });
    await navigator.clipboard.writeText(r.tmc);
    report([], "Compiled TMC copied to the clipboard.");
  };
  // Ctrl+Enter, Tab and Ctrl+/ are the editor's own keys; keep Desmos's shortcuts out of it.
  src.addEventListener("keydown", (e) => e.stopPropagation());
  src.addEventListener("input", () => { localStorage.setItem(STORE(), src.value); hasLocalSource = true; });

  // ---- the AI link (M14): requests from `tmcpp mcp`, through the background worker ----
  const linkBox = panel.querySelector("#tmcpp-link"), codeIn = panel.querySelector("#tmcpp-code");
  const aiBadge = panel.querySelector("#tmcpp-ai"), stateEl = linkBox.querySelector(".state");
  const showLink = (st) => {
    if (!st) return;
    stateEl.textContent = st.message;
    stateEl.className = `state ${st.state}`;
    aiBadge.classList.toggle("on", st.state === "linked");
    toggle.textContent = st.state === "linked" ? "TMC++ · AI" : "TMC++";
  };
  const refreshLink = async () => {
    try {
      const r = await ask("linkGet");
      if (!r) throw new Error("The extension's background worker is out of date: reload TMC++ in chrome://extensions");
      if (r.link?.code) codeIn.value = r.link.code;
      showLink(r.status);
    }
    catch (e) { showLink({ state: "denied", message: e.message }); }
  };
  panel.querySelector("#tmcpp-linkbtn").onclick = () => { linkBox.hidden = !linkBox.hidden; if (!linkBox.hidden) { refreshLink(); codeIn.focus(); } };
  aiBadge.onclick = () => { linkBox.hidden = false; refreshLink(); };
  codeIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") panel.querySelector("#tmcpp-linkon").click(); });
  panel.querySelector("#tmcpp-linkon").onclick = async () => {
    const code = codeIn.value.trim();
    if (!/^\d{2,5}-[0-9a-f]{16,}$/.test(code)) { showLink({ state: "denied", message: "A pairing code looks like 51324-3f9a… (run tmcpp pair)" }); return; }
    await ask("linkSet", { code, enabled: true });
    showLink({ state: "waiting", message: "Connecting…" });
    setTimeout(refreshLink, 1500);
  };
  panel.querySelector("#tmcpp-linkoff").onclick = async () => {
    await ask("linkSet", { code: codeIn.value, enabled: false });
    showLink({ state: "off", message: "Not linked" });
  };

  const screenshot = (width = 1000) => new Promise((resolve) => {
    const b = Calc.graphpaperBounds?.pixelCoordinates ?? { width: 1000, height: 700 };
    const w = Math.max(100, Math.min(4000, Math.round(width)));
    Calc.asyncScreenshot({ width: w, height: Math.round(w * b.height / b.width), targetPixelRatio: 1, showLabels: true }, resolve);
  });
  const linkOps = {
    info: () => ({ title: document.title, url: location.href, panelOpen: isOpen(), madeWithTmcpp: !!readMeta(Calc.getState().expressions.list)?.meta, editorLines: src.value.split("\n").length }),
    // Load TMC++ into the editor and compile it into the graph, like pressing Compile.
    push: ({ source, libraries = {}, from = "" }) => {
      if (typeof source !== "string") throw new Error("push needs source text");
      if (src.value.trim() && src.value !== source) localStorage.setItem(`tmcpp:before-ai:${location.pathname}`, src.value);
      pushed = { libraries, from };
      src.value = source;
      localStorage.setItem(STORE(), source);
      hasLocalSource = true;
      open(true, false);
      run();
      const errors = lastReport.items.filter((i) => i.kind === "err"), warnings = lastReport.items.filter((i) => i.kind === "warn");
      return { ok: errors.length === 0, message: lastReport.okText, errors, warnings };
    },
    // Read TMC++ back: rebuilt from the graph (including edits made in Desmos), or the editor's text.
    pull: ({ from = "graph" }) => {
      if (from === "editor") return { source: src.value, warnings: [] };
      return rebuild();
    },
    screenshot: async ({ width }) => ({ png: await screenshot(width) }),
  };
  window.addEventListener("message", async (e) => {
    const m = e.data;
    if (e.source !== window) return;
    if (m?.tmcpp === "link-status") { showLink(m.status); return; }
    if (m?.tmcpp !== "link-req") return;
    const reply = (r) => window.postMessage({ tmcpp: "link-res", seq: m.seq, ...r }, location.origin);
    if (!linkOps[m.op]) return reply({ ok: false, error: `unknown request '${m.op}'` });
    try { reply({ ok: true, data: await linkOps[m.op](m.args ?? {}) }); }
    catch (err) { reply({ ok: false, error: String(err?.message ?? err) }); }
  });

  // Follow the graph. Desmos switches graphs without reloading the page (the URL path changes)
  // and loads saved graphs after Calc exists, so watch both the path and graph changes.
  let lastPath = location.pathname;
  const autoOpened = new Set(); // graphs we already popped the panel open for
  let hasLocalSource = localStorage.getItem(STORE()) !== null;

  const onGraphMaybeChanged = () => {
    if (location.pathname !== lastPath) {
      const from = lastPath;
      lastPath = location.pathname;
      // Saving a new graph moves it from /calculator to /calculator/<hash>: keep its source.
      if (from === "/calculator" && localStorage.getItem(STORE()) === null) {
        localStorage.setItem(STORE(), src.value);
      }
      const saved = localStorage.getItem(STORE());
      hasLocalSource = saved !== null;
      src.value = saved ?? STARTER;
      out.replaceChildren();
    }
    const found = readMeta(Calc.getState().expressions.list);
    if (isOpen()) showGraphInfo();
    if (found?.meta && !autoOpened.has(lastPath)) {
      autoOpened.add(lastPath);
      if (!isOpen()) open(true, false);
      if (!hasLocalSource) {
        try { fromGraph("Rebuilt this graph's TMC++ from its metadata (it wasn't saved in this browser)."); }
        catch (e) { report([{ line: 1, kind: "warn", message: `Couldn't rebuild TMC++ from this graph: ${e.message}` }], ""); }
      }
    }
  };

  let pending = null;
  const soon = () => { clearTimeout(pending); pending = setTimeout(onGraphMaybeChanged, 300); };
  Calc.observeEvent("change.tmcpp", soon);
  setInterval(() => { if (location.pathname !== lastPath) soon(); }, 500);
  soon(); // the graph that is loading right now

}

whenReady(mount);
