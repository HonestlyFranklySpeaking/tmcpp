#!/usr/bin/env node
// The contents of the syntax reference: every heading of every page, linked, written into
// docs/syntax/README.md between the contents markers. npm run build:docs
// test/docs.test.js fails when the list is out of date or a link in the docs points nowhere.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PAGES = ["basics", "logic", "styles", "components", "macros", "libraries", "blocks", "round-trip", "errors"];
const DIR = new URL("../docs/syntax/", import.meta.url);
const START = "<!-- contents:start -->", END = "<!-- contents:end -->";

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces to hyphens. */
export function slug(text) {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

/** A page's headings, outside code blocks: [{ level, text, anchor }], repeats numbered as GitHub does. */
export function headings(md) {
  const out = [], seen = new Map();
  let fence = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fence = !fence; continue; }
    const m = !fence && /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (!m) continue;
    const base = slug(m[2]), n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ level: m[1].length, text: m[2], anchor: n ? `${base}-${n}` : base });
  }
  return out;
}

export const page = (name) => readFileSync(new URL(`${name}.md`, DIR), "utf8");

/** The contents list, as markdown. */
export function contents() {
  const lines = [];
  for (const name of PAGES) {
    const hs = headings(page(name));
    const title = hs.find((h) => h.level === 1);
    lines.push(`- [${title.text}](${name}.md)`);
    let shift = 0;
    for (const h of hs) {
      if (h.level === 1) continue;
      // A page's first section often repeats its title (# Components, ## Components): skip that
      // one, and list what's under it one level up.
      if (h.level === 2) shift = h.text === title.text ? 1 : 0;
      if (h.level === 2 && shift) continue;
      lines.push(`${"  ".repeat(h.level - 1 - shift)}- [${h.text}](${name}.md#${h.anchor})`);
    }
  }
  return lines.join("\n");
}

/** The README with its contents list replaced. */
export function withContents(readme) {
  const a = readme.indexOf(START), b = readme.indexOf(END);
  if (a === -1 || b === -1) throw new Error(`docs/syntax/README.md needs ${START} and ${END}`);
  return readme.slice(0, a + START.length) + "\n" + contents() + "\n" + readme.slice(b);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = fileURLToPath(new URL("README.md", DIR));
  writeFileSync(file, withContents(readFileSync(file, "utf8")));
  console.log("wrote the contents of docs/syntax/README.md");
}
