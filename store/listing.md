# Chrome Web Store listing

Everything the developer dashboard asks for, ready to paste. Images are in this folder; `node tools/store-assets.js` remakes them (and the icons) after `npm run build:ext`.

## Store listing tab

**Name** (from the manifest): TMC with Classes (TMC++)

**Summary** (from the manifest, 132 characters max): Write Desmos graphs in TMC++ (DesModder Text Mode with classes), compile them live, and let an AI app load graphs through tmcpp mcp.

**Category:** Education (or Developer Tools)

**Language:** English

**Description:**

```
Write Desmos graphs as code.

TMC++ adds a panel to desmos.com/calculator where you write a whole graph as text and compile it into Desmos: equations, sliders, points, folders, notes, tickers and styles, in a language built on DesModder's Text Mode.

On top of Text Mode it adds:
• CSS-style classes and named colours: style a dozen curves from one line
• One-word styles: dashed, width 3, fill 0.3, point 12, drag xy, label "focus" above
• Slider shorthand: a = 1 [0 : 2pi] . play loop 10s
• Components: write a shape once, stamp out copies with new
• if statements, enums, and click actions like score++ and toggle(on)
• Lambdas, macros, compile-time for loops, and while loops that run on the ticker
• Libraries: import your own, from GitHub, or the built-in std/ui, std/3d, std/color and more

The panel is a real editor: highlighting, errors underlined as you type, completion, hover docs, go to definition, rename and format.

Live mode updates the graph as you type, changing only what changed, so sliders you've dragged keep their values.

From graph turns a graph back into TMC++, including edits you made in Desmos.

Link an AI app: with the free tmcpp command (npm), Claude, ChatGPT, Cursor and other MCP apps can write a graph, check it, and load it straight into your open Desmos tab. Link VS Code the same way, and your tab follows the file as you type.

Open source, MIT licensed: https://github.com/IkeaSourPatches/tmcpp
Syntax reference: https://github.com/IkeaSourPatches/tmcpp/tree/main/docs/syntax

TMC++ is an independent project, not affiliated with Desmos or DesModder.
```

**Images:**

| Field | File |
| --- | --- |
| Store icon (128×128) | `store-icon-128.png` (the tile at 96 px with transparent padding, as the store asks) |
| Screenshots (1280×800) | `screenshot-solar-system.png`, `screenshot-event-horizon.png`, `screenshot-night-net.png` |
| Small promo tile (440×280) | `promo-440x280.png` |
| Marquee promo tile (1400×560, optional) | `marquee-1400x560.png` |

**Homepage URL:** https://github.com/IkeaSourPatches/tmcpp
**Support URL:** https://github.com/IkeaSourPatches/tmcpp/issues

## Privacy practices tab

**Single purpose:**

```
Write, compile and edit Desmos graphs as TMC++ code in a panel on desmos.com/calculator.
```

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `storage` | Keeps the user's saved TMC++ libraries and the optional pairing code for the local AI/VS Code link on their computer. |
| Host `https://raw.githubusercontent.com/*`, `https://gist.githubusercontent.com/*` | Downloads TMC++ library files the user imports from GitHub (`import "gh:user/repo/file"`). These are TMC++ source text, compiled into Desmos expressions; they are never run as code. |
| Host `http://127.0.0.1/*` | Connects to the user's own computer, only after the user enters a pairing code, so the tmcpp command (an MCP server for AI apps) or the VS Code extension can load graphs into the open Desmos tab. Nothing leaves the machine. |
| Content scripts on `https://www.desmos.com/calculator*` | Adds the TMC++ panel to the Desmos calculator and loads compiled graphs through Desmos's public API. |

**Remote code:** No, I am not using remote code. (All JavaScript ships in the package. Imported libraries are TMC++ text, compiled to Desmos math.)

**Data usage:** tick none of the data types. Certify all three statements: no selling or transfer to third parties, no use unrelated to the single purpose, no use for creditworthiness or lending.

**Privacy policy URL:** https://github.com/IkeaSourPatches/tmcpp/blob/main/PRIVACY.md

## Distribution tab

Visibility: Public. Regions: all.
