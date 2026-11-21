// Decode source bytes, honouring byte-order marks. Windows PowerShell's `>` writes UTF-16 LE.
export function decodeSource(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let enc = "utf-8", skip = 0;
  if (u8[0] === 0xff && u8[1] === 0xfe) { enc = "utf-16le"; skip = 2; }
  else if (u8[0] === 0xfe && u8[1] === 0xff) { enc = "utf-16be"; skip = 2; }
  else if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) skip = 3;
  return new TextDecoder(enc).decode(u8.subarray(skip)).replace(/\r\n/g, "\n");
}
