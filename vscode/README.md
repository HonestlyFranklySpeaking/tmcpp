# TMC++ for VS Code

Syntax highlighting for `.tmcpp` files, compile errors and warnings underlined as you type, and two commands:
**TMC++: Show compiled TMC** and **TMC++: Copy compiled TMC** (to paste into DesModder's Text Mode).
Imports resolve like the CLI: `./files` next to the open file, `gh:` and `https://` from GitHub, `std/...` built in.

## Install

From the repository root:

```sh
npm run build:vscode                       # bundles the compiler into vscode/dist/extension.js
cd vscode && npx @vscode/vsce package      # makes tmcpp-0.1.0.vsix
code --install-extension tmcpp-0.1.0.vsix
```

Or, while working on it, open the `vscode` folder in VS Code and press F5 to start a window with the extension loaded.
