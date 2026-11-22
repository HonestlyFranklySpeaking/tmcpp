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
    if (!chrome.runtime?.id) throw new Error("The extension was reloaded; reload this page too");
    const data = await ops[msg.op](msg);
    window.postMessage({ tmcpp: "res", id: msg.id, ok: true, data }, location.origin);
  } catch (err) {
    console.warn(`[TMC++] ${msg.op} failed:`, err);
    window.postMessage({ tmcpp: "res", id: msg.id, ok: false, error: String(err?.message ?? err) }, location.origin);
  }
});

// Another tab saved or fetched a library: pass the new set to this page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) window.postMessage({ tmcpp: "changed", data: changes[KEY].newValue ?? {} }, location.origin);
});
