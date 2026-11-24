// The extension link: handshake, pairing, requests both ways, big messages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Link, pairing } from "../src/link.js";

const open = (port) => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/tmcpp`);
  ws.onopen = () => resolve(ws);
  ws.onerror = () => reject(new Error("couldn't connect"));
});
const next = (ws) => new Promise((r) => ws.addEventListener("message", (e) => r(JSON.parse(e.data)), { once: true }));

test("link: pairing code is made once and kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "tmcpp-link-"));
  const a = pairing({ dir, port: 1234 }), b = pairing({ dir, port: 1234 });
  assert.match(a.code, /^1234-[0-9a-f]{20}$/);
  assert.equal(a.code, b.code);
});

test("link: pairs with the right token, answers requests, carries big messages", async () => {
  const link = new Link({ port: 0, token: "0123456789abcdef0123", allowOrigin: () => true });
  await link.start();
  try {
    const bad = await open(link.port);
    bad.send(JSON.stringify({ type: "hello", token: "nope" }));
    assert.equal((await next(bad)).type, "denied");
    assert.equal(link.connected, false);
    await assert.rejects(link.request("info"), /isn't linked/);

    const ws = await open(link.port);
    ws.send(JSON.stringify({ type: "hello", token: "0123456789abcdef0123", version: "test" }));
    assert.equal((await next(ws)).type, "welcome");
    assert.equal(link.connected, true);

    // The extension's side: echo requests back, with a large payload.
    const big = "x".repeat(200000);
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id) ws.send(JSON.stringify(m.op === "fail" ? { id: m.id, ok: false, error: "nope" } : { id: m.id, ok: true, data: { op: m.op, args: m.args, big } }));
    });
    const r = await link.request("push", { source: "a = 1" });
    assert.equal(r.op, "push");
    assert.equal(r.args.source, "a = 1");
    assert.equal(r.big.length, 200000);
    await assert.rejects(link.request("fail"), /nope/);
    const echoed = await link.request("push", { source: big });
    assert.equal(echoed.args.source.length, 200000);

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(link.connected, false);
  } finally { await link.stop(); }
});

test("link: web pages can't connect", async () => {
  const link = new Link({ port: 0, token: "0123456789abcdef0123" }); // the real origin check
  await link.start();
  try {
    await assert.rejects(open(link.port)); // Node's WebSocket sends no chrome-extension:// origin
  } finally { await link.stop(); }
});
