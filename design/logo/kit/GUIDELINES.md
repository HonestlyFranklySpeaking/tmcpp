# TMC++ logo guidelines

## The logo

**Idea:** the m in TMC is two periods of a cosine on a Desmos grid, ending in a draggable point. It reads as text and as a graph, which is what TMC++ does.

**Construction** (all in `../build.py`): x-height 64 units, wave amplitude 32, period 64. The grid pitch is half a period, so every peak and trough sits on a grid line; the thick axes cross where the wave starts, and the x-axis runs along its midline. T stroke 26, m and c stroke 20, c corners cut at 45°.

## Versions

| File | Use it for |
|---|---|
| `svg/tmcpp-icon.svg` | The primary logo: app icon, extension icon (48 px and up), avatars, store listings |
| `svg/tmcpp-icon-small.svg` | 16 to 32 px only: no grid, heavier strokes. Chrome toolbar, favicon |
| `svg/tmcpp-wordmark.svg` | Headers, README banner, docs: anywhere wider than tall, on light backgrounds |
| `svg/tmcpp-wordmark-reversed.svg` | The same on navy or dark backgrounds |
| `svg/tmcpp-stacked*.svg` | Square-ish spaces without a tile, ++ under the letters as in the icon |
| `*-black.svg`, `*-white.svg` | One-colour printing, embossing, stamps, single-colour stickers |

Ready-made files: `extension/` (drop-in for `extension/icons/`), `vscode/icon.png` (128 px), `web/` (favicon.ico, favicon.svg, apple-touch-icon, 192/512 px icons, `head-snippet.html`), `png/` (every size from 16 to 1024).

The icon already spells Tmc++, so there is no icon-plus-name lockup. Use the icon or the wordmark, not both side by side.

## Clear space

Keep a clear zone around the wordmark equal to the **height of the c** on every side. For the icon, the tile is its own clear space; keep at least 1/8 of its width free around it.

## Minimum size

| Version | Screen | Print |
|---|---|---|
| Icon | 48 px (below that, use the small cut) | 12 mm |
| Small cut | 16 px | 5 mm |
| Wordmark | 80 px wide | 20 mm wide |

## Colour

| Name | HEX | RGB | CMYK (approx.) |
|---|---|---|---|
| Navy (tile, wordmark) | `#1d3557` | 29 53 87 | 67 39 0 66 |
| Point red | `#e63946` | 230 57 70 | 0 75 70 10 |
| Plus orange | `#f4a259` | 244 162 89 | 0 34 64 4 |
| Grid | `#28497a` | 40 73 122 | 67 40 0 52 |
| Axis | `#4f74a8` | 79 116 168 | 53 31 0 34 |
| White | `#ffffff` | 255 255 255 | 0 0 0 0 |

The CMYK values are straight conversions. Check them against a printed proof before a print run.

**Contrast:** white on navy 12.4:1, orange on navy 6.0:1. The red point on navy is 3.0:1, which is fine because it sits on a white stroke. Orange on white is only 2.1:1: on light backgrounds the ++ is a lighter accent. If it has to carry weight, use the navy one-colour version.

**Approved pairs:** icon anywhere · navy wordmark on white or light grey · reversed wordmark on navy or near-black · black or white one-colour versions on flat backgrounds.

## Don'ts

- Don't redraw the wave freehand or swap in a sine that starts on the midline. It has to start and end on the baseline, or it reads as "w".
- Don't move the red point off the end of the wave, and don't recolour it.
- Don't use the full icon below 48 px. Use the small cut.
- Don't put the grid behind the wordmark. The grid belongs to the tile.
- Don't stretch, rotate, outline, or add shadows or gradients.
- Don't retype "Tmc++" in a font. Use the files.

## Rebuilding

`sh design/logo/render.sh` regenerates every SVG and PNG from `build.py`. Change the numbers there, not the SVGs.
