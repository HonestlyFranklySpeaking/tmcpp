# TMC with Classes (TMC++)

A preprocessor for [DesModder](https://www.desmodder.com/) Text Mode (TMC). It adds CSS-style classes, one-word styles and short slider syntax, then compiles to plain TMC.

```js
class curve { #c74440 dashed width 3 }

"Parabola demo"

folder "Controls" collapsed {
  p = 2  [0.1 : 10 : 0.1]
}

folder "Curves" {
  y = x^2 / (4p)   .curve
  (0, p)           #blue point 12 drag y
  y < sin(x)       .curve fill 0.3
}
```

## Status

| Milestone | State |
| --- | --- |
| M1 line compiler (statements, notes, folders, sliders, continuation) | done |
| M2 classes and inline styles, labels, settings, slider playback | done |
| M3a browser extension: live compile panel in desmos.com | done |
| M3b ids and metadata note (round trip) | next |
| M4 decompile and diff | |
| M5 editor panel | |

## Use

Requires Node 22+.

```sh
npm test                          # run the test suite
node src/cli.js examples/demo.tmcpp     # print TMC, or errors with line numbers
node tools/check.js examples/demo.tmcpp # validate with DesModder's real parser
```

Paste the output into DesModder's Text Mode (the T button above the expression list).

## Browser extension

1. `npm install` then `npm run build:ext` (writes `extension/dist/tmcpp.js`).
2. Chrome: `chrome://extensions`, turn on Developer mode, **Load unpacked**, pick the `extension` folder.
3. Open desmos.com/calculator and click **TMC++** (bottom right) or press Alt+T.
4. Write TMC++ and press Ctrl+Enter. The graph is replaced; Ctrl+Z in Desmos undoes it. Your source is saved per graph in the browser.

After changing the compiler, run `npm run build:ext` again and click the reload icon on the extension card.

## Style vocabulary

| Token | Meaning |
| --- | --- |
| `.name` | apply a class |
| `#c74440`, `#red` `#blue` `#green` `#purple` `#orange` `#black` | colour |
| `solid` `dashed` `dotted` | line style |
| `width N`, `opacity N` | line width and opacity |
| `fill N` | fill opacity |
| `point N` | point size |
| `drag x\|y\|xy\|none\|auto` | point drag mode |
| `hidden` | hide the graph |
| `label "text"` | label (also starts a tail by itself); `${p}` interpolation passes through |
| `above` `below-left` `right` ... | label position (all 16 Desmos orientations) |
| `label-size N`, `label-angle N`, `no-outline`, `hover`, `editable`, `editable-math` | label options |
| `play` | slider plays |
| `loop` `bounce` `once` `forever` | slider loop mode |
| `reverse` | slider runs backwards |
| `40s`, `500ms` | slider period |
| `open` `cross` | point style |
| `point-opacity N` | point opacity |
| `pinned` `secret` `fraction` | pin, hide from viewers, show result as a fraction |

## Blocks and items

| Syntax | Notes |
| --- | --- |
| `"text"` | note |
| `folder "Name" [collapsed] [hidden] { ... }` | no folders inside folders |
| `table [pinned] [secret] { ... }` | columns take style tails (`Y = [4, 5, 6] . drag xy`); tables can sit inside folders |
| `ticker a -> a + 1 . play 2s` | `play` and a step time (`minStep`) |
| `image "name" @{ ... }` | plain TMC |
| `settings x [-10 : 10] y [-6 : 6] degrees no-grid lock` | merged over the default viewport; a raw `settings @{ }` works too |
| `// comment` | not sent to TMC |
| `@{ ... }` | raw TMC style, passed through last |

A tail starts at the first whitespace-preceded `.name`, `#`, lone `.` or `@{`. Order: classes left to right, then inline tokens, then raw `@{ }`; later wins.

Spec: see the TMC++ v1 Spec doc.

License: MIT.
