import { existsSync } from "node:fs";

const required = [
  "standalone-source/index.html",
  "standalone-source/app.js",
  "standalone-source/styles.css",
  "standalone-source/instruments/bank.json",
];

const missing = required.filter((path) => !existsSync(new URL(`../${path}`, import.meta.url)));

if (missing.length) {
  console.error(`Missing source snapshot files:\n${missing.join("\n")}`);
  process.exit(1);
}

console.log("Source snapshot present.");
