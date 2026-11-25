# TMC++ syntax reference

This page covers only what TMC++ adds to or changes in DesModder's Text Mode (TMC). Everything else is plain TMC and is documented by DesModder:

| Topic | TMC reference |
| --- | --- |
| Math: operators, functions, lists, ranges, piecewise, comprehensions, `sum`/`integral`, derivatives | [Math expressions](https://www.desmodder.com/text-mode/expressions/) |
| Equations, inequalities, sliders, regressions, visualizations | [Statements](https://www.desmodder.com/text-mode/statements/) |
| `@{ key: value }` style mappings | [Style mappings](https://www.desmodder.com/text-mode/style-mappings/) |
| Notes | [Text](https://www.desmodder.com/text-mode/text/) |
| Folders, tables, tickers, images, settings | [Folders](https://www.desmodder.com/text-mode/folders/) · [Tables](https://www.desmodder.com/text-mode/tables/) · [Tickers](https://www.desmodder.com/text-mode/tickers/) · [Images](https://www.desmodder.com/text-mode/images/) · [Settings](https://www.desmodder.com/text-mode/settings/) |

A raw `@{ ... }` is accepted wherever TMC accepts one, so any TMC option without a TMC++ word is still one line away.

## Pages

| Page | Covers |
| --- | --- |
| [Lines and math](basics.md) | one statement per line, continuation, comments, `let`, implicit multiplication, variable names, double inequalities, level curves, `segment` and `path`, restrictions, `\|x\|`, scientific notation, Greek letters |
| [Conditionals, actions and enums](logic.md) | inline and block `if`, action shortcuts (`n++`, `toggle`, `L.push`, `reset`), `enum` |
| [Styles](styles.md) | style tails, classes, named colours, and every token (colour, lines and fill, points, labels, sliders, click actions, item flags) |
| [Components](components.md) | `component`, `new`, members, abstract parameters, nesting, list instances |
| [Libraries](libraries.md) | `import` forms, private `_names`, where libraries come from, the built-in `std/` libraries |
| [Blocks and settings](blocks.md) | notes, folders, tables, tickers, images, `settings` |
| [What the compiler adds, and From graph](round-trip.md) | the watermark and metadata note, and how a graph turns back into TMC++ |
| [Errors and warnings](errors.md) | common messages and what they mean |

## Cheat sheet

```js
// settings and classes
settings x [-10 : 10] y [-6 : 6] no-grid
class ink { #2d70b3 width 4 }
class glow { #fa7e19 opacity 0 fill 0.3 }

"A note"

folder "Controls" collapsed {
  a = 1 [0 : 2pi : 0.01] . play loop 10s
  k = 2 [1 : 5 : 1]
}

y = k sin(x + a)          .ink
1 < x^2 + y^2 < 4         .glow
(0, k) #red point 10 drag y label "k = ${k}" above
segment((0, 0), (0, k))   . dotted
y = 2x {0 < x < 1}        // a restriction
r = 2 + cos(3θ)           // Greek, typed or by name

// actions and conditionals
score = 0
mode = 0
(3, -1) . point 12 click(score++, mode++ % 3)
y = if mode = 0 then x else -x

// libraries
import { Button } from "std/ui"

// components
component Dot(P, abstract n = 0) {
  P . point 12 click(n++) label "${n}"
}
new Dot((2, 1)) as d1
new Dot((4, 1), n = 5) as d2  . #red
total_clicks = d1.n + d2.n
new Dot((i, -3)) for i = [1...5] as row   // five dots in one folder of lists, each with its own n
```
