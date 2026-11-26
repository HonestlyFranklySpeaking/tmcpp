# Blocks and settings

[Syntax reference](README.md) · [Lines and math](basics.md) · [Conditionals, actions and enums](logic.md) · [Styles](styles.md) · [Components](components.md) · [Lambdas, macros and loops](macros.md) · [Libraries](libraries.md) · **Blocks and settings** · [What the compiler adds, and From graph](round-trip.md) · [Errors and warnings](errors.md)

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
