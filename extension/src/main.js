// TMC++ panel for desmos.com/calculator. Runs in the page (MAIN world) so it can use Calc and Desmos.
import { buildConfigFromGlobals, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../../src/compile.js";
import { assignIds, buildMeta, metaItem, metaText, readMeta, META_ID } from "../../src/meta.js";

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
#tmcpp-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #eee; }
#tmcpp-head b { flex: 1; }
#tmcpp-head button { font: 600 12px system-ui, sans-serif; padding: 5px 10px; border-radius: 6px; border: 1px solid #2d70b3;
  background: #2d70b3; color: #fff; cursor: pointer; }
#tmcpp-head button.ghost { background: #fff; color: #2d70b3; }
#tmcpp-src { flex: 1; resize: none; border: 0; outline: 0; padding: 10px; font: 13px/1.5 ui-monospace, Consolas, monospace;
  tab-size: 2; white-space: pre; }
#tmcpp-info { padding: 6px 10px; border-bottom: 1px solid #eee; color: #555; font-size: 12px; }
#tmcpp-info:empty { display: none; }
#tmcpp-out { max-height: 30%; overflow: auto; border-top: 1px solid #eee; padding: 6px 10px; }
#tmcpp-out .ok { color: #388c46; }
#tmcpp-out .err { color: #c74440; cursor: pointer; }
#tmcpp-out .warn { color: #b06d00; cursor: pointer; }
`;

function mount(Calc, Desmos) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);

  const toggle = Object.assign(document.createElement("button"), { id: "tmcpp-toggle", textContent: "TMC++" });
  const panel = document.createElement("div");
  panel.id = "tmcpp-panel";
  panel.innerHTML = `
    <div id="tmcpp-head"><b>TMC++</b>
      <button class="ghost" id="tmcpp-example" title="Replace the editor text with the hello-world example">Example</button>
      <button class="ghost" id="tmcpp-tmc" title="Copy the compiled TMC">Copy TMC</button>
      <button id="tmcpp-run" title="Ctrl+Enter">Compile</button></div>
    <div id="tmcpp-info"></div>
    <textarea id="tmcpp-src" spellcheck="false"></textarea>
    <div id="tmcpp-out"></div>`;
  document.body.append(toggle, panel);

  const src = panel.querySelector("#tmcpp-src");
  const out = panel.querySelector("#tmcpp-out");
  const info = panel.querySelector("#tmcpp-info");

  // What the open graph says about itself. Checked whenever the panel opens or a compile finishes,
  // because Desmos loads saved graphs after Calc exists and swaps graphs without reloading the page.
  const showGraphInfo = () => {
    const found = readMeta(Calc.getState().expressions.list);
    if (found?.meta) {
      const tagged = Object.values(found.meta.exprs ?? {}).filter((e) => e.tags?.length).length;
      const classes = Object.keys(found.meta.classes ?? {});
      info.textContent = `This graph was made with TMC++: ${classes.length} class(es)` +
        `${classes.length ? ` (${classes.join(", ")})` : ""}, ${tagged} tagged item(s).`;
    } else if (found?.error) {
      info.textContent = `TMC++ metadata note found but unreadable: ${found.error}`;
    } else {
      info.textContent = "This graph has no TMC++ metadata yet. Compile to add it.";
    }
  };
  src.value = localStorage.getItem(STORE()) ?? STARTER;
  let lastTmc = "";

  const open = (v = !panel.classList.contains("open")) => {
    panel.classList.toggle("open", v);
    if (v) { showGraphInfo(); src.focus(); }
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

  const report = (items, okText) => {
    out.replaceChildren();
    if (!items.length) {
      out.append(Object.assign(document.createElement("div"), { className: "ok", textContent: okText }));
      return;
    }
    for (const it of items) {
      const div = document.createElement("div");
      div.className = it.kind;
      div.textContent = `line ${it.line}: ${it.message}`;
      div.onclick = () => goToLine(it.line);
      out.append(div);
    }
  };

  function run() {
    localStorage.setItem(STORE(), src.value);
    const r = compile(src.value);
    const notes = r.warnings.map((w) => ({ ...w, kind: "warn" }));
    if (r.errors.length) {
      report([...r.errors.map((e) => ({ ...e, kind: "err" })), ...notes], "");
      return;
    }
    lastTmc = r.tmc;
    let analysis, state;
    try {
      [analysis, state] = textToRaw(buildConfigFromGlobals(Desmos, Calc), r.tmc);
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
      const list = Calc.getState().expressions.list.filter((e) => e.id !== META_ID);
      const text = metaText(buildMeta(r, list));
      Calc.setExpression({ id: META_ID, type: "text", text });
      saved = ` Metadata note saved (${(text.length / 1024).toFixed(1)} KB).`;
    }
    const n = state.expressions.list.length - (pairs ? 1 : 0);
    report([...tmcErrors, ...notes], `Compiled ${n} item(s) into the graph.${saved}`);
    showGraphInfo();
  }

  panel.querySelector("#tmcpp-run").onclick = run;
  panel.querySelector("#tmcpp-example").onclick = () => {
    src.value = STARTER;
    localStorage.setItem(STORE(), src.value);
    run();
  };
  panel.querySelector("#tmcpp-tmc").onclick = async () => {
    const r = compile(src.value);
    await navigator.clipboard.writeText(r.tmc);
    report([], "Compiled TMC copied to the clipboard.");
  };
  src.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = src;
      src.setRangeText("  ", a, b, "end");
    }
    e.stopPropagation(); // keep Desmos shortcuts out of the editor
  });
  src.addEventListener("input", () => localStorage.setItem(STORE(), src.value));

}

whenReady(mount);
