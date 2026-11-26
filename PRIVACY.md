# Privacy policy: TMC with Classes (TMC++)

Last updated 26 November 2026. This covers the TMC++ browser extension, the VS Code extension and the `tmcpp` command.

**TMC++ collects no data.** There are no analytics, no accounts, no ads and no server run by TMC++. Nothing you write is sent to the developer.

## What the browser extension stores, and where

- **Your TMC++ source**, per graph, and whether Live editing is on: in the desmos.com page's own browser storage (`localStorage`) on your computer.
- **Saved libraries** and the **pairing code** for the AI link: in the extension's storage (`chrome.storage.local`) on your computer.
- **A hidden metadata note** inside each graph you compile (classes, comments and the like, so From graph can rebuild your source). It is part of the graph, so it goes wherever the graph goes: if you save the graph to your Desmos account or share it, Desmos stores it with the graph, under Desmos's own privacy policy.

Removing the extension deletes what it keeps in `chrome.storage`. The page storage can be cleared with desmos.com's site data in Chrome's settings.

## What the extension sends, and to whom

- **GitHub libraries.** When you fetch a library (`gh:` or a GitHub link), the extension downloads that file from `raw.githubusercontent.com` or `gist.githubusercontent.com`. No cookies or credentials are sent.
- **The AI and VS Code link, only if you pair it.** The extension connects to `127.0.0.1`, your own computer, where `tmcpp mcp` or the VS Code extension listens. It does nothing until you enter a pairing code. While linked, the program you paired can load TMC++ into your open Desmos tab, read the graph back as TMC++, and take a screenshot of it. That data stays on your computer, apart from whatever the AI app you chose then does with it under its own terms. **Unlink** in the panel turns this off.

## The `tmcpp` command and the VS Code extension

They run on your computer, read the files you give them, and fetch `gh:` and `https://` imports you write. `tmcpp preview` and `tmcpp check --runtime` open desmos.com in a headless copy of your installed Chrome or Edge, to render the graph.

## Contact

Questions: open an issue at https://github.com/IkeaSourPatches/tmcpp/issues.
