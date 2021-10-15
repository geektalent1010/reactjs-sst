#!/usr/bin/env node

"use strict";

process.on("uncaughtException", (err) => {
  console.log(err);
  process.exit(1);
});

const { ESLint } = require("eslint");

const inputFiles = process.argv.slice(3);

(async function main() {})().catch((error) => {
  console.error(error);
  process.exit(1);
});
