# Changelog

## Unreleased

### Changed

- The old spelling `domain: @{ min, max }` is upgraded to `domain: @{ t: @{ min, max } }` (`theta` for `r = ...`), so graphs written for 0.2 keep their curve ranges.
- `. fraction` compiles to `fractionDisplay`, and a parametric's or polar curve's range to `domain: @{ t: @{ ... } }` (`theta` for polar), as the current Text Mode spells them.

### Added

- **`let`.** `let P = ...` defines a hidden helper that other lines use; From graph gives `let` back.
- **Call checks.** Calling a function with the wrong number of arguments, or naming a parameter `e`, `pi` or `tau`, is now a compile error instead of a silent error in Desmos.
- **`tmcpp check --runtime`.** Loads the graph in real Desmos and reports Desmos's own errors by TMC++ line, with the slider values used (`--at` sets them), plus unstyled helper point lists that get drawn by accident. `--json` for tools. The MCP `check` tool takes `runtime: true`.
- **`tmcpp describe`** and an MCP `describe` tool: sliders with ranges, functions and components with parameters, classes, colours and what each import brings in.
- **Version check.** `push` and `link_status` warn when the browser extension is older than `tmcpp`.
- **3D and orbital building blocks.** `std/3d` adds camera transforms and ray intersections. New `std/color` and `std/orbits` libraries provide palettes, lighting and Kepler motion. The solar-system example uses all three.
- **Current Text Mode.** TMC++ now bundles a build of DesModder's Text Mode library from its November 2026 source instead of the npm release from 2023, so `|x|`, regression parameters and `@{ id }` work, and `tmcpp check` agrees with the extension. No runtime dependencies are left.
- **Strings can span lines.** A note or label whose closing `"` is on a later line keeps its line breaks.
- **Example:** `examples/solar-system.tmcpp`, a 3D solar system ChatGPT wrote through the MCP server.
- **Absolute value multiplies like a bracket:** `2|x - 1|`, `a|x|` and `|x||y|` get their `*`.
- **`fill 0` makes an invisible button.** It compiles to a fill too faint to see, because Text Mode turns a fill of 0 into no fill, which can't be clicked. From graph shows `fill 0` again.
- **`tmcpp check` and `tmcpp preview`.** The npm command now compiles, checks and previews: `tmcpp check graph.tmcpp` validates the output with DesModder's own parser, and `tmcpp preview graph.tmcpp --out graph.png` renders it in real Desmos (`--at`, `--sweep`, `--width`, `--cols`, `--show`). `tmcpp compile graph.tmcpp` spells out the default command.
- **MCP server.** `tmcpp mcp` serves `compile`, `check` and `preview` tools over stdio, plus the syntax reference and the built-in libraries as resources, so AI apps can write and look at TMC++ graphs. No extra dependencies.
- **Desmos link.** Pair the browser extension with `tmcpp mcp` once (`tmcpp pair`, then ⋯ > Link to AI in the panel), and the AI can `push` graphs into your open Desmos tab, `pull` them back as TMC++ with your Desmos edits, and take a `screenshot`. Localhost only, extensions only, pairing code required.
- **Preview is an optional extra.** It uses `playwright-core`, declared as an optional peer dependency, so a plain install stays small. Without it, `tmcpp preview` says how to add it.

## 0.2.0 (2026-11-23): v2

v2 adds structure on top of v1's styles: components, conditionals, actions and libraries, plus a real editor.

### Added

- **Components.** `component Name(params) { ... }` and `new Name(args) as name`. Each instance gets its own folder and collision-free variable names. Includes members (`s1.d`), default and `abstract` parameters, nesting, stacked style tails, and list instances (`new Cell(i, j) for i = [1...9], j = [1...9] as cells`) that compile to one folder of Desmos lists.
- **`if` statements.** Inline `if c then a else b`, with `else if` chains, and block `if c { ... } else { ... }`, both compiled to piecewise.
- **Actions.** `n++`, `n--`, `n += e` (`-=`, `*=`, `/=`, `^=`), `mode++ % 3`, `on = 1` inside an action, `toggle(on)`, list element updates (`L[i] = v`, merged when one action changes several), `L.push(x)`, `L.pop()` and `reset()`. Warns when one action updates the same variable twice.
- **Libraries.** `import "x"`, `import "x" as ns` and `import { A, b } from "x"`, with collision-free names and pruning of anything unused. Imports come from local files, `gh:user/repo/path@ref`, raw GitHub and gist URLs, and github.com page links.
- **Built-in libraries:** `std/styles`, `std/ui`, `std/shapes`, `std/easing` and `std/3d`.
- **Scientific notation.** `3e-3` and `1.5E8`. Euler's `e` keeps its meaning whenever it isn't glued to a number with an exponent.
- **Round trip.** "From graph" gives back `new` lines, `if` blocks, imports and component definitions as written, while they're untouched in Desmos. Lines edited in Desmos get your variable names back.
- **Editor.** The panel uses CodeMirror 6, with TMC++ highlighting, compile errors underlined as you type, autocomplete, Ctrl+/ and search.
- **Library panel.** Save the current file as a library, fetch GitHub libraries (kept offline), and insert imports.
- **VS Code extension** (`vscode/`): syntax highlighting, live compile errors, and the commands "Show compiled TMC" and "Copy compiled TMC".
- **Packaging.** `npm run pack` builds `release/tmcpp-extension-<version>.zip`.
- **On npm** as `@ikeasourpatches/tmcpp`: `npx @ikeasourpatches/tmcpp graph.tmcpp`, or install it to get the `tmcpp` command.

### Changed

- **A number glued to `e` or `E` followed by an exponent is now scientific notation.** `2e-1` used to mean `2·e − 1`. To keep the old meaning, write `2 e - 1`.
- **`++`, `--` and `+=`-style operators are action syntax.** They weren't valid Desmos math before, so existing graphs are unaffected.
- **The panel header is simpler:** From graph, Library, a ⋯ menu (Open, Save, Copy TMC, Example) and Compile.
- **The metadata note is version 2.** Notes written by 0.1 still load.

## 0.1.0 (2026-11-20): v1

- **The compiler:** CSS-style classes, named colours, one-word style tokens, labels, slider shorthand and playback, settings, tables, tickers and folders.
- **The browser extension** for desmos.com: live compile, stable ids, a metadata note, a watermark seed, and "From graph" with inline overrides for edits made in Desmos.
- **Tools:** `tools/check.js` validates output with DesModder's own parser, and `npm run preview` renders a graph to a PNG.
