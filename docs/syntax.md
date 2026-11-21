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

Contents: [Lines](#lines) · [Math](#math) · [Style tails](#style-tails) · [Classes](#classes) · [Named colours](#named-colours) · [Token reference](#token-reference) · [Blocks](#blocks) · [What the compiler adds](#what-the-compiler-adds) · [Errors and warnings](#errors-and-warnings) · [Cheat sheet](#cheat-sheet)

## Lines

One statement per line. TMC needs a `;` after each statement; TMC++ adds it.

```js
a = 1
b = 2;          // a trailing ; is allowed and ignored
```

A statement continues onto the next line when the line:

- ends in an operator (`+ - * / ^ = < >`) or a comma,
- has an unclosed `(`, `[` or `{`,
- ends in `\`, or
- is followed by a line that is indented deeper and starts with an operator.

```js
f(x) = (x^2 +
  1)
g(x) = x
    - 3
h(x) = sin(x) \
  + cos(x)
```

`//` starts a comment anywhere outside a string. Comments never reach TMC; the extension stores them in the graph's metadata note.

Not carried over from TMC: one-line blocks such as `folder "A" { y = x; }`. Put each statement on its own line.

## Math

Math is TMC math with four conveniences.

**Juxtaposition.** TMC requires an explicit `*`; TMC++ inserts it.

| You write | TMC gets |
| --- | --- |
| `4p` | `4 * p` |
| `k sin(x)` | `k * sin(x)` |
| `(x + 1)(x - 1)` | `(x + 1) * (x - 1)` |
| `2(x)` | `2 * (x)` |
| `.5` | `0.5` (TMC needs the leading zero) |

Left alone: function calls `f(x)`, multi-letter names `total`, keywords such as `for`, the body of `sum n=(1...5) n`, `product` and `integral x=(0 ... 5) x^2`, and whatever follows `(d/d x)`.

**Variable names.** Desmos only accepts one-letter names with an optional subscript (`a`, `X_1`, `s_{core}`). TMC++ lets you write real names and renames them consistently everywhere (math, slider bounds, style values, tickers and `${...}` in labels):

| You write | Desmos gets |
| --- | --- |
| `score` | `s_core` |
| `hello_world` | `h_elloworld` |
| `total`, `width` (Desmos functions, used as variables) | `t_otal`, `w_idth` |
| `total(L)`, `sin(x)` (calls of built-ins) | unchanged |
| `theta`, `alpha_2`, `X_1`, `a1`, `P.x` | unchanged |
| `"Score: ${score}"` | `"Score: ${s_core}"` |

Two names that end up the same (`hello_world` and `helloworld`) get a warning. Interpolation already written in Desmos's form, like `${s_{core}}`, is left alone.

**Double inequalities.** Desmos only draws `a < f < b` when `f` is `x` or `y`. TMC++ rewrites the rest:

```js
r(x,y) = sqrt(x^2 + y^2)
2.49 < r(x,y) < 2.98          // becomes max(2.49 - r(x,y), r(x,y) - 2.98) < 0: a ring
1 <= x^2 + y^2 <= 4           // <= stays <=
-x < y < x                    // solved: left for Desmos
```

The bounds can be any math, including piecewise. Both comparisons must point the same way.

**Level curves of your own functions.** After `q(x,y) = ...`, writing `q(x,y) = [0.5, 0.6]` would redefine `q` in Desmos. TMC++ draws the curves instead, as `q(x,y) - ([0.5, 0.6]) = 0`, and warns you.

```js
q(x,y) = x^2 + 4y^2
q(x,y) = [1, 4, 9]
```

**Segments and paths.** Desmos's graphing calculator has no `segment()` (only its Geometry calculator does). TMC++ adds two helpers, used as a whole statement:

```js
segment((0, 0), (3, 2))  #red width 4
segment([(0, 0), (1, 1)],
        [(2, 0), (2, 2)])                  // pairs of start and end points: one line each
C = [(-10, 2), (-8, 3), (-6, 2.5), (-5, 1)]
path(C)  #blue width 3                     // joins the points in order
```

- `segment(A, B)` compiles to `(1 - t) * (A) + t * (B)`. `A` and `B` can be points or equal-length lists of points, and can move with sliders.
- `path(P)` draws a segment between each pair of neighbouring points in `P` (a name or a literal list).
- The line is drawn with the parameter `t`, so the points themselves can't use `t`.
- Use them for anything drawn as strokes: lettering, branches, constellations, rigging.

**Expressions in style values and slider bounds.** Slider bounds are math (`[0 : 2pi]`). `fill`, `opacity`, `width`, `point-opacity` and `label-size` take a number or an expression written without spaces (`fill 0.8*(1-t)^2`).

## Style tails

Everything after the math that styles it is the tail. It starts at the first of these that follows a space:

| Starts a tail | Example |
| --- | --- |
| `.name` (a class) | `y = x .curve` |
| `#` (a colour) | `y = x #red` |
| a lone `.` | `y = x . dashed` |
| `label "` | `(1, 2) label "A"` |
| `@{` | `y = x @{ color: RED }` |

Slider bounds come between the math and the tail: `a = 1 [0 : 5] . play`.

Tokens apply left to right. When two set the same property, the later one wins: classes in the order written, then inline tokens, then a raw `@{ }`.

```js
class curve { #c74440 dashed width 3 }
class thick { width 5 }
y = sin(x) .curve .thick opacity 0.5     // width 5 (thick after curve), opacity 0.5
y = cos(x) .curve @{ lines: @{ width: 8 } }   // raw @{ } has the last word
```

A style word left inside the math, as in `(1, 2) point 5`, is an error that tells you to start the tail with `.`.

## Classes

```js
class glow {
  #fa7e19
  opacity 0
  fill 0.3
}
class tag { above label-size 1.2; no-outline }
(1, 1) .tag label "T"
x^2 + y^2 < 4 .glow
```

- `class name { tokens }`, using the same tokens as a tail. Tokens are separated by spaces, `;` or newlines.
- Definitions are hoisted: use a class above its definition if you like.
- Stack as many as you want: `.a .b .c`.
- Defining a name twice or using an undefined class is an error (with a "did you mean" hint).
- Classes exist only in TMC++. The extension records them in the graph's metadata note.

## Named colours

```js
color water #092635
color honey #ffd588
class glow { #honey opacity 0 fill 0.4 }
y > -100  #water fill 1
x^2 + y^2 < 4  .glow
```

- `color name #rrggbb` (or `#rgb`) defines a colour; `#name` then works anywhere a colour does, including inside classes.
- Names are case-insensitive, hoisted like classes, and can't shadow a built-in (`#red`) or look like a hex code (`#abc`).
- Use them for a palette instead of one-colour classes: `#water .wash` reads better than `.water .wash`, and colours stay separate from styles.
- A line like `color = 5` is still math: only `color name #hex` defines a colour.

## Token reference

### Colour

| Token | TMC |
| --- | --- |
| `#c74440` or `#abc` | `color: "#c74440"` |
| `#red` `#blue` `#green` `#purple` `#orange` `#black` | `color: RED` etc. |
| `#name` after `color name #rrggbb` | `color: "#rrggbb"` |
| `#(expression)`, e.g. `#(c_1)`, `#(rgb(100, 136, 234))` | `color: c_1`: a colour computed by Desmos, which can change with sliders |

### Lines and fill

| Token | TMC |
| --- | --- |
| `solid` `dashed` `dotted` | `lines: @{ style: "DASHED" }` |
| `width N` | `lines: @{ width: N }` |
| `opacity N` | `lines: @{ opacity: N }` |
| `fill N` | `fill: N` |

### Points

| Token | TMC |
| --- | --- |
| `point N` | `points: @{ size: N }` |
| `point-opacity N` | `points: @{ opacity: N }` |
| `open` `cross` | `points: @{ style: "OPEN" }` |
| `drag x` `y` `xy` `none` `auto` | `points: @{ drag: "X" }` etc. |

### Labels

| Token | TMC |
| --- | --- |
| `label "text"` | `label: @{ text: "text" }`; `${p}` shows the live value of `p` |
| `above` `below` `left` `right` `center` `above-left` `above-right` `below-left` `below-right` `above-auto` `below-auto` `auto-left` `auto-right` `center-auto` `auto-center` `default` | `label: @{ orientation: "above_left" }` etc. |
| `label-size N` | `label: @{ size: N }` |
| `label-angle N` | `label: @{ angle: N }` |
| `no-outline` | `label: @{ outline: false }` |
| `hover` | `label: @{ showOnHover: true }` |
| `editable` / `editable-math` | `label: @{ editableMode: "TEXT" }` / `"MATH"` |

```js
(0, 2) #blue point 9 label "focus (0, ${p})" right
p = 2
```

### Sliders

| Syntax | TMC |
| --- | --- |
| `[min : max]` | `slider: @{ min, max, step: 0 }` |
| `[min : max : step]` | `slider: @{ min, max, step }` |
| `play` | `slider: @{ playing: true }` |
| `loop` `bounce` `once` `forever` | `loopMode: "LOOP_FORWARD"` / `"LOOP_FORWARD_REVERSE"` / `"PLAY_ONCE"` / `"PLAY_INDEFINITELY"` |
| `reverse` | `reversed: true` |
| `40s`, `500ms` | `period: 40000` / `500` (one pass) |

```js
t = 0 [0 : 24 : 0.05] . play loop 40s
a = 0.7 [0 : 2pi] . bounce 8s
```

### Click actions

| Token | TMC |
| --- | --- |
| `click(action)` | `onClick: action`: clicking the shape runs it |
| `click(a -> 1, b -> 0)` | several actions at once (bracketed for TMC) |
| `click-label "text"` | `clickDescription: "text"` (read by screen readers) |

```js
s = 0
restart = s -> 0
polygon((0, 0), (2, 0), (0, 2))  #blue fill 0.8 click(s -> s + 1)
(x - 5)^2 + y^2 <= 1  #red click(restart) click-label "Restart"
```

`click(` also starts a tail by itself, like `label "`.

### Item flags

| Token | TMC |
| --- | --- |
| `hidden` | `hidden: true` |
| `pinned` | `pinned: true` |
| `secret` | `secret: true` (hidden from viewers of a shared graph) |
| `fraction` | `displayEvaluationAsFraction: true` |

## Blocks

| Syntax | Notes |
| --- | --- |
| `"text"` | a note |
| `folder "Name" [collapsed] [hidden] { ... }` | one statement per line inside; folders can't nest |
| `table [pinned] [secret] { ... }` | each column takes its own tail; tables can sit inside folders but not in each other |
| `ticker <action> [play] [2s]` | `play` and a minimum step time (`minStep`) |
| `image "name" @{ ... }` | plain TMC |
| `settings ...` | see below |

```js
folder "Data" collapsed {
  table {
    X = [1, 2, 3]
    Y = [4, 5, 6] . drag xy open
  }
}
ticker n -> n + 1 . play 500ms
n = 0
```

### Settings

```js
settings x [-12 : 12] y [-7.5 : 7.5] degrees no-grid lock @{ showXAxis: false }
```

| Token | TMC |
| --- | --- |
| `x [a : b]`, `y [a : b]` | `viewport: @{ xmin, xmax }` / `@{ ymin, ymax }` |
| `degrees` / `radians` | `degreeMode: true` / `false` |
| `no-grid` | `showGrid: false` |
| `lock` | `lockViewport: true` |
| `@{ ... }` | any [TMC setting](https://www.desmodder.com/text-mode/settings/) |

Stacked fills are often better as one list: `y < [-4.85, -4.3 ... 7.8] #deep fill 0.05` draws 24 bands as one graph item.

Every `settings` line merges over the previous ones, key by key, starting from a default viewport of -10 to 10 on both axes.

## What the compiler adds

- A `settings` block at the top with the default viewport and any `settings` lines you wrote.
- A watermark: a `randomSeed` starting with `544d432b2b` ("TMC++" in ASCII hex), unless you set `randomSeed` yourself. The same source always gets the same seed.
- In the extension only: stable item ids (`t1`, `t2`, ...) and a hidden metadata note that records classes, tags, tails, comments and hashes.

### Rebuilding source from a graph

The extension's **From graph** button turns a graph back into TMC++, using the metadata note:

| In the graph | Comes back as |
| --- | --- |
| a line you haven't touched | exactly what you wrote (math and tail) |
| a line you restyled in Desmos | its classes plus only what changed, e.g. `.curve width 5` |
| math you edited in Desmos | the new math converted to TMC, with your tail |
| a slider whose bounds you changed | regenerated `[min : max : step]` and playback tokens |
| an item you added in Desmos | its math and any styling, without Desmos's automatic colour |
| a graph made without TMC++ | every item with its colours (including colour variables, as `#(c_1)`), fills and other styling |
| a deleted item that had comments | the comments, at the end under `// orphaned comments` |

`settings` lines come back as written, so panning or zooming in Desmos doesn't change your source. Comments are placed above the item they belonged to.

## Errors and warnings

Every message names the TMC++ line. Common ones:

| Message | Meaning |
| --- | --- |
| `Unknown class '.curv' (did you mean '.curve'?)` | class not defined |
| `Unknown color '#watr' (did you mean '#water'?)` | colour not defined |
| `Unknown style token 'dashd' (did you mean 'dashed'?)` | not in the token reference |
| `Style word 'point' is inside the math` | add a `.` before the first style word |
| `Folders cannot be nested` | Desmos has no folders in folders |
| `A double inequality must point one way` | `a < f > b` |
| `segment() takes two points` / `path() takes one list of points` | wrong number of arguments |
| `'label' needs a string` | write `label "text"` |
| `q is defined on line N, so this is drawn as the curve ...` (warning) | the level-curve rewrite happened |
| `TMC: ...` (extension) | DesModder's parser rejected the compiled line |

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
```
