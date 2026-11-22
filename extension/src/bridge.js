// TMC++ storage bridge. Runs in the extension's isolated world, where chrome.storage exists,
// and answers the panel (which runs in the page) over window.postMessage. Fetches go to the
// background service worker, which may only reach raw GitHub files.
const KEY = "libs";
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
    const res = await chrome.runtime.sendMessage({ op: "fetch", id });
    if (!res?.ok) throw new Error(res?.error ?? "The extension's background worker didn't answer");
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
    const data = await ops[msg.op](msg);
    window.postMessage({ tmcpp: "res", id: msg.id, ok: true, data }, location.origin);
  } catch (err) {
    window.postMessage({ tmcpp: "res", id: msg.id, ok: false, error: String(err?.message ?? err) }, location.origin);
  }
});

// Another tab saved or fetched a library: pass the new set to this page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) window.postMessage({ tmcpp: "changed", data: changes[KEY].newValue ?? {} }, location.origin);
});
