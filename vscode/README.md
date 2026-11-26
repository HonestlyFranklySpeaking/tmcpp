# TMC++ for VS Code

[TMC++](https://github.com/IkeaSourPatches/tmcpp) is a language for writing Desmos graphs as code, with classes, components, `if` statements, actions and libraries. It compiles to DesModder's Text Mode.

This extension adds, for `.tmcpp` files:

- **Syntax highlighting.**
- **Compile errors and warnings, underlined as you type.** Imports resolve too: `./files` next to the open file, `gh:` and `https://` GitHub links, and the built-in `std/...` libraries.
- **Hover docs.** Hover a name to see its definition: functions, variables, a component's parameters and members, instances, classes, colours, style words, enum members, and what an import brings in.
- **Member completion.** After `s1.` you get that instance's parameters and locals; after `sp.` what the import offers.
- **Go to Definition** (F12), into library files on disk too, and **Rename Symbol** (F2), which renames a name everywhere it means the same thing.
- **Format Document**: tidies indentation and blank lines without changing anything else.
- **TMC++: Link to Desmos (live)**: your Desmos tab follows this file as you type. Once the file has no errors, the tab updates only what changed, so sliders and the view stay put. Pair once with **TMC++: Show Pairing Code** (in Desmos: the TMC++ panel, ⋯ > Link AI or VS Code). The status bar shows whether it's linked; click it to unlink. With **Live Share**, each person links their own VS Code to their own Desmos tab, and everyone's graph follows the shared file. Needs the TMC++ browser extension in Chrome.
- **TMC++: Show compiled TMC** and **TMC++: Copy compiled TMC**, to paste into DesModder's Text Mode in Desmos.

Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IkeaSourPatches.tmcpp), or [Open VSX](https://open-vsx.org/extension/IkeaSourPatches/tmcpp) for Cursor, VSCodium and Windsurf.

The language reference is in the [syntax guide](https://github.com/IkeaSourPatches/tmcpp/tree/main/docs/syntax). To edit a graph live in Desmos, use the TMC++ browser extension from the same repository. To have an AI assistant in VS Code (or Cursor) write graphs, add the [TMC++ MCP server](https://github.com/IkeaSourPatches/tmcpp#mcp-server).

The compiler inside is the same one the command line and the browser extension use, with DesModder's current Text Mode bundled, so `|x|` and regressions are understood.

## Building and publishing

From the repository root:

```sh
npm run build:vscode                  # bundles the compiler into vscode/dist/extension.js
cd vscode
npx @vscode/vsce publish              # VS Code Marketplace (needs vsce login)
npx ovsx publish -p <token>           # Open VSX
```

Raise `version` in `vscode/package.json` first; each store rejects a version it already has. To try changes without publishing, open the `vscode` folder in VS Code and press F5, or install a local build with `npx @vscode/vsce package` and then `code --install-extension tmcpp-<version>.vsix`. On macOS, `code` is only on the PATH after **Shell Command: Install 'code' command in PATH** in VS Code's command palette.
