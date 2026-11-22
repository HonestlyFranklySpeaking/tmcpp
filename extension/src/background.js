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
