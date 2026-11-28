# Errors and warnings

[Syntax reference](README.md) · [Lines and math](basics.md) · [Conditionals, actions and enums](logic.md) · [Styles](styles.md) · [Components](components.md) · [Lambdas, macros and loops](macros.md) · [Libraries](libraries.md) · [Blocks and settings](blocks.md) · [What the compiler adds, and From graph](round-trip.md) · **Errors and warnings**

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
| `Unknown component 'Sprin' (did you mean 'Spring'?)` | component not defined |
| `Missing argument 'B' for Spring` / `Spring takes 3 arguments, got 4` | check the call against the definition |
| `s1 (a Spring) has no member 'dd'` | `s1.dd`: no local or parameter of that name |
| `A uses B uses A: a component can't contain itself` | components may nest, but not in a loop |
| `A component can't be defined inside another component; ...` | define it at the top level and use `new` inside the other one |
| `Unknown keyword 'compoment' (did you mean 'component'?)` | misspelt keyword |
| `Can't find library 'x'` / `'gh:...' hasn't been fetched yet` | not saved, not on disk, or not fetched yet |
| `In 'x' line 3: A library can only define components, classes, colours, functions and constants` | a library line that would draw |
| `'v' is imported from both 'p' and 'q'` | two plain imports bring the same name; use `as` |
| `'lerp' is defined in this file and also imported from 'x'` | rename yours, or import with `as` |
| `Import cycle: a imports b imports a` | libraries can't import each other in a loop |
| `TMC: ...` (extension) | DesModder's parser rejected the compiled line |
| `f takes 2 arguments, but this call gives 1` | Desmos would reject the call; checked across the whole file, imports included |
| `'e' can't be a parameter of g: Desmos already defines it` | also `pi`, `tau`, `infinity`, `index` and `dt` |
| `'for' is a word Text Mode or Desmos already uses ...` | also `with`, `in`, `of`, `to`, `from`, `if`, `else`, `and`, `or`, `true`, `false`, `sum`, `product`, `integral`, `index`, `dt`: rename the variable or parameter |
| `'let' needs a definition, like let P = (1, 2)` | `let` goes before a definition |
| `'_scale' is private to 'x'` / `names starting with _ are private helpers of a library` | the library keeps it to itself; use what it exports |
| `enum needs at least two members` / `'off' is already a member of a` | each enum has two or more members, each in one enum only |
| `a lambda only works where it's used straight away: ...` | a lambda stored in a variable; write a function, `g(x) = x^2`, instead |
| `map(list, (x) => ...) takes a list and a one-parameter lambda` / `this lambda takes 1 argument, but is called with 2` | check the lambda's parameters (also `filter`) |
| `Glow takes 2 arguments, but this gives 1` / `macro Glow is defined twice` / `macro is never closed` | check the macro's use against its definition |
| `for ... in needs a list written out here, like [1...5] or [red, green]` | the list must be written in the loop, not a variable |
| `for ... in needs numbers in its range ...` | a range like `[0...n]` with a variable or slider: a loop is written out when compiling. Write the number, or use a list comprehension |
| `Row uses 'n' to count a for loop, so 'n' has to be a number here` | pass a number to that parameter in the `new` line (`new Row(4)`), not a slider, variable or list |
| `the range [1, 0 ... 5] never reaches its end` / `a for loop over more than 500 values ...` | fix the step, or use a list comprehension or `new ... for` |
| `the macro used on line N was edited in Desmos, so it comes back as its lines` (From graph, warning) | also for `for` loops: an edit in Desmos turns the use into plain lines |
| `... is drawn as points and also used by other lines` (`check --runtime`, warning) | an unstyled helper point list that Desmos draws: add `. hidden` or use `let` |

`tmcpp check --runtime` (or the MCP `check` tool with `runtime: true`) also reports, by TMC++ line, any error Desmos shows itself once the graph loads, such as `Cannot add a point and a number`, with the slider values it checked at.

In the extension, **Copy all** at the top of the message list copies every message with its source line.
