# What the compiler adds, and From graph

[Syntax reference](README.md) · [Lines and math](basics.md) · [Conditionals, actions and enums](logic.md) · [Styles](styles.md) · [Components](components.md) · [Lambdas, macros and loops](macros.md) · [Libraries](libraries.md) · [Blocks and settings](blocks.md) · **What the compiler adds, and From graph** · [Errors and warnings](errors.md)

## What the compiler adds

- A `settings` block at the top with the default viewport and any `settings` lines you wrote.
- A watermark: a `randomSeed` starting with `544d432b2b` ("TMC++" in ASCII hex), unless you set `randomSeed` yourself. The same source always gets the same seed.
- In the extension only (including graphs an AI loads with `push`): stable item ids (`t1`, `t2`, ...) and a hidden metadata note that records classes, tags, tails, comments and hashes.

### Rebuilding source from a graph

The extension's **From graph** button turns a graph back into TMC++, using the metadata note. The MCP server's `pull` tool does the same for a linked tab.

| In the graph | Comes back as |
| --- | --- |
| a line you haven't touched | exactly what you wrote (math and tail) |
| a line you restyled in Desmos | its classes plus only what changed, e.g. `.curve width 5` |
| math you edited in Desmos | the new math converted to TMC, with your tail |
| a slider whose bounds you changed | regenerated `[min : max : step]` and playback tokens |
| an item you added in Desmos | its math and any styling, without Desmos's automatic colour |
| a graph made without TMC++ | every item with its colours (including colour variables, as `#(c_1)`), fills and other styling |
| a deleted item that had comments | the comments, at the end under `// orphaned comments` |
| a parametric's or polar curve's range (`t` from 0 to 360) | a raw block: `@{ domain: @{ t: @{ min: 0, max: 360 } } }` (`theta` for a polar curve) |
| a component instance you haven't touched | its `new ... as ...` line, as written |
| an instance with an edited or deleted line | **detached**: its folder as plain lines, with a warning; other instances still come back as `new` lines |
| a line you added to an instance's folder | that line, right after the `new` line |
| an untouched `if` block | the block, as written; edited, its piecewise lines with a warning |
| items from an imported library | nothing: the `import` line brings them back. An edit to one is dropped, with a warning: change the library instead |
| a table, image or value TMC++ can't convert | skipped with a warning and a `// (left out: ...)` comment, never failing the whole rebuild |

`settings` lines come back as written, so panning or zooming in Desmos doesn't change your source. Comments are placed above the item they belonged to.

Imports and component definitions always go at the top of the rebuilt file, after `settings`. A line edited in Desmos gets your names back (`score_val`, not `s_coreval`); members keep the spelling you wrote (`s1.d`, `sp.lerp`, `.sp-spring`), never the generated Desmos names. Moving a slider or clicking something that changes a value inside an instance counts as an edit, so that instance comes back detached.
