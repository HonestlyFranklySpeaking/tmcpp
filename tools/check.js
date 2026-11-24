#!/usr/bin/env node
// Validate compiled TMC with DesModder's real parser: node tools/check.js file.tmcpp (or file.tmc)
// The same as `tmcpp check`; the code lives in src/check.js.
import { runCheck } from "../src/check.js";

process.exit(await runCheck(process.argv.slice(2)));
