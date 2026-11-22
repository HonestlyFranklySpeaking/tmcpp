// Kept apart so the extension's background worker can use it without the whole compiler.
/** `gh:user/repo/path.tmcpp@ref` -> the raw file URL. The ref defaults to HEAD. */
export function ghUrl(id) {
  const m = id.match(/^gh:([^/@]+)\/([^/@]+)\/([^@]+?)(?:@(.+))?$/);
  if (!m) return null;
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[4] ?? "HEAD"}/${m[3]}`;
}
