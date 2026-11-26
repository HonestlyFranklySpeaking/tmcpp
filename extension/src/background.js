// TMC++ background service worker: fetches libraries for `import "gh:..."` and https imports.
// host_permissions in the manifest limit it to raw GitHub files and gists.
import { ghUrl } from "../../src/ghurl.js";

const ALLOWED = /^https:\/\/(raw\.githubusercontent\.com|gist\.githubusercontent\.com)\//;
const MAX = 512 * 1024; // a library is text; anything bigger is a mistake

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.op !== "fetch") return false;
  (async () => {
    const url = msg.id.startsWith("gh:") ? ghUrl(msg.id) : msg.id;
    if (!url || !ALLOWED.test(url)) return { ok: false, error: `Only raw GitHub files and gists can be imported (${msg.id})` };
    const res = await fetch(url, { credentials: "omit", cache: "no-cache" });
    if (!res.ok) return { ok: false, error: `${url} answered ${res.status}` };
    const text = await res.text();
    if (text.length > MAX) return { ok: false, error: `${url} is over 512 KB, too big for a library` };
    return { ok: true, url, text };
  })().then(reply, (e) => reply({ ok: false, error: String(e?.message ?? e) }));
  return true; // the reply comes later
});

// ---------- the AI link (M14): `tmcpp mcp` on this computer <-> the open Desmos tab ----------
// Off until the user pastes a pairing code (PORT-TOKEN) in the panel. Then this worker keeps a
// WebSocket to ws://127.0.0.1:PORT open and passes each request to the Desmos tab used last.
// Desmos tabs say hello every 20s, which also wakes this worker to reconnect after a restart.

// Two servers can link to the tab at once, with the same pairing code: `tmcpp mcp` (an AI app) on
// the code's port, and the VS Code extension on the port after it.
const SERVERS = [{ name: "tmcpp mcp", offset: 0 }, { name: "VS Code", offset: 1 }].map((s) => ({ ...s, ws: null, state: "off", retry: null, backoff: 3000 }));
let status = { state: "off", message: "Not linked" };

const getLink = async () => (await chrome.storage.local.get("link")).link ?? null;
const parseCode = (code) => { const m = /^(\d{2,5})-([0-9a-f]{16,})$/.exec(String(code ?? "").trim()); return m && { port: Number(m[1]), token: m[2] }; };

async function tabs() { return (await chrome.storage.session.get("tabs")).tabs ?? {}; }
async function noteTab(id, alive = true, inUse = true) {
  const t = await tabs();
  if (!alive) delete t[id];
  else if (inUse || !(id in t)) t[id] = Date.now(); // background tabs keep their place in the order
  await chrome.storage.session.set({ tabs: t });
}
chrome.tabs.onRemoved.addListener((id) => { noteTab(id, false); });

/** One status for the panel, from both servers. */
function updateStatus() {
  const linked = SERVERS.filter((s) => s.state === "linked").map((s) => s.name);
  const denied = SERVERS.find((s) => s.state === "denied");
  status = linked.length ? { state: "linked", message: `Linked to ${linked.join(" and ")}`, servers: linked }
    : denied ? { state: "denied", message: denied.deniedMessage ?? "The pairing code was refused" }
    : SERVERS.some((s) => s.state === "waiting") ? { state: "waiting", message: "Waiting for tmcpp mcp or VS Code (is an AI app or VS Code linking?)" }
    : { state: "off", message: "Not linked" };
  tabs().then((t) => { for (const id of Object.keys(t)) chrome.tabs.sendMessage(Number(id), { op: "link-status", status }).catch(() => {}); });
}

/** Send one request to the most recently used Desmos tab that answers. */
async function toTab(req) {
  const order = Object.entries(await tabs()).sort((a, b) => b[1] - a[1]).map(([id]) => Number(id));
  if (!order.length) throw new Error("no Desmos tab is open: open https://www.desmos.com/calculator");
  for (const id of order) {
    let res;
    try { res = await chrome.tabs.sendMessage(id, { op: "link-req", req }); }
    catch { await noteTab(id, false); continue; } // the tab closed or navigated away
    if (!res) continue;
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }
  throw new Error("no Desmos tab answered: reload the Desmos tab");
}

function close(s) { if (s.ws) { s.ws.onclose = null; s.ws.close(); s.ws = null; } clearTimeout(s.retry); }

function connect(s, pair, code) {
  if (s.ws && s.ws.readyState <= 1 && s.ws.pair === code) return; // connecting or open
  close(s);
  const sock = new WebSocket(`ws://127.0.0.1:${pair.port + s.offset}/tmcpp`);
  sock.pair = code;
  s.ws = sock;
  if (s.state !== "waiting" && s.state !== "linked") { s.state = "waiting"; updateStatus(); }
  sock.onopen = () => sock.send(JSON.stringify({ type: "hello", token: pair.token, version: chrome.runtime.getManifest().version, browser: navigator.userAgent }));
  sock.onmessage = async (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === "welcome") { s.backoff = 3000; s.state = "linked"; return updateStatus(); }
    if (msg.type === "denied") { s.state = "denied"; s.deniedMessage = msg.message; return updateStatus(); }
    if (msg.type === "ping") return sock.send(JSON.stringify({ type: "pong" }));
    if (!msg.id) return;
    try { sock.send(JSON.stringify({ id: msg.id, ok: true, data: await toTab({ op: msg.op, args: msg.args }) })); }
    catch (err) { sock.send(JSON.stringify({ id: msg.id, ok: false, error: String(err?.message ?? err) })); }
  };
  sock.onclose = () => {
    if (s.ws !== sock) return;
    s.ws = null;
    if (s.state !== "denied") s.state = "waiting";
    updateStatus();
    // 3s after a drop, growing to 30s while nothing answers (each try logs an error in Chrome)
    s.retry = setTimeout(ensureLink, s.backoff);
    s.backoff = Math.min(s.backoff * 2, 30000);
  };
}

async function ensureLink() {
  const link = await getLink();
  const pair = link?.enabled && parseCode(link.code);
  if (!pair) {
    for (const s of SERVERS) { close(s); s.state = "off"; }
    updateStatus();
    if (link?.enabled) { status = { state: "off", message: "The pairing code doesn't look right" }; }
    return;
  }
  for (const s of SERVERS) connect(s, pair, link.code);
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.op === "tab-hello") {
    if (sender.tab?.id !== undefined) noteTab(sender.tab.id, true, !!msg.inUse);
    ensureLink().then(() => reply(status), () => reply(status));
    return true;
  }
  if (msg?.op === "link-get") { getLink().then((link) => reply({ link, status })); return true; }
  return false;
});
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.link) ensureLink(); });
ensureLink();
