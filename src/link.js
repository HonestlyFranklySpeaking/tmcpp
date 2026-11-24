// The link between `tmcpp mcp` and the browser extension: a small WebSocket server on 127.0.0.1.
// The extension's background worker connects, proves it knows the pairing token, and then the
// MCP server can ask the open Desmos tab to load a graph, rebuild TMC++ from it, or screenshot it.
//
// Who may connect: only a browser extension (the Origin header, which web pages can't fake, must
// be chrome-extension://...) that sends the token within 5 seconds. One client at a time.
// No dependencies: the WebSocket handshake and frames are done here (RFC 6455, server side).
import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_PORT = 51324;
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_MESSAGE = 32 * 1024 * 1024; // screenshots are the big ones
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

/** The pairing code the extension needs: PORT-TOKEN. The token is made once and kept in ~/.tmcpp. */
export function pairing({ dir = join(homedir(), ".tmcpp"), port = Number(process.env.TMCPP_LINK_PORT) || DEFAULT_PORT } = {}) {
  const file = join(dir, "link.json");
  let token;
  try { token = JSON.parse(readFileSync(file, "utf8")).token; } catch {}
  if (!/^[0-9a-f]{16,}$/.test(token ?? "")) {
    token = randomBytes(10).toString("hex");
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify({ token }, null, 2) + "\n", { mode: 0o600 });
  }
  return { port, token, code: `${port}-${token}`, file };
}

function frame(op, payload) {
  const len = payload.length;
  const head = len < 126 ? Buffer.from([0x80 | op, len])
    : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255])
    : Buffer.concat([Buffer.from([0x80 | op, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(len)); return b; })()]);
  return Buffer.concat([head, payload]);
}

/** One WebSocket connection: emits whole text messages to onMessage. */
class Socket {
  constructor(socket, { onMessage, onClose }) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.parts = [];
    this.size = 0;
    this.closed = false;
    this.onMessage = onMessage;
    this.onClose = onClose;
    socket.on("data", (d) => this.data(d));
    socket.on("close", () => this.finish());
    socket.on("error", () => this.finish());
  }
  finish() { if (!this.closed) { this.closed = true; this.onClose?.(); } }
  send(obj) { if (!this.closed) this.socket.write(frame(1, Buffer.from(JSON.stringify(obj)))); }
  close(code = 1000) {
    if (this.closed) return;
    const b = Buffer.alloc(2); b.writeUInt16BE(code);
    try { this.socket.end(frame(8, b)); } catch {}
    this.finish();
  }
  data(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (!masked || len > MAX_MESSAGE) return this.close(1002); // clients must mask; nothing huge
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op === 8) return this.close();
      if (op === 9) { this.socket.write(frame(10, payload)); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2 || op === 0) {
        this.parts.push(payload);
        this.size += payload.length;
        if (this.size > MAX_MESSAGE) return this.close(1009);
        if (fin) {
          const text = Buffer.concat(this.parts).toString("utf8");
          this.parts = []; this.size = 0;
          let msg;
          try { msg = JSON.parse(text); } catch { continue; }
          this.onMessage(msg);
        }
      }
    }
  }
}

export class Link {
  /** allowOrigin: for tests; normally only extensions may connect. */
  constructor({ port, token, log = () => {}, allowOrigin = (o) => EXTENSION_ORIGIN.test(o ?? "") } = {}) {
    Object.assign(this, { port, token, log, allowOrigin });
    this.client = null;     // the paired extension
    this.clientInfo = null; // what it said in hello
    this.pending = new Map();
    this.seq = 0;
    this.listening = false;
    this.busy = false;      // another tmcpp mcp holds the port
  }

  start() {
    this.server = createServer((_req, res) => { res.writeHead(426, { "content-type": "text/plain" }); res.end("tmcpp link: WebSocket only\n"); });
    this.server.on("upgrade", (req, socket) => this.upgrade(req, socket));
    this.server.on("error", (e) => {
      if (e.code === "EADDRINUSE") {
        if (!this.busy) this.log(`link: port ${this.port} is in use (another tmcpp mcp?); retrying every 10s`);
        this.busy = true;
        this.retry = setTimeout(() => this.server.listen(this.port, "127.0.0.1"), 10000);
        this.retry.unref?.();
      } else this.log(`link: ${e.message}`);
    });
    this.server.on("listening", () => { this.listening = true; this.busy = false; this.port = this.server.address().port; this.log(`link: waiting for the extension on 127.0.0.1:${this.port}`); });
    this.server.listen(this.port, "127.0.0.1");
    this.ping = setInterval(() => this.client?.send({ type: "ping" }), 20000); // keeps the extension's worker awake
    this.ping.unref?.();
    return new Promise((r) => { this.server.once("listening", r); this.server.once("error", r); });
  }

  stop() {
    clearInterval(this.ping); clearTimeout(this.retry);
    this.client?.close();
    return new Promise((r) => this.server ? this.server.close(() => r()) : r());
  }

  upgrade(req, socket) {
    const reject = (code, why) => { socket.end(`HTTP/1.1 ${code} ${why}\r\nConnection: close\r\n\r\n`); };
    if (!req.url.startsWith("/tmcpp")) return reject(404, "Not Found");
    if (!this.allowOrigin(req.headers.origin)) return reject(403, "Forbidden");
    const key = req.headers["sec-websocket-key"];
    if (!key || req.headers.upgrade?.toLowerCase() !== "websocket") return reject(400, "Bad Request");
    const accept = createHash("sha1").update(key + GUID).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setNoDelay(true);

    let paired = false;
    const ws = new Socket(socket, {
      onMessage: (msg) => {
        if (!paired) {
          if (msg.type !== "hello" || !this.tokenOk(msg.token)) {
            ws.send({ type: "denied", message: "wrong pairing code: run `tmcpp pair` and paste the code again" });
            return ws.close(4001);
          }
          paired = true;
          clearTimeout(timer);
          if (this.client) this.client.close(4000); // a newer connection wins (the worker restarted)
          this.client = ws;
          this.clientInfo = { version: msg.version, browser: msg.browser, since: Date.now() };
          ws.send({ type: "welcome" });
          this.log("link: extension paired");
          return;
        }
        if (msg.type === "pong" || msg.type === "ping") return;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error ?? "the extension failed"));
      },
      onClose: () => {
        clearTimeout(timer);
        if (this.client !== ws) return;
        this.client = null; this.clientInfo = null;
        for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error("the extension disconnected")); }
        this.pending.clear();
        this.log("link: extension disconnected");
      },
    });
    const timer = setTimeout(() => { if (!paired) ws.close(4001); }, 5000);
  }

  tokenOk(t) {
    const a = Buffer.from(String(t ?? "")), b = Buffer.from(this.token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  get connected() { return !!this.client; }

  /** Ask the extension (and through it, the Desmos tab) to do something. */
  request(op, args = {}, timeout = 30000) {
    if (!this.client) return Promise.reject(new Error(this.notLinkedMessage()));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`the extension didn't answer '${op}' in ${timeout / 1000}s`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.client.send({ id, op, args });
    });
  }

  notLinkedMessage() {
    if (this.busy) return `another tmcpp mcp is using the link port ${this.port}; close it, or set TMCPP_LINK_PORT for this one (and pair again)`;
    return "the browser extension isn't linked. In Desmos, open the TMC++ panel, choose ⋯ > Link to AI, and paste the pairing code (run `tmcpp pair` to see it)";
  }
}
