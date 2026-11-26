# Conditionals, actions and enums

[Syntax reference](README.md) · [Lines and math](basics.md) · **Conditionals, actions and enums** · [Styles](styles.md) · [Components](components.md) · [Lambdas, macros and loops](macros.md) · [Libraries](libraries.md) · [Blocks and settings](blocks.md) · [What the compiler adds, and From graph](round-trip.md) · [Errors and warnings](errors.md)

## Conditionals

Use `if condition then value else fallback` wherever you need a piecewise value or action.
An inline `if` needs both arms. Chain alternatives with `else if`, or use parentheses
to put a conditional inside a larger expression.

```js
y = if x < 0 then -x else if x < 2 then x else 2
(0, 0) . click(if m = 0 then m -> 1 else m -> 0)
```

A block can guard several math statements, including inside a component:

```js
if m = 1 {
  y = x^2 . #red
  P = (2, 4)
} else {
  y = -x . #red
  x^2 + y^2 < 4
}
```

Here the calculator gets one red curve, `y = {m = 1: x^2, -x}`. The point exists only
when `m = 1`, and the disk is drawn only in the other branch. A block may omit its
`else` or contain nested blocks. Matching assignments take the first branch's style.
A different style in the other branch produces a warning at that line.

Blocks chain with `} else if condition {`, which becomes a nested piecewise
(`y = {m = 1: x, {m = 2: 2x, 3x}}`). Sliders, folders, classes and other blocks can't
go inside an `if` block: define the slider outside and use it inside.

“From graph” gives an `if` block back as written while its lines are untouched in Desmos; after an edit it comes back as the piecewise lines, with a warning. An inline `if` comes back as written until its line is edited.

## Actions

Desmos writes every update as `n -> n + 1`. TMC++ also takes the short forms, wherever an action goes: `click(...)`, the `ticker`, a named action (`step = (n++, m += 2)`), a line that is only an action, and both branches of an inline `if`.

| Write | Means |
| --- | --- |
| `n++`, `n--` | `n -> n + 1`, `n -> n - 1` |
| `n += e`, `-=`, `*=`, `/=`, `^=` | `n -> n + (e)` and so on |
| `mode++ % 3` | `mode -> mod(mode + 1, 3)`: 0, 1, 2, 0, … |
| `on = 1` (inside an action) | `on -> 1` |
| `toggle(on)` | `on -> 1 - on` |
| `L[i] = v`, `L[i] += v`, `L[i]++`, `toggle(L[i])` | change element `i` of list `L` |
| `L.push(x)`, `L.pop()` | `L -> join(L, x)`, drop the last element |
| `reset(score, lives)` | back to the values they're defined with (`score = 0`) |
| `reset()` | every plain value in the file (numbers, points, lists), or in the component it's written in |

```js
score = 0
lives = 3
mode = 0
L = [0, 0, 0]
(0, 0) . point 12 click(score++, mode++ % 3, L[mode + 1] += 1)
(2, 0) . point 12 click(if lives > 1 then lives-- else reset())
start = reset(score, lives)
```

Several element changes to one list in the same action (`L[1] = 0, L[3] += 2`) are merged into a single update. Desmos does every update in an action at the same time, so `score++, score += 2` adds only one of them: TMC++ warns when an action updates the same variable twice. Inside an `if` condition `=` still compares; only an action's own `=` sets. Everything inside `click(...)` is an action, so `click(if m = 3 then m = 1 else m = 3)` sets `m` in both branches.

## Enums

An enum names the states of a variable, so you write `mode = flying` instead of remembering that 2 means flying.

```js
mode = enum(idle, flying, landed)
y = if mode = flying then sin(x) else 0
(0, 0) . point 12 click(mode++) label "state ${mode}"
(2, 0) . point 12 click(if mode = landed then mode = idle else mode = landed)
```

- The variable starts at the first member. Members count from 1, like Desmos lists, so `L[mode]` picks the matching item of a list.
- Members are numbers pasted in when compiling (`flying` becomes `2`), so they cost no Desmos variables, and work in conditions, actions, labels and math alike.
- `mode++` and `mode--` cycle through the members and wrap around (`landed` then `idle`); `mode++ % 3` means the same.
- A member name can only belong to one enum, and can't also be defined as a variable.
- From graph gives every line back as written while it's untouched in Desmos.
