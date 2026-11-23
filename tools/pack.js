#!/usr/bin/env node
// Package the browser extension for sharing: npm run pack
// Builds it, then writes release/tmcpp-extension-<version>.zip (manifest + dist), which can be
// unzipped and loaded with "Load unpacked", or uploaded to the Chrome Web Store.
// The zip is written here with Node's zlib, so it works the same on Windows, macOS and Linux.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { join, relative } from "node:path";

await import("./build-ext.js");

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ext = join(root, "extension");
const { version } = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
files.push(join(ext, "manifest.json"));
walk(join(ext, "dist"));

// CRC-32 (the zip format's checksum)
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const local = [], central = [];
let offset = 0;
for (const path of files) {
  const name = Buffer.from(relative(ext, path).split("\\").join("/"));
  const data = readFileSync(path);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0, 6);
  head.writeUInt16LE(8, 8); head.writeUInt32LE(0, 10); head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28);
  local.push(head, name, packed);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0, 8); entry.writeUInt16LE(8, 10); entry.writeUInt32LE(0, 12);
  entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += head.length + name.length + packed.length;
}
const dir = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);

mkdirSync(join(root, "release"), { recursive: true });
const out = join(root, "release", `tmcpp-extension-${version}.zip`);
writeFileSync(out, Buffer.concat([...local, dir, end]));
console.log(`packed ${files.length} files into ${relative(root, out)}`);
