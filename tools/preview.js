#!/usr/bin/env node
// Render a TMC++ (or TMC) file in real Desmos and save a PNG: npm run preview -- FILE [options]
// The same as `tmcpp preview`; the code and its options are in src/preview.js.
import { runPreview } from "../src/preview.js";

await runPreview(process.argv.slice(2));
