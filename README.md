# TMC with Classes (TMC++)

**Desmos graphs as code, with classes.** TMC++ is a preprocessor for [DesModder](https://www.desmodder.com/)'s Text Mode (TMC): it adds CSS-style classes, one-word styles, labels and slider shorthand, then compiles to plain TMC. A browser extension compiles it live inside desmos.com.

The name is a nod to C++, which started life as "C with Classes".

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
npm test                                  # 71 tests, including DesModder's real parser
node src/cli.js examples/sunset.tmcpp     # print TMC, or errors with line numbers
node tools/check.js examples/sunset.tmcpp # compile, then validate with DesModder's parser
```

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
- writes a hidden metadata note into the graph (classes, tags, tails, comments, hashes) so the graph remembers it was made with TMC++, and pops the panel open when you open such a graph

After changing the compiler, run `npm run build:ext` again and click reload on the extension card.

## Language

### Statements

- One statement per line. A `;` at the end is optional.
- A line continues when it ends in an operator, a comma or an open bracket, when the next line is indented and starts with an operator, or when it ends in `\`.
- `//` comments are allowed anywhere and are never sent to TMC.
- Write math naturally: TMC needs explicit `*`, so `4p`, `k sin(x)` and `(a)(b)` become `4 * p`, `k * sin(x)` and `(a) * (b)`. Function calls, keywords, `sum`/`product`/`integral` bodies and `(d/d x)` are left alone, and `.5` becomes `0.5`.
- Piecewise and list comprehensions are plain TMC: `y = {x > 0: 2x, -x}`, `L = [n^2 for n = [1...5]]`.

### Style tails

A tail starts at the first whitespace-preceded `.name`, `#`, `label "`, lone `.` or `@{`. Tokens apply left to right: classes, then inline tokens, then a raw `@{ }`; later wins.

```js
class curve { #c74440 dashed width 3 }   // define once (hoisted; ; separators allowed)
class thick { width 5 }
y = sin(x)  .curve .thick opacity 0.5     // stack classes, then override inline
y = cos(x)  . dotted                      // a lone . starts a tail with no class
```

A style word left in the math, as in `(1, 2) point 5`, is an error that tells you to add the `.`.

| Token | Meaning |
| --- | --- |
| `.name` | apply a class |
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
| `[min : max]`, `[min : max : step]` | slider bounds (go right after the math) |
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
| `examples/hello.tmcpp` | HELLO WORLD written stroke by stroke from 46 segments and one parametric expression (the extension's starter) |
| `examples/daycycle.tmcpp` | a looping 24-hour day over the sea: the sun and moon on opposite arcs, stars, dawn and dusk glow |
| `examples/sunset.tmcpp` | a sunset scene driven by one time-of-day slider |
| `examples/demo.tmcpp` | a parabola with a draggable focus |

## How it works

```
TMC++ --compile--> TMC --text-mode-core textToRaw--> Desmos state --Calc.setState--> graph
```

The compiler (`src/compile.js`) is a line-based preprocessor; all math parsing is left to DesModder's text-mode-core. In the extension, items then get stable ids (`t1`, `t2`, ...) and a secret metadata note records what Desmos can't hold (`src/meta.js`).

## Known limits

The npm release of text-mode-core (0.1.1) is older than the DesModder extension. `npm test` and `tools/check.js` therefore reject a few things the extension accepts, and the bundled extension inherits the same limits:

- `|x|` absolute value: use `abs(x)`
- `{y > 0}` restrictions: use a piecewise, such as `r < {y > 0: 0.9, -1}`
- regression parameter blocks `# { ... }`
- the `id` style option (TMC++ assigns ids itself)

## Roadmap

| Milestone | State |
| --- | --- |
| M1 line compiler | done |
| M2 classes, inline styles, labels, settings, playback, tables, tickers | done |
| M3 browser extension with live compile, stable ids and the metadata note | done |
| M4 decompile: rebuild TMC++ from a graph, with Desmos UI edits as inline overrides | next |
| v2 components, e.g. `Spring(m, c)` expanding to several expressions | planned |
| v2 `if` statements that compile to piecewise | planned |
| v3 MCP server so AI assistants can write TMC++ graphs | planned |

## License

MIT, see [LICENSE](LICENSE). Bundles DesModder's [text-mode-core](https://www.npmjs.com/package/@desmodder/text-mode-core) (MIT). TMC syntax reference: [DesModder Text Mode docs](https://www.desmodder.com/text-mode/).
