# TMC++ for VS Code

[TMC++](https://github.com/IkeaSourPatches/tmcpp) is a language for writing Desmos graphs as code, with classes, components, `if` statements, actions and libraries. It compiles to DesModder's Text Mode.

This extension adds, for `.tmcpp` files:

- **Syntax highlighting.**
- **Compile errors and warnings, underlined as you type.** Imports resolve too: `./files` next to the open file, `gh:` and `https://` GitHub links, and the built-in `std/...` libraries.
- **TMC++: Show compiled TMC** and **TMC++: Copy compiled TMC**, to paste into DesModder's Text Mode in Desmos.

Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IkeaSourPatches.tmcpp), or [Open VSX](https://open-vsx.org/extension/IkeaSourPatches/tmcpp) for Cursor, VSCodium and Windsurf.

The language reference is in the [syntax guide](https://github.com/IkeaSourPatches/tmcpp/blob/main/docs/syntax.md). To edit a graph live in Desmos, use the TMC++ browser extension from the same repository.

## Building and publishing

From the repository root:

```sh
npm run build:vscode                  # bundles the compiler into vscode/dist/extension.js
cd vscode
npx @vscode/vsce publish              # VS Code Marketplace (needs vsce login)
npx ovsx publish -p <token>           # Open VSX
```

Raise `version` in `vscode/package.json` first; each store rejects a version it already has. To try changes without publishing, open the `vscode` folder in VS Code and press F5.
