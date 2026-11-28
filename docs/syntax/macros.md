# Lambdas, macros and loops

[Syntax reference](README.md) · [Lines and math](basics.md) · [Conditionals, actions and enums](logic.md) · [Styles](styles.md) · [Components](components.md) · **Lambdas, macros and loops** · [Libraries](libraries.md) · [Blocks and settings](blocks.md) · [What the compiler adds, and From graph](round-trip.md) · [Errors and warnings](errors.md)

Desmos has no function values, no loops and no templates, so each of these is worked out when compiling: the graph gets plain lines.

## Lambdas

A lambda is a small function written where it's used: `(x) => x^2`, or `v => v > 0` for one parameter.

```js
L = [1, -2, 3, -4]
M = map(L, (x) => x^2)          // [x^2 for x = L]
F = filter(L, (v) => v > 0)     // L[L > 0]
```

Passed to a component, a lambda is pasted in wherever the component calls that parameter:

```js
component Plot(f) {
  (t, f(t)) . width 3
}
new Plot((x) => sin(2x)) as wave       // draws (t, sin(2t))
new Plot(f = (u) => u^2 / 4) as bowl
```

- `filter` works for conditions that apply to each item, like `v > 0` or `v != 2`.
- A lambda can't be stored in a variable (`g = (x) => x^2` is an error): write a function, `g(x) = x^2`, instead.

## Macros

A macro is a template: its lines are written into the file wherever it's used, with no folder and no renamed names. That's the difference from a [component](components.md), which gets its own folder and its own copy of every name.

```js
macro Glow(shape, look) {
  shape  look opacity 0
}
Glow(x^2 + y^2 < 4, #fa7e19 fill 0.3)
Glow(y < sin(x), #2d70b3 fill 0.1)
```

- A use is a line on its own: the macro's name and its arguments.
- Arguments can be math (bracketed when needed, so `Sq(a + b)` stays `(a + b)^2`) or style tails (`#red dashed`, `.glow`), which go in as written.
- A macro can use other macros, components and `if` blocks. Names it defines are defined where it's used, so a macro used twice that defines `k` defines it twice: take the name as an argument, or use a `for` loop with `_{i}` (below).
- Errors inside a macro point at the line that used it.

## For loops

`for i in [...] { ... }` writes its body once per value, when compiling. Inside a name, `_{i}` becomes the value, so each copy gets its own names.

```js
for i in [1...3] {
  a_{i} = i [0 : 5]            // three sliders: a_1, a_2, a_3
  P_{i} = (i, a_{i}) . point 8
}
for c in [0, 0.5 ... 2] {
  y = c x . dashed
}
```

- The list has to be written out: a range like `[1...5]` or `[0, 0.5 ... 2]`, or values like `[red, blue]`, used in a style tail as `#c` for a colour or `.c` for a class. A range's ends can be arithmetic on numbers (`[1...2*3]`), but not variables or sliders. At most 500 values.
- For the same line repeated over values *inside Desmos*, use a list comprehension (`[(i, 0) for i = [1...5]]`) or a [list instance](components.md) (`new Cell(i) for i = [1...9] as cells`): they're one graph item, and the list can change while the graph runs.

### Loops that count over a component parameter

Inside a component, a range can use a parameter, as long as each `new` line passes a number for it. Each different number gets its own copy of the component, the way a C++ template does:

```js
component Row(n, h = 0) {
  for i in [1...n] {
    P_{i} = (i, h) . point 6
  }
}
new Row(3) as r                // three points
new Row(5, h = 1) as s         // five points
y = s.P_5.x
```

That number can be passed on to a component used inside (`new Row(w) as row_{j}`). A slider, a variable, an `abstract` parameter or a list instance can't set it: those change while the graph runs, after the loop has been written out.

## While loops

`while condition { ... }` runs its body once per tick while the condition holds, and then stops: it becomes part of the graph's ticker.

```js
n = 0
x = 100
while x > 1 {
  x = x / 2
  n++
}
```

- The body is actions, with the usual [shortcuts](logic.md#actions): `n++`, `x = x / 2` (which sets x), `toggle(on)`.
- With a `ticker` in the file as well, both run each tick. Desmos does all of a tick's updates at once, so each loop step sees the values from before it.
- For a value worked out all at once rather than tick by tick, write a recursive function instead: `f(n) = {n <= 1: 1, n * f(n - 1)}`.

From graph gives back each macro use, `for` loop and `while` loop as written while its lines are untouched in Desmos, and lambdas as written while their line is.
