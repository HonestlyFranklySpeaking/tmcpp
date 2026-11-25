# Components

[Syntax reference](README.md) · [Lines and math](basics.md) · [Conditionals, actions and enums](logic.md) · [Styles](styles.md) · **Components** · [Libraries](libraries.md) · [Blocks and settings](blocks.md) · [What the compiler adds, and From graph](round-trip.md) · [Errors and warnings](errors.md)

## Components

A component is a group of lines written once, with parameters, and stamped out with `new`. Each instance becomes its own Desmos folder.

```js
color steel #6b7b8c
class spring { #steel width 2 }

component Spring(A, B, coils = 8) {
  d = B - A  . hidden                          // local: one per instance
  w = (-d.y, d.x) / distance(A, B) * 0.3  . hidden
  (1 - t) * A + t * B + sin(2 * pi * coils * t) * w  .spring
  A  . point 6
  B  . point 6
}

Q = (5, 3)  . drag xy
new Spring((0, 0), (4, 1)) as s1
new Spring((0, 2), Q, coils = 12) as s2  . #red
stretch = distance(s2.A, s2.B) - distance(s1.A, s1.B)
```

| Form | Meaning |
| --- | --- |
| `component Name(a, b, c = 3) { ... }` | Definition. Draws nothing by itself. Hoisted, like classes. |
| `new Name(1, P) as name` | Instance, in a folder titled `name`. |
| `new Name(1, P)` | Anonymous instance, in a folder titled `Name 1`, `Name 2` and so on. |
| `new Name(1, c = 5)` | Named arguments come after positional ones. Missing ones use their defaults. |
| `new Name(...) as name . #red` | Instance tail: added to every line inside, and it wins over the line's own tokens. |
| `name.local`, `name.param` | Reach into an instance from anywhere in the file. |

- **Parameters** are pasted in as text (bracketed when needed), so they cost no Desmos variables. A string argument works where a string goes: `P . label text`.
- **Abstract parameters** are real variables instead: `component Spring(A, B, abstract coils = 8 [1 : 20])` gives every instance its own `coils` variable (a slider you can drag, with those bounds), and the body refers to it. Use one when you want to tweak a value per instance in Desmos, or when the argument is a big expression you'd rather compute once than paste into every line. A value that isn't a plain number is kept as a hidden variable. `s1.coils` reads it. In a list instance, each copy gets its own value, like a local.
- **Locals** are the names a body defines (`d = ...`, `f(u) = ...`). Each instance gets its own copy under a Desmos name the compiler picks, such as `d_s1`. The name never clashes with anything else in the file; if `d_s1` is taken, it becomes `d_s1x`. Write `s1.d` and let the compiler worry about the spelling.
- `x =` and `y =` lines draw curves, as everywhere else, so they are not locals. `r =` is a polar curve too (`r = 5` is a circle), unless another line of the same body uses `r`: with `r = s` and `x^2 + y^2 = r^2`, `r` is a local, a radius.
- Sliders and click actions inside a body belong to each instance: `k = 1 [0 : 5]` gives every instance its own slider, and `click(n -> n + 1)` updates that instance's `n`.
- An instance inside a folder puts its lines straight into that folder (Desmos has no folders in folders).
- Convention, not rule: component names start uppercase (`Spring`), class names lowercase (`.spring`). Breaking either gives a warning.
- **Components inside components.** A body can use `new` too. Nested instances put their lines in the outer instance's folder, and their names follow the path (`n` in `a` in `p` becomes `n_pa`). Arguments and tails of a nested `new` can use the outer component's parameters and locals.

  ```js
  component Dot(P, c = 0) {
    n = c
    P . point 15 click(n -> n + 1)
  }
  component Pair(A, B) {
    gap = distance(A, B)
    new Dot(A) as a
    new Dot(B, c = gap) as b
    segment(a.P, b.P)
  }
  new Pair((0, 0), (3, 4)) as p . #red
  clicks = [p.a.n, p.b.n]
  ```

- Paths reach as deep as you like: `p.b.n`, `p.b.P.x`. Inside a body, `a.P` means the nested instance `a`.
- Tails stack from the inside out: a line's own tokens, then its instance's tail, then each enclosing instance's tail. The outermost instance has the last word, so `p . #red` above makes both dots red.
- A component can't contain itself, directly or through others; that is an error at the definition.
- **List instances.** `new Name(...) for ...` stamps out many copies as **one** folder of Desmos lists, instead of one folder per copy:

  ```js
  component Cell(i, j) {
    m = 0                                          // one flag per cell
    polygon((i, j), (i + 0.9, j), (i + 0.9, j + 0.9), (i, j + 0.9))  .cell click(m -> 1)
  }
  class cell { #2d70b3 fill 0.3 }
  new Cell(i, j) for i = [1...9], j = [1...9] as cells
  mines = total(cells.m)
  ```

  Arguments that use a loop variable become hidden lists (`i_cells`, `j_cells`), and each body line is written once; Desmos repeats it for every copy. A local that doesn't depend on the lists (`m = 0`) becomes one entry per copy. A click changes only the clicked copy, through Desmos's `index`. `cells.m` is the whole list and `cells.m[k]` one copy.
  Limits: Desmos has no lists of lists, so a local that is itself a list can't be part of a list instance; a list instance can't go inside a component, and a component that uses other components can't be one, yet.
- "From graph" gives back the `new` lines and the component definitions (see [Rebuilding source from a graph](round-trip.md#rebuilding-source-from-a-graph)).
