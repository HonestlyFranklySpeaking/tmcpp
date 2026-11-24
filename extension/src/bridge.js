// TMC++ storage bridge. Runs in the extension's isolated world, where chrome.storage exists,
// and answers the panel (which runs in the page) over window.postMessage. Fetches go to the
// background service worker, which may only reach raw GitHub files.
import { ghUrl } from "../../src/ghurl.js";

const KEY = "libs";
const ALLOWED = /^https:\/\/(raw\.githubusercontent\.com|gist\.githubusercontent\.com)\//;
const withTimeout = (promise, ms, what) => Promise.race([promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} didn't answer in ${ms / 1000}s`)), ms))]);

// Ask the background worker first; if it can't be reached, fetch from here. Raw GitHub files
// allow cross-site reads, so either route gets the same text.
async function download(id) {
  try {
    const res = await withTimeout(chrome.runtime.sendMessage({ op: "fetch", id }), 6000, "The background worker");
    if (res?.ok) return res;
    if (res?.error) throw Object.assign(new Error(res.error), { final: true });
    throw new Error("The background worker sent no reply");
  } catch (e) {
    if (e.final) throw e;
    console.warn("[TMC++] background fetch failed, fetching from the page instead:", e.message);
    const url = id.startsWith("gh:") ? ghUrl(id) : id;
    if (!url || !ALLOWED.test(url)) throw new Error(`Only raw GitHub files and gists can be imported (${id})`);
    const res = await withTimeout(fetch(url, { credentials: "omit", cache: "no-cache" }), 15000, url);
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return { ok: true, url, text: await res.text() };
  }
}
const read = async () => (await chrome.storage.local.get(KEY))[KEY] ?? {};
const write = (libs) => chrome.storage.local.set({ [KEY]: libs });

const ops = {
  // The AI link: the panel reads and changes the pairing code; the background worker uses it.
  async linkGet() { return chrome.runtime.sendMessage({ op: "link-get" }); },
  async linkSet({ code, enabled }) {
    const link = { code: String(code ?? "").trim(), enabled: !!enabled };
    await chrome.storage.local.set({ link });
    return { link };
  },
  async list() { return read(); },
  async save({ name, source }) {
    const libs = await read();
    libs[name] = { source, savedAt: Date.now() };
    await write(libs);
    return libs;
  },
  async remove({ name }) {
    const libs = await read();
    delete libs[name];
    await write(libs);
    return libs;
  },
  async fetch({ id }) {
    const res = await download(id);
    const libs = await read();
    libs[id] = { source: res.text, url: res.url, fetchedAt: Date.now() };
    await write(libs);
    return libs;
  },
};

window.addEventListener("message", async (e) => {
  const msg = e.data;
  if (e.source !== window || msg?.tmcpp !== "req" || !ops[msg.op]) return;
  try {
    // An old copy of this script, left in a tab after the extension was reloaded: say so in the
    // panel, but it's expected, so don't log it as a warning (Chrome lists those as errors).
    if (!chrome.runtime?.id) {
      window.postMessage({ tmcpp: "res", seq: msg.seq, ok: false, error: "The extension was reloaded; reload this page too" }, location.origin);
      return;
    }
    const data = await ops[msg.op](msg.args ?? {});
    window.postMessage({ tmcpp: "res", seq: msg.seq, ok: true, data }, location.origin);
  } catch (err) {
    console.warn(`[TMC++] ${msg.op} failed:`, err);
    window.postMessage({ tmcpp: "res", seq: msg.seq, ok: false, error: String(err?.message ?? err) }, location.origin);
  }
});

// Another tab saved or fetched a library: pass the new set to this page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) window.postMessage({ tmcpp: "changed", data: changes[KEY].newValue ?? {} }, location.origin);
});

// ---------- the AI link: requests from `tmcpp mcp`, via the background worker, to the panel ----------
let linkSeq = 0;
const linkWaiting = new Map();
window.addEventListener("message", (e) => {
  const msg = e.data;
  if (e.source !== window || msg?.tmcpp !== "link-res") return;
  const done = linkWaiting.get(msg.seq);
  if (done) { linkWaiting.delete(msg.seq); done(msg); }
});
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.op === "link-status") { window.postMessage({ tmcpp: "link-status", status: msg.status }, location.origin); return false; }
  if (msg?.op !== "link-req") return false;
  const seq = ++linkSeq;
  const timer = setTimeout(() => { linkWaiting.delete(seq); reply({ ok: false, error: "the TMC++ panel didn't answer; reload the Desmos tab" }); }, 25000);
  linkWaiting.set(seq, (res) => { clearTimeout(timer); reply({ ok: res.ok, data: res.data, error: res.error }); });
  window.postMessage({ tmcpp: "link-req", seq, op: msg.req.op, args: msg.req.args ?? {} }, location.origin);
  return true;
});
// Say hello now, when the tab comes to the front, and every 20s: the worker learns which Desmos
// tab is in use, and the hello wakes it to reconnect the link if it was stopped.
const hello = () => {
  if (!chrome.runtime?.id) return; // the extension was reloaded; this copy is stale
  chrome.runtime.sendMessage({ op: "tab-hello", inUse: !document.hidden && document.hasFocus() }).then((status) => {
    if (status) window.postMessage({ tmcpp: "link-status", status }, location.origin);
  }).catch(() => {});
};
hello();
window.addEventListener("focus", hello);
document.addEventListener("visibilitychange", () => { if (!document.hidden) hello(); });
setInterval(hello, 20000);
