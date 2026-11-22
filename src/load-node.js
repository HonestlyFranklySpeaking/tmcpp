// Library loader for Node (the CLI and tools/check.js): files from disk, gh: and https URLs
// from the network. std/... is bundled, so the compiler has it already.
import { readFileSync, existsSync } from "node:fs";
import { decodeSource } from "./decode.js";
import { ghUrl } from "./ghurl.js";

export async function loadNode(id) {
  const url = id.startsWith("gh:") ? ghUrl(id) : /^https:\/\//.test(id) ? id : null;
  if (url) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      console.error(`${id}: ${url} answered ${res.status}`);
    } catch (e) {
      console.error(`${id}: couldn't reach ${url} (${e.cause?.code ?? e.message}); behind a proxy, run with NODE_USE_ENV_PROXY=1`);
    }
    return undefined;
  }
  if (id.startsWith("std/")) return undefined;
  return existsSync(id) ? decodeSource(readFileSync(id)) : undefined;
}
