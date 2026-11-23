// Bundle the VS Code extension: node tools/build-vscode.js  (npm run build:vscode)
import { build } from "esbuild";
await import("./build-std.js"); // the built-in libraries go into the bundle
await build({
  entryPoints: ["vscode/src/extension.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
  outfile: "vscode/dist/extension.js",
  loader: { ".tmcpp": "text" },
});
console.log("built vscode/dist/extension.js");
