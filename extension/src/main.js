// TMC++ panel for desmos.com/calculator. Runs in the page (MAIN world) so it can use Calc and Desmos.
import { buildConfigFromGlobals, textToRaw } from "@desmodder/text-mode-core";
import { compile } from "../../src/compile.js";

const STORE = () => `tmcpp:source:${location.pathname}`;
const STARTER = `// TMC++: Ctrl+Enter to compile into this graph (Ctrl+Z in Desmos undoes it)
class curve { #c74440 dashed width 3 }

"Hello from TMC++"

a = 2  [0 : 5 : 0.1]
y = a sin(x)  .curve
`;

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
      <button class="ghost" id="tmcpp-tmc" title="Copy the compiled TMC">Copy TMC</button>
      <button id="tmcpp-run" title="Ctrl+Enter">Compile</button></div>
    <textarea id="tmcpp-src" spellcheck="false"></textarea>
    <div id="tmcpp-out"></div>`;
  document.body.append(toggle, panel);

  const src = panel.querySelector("#tmcpp-src");
  const out = panel.querySelector("#tmcpp-out");
  src.value = localStorage.getItem(STORE()) ?? STARTER;
  let lastTmc = "";

  const open = (v = !panel.classList.contains("open")) => {
    panel.classList.toggle("open", v);
    if (v) src.focus();
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
    Calc.setState(state, { allowUndo: true });
    const n = state.expressions?.list?.length ?? 0;
    report([...tmcErrors, ...notes], `Compiled ${n} item(s) into the graph.`);
  }

  panel.querySelector("#tmcpp-run").onclick = run;
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
