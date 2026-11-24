# text-mode-core (bundled)

DesModder's Text Mode library, built from source because npm's `@desmodder/text-mode-core`
stopped at 0.1.1 (July 2023). MIT licensed; see LICENSE.

- Source: https://github.com/DesModder/DesModder/tree/main/text-mode-core
- Commit: 93e1362954f9b265b71b5803874a43211d115acb (2026-11-17)
- Built with esbuild: `index.ts --bundle --format=esm --platform=neutral --main-fields=module,main --define:window=globalThis`

To update: clone DesModder, `npm install --ignore-scripts`, run the esbuild command above from outside
the clone, replace index.js, and update the commit here.
