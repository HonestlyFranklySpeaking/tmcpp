#!/bin/sh
# Rebuild every logo file: SVG masters, PNGs, extension/VS Code icons and the web icon set.
# Needs Python 3 and the logo-design skill's render_png.py (uses Chrome to render).
#   sh design/logo/render.sh [path/to/logo-design/scripts]
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
R=${1:-"$HOME/.claude/plugins/cache/logo-design-skill/logo-design/1.4.5/skills/logo-design/scripts"}/render_png.py
python "$HERE/build.py"
cd "$HERE/kit"
mkdir -p png extension vscode web
for s in 16 32 48 128 512 1024; do python "$R" svg/tmcpp-icon.svg -o png/tmcpp-icon-$s.png --size $s; done
for s in 16 32 48; do python "$R" svg/tmcpp-icon-small.svg -o png/tmcpp-icon-small-$s.png --size $s; done
for f in wordmark wordmark-reversed stacked stacked-reversed; do
  python "$R" svg/tmcpp-$f.svg -o png/tmcpp-$f.png --height 256
done
# Chrome toolbar sizes use the small cut; the extensions page and store use the full icon.
cp png/tmcpp-icon-small-16.png extension/icon-16.png
cp png/tmcpp-icon-small-32.png extension/icon-32.png
cp png/tmcpp-icon-48.png extension/icon-48.png
cp png/tmcpp-icon-128.png extension/icon-128.png
cp svg/tmcpp-icon.svg extension/icon.svg
cp png/tmcpp-icon-128.png vscode/icon.png
python "$R" svg/tmcpp-icon-small.svg --ico web/favicon.ico --ico-sizes 16 32 48
cp svg/tmcpp-icon-small.svg web/favicon.svg
python "$R" svg/tmcpp-icon.svg -o web/apple-touch-icon.png --size 180
python "$R" svg/tmcpp-icon.svg -o web/icon-192.png --size 192
python "$R" svg/tmcpp-icon.svg -o web/icon-512.png --size 512
