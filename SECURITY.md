# Security policy

## Supported versions

Only the latest release gets fixes.

| Version | Supported |
| --- | --- |
| 0.2.x | yes |
| 0.1.x | no |

## Reporting a vulnerability

**Don't open a public issue for a security problem.** Report it privately with GitHub's private vulnerability reporting instead: on the repository's **Security** tab, choose **Report a vulnerability**. Include the steps to reproduce it and what an attacker could do. Expect a reply within a week.

## What's in scope

- **The browser extension:**
  - It runs on `desmos.com/calculator`.
  - It stores libraries in `chrome.storage.local`.
  - Its background worker fetches files only from `raw.githubusercontent.com` and `gist.githubusercontent.com`.

  Anything that lets a graph, a library or a web page escape those limits is in scope. Examples: reaching other sites, running script code, or reading or changing another site's data.
- **The AI link.** `tmcpp mcp` listens on `127.0.0.1` only (port 51324 by default), and the VS Code extension's Link to Desmos on the next port. It accepts a connection only from a browser extension's origin, and only if the connection sends the pairing code from `~/.tmcpp/link.json` within 5 seconds. Through it, the extension (host permission `http://127.0.0.1/*`) lets the paired server load a graph into the open Desmos tab, read it back and screenshot it. A web page or another program that can push graphs, read a tab or learn the code without access to that file is in scope.
- **Libraries** compile to Desmos expressions only and never run as JavaScript. A library that can make the compiler or the extension run code is a vulnerability.
- **The VS Code extension, the CLI and the MCP server** read local files that a `.tmcpp` file imports, and fetch `gh:` and `https://` imports. The MCP server's tools also read and write files at paths the AI app gives them (`file`, `out`), with the permissions of the user running it; that is by design, as with any local MCP server.

Problems in Desmos or DesModder themselves belong with those projects.
