# TMC++

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
| M2 classes and inline styles | done |
| M3 live compile in desmos.com (`textToRaw`, ids, metadata note) | next |
| M4 decompile and diff | |
| M5 editor panel | |

## Use

Requires Node 22+.

```sh
npm test                          # run the test suite
node src/cli.js examples/demo.tmcpp   # print TMC, or errors with line numbers
```

Paste the output into DesModder's Text Mode (the T button above the expression list).

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
| `@{ ... }` | raw TMC style, passed through last |

A tail starts at the first whitespace-preceded `.name`, `#`, lone `.` or `@{`. Order: classes left to right, then inline tokens, then raw `@{ }`; later wins.

Spec: see the TMC++ v1 Spec doc.

License: MIT.
