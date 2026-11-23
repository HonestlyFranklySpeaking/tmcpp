// Bundle the extension: node tools/build-ext.js
import { build } from "esbuild";
await import("./build-std.js"); // the built-in libraries go into the bundle
await build({
  entryPoints: ["extension/src/main.js"],
  bundle: true,
  format: "iife",
  target: "chrome111",
  outfile: "extension/dist/tmcpp.js",
  legalComments: "eof",
  // CodeMirror is large unminified; keep names readable so error stack traces still make sense.
  minifyWhitespace: true,
  minifySyntax: true,
  loader: { ".tmcpp": "text" },
});
// The storage bridge (isolated world) and the background worker that fetches GitHub libraries.
for (const name of ["bridge", "background"]) {
  await build({ entryPoints: [`extension/src/${name}.js`], bundle: true, format: "iife", target: "chrome111", outfile: `extension/dist/${name}.js` });
}
console.log("built extension/dist/tmcpp.js, bridge.js, background.js");
