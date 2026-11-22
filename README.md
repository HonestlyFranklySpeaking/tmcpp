# TMC with Classes (TMC++)

**Desmos graphs as code, with classes.** TMC++ is a preprocessor for [DesModder](https://www.desmodder.com/)'s Text Mode (TMC): it adds CSS-style classes, one-word styles, labels, slider shorthand and reusable components, then compiles to plain TMC. A browser extension compiles it live inside desmos.com.

The name is a nod to C++, which started life as "C with Classes".

[![EVENT HORIZON: a black hole poster drawn entirely with equations in TMC++, embers orbiting the disk](docs/event-horizon.gif)](docs/event-horizon.png)

*`examples/event-horizon.tmcpp`, written by ChatGPT in TMC++: a tilted accretion disk, lensed light, orbiting embers and poster typography, all equations. 104 lines, 71 Desmos items. Click for the full-resolution still.* [See Desmos graph.](https://www.desmos.com/calculator/91wpdzmsmn)

```js
class curve { #c74440 dashed width 3 }

"Parabola demo"

folder "Controls" collapsed {
  p = 2  [0.1 : 10 : 0.1]
}

folder "Curves" {
  y = x^2 / (4p)   .curve
  (0, p)           #blue point 12 drag y  label "focus" right
  y < sin(x)       .curve fill 0.3
}
```

The same graph in plain TMC needs a nested `@{ }` style block on almost every line. If you already know TMC, most of it works as is, and a raw `@{ ... }` is always accepted. The exceptions come from TMC++'s line rules: put each statement on its own line (no one-line folders like `folder "A" { y = x; }`), and start a style block on the same line as its math.

## Quick start

Requires Node 22+.

```sh
npm install
npm test                                  # compiler and DesModder parser tests
node src/cli.js examples/sunset.tmcpp     # print TMC, or errors with line numbers
node tools/check.js examples/sunset.tmcpp # compile, then validate with DesModder's parser
```

The CLI also reads TMC++ from standard input when no file is given. `tools/check.js` accepts either a `.tmcpp` source file or an already compiled `.tmc` file. Compile diagnostics identify source lines; parser diagnostics from `tools/check.js` identify lines in the generated TMC.

### Preview in real Desmos

```sh
npm run preview -- examples/glass-choir.tmcpp                          # one frame -> glass-choir.preview.png
npm run preview -- examples/glass-choir.tmcpp --at a=1.2 d=-0.5        # set sliders first
npm run preview -- examples/glass-choir.tmcpp --sweep a=0..2pi/9       # 9 frames of a loop as a contact sheet
npm run preview -- examples/hello.tmcpp --sweep s=0..=1/5 --out hello.png   # ..= includes the end value
```

The parser only proves the equations are valid; the preview shows the composition, such as a moving shape crossing a title at some slider values. It renders with Desmos itself (`Calc.asyncScreenshot`) in your installed Chrome or Edge, headless, so it needs internet access to desmos.com but no extra browser download. Add `--show` to watch it, `--width` and `--cols` to size the output.

Paste the printed TMC into DesModder's Text Mode (the T button above the expression list), or use the extension below.

## Browser extension

1. `npm install`, then `npm run build:ext` (writes `extension/dist/tmcpp.js`).
2. In Chrome open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the `extension` folder.
3. Open desmos.com/calculator and click **TMC++** (bottom right) or press Alt+T.
4. Write TMC++ and press Ctrl+Enter. The whole graph is replaced; Ctrl+Z in Desmos undoes it (two presses).

The panel:

- lists errors by TMC++ line, from both the compiler and the TMC parser; click one to jump to it
- **Open** loads a `.tmcpp` file and compiles it (or drop the file onto the editor); **Save** downloads the editor text as `<graph-title>.tmcpp`
- **Example** loads a hello-world that writes itself; **Copy TMC** copies the compiled TMC
- saves your source per graph in the browser and follows you when you switch graphs
- **From graph** rebuilds TMC++ from the graph as it is now. Untouched lines come back exactly as you wrote them; lines you restyled in Desmos come back as their classes plus only the changed tokens (`.curve width 5`); math edited in Desmos is converted back; items added in Desmos appear without their automatic colour. Opening a TMC++ graph this browser has no source for rebuilds it automatically.
- watermarks the graph: its hidden `randomSeed` starts with `544d432b2b`, which is "TMC++" in ASCII hex, and is kept across recompiles so `random()` doesn't reshuffle (a seed you set in `settings` always wins)
  - Desmos hashes randomSeed with MD5 per expression; thanks to MD5's avalanche effect, the fixed prefix has zero impact on randomness quality as long as the remaining 80 bits vary with your source.
- writes a hidden metadata note into the graph (classes, tags, tails, comments, hashes) so the graph remembers it was made with TMC++, and pops the panel open when you open such a graph

After changing the compiler, run `npm run build:ext` again and click reload on the extension card.

## Language

**Full reference: [docs/syntax.md](docs/syntax.md)**, covering every TMC++ addition, with links to DesModder's docs for plain TMC. The summary below covers the essentials.

### Statements

- One statement per line. A `;` at the end is optional.
- A line continues when it ends in an operator, a comma or an open bracket, when the next line is indented and starts with an operator, or when it ends in `\`.
- `//` comments are allowed anywhere and are never sent to TMC.
- Write math naturally: TMC needs explicit `*`, so `4p`, `k sin(x)` and `(a)(b)` become `4 * p`, `k * sin(x)` and `(a) * (b)`. Function calls and keywords stay intact. The compiler keeps the body of `sum`/`product`/`integral` and the expression after `(d/d x)` attached to their operators, while still inserting multiplication within those expressions. `.5` becomes `0.5`.
- Piecewise and list comprehensions are plain TMC: `y = {x > 0: 2x, -x}`, `L = [n^2 for n = [1...5]]`.
- Name variables freely: `score`, `hello_world` and even `total` become names Desmos accepts (`s_core`, `h_elloworld`, `t_otal`), including inside `${...}` in labels.
- Double inequalities work on anything: Desmos only draws `a < f < b` when `f` is `x` or `y`, so TMC++ rewrites the rest to `max(a - f, f - b) < 0`. `2.49 < r(x,y) < 2.98` draws a ring, and the bounds can be piecewise.
- Drawing level curves of a function you defined just works: `q(x,y) = [0.5, 0.6]` after `q(x,y) = ...` would redefine `q` in Desmos, so it becomes `q(x,y) - ([0.5, 0.6]) = 0` (with a warning saying so).
- `segment(A, B)` and `path(P)` draw straight lines between points or lists of points (Desmos's graphing calculator has no `segment()`).
- Files can be UTF-8 or UTF-16 (what Windows PowerShell's `>` writes).

### Style tails

A tail starts at the first whitespace-preceded `.name`, `#`, `label "`, `click(`, lone `.` or `@{`. Tokens apply left to right: classes, then inline tokens, then a raw `@{ }`; later wins.

```js
class curve { #c74440 dashed width 3 }   // define once (hoisted; ; separators allowed)
class thick { width 5 }
color sea #2d70b3                         // a named colour, used as #sea
y = sin(x)  .curve .thick opacity 0.5     // stack classes, then override inline
y = cos(x)  . dotted                      // a lone . starts a tail with no class
```

A style word left in the math, as in `(1, 2) point 5`, is an error that tells you to add the `.`.

| Token | Meaning |
| --- | --- |
| `.name` | apply a class |
| `#name` | a colour you defined with `color name #rrggbb` |
| `#(c_1)`, `#(rgb(100, 136, 234))` | a colour expression |
| `click(s -> s + 1)`, `click-label "text"` | run an action when the shape is clicked |
| `#c74440`, `#red` `#blue` `#green` `#purple` `#orange` `#black` | colour |
| `solid` `dashed` `dotted` | line style |
| `width N`, `opacity N` | line width and opacity |
| `fill N` | fill opacity |
| `point N`, `point-opacity N` | point size and opacity |
| `open` `cross` | point style |
| `drag x\|y\|xy\|none\|auto` | point drag mode |
| `hidden` | hide the graph |
| `pinned` `secret` `fraction` | pin, hide from viewers, show the result as a fraction |
| `label "text"` | label; `${p}` interpolation passes through |
| `above` `below-left` `right` ... | label position (all 16 Desmos orientations, hyphenated) |
| `label-size N`, `label-angle N`, `no-outline`, `hover`, `editable`, `editable-math` | label options |
| `[min : max]`, `[min : max : step]` | slider bounds (go right after the math); bounds are math, so `[0 : 2pi]` works |
| `play`, `loop` `bounce` `once` `forever`, `reverse`, `40s` `500ms` | slider playback |
| `@{ ... }` | raw TMC style, merged in last |

`fill`, `opacity`, `width` and `point-opacity` also take an expression written without spaces, such as `fill 0.8*(1-t)^2`.

### Blocks and items

| Syntax | Notes |
| --- | --- |
| `"text"` | note |
| `folder "Name" [collapsed] [hidden] { ... }` | no folders inside folders |
| `table [pinned] [secret] { ... }` | columns take tails (`Y = [4, 5, 6] . drag xy`); tables can sit inside folders |
| `ticker a -> a + 1 . play 2s` | `play` and a step time (`minStep`) |
| `image "name" @{ ... }` | plain TMC |
| `settings x [-10 : 10] y [-6 : 6] degrees no-grid lock` | merged over a default viewport of -10 to 10; add a raw `@{ }` for anything else |

## Examples

| File | What it shows |
| --- | --- |
| `examples/night-net.tmcpp` | NIGHT NET, a playable game: drag the net to catch falling gold stars and let the red meteors drop. A ticker runs the game loop, a clickable PLAY button (`@{ onClick: start }`) resets it, and it tracks lives, score and best score |
| `examples/glass-choir.tmcpp` | THE GLASS CHOIR (by ChatGPT): a deep-sea dive with a sonar ping, 13 lanternfish that light up as the echo passes, a glass jelly and a submarine; uses a 19-colour `color` palette, one list inequality for 24 water bands, and `segment()` for the coral (232 items) |
| `examples/event-horizon.tmcpp` | EVENT HORIZON (by ChatGPT): a black hole poster with a lensed photon ring, a disk that passes in front of the shadow (`max(..., v) < 0`), 12 glowing embers on one slider, and label typography |
| `examples/hello.tmcpp` | HELLO WORLD written stroke by stroke from 46 segments and one parametric expression (the extension's starter) |
| `examples/daycycle.tmcpp` | a looping 24-hour day over the sea: the sun and moon on opposite arcs, stars, dawn and dusk glow |
| `examples/sunset.tmcpp` | a sunset scene driven by one time-of-day slider |
| `examples/demo.tmcpp` | a parabola with a draggable focus |
| `examples/prism-post.tmcpp` | PRISM POST, a three-level laser-routing puzzle. Rotate eight mirrors to send a pulse through both diamond stamps and into the cyan mail slot. Each Mirror instance handles its own clicks, draws its current angle, and redirects the beam. |

## How it works

```
TMC++ --compile--> TMC --text-mode-core textToRaw--> Desmos state --Calc.setState--> graph
```

Going back, `src/decompile.js` rebuilds TMC++ from a graph state using the metadata note, recompiling each tail to compare it with what Desmos holds, and `src/latex.js` turns Desmos LaTeX back into TMC math.

The compiler (`src/compile.js`) is a line-based preprocessor. It rewrites some math syntax, including implicit multiplication and restrictions, before DesModder's text-mode-core parses the generated TMC. In the extension, items then get stable ids (`t1`, `t2`, ...) and a secret metadata note records what Desmos can't hold (`src/meta.js`).

## Known limits

The npm release of text-mode-core (0.1.1) is older than the DesModder extension. `npm test` and `tools/check.js` therefore reject a few things the extension accepts, and the bundled extension inherits the same limits:

- `|x|` absolute value: use `abs(x)`
- regression parameter blocks `# { ... }`
- the `id` style option (TMC++ assigns ids itself)
- Greek letters other than `alpha beta theta phi pi tau`, and restrictions like `y = x {x > 0}`: TMC++ handles both itself (see the syntax reference), so they only matter if you write plain TMC

## Roadmap

| Milestone | State |
| --- | --- |
| M1 line compiler | done |
| M2 classes, inline styles, labels, settings, playback, tables, tickers | done |
| M3 browser extension with live compile, stable ids and the metadata note | done |
| M4 decompile: rebuild TMC++ from a graph, with Desmos UI edits as inline overrides | done |
| M5 components: `component Spring(A, B) { ... }` and `new Spring(...) as s1` | done |
| M6 components inside components, `p.a.n` paths, stacked tails | done |
| M7 list instances: `new Cell(i, j) for i = [1...9], j = [1...9] as cells` | done |
| M8 round trip: "From graph" gives back `new` lines | planned |
| M9, M10 `if` statements to piecewise, merged ticker actions | planned |
| M11 ship v2 (Tritime and Minesweeper showcases); M12 libraries | planned |
| v3 MCP server so AI assistants can write TMC++ graphs | planned |

## License

MIT, see [LICENSE](LICENSE). Bundles DesModder's [text-mode-core](https://www.npmjs.com/package/@desmodder/text-mode-core) (MIT). TMC syntax reference: [DesModder Text Mode docs](https://www.desmodder.com/text-mode/).
