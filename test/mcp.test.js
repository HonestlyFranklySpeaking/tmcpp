// tmcpp mcp: the stdio MCP server answers the protocol and its compile/check tools and resources.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { _test } from "../src/mcp.js";
import { Link } from "../src/link.js";

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
const springs = fileURLToPath(new URL("../examples/springs-import.tmcpp", import.meta.url));

/** Send requests to a fresh server and collect the answers by id. */
function session(requests) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [cli, "mcp"], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, TMCPP_LINK: "0" } });
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.on("error", reject);
    p.on("close", () => {
      const byId = {};
      for (const line of out.split("\n").filter(Boolean)) { const m = JSON.parse(line); byId[m.id] = m; }
      resolve(byId);
    });
    let id = 0;
    for (const [method, params] of requests) {
      p.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...(method.startsWith("notifications/") ? {} : { id: ++id }), method, params }) + "\n");
    }
    p.stdin.end();
  });
}

const init = ["initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }];
const call = (name, args) => ["tools/call", { name, arguments: args }];

test("mcp: initialize, tools and resources", async () => {
  const r = await session([init, ["notifications/initialized", {}], ["tools/list", {}], ["resources/list", {}], ["resources/read", { uri: "tmcpp://docs/syntax" }], ["resources/read", { uri: "tmcpp://std/shapes" }], ["nope", {}]]);
  assert.equal(r[1].result.protocolVersion, "2025-06-18");
  assert.equal(r[1].result.serverInfo.name, "tmcpp");
  assert.deepEqual(r[2].result.tools.map((t) => t.name), ["compile", "check", "preview", "link_status", "push", "pull", "screenshot"]);
  const uris = r[3].result.resources.map((x) => x.uri);
  assert.ok(uris.includes("tmcpp://docs/syntax") && uris.includes("tmcpp://std/ui"));
  assert.match(r[4].result.contents[0].text, /^# TMC\+\+ syntax reference/);
  assert.match(r[5].result.contents[0].text, /roundedRect/);
  assert.equal(r[6].error.code, -32601);
});

test("mcp: compile and check", async () => {
  const r = await session([init,
    call("compile", { source: "a = 1 #red" }),
    call("compile", { source: "new Nope() as n" }),
    call("check", { source: "a = 1 #red\nb = ((", tmc: true }),
    call("check", { file: springs }),
    call("check", {}),
  ]);
  assert.match(r[2].result.content[0].text, /a = 1 @\{ color: RED \};/);
  assert.equal(r[3].result.isError, true);
  assert.match(r[3].result.content[0].text, /<source>:1: error:/);
  assert.equal(r[4].result.isError, true);
  assert.match(r[4].result.content[0].text, /TMC line \d+: error/);
  assert.match(r[4].result.content[1].text, /settings/);
  assert.equal(r[5].result.isError, false, r[5].result.content[0].text);
  assert.match(r[5].result.content[0].text, /^OK: 0 parser diagnostic/m);
  assert.equal(r[6].result.isError, true);
});

test("mcp: push, pull and screenshot go through the link", async () => {
  const link = new Link({ port: 0, token: "0123456789abcdef0123", allowOrigin: () => true });
  await link.start();
  _test.useLink(link);
  try {
    assert.match((await _test.callTool("push", { source: "a = 1" }).catch((e) => ({ content: [{ text: e.message }] }))).content[0].text, /isn't linked/);
    const ws = new WebSocket(`ws://127.0.0.1:${link.port}/tmcpp`);
    await new Promise((r) => (ws.onopen = r));
    const seen = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (!m.id) return;
      seen.push(m);
      const data = m.op === "push" ? { ok: true, message: "Compiled 3 item(s) into the graph.", errors: [], warnings: [] }
        : m.op === "pull" ? { source: "a = 2", warnings: ["x"] }
        : m.op === "screenshot" ? { png: "data:image/png;base64,iVBORw0KGgo=" }
        : { title: "Untitled Graph", url: "https://www.desmos.com/calculator", madeWithTmcpp: false };
      ws.send(JSON.stringify({ id: m.id, ok: true, data }));
    };
    ws.send(JSON.stringify({ type: "hello", token: "0123456789abcdef0123", version: "0.3.0" }));
    await new Promise((r) => setTimeout(r, 100));

    assert.match((await _test.callTool("link_status")).content[0].text, /Linked.*\n.*Untitled Graph/);
    const pushed = await _test.callTool("push", { file: springs });
    assert.match(pushed.content[0].text, /Compiled 3/);
    const sent = seen.find((m) => m.op === "push").args;
    assert.ok(Object.keys(sent.libraries).some((id) => id.endsWith("springs.tmcpp")), Object.keys(sent.libraries).join());
    assert.match(sent.from, /springs-import\.tmcpp$/);
    assert.equal((await _test.callTool("pull", {})).content[0].text, "a = 2");
    const shot = await _test.callTool("screenshot", { width: 500 });
    assert.equal(shot.content[0].type, "image");
    assert.equal(shot.content[0].data, "iVBORw0KGgo=");
    ws.close();
  } finally { _test.useLink(null); await link.stop(); }
});
