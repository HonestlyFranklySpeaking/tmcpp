# Contributing to TMC++

Thanks for helping. Bug reports, example graphs, std library components and fixes are all welcome.

## Reporting a bug

Open an issue with the **Bug report** template. The most useful thing you can include is the **smallest TMC++ source that shows the problem**, together with what you expected and what happened. If it involves a graph, include the Desmos link.

## Setting up

Requires Node 22 or newer for the tests (they use Node's built-in WebSocket); the package itself runs on Node 20. Don't add runtime dependencies: the compiler, CLI and MCP server run on Node's standard library and the bundled `vendor/text-mode-core`.

```sh
npm install
npm test                       # compiler, parser, round-trip and std library tests
node src/cli.js check file.tmcpp # compile and validate with DesModder's own parser
npm run build:ext              # the browser extension (extension/dist)
npm run build:vscode           # the VS Code extension (vscode/dist)
node src/cli.js mcp            # the MCP server, for trying tools by hand
```

The README explains how to load the extension in Chrome. After rebuilding it, reload TMC++ in `chrome://extensions` and then the Desmos tab.

## The bundled Text Mode library

`vendor/text-mode-core/index.js` is a build of DesModder's `text-mode-core`, because npm's copy is from 2023. Its README records the DesModder commit and the esbuild command. To update it, build from a fresh DesModder clone, replace the file, update the commit, and run `npm test`: Text Mode sometimes renames style keys (`fractionDisplay`, `domain: @{ t: ... }`), and the tests catch that. Every file imports it through `src/tmc-core.js`.

## Making a change

- **Keep the v1 promise.** Plain TMC and older TMC++ must compile exactly as before. If a change alters what existing source means, say so in the pull request and in `CHANGELOG.md`.
- **Add a test** in `test/` for every fix or feature, and run `npm test` before opening the pull request. Tests compile the source and run the result through DesModder's parser, so they catch output Desmos would reject.
- **Update the syntax reference** in `docs/syntax/` (one page per topic) when you add or change syntax, and the README only if it changes the essentials. Every `js` code block in them should compile and pass `tmcpp check`. Note user-facing changes under "Unreleased" in `CHANGELOG.md`.
- **Error messages** name the TMC++ line, say what's wrong in plain words, and suggest a fix where there is one, like `Unknown class '.curv' (did you mean '.curve'?)`.

## The std libraries

The built-in libraries (`import "std/ui"`) live in `library/std/*.tmcpp`. After editing one, run `npm run build:std`; a test fails if the bundled copy is out of date. Every definition is compiled, used once and parsed in `test/std.test.js`. For anything that draws, also check it in real Desmos, because the parser accepts some things that look wrong on the graph.

A few rules that keep components clean in Desmos:

- **Hide locals that hold a point** (`u = B - A . hidden`). Otherwise Desmos draws them as stray dots.
- **Don't define a local in terms of `x` or `y`.** Desmos plots it as a curve. Write the expression inline instead.
- **Give drawn lines an explicit colour,** so they don't get Desmos's rotating default colours. An instance tail still overrides it.

## Pull requests

Keep them focused on one thing and fill in the template. Small pull requests get reviewed faster.
