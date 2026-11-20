// Bundle the extension: node tools/build-ext.js
import { build } from "esbuild";
await build({
  entryPoints: ["extension/src/main.js"],
  bundle: true,
  format: "iife",
  target: "chrome111",
  outfile: "extension/dist/tmcpp.js",
  legalComments: "eof",
  loader: { ".tmcpp": "text" },
});
console.log("built extension/dist/tmcpp.js");
