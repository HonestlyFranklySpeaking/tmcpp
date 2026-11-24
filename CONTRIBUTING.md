# Contributing to TMC++

Thanks for helping. Bug reports, example graphs, std library components and fixes are all welcome.

## Reporting a bug

Open an issue with the **Bug report** template. The most useful thing you can include is the **smallest TMC++ source that shows the problem**, together with what you expected and what happened. If it involves a graph, include the Desmos link.

## Setting up

Requires Node 22 or newer.

```sh
npm install
npm test                       # compiler, parser, round-trip and std library tests
node src/cli.js check file.tmcpp # compile and validate with DesModder's own parser
npm run build:ext              # the browser extension (extension/dist)
npm run build:vscode           # the VS Code extension (vscode/dist)
```

The README explains how to load the extension in Chrome.

## Making a change

- **Keep the v1 promise.** Plain TMC and older TMC++ must compile exactly as before. If a change alters what existing source means, say so in the pull request and in `CHANGELOG.md`.
- **Add a test** in `test/` for every fix or feature, and run `npm test` before opening the pull request. Tests compile the source and run the result through DesModder's parser, so they catch output Desmos would reject.
- **Update `docs/syntax.md`** when you add or change syntax. Every `js` code block in it should compile.
- **Error messages** name the TMC++ line, say what's wrong in plain words, and suggest a fix where there is one, like `Unknown class '.curv' (did you mean '.curve'?)`.

## The std libraries

The built-in libraries (`import "std/ui"`) live in `library/std/*.tmcpp`. After editing one, run `npm run build:std`; a test fails if the bundled copy is out of date. Every definition is compiled, used once and parsed in `test/std.test.js`. For anything that draws, also check it in real Desmos, because the parser accepts some things that look wrong on the graph.

A few rules that keep components clean in Desmos:

- **Hide locals that hold a point** (`u = B - A . hidden`). Otherwise Desmos draws them as stray dots.
- **Don't define a local in terms of `x` or `y`.** Desmos plots it as a curve. Write the expression inline instead.
- **Give drawn lines an explicit colour,** so they don't get Desmos's rotating default colours. An instance tail still overrides it.

## Pull requests

Keep them focused on one thing and fill in the template. Small pull requests get reviewed faster.
