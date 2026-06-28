import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const standaloneRoot = process.env.DANCE_STATION_ROOT || "D:\\autotransition";

const comparisons = [
  ["standalone-source/index.html", "src/autotransition/ui/static/index.html"],
  ["standalone-source/app.js", "src/autotransition/ui/static/app.js"],
  ["standalone-source/styles.css", "src/autotransition/ui/static/styles.css"],
  ["standalone-source/instruments/bank.json", "src/autotransition/ui/static/instruments/bank.json"],
];

if (existsSync(standaloneRoot)) {
  const mismatches = comparisons.filter(([snapshotPath, sourcePath]) => {
    const snapshot = readFileSync(join(repoRoot, snapshotPath), "utf8").replace(/\r\n/g, "\n");
    const source = readFileSync(join(standaloneRoot, sourcePath), "utf8").replace(/\r\n/g, "\n");
    return snapshot !== source;
  });

  if (mismatches.length) {
    console.error("Source snapshot differs from standalone Dance Station:");
    mismatches.forEach(([snapshotPath, sourcePath]) => {
      console.error(`- ${snapshotPath} != ${join(standaloneRoot, sourcePath)}`);
    });
    process.exit(1);
  }

  console.log(`Source snapshot matches ${standaloneRoot}.`);
} else {
  console.log("Source snapshot present. Set DANCE_STATION_ROOT to compare against standalone.");
}
