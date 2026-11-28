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
| [Lines and math](basics.md) | one statement per line, continuation, comments, [`let`](basics.md#helpers-with-let), implicit multiplication, variable names, double inequalities, level curves, `segment` and `path`, restrictions, `\|x\|`, scientific notation, Greek letters |
| [Conditionals, actions and enums](logic.md) | inline and block `if`, action shortcuts (`n++`, `toggle`, `L.push`, `reset`), `enum` |
| [Styles](styles.md) | style tails, classes, named colours, and every token (colour, lines and fill, points, labels, sliders, click actions, item flags) |
| [Components](components.md) | `component`, `new`, members, abstract parameters, nesting, list instances |
| [Lambdas, macros and loops](macros.md) | `(x) => ...` with `map`, `filter` and components; `macro`; compile-time `for`; `while` as a ticker |
| [Libraries](libraries.md) | `import` forms, private `_names`, where libraries come from, the built-in `std/` libraries |
| [Blocks and settings](blocks.md) | notes, folders, tables, tickers, images, `settings` |
| [What the compiler adds, and From graph](round-trip.md) | the watermark and metadata note, and how a graph turns back into TMC++ |
| [Errors and warnings](errors.md) | common messages and what they mean |

## Contents

Every section of the reference. Looking for one keyword? Search this page (Ctrl+F) for it.

<!-- contents:start -->
- [Lines and math](basics.md)
  - [Lines](basics.md#lines)
    - [Continuation lines](basics.md#continuation-lines)
    - [Multi-line strings](basics.md#multi-line-strings)
    - [Comments](basics.md#comments)
  - [Helpers with `let`](basics.md#helpers-with-let)
  - [Math](basics.md#math)
    - [Implicit multiplication](basics.md#implicit-multiplication)
    - [Variable names](basics.md#variable-names)
    - [Double inequalities](basics.md#double-inequalities)
    - [Level curves of your own functions](basics.md#level-curves-of-your-own-functions)
    - [Segments and paths](basics.md#segments-and-paths)
    - [Restrictions](basics.md#restrictions)
    - [Absolute value](basics.md#absolute-value)
    - [Regressions](basics.md#regressions)
    - [List comprehensions without brackets](basics.md#list-comprehensions-without-brackets)
    - [Expressions in style values and slider bounds](basics.md#expressions-in-style-values-and-slider-bounds)
    - [Scientific notation](basics.md#scientific-notation)
    - [Greek letters and Unicode](basics.md#greek-letters-and-unicode)
- [Conditionals, actions and enums](logic.md)
  - [Conditionals](logic.md#conditionals)
    - [Inline if](logic.md#inline-if)
    - [Block if](logic.md#block-if)
  - [Actions](logic.md#actions)
    - [Action shortcuts](logic.md#action-shortcuts)
  - [Enums](logic.md#enums)
- [Styles: tails, classes, colours and tokens](styles.md)
  - [Style tails](styles.md#style-tails)
  - [Classes](styles.md#classes)
  - [Named colours](styles.md#named-colours)
  - [Token reference](styles.md#token-reference)
    - [Colour](styles.md#colour)
    - [Lines and fill](styles.md#lines-and-fill)
    - [Points](styles.md#points)
    - [Labels](styles.md#labels)
    - [Sliders](styles.md#sliders)
    - [Click actions](styles.md#click-actions)
    - [Item flags](styles.md#item-flags)
- [Components](components.md)
  - [Parameters](components.md#parameters)
  - [Abstract parameters](components.md#abstract-parameters)
  - [Locals](components.md#locals)
  - [Sliders, clicks and folders](components.md#sliders-clicks-and-folders)
  - [Components inside components](components.md#components-inside-components)
  - [List instances](components.md#list-instances)
  - [From graph](components.md#from-graph)
- [Lambdas, macros and loops](macros.md)
  - [Lambdas](macros.md#lambdas)
  - [Macros](macros.md#macros)
  - [For loops](macros.md#for-loops)
    - [Loops that count over a component parameter](macros.md#loops-that-count-over-a-component-parameter)
  - [While loops](macros.md#while-loops)
- [Libraries](libraries.md)
  - [Internal names stay distinct](libraries.md#internal-names-stay-distinct)
  - [Macros in libraries](libraries.md#macros-in-libraries)
  - [Private names](libraries.md#private-names)
  - [Only what's used comes in](libraries.md#only-whats-used-comes-in)
  - [Libraries that import libraries](libraries.md#libraries-that-import-libraries)
  - [Where libraries come from](libraries.md#where-libraries-come-from)
  - [Built-in libraries](libraries.md#built-in-libraries)
    - [std/3d: 3D geometry in the 2D calculator](libraries.md#std3d-3d-geometry-in-the-2d-calculator)
    - [std/color: computed colour](libraries.md#stdcolor-computed-colour)
    - [std/orbits: Kepler orbits](libraries.md#stdorbits-kepler-orbits)
  - [The Library panel](libraries.md#the-library-panel)
- [Blocks and settings](blocks.md)
  - [Blocks](blocks.md#blocks)
    - [Settings](blocks.md#settings)
- [What the compiler adds, and From graph](round-trip.md)
  - [What the compiler adds](round-trip.md#what-the-compiler-adds)
    - [Rebuilding source from a graph](round-trip.md#rebuilding-source-from-a-graph)
- [Errors and warnings](errors.md)
<!-- contents:end -->

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

// helpers and enums
let M = (2, 2)                              // used by other lines, never drawn
phase = enum(idle, running)
M . point 10 click(phase++)

// lambdas, macros and loops (all worked out when compiling)
sq = map([1...5], (v) => v^2)
macro Ring(r, look) {
  x^2 + y^2 = r^2  look
}
Ring(3, #blue dashed)
for j in [1...3] {
  b_{j} = j [0 : 5]
}
steps = 0
while steps < 10 {
  steps++
}
```
