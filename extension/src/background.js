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

let ws = null;
let status = { state: "off", message: "Not linked" };
let retry = null;
let backoff = 3000; // 3s after a drop, growing to 30s while nothing answers (each try logs an error in Chrome)

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

function setStatus(state, message) {
  status = { state, message };
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

async function ensureLink() {
  const link = await getLink();
  const pair = link?.enabled && parseCode(link.code);
  if (!pair) {
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    setStatus("off", link?.enabled ? "The pairing code doesn't look right" : "Not linked");
    return;
  }
  if (ws && ws.readyState <= 1 && ws.pair === link.code) return; // connecting or open
  if (ws) { ws.onclose = null; ws.close(); }
  clearTimeout(retry);
  const sock = new WebSocket(`ws://127.0.0.1:${pair.port}/tmcpp`);
  sock.pair = link.code;
  ws = sock;
  if (status.state !== "waiting") setStatus("waiting", "Waiting for tmcpp mcp (is an AI app running it?)");
  sock.onopen = () => sock.send(JSON.stringify({ type: "hello", token: pair.token, version: chrome.runtime.getManifest().version, browser: navigator.userAgent }));
  sock.onmessage = async (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === "welcome") { backoff = 3000; return setStatus("linked", "Linked to tmcpp mcp"); }
    if (msg.type === "denied") return setStatus("denied", msg.message ?? "The pairing code was refused");
    if (msg.type === "ping") return sock.send(JSON.stringify({ type: "pong" }));
    if (!msg.id) return;
    try { sock.send(JSON.stringify({ id: msg.id, ok: true, data: await toTab({ op: msg.op, args: msg.args }) })); }
    catch (err) { sock.send(JSON.stringify({ id: msg.id, ok: false, error: String(err?.message ?? err) })); }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (status.state !== "denied") setStatus("waiting", "Waiting for tmcpp mcp (is an AI app running it?)");
    retry = setTimeout(ensureLink, backoff);
    backoff = Math.min(backoff * 2, 30000);
  };
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
