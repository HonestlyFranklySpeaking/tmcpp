# Styles: tails, classes, colours and tokens

[Syntax reference](README.md) · [Lines and math](basics.md) · [Conditionals, actions and enums](logic.md) · **Styles** · [Components](components.md) · [Lambdas, macros and loops](macros.md) · [Libraries](libraries.md) · [Blocks and settings](blocks.md) · [What the compiler adds, and From graph](round-trip.md) · [Errors and warnings](errors.md)

## Style tails

Everything after the math that styles it is the tail. It starts at the first of these that follows a space:

| Starts a tail | Example |
| --- | --- |
| `.name` (a class) | `y = x .curve` |
| `#` (a colour) | `y = x #red` |
| a lone `.` | `y = x . dashed` |
| `label "` | `(1, 2) label "A"` |
| `click(` | `(1, 2) click(n -> n + 1)` |
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
| `fill N` | `fill: N`. `fill 0` writes `fill: 0.0000001`: Text Mode turns 0 into "no fill", and an unfilled shape can't be clicked, so this keeps invisible buttons working. From graph shows `fill 0`. |

### Points

| Token | TMC |
| --- | --- |
| `point N` | `points: @{ size: N }` |
| `point-opacity N` | `points: @{ opacity: N }` |
| `open` `cross` | `points: @{ style: "OPEN" }` |
| `drag x` `y` `xy` `none` `auto` | `points: @{ drag: "X" }` etc. |

A point in a variable is drawn by the line that defines it, so the style goes there:

```js
Q = (5, 3) . drag xy                 // one item: styled and draggable
R = (1, 2)
R . #red point 12 drag xy            // wrong: R = (1, 2) already draws a point,
                                     // in Desmos's own colour, alongside this one
```

The second form is easy to reach for when a point needs two looks (a dot inside a
ring). Draw the extra one as a shape instead, or keep it a point and accept that
both are drawn.

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
| `[ : max]`, `[min : ]` | one bound only; Desmos keeps its default for the other |
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
| `fraction` | `fractionDisplay: true` |
