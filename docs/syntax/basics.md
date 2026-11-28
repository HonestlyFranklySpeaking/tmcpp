# Lines and math

[Syntax reference](README.md) · **Lines and math** · [Conditionals, actions and enums](logic.md) · [Styles](styles.md) · [Components](components.md) · [Lambdas, macros and loops](macros.md) · [Libraries](libraries.md) · [Blocks and settings](blocks.md) · [What the compiler adds, and From graph](round-trip.md) · [Errors and warnings](errors.md)

## Lines

One statement per line. TMC needs a `;` after each statement; TMC++ adds it.

```js
a = 1
b = 2;          // a trailing ; is allowed and ignored
```

Not carried over from TMC: one-line blocks such as `folder "A" { y = x; }`. Put each statement on its own line.

### Continuation lines

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

### Multi-line strings

A string can also run over several lines: a note or label whose closing `"` comes on a later line keeps its line breaks.

```js
"Line one of a note
line two"
```

### Comments

`//` starts a comment anywhere outside a string. Comments never reach TMC; the extension stores them in the graph's metadata note.

## Helpers with `let`

`let P = ...` defines something other lines use without drawing it: it compiles to `P = ... . hidden`, and From graph gives back `let`. It works for points, lists, numbers and functions, in a file or inside a component, and a tail still applies (`let L = ... #red`, so it shows in that colour if you unhide it). Use it for intermediate points and point lists, which Desmos would otherwise draw as stray dots.

```js
let A = (0, 0)
let B = (4, 1)
let mid = (A + B) / 2
segment(A, B)  #blue width 3
mid . point 10
```

## Math

Math is TMC math with a few conveniences.

### Implicit multiplication

TMC requires an explicit `*`; TMC++ inserts it.

| You write | TMC gets |
| --- | --- |
| `4p` | `4 * p` |
| `k sin(x)` | `k * sin(x)` |
| `(x + 1)(x - 1)` | `(x + 1) * (x - 1)` |
| `2(x)` | `2 * (x)` |
| `.5` | `0.5` (TMC needs the leading zero) |

Function calls `f(x)` are kept as calls, and keywords such as `for` are not treated as factors. After the bounds of `sum`, `product` or `integral`, the body is not multiplied by the closing `)`; multiplication *inside* the body is still inserted where needed. For example, `product n=(1...5) 2n` becomes `product n=(1...5) 2 * n`. The expression after `(d/d x)` is likewise not multiplied by the derivative operator. Multi-letter names are handled by the name conversion below.

### Variable names

Desmos only accepts one-letter names with an optional subscript (`a`, `X_1`, `s_{core}`). TMC++ lets you write real names and renames them consistently everywhere (math, slider bounds, style values, tickers and `${...}` in labels):

| You write | Desmos gets |
| --- | --- |
| `score` | `s_core` |
| `hello_world` | `h_elloworld` |
| `total`, `width` (Desmos functions, used as variables) | `t_otal`, `w_idth` |
| `total(L)`, `sin(x)` (calls of built-ins) | unchanged |
| `theta`, `alpha_2`, `X_1`, `a1`, `P.x` | unchanged |
| `"Score: ${score}"` | `"Score: ${s_core}"` |

Two names that end up the same (`hello_world` and `helloworld`) get a warning. Interpolation already written in Desmos's form, like `${s_{core}}`, is left alone.

### Double inequalities

Desmos only draws `a < f < b` when `f` is `x` or `y`. TMC++ rewrites the rest:

```js
r(x,y) = sqrt(x^2 + y^2)
2.49 < r(x,y) < 2.98          // becomes max(2.49 - r(x,y), r(x,y) - 2.98) < 0: a ring
1 <= x^2 + y^2 <= 4           // <= stays <=
-x < y < x                    // solved: left for Desmos
```

The bounds can be any math, including piecewise. Both comparisons must point the same way.

### Level curves of your own functions

After `q(x,y) = ...`, writing `q(x,y) = [0.5, 0.6]` would redefine `q` in Desmos. TMC++ draws the curves instead, as `q(x,y) - ([0.5, 0.6]) = 0`, and warns you.

```js
q(x,y) = x^2 + 4y^2
q(x,y) = [1, 4, 9]
```

### Segments and paths

Desmos's graphing calculator has no `segment()` (only its Geometry calculator does). TMC++ adds two helpers, used as a whole statement:

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

### Restrictions

Desmos's `{...}` restrictions work, and can be stacked:

```js
y = 2x {0 < x < 1}
x^2 + y^2 < 4 {y > 0}{x > 0}
(cos(t), sin(t)) {t < 3}
```

The parser TMC++ uses can't read restrictions, so each becomes a piecewise around the right-hand side (`y = {0 < x < 1: 2x}`), which draws the same thing. A `{...}` with a `:` in it is a piecewise value and is left alone.

### Absolute value

`|x - 1|` and `abs(x - 1)` both work, and bars multiply like brackets: `2|x|` becomes `2 * |x|`, `|x||y|` becomes `|x| * |y|`. A bar closes the one opened at the same bracket depth when it follows a value; otherwise it opens a new one, so `||x| - 1|` nests as you'd expect. From graph writes absolute values as `abs(...)`.

### Regressions

Regressions are plain TMC: `Y1 ~ m * X1 + b`, with starting values as `#{ m = 1, b = 2 }` after it.

### List comprehensions without brackets

Desmos accepts `L = f(i) for i = [1...5]` and `join(g(a) for a = [1, 2])`; TMC++ adds the brackets TMC needs.

### Expressions in style values and slider bounds

Slider bounds are math (`[0 : 2pi]`). `fill`, `opacity`, `width`, `point-opacity` and `label-size` take a number, an expression written without spaces (`fill 0.8*(1-t)^2`), or an expression in brackets, which may contain spaces (`opacity (a pi)`). A number may skip its leading zero: `fill .95`.

### Scientific notation

A number glued to `e` or `E` and a whole-number exponent is scientific notation: `3e-3` is 0.003, `1.5E8` is 150000000, `k = 5e-3 [0 : 1e-2 : 1e-4]` is a slider. It compiles to the plain decimal (so sliders still work), or to `2.5 * 10^(-13)` beyond twelve places.

Euler's number stays `e` whenever it isn't glued to a number with an exponent after it: `2e`, `e^x`, `2.5e^x`, `3 e - 3`. From graph writes `3\cdot10^{-3}` back as `3e-3`, and puts a space after a number before Euler's e (`2 e - 1`), so the two never get mixed up.

### Greek letters and Unicode

Write Greek letters by name: `alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi chi psi omega`, the capitals `Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega`, and `varphi vartheta varepsilon`. A subscript works as usual: `lambda_1`. All of them reach Desmos as real Greek letters, labels included (`label "${gamma}"`).

You can also type the symbols themselves: `θ π ω Δ` and the rest, plus `≤ ≥ × · ÷ − → ∞`. Inside a string (a label or a note) they stay exactly as typed.

```js
r = 2θ
k = Delta + omega ≤ 3
(1, 2) . label "γ = ${gamma}"
gamma = 3
```

Because Greek names are recognised, a two-letter variable like `mu`, `nu`, `xi`, `pi` or `eta` means the Greek letter, not two letters multiplied.
